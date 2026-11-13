import "server-only";
import {runWithAiFeature} from "@/lib/ai-usage-context";
import {listAutomationRuns, recordAutomationRun} from "@/lib/automation-runs";
import {loadOpportunityQueries} from "@/app/api/admin/growth/_lib/search-console";
import {type BlogLane, blogLaneOrder, pickAutoFocus, SEARCH_CONSOLE_LANE, utcDayNumber} from "@/lib/blog-generator/auto-generate-plan";
import {isClaudeConfigured} from "@/lib/blog-generator/claude-client";
import {formatCost} from "@/lib/blog-generator/cost-meter";
import {guideMaterials, nextGuideTopic} from "@/lib/blog-generator/guide-topics";
import {generateJobRunning, startGenerateJob, type GenerateInput, type Job} from "@/lib/blog-generator/jobs";
import {pickSearchConsoleTopic, searchConsoleFocus, searchConsoleTopicId} from "@/lib/blog-generator/search-console-topics";
import {nextLessonTopic, nextSeoTopic} from "@/lib/blog-generator/seo-topics";
import {topicPolicyProblems} from "@/lib/blog-generator/topic-policy";
import {listTrendTopics, openTrendTopics, type TrendTopicRow, updateTrendTopic} from "@/lib/trend-radar/store";

// Unattended articles (POST /api/cron/blog-auto-generate, 07:40 and 19:40 UTC),
// published as "Auto-pick and write" in /admin/blog-generator would. One a day
// (BLOG_AUTO_PER_DAY, default 1): the 19:40 slot only writes when the morning
// one did not start an article (16 Nov 2026: the second daily run stays off).
// Since Nov 2026 there is no news lane: the blog writes ideas seen through
// animals and "lesson for a human" pieces (topic-policy.ts). Search Console
// goes first every day (blogLaneOrder): a query people already type and find
// us for, answered as a problem-led page (search-console-topics.ts). Then one
// rotating lane leads and the others are fallbacks (blogLanesFor):
// - radar: the trend radar's best evergreen idea (a culture or everyday-life
//   trend an animal's take reframes) that passes the topic policy;
// - lessons: the next lesson-for-a-human topic (seo-topics.ts LESSON_TOPICS);
// - search: the next problem-led search page (SEO_TOPICS), then a product
//   guide (guide-topics.ts);
// and when every lane is empty, Claude picks an idea for a random focus.
// Caps: BLOG_AUTO_PER_DAY and BLOG_AUTO_DAILY_BUDGET_USD (default $6). The
// editor's draft rule still applies (below 6/10 → draft). A generation takes
// 10–20 minutes; the run returns once it has started and logs a second row
// when it finishes.

export const BLOG_AUTO_JOB = "blog-auto-generate";

/** The radar lane takes an evergreen idea scoring at least this. */
export const RADAR_MIN_SCORE = 7;

export type BlogAutoGenerateResult = {ok: true; acted: boolean; summary: string; ref?: string; detail?: Record<string, unknown>};

type Meta = {seoTopic?: string; lessonTopic?: string; guideTopic?: string; trendTopic?: string; gscQuery?: string};

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
async function writtenTopics(key: "seoTopic" | "lessonTopic" | "guideTopic" | "gscQuery") {
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
    const perDay = numberEnv("BLOG_AUTO_PER_DAY", 1);
    const budget = numberEnv("BLOG_AUTO_DAILY_BUDGET_USD", 6);
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

/**
 * The best open evergreen radar idea that passes the topic policy. Ideas that
 * break it are marked skipped with the reason, so they stop coming back.
 */
async function bestRadarTopic(minScore: number) {
    const open = await openTrendTopics().catch((): TrendTopicRow[] => []);
    for (const topic of open.filter((entry) => entry.kind === "evergreen" && entry.score >= minScore)) {
        const problems = topicPolicyProblems(topic.idea);
        if (!problems.length) return topic;
        await updateTrendTopic(topic.id, {status: "skipped", used_ref: `topic policy: ${problems.join("; ")}`.slice(0, 300)}).catch(() => undefined);
    }
    return null;
}

async function writeFromRadar(): Promise<BlogAutoGenerateResult | null> {
    const topic = await bestRadarTopic(RADAR_MIN_SCORE);
    return topic ? writeTrendTopic(topic, "a radar idea") : null;
}

async function writeLesson(): Promise<BlogAutoGenerateResult | null> {
    const lesson = nextLessonTopic(await writtenTopics("lessonTopic"));
    if (!lesson) return null;
    return start({mode: "catalog", idea: lesson.idea, publish: true, depth: "standard"}, `Writing a lesson piece: “${lesson.idea.title}” (${lesson.idea.primaryKeyword})`, `lesson: ${lesson.idea.primaryKeyword}`, {lessonTopic: lesson.id});
}

async function writeSearchLed(): Promise<BlogAutoGenerateResult | null> {
    if (process.env.BLOG_AUTO_SEO_TOPICS_DISABLED?.trim() !== "1") {
        const seo = nextSeoTopic(await writtenTopics("seoTopic"));
        if (seo) return start({mode: "catalog", idea: seo.idea, publish: true, depth: "standard"}, `Writing a search-led article: “${seo.idea.title}” (${seo.idea.primaryKeyword})`, `seo: ${seo.idea.primaryKeyword}`, {seoTopic: seo.id});
    }
    const guide = nextGuideTopic(await writtenTopics("guideTopic"));
    if (!guide) return null;
    return start(
        {mode: "catalog", idea: guide.idea, publish: true, depth: "standard", materialFiles: guideMaterials(guide)},
        `Writing a product guide: “${guide.idea.title}” (${guide.idea.primaryKeyword})`,
        `guide: ${guide.idea.primaryKeyword}`,
        {guideTopic: guide.id}
    );
}

/** The Search Console lane: the best query with measured demand that no post answers yet, as the focus Claude writes the topic for. */
async function writeFromSearchConsole(): Promise<BlogAutoGenerateResult | null> {
    if (process.env.BLOG_AUTO_SEARCH_CONSOLE_DISABLED?.trim() === "1") return null;
    const queries = await loadOpportunityQueries().catch((error) => {
        console.warn("[blog-auto-generate] Search Console unavailable", error instanceof Error ? error.message : error);
        return [];
    });
    const pick = pickSearchConsoleTopic(queries, await writtenTopics("gscQuery"));
    if (!pick) return null;
    return start(
        {mode: "catalog", focus: searchConsoleFocus(pick), publish: true, depth: "standard"},
        `Writing a search page for “${pick.query}” (${pick.impressions} impressions, position ${pick.position} in Search Console)`,
        `search console: ${pick.query}`,
        {gscQuery: searchConsoleTopicId(pick.query)}
    );
}

const LANES: Record<BlogLane | typeof SEARCH_CONSOLE_LANE, () => Promise<BlogAutoGenerateResult | null>> = {[SEARCH_CONSOLE_LANE]: writeFromSearchConsole, radar: writeFromRadar, lessons: writeLesson, search: writeSearchLed};

/** Every lane empty: Claude picks the strongest idea for a random focus (an everyday idea through an animal). */
async function writeFromFocus(): Promise<BlogAutoGenerateResult> {
    const focus = pickAutoFocus(await recentFocuses());
    return start({mode: "catalog", focus, publish: true, depth: "standard"}, `Writing an idea piece, focus: ${focus}`, focus);
}

async function run(): Promise<BlogAutoGenerateResult> {
    const blocked = await capsProblem();
    if (blocked) return {ok: true, acted: false, summary: blocked};
    for (const lane of blogLaneOrder(utcDayNumber())) {
        const result = await LANES[lane]();
        if (result) return result;
    }
    return writeFromFocus();
}

/** One run, logged to admin_automation_runs whatever happens. */
export async function runBlogAutoGenerate(): Promise<BlogAutoGenerateResult> {
    try {
        const result = await runWithAiFeature("blog-generator/auto-generate", run);
        await recordAutomationRun({job: BLOG_AUTO_JOB, outcome: result.acted ? "acted" : "skipped", summary: result.summary, ref: result.ref, detail: result.detail});
        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await recordAutomationRun({job: BLOG_AUTO_JOB, outcome: "failed", summary: message});
        throw error;
    }
}

/** "Write now" on a radar topic in /admin/story-videos: starts it at once (no daily caps; one article at a time). A person chose it, so the policy check is theirs. */
export async function writeTrendTopicNow(id: string): Promise<BlogAutoGenerateResult> {
    if (!isClaudeConfigured()) throw new Error("CLAUDE_API_KEY is not set on the server");
    if (generateJobRunning()) throw new Error("An article is already being written; try again when it finishes");
    const topic = (await listTrendTopics(300)).find((row) => row.id === id);
    if (!topic || topic.status !== "new") throw new Error("That topic is no longer open");
    const result = await writeTrendTopic(topic, "a radar topic (from the admin panel)");
    await recordAutomationRun({job: BLOG_AUTO_JOB, outcome: "acted", summary: result.summary, ref: result.ref, detail: result.detail});
    return result;
}
