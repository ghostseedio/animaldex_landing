import "server-only";
import {listAutomationRuns, recordAutomationRun} from "@/lib/automation-runs";
import {getManagedBlogPosts} from "@/lib/admin-content";
import {structuredClaude} from "@/lib/social-content/claude";
import {collectCandidates} from "@/lib/trend-radar/sources";
import {buildRadarUserPrompt, normalizeRadarIdeas, RADAR_JSON_SCHEMA, RADAR_SYSTEM_PROMPT, type ScoredIdea} from "@/lib/trend-radar/score";
import {insertTrendTopics, openTrendTopics} from "@/lib/trend-radar/store";
import {rankingPages} from "@/data/rankings";
import {answerPages} from "@/data/answer-pages";

// One radar pass: collect the signals, have Claude rank what is worth writing
// now, save the ideas. Runs every few hours from the video auto-generate timer
// (maybeRunTrendRadar) and from "Refresh now" in /admin/story-videos.
// Costs one Claude call (~$0.05–0.10).

export const RADAR_EVERY_MS = 6 * 3_600_000;

export type RadarResult = {ideas: ScoredIdea[]; candidates: number; notes: Record<string, string>; usd: number};

let running: Promise<RadarResult> | null = null;

/** The tier lists and feature guides that already own their searches. */
function corePageTitles() {
    return [...rankingPages.map((page) => page.headline ?? page.title), ...answerPages.map((page) => page.heroTitle)];
}

async function pass(): Promise<RadarResult> {
    const [{candidates, notes}, posts, open] = await Promise.all([collectCandidates(), getManagedBlogPosts().catch(() => []), openTrendTopics()]);
    if (!candidates.length) return {ideas: [], candidates: 0, notes, usd: 0};
    const recentTitles = [...posts]
        .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
        .slice(0, 80)
        .map((post) => post.title);
    const reply = await structuredClaude({
        system: RADAR_SYSTEM_PROMPT,
        user: buildRadarUserPrompt(candidates, recentTitles, open.map((topic) => topic.title), new Date(), corePageTitles()),
        schema: RADAR_JSON_SCHEMA,
        effort: "low"
    });
    const ideas = normalizeRadarIdeas(reply.value, candidates);
    await insertTrendTopics(ideas);
    return {ideas, candidates: candidates.length, notes, usd: reply.usd};
}

/** One pass at a time per process, logged to admin_automation_runs. */
export async function runTrendRadar(trigger: "timer" | "admin"): Promise<RadarResult> {
    if (running) return running;
    running = (async () => {
        try {
            const result = await pass();
            const best = result.ideas.slice(0, 3).map((idea) => `${idea.idea.title} (${idea.kind}, ${idea.score})`).join("; ");
            await recordAutomationRun({
                job: "trend-radar",
                outcome: result.ideas.length ? "acted" : "skipped",
                summary: result.ideas.length ? `${result.ideas.length} ideas from ${result.candidates} signals (${trigger}). Top: ${best}` : `No ideas from ${result.candidates} signals (${trigger})`,
                detail: {notes: result.notes, usd: result.usd}
            });
            return result;
        } catch (error) {
            await recordAutomationRun({job: "trend-radar", outcome: "failed", summary: error instanceof Error ? error.message : String(error)});
            throw error;
        } finally {
            running = null;
        }
    })();
    return running;
}

/** The timer's path: a pass when the last one is older than RADAR_EVERY_MS. Resolves once it has finished (or was not due). */
export async function maybeRunTrendRadar() {
    if (process.env.TREND_RADAR_DISABLED?.trim() === "1") return false;
    const [last] = await listAutomationRuns("trend-radar", 1).catch(() => []);
    if (last && last.outcome !== "failed" && Date.now() - Date.parse(last.created_at) < RADAR_EVERY_MS) return false;
    await runTrendRadar("timer");
    return true;
}
