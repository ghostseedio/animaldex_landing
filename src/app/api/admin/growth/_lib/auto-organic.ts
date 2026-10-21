import "server-only";
import type {OrganicEntry} from "@/lib/growth-command-center";
import {jakartaDayBounds, todayKey} from "@/lib/growth-command-center";
import {loadSnapshots, syncSocialAccountsIfStale} from "@/lib/social/account-metrics";
import {buildAutoOrganic, countPublishTimes, countSharedPosts, dailyViews, maxPostCounts, viewsFromSnapshots, type DayCounts, type ShareLogRow} from "@/lib/social/auto-log";
import {getFreshConnection} from "@/lib/social/oauth";
import {listConnectionRows} from "@/lib/social/store";
import {getTikTokDailyViews, listTikTokPublishTimes, zernioConfigProblem} from "@/lib/social/zernio";
import {fetchRows} from "./rows";

// The automatic half of the daily organic log (merged with hand-entered rows
// in plan.ts). Nothing here is written to growth_marketing_daily_organic, so
// hand edits and auto numbers never overwrite each other.
//   posts: the share log (/admin/story-videos), plus every upload on YouTube
//          and every TikTok video Zernio sees, so posts made elsewhere count
//          and past days fill in.
//   views: each platform's own per-day history where it has one (YouTube
//          Analytics, Instagram and Facebook insights, TikTok via Zernio), so
//          past days fill in; lifetime-total snapshots fill the rest (X).

export type AutoOrganic = {
    byDate: Record<string, OrganicEntry[]>;
    /** Why a source gave nothing, shown under the log. */
    notes: string[];
};

// Every source reads a whole month in a few calls, kept for an hour.
const cache = new Map<string, {at: number; value: unknown}>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 60 * 60_000) return hit.value as T;
    const value = await load();
    cache.set(key, {at: Date.now(), value});
    return value;
}

async function readJson(response: Response, what: string) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message ?? `${what} returned ${response.status}`);
    return body;
}

/** Exact views per day. YouTube's days are Pacific time. Needs the yt-analytics.readonly scope. */
async function youtubeDailyViews(startDate: string, endDate: string) {
    return cached(`youtube-views|${startDate}|${endDate}`, async () => {
        const connection = await getFreshConnection("youtube");
        const params = new URLSearchParams({ids: "channel==MINE", startDate, endDate, metrics: "views", dimensions: "day", sort: "day"});
        const body = await readJson(await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, {headers: {Authorization: `Bearer ${connection.accessToken}`}, cache: "no-store"}), "YouTube Analytics");
        // Rows are [day, views].
        return Object.fromEntries((body.rows ?? []).map((row: [string, number]) => [row[0], Number(row[1]) || 0])) as Record<string, number>;
    });
}

/** When each video on the channel went live, newest first, back to startDate. */
async function youtubeUploadTimes(startDate: string, endDate: string) {
    return cached(`youtube-uploads|${startDate}|${endDate}`, async () => {
        const connection = await getFreshConnection("youtube");
        const headers = {Authorization: `Bearer ${connection.accessToken}`};
        const channel = await readJson(await fetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", {headers, cache: "no-store"}), "YouTube channel");
        const playlistId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        if (!playlistId) return [];
        const {startIso} = jakartaDayBounds(startDate);
        const {endIso} = jakartaDayBounds(endDate);
        const times: string[] = [];
        let pageToken = "";
        for (let page = 0; page < 20; page++) {
            const params = new URLSearchParams({part: "contentDetails", playlistId, maxResults: "50", ...(pageToken ? {pageToken} : {})});
            const body = await readJson(await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`, {headers, cache: "no-store"}), "YouTube uploads");
            let reachedStart = false;
            for (const item of body.items ?? []) {
                const published = item.contentDetails?.videoPublishedAt;
                if (typeof published !== "string") continue;
                if (published < startIso) reachedStart = true;
                else if (published <= endIso) times.push(published);
            }
            pageToken = body.nextPageToken ?? "";
            if (reachedStart || !pageToken) break;
        }
        return times;
    });
}

function datesBetween(startDate: string, endDate: string) {
    const dates: string[] = [];
    for (let time = Date.parse(`${startDate}T00:00:00Z`); time <= Date.parse(`${endDate}T00:00:00Z`); time += 86_400_000) dates.push(new Date(time).toISOString().slice(0, 10));
    return dates;
}

/**
 * Account views per growth (Jakarta) day. Instagram only gives views as a
 * total for a range, so it is asked once per day. Needs the
 * instagram_business_manage_insights scope.
 */
async function instagramDailyViews(startDate: string, endDate: string) {
    return cached(`instagram-views|${startDate}|${endDate}`, async () => {
        const connection = await getFreshConnection("instagram");
        const account = encodeURIComponent(connection.accountId ?? "me");
        const views: Record<string, number> = {};
        const errors: string[] = [];
        await Promise.all(datesBetween(startDate, endDate).map(async (date) => {
            const {startIso, endIso} = jakartaDayBounds(date);
            const params = new URLSearchParams({
                metric: "views", period: "day", metric_type: "total_value",
                since: String(Math.floor(Date.parse(startIso) / 1000)), until: String(Math.floor(Date.parse(endIso) / 1000) + 1),
                access_token: connection.accessToken
            });
            try {
                const body = await readJson(await fetch(`https://graph.instagram.com/v23.0/${account}/insights?${params}`, {cache: "no-store"}), "Instagram insights");
                const value = body.data?.[0]?.total_value?.value;
                if (value != null) views[date] = Number(value) || 0;
            } catch (error) {
                errors.push(error instanceof Error ? error.message : "unavailable");
            }
        }));
        if (!Object.keys(views).length && errors.length) throw new Error(errors[0]);
        return views;
    });
}

/**
 * Page views per day. Meta's day ends at end_time (Pacific midnight), so the
 * day is the date half a day before it. page_media_view replaced
 * page_impressions; page_video_views is the fallback. Needs read_insights.
 */
async function facebookDailyViews(startDate: string, endDate: string) {
    return cached(`facebook-views|${startDate}|${endDate}`, async () => {
        const connection = await getFreshConnection("facebook");
        const until = new Date(Date.parse(`${endDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
        let lastError: unknown = null;
        for (const metric of ["page_media_view", "page_video_views"]) {
            const params = new URLSearchParams({metric, period: "day", since: startDate, until, access_token: connection.accessToken});
            try {
                const body = await readJson(await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(connection.accountId ?? "me")}/insights?${params}`, {cache: "no-store"}), "Facebook insights");
                const views: Record<string, number> = {};
                for (const point of body.data?.[0]?.values ?? []) {
                    if (typeof point?.end_time !== "string") continue;
                    const date = new Date(Date.parse(point.end_time) - 12 * 60 * 60_000).toISOString().slice(0, 10);
                    if (date >= startDate && date <= endDate) views[date] = Number(point.value) || 0;
                }
                return views;
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError;
    });
}

type Source<T> = {name: string; enabled: boolean; load: () => Promise<T>};

async function settle<T>(source: Source<T>, empty: T, notes: string[]): Promise<T> {
    if (!source.enabled) return empty;
    try {
        return await source.load();
    } catch (error) {
        notes.push(`${source.name}: ${error instanceof Error ? error.message : "unavailable"}`);
        return empty;
    }
}

export async function loadAutoOrganic(startDate: string, endDate: string, startIso: string, endIso: string): Promise<AutoOrganic> {
    const notes: string[] = [];
    const dayBefore = new Date(Date.parse(startIso) - 86_400_000).toISOString();
    const today = todayKey();
    // Nothing to ask the platforms about past today.
    const last = endDate < today ? endDate : today;
    const past = startDate <= today;
    const [shares, snapshots, connected] = await Promise.all([
        fetchRows<ShareLogRow>(
            "admin_social_posts",
            `select=platform,mode,status,updated_at&status=eq.published&mode=eq.post&updated_at=gte.${encodeURIComponent(startIso)}&updated_at=lte.${encodeURIComponent(endIso)}`,
        ).catch(() => [] as ShareLogRow[]),
        loadSnapshots(dayBefore, 2000),
        listConnectionRows().then((rows) => new Set(rows.map((row) => row.platform))).catch(() => new Set<string>()),
    ]);
    // Keep the snapshots coming while someone is looking at this month. The
    // range runs up to now, so the first (newest) row is the latest snapshot.
    if (startDate <= today && today <= endDate) syncSocialAccountsIfStale(snapshots[0]?.recorded_at ?? null);

    const zernio = past && !zernioConfigProblem();
    const [youtubeViews, instagramViews, facebookViews, tiktokViews, youtubeUploads, tiktokPosts] = await Promise.all([
        settle({name: "YouTube daily views", enabled: past && connected.has("youtube"), load: () => youtubeDailyViews(startDate, last)}, {}, notes),
        settle({name: "Instagram daily views", enabled: past && connected.has("instagram"), load: () => instagramDailyViews(startDate, last)}, {}, notes),
        settle({name: "Facebook daily views", enabled: past && connected.has("facebook"), load: () => facebookDailyViews(startDate, last)}, {}, notes),
        settle({name: "TikTok daily views (Zernio)", enabled: zernio, load: () => cached(`tiktok-views|${startDate}|${last}`, () => getTikTokDailyViews(startDate, last))}, {}, notes),
        settle({name: "YouTube uploads", enabled: past && connected.has("youtube"), load: () => youtubeUploadTimes(startDate, last)}, [] as string[], notes),
        settle({name: "TikTok posts (Zernio)", enabled: zernio, load: () => cached(`tiktok-posts|${startDate}|${last}`, () => listTikTokPublishTimes(startDate, last))}, [] as string[], notes),
    ]);
    const exactViews: DayCounts[] = [
        dailyViews("youtube", youtubeViews),
        dailyViews("instagram", instagramViews),
        dailyViews("facebook", facebookViews),
        dailyViews("tiktok", tiktokViews),
    ];
    const posts = maxPostCounts(
        countSharedPosts(shares, todayKey),
        countPublishTimes("youtube", youtubeUploads, todayKey),
        countPublishTimes("tiktok", tiktokPosts, todayKey),
    );
    return {
        byDate: buildAutoOrganic(posts, [...exactViews, viewsFromSnapshots(snapshots, todayKey)]),
        notes,
    };
}
