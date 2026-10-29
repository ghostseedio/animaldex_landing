import {recordAutomationRun} from "@/lib/automation-runs";
import {getFreshConnection} from "@/lib/social/oauth";
import {listConnectionRows, listPosts} from "@/lib/social/store";
import {isZernioPlatform, type SocialPlatform, type SocialPostRow, ZERNIO_PLATFORMS} from "@/lib/social/types";
import {isZernioApiConfigured, listZernioAnalytics} from "@/lib/social/zernio";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {fromFacebook, fromInstagram, fromX, fromYouTube, fromZernioAnalytics, type MetricsInput, metricsRow, type MetricsRow, zernioAnalyticsKeys} from "@/lib/social-lab/metrics-core";

// Per-post numbers for everything the official accounts published, into
// admin_social_post_metrics (latest reading per share). Run every few hours
// from the auto-share timer (maybeSyncPostMetrics) and from "Sync now" in the
// hook lab panel. Each platform is best-effort: one failing (an expired login,
// a missing insights permission) is reported and the rest still sync.

/** Shares older than this stop being re-read: their numbers have settled. */
const WINDOW_DAYS = 45;
/** Instagram and Facebook are asked one post at a time; cap the calls per platform per sync. */
const MAX_PER_POST_CALLS = 150;
/** Facebook stops after this many unreadable posts in a row (they were posted on a previous Page). */
const FACEBOOK_GIVE_UP_AFTER = 8;
/** The timer path syncs at most this often. */
export const SYNC_EVERY_MS = 6 * 3_600_000;

function rest(path: string, init: RequestInit & {prefer?: string} = {}) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase service role is not configured");
    const headers: Record<string, string> = getSupabaseHeaders(key, {"Content-Type": "application/json"});
    if (init.prefer) headers.Prefer = init.prefer;
    return fetch(`${url}/rest/v1/${path}`, {...init, headers, cache: "no-store"});
}

async function readJson(response: Response, what: string) {
    const text = await response.text();
    let body: any = null;
    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        body = null;
    }
    if (!response.ok) throw new Error(`${what} failed (${response.status}): ${text.slice(0, 240)}`);
    return body;
}

const day = (date: Date) => date.toISOString().slice(0, 10);

export async function listPostMetrics(): Promise<MetricsRow[]> {
    const response = await rest("admin_social_post_metrics?select=*&limit=5000");
    return await readJson(response, "Loading post metrics") as MetricsRow[];
}

export async function lastMetricsSync(): Promise<string | null> {
    const response = await rest("admin_social_post_metrics?select=fetched_at&order=fetched_at.desc&limit=1");
    const rows = await readJson(response, "Loading the last metrics sync") as Array<{fetched_at: string}>;
    return rows[0]?.fetched_at ?? null;
}

async function upsertMetrics(rows: MetricsRow[]) {
    for (let index = 0; index < rows.length; index += 200) {
        const response = await rest("admin_social_post_metrics?on_conflict=post_id", {
            method: "POST",
            prefer: "resolution=merge-duplicates,return=minimal",
            body: JSON.stringify(rows.slice(index, index + 200))
        });
        await readJson(response, "Saving post metrics");
    }
}

type Collected = {rows: MetricsRow[]; notes: Record<string, string>};

/** When a share went live: Zernio's publish time when known, else when the row was made. */
function publishedAt(post: SocialPostRow) {
    return post.options?.zernio?.publishedAt ?? post.created_at;
}

function push(out: Collected, post: SocialPostRow, input: MetricsInput) {
    out.rows.push(metricsRow(post.id, post.platform, publishedAt(post), input));
}

async function syncZernio(platform: SocialPlatform, posts: SocialPostRow[], out: Collected) {
    if (!isZernioPlatform(platform) || !posts.length) return;
    const from = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
    const analytics = await listZernioAnalytics(platform, day(from), day(new Date(Date.now() + 86_400_000)));
    const byKey = new Map<string, any>();
    for (const entry of analytics) for (const key of zernioAnalyticsKeys(entry)) byKey.set(key, entry);
    let matched = 0;
    for (const post of posts) {
        const urlId = post.external_url?.match(/\/(\d{8,})(?:[/?#]|$)/)?.[1];
        const entry = (post.external_id && byKey.get(post.external_id)) ?? (urlId && byKey.get(urlId)) ?? null;
        if (!entry) continue;
        matched += 1;
        push(out, post, fromZernioAnalytics(entry));
    }
    out.notes[platform] = `${matched} of ${posts.length} posts matched in Zernio analytics`;
}

async function syncYouTube(posts: SocialPostRow[], out: Collected) {
    const connection = await getFreshConnection("youtube");
    const auth = {Authorization: `Bearer ${connection.accessToken}`};
    const ids = posts.map((post) => post.external_id!).filter(Boolean);
    const statistics = new Map<string, any>();
    const analytics = new Map<string, Record<string, number>>();
    for (let index = 0; index < ids.length; index += 50) {
        const batch = ids.slice(index, index + 50);
        const data = await readJson(await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.join(",")}`, {headers: auth}), "YouTube statistics");
        for (const item of data?.items ?? []) statistics.set(item.id, item.statistics);
        // Retention needs yt-analytics.readonly; without it the views still sync.
        const params = new URLSearchParams({
            ids: "channel==MINE",
            startDate: "2026-01-01",
            endDate: day(new Date()),
            metrics: "views,averageViewPercentage,averageViewDuration,shares,subscribersGained",
            dimensions: "video",
            filters: `video==${batch.join(",")}`,
            maxResults: "200"
        });
        const report = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, {headers: auth});
        if (report.ok) {
            const body = await report.json() as {columnHeaders?: Array<{name: string}>; rows?: unknown[][]};
            const names = (body.columnHeaders ?? []).map((header) => header.name);
            for (const row of body.rows ?? []) {
                const record = Object.fromEntries(names.map((name, column) => [name, row[column]])) as Record<string, unknown>;
                analytics.set(String(record.video), Object.fromEntries(Object.entries(record).filter(([name]) => name !== "video").map(([name, value]) => [name, Number(value)])));
            }
        } else if (!out.notes.youtube) {
            out.notes.youtube = `retention unavailable (${report.status}); reconnect YouTube to grant YouTube Analytics`;
        }
    }
    for (const post of posts) {
        const stats = statistics.get(post.external_id!);
        if (!stats) continue;
        push(out, post, fromYouTube(stats, analytics.get(post.external_id!) ?? null));
    }
    out.notes.youtube ??= `${statistics.size} of ${posts.length} videos`;
}

async function syncInstagram(posts: SocialPostRow[], out: Collected, budget: {calls: number}) {
    const connection = await getFreshConnection("instagram");
    const token = encodeURIComponent(connection.accessToken);
    let insightError: string | null = null;
    let done = 0;
    for (const post of posts) {
        if (budget.calls <= 0) break;
        budget.calls -= 1;
        const fields = await readJson(await fetch(`https://graph.instagram.com/v23.0/${post.external_id}?fields=like_count,comments_count,media_product_type&access_token=${token}`), "Instagram media").catch(() => null);
        if (!fields) continue;
        const metrics = post.media_kind === "carousel" ? "views,reach,saved,shares,total_interactions" : "views,reach,saved,shares,total_interactions,ig_reels_avg_watch_time";
        const response = await fetch(`https://graph.instagram.com/v23.0/${post.external_id}/insights?metric=${metrics}&access_token=${token}`);
        const insights = response.ok ? await response.json() : null;
        if (!response.ok && !insightError) insightError = (await response.text()).slice(0, 160);
        push(out, post, fromInstagram(fields, insights));
        done += 1;
    }
    out.notes.instagram = insightError ? `${done} posts; insights missing (reconnect Instagram and allow insights): ${insightError}` : `${done} posts`;
}

async function syncFacebook(posts: SocialPostRow[], out: Collected, budget: {calls: number}) {
    const connection = await getFreshConnection("facebook");
    const token = encodeURIComponent(connection.accessToken);
    let firstError: string | null = null;
    let done = 0;
    let failedInARow = 0;
    for (const post of posts) {
        // Newest first: a long run of unreadable posts means the rest went out on a previous Page.
        if (budget.calls <= 0 || failedInARow >= FACEBOOK_GIVE_UP_AFTER) break;
        budget.calls -= 1;
        const isReel = post.media_kind !== "carousel" && post.media_kind !== "text_post";
        try {
            if (isReel) {
                const insights = await readJson(await fetch(`https://graph.facebook.com/v23.0/${post.external_id}/video_insights?metric=fb_reels_total_plays,blue_reels_play_count,post_video_avg_time_watched&access_token=${token}`), "Facebook reel insights");
                push(out, post, fromFacebook(insights, null));
            } else {
                const fields = await readJson(await fetch(`https://graph.facebook.com/v23.0/${post.external_id}?fields=reactions.summary(true).limit(0),comments.summary(true).limit(0),shares&access_token=${token}`), "Facebook post");
                const insights = await fetch(`https://graph.facebook.com/v23.0/${post.external_id}/insights?metric=post_impressions_unique&access_token=${token}`).then((response) => response.ok ? response.json() : null).catch(() => null);
                push(out, post, fromFacebook(insights, fields));
            }
            done += 1;
            failedInARow = 0;
        } catch (error) {
            failedInARow += 1;
            firstError ??= (error instanceof Error ? error.message : String(error)).slice(0, 200);
        }
    }
    out.notes.facebook = `${done} of ${posts.length} posts readable with the current Page login${firstError ? `; first error: ${firstError}` : ""}`;
}

async function syncX(posts: SocialPostRow[], out: Collected) {
    const connection = await getFreshConnection("x");
    const ids = posts.map((post) => post.external_id!).filter(Boolean);
    const byId = new Map<string, any>();
    for (let index = 0; index < ids.length; index += 100) {
        const data = await readJson(await fetch(`https://api.x.com/2/tweets?ids=${ids.slice(index, index + 100).join(",")}&tweet.fields=public_metrics`, {headers: {Authorization: `Bearer ${connection.accessToken}`}}), "X lookup");
        for (const tweet of data?.data ?? []) byId.set(tweet.id, tweet);
    }
    for (const post of posts) {
        const tweet = byId.get(post.external_id!);
        if (tweet) push(out, post, fromX(tweet));
    }
    out.notes.x = `${byId.size} of ${posts.length} posts`;
}

export type MetricsSyncResult = {synced: number; notes: Record<string, string>};

/** Reads every platform once and saves what it got. */
export async function syncPostMetrics(): Promise<MetricsSyncResult> {
    const since = Date.now() - WINDOW_DAYS * 86_400_000;
    const posts = (await listPosts(2000)).filter((post) => post.status === "published" && post.mode === "post" && post.external_id && Date.parse(post.created_at) >= since);
    const byPlatform = (platform: SocialPlatform) => posts.filter((post) => post.platform === platform);
    const connected = new Set((await listConnectionRows().catch(() => [])).map((row) => row.platform));
    const out: Collected = {rows: [], notes: {}};
    const attempt = async (platform: SocialPlatform, run: () => Promise<void>) => {
        try {
            await run();
        } catch (error) {
            out.notes[platform] = `failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`;
        }
    };
    if (isZernioApiConfigured()) {
        for (const platform of ZERNIO_PLATFORMS) await attempt(platform, () => syncZernio(platform, byPlatform(platform), out));
    }
    if (connected.has("youtube") && byPlatform("youtube").length) await attempt("youtube", () => syncYouTube(byPlatform("youtube"), out));
    if (connected.has("x") && byPlatform("x").length) await attempt("x", () => syncX(byPlatform("x"), out));
    // Newest first, so the per-post call budget goes to the posts still moving.
    const newest = (list: SocialPostRow[]) => [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (connected.has("instagram") && byPlatform("instagram").length) await attempt("instagram", () => syncInstagram(newest(byPlatform("instagram")), out, {calls: MAX_PER_POST_CALLS}));
    if (connected.has("facebook") && byPlatform("facebook").length) await attempt("facebook", () => syncFacebook(newest(byPlatform("facebook")), out, {calls: MAX_PER_POST_CALLS}));
    if (out.rows.length) await upsertMetrics(out.rows);
    return {synced: out.rows.length, notes: out.notes};
}

let running: Promise<MetricsSyncResult> | null = null;

/** One sync at a time per process, logged to admin_automation_runs. */
export async function runMetricsSync(trigger: "timer" | "admin"): Promise<MetricsSyncResult> {
    if (running) return running;
    running = (async () => {
        try {
            const result = await syncPostMetrics();
            await recordAutomationRun({job: "social-metrics-sync", outcome: result.synced ? "acted" : "skipped", summary: `${result.synced} posts read (${trigger})`, detail: {notes: result.notes}});
            return result;
        } catch (error) {
            await recordAutomationRun({job: "social-metrics-sync", outcome: "failed", summary: error instanceof Error ? error.message : String(error)});
            throw error;
        } finally {
            running = null;
        }
    })();
    return running;
}

/** The timer's path: syncs in the background when the last reading is older than SYNC_EVERY_MS. */
export async function maybeSyncPostMetrics() {
    const last = await lastMetricsSync().catch(() => null);
    // Slack, so a reading stamped a minute after one timer tick does not make the next tick miss.
    if (last && Date.now() - Date.parse(last) < SYNC_EVERY_MS - 15 * 60_000) return false;
    void runMetricsSync("timer").catch((error) => console.error("[social-metrics-sync]", error));
    return true;
}
