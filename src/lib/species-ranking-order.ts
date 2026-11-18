/**
 * Ranked captures order, the same on iOS (`DiscoverFeedItem.isRankedAhead`),
 * Android and the server (`discover_feed_v1` ORDER BY and
 * `count_discover_ranking_collectors_ahead_of_capture`, migration
 * 20261011130000): total progression XP (so level, then XP), then stat total,
 * then capture grade, then newest, then capture id descending (GRADING-5: the same final
 * tiebreak as discover_ranking_page_v1). Endorsement `score` no longer ranks. Used only when the
 * server-ranked page is unavailable.
 */

export const SPECIES_RANKING_ORDER = "total_progression_xp.desc,stat_total.desc,capture_grade.desc,capture_created_at.desc";

export type SpeciesRankingOrderRow = {
    capture_id?: string | null;
    total_progression_xp?: number | null;
    stat_total?: number | null;
    capture_grade?: number | null;
    capture_created_at?: string | null;
};

function numberOrZero(value: number | null | undefined) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function timeOrZero(value: string | null | undefined) {
    const time = value ? Date.parse(value) : NaN;
    return Number.isFinite(time) ? time : 0;
}

/** A sort comparator: negative when `left` ranks ahead of `right`. */
export function compareSpeciesRankingRows(left: SpeciesRankingOrderRow, right: SpeciesRankingOrderRow) {
    return numberOrZero(right.total_progression_xp) - numberOrZero(left.total_progression_xp)
        || numberOrZero(right.stat_total) - numberOrZero(left.stat_total)
        || numberOrZero(right.capture_grade) - numberOrZero(left.capture_grade)
        || timeOrZero(right.capture_created_at) - timeOrZero(left.capture_created_at)
        || compareIdsDescending(left.capture_id, right.capture_id);
}

/** Byte order, like Postgres uuid comparison (not locale order). */
function compareIdsDescending(left: string | null | undefined, right: string | null | undefined) {
    const a = (left ?? "").toLowerCase();
    const b = (right ?? "").toLowerCase();
    return a === b ? 0 : a < b ? 1 : -1;
}
