import "server-only";
import {listAutomationRuns, recordAutomationRun} from "@/lib/automation-runs";
import {pickAutoFocus} from "@/lib/blog-generator/auto-generate-plan";
import {isClaudeConfigured} from "@/lib/blog-generator/claude-client";
import {formatCost} from "@/lib/blog-generator/cost-meter";
import {guideMaterials, nextGuideTopic} from "@/lib/blog-generator/guide-topics";
import {generateJobRunning, startGenerateJob, type GenerateInput, type Job} from "@/lib/blog-generator/jobs";
import {nextSeoTopic} from "@/lib/blog-generator/seo-topics";
import {listTrendTopics, openTrendTopics, type TrendTopicRow, updateTrendTopic} from "@/lib/trend-radar/store";

// Unattended articles (POST /api/cron/blog-auto-generate, 07:40 and 19:40 UTC),
// published as "Auto-pick and write" in /admin/blog-generator would:
// - the morning run writes the news: the trend radar's best fresh story
//   (src/lib/trend-radar), else a story Claude finds for a random focus;
// - the evening run is search-led: a talk-to-animals topic (seo-topics.ts) and
//   a product guide (guide-topics.ts) on alternate days, else the radar's best
//   evergreen question;
// - between them, a radar story hot enough to be breaking news is written at
//   once (runBreakingNews, from the video timer every 3 hours).
// Caps: BLOG_AUTO_PER_DAY articles (default 4) and BLOG_AUTO_DAILY_BUDGET_USD
// (default $12). The editor's draft rule still applies (below 6/10 → draft). A
// generation takes 10–20 minutes; the run returns once it has started and logs
// a second row when it finishes.

export const BLOG_AUTO_JOB = "blog-auto-generate";

/** A radar news story this hot is written as soon as the timer sees it. */
export const BREAKING_SCORE = 8.5;
/** The morning run takes a radar story at or above this; below it, Claude searches a random focus. */
const NEWS_MIN_SCORE = 6;
const EVERGREEN_MIN_SCORE = 7;

export type BlogAutoGenerateResult = {ok: true; acted: boolean; summary: string; ref?: string; detail?: Record<string, unknown>};

type Meta = {seoTopic?: string; guideTopic?: string; trendTopic?: string};

/** Focuses of recent runs, newest first (a run's start and finish rows both carry it). */
async function recentFocuses() {
    const runs = await listAutomationRuns(BLOG_AUTO_JOB, 20).catch(() => []);
    return Array.from(new Set(runs.map((run) => run.detail?.focus).filter((focus): focus is string => typeof focus === "string")));
}

async function recordFinished(job: Job, focus: string, meta: Meta = {}) {
    const result = job.result;
    if (job.status === "done" && result) {
        if (meta.trendTopic) await updateTrendTopic(meta.trendTopic, {status: "used", used_ref: result.path}).catch(() => undefined);
        await recordAutomationRun({
            job: BLOG_AUTO_JOB,
            outcome: "acted",
            summary: result.published
                ? `Published “${result.title}” (${result.path}), editor ${result.editorScore ?? "?"}/10, ${formatCost(result.cost)}`
                : `Saved “${result.title}” as a draft (editor ${result.editorScore ?? "?"}/10 is below the bar), ${formatCost(result.cost)}`,
            ref: result.path,
            detail: {focus, jobId: job.id, published: result.published, editorScore: result.editorScore, wordCount: result.wordCount, usd: result.cost.totalUsd, ...meta}
        });
        return;
    }
    // A radar idea that failed is not retried: the next pass finds fresher ones.
    if (meta.trendTopic) await updateTrendTopic(meta.trendTopic, {status: "skipped", used_ref: `failed: ${(job.error ?? "unknown").slice(0, 200)}`}).catch(() => undefined);
    await recordAutomationRun({
        job: BLOG_AUTO_JOB,
        outcome: "failed",
        summary: `Article on “${focus}” failed: ${job.error ?? "unknown error"}`,
        ref: job.id,
        detail: {focus, jobId: job.id, lastLog: job.log.slice(-5), ...meta}
    });
}

/** Queue topics already written (published, or saved as a draft); a failed one is tried again. */
async function writtenTopics(key: "seoTopic" | "guideTopic") {
    const runs = await listAutomationRuns(BLOG_AUTO_JOB, 300).catch(() => []);
    return new Set(runs
        .filter((run) => typeof run.detail?.[key] === "string" && (run.summary.startsWith("Published") || run.summary.startsWith("Saved")))
        .map((run) => run.detail![key] as string));
}

function numberEnv(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Articles started today (UTC) and what today's finished ones cost, from the run log. */
async function todaysRuns() {
    const runs = await listAutomationRuns(BLOG_AUTO_JOB, 40).catch(() => []);
    const today = new Date().toISOString().slice(0, 10);
    const mine = runs.filter((run) => run.created_at.slice(0, 10) === today && run.outcome === "acted");
    return {
        started: mine.filter((run) => run.summary.startsWith("Writing")).length,
        usd: mine.reduce((sum, run) => sum + (typeof run.detail?.usd === "number" ? run.detail.usd : 0), 0)
    };
}

/** Null when an article may start now, else why not. */
async function capsProblem(): Promise<string | null> {
    if (process.env.BLOG_AUTO_GENERATE_DISABLED?.trim() === "1") return "BLOG_AUTO_GENERATE_DISABLED=1";
    if (!isClaudeConfigured()) return "CLAUDE_API_KEY is not set on the server";
    if (generateJobRunning()) return "An article is already being written";
    const perDay = numberEnv("BLOG_AUTO_PER_DAY", 4);
    const budget = numberEnv("BLOG_AUTO_DAILY_BUDGET_USD", 12);
    const today = await todaysRuns();
    if (today.started >= perDay) return `Already started ${today.started} of ${perDay} articles today (BLOG_AUTO_PER_DAY)`;
    if (today.usd >= budget) return `Today's articles cost $${today.usd.toFixed(2)} of the $${budget} budget (BLOG_AUTO_DAILY_BUDGET_USD)`;
    return null;
}

function start(input: GenerateInput, summary: string, focus: string, meta: Meta = {}): BlogAutoGenerateResult {
    const job = startGenerateJob(input, (finished) => recordFinished(finished, focus, meta));
    return {ok: true, acted: true, summary, ref: job.id, detail: {focus, jobId: job.id, ...meta}};
}

async function writeTrendTopic(topic: TrendTopicRow, label: string) {
    await updateTrendTopic(topic.id, {status: "writing"});
    return start(
        {mode: topic.kind === "news" ? "news" : "catalog", idea: topic.idea, publish: true, depth: "standard"},
        `Writing ${label}: “${topic.title}” (radar score ${topic.score})`,
        `radar: ${topic.primary_keyword}`,
        {trendTopic: topic.id}
    );
}

async function bestRadarTopic(kind: TrendTopicRow["kind"], minScore: number) {
    const open = await openTrendTopics().catch((): TrendTopicRow[] => []);
    return open.find((topic) => topic.kind === kind && topic.score >= minScore) ?? null;
}

async function writeNews(): Promise<BlogAutoGenerateResult> {
    const topic = await bestRadarTopic("news", NEWS_MIN_SCORE);
    if (topic) return writeTrendTopic(topic, "today's top news story");
    const focus = pickAutoFocus(await recentFocuses());
    return start({mode: "news", focus, publish: true, depth: "standard"}, `Writing a news article, focus: ${focus}`, focus);
}

async function writeSearchLed(): Promise<BlogAutoGenerateResult | null> {
    // Alternate the two queues by day; when one is done the other carries on.
    const guidesFirst = Math.floor(Date.now() / 86_400_000) % 2 === 1;
    const seoOn = process.env.BLOG_AUTO_SEO_TOPICS_DISABLED?.trim() !== "1";
    const tryGuide = async () => {
        const guide = nextGuideTopic(await writtenTopics("guideTopic"));
        if (!guide) return null;
        return start(
            {mode: "catalog", idea: guide.idea, publish: true, depth: "standard", materialFiles: guideMaterials(guide)},
            `Writing a product guide: “${guide.idea.title}” (${guide.idea.primaryKeyword})`,
            `guide: ${guide.idea.primaryKeyword}`,
            {guideTopic: guide.id}
        );
    };
    const trySeo = async () => {
        if (!seoOn) return null;
        const seo = nextSeoTopic(await writtenTopics("seoTopic"));
        if (!seo) return null;
        return start({mode: "catalog", idea: seo.idea, publish: true, depth: "standard"}, `Writing a search-led article: “${seo.idea.title}” (${seo.idea.primaryKeyword})`, `seo: ${seo.idea.primaryKeyword}`, {seoTopic: seo.id});
    };
    for (const attempt of guidesFirst ? [tryGuide, trySeo] : [trySeo, tryGuide]) {
        const result = await attempt();
        if (result) return result;
    }
    const evergreen = await bestRadarTopic("evergreen", EVERGREEN_MIN_SCORE);
    return evergreen ? writeTrendTopic(evergreen, "a search-led article from the radar") : null;
}

async function run(): Promise<BlogAutoGenerateResult> {
    const blocked = await capsProblem();
    if (blocked) return {ok: true, acted: false, summary: blocked};
    // The timer fires at 07:40 (news) and 19:40 UTC (search-led); "Run now" follows the clock too.
    if (new Date().getUTCHours() >= 12) {
        const searchLed = await writeSearchLed();
        if (searchLed) return searchLed;
    }
    return writeNews();
}

/** One run, logged to admin_automation_runs whatever happens. */
export async function runBlogAutoGenerate(): Promise<BlogAutoGenerateResult> {
    try {
        const result = await run();
        await recordAutomationRun({job: BLOG_AUTO_JOB, outcome: result.acted ? "acted" : "skipped", summary: result.summary, ref: result.ref, detail: result.detail});
        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await recordAutomationRun({job: BLOG_AUTO_JOB, outcome: "failed", summary: message});
        throw error;
    }
}

/**
 * Breaking news, between the scheduled runs: when the radar holds a news story
 * scoring BREAKING_SCORE or more and the caps allow, it is written now. Logged
 * only when it acts (the video timer calls it every 3 hours).
 */
export async function runBreakingNews(): Promise<BlogAutoGenerateResult | null> {
    if (process.env.BLOG_BREAKING_NEWS_DISABLED?.trim() === "1") return null;
    const topic = await bestRadarTopic("news", BREAKING_SCORE);
    if (!topic || await capsProblem()) return null;
    const result = await writeTrendTopic(topic, "breaking news");
    await recordAutomationRun({job: BLOG_AUTO_JOB, outcome: "acted", summary: result.summary, ref: result.ref, detail: result.detail});
    return result;
}

/** "Write now" on a radar topic in /admin/story-videos: starts it at once (no daily caps; one article at a time). */
export async function writeTrendTopicNow(id: string): Promise<BlogAutoGenerateResult> {
    if (!isClaudeConfigured()) throw new Error("CLAUDE_API_KEY is not set on the server");
    if (generateJobRunning()) throw new Error("An article is already being written; try again when it finishes");
    const topic = (await listTrendTopics(300)).find((row) => row.id === id);
    if (!topic || topic.status !== "new") throw new Error("That topic is no longer open");
    const result = await writeTrendTopic(topic, "a radar topic (from the admin panel)");
    await recordAutomationRun({job: BLOG_AUTO_JOB, outcome: "acted", summary: result.summary, ref: result.ref, detail: result.detail});
    return result;
}
