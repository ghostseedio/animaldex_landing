import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

type SocialMetric = {
    platform: string;
    configured: boolean;
    followers: number | null;
    views: number | null;
    posts: number | null;
    followerChange?: number | null;
    viewChange?: number | null;
    recordedAt?: string | null;
    error?: string;
};

type SnapshotRow = {
    platform: string;
    followers: number | null;
    views: number | null;
    posts: number | null;
    recorded_at: string;
};

const PROVIDERS = ["YouTube", "Instagram", "Facebook", "X", "TikTok"] as const;
const number = (value: unknown) => value == null ? null : Number(value);

function isConfigured(platform: (typeof PROVIDERS)[number]) {
    const env = (name: string) => Boolean(process.env[name]?.trim());
    if (platform === "YouTube") return env("YOUTUBE_API_KEY");
    if (platform === "Instagram") return env("META_ACCESS_TOKEN") && env("INSTAGRAM_BUSINESS_ID");
    if (platform === "Facebook") return env("META_ACCESS_TOKEN") && env("FACEBOOK_PAGE_ID");
    if (platform === "X") return env("X_BEARER_TOKEN");
    return env("TIKTOK_RESEARCH_ACCESS_TOKEN");
}

async function youtube(): Promise<SocialMetric> {
    const key = process.env.YOUTUBE_API_KEY?.trim();
    const handle = process.env.YOUTUBE_CHANNEL_HANDLE?.trim() || "@animaldexapp";
    if (!key) return {platform: "YouTube", configured: false, followers: null, views: null, posts: null};
    const params = new URLSearchParams({part: "statistics", forHandle: handle, key});
    const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`, {cache: "no-store"});
    if (!response.ok) throw new Error(`YouTube returned ${response.status}`);
    const stats = (await response.json())?.items?.[0]?.statistics;
    return {platform: "YouTube", configured: true, followers: number(stats?.subscriberCount), views: number(stats?.viewCount), posts: number(stats?.videoCount)};
}

async function meta(platform: "Facebook" | "Instagram"): Promise<SocialMetric> {
    const token = process.env.META_ACCESS_TOKEN?.trim();
    const id = process.env[platform === "Facebook" ? "FACEBOOK_PAGE_ID" : "INSTAGRAM_BUSINESS_ID"]?.trim();
    if (!token || !id) return {platform, configured: false, followers: null, views: null, posts: null};
    const fields = platform === "Facebook" ? "followers_count,fan_count" : "followers_count,media_count";
    const response = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(id)}?fields=${fields}&access_token=${encodeURIComponent(token)}`, {cache: "no-store"});
    if (!response.ok) throw new Error(`${platform} returned ${response.status}`);
    const data = await response.json();
    return {platform, configured: true, followers: number(data.followers_count ?? data.fan_count), views: null, posts: number(data.media_count)};
}

async function xMetrics(): Promise<SocialMetric> {
    const token = process.env.X_BEARER_TOKEN?.trim();
    const username = process.env.X_USERNAME?.trim() || "animaldexapp";
    if (!token) return {platform: "X", configured: false, followers: null, views: null, posts: null};
    const response = await fetch(`https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=public_metrics`, {
        headers: {Authorization: `Bearer ${token}`},
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`X returned ${response.status}`);
    const metrics = (await response.json())?.data?.public_metrics;
    return {platform: "X", configured: true, followers: number(metrics?.followers_count), views: null, posts: number(metrics?.tweet_count)};
}

async function tiktok(): Promise<SocialMetric> {
    const token = process.env.TIKTOK_RESEARCH_ACCESS_TOKEN?.trim();
    const username = process.env.TIKTOK_USERNAME?.trim() || "animaldexapp";
    if (!token) return {platform: "TikTok", configured: false, followers: null, views: null, posts: null};
    const response = await fetch("https://open.tiktokapis.com/v2/research/user/info/?fields=follower_count,likes_count,video_count", {
        method: "POST",
        headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
        body: JSON.stringify({username}),
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`TikTok returned ${response.status}`);
    const data = (await response.json())?.data;
    return {platform: "TikTok", configured: true, followers: number(data?.follower_count), views: number(data?.likes_count), posts: number(data?.video_count)};
}

async function safe(provider: string, load: () => Promise<SocialMetric>): Promise<SocialMetric> {
    try {
        return await load();
    } catch (error) {
        return {platform: provider, configured: true, followers: null, views: null, posts: null, error: error instanceof Error ? error.message : "Sync failed"};
    }
}

async function loadSnapshots(): Promise<SnapshotRow[]> {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) return [];
    try {
        const response = await fetch(`${url}/rest/v1/admin_social_metric_snapshots?select=platform,followers,views,posts,recorded_at&order=recorded_at.desc&limit=200`, {
            headers: getSupabaseHeaders(key, {Accept: "application/json"}),
            cache: "no-store"
        });
        return response.ok ? await response.json() as SnapshotRow[] : [];
    } catch {
        return [];
    }
}

/** Latest stored value per platform, with change against the previous distinct sync. */
function summarize(rows: SnapshotRow[]) {
    const byPlatform = new Map<string, SnapshotRow[]>();
    for (const row of rows) byPlatform.set(row.platform, [...(byPlatform.get(row.platform) ?? []), row]);
    const metrics: SocialMetric[] = PROVIDERS.map((platform) => {
        const [latest, previous] = byPlatform.get(platform.toLowerCase()) ?? [];
        return {
            platform,
            configured: isConfigured(platform),
            followers: latest?.followers ?? null,
            views: latest?.views ?? null,
            posts: latest?.posts ?? null,
            followerChange: latest?.followers != null && previous?.followers != null ? latest.followers - previous.followers : null,
            viewChange: latest?.views != null && previous?.views != null ? latest.views - previous.views : null,
            recordedAt: latest?.recorded_at ?? null
        };
    });
    const lastSyncedAt = rows[0]?.recorded_at ?? null;
    return {metrics, lastSyncedAt};
}

/** Reads stored snapshots only — no external API calls on page load. */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    return NextResponse.json({ok: true, ...summarize(await loadSnapshots())});
}

/** Calls each configured provider once and stores one snapshot row per platform. */
export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    const results = await Promise.all([
        safe("YouTube", youtube),
        safe("Instagram", () => meta("Instagram")),
        safe("Facebook", () => meta("Facebook")),
        safe("X", xMetrics),
        safe("TikTok", tiktok)
    ]);
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    const rows = results.filter((item) => item.configured && !item.error).map((item) => ({
        platform: item.platform.toLowerCase(),
        followers: item.followers,
        views: item.views,
        posts: item.posts,
        raw_metrics: item
    }));
    if (url && key && rows.length) {
        await fetch(`${url}/rest/v1/admin_social_metric_snapshots`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            body: JSON.stringify(rows),
            cache: "no-store"
        }).catch(() => undefined);
    }
    const summary = summarize(await loadSnapshots());
    const errors = results.filter((item) => item.error).map((item) => `${item.platform}: ${item.error}`);
    return NextResponse.json({ok: true, ...summary, errors});
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
