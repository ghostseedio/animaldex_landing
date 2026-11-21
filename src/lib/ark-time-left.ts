/**
 * "Estimated time left" on the Ark's info panel (owner decision 389, `docs/ark/audits/ecosystem-audit-2026-11-18.md`
 * sections 2.1 and 2.2): a RANGE of Ark days, months or years an animal is likely to have, and the reasons behind it,
 * for EVERY animal (owner 2026-11-20, lane ark-age-timeleft), beside its AGE and life stage (`arkLifeOutlook`: one
 * compact block with a life bar, born, now, likely end). Pure and client-safe; loaded lazily, once an animal is on screen.
 *
 * What it is made of: probabilities only, from public, already-released facts.
 *
 * - It reads the public snapshot's fields of the animal and of the animals around it (`ARK_TIME_LEFT_ANIMAL_FIELDS`,
 *   `ARK_TIME_LEFT_WORLD_FIELDS`: all of them in the released `voyage_public` read, live since AnimalDex migration
 *   20261203150000, which publishes `voyage.hunt_grace`, `lifespan_days_hi` and a hunter's `hunt_interval_days`) and species
 *   facts (what eats what: `/api/ark/food-chain`; body size: the catalogue's stats). It NEVER reads, rebuilds or
 *   guesses the server's random draws (an animal's drawn death day, a hunt's draw, the seed), the next hunt of any
 *   predator, a decided-but-unreleased event or the launch ramp's per-animal hash: the engine's `naturalDeathDay`,
 *   `rngFor`, `hashUnit` and `voyage_hunting_v1` are not used here, and `ark-time-left.test.ts` checks that no field
 *   outside the lists is touched and that a planted secret changes nothing.
 * - Each number is the engine's own (`ark-time-left-constants.ts`, checked against the engine's source by the test).
 *
 * Who is "at risk" (any one is enough; it sets the block's warm tone and what the reasons say; the estimate itself
 * is shown for everyone):
 * - old: the read's `condition` is "old" (the server's own flag, 4/5 of the wild lifespan gone), or the age the engine
 *   counts is at that share of the lifespan;
 * - hunted: the animal lives in the wild ecology (not kept: a house, a farm or the zoo are fed by their keepers), at
 *   least `PREY_FLOOR` (3) of its kind are in its hunting region (below that the engine never hunts the kind), a
 *   predator of its kind lives in that region, and the hunting protection has ended (nothing hunts it before that);
 * - starving: the read's `condition` is "hungry" and its kind eats catalogue animals (only such a kind can starve:
 *   herbivores and ambient-fed animals never do), and it is not kept: a house, a farm and the zoo are outside the wild
 *   ecology both ways (the engine's `keptFed`), so a kept animal's only way out is old age.
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
 *   engine's allometric interval from the predator's mass, or the interval the read publishes for a hunter; the class,
 *   endotherm or not, is not always in the read, so both are tried), and takes one of the animals it can take in that
 *   region: the chance it is this one is 1 / (those animals in the region, among kinds above the floor). Misses cost one
 *   15-Ark-minute step. The hazard starts when the hunting protection ends (the launch grace and its ramp, `voyage.hunt_grace`,
 *   published by the read: only its END and ramp length, never an animal's own start; with no figure published the
 *   hunting factor is OFF, never assumed).
 *   The range is the 25th percentile of the time to the first of these under the harsher bounds to the 75th percentile
 *   under the kinder ones (the middle half of the likely outcomes).
 *
 * Hooks (decision 389): an `ArkTimeLeftHook` returns an extra survival curve and a reason, or null. `skill` (P1-8, wild
 * skill: a released animal still learning to find food) is built, in `ark-release-time-left.ts`; `wounds` (E5) is not
 * yet (no engine behaviour exists for it, and it is not faked). `safe` for decision 389 D4 (the 26-Ark-day window of the last wild animal of a kind) is the same
 * hook once the server publishes it (`safe_until_ark_day`).
 */

import {arkIsHuman} from "@/lib/ark-human";
import type {ArkAnimal, ArkSnapshot, ArkThrive} from "@/ark-scene/types";
import {arkStats, massFromSize} from "@/ark-scene/stats";
import {arkHuntingRegion} from "@/lib/ark-food-chain";
import {arkDirection} from "@/lib/ark-languages";
import {arkDaysToMs, arkHumanDays, arkHumanSpan, arkHumanUnit} from "@/lib/ark-human-time";
import {
    ADULT_AGE,
    ARK_DAYS_PER_REAL_DAY,
    HUMAN_GROWN_DAYS,
    HUMAN_LIFE_FACTOR,
    HUMAN_SPECIES_IDS,
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
 * The animal fields this module may read (the snapshot's `animals[]`). `lifespan_days_hi` and `hunt_interval_days` are
 * published by the live read (AnimalDex migration 20261203150000) and optional: an older server lacks them and they are
 * then simply not used.
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
    "hunt_interval_days",
    "scientific_name",
    "thrive"
] as const;

/** The world fields it may read: the snapshot's Ark day, its animals, and the hunting protection's end and ramp. */
export const ARK_TIME_LEFT_WORLD_FIELDS = ["arkDay", "animals", "huntGrace"] as const;

/** The snapshot's own top-level fields `arkTimeLeftWorldOf` reads (`hunt_grace`: the read's `voyage.hunt_grace`, live, optional). */
export const ARK_TIME_LEFT_SNAPSHOT_FIELDS = ["ark_day", "animals", "hunt_grace"] as const;

/** Optional: the fields above that a server older than migration 20261203150000 does not send (then not used, never guessed). */
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
> &
    Partial<Pick<ArkAnimal, "scientific_name" | "thrive">>;


export type ArkTimeLeftWorld = {
    /** The snapshot's Ark day (`ark_day`). */
    arkDay: number | null;
    /** The snapshot's animals around it. */
    animals: readonly ArkTimeLeftAnimal[];
    /**
     * `voyage.hunt_grace` (live): the Ark day the launch grace ends (no animal is hunted before it) and the days over
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

/** The engine's `adultAgeDays` for a kind with a stored lifespan, or (null) without one: the default of a year. */
export function arkAdultAgeFor(lowDays: number | null, highDays: number | null): number {
    if (lowDays === null || highDays === null) return clamp(ADULT_AGE.defaultDays, ADULT_AGE.minDays, ADULT_AGE.maxDays);
    return arkAdultAgeDays(lowDays, highDays);
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

/** What an animal's age is made of, from the snapshot's own fields: its lifespan (lower end, upper end if published) and its days. */
type AgeParts = {low: number | null; published: number | null; highMid: number | null; adultDays: number; sinceBornDays: number; ageDays: number};

/**
 * The age the engine counts (`effectiveBirth`: an arrival counts as grown on arrival, `adultAgeDays` older than the days
 * it has been aboard; the young are counted from their born day), or null when the read has no born day or no Ark day.
 */
function ageParts(animal: ArkTimeLeftAnimal, arkDay: number | null): AgeParts | null {
    if (!finite(animal.born_ark_day) || arkDay === null) return null;
    const low = finite(animal.lifespan_days) && animal.lifespan_days > 0 ? animal.lifespan_days : null;
    const published = low !== null && finite(animal.lifespan_days_hi) && animal.lifespan_days_hi >= low ? animal.lifespan_days_hi : null;
    const highMid = low === null ? null : published ?? low * LIFESPAN_HI_OVER_LO.median;
    // A human is grown at 18 Ark years (the server's courtship rule), whatever the engine's default for a kind with no lifespan.
    const adultDays = arkIsHuman(animal) ? HUMAN_GROWN_DAYS : arkAdultAgeFor(low, highMid);
    const sinceBornDays = Math.max(arkDay - animal.born_ark_day, 0);
    return {low, published, highMid, adultDays, sinceBornDays, ageDays: sinceBornDays + (animal.origin === "arrived" ? adultDays : 0)};
}

type AgeFactor = {pess: Curve; opt: Curve; mid: Curve; reason: ArkTimeLeftReason; lowDays: number; highDays: number; ageDays: number; sinceBornDays: number; assumed: boolean};

/** Age against the wild lifespan, or null when the read has no lifespan or no born day. */
function ageFactor(animal: ArkTimeLeftAnimal, arkDay: number | null): AgeFactor | null {
    const parts = ageParts(animal, arkDay);
    if (!parts || parts.low === null || parts.highMid === null) return null;
    if (arkIsHuman(animal)) return humanAgeFactor(animal, parts);
    const {low, published, highMid, ageDays: age, sinceBornDays: sinceBorn} = parts;
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
        // The middle: the published upper end, else the middle of the engine's stored spread (the chance's own curve).
        mid: curve(highMid),
        reason: {kind: "age", lifespanLowDays: low, lifespanHighDays: highMid, estimate: animal.lifespan_estimate === true || assumed},
        lowDays: low,
        highDays: highMid,
        ageDays: age,
        sinceBornDays: sinceBorn,
        assumed
    };
}

/**
 * A human (decision 442; the read sends its Prime lifespan only while `human_old_age` is on): its condition band's share f
 * of the life (`HUMAN_LIFE_FACTOR`; the read's `thrive`, Ordinary without it). One born aboard dies at S x f, S uniform over
 * the Prime range: the usual curve over [lo x f, hi x f]. An arrival came at an unknown point of its adult life, so what it
 * had left on arrival is uniform between 0 and (S - 18 years) x f; given the days it has already lived aboard, the curve is
 * that spread's survival, conditioned on having lived them. One curve (no harsher or kinder bound: the rule is the rule).
 */
function humanAgeFactor(animal: ArkTimeLeftAnimal, parts: AgeParts): AgeFactor {
    const f = HUMAN_LIFE_FACTOR[animal.thrive ?? "ordinary"] ?? HUMAN_LIFE_FACTOR.ordinary;
    const lo = parts.low!;
    const hi = parts.published ?? lo;
    let curve: Curve;
    if (animal.origin !== "arrived") {
        const x = Math.max(lo * f - parts.ageDays, 0);
        const y = Math.max(hi * f - parts.ageDays, x + MIN_SPAN_DAYS);
        curve = (t) => (t < x ? 1 : t >= y ? 0 : (y - t) / (y - x));
    } else {
        // P(left on arrival > r), averaged over S: E_S[max(0, 1 - r / ((S - grown) x f))].
        const N = 64;
        const spans = Array.from({length: N}, (_, i) => Math.max((lo + ((i + 0.5) / N) * (hi - lo) - HUMAN_GROWN_DAYS) * f, MIN_SPAN_DAYS));
        const over = (r: number) => spans.reduce((sum, span) => sum + Math.max(0, 1 - r / span), 0) / N;
        const lived = parts.sinceBornDays;
        const base = Math.max(over(lived), 1e-9);
        curve = (t) => over(lived + t) / base;
    }
    return {
        pess: curve,
        opt: curve,
        mid: curve,
        reason: {kind: "age", lifespanLowDays: lo * f, lifespanHighDays: hi * f, estimate: true},
        lowDays: lo * f,
        highDays: hi * f,
        ageDays: parts.ageDays,
        sinceBornDays: parts.sinceBornDays,
        assumed: true
    };
}

// MARK: Age and life stage

/** Where an animal is in its life: young (not yet grown), grown, or old (the read's `old`, or the same share of its lifespan gone). */
export type ArkLifeStage = "young" | "adult" | "old";

export type ArkAge = {
    /** The age the engine counts, in Ark days (`effectiveBirth`). */
    ageDays: number;
    /** The Ark days since it was born or came aboard. */
    sinceBornDays: number;
    /** When it counts as grown (`adultAgeDays`). */
    adultAgeDays: number;
    /** An arrival: counted grown on arrival, so its age is the engine's rule, not a birthday: said "about". */
    assumed: boolean;
    /**
     * A human arrival: only known to be grown (18 Ark years), never guessed (not from its photo or anything else), so its age
     * is a floor, the grown age plus the days aboard: said "at least".
     */
    atLeast: boolean;
    stage: ArkLifeStage;
};

/**
 * An animal's age and life stage from the released facts only (its born or boarded Ark day, its origin, its kind's
 * lifespan, the read's `condition`): the same `effectiveBirth` rule the estimate uses. Null when the read has no born
 * day or no Ark day. "Old" is the read's own flag, or the engine's earliest old (`oldLifeFrac` of the lower end of the
 * lifespan gone, counted from the same effective birth); never the animal's own drawn death day, which is not read.
 */
export function arkAgeOf(animal: ArkTimeLeftAnimal, arkDay: number | null): ArkAge | null {
    const parts = ageParts(animal, arkDay);
    if (!parts) return null;
    const old = animal.condition === "old" || (parts.low !== null && parts.ageDays >= OLD_LIFE_FRACTION * parts.low);
    return {
        ageDays: parts.ageDays,
        sinceBornDays: parts.sinceBornDays,
        adultAgeDays: parts.adultDays,
        assumed: animal.origin === "arrived",
        atLeast: animal.origin === "arrived" && arkIsHuman(animal),
        stage: old ? "old" : parts.ageDays < parts.adultDays ? "young" : "adult"
    };
}

type HuntFactor = {
    pess: Curve;
    opt: Curve;
    /** The middle (the chance's own curve): the mean of the two hazards, the start spread evenly over the ramp (the public length of it, never an animal's own start). */
    mid: Curve;
    predators: Array<{name: string; count: number; hazard: number}>;
    startsInDays: number;
    classTried: boolean;
    /** Its place in the order its kind is taken in (see `victimRank`). */
    rank: VictimRank;
};

/**
 * Where an animal stands among the animals of its kind in its hunting region, in the order a predator takes them (the
 * engine's `rankPrey`, `thrive.ts`): `below` of them are taken before it, `group` (itself included) cannot be told apart
 * from public facts, `n` are in the pool. `thriveKnown`: every one of them carries its thrive band, so the order is the
 * band's (ordinary, then good, then prime), the young and the old before prime-age adults within a band; the within-band
 * order by condition is not public, so those tied are one group. Without the bands the engine's own victim rule
 * ("youngest") orders them by their born day.
 */
export type VictimRank = {below: number; group: number; n: number; thriveKnown: boolean};

const BAND_RANK: Record<"ordinary" | "good" | "prime", number> = {ordinary: 0, good: 1, prime: 2};

export function victimRank(animal: ArkTimeLeftAnimal, pool: readonly ArkTimeLeftAnimal[], arkDay: number | null): VictimRank {
    const thriveKnown = pool.every((other) => other.thrive != null);
    // Lower is taken sooner. Band, then young-or-old before a prime-age adult; or the youngest first.
    const key = (a: ArkTimeLeftAnimal): number => {
        if (!thriveKnown) return -(finite(a.born_ark_day) ? a.born_ark_day : 0);
        const stage = arkAgeOf(a, arkDay)?.stage;
        return BAND_RANK[a.thrive ?? "ordinary"] * 2 + (stage === "adult" ? 1 : 0);
    };
    const mine = key(animal);
    let below = 0;
    let group = 0;
    for (const other of pool) {
        const k = key(other);
        if (k < mine) below += 1;
        else if (k === mine) group += 1;
    }
    return {below, group: Math.max(group, 1), n: pool.length, thriveKnown};
}

/** The chance a Poisson count with mean `mu` is below `r` (r >= 1): the chance the r-th catch has not come yet. */
export function poissonBelow(r: number, mu: number): number {
    if (!(mu > 0)) return 1;
    if (r > mu + 12 * Math.sqrt(mu) + 20) return 1;
    if (mu > 60) {
        // The normal approximation with a continuity correction (the Abramowitz-Stegun erf).
        const z = (r - 0.5 - mu) / Math.sqrt(mu) / Math.SQRT2;
        const x = Math.abs(z);
        const t = 1 / (1 + 0.3275911 * x);
        const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
        return Math.min(1, Math.max(0, 0.5 * (1 + (z < 0 ? -erf : erf))));
    }
    let term = Math.exp(-mu);
    let sum = term;
    for (let j = 1; j < r; j++) {
        term *= mu / j;
        sum += term;
    }
    return Math.min(1, sum);
}

function hunters(animal: ArkTimeLeftAnimal, world: ArkTimeLeftWorld, facts: ArkTimeLeftFacts): HuntFactor | null {
    const grace = world.huntGrace;
    if (!grace || !finite(world.arkDay) || !finite(grace.endsArkDay) || arkIsHuman(animal)) return null;
    const region = arkTimeLeftRegion(animal);
    if (region === null || !facts.predators.length) return null;
    const own = arkTimeLeftKind(animal);
    // The pool by kind in its region (kept animals are out of it); its own kind must stand at or above the floor.
    const pool = new Map<string, number>();
    const predatorAnimals = new Map<string, ArkTimeLeftAnimal[]>();
    const ownAnimals: ArkTimeLeftAnimal[] = [];
    const wanted = new Set(facts.predators.map((p) => p.id.toLowerCase()));
    for (const other of world.animals) {
        if (arkTimeLeftRegion(other) !== region) continue;
        const kind = arkTimeLeftKind(other);
        pool.set(kind, (pool.get(kind) ?? 0) + 1);
        if (kind === own) ownAnimals.push(other);
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
    // The catches on its kind come at `n` times one animal's rate (the share of each predator's catches that land on the kind);
    // the one at place r of the order is taken at the r-th of them, so its chance to be alive is that fewer than r have come.
    const rank = victimRank(animal, ownAnimals, world.arkDay);
    const n = Math.max(pool.get(own) ?? 0, 1);
    const hazardMid = (harsh + kinder) / 2;
    const STARTS = 16;
    const SPOTS = Math.min(rank.group, 6);
    const spot = (i: number) => rank.below + 1 + Math.floor(((i + 0.5) * rank.group) / SPOTS);
    return {
        // (the weakest place of its group and the earliest start with the harsher rate; the strongest place and the latest start with the kinder)
        pess: (t) => poissonBelow(rank.below + 1, harsh * n * Math.max(t - startHarsh, 0)),
        opt: (t) => poissonBelow(rank.below + rank.group, kinder * n * Math.max(t - startKind, 0)),
        mid: (t) => {
            let sum = 0;
            for (let i = 0; i < STARTS; i++) {
                const mu = hazardMid * n * Math.max(t - (startHarsh + ((i + 0.5) / STARTS) * (startKind - startHarsh)), 0);
                for (let k = 0; k < SPOTS; k++) sum += poissonBelow(spot(k), mu);
            }
            return sum / (STARTS * SPOTS);
        },
        rank,
        predators: rows,
        startsInDays: startHarsh,
        classTried
    };
}

// MARK: At risk

/** Hunger can end only a wild animal: a house, a farm and the zoo feed theirs (the engine's `keptFed`, outside the wild ecology). */
function hungerApplies(animal: Pick<ArkTimeLeftAnimal, "condition" | "area" | "island" | "zone" | "species_profile_id" | "kind_species_profile_id" | "model_slug" | "scientific_name">): boolean {
    return animal.condition === "hungry" && arkTimeLeftRegion(animal) !== null && !arkIsHuman(animal);
}

/**
 * Which risks apply to this animal (empty: not at risk). `facts` may be null (not read yet or unreadable): then only the
 * risks that need none are found.
 */
export function arkAtRisk(animal: ArkTimeLeftAnimal, world: ArkTimeLeftWorld, facts: ArkTimeLeftFacts | null = null): ArkRiskKind[] {
    const out: ArkRiskKind[] = [];
    const age = ageFactor(animal, world.arkDay);
    // The read's own flag, and its rule again (4/5 of the lower end since born or boarded), because "hungry" hides "old" in the read.
    if (animal.condition === "old" || (age !== null && age.sinceBornDays >= OLD_LIFE_FRACTION * age.lowDays)) out.push("old");
    if (facts) {
        const hunt = hunters(animal, world, facts);
        if (hunt && hunt.startsInDays <= 0) out.push("hunted");
        if (hungerApplies(animal) && facts.eatsAnimals) out.push("starving");
    }
    return out;
}

/**
 * Whether the species facts are worth reading for this animal at all: only a hungry one (does its kind eat animals?) or
 * one that could be hunted (wild, and the hunting protection is known). Everything else is decided without them.
 */
export function arkNeedsFacts(animal: ArkTimeLeftAnimal, world: ArkTimeLeftWorld): boolean {
    if (arkIsHuman(animal)) return false;
    if (hungerApplies(animal)) return true;
    return Boolean(world.huntGrace) && arkTimeLeftRegion(animal) !== null;
}

/**
 * The estimate for one animal, or null when it is not at risk (unless `everyone`: the panel's mode, an estimate for any
 * animal that has something to bound its time) or nothing is known to bound its time.
 */
export function arkTimeLeft(
    animal: ArkTimeLeftAnimal,
    world: ArkTimeLeftWorld,
    facts: ArkTimeLeftFacts | null = null,
    hooks: readonly ArkTimeLeftHook[] = [],
    options: {everyone?: boolean} = {}
): ArkTimeLeft | null {
    const atRisk = arkAtRisk(animal, world, facts);
    // A hook's own risk (a released animal still learning to find food) is a risk too.
    const extra = hooks.map((hook) => hook(animal, world)).filter((x): x is NonNullable<typeof x> => x !== null);
    if (!atRisk.length && !extra.length && !options.everyone) return null;
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
    if (age && (options.everyone || atRisk.includes("old") || ageMoves || (!hunt && !starving && !extra.length))) reasons.push(age.reason);
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

// MARK: The chance to live another Ark year

/** The horizon of the chance: one Ark year. */
export const ARK_CHANCE_HORIZON_DAYS = ARK_YEAR;
/** "A day ago" is a real day: 365 / 14 Ark days. */
export const ARK_CHANCE_TREND_DAYS = ARK_DAYS_PER_REAL_DAY;

export type ArkChanceFactor = "age" | "hunted" | "hunger" | "extra";

/**
 * The chance an animal is still alive one Ark year from now, from the same factors and curves as the time-left estimate,
 * but their middle (the published or the middle upper end of the lifespan, the mean of the two hunting hazards with the
 * start spread over the public ramp, a hungry predator's chance to eat before it starves, a hook's curve): one number.
 * Pure: the animal's and the world's released fields, the species facts, nothing seeded and nothing unreleased. Each factor
 * exists only where its inputs are published (the lifespan, the hunting protection, a hungry hunter's condition): a switch
 * that is off publishes nothing and the factor is simply absent (food level, egg predators and a carer's absence, decision
 * 418, have no public input yet and no factor).
 */
export type ArkChance = {
    /** 0 to 1. */
    chance: number;
    /** The whole percent shown: from 1 to 99, an estimate is never sure. */
    percent: number;
    /** Each factor's hazard over the horizon (minus the log of its chance to live): 0 where it does not apply. */
    hazards: Record<ArkChanceFactor, number>;
    /** What to say for each factor that applies. */
    reasons: Record<ArkChanceFactor, ArkTimeLeftReason | null>;
    /** How many predators of its kind's hunters live in its range now. */
    predators: number;
    /** The factor that takes the most (at least 1 in 100), as its reason: null when nothing does. */
    main: ArkTimeLeftReason | null;
};

/** The change since a day ago: whole percentage points, and the factor that moved the most. */
export type ArkChanceTrend = {change: number; cause: ArkTimeLeftReason | null};

/** The animals and the Ark day of `days` ago, as the released state says: those not yet born or aboard then are left out (a death in between is not known, so not added back). */
export function arkWorldBefore(world: ArkTimeLeftWorld, days: number): ArkTimeLeftWorld | null {
    if (!finite(world.arkDay)) return null;
    const then = world.arkDay - days;
    return {...world, arkDay: then, animals: world.animals.filter((other) => !finite(other.born_ark_day) || other.born_ark_day <= then)};
}

/** A hungry predator's middle curve: it starves after `span` days of hunger unless it makes a catch first (at its own meal interval and its published success). */
function hungerMid(animal: ArkTimeLeftAnimal): Curve {
    const mass = massOf(animal);
    const span = arkStarveDays(mass);
    const interval = arkMealIntervalDays(mass);
    const rate = 1 / catchPeriodDays((interval.endo + interval.ecto) / 2, arkHuntSuccess(arkTimeLeftKind(animal)));
    return (t) => 1 - (1 - Math.exp(-rate * Math.min(t, span))) / (rate * span);
}

/** The chance for one animal now, or null where nothing bounds its life (as `arkTimeLeft`). */
export function arkChanceOf(animal: ArkTimeLeftAnimal, world: ArkTimeLeftWorld, facts: ArkTimeLeftFacts | null = null, hooks: readonly ArkTimeLeftHook[] = []): ArkChance | null {
    const age = ageFactor(animal, world.arkDay);
    const hunt = facts ? hunters(animal, world, facts) : null;
    const starving = facts !== null && facts.eatsAnimals && hungerApplies(animal);
    const extra = hooks.map((hook) => hook(animal, world)).filter((x): x is NonNullable<typeof x> => x !== null);
    if (!age && !hunt && !starving && !extra.length) return null;
    const T = ARK_CHANCE_HORIZON_DAYS;
    const lives: Record<ArkChanceFactor, number> = {
        age: age ? age.mid(T) : 1,
        hunted: hunt ? hunt.mid(T) : 1,
        hunger: starving ? hungerMid(animal)(T) : 1,
        extra: extra.reduce((product, e) => product * e.survival(T), 1)
    };
    const hazards: Record<ArkChanceFactor, number> = {age: 0, hunted: 0, hunger: 0, extra: 0};
    for (const key of Object.keys(lives) as ArkChanceFactor[]) hazards[key] = Math.max(0, -Math.log(clamp(lives[key], 1e-6, 1)));
    const reasons: Record<ArkChanceFactor, ArkTimeLeftReason | null> = {
        age: age ? age.reason : null,
        hunted: hunt ? {kind: "hunted", predators: hunt.predators.slice(0, 3).map(({name, count}) => ({name, count}))} : null,
        hunger: starving ? {kind: "hunger"} : null,
        extra: extra.length ? extra[0].reason : null
    };
    const chance = clamp(lives.age * lives.hunted * lives.hunger * lives.extra, 0, 1);
    let top: ArkChanceFactor | null = null;
    for (const key of ["age", "hunted", "hunger", "extra"] as const) if (reasons[key] && hazards[key] >= -Math.log(0.99) && (top === null || hazards[key] > hazards[top])) top = key;
    return {
        chance,
        percent: clamp(Math.round(chance * 100), 1, 99),
        hazards,
        reasons,
        predators: hunt ? hunt.predators.reduce((sum, p) => sum + p.count, 0) : 0,
        main: top ? reasons[top] : null
    };
}

/**
 * The chance now against the chance a day ago (a real day), the Ark as the released state says it was: each animal a day
 * younger, those that arrived or were born since not there yet, the same condition. Null when the animal itself was not
 * there yet, or nothing bounded its life then. The cause is the factor whose hazard moved the most.
 */
export function arkChanceTrend(animal: ArkTimeLeftAnimal, world: ArkTimeLeftWorld, facts: ArkTimeLeftFacts | null, hooks: readonly ArkTimeLeftHook[], now: ArkChance): ArkChanceTrend | null {
    const before = arkWorldBefore(world, ARK_CHANCE_TREND_DAYS);
    if (!before || !finite(animal.born_ark_day) || animal.born_ark_day > before.arkDay!) return null;
    const then = arkChanceOf(animal, before, facts, hooks);
    if (!then) return null;
    let moved: ArkChanceFactor | null = null;
    let most = 0.002;
    for (const key of ["age", "hunted", "hunger", "extra"] as const) {
        const move = Math.abs(now.hazards[key] - then.hazards[key]);
        if (move > most) {
            moved = key;
            most = move;
        }
    }
    let cause: ArkTimeLeftReason | null = null;
    if (moved === "hunted") {
        // Nobody came or went: it is the protection running out; else the predators in its range.
        const grace = world.huntGrace;
        cause = now.predators === then.predators && grace && finite(world.arkDay) && world.arkDay < grace.endsArkDay ? {kind: "safe", untilArkDay: Math.ceil(grace.endsArkDay)} : now.reasons.hunted ?? then.reasons.hunted;
    } else if (moved) {
        cause = now.reasons[moved] ?? then.reasons[moved];
    }
    return {change: now.percent - then.percent, cause};
}

// MARK: The life block: age, life stage and time left together

/**
 * Where the block's marks sit along the life bar, as 0 to 1 fractions of the bar: born is 0, the bar ends at the
 * likely end's far edge (the age plus the high end of the estimate). `now` is today; the likely end is `from` to 1.
 */
export type ArkLifeBar = {now: number; from: number};

/** The panel's block for one animal. */
export type ArkLifeOutlook = {
    age: ArkAge | null;
    left: ArkTimeLeft | null;
    /** Present when both the age and the estimate are known. */
    bar: ArkLifeBar | null;
    /** "risk" when it is at risk or old (the block's warm tone), else "plain". */
    tone: "plain" | "risk";
    /** The chance to live another Ark year (where anything bounds its life), and how it moved in a day. */
    chance: ArkChance | null;
    trend: ArkChanceTrend | null;
    /** Its thrive band (the public read's `thrive`: the band only, never a user's raw condition or steps), or null where the read has none. */
    band: ArkThrive | null;
    /**
     * Said only where the engine acts on it (a predator takes the weaker bands first, `rankPrey`: so only where hunting is
     * one of the factors): "earn" below prime (earning its Power raises its place in the order), "working" at prime.
     * Old age, hunger and a carer's absence do not depend on it, and nothing here says they do.
     */
    power: "earn" | "working" | null;
    /** A human (decision 442): its "how this is worked out" line names no predators or hunger. */
    human?: boolean;
};

/** The bar's marks for an age and an estimate (never anything outside 0 to 1). */
export function arkLifeBar(ageDays: number, left: Pick<ArkTimeLeft, "lowDays" | "highDays">): ArkLifeBar {
    const end = Math.max(ageDays + left.highDays, 1);
    return {now: clamp(ageDays / end, 0, 1), from: clamp((ageDays + left.lowDays) / end, 0, 1)};
}

/**
 * Everything the panel shows for one animal: its age and life stage, and the estimate of its time left, for EVERY
 * animal (the facts and hooks are as `arkTimeLeft`'s). Null when neither is known.
 */
export function arkLifeOutlook(animal: ArkTimeLeftAnimal, world: ArkTimeLeftWorld, facts: ArkTimeLeftFacts | null = null, hooks: readonly ArkTimeLeftHook[] = []): ArkLifeOutlook | null {
    const age = arkAgeOf(animal, world.arkDay);
    const left = arkTimeLeft(animal, world, facts, hooks, {everyone: true});
    if (!age && !left) return null;
    const risky = Boolean(left && (left.atRisk.length || left.reasons.some((reason) => reason.kind === "skill"))) || age?.stage === "old";
    const chance = arkChanceOf(animal, world, facts, hooks);
    const band = animal.thrive ?? null;
    return {
        age,
        left,
        bar: age && left ? arkLifeBar(age.ageDays, left) : null,
        tone: risky ? "risk" : "plain",
        chance,
        trend: chance ? arkChanceTrend(animal, world, facts, hooks, chance) : null,
        band,
        power: band && chance?.reasons.hunted ? (band === "prime" ? "working" : "earn") : null,
        ...(arkIsHuman(animal) ? {human: true} : {})
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
    /** Its life stage, in the block's age line: "Young", "Adult", "Old" (nouns or neutral forms: never gendered for the animal). */
    stageYoung: string;
    stageAdult: string;
    stageOld: string;
    /** "{age} old" and "about {age} old" (an arrival counts as grown on arrival: its age is a rule, so "about"): {age} is "3 Ark years". */
    ageIs: string;
    ageIsAbout: string;
    /** A human arrival's age, a floor: "at least {age} old". */
    ageIsAtLeast: string;
    /** Its age or time in months, in Ark time: "{months} Ark months", "1 Ark month". */
    ageMonths: string;
    ageMonth: string;
    /** The chance to live another Ark year ("About 72%"), its main reason, how it is worked out, and the change since a day ago ({change}: "3%"). */
    chanceTitle: string;
    chanceMain: string;
    chanceHow: string;
    /** A human's (decision 442): only its age and condition bound its life, never predators or hunger. */
    chanceHowHuman?: string;
    chanceUp: string;
    chanceDown: string;
    chanceSteady: string;
    /** "{band}: kept thriving by its owner's worked steps; it fades if they stop." ({band}: "In prime condition"). */
    thriveWhy: string;
    /** Below prime: earning its Power raises its survival chance; at prime its Power is working. */
    powerEarn: string;
    powerWorking: string;
};

/** What `ark.life` and the locale give for units: "{days} Ark days", "1 Ark day", "{years} Ark years", "1 Ark year", and the months. */
export type ArkTimeLeftUnitWords = {
    ageDays: string;
    ageDay: string;
    ageYears: string;
    ageYear: string;
    ageMonths: string;
    ageMonth: string;
    /** The card's thrive bands (`ark.life.thrivePrime` ...). */
    thrivePrime: string;
    thriveGood: string;
    thriveOrdinary: string;
};

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

/**
 * A count of Ark days in the visitor's own time (lane ARK-SIMPLE, owner 2026-11-20: never "Ark days" or "Ark years"):
 * "2–5 days", "3 hours", "4 weeks", in the unit that fits its larger end (`ark-human-time.ts`, the browser's own words in
 * every language). `units` is kept for the callers' shape; the Ark-time unit words are no longer said.
 */
function unitValue(low: number, high: number, capped: boolean, _units: ArkTimeLeftUnitWords, locale: string): string {
    const text = arkHumanDays(low, Math.max(high, low), locale, "long", capped);
    // A range of numbers in a right-to-left language is isolated, so it reads "8–32", not "32–8".
    return arkDirection(locale) === "rtl" && /[–-]/.test(text) ? `\u2066${text}\u2069` : text;
}

/**
 * One age in the visitor's own time ("3 hours", "2 days", "4 weeks"). A floor ("at least") is rounded down, so it never
 * says more than is known.
 */
function ageValue(days: number, mode: "exact" | "about" | "atLeast", _units: ArkTimeLeftUnitWords, locale: string): string {
    const ms = arkDaysToMs(Math.max(days, 0));
    if (mode !== "atLeast") return arkHumanSpan(ms, ms, locale);
    const {size} = arkHumanUnit(ms);
    const floor = Math.max(1, Math.floor(ms / size + 1e-9)) * size;
    return arkHumanSpan(floor, floor, locale);
}

function listOf(names: string[], locale: string): string {
    try {
        return new Intl.ListFormat(locale, {style: "long", type: "conjunction"}).format(names);
    } catch {
        return names.join(", ");
    }
}

/** One reason in words (none for a reason this build has no words for). */
function reasonLine(reason: ArkTimeLeftReason, words: ArkTimeLeftWords, units: ArkTimeLeftUnitWords, locale: string): string[] {
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
}

/** The panel's lines for an estimate, in the reader's words (never gendered: no pronoun for the animal, nouns for causes). */
export function arkTimeLeftText(result: ArkTimeLeft, words: ArkTimeLeftWords, units: ArkTimeLeftUnitWords, locale: string): ArkTimeLeftText {
    const value = fill(words.about, {value: unitValue(result.lowDays, result.highDays, result.capped, units, locale)});
    const reasons = result.reasons.flatMap((reason) => reasonLine(reason, words, units, locale));
    return {title: words.title, value, reasons, hint: words.hint, label: `${words.title}: ${value}`};
}

/** "Adult · about 3 Ark years old", "Young · 4 Ark months old": the life stage and the age, in Ark time. */
export function arkAgeText(age: ArkAge, words: ArkTimeLeftWords, units: ArkTimeLeftUnitWords, locale: string): string {
    const stage = age.stage === "young" ? words.stageYoung : age.stage === "old" ? words.stageOld : words.stageAdult;
    const mode = age.atLeast ? "atLeast" : age.assumed ? "about" : "exact";
    const said = mode === "atLeast" ? words.ageIsAtLeast : mode === "about" ? words.ageIsAbout : words.ageIs;
    return `${stage} · ${fill(said, {age: ageValue(age.ageDays, mode, units, locale)})}`;
}

/** The chance to live another Ark year in words. */
export type ArkChanceText = {
    title: string;
    /** "About 72%". */
    value: string;
    /** "Down 3% vs a day ago · Predators here: Red Fox", or null when there is nothing to compare with. */
    trend: {direction: "up" | "down" | "steady"; text: string; /** The cause alone ("Predators here: Red Fox"), or null. */ cause: string | null} | null;
    /** "Main reason: Typical lifespan: 5–10 Ark years", or null when nothing takes much. */
    main: string | null;
    /** The main reason alone, as a reason line reads ("Typical lifespan: 5–10 Ark years"), or null. */
    mainReason: string | null;
    /** The "how this is worked out" line. */
    how: string;
    /** For a screen reader: the title, the value and the change. */
    label: string;
};

function percentText(percent: number, locale: string): string {
    try {
        return new Intl.NumberFormat(locale, {style: "percent", maximumFractionDigits: 0}).format(percent / 100);
    } catch {
        return `${percent}%`;
    }
}

const ARK_TIME_LEFT_ENGLISH_HOW_HUMAN = "How this is worked out: their age against a human lifespan, shortened or lengthened by their condition. An estimate, not a promise.";

export function arkChanceText(outlook: ArkLifeOutlook, words: ArkTimeLeftWords, units: ArkTimeLeftUnitWords, locale: string): ArkChanceText | null {
    const {chance, trend} = outlook;
    if (!chance) return null;
    const value = fill(words.about, {value: percentText(chance.percent, locale)});
    let said: ArkChanceText["trend"] = null;
    if (trend) {
        const direction = trend.change > 0 ? "up" : trend.change < 0 ? "down" : "steady";
        const change = fill(direction === "up" ? words.chanceUp : direction === "down" ? words.chanceDown : words.chanceSteady, {change: percentText(Math.abs(trend.change), locale)});
        const cause = trend.cause && direction !== "steady" ? reasonLine(trend.cause, words, units, locale)[0] : null;
        said = {direction, text: cause ? `${change} · ${cause}` : change, cause: cause ?? null};
    }
    const main = chance.main ? reasonLine(chance.main, words, units, locale)[0] : null;
    return {
        title: words.chanceTitle,
        value,
        trend: said,
        main: main ? fill(words.chanceMain, {reason: main}) : null,
        mainReason: main ?? null,
        how: outlook.human ? words.chanceHowHuman ?? ARK_TIME_LEFT_ENGLISH_HOW_HUMAN : words.chanceHow,
        label: [`${words.chanceTitle}: ${value}`, said ? (said.text.split(" · ")[0]) : null].filter((part): part is string => Boolean(part)).join(". ")
    };
}

export type ArkLifeText = {
    /** "Adult · about 3 Ark years old", or null when the age is not known. */
    age: string | null;
    /** The estimate's title, value, reasons and hint, or null when nothing bounds its time. */
    left: ArkTimeLeftText | null;
    /** The chance to live another Ark year, or null. */
    chance: ArkChanceText | null;
    /** "In prime condition: kept thriving by its owner's worked steps; it fades if they stop." for a thriving (good or prime) animal, else null. */
    thrive: string | null;
    /** The Power line (see `ArkLifeOutlook.power`), or null. */
    power: {kind: "earn" | "working"; text: string} | null;
    /** For a screen reader: the age line, the estimate and the chance in one sentence (the bar itself is drawn, not read). */
    label: string;
};

/** The block's lines for one animal, in the reader's words. */
export function arkLifeText(outlook: ArkLifeOutlook, words: ArkTimeLeftWords, units: ArkTimeLeftUnitWords, locale: string): ArkLifeText {
    const age = outlook.age ? arkAgeText(outlook.age, words, units, locale) : null;
    const left = outlook.left ? arkTimeLeftText(outlook.left, words, units, locale) : null;
    const chance = arkChanceText(outlook, words, units, locale);
    const band = outlook.band === "prime" ? units.thrivePrime : outlook.band === "good" ? units.thriveGood : null;
    return {
        age,
        left,
        chance,
        thrive: band ? fill(words.thriveWhy, {band}) : null,
        power: outlook.power ? {kind: outlook.power, text: outlook.power === "working" ? words.powerWorking : words.powerEarn} : null,
        label: [age, left?.label, chance?.label].filter((part): part is string => Boolean(part)).join(". ")
    };
}

/** The English words, for a bundle that lacks them (the loader's English fallback fills the rest). */
export const ARK_TIME_LEFT_ENGLISH: ArkTimeLeftWords = {
    title: "Estimated time left",
    about: "About {value}",
    hint: "A likely range from odds, not a promise.",
    reasonAge: "Typical lifespan: {span}",
    reasonAgeEstimate: "Typical lifespan, estimated: {span}",
    reasonHunted: "Predators here: {predators}",
    reasonHunger: "Hunger: no recent meal",
    reasonSkill: "Released: still learning to find food",
    reasonSafe: "Hunting protection until Ark day {day}",
    stageYoung: "Young",
    stageAdult: "Adult",
    stageOld: "Old",
    ageIs: "{age} old",
    ageIsAbout: "about {age} old",
    ageIsAtLeast: "at least {age} old",
    ageMonths: "{months} Ark months",
    ageMonth: "1 Ark month",
    chanceTitle: "Chance to live 2 more weeks",
    chanceMain: "Main reason: {reason}",
    chanceHow: "How this is worked out: its age against its kind's lifespan, the predators that can hunt its kind in its range, and hunger, from what the Ark has made public. An estimate that moves as the Ark changes, not a promise.",
    chanceHowHuman: "How this is worked out: their age against a human lifespan, shortened or lengthened by their condition. An estimate, not a promise.",
    chanceUp: "Up {change} vs a day ago",
    chanceDown: "Down {change} vs a day ago",
    chanceSteady: "Steady vs a day ago",
    thriveWhy: "{band}: kept thriving by its owner's worked steps; it fades if they stop.",
    powerEarn: "Earning its Power raises its survival chance",
    powerWorking: "Its Power is working: predators pass it over for weaker ones"
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
    const words: ArkTimeLeftWords = {...pick(ARK_TIME_LEFT_ENGLISH, timeLeft), ...(typeof own === "string" && own.trim() ? {reasonSkill: own} : {})};
    return {
        words,
        // The days and years are the card's own words (`ark.life`); the months are this block's.
        units: {
            ...pick({ageDays: "{days} Ark days", ageDay: "1 Ark day", ageYears: "{years} Ark years", ageYear: "1 Ark year", thrivePrime: "In prime condition", thriveGood: "In good condition", thriveOrdinary: "Ordinary"}, life),
            ageMonths: words.ageMonths,
            ageMonth: words.ageMonth
        }
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

export {arkIsHuman};
