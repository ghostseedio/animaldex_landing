/**
 * The Discover session feed, `discover_feed_ranked_v1` (migration 20261128170000).
 *
 * One feed session is one `p_as_of` and one seed. The server ranks against the marks
 * made BEFORE `p_as_of`, so the seen marks the reader sends while scrolling never move
 * the list; a page is "the next `p_limit` captures after the cursor"; the list holds
 * only posts not seen before the session, so a short or empty page is the END of the
 * feed. The cursor carries the session (`asOf`) from page to page; a first page starts
 * a new one.
 *
 * Everything here is pure so it can be tested without a database.
 */

/**
 * The session starts a few seconds in the past. The server clamps `p_as_of` to its
 * own clock; a server clock that is behind this one would otherwise give a moving
 * boundary and the reader's own marks would count again.
 */
export const DISCOVER_SESSION_CLOCK_MARGIN_MS = 5_000;

/** A seen activity card is eligible again once its novelty has recovered to this (14 days after it was seen). */
export const DISCOVER_ACTIVITY_MIN_NOVELTY = "0.012";

/** One activity card after this many captures in the ranked feed. */
export const DISCOVER_RANKED_CAPTURES_PER_ACTIVITY = 6;

export function newDiscoverSessionAsOf(now: number = Date.now()): string {
    return new Date(now - DISCOVER_SESSION_CLOCK_MARGIN_MS).toISOString();
}

/** A session timestamp read back from a request: an ISO date that is not in the future, or null. */
export function parseDiscoverSessionAsOf(value: string | null | undefined, now: number = Date.now()): string | null {
    const raw = value?.trim();
    if (!raw) return null;
    const time = Date.parse(raw);
    if (!Number.isFinite(time) || time > now + 60_000) return null;
    return new Date(time).toISOString();
}

export type DiscoverRankedFeedArgs = {
    p_seed: string;
    p_limit: number;
    p_as_of: string;
    p_scope: "recommended";
    p_after_capture_id?: string;
};

export function discoverRankedFeedArgs(input: {asOf: string; limit: number; afterCaptureId?: string | null}): DiscoverRankedFeedArgs {
    return {
        // The session timestamp is unique per session, so it is also the seed: every refresh deals a new jitter.
        p_seed: input.asOf,
        p_limit: Math.min(80, Math.max(1, Math.floor(input.limit))),
        p_as_of: input.asOf,
        p_scope: "recommended",
        ...(input.afterCaptureId ? {p_after_capture_id: input.afterCaptureId} : {})
    };
}

/** A page shorter than the number asked for is the end of the feed (server rows, before any local filtering). */
export function rankedFeedHasMore(receivedRows: number, requested: number): boolean {
    return receivedRows >= requested && receivedRows > 0;
}

/**
 * Captures in the server's order with the activity cards slotted in, one after every
 * `every` captures (newest activity first). Leftover activity goes after the last
 * capture only when the feed has ended, never in front of captures still to come.
 */
export function composeRankedTimeline<T extends {date: string}>(
    captures: T[],
    activity: T[],
    options: {every?: number; feedEnded: boolean}
): T[] {
    const every = Math.max(1, options.every ?? DISCOVER_RANKED_CAPTURES_PER_ACTIVITY);
    const queue = [...activity].sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
    const merged: T[] = [];
    captures.forEach((capture, index) => {
        merged.push(capture);
        if ((index + 1) % every === 0 && queue.length > 0) merged.push(queue.shift() as T);
    });
    if (options.feedEnded) merged.push(...queue);
    else if (captures.length === 0) merged.push(...queue);
    return merged;
}
