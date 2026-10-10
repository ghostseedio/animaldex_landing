import {readFile} from "node:fs/promises";
import path from "node:path";
import type {BlogMediaBlock, ContentImage} from "@/data/content-schema";
import type {BlogPost} from "@/data/blog";
import {getManagedBlogPost, getManagedBlogPosts} from "@/lib/admin-content";
import {getAbsoluteUrl, getSiteUrl} from "@/lib/site";
import {getSpeciesBySlug} from "@/data/species";
import {sourceSpecies} from "@/lib/content-video/stat-cards";
import {licenseFromCaption, MAX_PLAN_IMAGES, type SourceImage, type VideoSource} from "@/lib/content-video/plan";

// Turns a blog post (code-defined or Content Studio) into what the planner
// needs: its text and its photos. Placeholder product renders and SVGs are
// left out; a video of them has nothing to animate.

const MAX_TEXT_CHARS = 14_000;
/** Narrower than this and a 9:16 crop is visibly soft at 1080 wide. */
const MIN_IMAGE_WIDTH = 480;

function stripHtml(value: string) {
    return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function mediaImages(media: BlogMediaBlock | undefined): ContentImage[] {
    if (!media) return [];
    if (media.type === "image") return [media.image];
    if (media.type === "gallery") return media.images;
    return [];
}

function usableImage(image: ContentImage | undefined): image is ContentImage {
    if (!image?.src) return false;
    if (image.src.includes("/images/placeholders/") || /\.svg(\?|$)/i.test(image.src)) return false;
    return !image.width || image.width >= MIN_IMAGE_WIDTH;
}

export function collectPostImages(post: BlogPost): SourceImage[] {
    const all: ContentImage[] = [
        post.featuredImage,
        ...post.sections.flatMap((section) => [
            ...mediaImages(section.media),
            ...(section.cards ?? []).flatMap((card) => card.image ? [card.image] : []),
            ...(section.subsections ?? []).flatMap((subsection) => mediaImages(subsection.media))
        ])
    ];
    const seen = new Set<string>();
    return all
        .filter(usableImage)
        .filter((image) => (seen.has(image.src) ? false : (seen.add(image.src), true)))
        .slice(0, MAX_PLAN_IMAGES)
        .map((image, offset) => ({
            index: offset + 1,
            src: image.src,
            alt: image.alt ?? "",
            caption: image.caption ?? null,
            width: image.width,
            height: image.height,
            license: licenseFromCaption(image.caption)
        }));
}

export function postText(post: BlogPost) {
    const lines = [
        post.title,
        post.description,
        ...post.sections.flatMap((section) => [
            `\n## ${section.title}`,
            ...section.paragraphs.map(stripHtml),
            ...(section.html ? [stripHtml(section.html)] : []),
            ...(section.cards ?? []).map((card) => `- ${card.label}: ${stripHtml(card.body)}`),
            ...(section.table ? [section.table.columns.join(" | "), ...section.table.rows.map((row) => row.cells.join(" | "))] : []),
            ...(section.pullQuote ? [`"${section.pullQuote}"`] : []),
            ...(section.subsections ?? []).flatMap((subsection) => [`\n### ${subsection.title}`, ...subsection.paragraphs.map(stripHtml)])
        ]),
        ...(post.faq?.length ? ["\n## FAQ", ...post.faq.map((item) => `Q: ${item.question}\nA: ${stripHtml(item.answer)}`)] : [])
    ];
    const text = lines.filter(Boolean).join("\n");
    return text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}…` : text;
}

export function blogPostUrl(slug: string) {
    return getAbsoluteUrl("en", `/blog/${slug}`);
}

export function toVideoSource(post: BlogPost): VideoSource {
    return {
        type: "blog",
        format: "editorial",
        slug: post.slug,
        title: post.title,
        description: post.description,
        url: blogPostUrl(post.slug),
        tags: post.tags,
        text: postText(post),
        images: collectPostImages(post)
    };
}

export type VideoCandidate = {slug: string; title: string; publishedAt: string; imageCount: number};

/** Every post a video could be made from: enough photos to cut between. Newest first. */
export async function listVideoCandidates(): Promise<VideoCandidate[]> {
    const posts = await getManagedBlogPosts();
    return posts
        .map((post) => ({slug: post.slug, title: post.title, publishedAt: post.publishedAt, imageCount: collectPostImages(post).length}))
        .filter((candidate) => candidate.imageCount >= 2);
}

export async function loadVideoSource(slug: string): Promise<VideoSource | null> {
    const post = await getManagedBlogPost(slug);
    if (!post) return null;
    const source = toVideoSource(post);
    // The animals the post is about; the planner marks scenes about one of them for its stats card.
    const slugs = Array.from(new Set([...post.speciesSlugs, ...(post.systemsSpeciesSlugs ?? [])])).slice(0, 8);
    const species = await sourceSpecies(slugs.map((speciesSlug) => ({slug: speciesSlug, name: getSpeciesBySlug(speciesSlug)?.name ?? speciesSlug.replace(/-/g, " "), image: null})));
    return species.length ? {...source, species} : source;
}

/** The bytes of a blog image: local files from public/, anything else over HTTP. */
export async function loadImageBytes(src: string): Promise<Buffer> {
    if (src.startsWith("/") && !src.startsWith("//")) {
        const local = path.join(process.cwd(), "public", decodeURIComponent(src.split("?")[0]));
        try {
            return await readFile(local);
        } catch {
            // Not on disk (e.g. a Next-optimised path): fall through to HTTP.
        }
    }
    const url = /^https?:\/\//i.test(src) ? src : new URL(src, getSiteUrl()).toString();
    const response = await fetch(url, {cache: "no-store", signal: AbortSignal.timeout(30_000)});
    if (!response.ok) throw new Error(`Image ${src} returned ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
}
