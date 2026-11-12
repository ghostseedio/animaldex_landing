/**
 * Who was aboard when: each species' count over time, worked back from the Ark as it is now and the server's event
 * log (`voyage_events_since_v1`), never from a table of its own. The count at a moment is the count now, less the
 * animals that came aboard after it (arrivals and births) and plus the ones that left after it (eaten, died of old
 * age, starved). An animal is counted by its id: a meal and its `eaten` row are one departure, and one that came and
 * left inside the window was aboard only in between.
 *
 * The home page's "Populations over time" (`src/data/ark-landing.ts`) and anything else that charts the Ark. The
 * 24-hour change on /ark (U1, `ark-population-change.ts`) is the same rule at one moment.
 *
 * Pure: no fetch, no clock.
 */

import type {ArkSnapshot} from "@/ark-scene/types";
import {arkEventRows} from "@/lib/ark-life";
import {arkSpeciesKey} from "@/lib/ark-population";

/** The kinds that bring an animal aboard, and the ones whose `animal` leaves (a meal's prey is its `other`). */
const COMES = new Set(["arrival", "birth"]);
const LEAVES = new Set(["eaten", "death_old", "starved"]);

/** One species tracked on the chart. */
export type ArkSeriesSpecies = {key: string; name: string; slug: string; count: number};

/** What happened in each step of the window (step i covers `(times[i-1], times[i]]`; step 0 is empty). */
export type ArkSeriesHappenings = {arrivals: number[]; births: number[]; meals: number[]; deaths: number[]};

export type ArkPopulationSeries = {
    /** The moments charted (ISO), oldest first; the last is the snapshot's `as_of`. */
    times: string[];
    /** Every animal aboard at each moment. */
    total: number[];
    /** The species charted (the biggest now), and each one's count at each moment, in the same order. */
    species: ArkSeriesSpecies[];
    counts: number[][];
    happenings: ArkSeriesHappenings;
    /** False when the log could not be read for the whole window: the chart then says nothing it cannot back. */
    complete: boolean;
};

type Row = Record<string, unknown>;

function record(value: unknown): Row | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
}

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** An event's animal as a species key, from the snapshot when it is still aboard, else from the row itself. */
function keyOf(animal: Row, row: Row, aboard: Map<string, string>, kindOfLook: Map<string, string>): string | null {
    const id = text(animal.id);
    if (id && aboard.has(id)) return aboard.get(id)!;
    const species = text(animal.species_profile_id) ?? text(row.species_profile_id);
    const slug = text(animal.model_slug);
    return (species && kindOfLook.get(species)) || species || (slug ? `slug:${slug}` : null);
}

/** Each species' count now: key -> {count, name, slug}. */
function countsNow(snapshot: ArkSnapshot): Map<string, ArkSeriesSpecies> {
    const now = new Map<string, ArkSeriesSpecies>();
    for (const animal of snapshot.animals) {
        const key = arkSpeciesKey(animal);
        const row = now.get(key) ?? {key, name: animal.kind_name ?? animal.name, slug: animal.model_slug, count: 0};
        row.count++;
        now.set(key, row);
    }
    return now;
}

/**
 * The Ark's counts at `times` (ISO or ms, oldest first; any after the snapshot are treated as now), the `top` biggest
 * species charted. `rows` is the event log from before `times[0]` or later (oldest first, as the server pages it);
 * `complete` says whether it reached back that far.
 */
export function arkPopulationSeries(
    snapshot: ArkSnapshot,
    rows: unknown,
    options: {
        times: Array<string | number>;
        top?: number;
        complete?: boolean;
        /**
         * A gap in the read: every animal aboard now that no row names came aboard at this moment (ms). Only where the
         * log could not be paged through (development's read through the public route, which starts at a minute).
         */
        unloggedCameAt?: number | null;
    }
): ArkPopulationSeries {
    const stamps = options.times.map((value) => (typeof value === "number" ? value : Date.parse(value))).filter(Number.isFinite);
    const now = countsNow(snapshot);
    const aboard = new Map(snapshot.animals.map((animal) => [animal.id, arkSpeciesKey(animal)]));
    const kindOfLook = new Map<string, string>();
    for (const animal of snapshot.animals) if (!kindOfLook.has(animal.species_profile_id)) kindOfLook.set(animal.species_profile_id, arkSpeciesKey(animal));

    // Each animal the log names: when it came and when it left (ms), and its species.
    const lives = new Map<string, {key: string; came: number | null; left: number | null}>();
    const happened: Array<{at: number; kind: "arrival" | "birth" | "meal" | "death"}> = [];
    for (const item of arkEventRows(rows)) {
        const row = record(item);
        const kind = text(row?.kind);
        const at = Date.parse(text(row?.at) ?? "");
        if (!row || !kind || !Number.isFinite(at)) continue;
        if (kind === "meal") happened.push({at, kind: "meal"});
        else if (kind === "arrival" || kind === "birth") happened.push({at, kind});
        else if (LEAVES.has(kind)) happened.push({at, kind: "death"});
        const subject = COMES.has(kind) || LEAVES.has(kind) ? record(row.animal) : kind === "meal" ? record(row.other) : null;
        const id = subject ? text(subject.id) : null;
        if (!subject || !id) continue;
        const key = keyOf(subject, row, aboard, kindOfLook);
        if (!key) continue;
        const life = lives.get(id) ?? {key, came: null, left: null};
        if (COMES.has(kind)) life.came = life.came === null ? at : Math.min(life.came, at);
        else life.left = life.left === null ? at : Math.min(life.left, at);
        lives.set(id, life);
    }

    if (typeof options.unloggedCameAt === "number" && Number.isFinite(options.unloggedCameAt)) {
        for (const animal of snapshot.animals) {
            if (!lives.has(animal.id)) lives.set(animal.id, {key: arkSpeciesKey(animal), came: options.unloggedCameAt, left: null});
        }
    }

    const species = Array.from(now.values())
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, Math.max(0, options.top ?? 6));
    const index = new Map(species.map((row, i) => [row.key, i]));
    const totalNow = snapshot.animals.length;
    const asOf = Date.parse(snapshot.as_of ?? "") || Math.max(...stamps, 0);

    const total: number[] = [];
    const counts: number[][] = species.map(() => []);
    for (const stamp of stamps) {
        const t = Math.min(stamp, asOf);
        let correction = 0;
        const perSpecies = species.map(() => 0);
        lives.forEach((life, id) => {
            // Aboard now: in the snapshot. Not aboard: it left. Neither (it came and is not in this read): unknown, so
            // it changes nothing.
            const isNow = aboard.has(id);
            if (!isNow && life.left === null) return;
            const wasThen = (life.came === null || life.came <= t) && (life.left === null || life.left > t);
            const delta = (wasThen ? 1 : 0) - (isNow ? 1 : 0);
            if (!delta) return;
            correction += delta;
            const i = index.get(life.key);
            if (i !== undefined) perSpecies[i] += delta;
        });
        total.push(Math.max(0, totalNow + correction));
        species.forEach((row, i) => counts[i].push(Math.max(0, row.count + perSpecies[i])));
    }

    const happenings: ArkSeriesHappenings = {arrivals: stamps.map(() => 0), births: stamps.map(() => 0), meals: stamps.map(() => 0), deaths: stamps.map(() => 0)};
    for (const event of happened) {
        // The step it falls in: after the moment before, up to this moment.
        for (let i = 1; i < stamps.length; i++) {
            if (event.at > stamps[i - 1] && event.at <= stamps[i]) {
                (event.kind === "arrival" ? happenings.arrivals : event.kind === "birth" ? happenings.births : event.kind === "meal" ? happenings.meals : happenings.deaths)[i]++;
                break;
            }
        }
    }

    return {times: stamps.map((stamp) => new Date(stamp).toISOString()), total, species, counts, happenings, complete: options.complete !== false};
}

/** `count` moments from `from` to `to` (ms), evenly spaced, the last exactly `to`. */
export function arkSeriesTimes(from: number, to: number, count: number): number[] {
    const steps = Math.max(1, Math.round(count) - 1);
    return Array.from({length: steps + 1}, (_, i) => Math.round(from + ((to - from) * i) / steps));
}

/** What happened in the last `windowMs` before `now` (ms), from the log: the numbers band's "today". */
export function arkHappeningsSince(rows: unknown, since: number): {arrivals: number; births: number; meals: number; deaths: number} {
    const out = {arrivals: 0, births: 0, meals: 0, deaths: 0};
    for (const item of arkEventRows(rows)) {
        const row = record(item);
        const kind = text(row?.kind);
        const at = Date.parse(text(row?.at) ?? "");
        if (!row || !kind || !Number.isFinite(at) || at < since) continue;
        if (kind === "arrival") out.arrivals++;
        else if (kind === "birth") out.births++;
        else if (kind === "meal") out.meals++;
        else if (LEAVES.has(kind)) out.deaths++;
    }
    return out;
}
