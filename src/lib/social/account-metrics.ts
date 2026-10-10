import "server-only";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {getFreshConnection} from "@/lib/social/oauth";
import {listConnectionRows} from "@/lib/social/store";
import type {SocialConnection, SocialPlatform} from "@/lib/social/types";

// Account totals (followers, lifetime views, post count) for the official
// accounts, stored as one admin_social_metric_snapshots row per platform per
// sync. Each platform uses its read-only API key from the environment when one
// is set, otherwise the OAuth login /admin/story-videos already holds for
// posting. Lifetime-view snapshots on consecutive days give the daily log its
// automatic views (see auto-log.ts).

export type SocialMetric = {
    platform: string;
    configured: boolean;
    followers: number | null;
    views: number | null;
    posts: number | null;
    followerChange?: number | null;
    viewChange?: number | null;
    recordedAt?: string | null;
    /** Where the numbers come from: an API key, or the Story videos login. */
    source?: "api-key" | "story-videos";
    /** Synced, but this number isn't available with the current access. */
    note?: string;
    error?: string;
};

export const SOCIAL_METRIC_PROVIDERS = ["YouTube", "Instagram", "Facebook", "X", "TikTok"] as const;
type Provider = (typeof SOCIAL_METRIC_PROVIDERS)[number];

const PROVIDER_PLATFORM: Record<Provider, SocialPlatform> = {YouTube: "youtube", Instagram: "instagram", Facebook: "facebook", X: "x", TikTok: "tiktok"};

const number = (value: unknown) => (value == null || !Number.isFinite(Number(value)) ? null : Number(value));
const env = (name: string) => process.env[name]?.trim() || "";

export function hasApiKey(provider: Provider) {
    if (provider === "YouTube") return Boolean(env("YOUTUBE_API_KEY"));
    if (provider === "Instagram") return Boolean(env("META_ACCESS_TOKEN") && env("INSTAGRAM_BUSINESS_ID"));
    if (provider === "Facebook") return Boolean(env("META_ACCESS_TOKEN") && env("FACEBOOK_PAGE_ID"));
    if (provider === "X") return Boolean(env("X_BEARER_TOKEN"));
    return Boolean(env("TIKTOK_RESEARCH_ACCESS_TOKEN"));
}

/** Providers that can be synced: an API key, or a Story videos login. */
export async function syncableProviders() {
    const connected = new Set(await listConnectionRows().then((rows) => rows.map((row) => row.platform)).catch(() => [] as SocialPlatform[]));
    return new Set(SOCIAL_METRIC_PROVIDERS.filter((provider) => hasApiKey(provider) || connected.has(PROVIDER_PLATFORM[provider])));
}

async function json(response: Response, what: string) {
    const text = await response.text();
    if (!response.ok) throw new Error(`${what} returned ${response.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : {};
}

const bearer = (connection: SocialConnection) => ({Authorization: `Bearer ${connection.accessToken}`});
const hasScope = (connection: SocialConnection, scope: string) => (connection.scopes ?? "").split(/[\s,]+/).includes(scope);

// ---------------------------------------------------------------------------
// API keys (read-only credentials set in the environment)
// ---------------------------------------------------------------------------

async function youtubeByKey(): Promise<SocialMetric> {
    const params = new URLSearchParams({part: "statistics", forHandle: env("YOUTUBE_CHANNEL_HANDLE") || "@animaldexapp", key: env("YOUTUBE_API_KEY")});
    const stats = (await json(await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`, {cache: "no-store"}), "YouTube"))?.items?.[0]?.statistics;
    return {platform: "YouTube", configured: true, source: "api-key", followers: number(stats?.subscriberCount), views: number(stats?.viewCount), posts: number(stats?.videoCount)};
}

async function metaByKey(platform: "Facebook" | "Instagram"): Promise<SocialMetric> {
    const id = env(platform === "Facebook" ? "FACEBOOK_PAGE_ID" : "INSTAGRAM_BUSINESS_ID");
    const fields = platform === "Facebook" ? "followers_count,fan_count" : "followers_count,media_count";
    const data = await json(await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(id)}?fields=${fields}&access_token=${encodeURIComponent(env("META_ACCESS_TOKEN"))}`, {cache: "no-store"}), platform);
    return {platform, configured: true, source: "api-key", followers: number(data.followers_count ?? data.fan_count), views: null, posts: number(data.media_count)};
}

async function xByKey(): Promise<SocialMetric> {
    const username = env("X_USERNAME") || "animaldexapp";
    const metrics = (await json(await fetch(`https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=public_metrics`, {
        headers: {Authorization: `Bearer ${env("X_BEARER_TOKEN")}`},
        cache: "no-store"
    }), "X"))?.data?.public_metrics;
    return {platform: "X", configured: true, source: "api-key", followers: number(metrics?.followers_count), views: null, posts: number(metrics?.tweet_count)};
}

async function tiktokByKey(): Promise<SocialMetric> {
    const data = (await json(await fetch("https://open.tiktokapis.com/v2/research/user/info/?fields=follower_count,likes_count,video_count", {
        method: "POST",
        headers: {Authorization: `Bearer ${env("TIKTOK_RESEARCH_ACCESS_TOKEN")}`, "Content-Type": "application/json"},
        body: JSON.stringify({username: env("TIKTOK_USERNAME") || "animaldexapp"}),
        cache: "no-store"
    }), "TikTok"))?.data;
    // The Research API has no view total; likes are not views, so they aren't stored as views.
    return {platform: "TikTok", configured: true, source: "api-key", followers: number(data?.follower_count), views: null, posts: number(data?.video_count)};
}

// ---------------------------------------------------------------------------
// Story videos logins (the OAuth connections used for posting)
// ---------------------------------------------------------------------------

async function youtubeByLogin(connection: SocialConnection): Promise<SocialMetric> {
    const stats = (await json(await fetch("https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true", {headers: bearer(connection), cache: "no-store"}), "YouTube"))?.items?.[0]?.statistics;
    return {platform: "YouTube", configured: true, source: "story-videos", followers: number(stats?.subscriberCount), views: number(stats?.viewCount), posts: number(stats?.videoCount)};
}

async function instagramByLogin(connection: SocialConnection): Promise<SocialMetric> {
    const data = await json(await fetch(`https://graph.instagram.com/v23.0/me?fields=followers_count,media_count&access_token=${encodeURIComponent(connection.accessToken)}`, {cache: "no-store"}), "Instagram");
    return {platform: "Instagram", configured: true, source: "story-videos", followers: number(data.followers_count), views: null, posts: number(data.media_count), note: "Views need Instagram's insights permission"};
}

async function facebookByLogin(connection: SocialConnection): Promise<SocialMetric> {
    const data = await json(await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(connection.accountId ?? "me")}?fields=followers_count,fan_count&access_token=${encodeURIComponent(connection.accessToken)}`, {cache: "no-store"}), "Facebook");
    return {platform: "Facebook", configured: true, source: "story-videos", followers: number(data.followers_count ?? data.fan_count), views: null, posts: null, note: "Views need the Page insights permission"};
}

/** Lifetime impressions of the posts this app shared to X (the only X posts we can attribute). */
async function sharedXImpressions(connection: SocialConnection) {
    const ids = await publishedExternalIds("x");
    let total = 0;
    for (let index = 0; index < ids.length; index += 100) {
        const body = await json(await fetch(`https://api.x.com/2/tweets?ids=${ids.slice(index, index + 100).join(",")}&tweet.fields=public_metrics`, {headers: bearer(connection), cache: "no-store"}), "X posts");
        for (const tweet of body.data ?? []) total += Number(tweet.public_metrics?.impression_count ?? 0) || 0;
    }
    return ids.length ? total : null;
}

async function xByLogin(connection: SocialConnection): Promise<SocialMetric> {
    const metrics = (await json(await fetch("https://api.x.com/2/users/me?user.fields=public_metrics", {headers: bearer(connection), cache: "no-store"}), "X"))?.data?.public_metrics;
    const views = await sharedXImpressions(connection);
    return {platform: "X", configured: true, source: "story-videos", followers: number(metrics?.followers_count), views, posts: number(metrics?.tweet_count), note: "Views count only posts shared from Story videos"};
}

/** Sums view_count over every video on the account (TikTok Display API, scope video.list). */
async function tiktokTotalViews(connection: SocialConnection) {
    let total = 0;
    let cursor: number | undefined;
    for (let page = 0; page < 50; page += 1) {
        const body = await json(await fetch("https://open.tiktokapis.com/v2/video/list/?fields=id,view_count", {
            method: "POST",
            headers: {...bearer(connection), "Content-Type": "application/json"},
            body: JSON.stringify({max_count: 20, ...(cursor != null ? {cursor} : {})}),
            cache: "no-store"
        }), "TikTok videos");
        for (const video of body.data?.videos ?? []) total += Number(video.view_count ?? 0) || 0;
        if (!body.data?.has_more) break;
        cursor = body.data.cursor;
    }
    return total;
}

async function tiktokByLogin(connection: SocialConnection): Promise<SocialMetric> {
    const stats = hasScope(connection, "user.info.stats");
    const videos = hasScope(connection, "video.list");
    if (!stats && !videos) throw new Error("the TikTok login can only post; reconnect it with the user.info.stats and video.list scopes to sync followers and views");
    const user = stats
        ? (await json(await fetch("https://open.tiktokapis.com/v2/user/info/?fields=follower_count,video_count", {headers: bearer(connection), cache: "no-store"}), "TikTok"))?.data?.user
        : null;
    return {platform: "TikTok", configured: true, source: "story-videos", followers: number(user?.follower_count), views: videos ? await tiktokTotalViews(connection) : null, posts: number(user?.video_count)};
}

const BY_KEY: Record<Provider, () => Promise<SocialMetric>> = {
    YouTube: youtubeByKey,
    Instagram: () => metaByKey("Instagram"),
    Facebook: () => metaByKey("Facebook"),
    X: xByKey,
    TikTok: tiktokByKey
};

const BY_LOGIN: Record<Provider, (connection: SocialConnection) => Promise<SocialMetric>> = {
    YouTube: youtubeByLogin,
    Instagram: instagramByLogin,
    Facebook: facebookByLogin,
    X: xByLogin,
    TikTok: tiktokByLogin
};

async function loadProvider(provider: Provider, connected: Set<SocialPlatform>): Promise<SocialMetric> {
    const blank: SocialMetric = {platform: provider, configured: false, followers: null, views: null, posts: null};
    try {
        // A Story videos login sees lifetime views where most API keys don't, so it goes first.
        if (connected.has(PROVIDER_PLATFORM[provider])) return await BY_LOGIN[provider](await getFreshConnection(PROVIDER_PLATFORM[provider]));
        if (hasApiKey(provider)) return await BY_KEY[provider]();
        return blank;
    } catch (error) {
        return {...blank, configured: true, error: error instanceof Error ? error.message : "Sync failed"};
    }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function rest(path: string, init: RequestInit = {}) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) return null;
    return fetch(`${url}/rest/v1/${path}`, {...init, headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Accept: "application/json"}), cache: "no-store"});
}

async function publishedExternalIds(platform: SocialPlatform) {
    const response = await rest(`admin_social_posts?select=external_id&platform=eq.${platform}&status=eq.published&mode=eq.post&external_id=not.is.null`);
    if (!response?.ok) return [];
    return (await response.json() as Array<{external_id: string}>).map((row) => row.external_id).filter((id) => /^\d+$/.test(id));
}

export type SnapshotRow = {platform: string; followers: number | null; views: number | null; posts: number | null; recorded_at: string};

export async function loadSnapshots(sinceIso?: string, limit = 200): Promise<SnapshotRow[]> {
    const since = sinceIso ? `&recorded_at=gte.${encodeURIComponent(sinceIso)}` : "";
    try {
        const response = await rest(`admin_social_metric_snapshots?select=platform,followers,views,posts,recorded_at${since}&order=recorded_at.desc&limit=${limit}`);
        return response?.ok ? await response.json() as SnapshotRow[] : [];
    } catch {
        return [];
    }
}

/** Calls every syncable provider once and stores one snapshot row per platform that answered. */
export async function syncSocialAccounts() {
    const connected = new Set(await listConnectionRows().then((rows) => rows.map((row) => row.platform)).catch(() => [] as SocialPlatform[]));
    const results = await Promise.all(SOCIAL_METRIC_PROVIDERS.map((provider) => loadProvider(provider, connected)));
    const rows = results.filter((item) => item.configured && !item.error).map((item) => ({
        platform: item.platform.toLowerCase(),
        followers: item.followers,
        views: item.views,
        posts: item.posts,
        raw_metrics: item
    }));
    if (rows.length) await rest("admin_social_metric_snapshots", {method: "POST", body: JSON.stringify(rows)})?.catch(() => undefined);
    lastSyncAt = Date.now();
    return results;
}

// Snapshots a day apart are what turn lifetime totals into daily views, and
// there is no scheduler, so opening the metrics page takes a snapshot when the
// last one is a few hours old. In-process guard: one sync at a time.
const STALE_AFTER_MS = 4 * 60 * 60_000;
let lastSyncAt = 0;
let syncing: Promise<unknown> | null = null;

export function syncSocialAccountsIfStale(latestSnapshotAt: string | null) {
    const latest = Math.max(lastSyncAt, latestSnapshotAt ? Date.parse(latestSnapshotAt) : 0);
    if (syncing || Date.now() - latest < STALE_AFTER_MS) return;
    lastSyncAt = Date.now();
    syncing = syncSocialAccounts()
        .catch((error) => console.warn("[social-metrics] background sync failed", error))
        .finally(() => { syncing = null; });
}
