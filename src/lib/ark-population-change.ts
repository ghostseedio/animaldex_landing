/**
 * Who is aboard, biggest first, and how each count changed in the last 24 hours (owner, 2026-11-12: "it should
 * represent populations only in order of biggest first", "show population % changes in red and green ... like
 * past 24 hours"). Shared by /ark's population overlay (`ark-population-hud.tsx`) and the apps' embed
 * (`src/ark-scene/live/bars-view.ts`).
 *
 * The count 24 hours ago comes from the server's event log (`/api/ark/events?since=`, `voyage_events_since_v1`),
 * never from a table of its own: the count then is the count now, minus the animals that came aboard (arrivals and
 * births) and plus the ones that left (eaten, died of old age, starved) since then. Worked out once per page load
 * and kept for a few minutes per device. When the read could not give the whole window (`more` with no way past
 * it), nothing is said: no change is better than a wrong one.
 *
 * Pure but for `readArkPopulationThen`, which is handed its fetch and storage.
 */

import type {ArkAnimal, ArkIsland, ArkSnapshot} from "@/ark-scene/types";
import {arkIslandOf, arkTwoIslands} from "@/lib/ark-islands";
import {arkEventRows} from "@/lib/ark-life";
import {arkDeltaText} from "@/lib/ark-live-bars";
import {arkPopulation, arkSpeciesKey, type ArkSpeciesRow} from "@/lib/ark-population";

/** The window the change is over. */
export const ARK_CHANGE_WINDOW_MS = 24 * 3_600_000;
/** Under this many animals 24 hours ago a change is said as a count ("+1"), not a percentage ("+100%"). */
export const ARK_CHANGE_PERCENT_FROM = 3;
/** How long a reading is kept per device before the log is read again. */
export const ARK_CHANGE_CACHE_MS = 5 * 60_000;
export const ARK_CHANGE_CACHE_KEY = "ark.hud.change";
/** The window's start is rounded down to this, so readers within a few minutes ask the same question (and cache). */
const SINCE_STEP_MS = 5 * 60_000;
/**
 * Reads of the log at most. The route follows up to five pages itself; past that (`more`) the next read starts
 * at the last row seen. A burst of more rows in one minute than the route pages through cannot be read past (the
 * route starts at the minute), and the change is then left unsaid.
 */
export const ARK_CHANGE_MAX_READS = 2;

/** What the panel shows: the island loaded, or both islands. */
export type ArkChangeScope = ArkIsland | "both";

/**
 * Each species' count 24 hours ago (`[wild, town]`), keyed as the panel's rows are (`arkSpeciesKey`). A species
 * not in it had none then.
 */
export type ArkPopulationThen = {at: number; since: string; then: Record<string, [number, number]>};

/** A count's change over the window: `base` is the count then. */
export type ArkChange = {delta: number; base: number};

// MARK: Biggest first

/** Every species aboard (breeds counted as their kind, A1), the biggest first; ties by name. */
export function arkRankedSpecies(snapshot: ArkSnapshot | null): ArkSpeciesRow[] {
    return arkPopulation(snapshot)
        .regions.flatMap((group) => group.species)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

// MARK: The count then

type Counts = Map<string, [number, number]>;

function bump(counts: Counts, key: string, island: ArkIsland, by: number) {
    const pair = counts.get(key) ?? [0, 0];
    pair[island === "town" ? 1 : 0] += by;
    counts.set(key, pair);
}

/** Each species' count now, on each island. */
export function arkCountsByIsland(snapshot: ArkSnapshot): Counts {
    const two = arkTwoIslands(snapshot);
    const counts: Counts = new Map();
    for (const animal of snapshot.animals) bump(counts, arkSpeciesKey(animal), arkIslandOf(animal, two), 1);
    return counts;
}

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The kinds that bring an animal aboard, and the ones whose `animal` leaves (a meal's prey is its `other`). */
const COMES = new Set(["arrival", "birth"]);
const LEAVES = new Set(["eaten", "death_old", "starved"]);

/**
 * The change the log's rows make to each species on each island: +1 for every animal that came aboard, −1 for every
 * one that left, an animal counted once however many rows name it (a meal and its `eaten` row are one departure),
 * and one that came and left inside the window counted as neither.
 */
export function arkEventsNet(raw: unknown, snapshot: ArkSnapshot): Counts {
    const two = arkTwoIslands(snapshot);
    const aboard = new Map(snapshot.animals.map((animal) => [animal.id, animal]));
    // A look's kind (A1), from the animals aboard: a breed that left counts in its kind's row.
    const kindOfLook = new Map<string, string>();
    for (const animal of snapshot.animals) if (!kindOfLook.has(animal.species_profile_id)) kindOfLook.set(animal.species_profile_id, arkSpeciesKey(animal));
    const who = (value: unknown, row: Record<string, unknown>): {id: string; key: string; island: ArkIsland} | null => {
        const animal = record(value);
        const id = text(animal?.id);
        if (!animal || !id) return null;
        const known = aboard.get(id);
        if (known) return {id, key: arkSpeciesKey(known), island: arkIslandOf(known, two)};
        const species = text(animal.species_profile_id) ?? text(row.species_profile_id);
        const slug = text(animal.model_slug);
        const key = (species && kindOfLook.get(species)) || species || (slug ? `slug:${slug}` : null);
        if (!key) return null;
        return {id, key, island: arkIslandOf({island: text(animal.island) as ArkAnimal["island"], area: text(animal.area) as ArkAnimal["area"]}, two)};
    };
    const came = new Map<string, {key: string; island: ArkIsland}>();
    const left = new Map<string, {key: string; island: ArkIsland}>();
    for (const item of arkEventRows(raw)) {
        const row = record(item);
        const kind = text(row?.kind);
        if (!row || !kind) continue;
        const animal = COMES.has(kind) || LEAVES.has(kind) ? who(row.animal, row) : kind === "meal" ? who(row.other, row) : null;
        if (!animal) continue;
        (COMES.has(kind) ? came : left).set(animal.id, animal);
    }
    const net: Counts = new Map();
    came.forEach((animal, id) => {
        if (!left.has(id)) bump(net, animal.key, animal.island, 1);
    });
    left.forEach((animal, id) => {
        if (!came.has(id)) bump(net, animal.key, animal.island, -1);
    });
    return net;
}

/** Each species' count when the window began: its count now less the window's net change (never below none). */
export function arkPopulationThen(snapshot: ArkSnapshot, raw: unknown, at: number, since: string): ArkPopulationThen {
    const now = arkCountsByIsland(snapshot);
    const net = arkEventsNet(raw, snapshot);
    const then: Record<string, [number, number]> = {};
    for (const key of Array.from(new Set([...Array.from(now.keys()), ...Array.from(net.keys())]))) {
        const [wild, town] = now.get(key) ?? [0, 0];
        const [netWild, netTown] = net.get(key) ?? [0, 0];
        const pair: [number, number] = [Math.max(0, wild - netWild), Math.max(0, town - netTown)];
        if (pair[0] || pair[1]) then[key] = pair;
    }
    return {at, since, then};
}

function scoped(pair: [number, number] | undefined, scope: ArkChangeScope): number {
    if (!pair) return 0;
    return scope === "both" ? pair[0] + pair[1] : scope === "town" ? pair[1] : pair[0];
}

/** A species' change: its count now (in the panel's scope) against its count then; null when the log was not read. */
export function arkChangeOf(count: number, then: ArkPopulationThen | null, key: string, scope: ArkChangeScope): ArkChange | null {
    if (!then) return null;
    return {delta: count - scoped(then.then[key], scope), base: scoped(then.then[key], scope)};
}

/** The whole scope's change (every species), for the panel's total. */
export function arkTotalChange(count: number, then: ArkPopulationThen | null, scope: ArkChangeScope): ArkChange | null {
    if (!then) return null;
    let base = 0;
    for (const pair of Object.values(then.then)) base += scoped(pair, scope);
    return {delta: count - base, base};
}

/**
 * A change as the panel says it: "+12%", "−3%", "+0.4%" (a tenth under 10%), or, from fewer than three animals,
 * the count itself ("+1", "−2"; a true minus sign). Nothing when the count is the same.
 */
export function arkChangeText(change: ArkChange | null, locale?: string): {text: string; up: boolean; percent: boolean} | null {
    if (!change || !change.delta) return null;
    const up = change.delta > 0;
    if (change.base < ARK_CHANGE_PERCENT_FROM) return {text: arkDeltaText(change.delta, locale), up, percent: false};
    const ratio = Math.abs(change.delta) / change.base;
    const shown = new Intl.NumberFormat(locale, {style: "percent", maximumFractionDigits: ratio < 0.1 ? 1 : 0}).format(Math.max(ratio, 0.001));
    return {text: `${up ? "+" : "−"}${shown}`, up, percent: true};
}

// MARK: Reading the log

type Storageish = Pick<Storage, "getItem" | "setItem">;

type Cached = {v: 1; at: number; since: string; then: Record<string, [number, number]> | null};

function cachedOf(raw: string | null, now: number): Cached | null {
    if (!raw) return null;
    try {
        const value = JSON.parse(raw) as Partial<Cached>;
        if (value.v !== 1 || typeof value.at !== "number" || typeof value.since !== "string") return null;
        if (!(now - value.at >= 0 && now - value.at < ARK_CHANGE_CACHE_MS)) return null;
        if (value.then !== null && (typeof value.then !== "object" || Array.isArray(value.then))) return null;
        return value as Cached;
    } catch {
        return null;
    }
}

/** The window's start for a reading at `now`: 24 hours back, rounded down to five minutes (ISO). */
export function arkChangeSince(now: number): string {
    return new Date(Math.floor((now - ARK_CHANGE_WINDOW_MS) / SINCE_STEP_MS) * SINCE_STEP_MS).toISOString();
}

/**
 * Each species' count 24 hours ago, from the event log at `eventsUrl` (`/api/ark/events`) and the snapshot shown:
 * from this device's last reading when it is under five minutes old, else read now (at most two reads). Null when
 * the log is not there, the read fails, or the window could not be read whole (that answer is kept too, so a burst
 * is not read again on every load).
 */
export async function readArkPopulationThen(
    eventsUrl: string,
    snapshot: ArkSnapshot,
    deps: {fetch: (url: string) => Promise<{ok: boolean; json: () => Promise<unknown>}>; storage: Storageish | null; now?: () => number}
): Promise<ArkPopulationThen | null> {
    const now = (deps.now ?? Date.now)();
    let stored: string | null = null;
    try {
        stored = deps.storage?.getItem(ARK_CHANGE_CACHE_KEY) ?? null;
    } catch {
        stored = null;
    }
    const cached = cachedOf(stored, now);
    if (cached) return cached.then ? {at: cached.at, since: cached.since, then: cached.then} : null;
    const since = arkChangeSince(now);
    const keep = (then: ArkPopulationThen | null) => {
        try {
            deps.storage?.setItem(ARK_CHANGE_CACHE_KEY, JSON.stringify({v: 1, at: now, since, then: then?.then ?? null} satisfies Cached));
        } catch {
            // No storage, or full: read again next load.
        }
        return then;
    };
    const rows: unknown[] = [];
    const seen = new Set<string>();
    let cursor = since;
    for (let read = 0; read < ARK_CHANGE_MAX_READS; read++) {
        let body: Record<string, unknown> | null;
        try {
            const response = await deps.fetch(`${eventsUrl}?since=${encodeURIComponent(cursor)}`);
            if (!response.ok) return null;
            body = record(await response.json());
        } catch {
            return null;
        }
        if (!body || body.available === false || !Array.isArray(body.events)) return null;
        let fresh = 0;
        let last: string | null = null;
        for (const item of body.events) {
            const row = record(item);
            const id = row && (typeof row.id === "number" || typeof row.id === "string") ? String(row.id) : null;
            if (id !== null && seen.has(id)) continue;
            if (id !== null) seen.add(id);
            rows.push(item);
            fresh++;
            last = text(row?.at) ?? last;
        }
        if (body.more !== true) return keep(arkPopulationThen(snapshot, rows, now, since));
        if (!fresh || !last) break;
        cursor = last;
    }
    return keep(null);
}
