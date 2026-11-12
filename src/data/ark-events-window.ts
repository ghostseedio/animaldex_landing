import "server-only";
import type {ArkTrendWindow} from "@/lib/ark-species-trend";
import {getSupabaseHeaders, getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";

/**
 * The Ark's event log over the last few days, read once per process per
 * window for every species page (SEO lane S3): `voyage_events_since_v1`, the
 * same public read as /api/ark/events (kinds, times, species, public animals,
 * never a user), with the public key, so nothing on a page is personal.
 *
 * The window starts at a UTC midnight, so every page built on one day asks the
 * same question and shares Next's fetch cache; each page of the log is cached
 * for `revalidate` seconds. When the log is longer than `MAX_PAGES` pages the
 * window is marked incomplete and the pages say nothing about the trend.
 */

const PAGE = 500;
const MAX_PAGES = 30;
const DAY_MS = 86_400_000;

async function readPage(since: string, revalidate: number): Promise<{events: unknown[]; next: string | null; more: boolean} | null> {
    const url = getSupabaseUrl();
    const key = getSupabasePublicKey();
    if (!url || !key) return null;
    try {
        const response = await fetch(`${url}/rest/v1/rpc/voyage_events_since_v1`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            body: JSON.stringify({p_since: since, p_limit: PAGE}),
            next: {revalidate, tags: ["ark-events-window"]}
        });
        if (!response.ok) return null;
        const body = (await response.json().catch(() => null)) as {events?: unknown; next_since?: unknown; more?: unknown} | null;
        if (!body || !Array.isArray(body.events)) return null;
        return {events: body.events, next: typeof body.next_since === "string" ? body.next_since : null, more: body.more === true};
    } catch {
        return null;
    }
}

async function loadWindow(days: number, revalidate: number, now: number): Promise<ArkTrendWindow | null> {
    const midnight = Math.floor(now / DAY_MS) * DAY_MS;
    const since = new Date(midnight - days * DAY_MS).toISOString();
    const events: unknown[] = [];
    let cursor = since;
    for (let page = 0; page < MAX_PAGES; page++) {
        const read = await readPage(cursor, revalidate);
        if (!read) return page === 0 ? null : {since, until: new Date(now).toISOString(), complete: false, events};
        events.push(...read.events);
        if (!read.more) return {since, until: new Date(now).toISOString(), complete: true, events};
        if (!read.next || read.next === cursor) break;
        cursor = read.next;
    }
    return {since, until: new Date(now).toISOString(), complete: false, events};
}

const memo = new Map<string, {at: number; promise: Promise<ArkTrendWindow | null>}>();

/** The last `days` whole days of the log up to now, or null when it cannot be read. */
export function readArkEventsWindow(days = 7, revalidate = 86_400): Promise<ArkTrendWindow | null> {
    const now = Date.now();
    const key = `${days}|${Math.floor(now / DAY_MS)}`;
    const hit = memo.get(key);
    if (hit && now - hit.at < revalidate * 1000) return hit.promise;
    memo.clear();
    const promise = loadWindow(days, revalidate, now).then((window) => {
        if (!window) memo.delete(key);
        return window;
    });
    memo.set(key, {at: now, promise});
    return promise;
}
