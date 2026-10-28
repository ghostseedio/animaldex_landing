import "server-only";
import {randomUUID} from "node:crypto";
import {listPageCandidates, loadPageSource} from "@/lib/content-video/page-sources";
import {SOURCE_TYPES, type SourceImage, type SourceType, type VideoSource} from "@/lib/content-video/plan";
import {loadImageBytes} from "@/lib/content-video/source";
import {uploadToStorage} from "@/lib/content-video/store";
import {EXPERIMENT_VERSION, type TextFormat} from "@/lib/social-lab/arms";
import {nextExperiment} from "@/lib/social-lab/experiments";
import {structuredClaude} from "@/lib/social-content/claude";
import {buildCarouselUserPrompt, buildTextUserPrompt, CAROUSEL_SYSTEM_PROMPT, carouselJsonSchema, normalizeCarousel, normalizeTextPosts, TEXT_JSON_SCHEMA, TEXT_SYSTEM_PROMPT, textShareCopy} from "@/lib/social-content/plan";
import {type Picture, pictureFromBytes, renderSlide, type SlideSize} from "@/lib/social-content/render";
import {carouselSourceSlugs, insertSocialContent, listSocialContent} from "@/lib/social-content/store";
import {type CarouselImages, type SocialContentRow, TEMPLATES_FOR_SOURCE} from "@/lib/social-content/types";

// Makes one carousel, or a batch of text posts, from one of our pages:
// the hook lab picks the arms, Claude writes, Satori draws, the slides go to
// the public content-videos bucket under social/<id>/, and the row lands in
// admin_social_content ready for the auto-share.

/** A carousel needs this many usable photos (cover, items, and the closing backdrop). */
const MIN_CAROUSEL_IMAGES = 3;
const PICKS_PER_RUN = 6;

type Pick = {type: SourceType; slug: string};

function shuffle<T>(list: T[], random = Math.random) {
    const copy = [...list];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
}

/** Articles this new go first: news is worth most in its first days. */
const FRESH_ARTICLE_MS = 72 * 3_600_000;

async function freshArticles() {
    return (await listPageCandidates("blog"))
        .filter((page) => Date.now() - Date.parse(page.publishedAt) < FRESH_ARTICLE_MS)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Whether a fresh article still lacks a carousel / text posts: the stock limit does not hold those back. */
export async function freshArticleNeeds() {
    const fresh = await freshArticles();
    if (!fresh.length) return {carousel: false, text: false};
    const [carousels, texts] = await Promise.all([carouselSourceSlugs().catch(() => new Set<string>()), listSocialContent("text", 200).catch(() => [])]);
    const textSlugs = new Set(texts.map((row) => `${row.source_type}:${row.source_slug}`));
    return {
        carousel: fresh.some((page) => page.imageCount >= MIN_CAROUSEL_IMAGES && !carousels.has(`blog:${page.slug}`)),
        text: fresh.some((page) => !textSlugs.has(`blog:${page.slug}`))
    };
}

/** Fresh articles first, then random pages from the families a carousel can be made of; never a page that already has one. */
async function carouselCandidates(): Promise<Pick[]> {
    const used = await carouselSourceSlugs().catch(() => new Set<string>());
    const fresh: Pick[] = (await freshArticles()).filter((page) => !used.has(`blog:${page.slug}`) && page.imageCount >= MIN_CAROUSEL_IMAGES).map((page) => ({type: "blog", slug: page.slug}));
    const types = shuffle(Object.keys(TEMPLATES_FOR_SOURCE) as SourceType[]);
    const picks: Pick[] = [];
    for (const type of types) {
        const pages = shuffle(await listPageCandidates(type)).filter((page) => !used.has(`${type}:${page.slug}`) && page.imageCount >= MIN_CAROUSEL_IMAGES);
        picks.push(...pages.slice(0, 2).map((page) => ({type, slug: page.slug})));
    }
    return [...fresh.slice(0, 2), ...shuffle(picks)].slice(0, PICKS_PER_RUN);
}

async function loadPictures(images: SourceImage[]) {
    const pictures = new Map<number, Picture>();
    await Promise.all(images.map(async (image) => {
        try {
            const picture = await pictureFromBytes(await loadImageBytes(image.src));
            if (picture) pictures.set(image.index, picture);
        } catch {
            // A photo that will not load is simply not used.
        }
    }));
    return pictures;
}

export async function generateCarousel(pick?: Pick): Promise<SocialContentRow> {
    const candidates = pick ? [pick] : await carouselCandidates();
    let source: VideoSource | null = null;
    let chosen: Pick | null = null;
    for (const candidate of candidates) {
        const loaded = await loadPageSource(candidate.type, candidate.slug).catch(() => null);
        if (loaded && loaded.images.length >= MIN_CAROUSEL_IMAGES) {
            source = loaded;
            chosen = candidate;
            break;
        }
    }
    if (!source || !chosen) throw new Error("No page with enough photos for a carousel");
    const templates = TEMPLATES_FOR_SOURCE[chosen.type] ?? ["facts"];
    const experiment = await nextExperiment("carousel");
    // Only photos that load are offered: the writer picks from what will render.
    const pictures = await loadPictures(source.images.slice(0, 12));
    const offered = {...source, images: source.images.filter((image) => pictures.has(image.index))};
    if (offered.images.length < MIN_CAROUSEL_IMAGES) throw new Error(`Only ${offered.images.length} photos of “${source.title}” loaded`);
    const reply = await structuredClaude({
        system: CAROUSEL_SYSTEM_PROMPT,
        user: buildCarouselUserPrompt(offered, templates, experiment),
        schema: carouselJsonSchema(templates),
        images: offered.images.map((image) => ({index: image.index, bytes: pictures.get(image.index)!.bytes}))
    });
    const carousel = normalizeCarousel(reply.value, reply.loadedImages, templates);
    if (!carousel) throw new Error("Claude's carousel did not fit the format");

    const id = randomUUID();
    const {slides} = carousel.spec;
    const pictureFor = (index: number) => slides[index].image !== null ? pictures.get(slides[index].image!) ?? null : null;
    const renderAll = async (size: Extract<SlideSize, "feed" | "tall">) => {
        const paths: string[] = [];
        for (let index = 0; index < slides.length; index += 1) {
            const path = `social/${id}/${size}-${String(index + 1).padStart(2, "0")}.jpg`;
            await uploadToStorage(path, await renderSlide(slides[index], pictureFor(index), size, {index, total: slides.length}), "image/jpeg");
            paths.push(path);
        }
        return paths;
    };
    const images: CarouselImages = {feed: await renderAll("feed"), tall: await renderAll("tall")};
    const pin = await renderSlide(slides[0], pictureFor(0), "pin", {index: 0, total: slides.length});
    images.pin = `social/${id}/pin.jpg`;
    await uploadToStorage(images.pin, pin, "image/jpeg");

    return insertSocialContent({
        id,
        kind: "carousel",
        source_type: chosen.type,
        source_slug: chosen.slug,
        source_title: source.title,
        spec: carousel.spec,
        images,
        share: carousel.share,
        experiment: {...experiment, version: EXPERIMENT_VERSION},
        estimated_usd: reply.usd
    });
}

/** A batch of text posts from one random page (any family: text needs no photos). */
export async function generateTextPosts(count = 4, pick?: Pick): Promise<SocialContentRow[]> {
    let source: VideoSource | null = null;
    let chosen: Pick | null = pick ?? null;
    // A fresh article no text post has come from yet goes first.
    if (!pick) {
        const written = new Set((await listSocialContent("text", 200).catch(() => [])).map((row) => `${row.source_type}:${row.source_slug}`));
        const fresh = (await freshArticles()).find((page) => !written.has(`blog:${page.slug}`));
        if (fresh) {
            source = await loadPageSource("blog", fresh.slug).catch(() => null);
            if (source) chosen = {type: "blog", slug: fresh.slug};
        }
    }
    for (let attempt = 0; attempt < 5 && !source; attempt += 1) {
        if (!pick) {
            const type = SOURCE_TYPES[Math.floor(Math.random() * SOURCE_TYPES.length)];
            const pages = await listPageCandidates(type);
            if (!pages.length) continue;
            chosen = {type, slug: pages[Math.floor(Math.random() * pages.length)].slug};
        }
        source = await loadPageSource(chosen!.type, chosen!.slug).catch(() => null);
        if (pick) break;
    }
    if (!source || !chosen) throw new Error("No page to write text posts from");
    const experiments = await Promise.all(Array.from({length: count}, () => nextExperiment("text")));
    const formats = experiments.map((experiment) => experiment.textFormat!).filter(Boolean) as TextFormat[];
    const reply = await structuredClaude({system: TEXT_SYSTEM_PROMPT, user: buildTextUserPrompt(source, formats), schema: TEXT_JSON_SCHEMA, effort: "low"});
    const posts = normalizeTextPosts(reply.value, formats);
    if (!posts.length) throw new Error("Claude's text posts did not fit the format");
    const each = reply.usd / posts.length;
    const rows: SocialContentRow[] = [];
    for (const spec of posts) {
        rows.push(await insertSocialContent({
            kind: "text",
            source_type: chosen.type,
            source_slug: chosen.slug,
            source_title: source.title,
            spec,
            share: textShareCopy(spec, source.url),
            experiment: {version: EXPERIMENT_VERSION, textFormat: spec.format},
            estimated_usd: Math.round(each * 10_000) / 10_000
        }));
    }
    return rows;
}
