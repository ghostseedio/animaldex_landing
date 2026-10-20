import "server-only";
import {listAutomationRuns, recordAutomationRun} from "@/lib/automation-runs";
import {pickAutoFocus} from "@/lib/blog-generator/auto-generate-plan";
import {isClaudeConfigured} from "@/lib/blog-generator/claude-client";
import {formatCost} from "@/lib/blog-generator/cost-meter";
import {generateJobRunning, startGenerateJob, type Job} from "@/lib/blog-generator/jobs";

// Unattended news articles, run by the VM timer (POST /api/cron/blog-auto-generate):
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

async function recordFinished(job: Job, focus: string) {
    const result = job.result;
    if (job.status === "done" && result) {
        await recordAutomationRun({
            job: BLOG_AUTO_JOB,
            outcome: "acted",
            summary: result.published
                ? `Published “${result.title}” (${result.path}), editor ${result.editorScore ?? "?"}/10, ${formatCost(result.cost)}`
                : `Saved “${result.title}” as a draft (editor ${result.editorScore ?? "?"}/10 is below the bar), ${formatCost(result.cost)}`,
            ref: result.path,
            detail: {focus, jobId: job.id, published: result.published, editorScore: result.editorScore, wordCount: result.wordCount, usd: result.cost.totalUsd}
        });
        return;
    }
    await recordAutomationRun({
        job: BLOG_AUTO_JOB,
        outcome: "failed",
        summary: `Article on “${focus}” failed: ${job.error ?? "unknown error"}`,
        ref: job.id,
        detail: {focus, jobId: job.id, lastLog: job.log.slice(-5)}
    });
}

async function run(): Promise<BlogAutoGenerateResult> {
    if (process.env.BLOG_AUTO_GENERATE_DISABLED?.trim() === "1") return {ok: true, acted: false, summary: "BLOG_AUTO_GENERATE_DISABLED=1"};
    if (!isClaudeConfigured()) return {ok: true, acted: false, summary: "CLAUDE_API_KEY is not set on the server"};
    if (generateJobRunning()) return {ok: true, acted: false, summary: "An article is already being written"};

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
