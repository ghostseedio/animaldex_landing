/**
 * How fast a land animal goes about on foot, and how its going is shaped in time (behaviours pass 2026-11, lane B4;
 * docs/ark/behaviour-pass-2026-11/land.md). Visual only and pure: the same for every viewer.
 *
 * - **Natural paces** (`naturalPaces`): an everyday walk and the faster gait it covers ground in, in m/s, from the
 *   Froude number Fr = v² / (g·h) on its leg length (animals of every size walk, trot and gallop at about the same
 *   Fr: Alexander and Jayes 1983), by body plan and gait family, never past a share of its top speed (`sprintPace`:
 *   Hirt et al. 2017 and its speed stat). The schedule walked every animal at its rig's walk clip's pace in body
 *   lengths at its true size: an elephant "walked" at 3.4 m/s, a giraffe at 5.1, a giant tortoise at 0.85, and the
 *   legged driver, reading the speed, drew a trot, a pace and a run. `scripts/ark-walk-pace.mts` writes these into
 *   `behaviours.json` (`walkPace`, `runPace`) for every rig whose legs the locomotion layer draws.
 * - **Rhythm** (`gaitRhythm`): small mammals, small lizards, hopping and running birds, spiders, insects and crabs
 *   move in bursts with stops between, not at a steady stroll; so do hares, rabbits and kangaroos at their slow pace
 *   (a few hops, a sit). Its share of a walking leg spent moving, and how long its bursts and stops are.
 * - **Progress** (`groundProgress`): where along a walking leg it is at a time: speeding up over its first steps and
 *   slowing into its stop (it used to be at full speed from its first frame and stop dead), and, for a burst mover,
 *   its bursts and stops.
 * - **Turning where it stands** (`standTurnRate`): quick for a mouse, slow for an elephant.
 */

import {G, gaitFamily, landGait} from "@/ark-scene/locomotion/gaits";
import {accelTime, sprintPace} from "@/ark-scene/locomotion/flee";
import {locoStyle} from "@/ark-scene/locomotion/styles";

// MARK: Natural paces

export type PaceBody = {
    /** The rig's body plan (`rig.plan`: quadruped, primate, walking_bird, flying_bird, flightless_bird, lizard, turtle, amphibian...). */
    plan: string;
    slug: string;
    /** Its drawn length (m). */
    length: number;
    /** Its hip height over the ground (m), and a sprawling leg's reach from hip to sole (m; the legged driver's gait length). */
    hip: number;
    reach: number;
    speedStat?: number | null;
};

/** A walk's and a covering-ground gait's Froude numbers on the leg length. */
type Target = {walk: number; run: number | null};

const CROCODILIAN = /(crocodile|alligator|caiman|gharial|mugger)/;
/**
 * Slow movers whatever their size and legs say: sloths (a few centimetres a second on the ground), chameleons (a
 * rocking step at a time), lorises and pottos (hand over hand, never a leap). Body lengths a second.
 */
const SLOW = /(sloth|chameleon|slow-loris|slender-loris|potto)/;
export const SLOW_PACE = 0.09;
export const slowMover = (slug: string): boolean => SLOW.test(slug);
const PENGUIN = /penguin/;

/**
 * The Froude numbers a body walks and covers ground at. Walks: wild ungulates walk at about 1 m/s whatever their size
 * between a gazelle and a giraffe, Fr 0.07 to 0.15 (Pennycuick 1975), carnivores a little brisker; an elephant's
 * everyday walk is about 1.2 m/s (Fr under 0.1). Covering ground: the trot (Fr about 1), a bear's and a camel's pace,
 * an elephant's fast walk (it never has an aerial phase: Hutchinson et al. 2003), a small mammal's half-bound.
 */
function targetOf(body: PaceBody): Target | null {
    const land = landGait(body.slug);
    switch (body.plan) {
        case "quadruped": {
            // (True seals hump on their bellies, sea lions and the walrus walk on flippers: their own paces, below.)
            if (land === "galumph") return null;
            if (land === "flipper_gallop") return {walk: 0.05, run: 0.95};
            if (land === "flipper_walk") return {walk: 0.015, run: null};
            switch (gaitFamily(body.slug)) {
                case "ambler":
                    return {walk: 0.09, run: 0.4};
                case "pacer":
                    return {walk: 0.12, run: 0.8};
                case "bear":
                    return {walk: 0.14, run: 0.8};
                case "bounder":
                    return {walk: 0.24, run: 1.3};
                case "cat":
                case "dog":
                    return {walk: 0.2, run: 1.0};
                default:
                    return {walk: 0.15, run: 1.0};
            }
        }
        case "primate":
            return {walk: 0.15, run: 1.0};
        case "walking_bird":
        case "flying_bird":
        case "flightless_bird": {
            // (A penguin only waddles; a hopping passerine hops faster, never runs.)
            if (PENGUIN.test(body.slug)) return {walk: 0.12, run: null};
            const ground = locoStyle(body.slug, body.plan).ground?.gait;
            if (ground === "hop") return {walk: 0.22, run: null};
            if (ground === "waddle") return {walk: 0.12, run: 0.7};
            return {walk: 0.15, run: 0.9};
        }
        case "lizard":
            // (A crocodile's high walk is slow for its size; a lizard's walk a sprawl, its run the sprawling run.)
            return CROCODILIAN.test(body.slug) ? {walk: 0.05, run: 0.5} : {walk: 0.12, run: 0.8};
        case "turtle":
            // (A giant tortoise walks at about 0.3 km/h, a box turtle at 0.2: far under any gait's Froude number.)
            return {walk: 0.003, run: null};
        case "amphibian":
            // (Frogs and toads hop by their own driver, at the pace their hops make: left as their rigs have them. Newts
            // and salamanders, and frogs that walk: a slow sprawling walk.)
            return land === "crawl" || land === "walk" ? {walk: 0.05, run: land === "crawl" ? 0.45 : null} : null;
        default:
            // (Insects, spiders, crabs, bats: their rigs' own paces.)
            return null;
    }
}

/** The length a body's Froude number is read on: its hip height, or a sprawler's reach (as the legged driver reads it). */
export function gaitLengthOf(body: Pick<PaceBody, "plan" | "hip" | "reach">): number {
    const sprawling = body.plan === "lizard" || body.plan === "amphibian" || body.plan === "turtle" || body.plan === "insect" || body.plan === "arachnid" || body.plan === "crustacean";
    return Math.max(sprawling && body.reach > 0 ? body.reach : body.hip, 0.002);
}

/**
 * How much of a burst's top speed its mean is (its short speed-up and slow-down, `groundProgress`): a burst mover's
 * walking pace is its burst's speed times its share moving times this.
 */
export const BURST_MEAN = 0.77;

/** The Froude number of a burst mover's bursts: a mouse's trot, a small lizard's sprawling run, a plover's run, a sparrow's hops. */
function burstFroude(body: PaceBody): number | null {
    switch (body.plan) {
        case "quadruped":
            return 0.5;
        case "lizard":
            return 0.5;
        case "walking_bird":
        case "flying_bird":
            return locoStyle(body.slug, body.plan).ground?.gait === "hop" ? 0.3 : 0.65;
        default:
            return null;
    }
}

/**
 * A body's natural walk and covering-ground paces (m/s), or null where its rig's own paces stand (legless, insects,
 * spiders, crabs, hopping frogs, true seals). The speed stat moves both by 10% either way; neither passes a share of
 * its top speed (a third for the walk, 0.6 where it has no faster gait, three quarters for the run). A burst mover (`rhythm.share` under 1) walks, on
 * the whole, at its bursts' speed times its share moving.
 */
export function naturalPaces(body: PaceBody, rhythm: GaitRhythm = STEADY): {walk: number; run: number | null} | null {
    if (slowMover(body.slug)) return {walk: SLOW_PACE * body.length, run: null};
    const target = targetOf(body);
    if (!target) return null;
    const h = gaitLengthOf(body);
    const stat = Math.min(Math.max(body.speedStat ?? 50, 0), 100);
    const k = 0.9 + 0.2 * (stat / 100);
    const top = sprintPace({plan: body.plan, slug: body.slug, length: body.length, speedStat: body.speedStat});
    const at = (froude: number) => Math.sqrt(froude * G * h) * k;
    const burst = rhythm.share < 1 ? burstFroude(body) : null;
    // (One with no faster gait, a tortoise, a penguin, a walrus: its top speed is a walk's, so its walk is most of it.)
    const walk = burst !== null ? Math.min(at(burst), top / 2) * rhythm.share * BURST_MEAN : Math.min(at(target.walk), top * (target.run === null ? 0.6 : 1 / 3));
    const run = target.run === null ? null : Math.min(at(target.run), top * 0.75);
    // (A run worth the name is well faster than the walk: one within a third of it is no run.)
    return {walk, run: run !== null && run > walk * 1.35 ? run : null};
}

/**
 * A species with no rig's walk (body lengths a second), from the model library's plan, its name, its length and its
 * speed stat: the same rule on its plan's usual leg length (a mammal's hip about 0.3 of its length, a bird's 0.35, a
 * lizard's reach 0.2, a turtle's 0.25). Without one the schedule walked it by its speed stat in body lengths, at any
 * size: a three-metre crocodile at 4 m/s, a snail at 13 cm/s. Null: no rule for its plan (its stat's pace stands).
 */
export function unriggedWalk(slug: string, modelPlan: string | null | undefined, length: number, speedStat: number | null | undefined): number | null {
    const L = Math.max(length, 0.002);
    const rhythm = gaitRhythm(slug, modelPlan, L);
    const of = (plan: string, share: number) => {
        const paces = naturalPaces({plan, slug, length: L, hip: share * L, reach: share * L, speedStat}, rhythm);
        return paces ? paces.walk / L : null;
    };
    switch (modelPlan) {
        case "mammal":
            return of("quadruped", 0.3);
        case "bird":
            return of("walking_bird", 0.35);
        case "reptile":
            return of("lizard", 0.2);
        case "turtle":
            return of("turtle", 0.25);
        case "snake":
            return Math.min(0.3, 0.5 / L);
        case "worm":
            return 0.06;
        case "slow_invertebrate":
            // (A snail or a slug: about a millimetre or two a second.)
            return Math.min(0.015, 0.003 / L);
        default:
            return null;
    }
}

// MARK: Rhythm

/**
 * How a walking leg is spent: `share` of it moving (1: a steady walk), in bursts of about `burst` seconds with stops
 * between (each seeded 0.6 to 1.4 of its length).
 */
export type GaitRhythm = {share: number; burst: number};
const STEADY: GaitRhythm = {share: 1, burst: 0};

/** Hares, rabbits, kangaroos and their kin: at their slow pace a few hops and a sit (their bound drawn at its own rate). */
const HOPPERS = /(rabbit|hare\b|hare$|-hare|jackrabbit|cottontail|kangaroo|wallaby|wallaroo|pademelon|quokka|woylie|bettong|potoroo|tenkile|springhare|jerboa|hopping-mouse)/;
/** Big lizards walk steadily; these are named so whatever their length says. */
const STEADY_REPTILES = /(crocodile|alligator|caiman|gharial|mugger|komodo|monitor|iguana|tegu|tuatara|chameleon)/;
const SPIDERS = /(spider|tarantula|scorpion|solifug|harvestman|crab\b|crab$|-crab|lobster|crayfish|woodlouse|isopod|cockroach|silverfish|earwig|centipede|tiger-beetle)/;

/**
 * A species' rhythm on foot, from the model library's plan (mammal, bird, reptile, frog, arthropod...), its name and
 * its length: the same wherever it is asked (the schedule's legs, the pace generator).
 *
 * - Small mammals (the bounders' families under half a metre: mice, voles, shrews, rats, squirrels, chipmunks, weasels,
 *   meerkats): dashes of a second or two and stops to look and sniff, about 60% of the time moving.
 * - Hares, rabbits, kangaroos, wallabies, jerboas: a few hops and a sit, half the time moving.
 * - Small lizards (under 60 cm): quick runs and long stops, 45% moving.
 * - Birds that run and stop (plovers, sandpipers, wagtails, larks, by family: the ground code `run`, under 45 cm) and
 *   birds that hop (small passerines): 55 to 60% moving.
 * - Spiders, scorpions, crabs, cockroaches and their kind: scuttles and stops, 65% moving.
 * Everything else walks steadily.
 */
export function gaitRhythm(slug: string, modelPlan: string | null | undefined, length: number): GaitRhythm {
    const L = Math.max(length, 0.002);
    switch (modelPlan) {
        case "mammal":
            if (HOPPERS.test(slug)) return {share: 0.5, burst: 1.6};
            if (L < 0.5 && gaitFamily(slug) === "bounder") return {share: 0.6, burst: 1.4};
            return STEADY;
        case "reptile":
            if (L < 0.6 && !STEADY_REPTILES.test(slug) && landGait(slug) === null) return {share: 0.45, burst: 1};
            return STEADY;
        case "bird": {
            const ground = locoStyle(slug, "bird").ground?.gait;
            if (ground === "hop") return {share: 0.6, burst: 1.2};
            if (ground === "run" && L < 0.45) return {share: 0.55, burst: 1.3};
            return STEADY;
        }
        case "arthropod":
            return SPIDERS.test(slug) ? {share: 0.65, burst: 1.5} : STEADY;
        default:
            return STEADY;
    }
}

// MARK: Progress along a leg

/** How long it takes to get up to a walk from standing, and to stop from one (s): a step or two; a run takes longer. */
export function startTime(length: number, running: boolean): number {
    return accelTime(length) * (running ? 1 : 0.55);
}
export function stopTime(length: number, running: boolean): number {
    return accelTime(length) * (running ? 0.8 : 0.45);
}

/** A leg's shape in time: its speed-up and slow-down (s; 0 where it runs on from or into another moving leg), and its rhythm. */
export type LegShape = {
    start: number;
    stop: number;
    /** Bursts and stops (a walking leg of a burst mover): the share moving, a burst's length (s), and its seed. */
    rhythm?: {share: number; burst: number; seed: number} | null;
};

const hash = (a: number, b: number) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
};

/**
 * The share of a stretch covered at `t` of `T` seconds with a speed-up of `a` and a slow-down of `b` seconds (a
 * trapezoid of speed), and its speed then in shares of the stretch a second (left in `trapRate`: no allocation, the
 * schedule asks this for every walking animal every frame).
 */
let trapRate = 0;
function trapezoid(t: number, T: number, a: number, b: number): number {
    const total = Math.max(T, 1e-6);
    let up = Math.max(a, 0);
    let down = Math.max(b, 0);
    // (Never more than the stretch: a short one is all speeding up and slowing down.)
    if (up + down > total) {
        const k = total / (up + down);
        up *= k;
        down *= k;
    }
    const u = Math.min(Math.max(t, 0), total);
    // (Its top speed, in shares of the stretch a second.)
    const peak = 1 / (total - (up + down) / 2);
    if (u < up) {
        trapRate = (peak * u) / up;
        return (0.5 * peak * u * u) / up;
    }
    if (u > total - down) {
        const w = total - u;
        trapRate = (peak * w) / down;
        return 1 - (0.5 * peak * w * w) / down;
    }
    trapRate = peak;
    return 0.5 * peak * up + peak * (u - up);
}

/** The share of a step covered at share `u` of its time, speeding up over `ramp` of it and slowing over as much (0 to 0.5). */
export function rampedShare(u: number, ramp: number): number {
    return trapezoid(u, 1, ramp, ramp);
}

export type GroundProgress = {share: number; moving: boolean; rate: number};
const PROGRESS: GroundProgress = {share: 0, moving: false, rate: 0};
const progress = (share: number, moving: boolean, rate: number): GroundProgress => {
    PROGRESS.share = share;
    PROGRESS.moving = moving;
    PROGRESS.rate = rate;
    return PROGRESS;
};

/**
 * Where along a leg it is `t` seconds into its `seconds`: the share of its way covered (0 to 1), whether it is on the
 * move, and its speed over the leg's mean (`rate`: 1 at its mean pace). A steady leg: a trapezoid of speed. A burst
 * mover's: `n` bursts with `n − 1` stops between, each burst its own short trapezoid, the bursts seeded 0.7 to 1.3 and
 * the stops 0.6 to 1.4 of their means; the first burst starts as the leg does and the last ends as it does, so the
 * leg's ends are unchanged. The result is one reused object: read it before asking again.
 */
export function groundProgress(t: number, seconds: number, shape: LegShape | null | undefined): GroundProgress {
    const T = Math.max(seconds, 1e-6);
    const u = Math.min(Math.max(t, 0), T);
    if (!shape) return progress(u / T, u < T, 1);
    const rhythm = shape.rhythm;
    const moving = T * (rhythm ? rhythm.share : 1);
    const n = rhythm ? Math.max(Math.round(moving / Math.max(rhythm.burst, 0.2)), 1) : 1;
    if (!rhythm || n < 2) {
        const share = trapezoid(u, T, shape.start, shape.stop);
        return progress(share, u < T && trapRate > 1e-4, trapRate * T);
    }
    const still = T - moving;
    let bursts = 0;
    let stops = 0;
    for (let i = 0; i < n; i++) {
        bursts += 0.7 + 0.6 * hash(rhythm.seed, i * 2 + 1);
        if (i < n - 1) stops += 0.6 + 0.8 * hash(rhythm.seed, i * 2 + 2);
    }
    let at = 0;
    let done = 0;
    for (let i = 0; i < n; i++) {
        const w = (0.7 + 0.6 * hash(rhythm.seed, i * 2 + 1)) / bursts;
        const burst = moving * w;
        if (u < at + burst || i === n - 1) {
            // (A burst gets going and stops quicker than a leg from standing: a dart.)
            const share = trapezoid(u - at, burst, Math.min(shape.start, burst * 0.3), Math.min(shape.stop, burst * 0.3));
            return progress(done + w * share, u < T && u - at < burst && trapRate > 1e-4, trapRate * w * T);
        }
        at += burst;
        done += w;
        const stop = (still * (0.6 + 0.8 * hash(rhythm.seed, i * 2 + 2))) / Math.max(stops, 1e-6);
        if (u < at + stop) return progress(done, false, 0);
        at += stop;
    }
    return progress(1, false, 0);
}

// MARK: Turning where it stands

/**
 * How fast an animal turns round where it stands before setting off (rad/s): a mouse flicks round, a horse steps
 * round in a couple of seconds, an elephant in three (about the legged driver's own body turn, 0.4·√(g/h)). The
 * schedule turned everything at 1.6.
 */
export function standTurnRate(length: number): number {
    return Math.min(Math.max(2.1 / Math.sqrt(Math.max(length, 0.01)), 0.9), 5);
}
