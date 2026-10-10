import "server-only";
import type {BlogPost} from "@/data/blog/types";
import {blogPosts} from "@/data/blog";
import {getContentEntry, listContentEntries, saveContentEntry} from "@/lib/admin-content";
import {assembleBlogPost, isNewImageSlot, normalizeUrl, sectionImageKey, toEditable} from "@/lib/blog-generator/article-spec";
import {loadSiteCatalog, searchCatalog, type CatalogItem} from "@/lib/blog-generator/catalog";
import {CostMeter, formatCost, withCostMeter, type CostReport} from "@/lib/blog-generator/cost-meter";
import {sourceArticleImages, type ImageRequest} from "@/lib/blog-generator/images";
import {checkReachable, researchBrief, writeAndEdit, writeArticle, type Brief, type Research, type ResearchDepth} from "@/lib/blog-generator/pipeline";
import {saveRevision} from "@/lib/blog-generator/revisions";

// Editing an existing post, whether it lives in code or in Content Studio.
// The live post is turned back into the writer's JSON, revised (optionally
// with fresh research that also re-checks its claims), run through the same
// checks as a new article, and saved under the same slug. The previous
// version is backed up first; an edit that fails a check, or that the editor
// wants to review, is stored as a proposal and the live post is untouched.

export const REFRESH_INSTRUCTIONS = "Make this article as shareable as the best of the blog: a headline and first sentence that hit hard, the wildest true facts from the dossier, every section earning a \"wait, what?\", filler cut, anything wrong or out of date fixed, and a chart, quiz or flip cards where it genuinely helps. Improve internal links. Keep what already works.";

export type EditInput = {
    slug: string;
    /** What to change. Empty means the full refresh. */
    instructions: string;
    /** Search the web for new and corrected facts (slower, costs more). */
    research: boolean;
    /** How hard research digs when research is on (default light). */
    depth?: ResearchDepth;
    /** Apply live when every check passes; otherwise store as a proposal. */
    publish: boolean;
    dryRun?: boolean;
};

export type EditResult = {
    slug: string;
    path: string;
    title: string;
    applied: boolean;
    /** Revision file to undo (when applied) or to apply (when proposed). */
    revisionPath: string | null;
    changeSummary: string[];
    wordCount: number;
    editorScore: number | null;
    newImages: number;
    problems: string[];
    warnings: string[];
    cost: CostReport;
    post?: BlogPost;
};

function looksLikePost(value: unknown): value is BlogPost {
    const post = value as Partial<BlogPost> | null;
    return Boolean(post && typeof post.slug === "string" && typeof post.title === "string" && Array.isArray(post.sections) && post.featuredImage?.src);
}

export type EditablePostSummary = {slug: string; title: string; source: "code" | "studio" | "code+studio"; published: boolean; updatedAt: string};

/** Every post an editor can pick: code posts, Content Studio posts, and code posts with a Studio override. */
export async function listEditablePosts(): Promise<EditablePostSummary[]> {
    const posts = new Map<string, EditablePostSummary>(blogPosts.map((post) => [post.slug, {slug: post.slug, title: post.title, source: "code", published: true, updatedAt: post.updatedAt ?? post.publishedAt}]));
    for (const entry of await listContentEntries("blog").catch(() => [])) {
        if (!looksLikePost(entry.payload)) continue;
        const existing = posts.get(entry.slug);
        posts.set(entry.slug, {
            slug: entry.slug,
            title: entry.is_published ? entry.payload.title : existing?.title ?? entry.payload.title,
            source: existing ? "code+studio" : "studio",
            published: existing ? true : entry.is_published,
            updatedAt: entry.updated_at.slice(0, 10)
        });
    }
    return Array.from(posts.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** The version readers currently see, and the Studio row behind it if any. */
async function loadLivePost(slug: string) {
    const entry = await getContentEntry("blog", slug);
    const compiled = blogPosts.find((post) => post.slug === slug) ?? null;
    if (entry?.is_published && looksLikePost(entry.payload)) return {post: entry.payload, entry};
    if (compiled) return {post: compiled, entry};
    if (entry && looksLikePost(entry.payload)) return {post: entry.payload, entry};
    throw new Error(`No blog post with the slug "${slug}"`);
}

function articleText(post: BlogPost) {
    return [
        post.title,
        post.description,
        ...post.sections.flatMap((section) => [section.title, ...section.paragraphs, ...(section.cards ?? []).map((card) => `${card.label}: ${card.body}`)]),
        ...(post.faq ?? []).flatMap((item) => [item.question, item.answer]),
        ...(post.sources ?? []).map((source) => `Source: ${source.label} ${source.href}`)
    ].join("\n");
}

export async function editArticle(input: EditInput, log: (line: string) => void): Promise<EditResult> {
    const meter = new CostMeter();
    const result = await withCostMeter(meter, () => editMetered(input, log));
    const cost = meter.report();
    log(`Cost: ${formatCost(cost)}`);
    return {...result, cost};
}

async function editMetered(input: EditInput, log: (line: string) => void): Promise<Omit<EditResult, "cost">> {
    const catalog = await loadSiteCatalog();
    const {post: live, entry} = await loadLivePost(input.slug);
    const editable = toEditable(live);
    const instructions = input.instructions.trim() || REFRESH_INSTRUCTIONS;
    const fullRefresh = !input.instructions.trim();
    log(`Editing "${live.title}" (${entry ? "Content Studio" : "code"} version)`);

    const brief: Brief = {mode: "custom", title: live.title, angle: instructions, notes: `This is an edit of the live article at /blog/${live.slug}.`};
    let research: Research;
    if (input.research) {
        // The live text goes in as material, so research also checks its claims.
        research = await researchBrief(brief, catalog, log, {
            blocks: [{type: "document", title: "live-article.txt", source: {type: "text", media_type: "text/plain", data: articleText(live)}}],
            names: ["live-article.txt"]
        }, input.depth);
        log(`Research done: ${research.urls.size} source URL(s) seen, ${research.siteHits.size} AnimalDex page(s) found`);
    } else {
        // No new research: the article's own sources and links are the evidence.
        const siteHits = new Map<string, CatalogItem>();
        const linked = new Set(editable.wire.sections.flatMap((section) => section.links.map((link) => link.href)));
        for (const item of catalog.items) if (linked.has(item.href)) siteHits.set(item.href, item);
        for (const slug of live.speciesSlugs) for (const hit of searchCatalog(catalog, slug.replace(/-/g, " "), ["species", "comparison", "ranking"], 4)) siteHits.set(hit.href, hit);
        research = {
            dossier: "No new research for this edit. Use only facts already in the live article; you may restructure, rewrite, tighten and cut, but add no new factual claims.",
            urls: new Set(editable.sourceUrls),
            siteHits
        };
    }
    editable.sourceUrls.forEach((url) => research.urls.add(url));

    const edit = {kind: "edit" as const, live: editable.wire, instructions};
    const {spec, review} = fullRefresh
        ? await writeAndEdit(brief, research, log, edit)
        : {spec: await writeArticle(brief, research, log, edit), review: null};
    spec.slug = live.slug;
    log(`Edit written: "${spec.title}"`);
    spec.changeSummary.forEach((line) => log(`Change: ${line}`));

    const imageRequests: ImageRequest[] = [
        ...(isNewImageSlot(spec.heroImage) ? [{key: "hero", ...spec.heroImage}] : []),
        ...spec.sections.flatMap((section, index) => (isNewImageSlot(section.image) ? [{key: sectionImageKey(index), ...section.image}] : []))
    ];
    if (imageRequests.length) log(`Finding ${imageRequests.length} new photo(s)`);
    const images = imageRequests.length ? await sourceArticleImages(live.slug, imageRequests, log) : new Map();

    const sourceUrls = Array.from(new Set(spec.sources.map((source) => normalizeUrl(source.url)).filter(Boolean)));
    const reachableUrls = await checkReachable(sourceUrls);
    log(`${reachableUrls.size}/${sourceUrls.length} source link(s) load`);

    const assembled = assembleBlogPost(spec, {
        slug: live.slug,
        images,
        keptMedia: editable.keptMedia,
        knownHrefs: catalog.hrefs,
        knownSpecies: catalog.speciesSlugs,
        researchedUrls: research.urls,
        reachableUrls,
        // Older posts may never have listed sources; an edit shouldn't be blocked for that alone.
        minSources: editable.sourceUrls.length >= 2 ? 2 : 0,
        publishedAt: live.publishedAt,
        author: live.author,
        today: new Date().toISOString().slice(0, 10)
    });
    assembled.warnings.forEach((warning) => log(`Note: ${warning}`));
    assembled.problems.forEach((problem) => log(`Blocked: ${problem}`));

    const apply = input.publish && assembled.problems.length === 0;
    let revisionPath: string | null = null;
    const savedAt = new Date().toISOString();
    if (input.dryRun) {
        log("Dry run: nothing saved");
    } else if (apply) {
        revisionPath = await saveRevision({slug: live.slug, kind: "backup", savedAt, payload: entry ? entry.payload as BlogPost : null, wasPublished: entry?.is_published ?? false, title: live.title});
        await saveContentEntry("blog", live.slug, assembled.post, true);
        log(`Live at /blog/${live.slug}. The previous version is backed up and can be restored.`);
    } else {
        revisionPath = await saveRevision({slug: live.slug, kind: "proposed", savedAt, payload: assembled.post, title: assembled.post.title, changeSummary: spec.changeSummary});
        log(input.publish ? "Not applied because of the problems above; saved as a proposal" : "Saved as a proposal; the live post is unchanged");
    }

    return {
        slug: live.slug,
        path: `/blog/${live.slug}`,
        title: assembled.post.title,
        applied: apply && !input.dryRun,
        revisionPath,
        changeSummary: spec.changeSummary,
        wordCount: assembled.wordCount,
        editorScore: review?.score ?? null,
        newImages: images.size,
        problems: assembled.problems,
        warnings: assembled.warnings,
        ...(input.dryRun ? {post: assembled.post} : {})
    };
}
