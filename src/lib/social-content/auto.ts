import "server-only";
import {recordAutomationRun} from "@/lib/automation-runs";
import {listPosts} from "@/lib/social/store";
import {isClaudeReady} from "@/lib/social-content/claude";
import {generateCarousel, generateTextPosts} from "@/lib/social-content/generate";
import {listSocialContent, socialContentSpentToday} from "@/lib/social-content/store";
import {contentIdFromMediaPath, type SocialContentRow} from "@/lib/social-content/types";

// Keeps a small stock of carousels and text posts that have not gone out yet,
// so the auto-share always has something besides videos. Run from the video
// auto-generate timer (every 3 hours); each run tops up at most one carousel
// and one batch of text posts. Cheap: a carousel is one Claude call (~$0.10–0.20)
// plus Satori rendering, a text batch one smaller call.

const CAROUSEL_STOCK = 4;
const TEXT_STOCK = 8;
const TEXT_BATCH = 4;

function numberEnv(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Ready items no platform has had yet (a failed attempt does not count as shared). */
export async function unsharedContent(): Promise<SocialContentRow[]> {
    const [content, posts] = await Promise.all([listSocialContent(undefined, 400), listPosts(2000)]);
    const shared = new Set(posts.filter((post) => post.status !== "failed").map((post) => post.options?.content ?? contentIdFromMediaPath(post.media_path)).filter(Boolean));
    return content.filter((row) => row.status === "ready" && !row.archived_at && !shared.has(row.id));
}

export type ContentGenerateResult = {acted: boolean; summary: string; detail?: Record<string, unknown>};

let running = false;

async function run(): Promise<ContentGenerateResult> {
    if (process.env.SOCIAL_CONTENT_AUTO_DISABLED?.trim() === "1") return {acted: false, summary: "SOCIAL_CONTENT_AUTO_DISABLED=1"};
    if (!isClaudeReady()) return {acted: false, summary: "CLAUDE_API_KEY is not set on the server"};
    const budget = numberEnv("SOCIAL_CONTENT_DAILY_BUDGET_USD", 3);
    const spent = await socialContentSpentToday();
    if (spent >= budget) return {acted: false, summary: `Today's carousels and text posts cost $${spent.toFixed(2)} of the $${budget} budget`};

    const stock = await unsharedContent();
    const carousels = stock.filter((row) => row.kind === "carousel").length;
    const texts = stock.filter((row) => row.kind === "text").length;
    const made: string[] = [];
    const errors: string[] = [];
    if (carousels < CAROUSEL_STOCK) {
        try {
            const row = await generateCarousel();
            made.push(`carousel “${row.source_title}”`);
        } catch (error) {
            errors.push(`carousel: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    if (texts < TEXT_STOCK) {
        try {
            const rows = await generateTextPosts(TEXT_BATCH);
            made.push(`${rows.length} text posts from “${rows[0]?.source_title ?? "?"}”`);
        } catch (error) {
            errors.push(`text: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    if (!made.length && !errors.length) return {acted: false, summary: `Stock is full (${carousels} carousels, ${texts} text posts waiting)`};
    return {acted: made.length > 0, summary: made.length ? `Made ${made.join(" and ")}` : `Nothing made: ${errors.join("; ")}`, detail: {stock: {carousels, texts}, errors}};
}

/** One run, logged; overlapping calls (timer and "Generate now" at once) share nothing and the second skips. */
export async function runContentGenerate(): Promise<ContentGenerateResult> {
    if (running) return {acted: false, summary: "Already generating"};
    running = true;
    try {
        const result = await run();
        await recordAutomationRun({job: "social-content-generate", outcome: result.acted ? "acted" : result.detail?.errors ? "failed" : "skipped", summary: result.summary, detail: result.detail ?? null});
        return result;
    } catch (error) {
        await recordAutomationRun({job: "social-content-generate", outcome: "failed", summary: error instanceof Error ? error.message : String(error)});
        throw error;
    } finally {
        running = false;
    }
}
