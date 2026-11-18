/**
 * The public event log read far enough for a replay (V2 replay): `/api/ark/events?since=` answers at most about a
 * thousand rows from `since` on with `more` when it was cut, so the newest events (the ones a replay is asked for) are
 * not in a single read of the last 30 days. This follows `more` from the last row's time until the log is whole (or
 * `stopAt` says the wanted event is in), keeping each row once.
 *
 * The public read only: an event the server has not released yet is not in it (no look-ahead, decision 389).
 * Browser or Node (`fetch`); `base` "" in the page.
 */

type Row = {id?: unknown; at?: unknown};

export const ARK_EVENT_LOG_DAYS = 30;
/** Reads at most (a 30-day log is about 15 of them at the launch's pace). */
const MAX_READS = 40;

export async function readArkEventLog(base: string, options: {sinceMs?: number; stopAt?: (rows: readonly Row[]) => boolean; log?: (line: string) => void; fetcher?: typeof fetch} = {}): Promise<{events: unknown[]; whole: boolean; skipped: string[]}> {
    const get = options.fetcher ?? fetch;
    const byId = new Map<string, Row>();
    const skipped: string[] = [];
    let since = new Date(options.sinceMs ?? Date.now() - ARK_EVENT_LOG_DAYS * 86_400_000).toISOString();
    let whole = false;
    for (let read = 0; read < MAX_READS; read++) {
        const response = await get(`${base}/api/ark/events?since=${encodeURIComponent(since)}`, {cache: "no-store"});
        if (!response.ok) break;
        const body = await response.json() as {events?: unknown; more?: unknown};
        const rows: Row[] = Array.isArray(body.events) ? body.events.filter((row): row is Row => Boolean(row) && typeof row === "object") : [];
        const before = byId.size;
        for (const row of rows) byId.set(String(row.id), row);
        if (body.more !== true || !rows.length) {
            whole = true;
            break;
        }
        if (options.stopAt?.(rows)) break;
        const last = String(rows[rows.length - 1].at ?? "");
        const lastMs = Date.parse(last);
        if (!Number.isFinite(lastMs)) break;
        // (The route reads from the whole minute; a minute holding more rows than one read answers, the launch's
        // backfill, would be read for ever: on to the next minute, and said.)
        if (byId.size === before) {
            const next = new Date(Math.floor(lastMs / 60_000) * 60_000 + 60_000).toISOString();
            skipped.push(last);
            options.log?.(`event log: the minute of ${last} holds more rows than one read answers; on from ${next}`);
            since = next;
        } else since = last;
    }
    const events = Array.from(byId.values()).sort((a, b) => Date.parse(String(a.at)) - Date.parse(String(b.at)) || Number(a.id) - Number(b.id));
    return {events, whole, skipped};
}
