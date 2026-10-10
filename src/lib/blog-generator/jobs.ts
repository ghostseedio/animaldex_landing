import "server-only";
import {randomUUID} from "crypto";
import type {BlogPost} from "@/data/blog/types";
import {saveContentEntry} from "@/lib/admin-content";
import {assembleBlogPost, isNewImageSlot, normalizeUrl, sectionImageKey, uniqueSlug} from "@/lib/blog-generator/article-spec";
import {editArticle, type EditInput, type EditResult} from "@/lib/blog-generator/edit";
import {loadSiteCatalog} from "@/lib/blog-generator/catalog";
import {CostMeter, formatCost, withCostMeter, type CostReport} from "@/lib/blog-generator/cost-meter";
import {sourceArticleImages, type ImageRequest} from "@/lib/blog-generator/images";
import {deleteMaterials, loadMaterials, type MaterialFile, type MaterialRef} from "@/lib/blog-generator/materials";
import {checkReachable, researchBrief, suggestTopics, writeAndEdit, type Brief, type GeneratorMode, type Research, type ResearchDepth, type TopicIdea} from "@/lib/blog-generator/pipeline";

// A generation takes several minutes, longer than a proxy will hold a request
// open, so it runs in the background and the admin page polls. Jobs live in
// this process only: the VM runs one container, and a restart mid-run just
// means starting again. The finished post itself is saved to the database.

export type GenerateInput = {
    mode: GeneratorMode;
    /** custom: the topic. news/catalog: an optional focus for auto-picking. */
    focus?: string;
    /** A topic chosen from suggestTopics; without it news/catalog auto-pick the first idea. */
    idea?: TopicIdea;
    publish: boolean;
    /** How hard research digs (default light). */
    depth?: ResearchDepth;
    /** Run everything except the save; the post comes back in the result. */
    dryRun?: boolean;
    /** Reference files uploaded to storage (custom articles). */
    materials?: MaterialRef[];
    /** Reference files already in memory (the dry-run script). */
    materialFiles?: MaterialFile[];
    /** Reuse an earlier brief and research (the dry-run script caches them). */
    prepared?: {brief: Brief; research: Research};
    onResearched?: (brief: Brief, research: Research) => void | Promise<void>;
};

export type GenerateResult = {
    slug: string;
    path: string;
    title: string;
    published: boolean;
    wordCount: number;
    images: number;
    embeds: string[];
    editorScore: number | null;
    cost: CostReport;
    problems: string[];
    warnings: string[];
    post?: BlogPost;
};

export type Job = {
    id: string;
    kind: "topics" | "generate" | "edit";
    status: "running" | "done" | "failed";
    startedAt: string;
    finishedAt?: string;
    log: string[];
    error?: string;
    topics?: TopicIdea[];
    result?: GenerateResult;
    editResult?: EditResult;
    cost?: CostReport;
};

const MAX_JOBS = 30;
const MIN_EDITOR_SCORE = 6;
const store = (globalThis as typeof globalThis & {__animaldexBlogJobs?: Map<string, Job>}).__animaldexBlogJobs ??= new Map<string, Job>();

function createJob(kind: Job["kind"]): Job {
    const job: Job = {id: randomUUID(), kind, status: "running", startedAt: new Date().toISOString(), log: []};
    store.set(job.id, job);
    while (store.size > MAX_JOBS) store.delete(store.keys().next().value as string);
    return job;
}

function logger(job: Job) {
    return (line: string) => {
        job.log.push(`${new Date().toISOString().slice(11, 19)} ${line}`);
        console.info(`[blog-generator ${job.id.slice(0, 8)}] ${line}`);
    };
}

function run(job: Job, work: (log: (line: string) => void) => Promise<void>) {
    const log = logger(job);
    const meter = new CostMeter();
    withCostMeter(meter, () => work(log))
        .then(() => {
            job.status = "done";
        })
        .catch((error) => {
            job.status = "failed";
            job.error = error instanceof Error ? error.message : String(error);
            log(`Failed: ${job.error}`);
        })
        .finally(() => {
            // A generation meters itself (generateArticle) and reports in its result.
            if (job.kind === "topics") {
                job.cost = meter.report();
                log(`Cost: ${formatCost(job.cost)}`);
            }
            job.finishedAt = new Date().toISOString();
        });
}

export function getJob(id: string) {
    return store.get(id) ?? null;
}

export function listJobs() {
    return Array.from(store.values()).reverse();
}

export function startTopicsJob(mode: Exclude<GeneratorMode, "custom">, focus: string) {
    const job = createJob("topics");
    run(job, async (log) => {
        log(mode === "news" ? "Scanning recent wildlife news" : "Looking for gaps around our catalog");
        const catalog = await loadSiteCatalog();
        job.topics = await suggestTopics(mode, focus, catalog, log);
        log(`${job.topics.length} topic idea(s) ready`);
    });
    return job;
}

export function startGenerateJob(input: GenerateInput) {
    const job = createJob("generate");
    run(job, async (log) => {
        try {
            job.result = await generateArticle(input, log);
        } finally {
            // Uploaded references are only needed for this run.
            await deleteMaterials(input.materials ?? []);
        }
    });
    return job;
}

async function prepare(input: GenerateInput, catalog: Awaited<ReturnType<typeof loadSiteCatalog>>, log: (line: string) => void): Promise<{brief: Brief; research: Research}> {
    let brief: Brief;
    const hasMaterials = Boolean(input.materials?.length || input.materialFiles?.length);
    if (input.mode === "custom") {
        const topic = input.focus?.trim();
        if (!topic && !hasMaterials) throw new Error("A custom article needs a topic or reference material");
        brief = topic
            ? {mode: "custom", title: topic, angle: topic, notes: topic}
            : {mode: "custom", title: "An article built on the attached material", angle: "Find the most surprising, searchable story in the attached material and build the article around it."};
    } else {
        let idea = input.idea;
        if (!idea) {
            log("No topic chosen, picking the strongest idea");
            idea = (await suggestTopics(input.mode, input.focus ?? "", catalog, log))[0];
            if (!idea) throw new Error("No topic ideas came back");
        }
        brief = {mode: input.mode, title: idea.title, angle: `${idea.angle} Hook: ${idea.hook}${idea.shareLine ? ` Share line: ${idea.shareLine}` : ""}`, primaryKeyword: idea.primaryKeyword, sources: idea.sources, notes: input.focus};
    }
    log(`Topic: ${brief.title}`);

    let materials: Awaited<ReturnType<typeof loadMaterials>> | undefined;
    if (hasMaterials) {
        materials = await loadMaterials(input.materials ?? [], input.materialFiles ?? []);
        log(`Read ${materials.names.length} reference file(s): ${materials.names.join(", ")}`);
    }
    const research = await researchBrief(brief, catalog, log, materials, input.depth);
    log(`Research done: ${research.urls.size} source URL(s) seen, ${research.siteHits.size} AnimalDex page(s) found`);

    return {brief, research};
}

export function startEditJob(input: EditInput) {
    const job = createJob("edit");
    run(job, async (log) => {
        job.editResult = await editArticle(input, log);
    });
    return job;
}

/** The whole pipeline. Also callable directly (e.g. a future scheduled run). */
export async function generateArticle(input: GenerateInput, log: (line: string) => void): Promise<GenerateResult> {
    const meter = new CostMeter();
    const result = await withCostMeter(meter, () => generateMetered(input, log));
    const cost = meter.report();
    log(`Cost: ${formatCost(cost)}`);
    return {...result, cost};
}

async function generateMetered(input: GenerateInput, log: (line: string) => void): Promise<Omit<GenerateResult, "cost">> {
    const catalog = await loadSiteCatalog();

    const {brief, research} = input.prepared ?? await prepare(input, catalog, log);
    if (!input.prepared) await input.onResearched?.(brief, research);

    const {spec, review} = await writeAndEdit(brief, research, log);
    const slug = uniqueSlug(spec.slug || spec.title, catalog.blogSlugs);
    log(`Draft written: "${spec.title}" → /blog/${slug}`);

    const imageRequests: ImageRequest[] = [
        {key: "hero", ...spec.heroImage},
        ...spec.sections.flatMap((section, index) => (isNewImageSlot(section.image) ? [{key: sectionImageKey(index), ...section.image}] : []))
    ];
    log(`Finding ${imageRequests.length} photo(s)`);
    const images = await sourceArticleImages(slug, imageRequests, log);
    log(`${images.size} photo(s) passed the check`);

    const sourceUrls = Array.from(new Set(spec.sources.map((source) => normalizeUrl(source.url)).filter(Boolean)));
    const reachableUrls = await checkReachable(sourceUrls);
    log(`${reachableUrls.size}/${sourceUrls.length} source link(s) load`);

    const assembled = assembleBlogPost(spec, {
        slug,
        images,
        knownHrefs: catalog.hrefs,
        knownSpecies: catalog.speciesSlugs,
        researchedUrls: research.urls,
        reachableUrls,
        minSources: input.materials?.length || input.materialFiles?.length ? 1 : 2,
        today: new Date().toISOString().slice(0, 10)
    });
    // Even after a rewrite, a forgettable article is held back rather than published.
    if (review && review.score < MIN_EDITOR_SCORE) assembled.problems.push(`editor scored it ${review.score}/10 for shareability (needs ${MIN_EDITOR_SCORE}): ${review.verdict}`);
    assembled.warnings.forEach((warning) => log(`Note: ${warning}`));
    assembled.problems.forEach((problem) => log(`Blocked: ${problem}`));

    const publish = input.publish && assembled.problems.length === 0;
    if (input.publish && !publish) log("Saved as a draft instead of publishing because of the problems above");
    if (input.dryRun) log("Dry run: nothing saved");
    else {
        await saveContentEntry("blog", slug, assembled.post, publish);
        log(publish ? `Published at /blog/${slug}` : `Saved draft /blog/${slug}`);
    }

    return {
        slug,
        path: `/blog/${slug}`,
        title: assembled.post.title,
        published: publish && !input.dryRun,
        wordCount: assembled.wordCount,
        images: images.size,
        editorScore: review?.score ?? null,
        embeds: assembled.post.sections.flatMap((section) => (section.html !== undefined ? [section.title.split(":")[0]] : [])),
        problems: assembled.problems,
        warnings: assembled.warnings,
        ...(input.dryRun ? {post: assembled.post} : {})
    };
}
