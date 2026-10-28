import "server-only";
import {listAutomationRuns, recordAutomationRun} from "@/lib/automation-runs";
import {pickAutoFocus} from "@/lib/blog-generator/auto-generate-plan";
import {isClaudeConfigured} from "@/lib/blog-generator/claude-client";
import {formatCost} from "@/lib/blog-generator/cost-meter";
import {generateJobRunning, startGenerateJob, type Job} from "@/lib/blog-generator/jobs";
import {nextSeoTopic, type SeoTopic} from "@/lib/blog-generator/seo-topics";

// Unattended news articles, run twice a day by the VM timer (POST /api/cron/blog-auto-generate):
// each run is exactly "Latest news" → "Auto-pick and write" in
// /admin/blog-generator, with a random Focus, standard research depth, and
// publishing on. The editor's draft rule still applies: a post scoring below
// 6/10 is saved as a draft instead of going live. A generation takes 10-20
// minutes, so the run returns once it has started and logs a second row when
// it finishes.

export const BLOG_AUTO_JOB = "blog-auto-generate";

export type BlogAutoGenerateResult = {ok: true; acted: boolean; summary: string; ref?: string; detail?: Record<string, unknown>};

/** Focuses of recent runs, newest first (a run's start and finish rows both carry it). */
async function recentFocuses() {
    const runs = await listAutomationRuns(BLOG_AUTO_JOB, 20).catch(() => []);
    return Array.from(new Set(runs.map((run) => run.detail?.focus).filter((focus): focus is string => typeof focus === "string")));
}

async function recordFinished(job: Job, focus: string, seoTopic?: string) {
    const result = job.result;
    if (job.status === "done" && result) {
        await recordAutomationRun({
            job: BLOG_AUTO_JOB,
            outcome: "acted",
            summary: result.published
                ? `Published “${result.title}” (${result.path}), editor ${result.editorScore ?? "?"}/10, ${formatCost(result.cost)}`
                : `Saved “${result.title}” as a draft (editor ${result.editorScore ?? "?"}/10 is below the bar), ${formatCost(result.cost)}`,
            ref: result.path,
            detail: {focus, jobId: job.id, published: result.published, editorScore: result.editorScore, wordCount: result.wordCount, usd: result.cost.totalUsd, ...(seoTopic ? {seoTopic} : {})}
        });
        return;
    }
    await recordAutomationRun({
        job: BLOG_AUTO_JOB,
        outcome: "failed",
        summary: `Article on “${focus}” failed: ${job.error ?? "unknown error"}`,
        ref: job.id,
        detail: {focus, jobId: job.id, lastLog: job.log.slice(-5), ...(seoTopic ? {seoTopic} : {})}
    });
}

/** Search-led topics already written (published, or saved as a draft); a failed one is tried again. */
async function writtenSeoTopics() {
    const runs = await listAutomationRuns(BLOG_AUTO_JOB, 200).catch(() => []);
    return new Set(runs
        .filter((run) => typeof run.detail?.seoTopic === "string" && (run.summary.startsWith("Published") || run.summary.startsWith("Saved")))
        .map((run) => run.detail!.seoTopic as string));
}

function numberEnv(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Articles started today (UTC) and what today's finished ones cost, from the run log. */
async function todaysRuns() {
    const runs = await listAutomationRuns(BLOG_AUTO_JOB, 30).catch(() => []);
    const today = new Date().toISOString().slice(0, 10);
    const mine = runs.filter((run) => run.created_at.slice(0, 10) === today && run.outcome === "acted");
    return {
        started: mine.filter((run) => run.summary.startsWith("Writing")).length,
        usd: mine.reduce((sum, run) => sum + (typeof run.detail?.usd === "number" ? run.detail.usd : 0), 0)
    };
}

async function run(): Promise<BlogAutoGenerateResult> {
    if (process.env.BLOG_AUTO_GENERATE_DISABLED?.trim() === "1") return {ok: true, acted: false, summary: "BLOG_AUTO_GENERATE_DISABLED=1"};
    if (!isClaudeConfigured()) return {ok: true, acted: false, summary: "CLAUDE_API_KEY is not set on the server"};
    if (generateJobRunning()) return {ok: true, acted: false, summary: "An article is already being written"};
    // Twice a day by default (the timer fires at 07:40 and 19:40 UTC); the caps hold even if it fires more.
    const perDay = numberEnv("BLOG_AUTO_PER_DAY", 2);
    const budget = numberEnv("BLOG_AUTO_DAILY_BUDGET_USD", 8);
    const today = await todaysRuns();
    if (today.started >= perDay) return {ok: true, acted: false, summary: `Already started ${today.started} of ${perDay} articles today (BLOG_AUTO_PER_DAY)`};
    if (today.usd >= budget) return {ok: true, acted: false, summary: `Today's articles cost $${today.usd.toFixed(2)} of the $${budget} budget (BLOG_AUTO_DAILY_BUDGET_USD)`};

    // The day's second article is search-led (seo-topics.ts) while topics remain; the first stays on news.
    const seo: SeoTopic | null = today.started % 2 === 1 && process.env.BLOG_AUTO_SEO_TOPICS_DISABLED?.trim() !== "1"
        ? nextSeoTopic(await writtenSeoTopics())
        : null;
    if (seo) {
        const job = startGenerateJob({mode: "catalog", idea: seo.idea, publish: true, depth: "standard"}, (finished) => recordFinished(finished, `seo: ${seo.idea.primaryKeyword}`, seo.id));
        return {ok: true, acted: true, summary: `Writing a search-led article: “${seo.idea.title}” (${seo.idea.primaryKeyword})`, ref: job.id, detail: {focus: `seo: ${seo.idea.primaryKeyword}`, seoTopic: seo.id, jobId: job.id}};
    }

    const focus = pickAutoFocus(await recentFocuses());
    const job = startGenerateJob({mode: "news", focus, publish: true, depth: "standard"}, (finished) => recordFinished(finished, focus));
    return {ok: true, acted: true, summary: `Writing a news article, focus: ${focus}`, ref: job.id, detail: {focus, jobId: job.id}};
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
