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

/** PostgREST: the ranked function is not on the server yet (the migration is not applied). */
export function isRankedFeedFunctionMissing(error: {code?: string | null; message?: string | null; status?: number | null} | null | undefined): boolean {
    if (!error) return false;
    return error.code === "PGRST202"
        || error.code === "42883"
        || error.status === 404
        || /could not find the function/i.test(error.message ?? "");
}

export type RankedPagePlan = {
    /** The session this page belongs to. */
    asOf: string;
    /** The cursor to ask the server for; null for a first page. */
    afterCaptureId: string | null;
    /** True when the page starts a new session (no cursor, or a cursor that carries no session). */
    startsSession: boolean;
};

/**
 * A page continues its session only when the cursor carries both the last capture and the session.
 * A cursor without a session (an old page, a hand-built URL) belongs to no ranked list, so it is
 * not sent as a cursor: the page is the first page of a new session.
 */
export function planRankedPage(
    cursor: {afterCaptureId?: string | null; asOf?: string | null} | null,
    now: number = Date.now()
): RankedPagePlan {
    const asOf = parseDiscoverSessionAsOf(cursor?.asOf, now);
    const afterCaptureId = cursor?.afterCaptureId?.trim() || null;
    if (cursor && asOf && afterCaptureId) return {asOf, afterCaptureId, startsSession: false};
    return {asOf: newDiscoverSessionAsOf(now), afterCaptureId: null, startsSession: true};
}

export const RANKED_MISSING = Symbol("ranked-feed-function-missing");

/**
 * One ranked call. A missing function returns RANKED_MISSING (the caller uses the shipped feed);
 * any other error is tried once more and then thrown (the error state): a ranked cursor must never be
 * continued by the shipped feed.
 */
export async function callRankedFeedWithOneRetry<T>(
    call: () => Promise<{data: T | null; error: {code?: string | null; message?: string | null; status?: number | null} | null}>,
    options: {retryDelayMs?: number} = {}
): Promise<T | typeof RANKED_MISSING> {
    const delay = options.retryDelayMs ?? 400;
    let lastError: {message?: string | null} | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const {data, error} = await call();
        if (!error) return (data ?? ([] as unknown as T));
        if (isRankedFeedFunctionMissing(error)) return RANKED_MISSING;
        lastError = error;
        if (attempt === 0 && delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
    throw new Error(`discover_feed_ranked_v1 failed: ${lastError?.message ?? "unknown error"}`);
}

/**
 * A cursor page that came back short means the session's list is exhausted. The feed then starts one
 * new session and appends its first page after this one (rows already on this page are not repeated).
 * The feed ends only when the new session has nothing either (`hasMore` false).
 */
export function appendRenewedRankedPage<T>(
    first: T[],
    renewed: T[],
    limit: number,
    idOf: (row: T) => string | null
): {rows: T[]; hasMore: boolean} {
    const have = new Set(first.map(idOf));
    return {
        rows: [...first, ...renewed.filter((row) => !have.has(idOf(row)))],
        hasMore: rankedFeedHasMore(renewed.length, limit)
    };
}
