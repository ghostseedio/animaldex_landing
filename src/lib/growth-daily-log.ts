import "server-only";
import {loadMonthActuals} from "@/app/api/admin/growth/_lib/plan";
import {loadMarketingRows, writeMarketingRow} from "@/app/api/admin/growth/_lib/queries";
import {previousDateKey, todayKey} from "@/lib/growth-command-center";

// The growth log (growth_marketing_daily), filled by a nightly timer instead
// of by hand (16 Nov 2026). The table had no row since 14 Sep 2026 because
// the admin page merges the automatic sources (YouTube Analytics, Instagram
// and Facebook insights, TikTok through Zernio, Search Console, the blog) at
// read time and never wrote them down: close the page and the day's numbers
// only exist as long as each source still answers (Instagram asks one day at
// a time, Zernio has nothing before 20 Oct 2026, X only has snapshot deltas).
// This run writes the finished days down, so the log is a record, not a view:
// POST /api/cron/growth-daily-log (scripts/install-growth-daily-log-timer.sh).
//
// Rules: only finished Jakarta days (yesterday and the two before, so a source
// that trails by a day or two settles), only numbers a source covers
// (knownByDate), never over a hand-entered row (updated_by is not ours), and
// ad_spend 0: no ads run, and the currency-aware spend table
// (growth_marketing_daily_spend) is where a paid day belongs anyway.

export const GROWTH_LOG_WRITER = "auto-fill";
/** Finished days each run writes: yesterday and the two before it. */
export const GROWTH_LOG_DAYS = 3;

export type GrowthLogWrite = {date: string; socialViews: number | null; searchClicks: number | null; shortVideos: number; seoPages: number};

export type GrowthLogResult = {ok: true; written: GrowthLogWrite[]; skipped: Array<{date: string; reason: string}>; notes: string[]};

/** The finished Jakarta days to write, newest first. */
export function finishedDays(today = todayKey(), count = GROWTH_LOG_DAYS) {
    const days: string[] = [];
    let cursor = today;
    for (let index = 0; index < count; index += 1) {
        cursor = previousDateKey(cursor);
        days.push(cursor);
    }
    return days;
}

/** The row for one day from the month's merged numbers, or null when nothing about the day is known yet. */
export function rowForDay(actuals: Awaited<ReturnType<typeof loadMonthActuals>>, date: string): GrowthLogWrite | null {
    const known = actuals.knownByDate[date];
    if (!known) return null;
    const socialViews = known.socialViews ? Math.round(Number(actuals.socialDaily[date] ?? 0)) : null;
    const searchClicks = known.searchClicks ? Math.round(Number(actuals.searchDaily[date] ?? 0)) : null;
    if (socialViews === null && searchClicks === null) return null;
    return {date, socialViews, searchClicks, shortVideos: Math.round(Number(actuals.shortVideoDaily[date] ?? 0)), seoPages: Math.round(Number(actuals.seoDaily[date] ?? 0))};
}

export async function runGrowthDailyLog(now = new Date()): Promise<GrowthLogResult> {
    const days = finishedDays(todayKey(now));
    const months = Array.from(new Set(days.map((day) => day.slice(0, 7))));
    const existing = new Map((await loadMarketingRows(days[days.length - 1], days[0])).map((row) => [row.date, row]));
    const written: GrowthLogWrite[] = [];
    const skipped: Array<{date: string; reason: string}> = [];
    const notes = new Set<string>();
    for (const month of months) {
        const actuals = await loadMonthActuals(month);
        for (const note of actuals.autoOrganicNotes) notes.add(note);
        for (const date of days.filter((day) => day.startsWith(month))) {
            const current = existing.get(date);
            if (current && current.updated_by !== GROWTH_LOG_WRITER) {
                skipped.push({date, reason: `hand-entered by ${current.updated_by ?? "someone"}; left alone`});
                continue;
            }
            const row = rowForDay(actuals, date);
            if (!row) {
                skipped.push({date, reason: "no source covers the day yet"});
                continue;
            }
            await writeMarketingRow({
                date,
                social_views: row.socialViews,
                search_clicks: row.searchClicks,
                ad_spend: "0.00",
                paid_users: current?.paid_users ?? 0,
                short_videos: row.shortVideos,
                seo_pages: row.seoPages,
                notes: `Auto-filled ${now.toISOString().slice(0, 16)}Z from the connected sources`,
                updated_at: now.toISOString(),
                updated_by: GROWTH_LOG_WRITER
            });
            written.push(row);
        }
    }
    console.info(`[growth-daily-log] wrote ${written.length} day(s)${skipped.length ? `, skipped ${skipped.map((entry) => entry.date).join(", ")}` : ""}`);
    return {ok: true, written, skipped, notes: Array.from(notes)};
}
