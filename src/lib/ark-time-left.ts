/**
 * "Estimated time left" on the Ark's info panel (owner decision 389, `docs/ark/audits/ecosystem-audit-2026-11-18.md`
 * sections 2.1 and 2.2): for an animal at risk, a RANGE of Ark days (or years) it is likely to have, and the reasons
 * behind it. Pure and client-safe; loaded lazily, only once an animal at risk is on screen.
 *
 * What it is made of: probabilities only, from public, already-released facts.
 *
 * - It reads the public snapshot's fields of the animal and of the animals around it (`ARK_TIME_LEFT_ANIMAL_FIELDS`,
 *   `ARK_TIME_LEFT_WORLD_FIELDS`: all of them in the released `voyage_public` read, or marked PROPOSED below) and species
 *   facts (what eats what: `/api/ark/food-chain`; body size: the catalogue's stats). It NEVER reads, rebuilds or
 *   guesses the server's random draws (an animal's drawn death day, a hunt's draw, the seed), the next hunt of any
 *   predator, a decided-but-unreleased event or the launch ramp's per-animal hash: the engine's `naturalDeathDay`,
 *   `rngFor`, `hashUnit` and `voyage_hunting_v1` are not used here, and `ark-time-left.test.ts` checks that no field
 *   outside the lists is touched and that a planted secret changes nothing.
 * - Each number is the engine's own (`ark-time-left-constants.ts`, checked against the engine's source by the test).
 *
 * Who is "at risk" (any one is enough; the estimate is shown only then):
 * - old: the read's `condition` is "old" (the server's own flag, 4/5 of the wild lifespan gone), or the age the engine
 *   counts is at that share of the lifespan;
 * - hunted: the animal lives in the wild ecology (not kept: a house, a farm or the zoo are fed by their keepers), at
 *   least `PREY_FLOOR` (3) of its kind are in its hunting region (below that the engine never hunts the kind), a
 *   predator of its kind lives in that region, and the hunting protection has ended (nothing hunts it before that);
 * - starving: the read's `condition` is "hungry" and its kind eats catalogue animals (only such a kind can starve:
 *   herbivores and ambient-fed animals never do).
 *
 * The model: three independent ways to die, the first one wins.
 * - Age (engine: a death age drawn uniformly between the wild lifespan's two ends, `rules.ts` naturalDeathDay; we use
 *   the two ends, not the draw): given the age so far, the time left is uniform between "the lower end less the age" and
 *   "the upper end less the age". The read carries the lower end (`lifespan_days`); the upper end is PROPOSED
 *   (`lifespan_days_hi`), until then twice the lower end, widened to 1.5-3 times (the engine's own spread of stored ranges).
 *   An arrival counts as grown on arrival (`effectiveBirth`).
 * - Hunger (only a hungry predator): it starves after `starveDays` of continuous hunger and we do not know how long it
 *   has been hungry, so what is left is uniform between 0 and that many days.
 * - Being hunted: each predator kind in its region catches about once per meal interval per predator (the
 *   engine's allometric interval from the predator's mass; the class, endotherm or not, is not in the read, so both
 *   are tried), and takes one of the animals it can take in that region: the chance it is this one is 1 / (those
 *   animals in the region, among kinds above the floor). Misses cost one 15-Ark-minute step. The hazard starts when the
 *   hunting protection ends (the launch grace and its ramp: PROPOSED `voyage.hunt_grace`; with no figure published the
 *   hunting factor is OFF, never assumed).
 *   The range is the 25th percentile of the time to the first of these under the harsher bounds to the 75th percentile
 *   under the kinder ones (the middle half of the likely outcomes).
 *
 * Hooks (decision 389): an `ArkTimeLeftHook` returns an extra survival curve and a reason, or null. `skill` (P1-8, wild
 * skill: a released animal still learning to find food) is built, in `ark-release-time-left.ts`; `wounds` (E5) is not
 * yet (no engine behaviour exists for it, and it is not faked). `safe` for decision 389 D4 (the 26-Ark-day window of the last wild animal of a kind) is the same
 * hook once the server publishes it (`safe_until_ark_day`).
 */

import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {arkStats, massFromSize} from "@/ark-scene/stats";
import {arkHuntingRegion} from "@/lib/ark-food-chain";
import {
    ADULT_AGE,
    HUNT_SUCCESS,
    LIFESPAN_HI_OVER_LO,
    MEAL_INTERVAL,
    OLD_LIFE_FRACTION,
    PREY_FLOOR,
    RETRY_AFTER_MISS_DAYS,
    STARVE
} from "@/lib/ark-time-left-constants";

// MARK: What may be read

/**
 * The animal fields this module may read (the snapshot's `animals[]`). PROPOSED (not in the read yet, absent today and
 * then simply not used): `lifespan_days_hi`, `hunt_interval_days`.
 */
export const ARK_TIME_LEFT_ANIMAL_FIELDS = [
    "species_profile_id",
    "kind_species_profile_id",
    "model_slug",
    "zone",
    "island",
    "area",
    "origin",
    "condition",
    "born_ark_day",
    "lifespan_days",
    "lifespan_estimate",
    "stats",
    "lifespan_days_hi",
    "hunt_interval_days"
] as const;

/** The world fields it may read: the snapshot's Ark day, its animals, and (PROPOSED) the hunting protection. */
export const ARK_TIME_LEFT_WORLD_FIELDS = ["arkDay", "animals", "huntGrace"] as const;

/** The snapshot's own top-level fields `arkTimeLeftWorldOf` reads (`hunt_grace` is PROPOSED). */
export const ARK_TIME_LEFT_SNAPSHOT_FIELDS = ["ark_day", "animals", "hunt_grace"] as const;

/** Proposed, not in today's read: the fields above that only a future server sends. */
export const ARK_TIME_LEFT_PROPOSED = ["lifespan_days_hi", "hunt_interval_days", "huntGrace"] as const;

export type ArkTimeLeftAnimal = Pick<
    ArkAnimal,
    | "species_profile_id"
    | "kind_species_profile_id"
    | "model_slug"
    | "zone"
    | "island"
    | "area"
    | "origin"
    | "condition"
    | "born_ark_day"
    | "lifespan_days"
    | "lifespan_estimate"
    | "stats"
    | "lifespan_days_hi"
    | "hunt_interval_days"
>;

export type ArkTimeLeftWorld = {
    /** The snapshot's Ark day (`ark_day`). */
    arkDay: number | null;
    /** The snapshot's animals around it. */
    animals: readonly ArkTimeLeftAnimal[];
    /**
     * PROPOSED (`voyage.hunt_grace`): the Ark day the launch grace ends (no animal is hunted before it) and the days over
     * which hunting then ramps in (each animal's own start is inside, by a hash we do not read). Absent: unknown, and the
     * hunting factor is off.
     */
    huntGrace?: {endsArkDay: number; rampArkDays: number} | null;
};

/** The world an estimate reads, from the public snapshot: nothing else of it is touched. */
export function arkTimeLeftWorldOf(snapshot: Pick<ArkSnapshot, "ark_day" | "animals" | "hunt_grace"> | null): ArkTimeLeftWorld | null {
    if (!snapshot) return null;
    const grace = snapshot.hunt_grace;
    return {
        arkDay: finite(snapshot.ark_day) ? snapshot.ark_day : null,
        animals: snapshot.animals,
        huntGrace: grace && finite(grace.ends_ark_day) && finite(grace.ramp_ark_days) ? {endsArkDay: grace.ends_ark_day, rampArkDays: grace.ramp_ark_days} : null
    };
}

/** Species facts, from `/api/ark/food-chain` (what eats what aboard): never anything about one animal. */
export type ArkTimeLeftFacts = {
    /** Its kind eats catalogue animals (`entry.eats` is not empty): the only kind that can starve. */
    eatsAnimals: boolean;
    /** The predator kinds that may eat its kind aboard. */
    predators: ArkTimeLeftPredator[];
};

export type ArkTimeLeftPredator = {
    /** The predator kind's id. */
    id: string;
    slug: string;
    name: string;
    /** The kind ids it may take (its `entry.eats`), or null when not read: then only its own prey kind counts. */
    preyKinds: readonly string[] | null;
};

/** An extra way to die (wounds, wild skill), or null: a survival curve (1 at 0, never rising) and what to say. */
export type ArkTimeLeftHook = (animal: ArkTimeLeftAnimal, world: ArkTimeLeftWorld) => {survival: (days: number) => number; reason: ArkTimeLeftReason} | null;

// MARK: Result

export type ArkRiskKind = "old" | "hunted" | "starving";

export type ArkTimeLeftReason =
    | {kind: "age"; lifespanLowDays: number; lifespanHighDays: number; estimate: boolean}
    | {kind: "hunger"}
    | {kind: "hunted"; predators: Array<{name: string; count: number}>}
    | {kind: "safe"; untilArkDay: number}
    | {kind: "wounds"}
    | {kind: "skill"};

export type ArkTimeLeft = {
    /** Whole Ark days, at least 1, low <= high. The 25th and 75th percentile (the harsher and the kinder bounds), rounded outward to two digits. */
    lowDays: number;
    highDays: number;
    /** The range ends at the horizon (100 Ark years): shown as "100+". */
    capped: boolean;
    atRisk: ArkRiskKind[];
    reasons: ArkTimeLeftReason[];
    /** Some input is an estimate (the lifespan, or the upper end assumed, or the predators' class tried both ways). */
    estimate: boolean;
};

const ARK_YEAR = 365;
const HORIZON_DAYS = 100 * ARK_YEAR;
const MIN_SPAN_DAYS = 1;
/** The two ends of the range: the middle half of the likely outcomes (the quartiles). */
const P_LOW = 0.25;
const P_HIGH = 0.75;

// MARK: Helpers

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function arkTimeLeftKind(animal: Pick<ArkTimeLeftAnimal, "species_profile_id" | "kind_species_profile_id">): string {
    return (animal.kind_species_profile_id ?? animal.species_profile_id).toLowerCase();
}

/** Where it is hunted: not kept (a house, a farm, the zoo), by its island and region (`arkHuntingRegion`). */
export function arkTimeLeftRegion(animal: Pick<ArkTimeLeftAnimal, "area" | "island" | "zone">): string | null {
    return arkHuntingRegion(animal);
}

/** The engine's `adultAgeDays`: 0.15 of the lifespan's middle, 2 to 3650 days. */
export function arkAdultAgeDays(lowDays: number, highDays: number): number {
    return clamp(ADULT_AGE.lifespanFraction * ((lowDays + highDays) / 2), ADULT_AGE.minDays, ADULT_AGE.maxDays);
}

/** The engine's `starveDays` for a body mass: 14 x kg^0.25, from 7 to 120 days. */
export function arkStarveDays(massKg: number): number {
    return clamp(Math.round(STARVE.baseDays * massKg ** STARVE.massExponent), STARVE.minDays, STARVE.maxDays);
}

/** The engine's two meal intervals for a body mass (endotherm, ectotherm), from 7 to 365 days, before any ambient-food slowing. */
export function arkMealIntervalDays(massKg: number): {endo: number; ecto: number} {
    const m = massKg ** MEAL_INTERVAL.massExponent;
    return {
        endo: clamp(MEAL_INTERVAL.endoDays * m, MEAL_INTERVAL.minDays, MEAL_INTERVAL.maxDays),
        ecto: clamp(MEAL_INTERVAL.ectoDays * m, MEAL_INTERVAL.minDays, MEAL_INTERVAL.maxDays)
    };
}

function massOf(animal: Pick<ArkTimeLeftAnimal, "model_slug" | "stats">): number {
    return massFromSize(arkStats({model_slug: animal.model_slug, stats: animal.stats}).size);
}

/** The chance of a catch per try (the middle of the published range), 1 where there is none. */
export function arkHuntSuccess(kindId: string): number {
    const range = HUNT_SUCCESS[kindId.toLowerCase()];
    return range ? (range[0] + range[1]) / 2 : 1;
}

/** Days between catches of one predator: the meal interval plus one step for each miss before the catch. */
function catchPeriodDays(intervalDays: number, success: number): number {
    return intervalDays + (1 / Math.max(success, 1e-6) - 1) * RETRY_AFTER_MISS_DAYS;
}

function roundDown(n: number): number {
    if (n < 10) return Math.max(1, Math.floor(n));
    const p = 10 ** (Math.floor(Math.log10(n)) - 1);
    return Math.floor(n / p + 1e-9) * p;
}

function roundUp(n: number): number {
    if (n < 10) return Math.max(1, Math.ceil(n - 1e-9));
    const p = 10 ** (Math.floor(Math.log10(n)) - 1);
    return Math.ceil(n / p - 1e-9) * p;
}

type Curve = (days: number) => number;

/** The first time the curve (1 at 0, never rising) is at or under `q`. */
function quantileDays(survival: Curve, q: number): number {
    let hi = 1;
    while (survival(hi) > q && hi < HORIZON_DAYS * 4) hi *= 2;
    if (survival(hi) > q) return HORIZON_DAYS * 4;
    let lo = 0;
    for (let i = 0; i < 70; i++) {
        const mid = (lo + hi) / 2;
        if (survival(mid) > q) lo = mid;
        else hi = mid;
    }
    return hi;
}

// MARK: The factors

type AgeFactor = {pess: Curve; opt: Curve; reason: ArkTimeLeftReason; lowDays: number; highDays: number; ageDays: number; sinceBornDays: number; assumed: boolean};

/** Age against the wild lifespan, or null when the read has no lifespan or no born day. */
function ageFactor(animal: ArkTimeLeftAnimal, arkDay: number | null): AgeFactor | null {
    const low = animal.lifespan_days;
    if (!finite(low) || low <= 0 || !finite(animal.born_ark_day) || arkDay === null) return null;
    const published = finite(animal.lifespan_days_hi) && animal.lifespan_days_hi >= low ? animal.lifespan_days_hi : null;
    const highMid = published ?? low * LIFESPAN_HI_OVER_LO.median;
    const adult = animal.origin === "arrived" ? arkAdultAgeDays(low, highMid) : 0;
    const sinceBorn = Math.max(arkDay - animal.born_ark_day, 0);
    const age = sinceBorn + adult;
    const curve = (high: number): Curve => {
        const x = Math.max(low - age, 0);
        const y = Math.max(high - age, x + MIN_SPAN_DAYS);
        return (t) => (t < x ? 1 : t >= y ? 0 : (y - t) / (y - x));
    };
    const assumed = published === null;
    return {
        // The harsher bound: the shorter upper end; the kinder: the longer (only when the upper end is assumed).
        pess: curve(published ?? low * LIFESPAN_HI_OVER_LO.low),
        opt: curve(published ?? low * LIFESPAN_HI_OVER_LO.high),
        reason: {kind: "age", lifespanLowDays: low, lifespanHighDays: highMid, estimate: animal.lifespan_estimate === true || assumed},
        lowDays: low,
        highDays: highMid,
        ageDays: age,
        sinceBornDays: sinceBorn,
        assumed
    };
}

type HuntFactor = {
    pess: Curve;
    opt: Curve;
    predators: Array<{name: string; count: number; hazard: number}>;
    startsInDays: number;
    classTried: boolean;
};

function hunters(animal: ArkTimeLeftAnimal, world: ArkTimeLeftWorld, facts: ArkTimeLeftFacts): HuntFactor | null {
    const grace = world.huntGrace;
    if (!grace || !finite(world.arkDay) || !finite(grace.endsArkDay)) return null;
    const region = arkTimeLeftRegion(animal);
    if (region === null || !facts.predators.length) return null;
    const own = arkTimeLeftKind(animal);
    // The pool by kind in its region (kept animals are out of it); its own kind must stand at or above the floor.
    const pool = new Map<string, number>();
    const predatorAnimals = new Map<string, ArkTimeLeftAnimal[]>();
    const wanted = new Set(facts.predators.map((p) => p.id.toLowerCase()));
    for (const other of world.animals) {
        if (arkTimeLeftRegion(other) !== region) continue;
        const kind = arkTimeLeftKind(other);
        pool.set(kind, (pool.get(kind) ?? 0) + 1);
        if (wanted.has(kind)) {
            const list = predatorAnimals.get(kind) ?? [];
            list.push(other);
            predatorAnimals.set(kind, list);
        }
    }
    if ((pool.get(own) ?? 0) < PREY_FLOOR) return null;
    let harsh = 0;
    let kinder = 0;
    let classTried = false;
    const rows: HuntFactor["predators"] = [];
    for (const predator of facts.predators) {
        const id = predator.id.toLowerCase();
        const there = predatorAnimals.get(id);
        if (!there?.length) continue;
        // The animals this predator may take in this region, among kinds at or above the floor (its own prey kind always counts).
        const preyKinds = new Set<string>((predator.preyKinds ?? []).map((k) => k.toLowerCase()));
        preyKinds.add(own);
        let taken = 0;
        for (const k of Array.from(preyKinds)) {
            const n = pool.get(k) ?? 0;
            if (n >= PREY_FLOOR) taken += n;
        }
        if (taken <= 0) continue;
        const published = there.map((a) => a.hunt_interval_days).find(finite) ?? null;
        let shortest: number;
        let longest: number;
        if (published !== null && published > 0) {
            shortest = published;
            longest = published;
        } else {
            const mass = massOf(there[0]);
            const interval = arkMealIntervalDays(mass);
            shortest = interval.endo;
            // (A predator fed by ambient food hunts 4 times less often; the read does not say which, so that is left out: it can
            // only make the harsher end a little too harsh.)
            longest = interval.ecto;
            if (interval.endo !== interval.ecto) classTried = true;
        }
        const success = arkHuntSuccess(id);
        const hazardHarsh = there.length / (catchPeriodDays(shortest, success) * taken);
        const hazardKind = there.length / (catchPeriodDays(longest, success) * taken);
        harsh += hazardHarsh;
        kinder += hazardKind;
        rows.push({name: predator.name, count: there.length, hazard: hazardHarsh});
    }
    if (!rows.length) return null;
    const left = (day: number) => Math.max(day - world.arkDay!, 0);
    const startHarsh = left(grace.endsArkDay);
    const startKind = left(grace.endsArkDay + Math.max(grace.rampArkDays, 0));
    rows.sort((a, b) => b.hazard - a.hazard || a.name.localeCompare(b.name));
    return {
        pess: (t) => Math.exp(-harsh * Math.max(t - startHarsh, 0)),
        opt: (t) => Math.exp(-kinder * Math.max(t - startKind, 0)),
        predators: rows,
        startsInDays: startHarsh,
        classTried
    };
}

// MARK: At risk

/**
 * Which risks apply to this animal (empty: not at risk, no estimate is shown). `facts` may be null (not read yet or
 * unreadable): then only the risks that need none are found.
 */
export function arkAtRisk(animal: ArkTimeLeftAnimal, world: ArkTimeLeftWorld, facts: ArkTimeLeftFacts | null = null): ArkRiskKind[] {
    const out: ArkRiskKind[] = [];
    const age = ageFactor(animal, world.arkDay);
    // The read's own flag, and its rule again (4/5 of the lower end since born or boarded), because "hungry" hides "old" in the read.
    if (animal.condition === "old" || (age !== null && age.sinceBornDays >= OLD_LIFE_FRACTION * age.lowDays)) out.push("old");
    if (facts) {
        const hunt = hunters(animal, world, facts);
        if (hunt && hunt.startsInDays <= 0) out.push("hunted");
        if (animal.condition === "hungry" && facts.eatsAnimals) out.push("starving");
    }
    return out;
}

/**
 * Whether the species facts are worth reading for this animal at all: only a hungry one (does its kind eat animals?) or
 * one that could be hunted (wild, and the hunting protection is known). Everything else is decided without them.
 */
export function arkNeedsFacts(animal: ArkTimeLeftAnimal, world: ArkTimeLeftWorld): boolean {
    if (animal.condition === "hungry") return true;
    return Boolean(world.huntGrace) && arkTimeLeftRegion(animal) !== null;
}

/** The estimate for one animal, or null when it is not at risk or nothing is known to bound its time. */
export function arkTimeLeft(
    animal: ArkTimeLeftAnimal,
    world: ArkTimeLeftWorld,
    facts: ArkTimeLeftFacts | null = null,
    hooks: readonly ArkTimeLeftHook[] = []
): ArkTimeLeft | null {
    const atRisk = arkAtRisk(animal, world, facts);
    // A hook's own risk (a released animal still learning to find food) is a risk too.
    const extra = hooks.map((hook) => hook(animal, world)).filter((x): x is NonNullable<typeof x> => x !== null);
    if (!atRisk.length && !extra.length) return null;
    const age = ageFactor(animal, world.arkDay);
    const hunt = facts ? hunters(animal, world, facts) : null;
    const starving = atRisk.includes("starving");
    const starveSpan = starving ? arkStarveDays(massOf(animal)) : 0;
    if (!age && !hunt && !starving && !extra.length) return null;

    const starveCurve: Curve = starving ? (t) => Math.max(0, 1 - t / starveSpan) : () => 1;
    const extraCurve: Curve = (t) => extra.reduce((s, e) => s * e.survival(t), 1);
    // The range with some factors left out: a factor is a reason only when it moves the range (or it is why the animal is at risk).
    const rangeOf = (withAge: boolean, withHunt: boolean) => {
        const pess: Curve = (t) => (withAge && age ? age.pess(t) : 1) * starveCurve(t) * (withHunt && hunt ? hunt.pess(t) : 1) * extraCurve(t);
        const opt: Curve = (t) => (withAge && age ? age.opt(t) : 1) * starveCurve(t) * (withHunt && hunt ? hunt.opt(t) : 1) * extraCurve(t);
        const low = quantileDays(pess, 1 - P_LOW);
        const high = Math.max(quantileDays(opt, 1 - P_HIGH), low);
        return {
            low,
            high,
            lowDays: Math.min(roundDown(Math.max(low, MIN_SPAN_DAYS)), HORIZON_DAYS),
            highDays: Math.min(roundUp(Math.max(high, MIN_SPAN_DAYS)), HORIZON_DAYS)
        };
    };
    const all = rangeOf(true, true);
    const capped = all.high >= HORIZON_DAYS;
    const lowDays = all.lowDays;
    const highDays = Math.max(all.highDays, lowDays);
    const only = (a: {lowDays: number; highDays: number}, b: {lowDays: number; highDays: number}) => a.lowDays === b.lowDays && a.highDays === b.highDays;
    const ageMoves = Boolean(age) && !only(all, rangeOf(false, true));
    const huntMoves = Boolean(hunt) && !only(all, rangeOf(true, false));

    const reasons: ArkTimeLeftReason[] = [];
    if (age && (atRisk.includes("old") || ageMoves || (!hunt && !starving && !extra.length))) reasons.push(age.reason);
    if (starving) reasons.push({kind: "hunger"});
    if (hunt && (atRisk.includes("hunted") || huntMoves)) {
        reasons.push({kind: "hunted", predators: hunt.predators.slice(0, 3).map(({name, count}) => ({name, count}))});
        if (world.huntGrace && finite(world.arkDay) && world.arkDay < world.huntGrace.endsArkDay) {
            reasons.push({kind: "safe", untilArkDay: Math.ceil(world.huntGrace.endsArkDay)});
        }
    }
    for (const e of extra) reasons.push(e.reason);
    return {
        lowDays,
        highDays,
        capped,
        atRisk,
        reasons,
        estimate: reasons.some((r) => r.kind === "age" && r.estimate) || (reasons.some((r) => r.kind === "hunted") && Boolean(hunt?.classTried))
    };
}

// MARK: Words

/** The words of the panel (`ark.timeLeft` in the locale files). */
export type ArkTimeLeftWords = {
    title: string;
    /** "About {value}" */
    about: string;
    hint: string;
    reasonAge: string;
    reasonAgeEstimate: string;
    reasonHunted: string;
    reasonHunger: string;
    reasonSafe: string;
    /** A released animal still learning to find food (Release to the Wild). */
    reasonSkill?: string;
};

/** What `ark.life` and the locale give for units: "{days} Ark days", "1 Ark day", "{years} Ark years", "1 Ark year". */
export type ArkTimeLeftUnitWords = {ageDays: string; ageDay: string; ageYears: string; ageYear: string};

export type ArkTimeLeftText = {
    title: string;
    /** "About 3-9 Ark days". */
    value: string;
    reasons: string[];
    hint: string;
    /** For a screen reader: the title and the value. */
    label: string;
};

function fill(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** A count of Ark days as the panel's units say it: "3-9 Ark days", "1 Ark day", "2-4 Ark years" (a range is one number string). */
function unitValue(low: number, high: number, capped: boolean, units: ArkTimeLeftUnitWords, locale: string): string {
    const years = high >= 1000 && low >= 180;
    const part = (days: number) => {
        if (!years) return Math.round(days).toLocaleString(locale);
        const y = days / ARK_YEAR;
        return y.toLocaleString(locale, {maximumFractionDigits: y < 10 ? 1 : 0});
    };
    const a = part(low);
    const b = `${part(high)}${capped ? "+" : ""}`;
    const range = a === b ? a : `${a}–${b}`;
    const one = !capped && a === b && (years ? Math.abs(low / ARK_YEAR - 1) < 0.05 : Math.round(low) === 1);
    if (years) return one ? units.ageYear : fill(units.ageYears, {years: range});
    return one ? units.ageDay : fill(units.ageDays, {days: range});
}

function listOf(names: string[], locale: string): string {
    try {
        return new Intl.ListFormat(locale, {style: "long", type: "conjunction"}).format(names);
    } catch {
        return names.join(", ");
    }
}

/** The panel's lines for an estimate, in the reader's words (never gendered: no pronoun for the animal, nouns for causes). */
export function arkTimeLeftText(result: ArkTimeLeft, words: ArkTimeLeftWords, units: ArkTimeLeftUnitWords, locale: string): ArkTimeLeftText {
    const value = fill(words.about, {value: unitValue(result.lowDays, result.highDays, result.capped, units, locale)});
    const reasons = result.reasons.flatMap((reason): string[] => {
        switch (reason.kind) {
            case "age": {
                const span = unitValue(reason.lifespanLowDays, Math.max(reason.lifespanHighDays, reason.lifespanLowDays), false, units, locale);
                return [fill(reason.estimate ? words.reasonAgeEstimate : words.reasonAge, {span})];
            }
            case "hunger":
                return [words.reasonHunger];
            case "hunted":
                return [fill(words.reasonHunted, {predators: listOf(reason.predators.map((p) => p.name), locale)})];
            case "safe":
                return [fill(words.reasonSafe, {day: reason.untilArkDay.toLocaleString(locale)})];
            case "skill":
                return [words.reasonSkill ?? ARK_TIME_LEFT_SKILL_ENGLISH];
            default:
                return [];
        }
    });
    return {title: words.title, value, reasons, hint: words.hint, label: `${words.title}: ${value}`};
}

/** The English words, for a bundle that lacks them (the loader's English fallback fills the rest). */
export const ARK_TIME_LEFT_ENGLISH: ArkTimeLeftWords = {
    title: "Estimated time left",
    about: "About {value}",
    hint: "A likely range from odds, not a promise. 1 Ark day is about 55 real minutes.",
    reasonAge: "Typical lifespan: {span}",
    reasonAgeEstimate: "Typical lifespan, estimated: {span}",
    reasonHunted: "Predators here: {predators}",
    reasonHunger: "Hunger: no recent meal",
    reasonSkill: "Released: still learning to find food",
    reasonSafe: "Hunting protection until Ark day {day}"
};

/** The skill line's English (Release to the Wild), for a words object built without it. */
export const ARK_TIME_LEFT_SKILL_ENGLISH = "Released: still learning to find food";

/** The panel's words from a bundle (`ark.timeLeft`, `ark.life`), English key by key where one is missing. */
export function arkTimeLeftWordsFrom(timeLeft: unknown, life: unknown): {words: ArkTimeLeftWords; units: ArkTimeLeftUnitWords} {
    const pick = <T extends Record<string, string>>(english: T, source: unknown): T => {
        const own = source && typeof source === "object" ? (source as Record<string, unknown>) : {};
        const out: Record<string, string> = {...english};
        for (const key of Object.keys(english)) {
            const value = own[key];
            if (typeof value === "string" && value.trim()) out[key] = value;
        }
        return out as T;
    };
    const own = timeLeft && typeof timeLeft === "object" ? (timeLeft as Record<string, unknown>).reasonSkill : null;
    return {
        words: {...pick(ARK_TIME_LEFT_ENGLISH, timeLeft), ...(typeof own === "string" && own.trim() ? {reasonSkill: own} : {})},
        units: pick({ageDays: "{days} Ark days", ageDay: "1 Ark day", ageYears: "{years} Ark years", ageYear: "1 Ark year"}, life)
    };
}

// MARK: Hooks (decision 389: leave them, do not fake them)

/**
 * Wild skill (P1-8, Release to the Wild) is built: `ark-release-time-left.ts` makes the hook for one released animal
 * from the public read of its release (`/api/ark/release`: the day and its skill), and the card's panel adds it for
 * that animal only (`ark-time-left.tsx`). Wounds (E5) will add a survival curve and a reason once the engine has them
 * and the read publishes what they need. Nothing applies to every animal, so this list is empty.
 */
export const ARK_TIME_LEFT_HOOKS: readonly ArkTimeLeftHook[] = [];
