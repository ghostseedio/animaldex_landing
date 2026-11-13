import {topicPolicyProblems} from "@/lib/blog-generator/topic-policy";

// The blog's first topic source since 16 Nov 2026, pure: what people already
// type into Google and find us for, from Search Console (the admin's
// search-console.ts loadOpportunityQueries). A query we show up for at
// position 4–30 with real impressions is demand we have measured, not guessed;
// a problem-led page that answers it directly (the topic policy's third kind)
// can win the click. The auto-generator tries this lane before the radar, the
// lesson queue and the hand-written SEO queue (auto-generate.ts), and hands
// Claude the query as the focus so the title and angle are written for it.

export type OpportunityQuery = {
    query: string;
    impressions: number;
    clicks: number;
    /** Average position over the window, one decimal. */
    position: number;
    /** The page that ranks for it now (a pathname), when Search Console says. */
    page: string | null;
};

/** Days of Search Console data the lane looks at. */
export const SEARCH_CONSOLE_WINDOW_DAYS = 28;
/** A query needs at least this many impressions in the window to be worth an article. */
export const SEARCH_CONSOLE_MIN_IMPRESSIONS = 50;
/** Positions a new page can realistically move: not already top 3, not hopeless. */
export const SEARCH_CONSOLE_POSITION_RANGE = {min: 4, max: 30} as const;

/** Brand searches and one-word queries carry no problem to answer. */
const BRAND = /animal\s?dex/i;

/** The id the run log stores (detail.gscQuery), so a query is written once. */
export function searchConsoleTopicId(query: string) {
    return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True when the query is one the lane may write for: demand in range, not brand, not already answered by a blog post, allowed by the topic policy. */
export function isWritableQuery(row: OpportunityQuery) {
    const query = row.query.trim();
    if (query.split(/\s+/).length < 3) return false;
    if (BRAND.test(query)) return false;
    if (row.impressions < SEARCH_CONSOLE_MIN_IMPRESSIONS) return false;
    if (row.position < SEARCH_CONSOLE_POSITION_RANGE.min || row.position > SEARCH_CONSOLE_POSITION_RANGE.max) return false;
    // A blog post already ranks for it: the next post would compete with our own.
    if (row.page && /^\/(?:[a-z]{2}\/)?blog\//.test(row.page)) return false;
    return topicPolicyProblems({title: query, angle: "", hook: "", primaryKeyword: query}).length === 0;
}

/**
 * The best query not yet written: most impressions first, then the lower
 * click-through (the page that ranks is not answering it), then the better
 * position. Null when nothing qualifies.
 */
export function pickSearchConsoleTopic(rows: readonly OpportunityQuery[], written: ReadonlySet<string>): OpportunityQuery | null {
    const candidates = rows.filter((row) => isWritableQuery(row) && !written.has(searchConsoleTopicId(row.query)));
    candidates.sort((a, b) => b.impressions - a.impressions || (a.clicks / Math.max(1, a.impressions)) - (b.clicks / Math.max(1, b.impressions)) || a.position - b.position);
    return candidates[0] ?? null;
}

/** The focus the generator's topic stage gets: the query, its numbers, and the shape the page must take. */
export function searchConsoleFocus(row: OpportunityQuery) {
    const where = row.page ? ` Our page ${row.page} ranks for it now and is not answering it well enough to win the click.` : "";
    return `A PROBLEM-LED SEARCH PAGE for the exact phrase people already search on Google: "${row.query}" (${row.impressions.toLocaleString("en-US")} impressions, ${row.clicks.toLocaleString("en-US")} clicks, average position ${row.position} in Search Console over the last ${SEARCH_CONSOLE_WINDOW_DAYS} days).${where} Use that phrase as the primary keyword and answer the search directly and completely first (the usual answer, in plain words, with the facts checked), then the animals' takes, each built on a real, sourced behaviour of its species. The title must read as the answer to that search. whyNow must cite Search Console with these numbers.`;
}
