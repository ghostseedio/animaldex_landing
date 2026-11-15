/**
 * After the catch (owner, 2026-11-15: "as realistic as possible"): how a meal the server recorded is acted out, as a
 * nature documentary would show it and never gory (no blood, no wounds).
 *
 * - **The meal.** The prey lies down where it was caught (on its side, never fading at the catch). A small one is
 *   swallowed whole: picked up, lifted, and it goes down into the mouth (a heron's fish in seconds; a snake's rodent
 *   slowly, head first). A bigger one is fed on: head-down feeding bouts with pauses and glances up (vigilance), for
 *   as long as an animal of that size takes to eat that much (`mealPlan`), on the Ark's own clock. Then the predator
 *   steps away and rests (and drinks first when water is close), and goes back to its day.
 * - **Traces.** A little stays after the meal (`traceOf`): feathers for a bird, a tuft of fur for a mammal, a few
 *   scales, flattened grass where a bigger animal fed; none for a fish taken in the water. They fade by rule.
 * - **Scavengers.** Carrion eaters that are near and awake (`pickScavengers`) come to what is left once the predator
 *   has left it, feed briefly, and go back to their day. Visual only: the server's outcome never changes.
 *
 * Every number here is a pure function of the two animals, the meal's id and the time since the catch: the same for
 * every viewer, never per-viewer randomness.
 *
 * Durations are nature's, compressed by the Ark's own clock (`ARK_TIME_SCALE`, 1 Ark year = 14 real days: an Ark
 * hour is about 8.3 real minutes): a lion feeding an hour on a deer feeds about 2.3 minutes of scene time; a heron
 * swallowing a fish takes seconds (floored so the swallow is seen).
 */

import {ARK_DAY_MS} from "@/ark-scene/positions/positions";

/** Ark seconds per real second (about 26.1). */
export const ARK_TIME_SCALE = 86_400_000 / ARK_DAY_MS;

/** One side of a meal, as the rules read it. */
export type MealSide = {
    slug: string;
    /** Its model's body plan (`mammal`, `bird`, `fish`, `snake`, `frog`, `reptile`, `turtle`…), when known. */
    plan: string | null;
    /** Body mass (kg): `stats.ts` massFromSize of its size stat. */
    massKg: number;
    /** Drawn length (m). */
    length: number;
    /** In the water at the catch. */
    water?: boolean;
    flies?: boolean;
    /** Its behaviour profile's diet (`behaviours.json`): meat, fish, carrion, insects… */
    diet?: string | null;
};

export type MealStyle = "swallow" | "feed";
export type TraceKind = "feathers" | "fur" | "scales" | "none";

export type MealTrace = {
    kind: TraceKind;
    /** Grass and ground pressed flat where it fed (a bigger animal, on land). */
    flattened: boolean;
    /** How long it stays after the meal (s of scene time), fading over its last third. */
    seconds: number;
    /** Its spread (m across). */
    size: number;
};

export type MealPlan = {
    style: MealStyle;
    /** Feeding (or swallowing), from the catch (s of scene time). */
    feedSeconds: number;
    /** The same in nature (minutes), before the Ark's clock compresses it. */
    naturalMinutes: number;
    /** What it eats of the prey (kg). */
    eatenKg: number;
    /** Resting afterwards (s; 0 for a mouthful). */
    restSeconds: number;
    /** A drink first when water is near (s; 0: it does not need one). */
    drinkSeconds: number;
    trace: MealTrace;
    /** Up to two carrion eaters may come to what is left (a feed on land of something worth it). */
    scavengers: number;
    /** How it holds itself to feed and to rest (`mealPosture`). */
    posture: MealPosture;
    seed: string;
};

/**
 * Feeding and resting postures by kind (owner, 2026-11-15: not standing for everyone). Big cats lie prone with the prey
 * between their forepaws to feed, and lie down after; dogs, wolves, jackals and hyenas stand and tear, then lie down;
 * bears lie (they often sit, which no rig has); raptors mantle over it standing; crocodilians and monitors stand to feed
 * and bask after; anything else stands to feed and lies up when its rig can (the rigs' own lie and bask clips: a model
 * without them keeps standing).
 */
export type MealPosture = {feed: "stand" | "prone"; rest: "lie" | "bask" | "stand"};

const FELIDS = /(^|-)(lion|tiger|leopard|cheetah|jaguar|puma|cougar|lynx|bobcat|caracal|serval|ocelot|margay|wildcat|cat|jaguarundi)$/;
const NOT_FELIDS = /(sea-lion|antlion|catfish|cattle|catbird)/;
const CANIDS = /(wolf|jackal|wild-dog|dingo|coyote|fox|dhole|hyena|aardwolf|dog)$/;
const BEARS = /(^|-)bear$/;
const LIZARDS_AND_CROCS = /(crocodile|alligator|caiman|gharial|monitor|komodo|tegu|goanna)/;

export function mealPosture(side: Pick<MealSide, "slug" | "plan" | "flies">): MealPosture {
    const slug = side.slug;
    if (FELIDS.test(slug) && !NOT_FELIDS.test(slug)) return {feed: "prone", rest: "lie"};
    if (CANIDS.test(slug) || BEARS.test(slug)) return {feed: "stand", rest: "lie"};
    if (LIZARDS_AND_CROCS.test(slug)) return {feed: "stand", rest: "bask"};
    const kind = mealKind(side);
    if (kind === "mammal") return {feed: "stand", rest: "lie"};
    if (kind === "reptile") return {feed: "stand", rest: "bask"};
    return {feed: "stand", rest: "stand"};
}

type Kind = "mammal" | "bird" | "snake" | "swimmer" | "frog" | "reptile" | "other";

const SWIMMERS = new Set(["fish", "ray", "cetacean", "jellyfish", "cephalopod", "shark"]);

/** How the rules group an animal: by its body plan, else its slug. */
export function mealKind(side: Pick<MealSide, "plan" | "slug" | "flies">): Kind {
    const plan = side.plan ?? "";
    if (plan === "bird") return "bird";
    if (plan === "snake") return "snake";
    if (SWIMMERS.has(plan)) return "swimmer";
    if (plan === "frog") return "frog";
    if (plan === "reptile" || plan === "turtle") return "reptile";
    if (plan === "mammal") return "mammal";
    if (/(python|boa|viper|cobra|mamba|snake|adder|rattlesnake|anaconda|krait|taipan)/.test(side.slug)) return "snake";
    if (/(frog|toad)/.test(side.slug)) return "frog";
    if (side.flies) return "bird";
    return "other";
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** How heavy a body of that plan is for its length (a cube of it, `stats.ts` lengthFromMass, times its build). */
const BUILD: Record<Kind, number> = {mammal: 0.5, bird: 0.12, snake: 0.06, swimmer: 0.35, frog: 0.6, reptile: 0.25, other: 0.3};

/**
 * Its body mass (kg) from its true length (m) and body plan: (L / 0.33)³ (`stats.ts` lengthFromMass, read back) times
 * its build: a lion of 2.5 m about 215 kg, a deer of 2 m 110, a rabbit 0.9, a hawk of half a metre 0.5, a heron 4, a
 * trout 1.7, a python of 5 m 200. (The size stat rates how big an animal looks: a hawk's wings make it ten times its
 * weight there, so the meal reads its length.)
 */
export function bodyMassKg(side: Pick<MealSide, "plan" | "slug" | "flies">, lengthM: number): number {
    const l = Math.max(lengthM, 0.005);
    return Math.pow(l / 0.33, 3) * BUILD[mealKind(side)];
}

/** Swallowed whole (a snake always; a frog or a fish its mouthful; a bird a small catch; a mammal only a morsel). */
export function swallowsWhole(predator: MealSide, prey: MealSide): boolean {
    const ratio = prey.massKg / Math.max(predator.massKg, 1e-6);
    switch (mealKind(predator)) {
        case "snake":
        case "frog":
            return true;
        case "swimmer":
            return ratio <= 0.5;
        case "bird":
            // A heron swallows a fish that is a third of its weight; a hawk tears a rabbit but gulps a mouse.
            return mealKind(prey) === "swimmer" || prey.water ? ratio <= 0.45 : ratio <= 0.12;
        case "reptile":
            return ratio <= 0.1;
        case "mammal":
            return ratio <= 0.02;
        default:
            return ratio <= 0.05;
    }
}

/** What share of its own weight it eats at one sitting (a big cat about a sixth, a raptor an eighth, a monitor most of itself). */
const GORGE: Record<Kind, number> = {mammal: 0.18, bird: 0.12, snake: 1, swimmer: 0.5, frog: 0.5, reptile: 0.6, other: 0.15};

/**
 * The meal, by rule. Nature's minutes first:
 * - swallowed whole: a snake 4 + 45·√(prey/predator) minutes (a rat in a python's jaws about 8, a rabbit half an
 *   hour), anything else 0.15 + 3·(prey/predator) minutes (a heron's fish under a minute);
 * - fed on: what it eats (`GORGE` of its own weight, at most two thirds of the prey) at 0.012·M^0.75 kg a minute (M its
 *   mass; twice that for a reptile, which bolts its food), plus a minute's handling: a lion on a deer about an hour,
 *   a hawk on a rabbit about ten minutes.
 * Then on the Ark's clock (`ARK_TIME_SCALE`), held to 4–90 s for a swallow (it is seen) and 20–300 s for a feed (a
 * lion's hour reads as about two minutes). Rest: 20 + 900·(eaten/M) minutes, Ark clock, at most 6 minutes of scene
 * time; none for a mouthful under 2% of its weight. A drink after a feed of 5% of its weight or more (not a bird or a
 * snake), when water is near (the scene looks).
 */
export function mealPlan(predator: MealSide, prey: MealSide, seed: string): MealPlan {
    const kind = mealKind(predator);
    const M = Math.max(predator.massKg, 1e-4);
    const m = Math.max(prey.massKg, 1e-5);
    const ratio = m / M;
    const style: MealStyle = swallowsWhole(predator, prey) ? "swallow" : "feed";
    let natural: number;
    let eaten: number;
    if (style === "swallow") {
        eaten = m;
        natural = kind === "snake" ? 4 + 45 * Math.sqrt(Math.min(ratio, 1)) : 0.15 + 3 * Math.min(ratio, 1);
    } else {
        eaten = Math.min(m * 0.66, M * GORGE[kind]);
        const rate = 0.012 * Math.pow(M, 0.75) * (kind === "reptile" ? 2 : 1);
        natural = 1 + eaten / rate;
    }
    const scene = (natural * 60) / ARK_TIME_SCALE;
    const feedSeconds = style === "swallow" ? clamp(scene, 4, 90) : clamp(scene, 20, 300);
    const share = eaten / M;
    const restSeconds = share < 0.02 ? 0 : clamp(((20 + 900 * Math.min(share, 1)) * 60) / ARK_TIME_SCALE, 15, 360);
    const drinkSeconds = style === "feed" && share >= 0.05 && kind !== "bird" && kind !== "snake" && kind !== "swimmer" ? 12 : 0;
    const trace = traceOf(predator, prey, style);
    // Something worth coming for: a feed on land of a prey of a kilogram or more (two scavengers from ten).
    const scavengers = style === "feed" && !prey.water && !predator.water && m >= 1 ? (m >= 10 ? 2 : 1) : 0;
    return {style, feedSeconds, naturalMinutes: natural, eatenKg: eaten, restSeconds, drinkSeconds, trace, scavengers, posture: mealPosture(predator), seed};
}

/**
 * What stays where it fed: feathers for a bird (plucked, or the few a swallowed one sheds), a tuft of fur for a
 * mammal, a few scales for a fish, lizard or snake taken on land; nothing for a fish taken in the water, a frog or an
 * insect. Flattened ground under a feed on land of anything half a metre long or more. It stays 6 + 10·log2(1 + kg)
 * Ark hours (4–36), on the Ark's clock: a few minutes for a mouse's fur, about an hour for a deer's.
 */
export function traceOf(predator: MealSide, prey: MealSide, style: MealStyle): MealTrace {
    const preyKind = mealKind(prey);
    const inWater = Boolean(prey.water || predator.water);
    let kind: TraceKind = "none";
    if (preyKind === "bird") kind = "feathers";
    else if (preyKind === "mammal") kind = style === "swallow" ? "none" : "fur";
    else if ((preyKind === "swimmer" || preyKind === "reptile" || preyKind === "snake") && !inWater) kind = style === "swallow" ? "none" : "scales";
    // A bird swallowed whole sheds a feather or two; a raptor plucks one it feeds on (both feathers).
    const flattened = style === "feed" && !inWater && prey.length >= 0.5;
    const hours = clamp(6 + 10 * Math.log2(1 + Math.max(prey.massKg, 0)), 4, 36);
    const seconds = kind === "none" && !flattened ? 0 : (hours * 3600) / ARK_TIME_SCALE;
    return {kind, flattened, seconds, size: clamp(prey.length * 1.1, 0.25, 3)};
}

// MARK: Feeding beats

/** A seeded stream of numbers in [0, 1) (the meal's id: every viewer the same). */
export function mealRandom(seed: string): () => number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    let s = h >>> 0 || 1;
    return () => {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return ((s >>> 0) % 1_000_003) / 1_000_003;
    };
}

export type FeedBeat = {
    /** Head down feeding (`eat`), or head up looking round (`scan`). */
    state: "eat" | "scan";
    /** Body pitch (rad, + nose down). */
    pitch: number;
    /** A turn of the head and shoulders while it looks round (rad). */
    look: number;
};

/** The bouts of a feed: head down 3–8 s, then a glance up of 1–2.5 s (turned a little to one side), seeded. */
export function feedBouts(seed: string, seconds: number): Array<{from: number; to: number; up: boolean; look: number}> {
    const random = mealRandom(`${seed}#bouts`);
    const out: Array<{from: number; to: number; up: boolean; look: number}> = [];
    let t = 0;
    while (t < seconds) {
        const down = 3 + 5 * random();
        out.push({from: t, to: Math.min(t + down, seconds), up: false, look: 0});
        t += down;
        if (t >= seconds) break;
        const up = 1 + 1.5 * random();
        out.push({from: t, to: Math.min(t + up, seconds), up: true, look: (random() < 0.5 ? -1 : 1) * (0.2 + 0.35 * random())});
        t += up;
    }
    return out;
}

/** Its feeding at `u` seconds into the feed: the bout, eased in and out, a small tug while it feeds. */
export function feedBeatAt(bouts: Array<{from: number; to: number; up: boolean; look: number}>, u: number): FeedBeat {
    const bout = bouts.find((b) => u >= b.from && u < b.to) ?? bouts[bouts.length - 1];
    if (!bout) return {state: "eat", pitch: 0.12, look: 0};
    const k = Math.min((u - bout.from) / 0.35, (bout.to - u) / 0.35, 1);
    const e = k <= 0 ? 0 : k * k * (3 - 2 * k);
    if (bout.up) return {state: "scan", pitch: -0.04 * e, look: bout.look * e};
    // Head down; every second or so a tug back (tearing, plucking) as it feeds.
    return {state: "eat", pitch: 0.12 + 0.035 * Math.sin(u * 5.3) * e, look: 0};
}

// MARK: The scavengers

/** Carrion eaters by diet (`behaviours.json` `carrion`), and those known to scavenge when they find a carcass. */
const FACULTATIVE = /(vulture|condor|raven|crow|magpie|rook|jackdaw|jackal|hyena|coyote|monitor|caracara|kite|marabou|adjutant|tasmanian-devil|wolverine|sea-eagle|bald-eagle|komodo|dingo|fox|skua|gull|bateleur)/;
/** Plans that come to a carcass on land (no fish, crab or worm at a lion's kill). */
const LAND_OR_AIR = new Set(["mammal", "bird", "reptile"]);

export type ScavengerCandidate = {
    id: string;
    slug: string;
    plan: string | null;
    diet: string | null;
    length: number;
    flies: boolean;
    /** Where it is when the carcass is left (its schedule's place then). */
    x: number;
    z: number;
    /** Awake then, and while it would feed (its schedule's). */
    awake: boolean;
};

/** A carrion eater by diet, or one of those that scavenge when they find a carcass; big enough to be seen at one. */
export function isScavenger(c: Pick<ScavengerCandidate, "slug" | "plan" | "diet" | "length">): boolean {
    if (c.length < 0.25) return false;
    if (c.plan && !LAND_OR_AIR.has(c.plan)) return false;
    return c.diet === "carrion" || FACULTATIVE.test(c.slug);
}

/** How far it comes from (m): a flyer sees a carcass from far off. */
export const SCAVENGE_REACH = {walk: 40, fly: 90};

/**
 * Who comes to what is left (at most `count`): carrion eaters, near and awake, that the predator does not hunt (they
 * keep clear of a predator that eats their kind); carrion by diet first, then the nearest, ties by the meal's seed.
 * Each its arrival's stagger (s after the carcass is left).
 */
export function pickScavengers(candidates: ScavengerCandidate[], spot: {x: number; z: number}, meal: {seed: string; count: number; predatorId: string; preyId: string; eatenBy?: (slug: string) => boolean}): Array<{id: string; delay: number; distance: number}> {
    if (meal.count <= 0) return [];
    const random = mealRandom(`${meal.seed}#scavengers`);
    const rows = candidates
        .filter((c) => c.id !== meal.predatorId && c.id !== meal.preyId && c.awake && isScavenger(c) && !(meal.eatenBy?.(c.slug) ?? false))
        .map((c) => ({c, d: Math.hypot(c.x - spot.x, c.z - spot.z), tie: hashTie(`${meal.seed}:${c.id}`)}))
        .filter((r) => r.d <= (r.c.flies ? SCAVENGE_REACH.fly : SCAVENGE_REACH.walk))
        .sort((a, b) => Number(b.c.diet === "carrion") - Number(a.c.diet === "carrion") || a.d - b.d || a.tie - b.tie);
    return rows.slice(0, meal.count).map((r, i) => ({id: r.c.id, delay: 4 + i * (6 + 8 * random()), distance: r.d}));
}

function hashTie(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** A scavenger's own feed (s): 20–50 s of scene time (ten to twenty minutes at a carcass, on the Ark's clock), seeded. */
export function scavengeSeconds(seed: string, id: string): number {
    return 20 + 30 * mealRandom(`${seed}#feed:${id}`)();
}
