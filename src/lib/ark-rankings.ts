/**
 * The Ark's two ranking pages (/tier-list/ark-survival and /tier-list/ark-fastest-breeders): the numbers behind them.
 * Pure and client-safe, and it reads only what the Ark already publishes, never a draw, a seed or an unreleased event:
 *
 * - the public snapshot (`voyage_public_v2`: who is aboard now, where, how old);
 * - the event log's last week (`voyage_events_since_v1`: arrivals, births, returns, and the three ways to die, each with
 *   the animal's place and what became of it);
 * - the population record (`voyage_population_history_v1`: births per kind by the hour and by the day);
 * - the survival model of the Ark card (`ark-time-left.ts`: the chance an animal lives another Ark year, from its age
 *   against its kind's lifespan, the predators in its range and hunger), given the species facts it needs.
 *
 * What is NOT in the public record, and so is not on the pages (the engine would have to publish it): the cause of a
 * death beyond the three event kinds (an egg lost, an animal left without a carer), and the old-age/starvation split
 * of the population record (`died` there counts both; the split here comes from the event log's week).
 *
 * "Lost for good" is an animal whose last death was final (its status is died_old, starved or eaten). An animal that
 * fell and is recovering, or has come back (hearts: it recovers at its home and returns), is not lost.
 */

import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {arkEventRows} from "@/lib/ark-life";
import {arkKindSeries, arkPeriodStart, arkSeriesSlice, arkSeriesStats, type ArkHistory} from "@/lib/ark-population-history";
import {arkPopulation} from "@/lib/ark-population";
import {
    arkAgeOf,
    arkChanceOf,
    arkLifeOutlook,
    arkTimeLeft,
    arkTimeLeftKind,
    arkTimeLeftWorldOf,
    type ArkLifeOutlook,
    type ArkTimeLeft,
    type ArkTimeLeftAnimal,
    type ArkTimeLeftFacts,
    type ArkTimeLeftWorld
} from "@/lib/ark-time-left";

// MARK: Places

/** Where an animal lives, from the most looked-after to the wildest. */
export type ArkPlace = "zoo" | "farm" | "house" | "town" | "wild";
export const ARK_PLACES: readonly ArkPlace[] = ["zoo", "farm", "house", "town", "wild"];

/** The zoo, a farm, a home, the rest of the town (its wildlife) or the wild island: `area` for the kept, else the island. */
export function arkPlaceOf(animal: {island?: string | null; area?: string | null}): ArkPlace {
    if (animal.area === "zoo" || animal.area === "farm" || animal.area === "house") return animal.area;
    return animal.island === "town" ? "town" : "wild";
}

/** Whole real days in the survival window, and the one day in milliseconds. */
export const ARK_RANK_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

// MARK: The event log

export type ArkDeathCause = "old" | "starved" | "eaten";
export const ARK_DEATH_CAUSES: readonly ArkDeathCause[] = ["old", "starved", "eaten"];

/** +1 for an arrival, a birth or a return from recovering; -1 for a death: the same rule the population record sums. */
export type ArkFlow = {at: number; place: ArkPlace; delta: 1 | -1};
/** One death in the log: the animal, when, how, where, and what it is now (`status`: died_old, starved, eaten, recovering, present). */
export type ArkFall = {animalId: string; at: number; cause: ArkDeathCause; place: ArkPlace; status: string | null};

const GAIN = new Set(["arrival", "birth", "revived"]);
const LOSS: Record<string, ArkDeathCause> = {death_old: "old", starved: "starved", eaten: "eaten"};

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** The log's rows (a `voyage_events_since_v1` answer or its `events`) as flows and deaths; a malformed row is skipped, a repeated row counted once. */
export function arkReadEvents(raw: unknown): {flows: ArkFlow[]; falls: ArkFall[]} {
    const flows: ArkFlow[] = [];
    const falls: ArkFall[] = [];
    const seen = new Set<number>();
    for (const item of arkEventRows(raw)) {
        const row = record(item);
        const kind = typeof row?.kind === "string" ? row.kind : "";
        const gain = GAIN.has(kind);
        const cause = LOSS[kind];
        if (!row || (!gain && !cause)) continue;
        const serial = typeof row.id === "number" && Number.isFinite(row.id) ? row.id : null;
        if (serial !== null) {
            if (seen.has(serial)) continue;
            seen.add(serial);
        }
        const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
        const animal = record(row.animal);
        const id = typeof animal?.id === "string" ? animal.id : null;
        if (!animal || !id || !Number.isFinite(at)) continue;
        const place = arkPlaceOf({island: typeof animal.island === "string" ? animal.island : null, area: typeof animal.area === "string" ? animal.area : null});
        flows.push({at, place, delta: gain ? 1 : -1});
        if (cause) falls.push({animalId: id, at, cause, place, status: typeof animal.status === "string" ? animal.status : null});
    }
    return {flows, falls};
}

const FINAL = new Set(["died_old", "starved", "eaten"]);

// MARK: Survival by place

export type ArkPlaceSurvival = {
    place: ArkPlace;
    /** Aboard now (the snapshot). */
    alive: number;
    /** Fell in the window and is recovering: it comes back. */
    recovering: number;
    /** Lost for good in the window. */
    lost: number;
    /** Every animal there in the window: alive + recovering + lost. */
    everThere: number;
    /** (alive + recovering) / everThere, 0 to 1; null when nobody was there. */
    share: number | null;
    /** Lost for good per day, oldest first, `ARK_RANK_WINDOW_DAYS` values (rolling real days back from now). */
    lostDaily: number[];
    /** Lost for good per 100 aboard at the start of each of those days, oldest first. */
    ratePer100: number[];
    /** The last day's rate against the mean of the six before: more loss, less, or about the same. */
    trend: "more" | "less" | "steady";
};

export type ArkCauseCounts = {falls: Record<ArkDeathCause, number>; lostForGood: Record<ArkDeathCause, number>};

export type ArkSurvival = {
    places: ArkPlaceSurvival[];
    causes: ArkCauseCounts;
    windowDays: number;
};

/**
 * Survival in each place over the last `days` real days, from the snapshot and the event log (which must cover them: the
 * caller refuses an incomplete window). The animals "ever there" in the window are those aboard now, those recovering from
 * a fall in it, and those lost in it; an animal's place is the place the log names it in.
 */
export function arkSurvivalByPlace(animals: readonly Pick<ArkAnimal, "id" | "island" | "area">[], events: {flows: ArkFlow[]; falls: ArkFall[]}, nowMs: number, days = ARK_RANK_WINDOW_DAYS): ArkSurvival {
    const aliveIds = new Set(animals.map((animal) => animal.id));
    const alive = new Map<ArkPlace, number>();
    for (const animal of animals) {
        const place = arkPlaceOf(animal);
        alive.set(place, (alive.get(place) ?? 0) + 1);
    }
    // The last death of each animal says what became of it.
    const last = new Map<string, ArkFall>();
    for (const fall of events.falls) {
        const before = last.get(fall.animalId);
        if (!before || fall.at >= before.at) last.set(fall.animalId, fall);
    }
    const lostBy = new Map<ArkPlace, number>();
    const recoveringBy = new Map<ArkPlace, number>();
    const lostAt = new Map<ArkPlace, number[]>();
    const lostForGood: Record<ArkDeathCause, number> = {old: 0, starved: 0, eaten: 0};
    const falls: Record<ArkDeathCause, number> = {old: 0, starved: 0, eaten: 0};
    for (const fall of events.falls) falls[fall.cause]++;
    for (const [id, fall] of Array.from(last.entries())) {
        if (aliveIds.has(id)) continue;
        if (fall.status && FINAL.has(fall.status)) {
            lostBy.set(fall.place, (lostBy.get(fall.place) ?? 0) + 1);
            lostForGood[fall.cause]++;
            const list = lostAt.get(fall.place) ?? [];
            list.push(fall.at);
            lostAt.set(fall.place, list);
        } else if (fall.status === "recovering") {
            recoveringBy.set(fall.place, (recoveringBy.get(fall.place) ?? 0) + 1);
        }
    }
    const places = ARK_PLACES.map((place): ArkPlaceSurvival => {
        const now = alive.get(place) ?? 0;
        const lost = lostBy.get(place) ?? 0;
        const recovering = recoveringBy.get(place) ?? 0;
        const everThere = now + recovering + lost;
        const flows = events.flows.filter((flow) => flow.place === place);
        const lostDaily: number[] = [];
        const ratePer100: number[] = [];
        // Day i counts back from now: i = 0 is the last 24 hours. Its starting population is today's less every change since.
        for (let i = days - 1; i >= 0; i--) {
            const end = nowMs - i * DAY_MS;
            const start = end - DAY_MS;
            const lostThen = (lostAt.get(place) ?? []).filter((at) => at >= start && at < end).length;
            const population = now - flows.filter((flow) => flow.at >= start).reduce((sum, flow) => sum + flow.delta, 0);
            lostDaily.push(lostThen);
            ratePer100.push(population > 0 ? (lostThen / population) * 100 : 0);
        }
        const recent = ratePer100[ratePer100.length - 1] ?? 0;
        const earlier = ratePer100.slice(0, -1);
        const mean = earlier.length ? earlier.reduce((sum, value) => sum + value, 0) / earlier.length : 0;
        const trend = Math.abs(recent - mean) < Math.max(0.15, mean * 0.2) ? "steady" : recent > mean ? "more" : "less";
        return {place, alive: now, recovering, lost, everThere, share: everThere > 0 ? (now + recovering) / everThere : null, lostDaily, ratePer100, trend};
    });
    return {places, causes: {falls, lostForGood}, windowDays: days};
}

// MARK: Groups

/** What a kind is, for the lists that would otherwise be all insects. */
export type ArkGroup = "mammal" | "bird" | "reptile" | "amphibian" | "fish" | "insect" | "other";
export const ARK_GROUPS: readonly ArkGroup[] = ["mammal", "bird", "reptile", "amphibian", "fish", "insect", "other"];
const VERTEBRATE: ReadonlySet<ArkGroup> = new Set<ArkGroup>(["mammal", "bird", "reptile", "amphibian", "fish"]);

export function arkIsVertebrate(group: ArkGroup | null): boolean {
    return group !== null && VERTEBRATE.has(group);
}

export type ArkGroupOf = (kindId: string) => ArkGroup | null;

// MARK: The chance to live another Ark year

/** Species facts for one animal (the predators of its kind in its range, whether its kind eats animals), or null where none are known. */
export type ArkFactsFor = (animal: ArkTimeLeftAnimal) => ArkTimeLeftFacts | null;

export type ArkRiskAnimal = {
    animal: ArkAnimal;
    kindId: string;
    place: ArkPlace;
    /** 0 to 1, as `arkChanceOf`. */
    chance: number;
    left: ArkTimeLeft | null;
    outlook: ArkLifeOutlook | null;
};

export type ArkRiskKind = {
    kindId: string;
    slug: string;
    name: string;
    group: ArkGroup | null;
    aboard: number;
    /** The chance at least one of the kind is still aboard in an Ark year, if none is born: 1 - the product of each one's chance to be gone. */
    persistence: number;
    /** The kind's animal with the least chance, for the reason line and the link. */
    worst: ArkRiskAnimal;
};

export type ArkRisk = {animals: ArkRiskAnimal[]; kinds: ArkRiskKind[]; considered: number; unbounded: number};

const sooner = (a: ArkRiskAnimal, b: ArkRiskAnimal): number => (a.left?.lowDays ?? Infinity) - (b.left?.lowDays ?? Infinity);

/**
 * The animals and the kinds with the least chance to be aboard in an Ark year (the Ark card's model, middle estimate),
 * the least first; the soonest likely end breaks a tie (hundreds of short-lived animals have none). `animals` is the
 * `limit` least; `kinds` is the `limit` least overall plus the `perGroup` least of each group (so a list that a group's
 * filter narrows is never empty), each with its overall rank kept by its place in the full order.
 */
export function arkRiskRanking(snapshot: ArkSnapshot, factsFor: ArkFactsFor, groupOf: ArkGroupOf, options: {limit?: number; perGroup?: number} = {}): ArkRisk & {kindRank: Map<string, number>} {
    const limit = options.limit ?? 40;
    const perGroup = options.perGroup ?? 12;
    const world = arkTimeLeftWorldOf(snapshot);
    if (!world) return {animals: [], kinds: [], considered: 0, unbounded: 0, kindRank: new Map()};
    const rows: ArkRiskAnimal[] = [];
    // A kind with an animal nothing bounds cannot be at risk: that one lives on.
    const unboundedKinds = new Set<string>();
    let unbounded = 0;
    for (const animal of snapshot.animals) {
        const chance = arkChanceOf(animal, world, factsFor(animal), []);
        if (!chance) {
            unbounded++;
            unboundedKinds.add(arkTimeLeftKind(animal));
            continue;
        }
        rows.push({animal, kindId: arkTimeLeftKind(animal), place: arkPlaceOf(animal), chance: chance.chance, left: null, outlook: null});
    }
    // The soonest end only where the chance is low enough to matter for a list.
    for (const row of rows) if (row.chance < 0.5) row.left = arkTimeLeft(row.animal, world, factsFor(row.animal), [], {everyone: true});
    rows.sort((a, b) => a.chance - b.chance || sooner(a, b) || a.animal.name.localeCompare(b.animal.name) || a.animal.id.localeCompare(b.animal.id));

    const byKind = new Map<string, ArkRiskAnimal[]>();
    for (const row of rows) {
        const list = byKind.get(row.kindId) ?? [];
        list.push(row);
        byKind.set(row.kindId, list);
    }
    const population = new Map(arkPopulation(snapshot).regions.flatMap((group) => group.species).map((row) => [row.key.toLowerCase(), row]));
    const kinds: ArkRiskKind[] = [];
    for (const [kindId, list] of Array.from(byKind.entries())) {
        if (unboundedKinds.has(kindId)) continue;
        const row = population.get(kindId);
        const gone = list.reduce((product, one) => product * (1 - one.chance), 1);
        kinds.push({kindId, slug: row?.slug ?? list[0].animal.model_slug, name: row?.name ?? list[0].animal.kind_name ?? list[0].animal.name, group: groupOf(kindId), aboard: list.length, persistence: 1 - gone, worst: list[0]});
    }
    kinds.sort((a, b) => a.persistence - b.persistence || a.aboard - b.aboard || sooner(a.worst, b.worst) || a.name.localeCompare(b.name) || a.kindId.localeCompare(b.kindId));
    const kindRank = new Map(kinds.map((kind, index) => [kind.kindId, index + 1]));
    const keep = new Set(kinds.slice(0, limit).map((kind) => kind.kindId));
    for (const group of ARK_GROUPS) {
        let taken = 0;
        for (const kind of kinds) {
            if (kind.group !== group) continue;
            if (taken++ >= perGroup) break;
            keep.add(kind.kindId);
        }
    }
    const pickedKinds = kinds.filter((kind) => keep.has(kind.kindId));
    const pickedAnimals = rows.slice(0, limit);
    // The card's whole block (with the reason, and how it moved in a day) only for the rows shown.
    for (const row of [...pickedAnimals, ...pickedKinds.map((kind) => kind.worst)]) {
        if (!row.outlook) row.outlook = arkLifeOutlook(row.animal, world, factsFor(row.animal), []);
    }
    return {animals: pickedAnimals, kinds: pickedKinds, considered: rows.length, unbounded, kindRank};
}

// MARK: Fastest breeders

export type ArkBreeder = {
    kindId: string;
    slug: string;
    name: string;
    group: ArkGroup | null;
    /** Aboard now, and how many of those are grown. */
    aboard: number;
    adults: number;
    /** Born in the last 24 hours, the last 7 days, and since the record began. */
    bornDay: number;
    bornWeek: number;
    bornAll: number;
    /** Born since the record began for each grown animal aboard now. */
    youngPerAdult: number;
};

/** A kind needs a breeding pair aboard to be ranked on young per adult. */
export const ARK_BREEDER_MIN_ADULTS = 2;

/**
 * Births per kind from the population record (the hourly week and the daily whole record) and the grown animals of each
 * kind from the snapshot, most young per adult first. A kind appears with at least one birth and a breeding pair aboard.
 */
export function arkBreeders(snapshot: ArkSnapshot, week: ArkHistory, all: ArkHistory, groupOf: ArkGroupOf): ArkBreeder[] {
    const arkDay = typeof snapshot.ark_day === "number" ? snapshot.ark_day : null;
    const adults = new Map<string, number>();
    for (const animal of snapshot.animals) {
        if (arkAgeOf(animal, arkDay)?.stage === "young") continue;
        if (arkAgeOf(animal, arkDay) === null) continue;
        const kind = arkTimeLeftKind(animal);
        adults.set(kind, (adults.get(kind) ?? 0) + 1);
    }
    const aboard = new Map<string, number>();
    for (const animal of snapshot.animals) aboard.set(arkTimeLeftKind(animal), (aboard.get(arkTimeLeftKind(animal)) ?? 0) + 1);
    const population = new Map(arkPopulation(snapshot).regions.flatMap((group) => group.species).map((row) => [row.key.toLowerCase(), row]));
    const dayStart = arkPeriodStart(week, "24h");
    const weekStart = arkPeriodStart(week, "7d");
    const out: ArkBreeder[] = [];
    for (const kindId of Array.from(all.kinds.keys())) {
        const key = kindId.toLowerCase();
        const grown = adults.get(key) ?? 0;
        const row = population.get(key);
        if (!row || grown < ARK_BREEDER_MIN_ADULTS) continue;
        const bornAll = arkSeriesStats(arkKindSeries(all, kindId, "both")).born;
        if (bornAll <= 0) continue;
        const weekly = arkKindSeries(week, kindId, "both");
        out.push({
            kindId: key,
            slug: row.slug,
            name: row.name,
            group: groupOf(key),
            aboard: aboard.get(key) ?? 0,
            adults: grown,
            bornDay: arkSeriesStats(arkSeriesSlice(weekly, dayStart)).born,
            bornWeek: arkSeriesStats(arkSeriesSlice(weekly, weekStart)).born,
            bornAll,
            youngPerAdult: bornAll / grown
        });
    }
    return out.sort((a, b) => b.youngPerAdult - a.youngPerAdult || b.bornAll - a.bornAll || a.name.localeCompare(b.name) || a.kindId.localeCompare(b.kindId));
}

/** The born counts of the whole Ark (all kinds, all places): last 24 hours, last 7 days, since the record began. */
export function arkBirthTotals(week: ArkHistory, all: ArkHistory): {day: number; week: number; all: number} {
    let day = 0;
    let weekly = 0;
    let total = 0;
    const dayStart = arkPeriodStart(week, "24h");
    const weekStart = arkPeriodStart(week, "7d");
    for (const kindId of Array.from(week.kinds.keys())) {
        const series = arkKindSeries(week, kindId, "both");
        day += arkSeriesStats(arkSeriesSlice(series, dayStart)).born;
        weekly += arkSeriesStats(arkSeriesSlice(series, weekStart)).born;
    }
    for (const kindId of Array.from(all.kinds.keys())) total += arkSeriesStats(arkKindSeries(all, kindId, "both")).born;
    return {day, week: weekly, all: total};
}

/** Whether the world the model reads is there (a snapshot with an Ark day), for a caller that wants to say so. */
export function arkHasWorld(snapshot: ArkSnapshot | null): snapshot is ArkSnapshot {
    return Boolean(snapshot && arkTimeLeftWorldOf(snapshot)?.arkDay !== null);
}

export type {ArkTimeLeftWorld};
