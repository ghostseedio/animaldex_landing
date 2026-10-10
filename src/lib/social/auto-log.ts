import type {OrganicEntry, OrganicPlatform} from "@/lib/growth-command-center";

// The daily marketing log's automatic half. Posts shared from
// /admin/story-videos are counted from the share log, and views come from the
// connected accounts. Hand-entered numbers are kept separately and merged on
// read:
//   posts: hand-entered posts are posts made elsewhere, so the two are added;
//   views: both are the account's views for the day, so a hand-entered number
//          (e.g. read off TikTok Studio) wins and auto fills the gaps.

export type ShareLogRow = {platform: string; mode: string; status: string; updated_at: string};
export type ViewSnapshot = {platform: string; views: number | null; recorded_at: string};

const PLATFORMS = new Set<OrganicPlatform>(["tiktok", "instagram", "youtube", "facebook", "x"]);

function isPlatform(value: string): value is OrganicPlatform {
    return PLATFORMS.has(value as OrganicPlatform);
}

type DayCounts = Record<string, Partial<Record<OrganicPlatform, number>>>;

function add(counts: DayCounts, date: string, platform: OrganicPlatform, value: number) {
    const day = (counts[date] ??= {});
    day[platform] = (day[platform] ?? 0) + value;
}

/** Published (not draft) shares per day and platform, dated by when they went live. */
export function countSharedPosts(rows: ShareLogRow[], dayKey: (date: Date) => string): DayCounts {
    const counts: DayCounts = {};
    for (const row of rows) {
        if (row.status !== "published" || row.mode !== "post" || !isPlatform(row.platform)) continue;
        add(counts, dayKey(new Date(row.updated_at)), row.platform, 1);
    }
    return counts;
}

function previousDay(date: string) {
    const time = Date.parse(`${date}T00:00:00Z`) - 86_400_000;
    return new Date(time).toISOString().slice(0, 10);
}

/**
 * Daily views from lifetime-total snapshots: the last snapshot of each day
 * minus the last snapshot of the day before. A day whose previous day has no
 * snapshot is skipped rather than given several days' views at once.
 */
export function viewsFromSnapshots(rows: ViewSnapshot[], dayKey: (date: Date) => string): DayCounts {
    const lastPerDay = new Map<string, {time: number; views: number}>();
    for (const row of rows) {
        if (!isPlatform(row.platform) || row.views == null || !Number.isFinite(Number(row.views))) continue;
        const time = Date.parse(row.recorded_at);
        const key = `${row.platform}|${dayKey(new Date(time))}`;
        const current = lastPerDay.get(key);
        if (!current || time > current.time) lastPerDay.set(key, {time, views: Number(row.views)});
    }
    const counts: DayCounts = {};
    lastPerDay.forEach((today, key) => {
        const [platform, date] = key.split("|") as [OrganicPlatform, string];
        const yesterday = lastPerDay.get(`${platform}|${previousDay(date)}`);
        // A negative change means a deleted video or a recount, not negative views.
        if (yesterday && today.views >= yesterday.views) add(counts, date, platform, today.views - yesterday.views);
    });
    return counts;
}

/** Auto entries per day: shared posts plus views (exact daily views win over snapshot deltas). */
export function buildAutoOrganic(posts: DayCounts, views: DayCounts[]): Record<string, OrganicEntry[]> {
    const byDate: Record<string, OrganicEntry[]> = {};
    const dates = new Set([...Object.keys(posts), ...views.flatMap((source) => Object.keys(source))]);
    dates.forEach((date) => {
        const entries: OrganicEntry[] = [];
        PLATFORMS.forEach((platform) => {
            const postCount = posts[date]?.[platform] ?? 0;
            const viewCount = views.map((source) => source[date]?.[platform]).find((value) => value != null) ?? 0;
            if (postCount > 0 || viewCount > 0) entries.push({platform, posts: postCount, views: viewCount});
        });
        if (entries.length) byDate[date] = entries;
    });
    return byDate;
}

/** One day's log as the dashboard shows it: hand-entered and auto entries merged per platform. */
export function mergeOrganicEntries(manual: OrganicEntry[], auto: OrganicEntry[]): OrganicEntry[] {
    const merged = new Map<OrganicPlatform, OrganicEntry>();
    for (const entry of manual) merged.set(entry.platform, {...entry});
    for (const entry of auto) {
        const existing = merged.get(entry.platform);
        if (!existing) merged.set(entry.platform, {...entry});
        else merged.set(entry.platform, {platform: entry.platform, posts: existing.posts + entry.posts, views: existing.views > 0 ? existing.views : entry.views});
    }
    return Array.from(merged.values());
}
