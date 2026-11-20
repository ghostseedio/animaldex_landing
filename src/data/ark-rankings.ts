import "server-only";
import taxonGroups from "@/data/ark-taxon-groups.json";
import {readArkEventsWindow} from "@/data/ark-events-window";
import {readArkFoodChainAboard, readArkFoodChainEntry, type ArkFoodChainRead} from "@/data/ark-food-chain";
import {readPublicArk} from "@/data/ark-public";
import type {ArkSnapshot} from "@/ark-scene/types";
import {
    ARK_GROUPS,
    ARK_RANK_WINDOW_DAYS,
    arkBirthTotals,
    arkBreeders,
    arkHasWorld,
    arkReadEvents,
    arkRiskRanking,
    arkSurvivalByPlace,
    type ArkBreeder,
    type ArkFactsFor,
    type ArkGroup,
    type ArkGroupOf,
    type ArkRisk,
    type ArkSurvival
} from "@/lib/ark-rankings";
import {arkCompactHistory, arkKindSeries, arkSeriesStats, decodeArkHistory, type ArkHistory} from "@/lib/ark-population-history";
import {
    arkNeedsFacts,
    arkTimeLeftKind,
    arkTimeLeftRegion,
    arkTimeLeftWorldOf,
    type ArkTimeLeftAnimal,
    type ArkTimeLeftFacts,
    type ArkTimeLeftPredator,
    type ArkTimeLeftWorld
} from "@/lib/ark-time-left";
import {ARK_DAYS_PER_REAL_DAY, PREY_FLOOR} from "@/lib/ark-time-left-constants";
import {isMissingArkFunction} from "@/lib/ark-story";
import {getSupabaseHeaders, getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";

/**
 * The reads behind the two Ark ranking pages, all of them public and the same for everyone (the shared snapshot, the
 * event log's last week, the population record, a species' place in the food chain): one report per page, kept in the
 * process for an hour and built from the data cache. Nothing here reads a user, a bringer or a draw.
 *
 * Never throws: a read that fails leaves its part `null`, and the page says it cannot be read right now.
 */

const HOUR_S = 3600;
const PREDATORS_READ = 4;
/** The most a build waits on the food-chain reads (they are cached for a day, so a later build finishes the rest). */
const FACTS_BUDGET_MS = 25_000;
const FACTS_CONCURRENCY = 6;

// MARK: Groups

const GROUP_OF = new Map<string, ArkGroup>();
for (const group of ARK_GROUPS) {
    for (const id of ((taxonGroups.groups as Record<string, string[]>)[group] ?? [])) GROUP_OF.set(id.toLowerCase(), group);
}

/** A kind's group (mammal, bird…), from the catalogue's taxonomy (`ark-taxon-groups.json`); null for a species with no taxonomy row. */
export const arkGroupOfKind: ArkGroupOf = (kindId) => GROUP_OF.get(kindId.toLowerCase()) ?? null;

// MARK: The population record

async function readHistory(span: "week" | "all", revalidate: number): Promise<ArkHistory | null> {
    const url = getSupabaseUrl();
    const key = getSupabasePublicKey();
    if (!url || !key) return null;
    // The week starts on the hour, so every build in an hour asks the same question (and shares its cache).
    const since = span === "week" ? new Date(Math.floor((Date.now() - 7 * 86_400_000) / 3_600_000) * 3_600_000).toISOString() : null;
    try {
        const response = await fetch(`${url}/rest/v1/rpc/voyage_population_history_v1`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            body: JSON.stringify({p_bucket: span === "week" ? "hour" : "day", p_since: since}),
            next: {revalidate, tags: ["ark-population-history"]}
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
            if (!isMissingArkFunction(body ?? {})) console.warn("[ark-rankings] voyage_population_history_v1 failed", response.status);
            return null;
        }
        return body && typeof body === "object" ? decodeArkHistory(arkCompactHistory(body as Record<string, unknown>)) : null;
    } catch {
        return null;
    }
}

// MARK: The species facts the survival model needs

type Entry = NonNullable<Awaited<ReturnType<typeof readArkFoodChainEntry>>>;

async function inPool<T>(items: T[], limit: number, deadline: number, work: (item: T) => Promise<void>): Promise<void> {
    let next = 0;
    const worker = async () => {
        while (next < items.length && Date.now() < deadline) {
            const item = items[next++];
            await work(item).catch(() => undefined);
        }
    };
    await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
}

/**
 * What the model reads of each wild animal's species (`ArkTimeLeftFacts`): whether its kind eats animals and which
 * predators of it live in its range, from the stored food links of the animals aboard. Only for kinds the model can use
 * them for (a wild animal while the hunting protection is known, at least `PREY_FLOOR` of its kind in its range, or a
 * hungry one). `hunting` says how complete they are: "counted" for all of them, "partial" when some could not be read,
 * "off" when none could (the model then leaves hunting out, and the page says so).
 */
async function buildFacts(snapshot: ArkSnapshot, world: ArkTimeLeftWorld, food: ArkFoodChainRead | null): Promise<{factsFor: ArkFactsFor; hunting: "counted" | "partial" | "off"}> {
    const none = {factsFor: (() => null) as ArkFactsFor, hunting: "off" as const};
    if (!food || !world.huntGrace) return none;
    const presence = new Map<string, Map<string, number>>();
    for (const animal of world.animals) {
        const region = arkTimeLeftRegion(animal);
        if (region === null) continue;
        const pool = presence.get(region) ?? new Map<string, number>();
        pool.set(arkTimeLeftKind(animal), (pool.get(arkTimeLeftKind(animal)) ?? 0) + 1);
        presence.set(region, pool);
    }
    const needed = new Set<string>();
    for (const animal of snapshot.animals) {
        if (!arkNeedsFacts(animal, world)) continue;
        const region = arkTimeLeftRegion(animal);
        const kind = arkTimeLeftKind(animal);
        if (region !== null && ((presence.get(region)?.get(kind) ?? 0) >= PREY_FLOOR || animal.condition === "hungry")) needed.add(kind);
    }
    if (!needed.size) return {factsFor: () => null, hunting: "counted"};
    const entries = new Map<string, Entry | null>();
    const deadline = Date.now() + FACTS_BUDGET_MS;
    const load = async (kind: string) => {
        if (entries.has(kind)) return;
        entries.set(kind, await readArkFoodChainEntry(food, kind));
    };
    await inPool(Array.from(needed), FACTS_CONCURRENCY, deadline, load);
    // The predators of those kinds that live somewhere the kind does: their own prey kinds are read too.
    const predatorKinds = new Set<string>();
    for (const kind of Array.from(needed)) {
        const entry = entries.get(kind);
        for (const item of entry?.eatenBy ?? []) predatorKinds.add(item.predator.id.toLowerCase());
    }
    await inPool(Array.from(predatorKinds).filter((kind) => !entries.has(kind) && presenceAnywhere(presence, kind)), FACTS_CONCURRENCY, deadline, load);
    let ok = 0;
    for (const kind of Array.from(needed)) if (entries.get(kind)) ok++;
    if (!ok) return none;
    const memo = new Map<string, ArkTimeLeftFacts | null>();
    const factsFor: ArkFactsFor = (animal: ArkTimeLeftAnimal) => {
        if (!arkNeedsFacts(animal, world)) return null;
        const region = arkTimeLeftRegion(animal);
        const kind = arkTimeLeftKind(animal);
        if (region === null) return null;
        const key = `${kind}|${region}`;
        if (memo.has(key)) return memo.get(key) ?? null;
        const own = entries.get(kind);
        let facts: ArkTimeLeftFacts | null = null;
        if (own) {
            const here = presence.get(region) ?? new Map<string, number>();
            const predators: ArkTimeLeftPredator[] = own.eatenBy
                .map((item) => item.predator)
                .filter((p) => (here.get(p.id.toLowerCase()) ?? 0) > 0)
                .sort((a, b) => (here.get(b.id.toLowerCase()) ?? 0) - (here.get(a.id.toLowerCase()) ?? 0) || a.name.localeCompare(b.name))
                .slice(0, PREDATORS_READ)
                .map((p) => {
                    const entry = entries.get(p.id.toLowerCase());
                    const preyKinds = entry ? Array.from(new Set(entry.eats.flatMap((rule) => rule.prey.map((prey) => prey.id.toLowerCase())))) : null;
                    return {id: p.id.toLowerCase(), slug: p.slug, name: p.name, preyKinds};
                });
            facts = {eatsAnimals: own.eats.some((rule) => rule.prey.length > 0), predators};
        }
        memo.set(key, facts);
        return facts;
    };
    return {factsFor, hunting: ok === needed.size ? "counted" : "partial"};
}

function presenceAnywhere(presence: Map<string, Map<string, number>>, kind: string): boolean {
    for (const pool of Array.from(presence.values())) if (pool.has(kind)) return true;
    return false;
}

// MARK: The survival report

export type ArkSurvivalReport = {
    asOf: string | null;
    nowMs: number;
    arkDay: number | null;
    /** The launch protection from hunting: still on (until `endsArkDay`, `inDays` real days from now), over, or not published. */
    hunt: {state: "protected" | "on" | "unknown"; endsArkDay: number | null; inDays: number | null};
    /** Whether the chances count hunting: "counted" for every animal that could be hunted, "partial" where a species' food links could not be read, "off" when none could. */
    hunting: "counted" | "partial" | "off";
    animals: number;
    kinds: number;
    /** Survival by place and the causes of deaths in the last week; null while the week's log cannot be read to its end. */
    survival: ArkSurvival | null;
    risk: (ArkRisk & {kindRank: Map<string, number>; animalRank: Map<string, number>}) | null;
    /** Since the record began (the population record): `died` is old age and starvation together, `eaten` apart. */
    allTime: {born: number; died: number; eaten: number} | null;
};

type Memo<T> = {at: number; ttl: number; promise: Promise<T>};
let survivalMemo: Memo<ArkSurvivalReport | null> | null = null;
let breedersMemo: Memo<ArkBreedersReport | null> | null = null;

function remember<T>(memo: Memo<T> | null, load: () => Promise<T>, complete: (value: T) => boolean): {memo: Memo<T>; promise: Promise<T>} {
    const now = Date.now();
    if (memo && now - memo.at < memo.ttl) return {memo, promise: memo.promise};
    const entry: Memo<T> = {at: now, ttl: HOUR_S * 1000, promise: Promise.resolve(null as unknown as T)};
    entry.promise = load().then((value) => {
        // A partial or failed read is tried again soon, not kept for an hour.
        if (!complete(value)) entry.ttl = 120_000;
        return value;
    });
    return {memo: entry, promise: entry.promise};
}

async function buildSurvival(revalidate: number): Promise<ArkSurvivalReport | null> {
    const snapshot = await readPublicArk(revalidate);
    if (!snapshot || !arkHasWorld(snapshot)) return null;
    const world = arkTimeLeftWorldOf(snapshot)!;
    const [window, food, all] = await Promise.all([readArkEventsWindow(ARK_RANK_WINDOW_DAYS, revalidate), readArkFoodChainAboard(revalidate), readHistory("all", revalidate)]);
    const nowMs = Date.now();
    const survival = window && window.complete ? arkSurvivalByPlace(snapshot.animals, arkReadEvents(window.events), nowMs, ARK_RANK_WINDOW_DAYS) : null;
    const {factsFor, hunting} = await buildFacts(snapshot, world, food);
    const risk = arkRiskRanking(snapshot, factsFor, arkGroupOfKind);
    const grace = world.huntGrace;
    const hunt: ArkSurvivalReport["hunt"] = !grace || world.arkDay === null
        ? {state: "unknown", endsArkDay: null, inDays: null}
        : world.arkDay < grace.endsArkDay
        ? {state: "protected", endsArkDay: grace.endsArkDay, inDays: (grace.endsArkDay - world.arkDay) / ARK_DAYS_PER_REAL_DAY}
        : {state: "on", endsArkDay: grace.endsArkDay, inDays: null};
    let allTime: ArkSurvivalReport["allTime"] = null;
    if (all) {
        allTime = {born: 0, died: 0, eaten: 0};
        for (const kind of Array.from(all.kinds.keys())) {
            const stats = arkSeriesStats(arkKindSeries(all, kind, "both"));
            allTime.born += stats.born;
            allTime.died += stats.died;
            allTime.eaten += stats.eaten;
        }
    }
    return {asOf: snapshot.as_of, nowMs, arkDay: world.arkDay, hunt, hunting, animals: snapshot.animals.length, kinds: new Set(snapshot.animals.map((animal) => arkTimeLeftKind(animal))).size, survival, risk, allTime};
}

/** The survival report, from the shared reads (one build an hour per process). Null when the Ark cannot be read. */
export function readArkSurvivalReport(revalidate = HOUR_S): Promise<ArkSurvivalReport | null> {
    const {memo, promise} = remember(survivalMemo, () => buildSurvival(revalidate).catch(() => null), (value) => value !== null && value.survival !== null && value.hunting !== "partial");
    survivalMemo = memo;
    return promise;
}

// MARK: The breeders report

export type ArkBreedersReport = {
    asOf: string | null;
    animals: number;
    births: {day: number; week: number; all: number};
    /** Every ranked kind, most young per adult first; the page cuts its lists from it. */
    breeders: ArkBreeder[];
};

async function buildBreeders(revalidate: number): Promise<ArkBreedersReport | null> {
    const [snapshot, week, all] = await Promise.all([readPublicArk(revalidate), readHistory("week", revalidate), readHistory("all", revalidate)]);
    if (!snapshot || !week || !all) return null;
    return {asOf: snapshot.as_of, animals: snapshot.animals.length, births: arkBirthTotals(week, all), breeders: arkBreeders(snapshot, week, all, arkGroupOfKind)};
}

/** The fastest-breeders report, from the snapshot and the population record. Null when either cannot be read. */
export function readArkBreedersReport(revalidate = HOUR_S): Promise<ArkBreedersReport | null> {
    const {memo, promise} = remember(breedersMemo, () => buildBreeders(revalidate).catch(() => null), (value) => value !== null);
    breedersMemo = memo;
    return promise;
}
