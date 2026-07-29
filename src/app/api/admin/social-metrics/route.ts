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
    error?: string;
};

const number = (value: unknown) => value == null ? null : Number(value);

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
    return {
        platform,
        configured: true,
        followers: number(data.followers_count ?? data.fan_count),
        views: null,
        posts: number(data.media_count)
    };
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

async function storeSnapshots(metrics: SocialMetric[]) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    const rows = metrics.filter((item) => item.configured && !item.error).map((item) => ({
        platform: item.platform.toLowerCase(),
        followers: item.followers,
        views: item.views,
        posts: item.posts,
        raw_metrics: item
    }));
    if (!url || !key || !rows.length) return;
    await fetch(`${url}/rest/v1/admin_social_metric_snapshots`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
        body: JSON.stringify(rows),
        cache: "no-store"
    });
}

async function loadPreviousSnapshots() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    const result = new Map<string, {followers: number | null; views: number | null}>();
    if (!url || !key) return result;
    try {
        const response = await fetch(`${url}/rest/v1/admin_social_metric_snapshots?select=platform,followers,views,recorded_at&order=recorded_at.desc&limit=100`, {
            headers: getSupabaseHeaders(key, {Accept: "application/json"}),
            cache: "no-store"
        });
        if (!response.ok) return result;
        const rows = await response.json() as Array<{platform: string; followers: number | null; views: number | null}>;
        rows.forEach((row) => {
            if (!result.has(row.platform)) result.set(row.platform, {followers: row.followers, views: row.views});
        });
    } catch {
        // Social syncing still works before the snapshot migration is applied.
    }
    return result;
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    const [metrics, previous] = await Promise.all([Promise.all([
        safe("YouTube", youtube),
        safe("Instagram", () => meta("Instagram")),
        safe("Facebook", () => meta("Facebook")),
        safe("X", xMetrics),
        safe("TikTok", tiktok)
    ]), loadPreviousSnapshots()]);
    const withChanges = metrics.map((item) => {
        const prior = previous.get(item.platform.toLowerCase());
        return {
            ...item,
            followerChange: item.followers != null && prior?.followers != null ? item.followers - prior.followers : null,
            viewChange: item.views != null && prior?.views != null ? item.views - prior.views : null
        };
    });
    await storeSnapshots(withChanges);
    return NextResponse.json({ok: true, metrics: withChanges, syncedAt: new Date().toISOString()});
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
