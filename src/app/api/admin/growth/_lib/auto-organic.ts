import "server-only";
import type {OrganicEntry} from "@/lib/growth-command-center";
import {todayKey} from "@/lib/growth-command-center";
import {loadSnapshots, syncSocialAccountsIfStale} from "@/lib/social/account-metrics";
import {buildAutoOrganic, countSharedPosts, viewsFromSnapshots, type ShareLogRow} from "@/lib/social/auto-log";
import {getFreshConnection} from "@/lib/social/oauth";
import {listConnectionRows} from "@/lib/social/store";
import {fetchRows} from "./rows";

// The automatic half of the daily organic log (merged with hand-entered rows
// in plan.ts): posts shared from /admin/story-videos, and views from the
// connected accounts. Nothing here is written to growth_marketing_daily_organic,
// so hand edits and auto numbers never overwrite each other.

export type AutoOrganic = {
    byDate: Record<string, OrganicEntry[]>;
    /** Why a source gave nothing, shown under the log. */
    notes: string[];
};

// YouTube Analytics is the one source with exact per-day views, so the month
// is fetched in one call and kept for an hour.
const youtubeCache = new Map<string, {at: number; views: Record<string, number>}>();

async function youtubeDailyViews(startDate: string, endDate: string) {
    const key = `${startDate}|${endDate}`;
    const cached = youtubeCache.get(key);
    if (cached && Date.now() - cached.at < 60 * 60_000) return cached.views;
    const connection = await getFreshConnection("youtube");
    const params = new URLSearchParams({ids: "channel==MINE", startDate, endDate, metrics: "views", dimensions: "day", sort: "day"});
    const response = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, {headers: {Authorization: `Bearer ${connection.accessToken}`}, cache: "no-store"});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message ?? `YouTube Analytics returned ${response.status}`);
    // Rows are [day, views]; YouTube's days are Pacific time.
    const views = Object.fromEntries((body.rows ?? []).map((row: [string, number]) => [row[0], Number(row[1]) || 0])) as Record<string, number>;
    youtubeCache.set(key, {at: Date.now(), views});
    return views;
}

export async function loadAutoOrganic(startDate: string, endDate: string, startIso: string, endIso: string): Promise<AutoOrganic> {
    const notes: string[] = [];
    const dayBefore = new Date(Date.parse(startIso) - 86_400_000).toISOString();
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
    const today = todayKey();
    if (startDate <= today && today <= endDate) syncSocialAccountsIfStale(snapshots[0]?.recorded_at ?? null);

    let youtube: Record<string, number> = {};
    if (connected.has("youtube") && startDate <= today) {
        try {
            youtube = await youtubeDailyViews(startDate, endDate < today ? endDate : today);
        } catch (error) {
            notes.push(`YouTube daily views: ${error instanceof Error ? error.message : "unavailable"}`);
        }
    }
    const exact = Object.fromEntries(Object.entries(youtube).map(([date, views]) => [date, {youtube: views}]));
    return {
        byDate: buildAutoOrganic(countSharedPosts(shares, todayKey), [exact, viewsFromSnapshots(snapshots, todayKey)]),
        notes,
    };
}
