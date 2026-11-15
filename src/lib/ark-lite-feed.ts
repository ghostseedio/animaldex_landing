/**
 * Ark Lite's "Latest on the Ark" (owner, 2026-11-15: "where's the real-time-ness feel, e.g. real time logs like Ark
 * 3D gets"): a running record on the page itself, newest first, that keeps coming while it is open. Pure: what the
 * lines are; the page (`ark-scene/lite/lite-view.ts`) reads and draws them.
 *
 * - At once, with no request: the snapshot's newest arrivals and births (each animal's `arrived_at`), so the page
 *   never opens on an empty log.
 * - Then the server's record (`/api/ark/events?since=`): from an hour back, then every `ARK_LITE_FEED_POLL_MS` from
 *   the newest line read: meals, pairs, clutches, hatchings, deaths, as the 3D Ark's log says them.
 * - An animal's arrival or birth is one line however it came (the snapshot's, or the record's).
 * - Lines of the same kind and species close together fold into one with a count ("3 Mallards were born").
 *
 * Privacy: as the 3D log (`ark-live-log.ts`): species only, never a bringer.
 */

import type {ArkSnapshot} from "@/ark-scene/types";
import type {ArkEvent} from "@/lib/ark-life";
import {arkLiveArrivalsFromSnapshot, arkLiveServerItems, type ArkLiveItem} from "@/lib/ark-live-log";

/** A line read: what happened, when, and its species' icon. */
export type ArkLiteFeedEntry = {id: string; at: string; item: ArkLiveItem; slug: string | null};

/** A line drawn: entries folded together (the newest's id and time), and the ids folded in. */
export type ArkLiteFeedLine = ArkLiteFeedEntry & {ids: string[]};

/** Entries kept (newest first). */
export const ARK_LITE_FEED_KEEP = 200;
/** The snapshot's newest arrivals and births read at once. */
export const ARK_LITE_FEED_SEED = 40;
/** Lines shown folded, and once "Show more" is tapped. */
export const ARK_LITE_FEED_SHORT = 6;
export const ARK_LITE_FEED_LONG = 30;
/** The record is read again this often while the page shows (the read is cached 30 s by the server). */
export const ARK_LITE_FEED_POLL_MS = 30_000;
/** The first read reaches this far back (an hour is about 12 KB on a quiet Ark). */
export const ARK_LITE_FEED_BACK_MS = 60 * 60_000;
/** Lines of the same kind and species this close together fold into one. */
export const ARK_LITE_FEED_FOLD_MS = 10 * 60_000;

/** One entry per animal's coming aboard; every other line by its own id. */
function dedupeKey(entry: ArkLiteFeedEntry): string {
    const {kind, focus} = entry.item;
    if ((kind === "arrival" || kind === "birth") && focus.animalId) return `animal:${focus.animalId}`;
    return `id:${entry.id}`;
}

function time(at: string): number {
    const value = Date.parse(at);
    return Number.isFinite(value) ? value : 0;
}

/** The snapshot's newest arrivals and births. */
export function arkLiteFeedSeed(snapshot: ArkSnapshot | null, limit = ARK_LITE_FEED_SEED): ArkLiteFeedEntry[] {
    if (!snapshot) return [];
    const newest = [...snapshot.animals]
        .filter((animal) => Number.isFinite(Date.parse(animal.arrived_at)))
        .sort((a, b) => b.arrived_at.localeCompare(a.arrived_at) || a.id.localeCompare(b.id))
        .slice(0, limit);
    const items = arkLiveArrivalsFromSnapshot(newest);
    return newest.map((animal, index) => ({id: items[index].id, at: animal.arrived_at, item: items[index], slug: animal.model_slug || null}));
}

/** The record's events as entries (a litter is one, at its first young's time). */
export function arkLiteFeedFromEvents(events: readonly ArkEvent[]): ArkLiteFeedEntry[] {
    const byId = new Map(events.map((event) => [String(event.id), event]));
    return arkLiveServerItems(events).map((item) => {
        const event = byId.get(String(item.id));
        const slug = event?.animal?.model_slug || event?.other?.model_slug || null;
        return {id: String(item.id), at: event?.at ?? new Date(0).toISOString(), item, slug};
    });
}

/** Entries together, newest first, each once (the newer reading of a line wins), at most `keep`. */
export function arkLiteFeedMerge(current: readonly ArkLiteFeedEntry[], incoming: readonly ArkLiteFeedEntry[], keep = ARK_LITE_FEED_KEEP): ArkLiteFeedEntry[] {
    const byKey = new Map<string, ArkLiteFeedEntry>();
    // The record's reading of an arrival is the truer one (its own time); either way, once.
    for (const entry of current) byKey.set(dedupeKey(entry), entry);
    for (const entry of incoming) {
        const key = dedupeKey(entry);
        const had = byKey.get(key);
        if (!had || had.id.startsWith("new:")) byKey.set(key, entry);
    }
    return Array.from(byKey.values()).sort((a, b) => time(b.at) - time(a.at) || b.id.localeCompare(a.id)).slice(0, keep);
}

/** The lines to draw: neighbours of the same kind and species within `ARK_LITE_FEED_FOLD_MS` as one, with a count. */
export function arkLiteFeedLines(entries: readonly ArkLiteFeedEntry[], limit = ARK_LITE_FEED_LONG): ArkLiteFeedLine[] {
    const lines: ArkLiteFeedLine[] = [];
    let last: ArkLiteFeedLine | null = null;
    // The oldest entry folded into the last line so far: the window runs from there (a chain of near ones folds).
    let edge = 0;
    for (const entry of entries) {
        const at = time(entry.at);
        if (last && last.item.key === entry.item.key && edge - at <= ARK_LITE_FEED_FOLD_MS && last.item.hearts == null && entry.item.hearts == null) {
            last.item = {...last.item, count: last.item.count + entry.item.count};
            last.ids.push(entry.id);
            edge = at;
            continue;
        }
        if (lines.length >= limit) break;
        last = {...entry, item: {...entry.item}, ids: [entry.id]};
        edge = at;
        lines.push(last);
    }
    return lines;
}
