/**
 * Each species' behaviour profile (visual only): how it moves, when and where
 * it sleeps, who it keeps company with, what it eats, which behaviours it has
 * (with how much of its waking time each wants) and which places in the world
 * it uses. Generated offline from stored data by
 * `scripts/ark-behaviour-profiles.mts` into `behaviours.json`; the full
 * profiles, with the phrase that decided each field, are in
 * `data/ark/behaviour-profiles.json`.
 *
 * A species the table lacks (a model newer than the profiles) gets its body
 * plan's defaults, flagged `fallback`.
 */

import table from "@/ark-scene/behaviours.json";

export const ARK_BEHAVIOURS = ["rest", "wander", "forage", "graze", "drink", "perch", "soar", "fly", "swim", "dive", "bask", "burrow", "climb", "groom", "hide", "flee", "flock", "visit_flowers", "circle_light", "stalk"] as const;
export type ArkBehaviour = (typeof ARK_BEHAVIOURS)[number];

export const ARK_INTERACTIONS = ["drink_edge", "bask_rock", "graze_grass", "perch_branch", "perch_rock", "dig_soil", "leaf_litter", "flower", "porch_light", "cave_mouth", "cliff_ledge", "sea_dive", "tide_pool", "bark", "wall", "burrow_mouth", "reeds", "water_surface", "reef", "shade", "shore"] as const;
export type ArkInteraction = (typeof ARK_INTERACTIONS)[number];

export type ArkMove = "walk" | "climb" | "perch" | "fly" | "swim" | "burrow" | "crawl" | "slither" | "hop" | "sessile" | "cling";
export type ArkRoost = "tree" | "tree_hole" | "cliff" | "cave" | "crevice" | "rocks" | "burrow" | "den" | "ground_cover" | "reeds" | "water" | "bottom" | "reef" | "leaf" | "bark" | "wall" | "nest" | "attached" | "open" | "shore";
export type ArkSocial = "solitary" | "pair" | "group" | "herd" | "flock" | "school" | "colony" | "pack" | "troop" | "swarm";
export type ArkProfileActivity = "diurnal" | "nocturnal" | "crepuscular" | "any";
/**
 * How it is in the water (lane MA3, from the stored taxonomy: `scripts/ark-behaviour-profiles.mts` waterKindOf): its
 * float line, posture and feeding there (`sea-depth.ts` swimDepth, floatLine).
 */
export type ArkWaterKind = "dabbler" | "diver" | "swan" | "goose" | "grebe" | "cormorant" | "pelican" | "coot" | "wader" | "bird" | "penguin" | "otter" | "seal" | "mammal" | "croc" | "turtle" | "lizard" | "snake" | "amphibian" | "fish" | "skater" | "bed";

export type ArkBehaviourProfile = {
    slug: string;
    move: ArkMove;
    moves: ArkMove[];
    activity: ArkProfileActivity;
    /** Busiest at the day's two ends. */
    twoPeaks: boolean;
    /** Rests through the midday heat. */
    siesta: boolean;
    roost: ArkRoost;
    social: ArkSocial;
    diet: string;
    /** How much of its waking time each behaviour wants (0–1); only the ones it has. */
    weights: Partial<Record<ArkBehaviour, number>>;
    interactions: ArkInteraction[];
    /** A flyer's height band. */
    altitude: "low" | "mid" | "high" | null;
    /** Crawls along any surface ("any"), upside down too ("upside"). */
    surface: "any" | "upside" | null;
    breathes: boolean;
    seabed: boolean;
    /** How it is in the water; null when it neither swims nor wades. */
    water: ArkWaterKind | null;
    size: number | null;
    speed: number | null;
    dominance: number | null;
    /** Its rig's fastest passing ground clip at the clip's own pace (body lengths a second); null without a rig. */
    gait: number | null;
    /** Its walk's and its run's own pace (body lengths a second: the clip's ground_speed over its duty); null without. */
    walkPace: number | null;
    runPace: number | null;
    /** Its day (lane B3 needs): how much of its waking time it feeds and rests, in what cycle, how often it drinks, how long it sleeps; null: by its diet (`dayOf`). */
    day: ArkDay | null;
    /** Some field is a body-plan default (data missing). */
    defaulted: boolean;
    /** Not in the table: the body plan's defaults. */
    fallback: boolean;
};

/**
 * Its day's needs (lane B3, the behaviours pass of 2026-11-14; `scripts/ark-behaviour-profiles.mts` dayOf, from its
 * taxonomy, diet and size): the schedule turns them into bouts in order (`behaviour-schedule.ts` needAt), so a grazer
 * grazes for an hour or two and then lies down to chew, a hummingbird feeds for a minute every ten, a lion lies about
 * most of its few waking hours, and a python feeds one day in five.
 */
export type ArkDay = {
    /** The share of its waking time in feeding bouts (0-1). */
    feed: number;
    /** One feeding cycle (a feeding bout, the rest after it, then whatever else it does), minutes. */
    cycle: number;
    /** The share of its waking time in the rest that follows a feeding bout (0-1). */
    rest: number;
    /** Trips to water a day (0: never; 0.5: every other day). */
    drinks: number;
    /** Hours asleep in the 24; null: its activity's own hours (`ark-daylight.ts` isAwake). */
    sleep: number | null;
    /** It feeds one day in this many (a snake, a crocodile); 1: every day. */
    every: number;
    /** It chews the cud through the rest after a feeding bout. */
    ruminates: boolean;
};

/** A species with no day written (a model newer than the profiles): by what it eats. `[feed, cycle, rest, drinks]`. */
const DIET_DAYS: Record<string, [number, number, number, number]> = {
    grazer: [0.6, 120, 0.25, 1],
    browser: [0.55, 120, 0.25, 1],
    seeds: [0.5, 25, 0.25, 1],
    fruit: [0.45, 40, 0.3, 1],
    nectar: [0.35, 12, 0.45, 0],
    insects: [0.5, 25, 0.25, 0.5],
    fish: [0.3, 90, 0.45, 0],
    meat: [0.2, 240, 0.55, 0.5],
    carrion: [0.15, 240, 0.5, 0.5],
    blood: [0.2, 120, 0.6, 0],
    filter: [0.6, 60, 0.2, 0],
    algae: [0.6, 40, 0.2, 0],
    detritus: [0.5, 40, 0.3, 0],
    omnivore: [0.45, 60, 0.3, 1]
};
const dayCache = new Map<string, ArkDay>();
/** Its day: the generator's, or its diet's. */
export function dayOf(profile: Pick<ArkBehaviourProfile, "day" | "diet">): ArkDay {
    if (profile.day) return profile.day;
    let day = dayCache.get(profile.diet);
    if (!day) {
        const [feed, cycle, rest, drinks] = DIET_DAYS[profile.diet] ?? DIET_DAYS.omnivore;
        day = {feed, cycle, rest, drinks, sleep: null, every: 1, ruminates: false};
        dayCache.set(profile.diet, day);
    }
    return day;
}

/** The row's day field: `feed %,cycle min,rest %,drinks x10,sleep hours x10 (empty: by its activity),every,flags (r ruminates)`. */
function decodeDay(field: string): ArkDay | null {
    if (!field) return null;
    const [feed, cycle, rest, drinks, sleep, every, flags = ""] = field.split(",");
    return {feed: Number(feed) / 100, cycle: Math.max(Number(cycle), 4), rest: Number(rest) / 100, drinks: Number(drinks) / 10, sleep: sleep === "" || sleep === undefined ? null : Number(sleep) / 10, every: Math.max(Number(every) || 1, 1), ruminates: flags.includes("r")};
}

const ACTIVITY: Record<string, ArkProfileActivity> = {d: "diurnal", n: "nocturnal", c: "crepuscular", a: "any"};
const ROWS = (table as {species: Record<string, string>}).species;
const cache = new Map<string, ArkBehaviourProfile>();

export function decodeBehaviourRow(slug: string, row: string): ArkBehaviourProfile {
    const [move, moves, activity, rhythm, roost, social, diet, behaviours, interactions, flags, size, speed, dominance, gait, walkPace, runPace, water = "", fine = "", day = ""] = row.split("|");
    const weights: Partial<Record<ArkBehaviour, number>> = {};
    for (let i = 0; i + 1 < behaviours.length; i += 2) {
        const name = ARK_BEHAVIOURS[parseInt(behaviours[i], 36)];
        if (name) weights[name] = Number(behaviours[i + 1]) / 9;
    }
    // (Finer weights where the generator set them, in hundredths: a coot's appetite for flying, 0.03.)
    for (const pair of fine ? fine.split(",") : []) {
        const [index, hundredths] = pair.split(":");
        const name = ARK_BEHAVIOURS[parseInt(index, 36)];
        if (name && name in weights) weights[name] = Number(hundredths) / 100;
    }
    const number = (value: string | undefined) => (value === undefined || value === "" ? null : Number(value));
    return {
        slug,
        move: move as ArkMove,
        moves: moves ? (moves.split(",") as ArkMove[]) : [],
        activity: ACTIVITY[activity] ?? "diurnal",
        twoPeaks: rhythm.includes("t"),
        siesta: rhythm.includes("s"),
        roost: roost as ArkRoost,
        social: social as ArkSocial,
        diet,
        weights,
        interactions: interactions.split("").map((c) => ARK_INTERACTIONS[parseInt(c, 36)]).filter(Boolean),
        altitude: flags.includes("h") ? "high" : flags.includes("m") ? "mid" : flags.includes("l") ? "low" : null,
        surface: flags.includes("u") ? "upside" : flags.includes("a") ? "any" : null,
        breathes: flags.includes("b"),
        seabed: flags.includes("s"),
        water: (water || null) as ArkWaterKind | null,
        size: number(size),
        speed: number(speed),
        dominance: number(dominance),
        gait: number(gait),
        walkPace: number(walkPace),
        runPace: number(runPace),
        day: decodeDay(day),
        defaulted: flags.includes("d"),
        fallback: false
    };
}

/** The body plan's defaults, for a species the table lacks. */
type Defaults = Pick<ArkBehaviourProfile, "move" | "moves" | "activity" | "roost" | "social" | "diet" | "weights" | "interactions" | "altitude" | "surface">;
const GROUND: Defaults = {move: "walk", moves: [], activity: "diurnal", roost: "ground_cover", social: "solitary", diet: "omnivore", weights: {rest: 0.25, wander: 0.3, forage: 0.5, drink: 0.15}, interactions: ["drink_edge"], altitude: null, surface: null};
const PLAN_DEFAULTS: Record<string, Partial<Defaults>> = {
    flying_bird: {move: "fly", moves: ["perch", "walk"], roost: "tree", diet: "insects", weights: {rest: 0.25, wander: 0.15, forage: 0.5, fly: 0.5, perch: 0.45, drink: 0.15}, interactions: ["perch_branch", "drink_edge"], altitude: "mid"},
    bat: {move: "fly", moves: ["perch"], activity: "nocturnal", roost: "cave", social: "group", diet: "insects", weights: {rest: 0.25, forage: 0.5, fly: 0.5, perch: 0.3}, interactions: ["cave_mouth"], altitude: "mid"},
    flying_insect: {move: "fly", moves: ["cling"], roost: "leaf", diet: "nectar", weights: {rest: 0.25, forage: 0.5, fly: 0.6, visit_flowers: 0.4}, interactions: ["flower"], altitude: "low"},
    fish: {move: "swim", roost: "water", social: "school", weights: {rest: 0.25, wander: 0.3, forage: 0.5, swim: 0.9}, interactions: []},
    cephalopod_jelly: {move: "swim", roost: "water", diet: "meat", weights: {rest: 0.25, forage: 0.5, swim: 0.9}, interactions: []},
    primate: {move: "climb", moves: ["walk"], roost: "tree", social: "troop", diet: "fruit", weights: {rest: 0.25, wander: 0.3, forage: 0.5, climb: 0.7, groom: 0.3}, interactions: ["perch_branch"]},
    insect: {move: "walk", roost: "leaf", diet: "insects", weights: {rest: 0.25, wander: 0.3, forage: 0.5, hide: 0.15}, interactions: ["leaf_litter"], surface: "any"},
    arachnid: {move: "walk", roost: "crevice", diet: "insects", weights: {rest: 0.4, forage: 0.4, stalk: 0.25}, interactions: ["leaf_litter"], surface: "upside"},
    other: {move: "crawl", roost: "attached", diet: "detritus", weights: {rest: 0.6, forage: 0.3}, interactions: [], surface: "any"}
};

export function behaviourProfile(slug: string, plan?: string | null): ArkBehaviourProfile {
    const hit = cache.get(slug);
    if (hit) return hit;
    const row = ROWS[slug];
    const profile: ArkBehaviourProfile = row
        ? decodeBehaviourRow(slug, row)
        : {slug, ...GROUND, ...PLAN_DEFAULTS[plan ?? ""], twoPeaks: false, siesta: false, breathes: false, seabed: false, water: null, size: null, speed: null, dominance: null, gait: null, walkPace: null, runPace: null, day: null, defaulted: true, fallback: true};
    cache.set(slug, profile);
    return profile;
}

export function hasBehaviourProfile(slug: string): boolean {
    return slug in ROWS;
}

/** How much faster than its clip's own pace its feet may be played (the rig player's cap) before they slide. */
export const GAIT_CADENCE = 2.5;
/**
 * How far off its walk clip's own pace (`walkPace`) its walking may be, either way: within this its feet keep planted
 * without the clip playing in slow motion or racing (the integrator's default-view check: a pace ratio of 0.8-1.3).
 */
export const PACE_CAP = 1.3;
export const PACE_FLOOR = 0.8;

/**
 * Ground speed in body lengths a second (visual only). With a walk clip: its clip's own pace (the rig set the scene
 * reads, v2 where it lists the species: `walkPace`), so the walk plays at its own rate (each trip then goes 0.85-1.2
 * of it). Without one: the speed stat's gentle curve (docs/ark-next.md stats §2), held to what its fastest ground clip
 * carries. The same for every viewer, rig drawn or not.
 */
export function bodyLengthsPerSecond(profile: ArkBehaviourProfile): number {
    const speed = profile.speed ?? 40;
    const stat = Math.min(Math.max(0.6 + (speed / 100) * 1.4, 0.4), 2.2);
    // (2026-11-11: held under 1.5 times a v1 walk's pace, then the v2 set's walks went up 4-15 times as fast: walkers
    // walked at 0.4 of their clips, in slow motion. The clip's pace is now the walk.)
    if (profile.walkPace) return Math.max(profile.walkPace, 0.04);
    return profile.gait ? Math.max(Math.min(stat, profile.gait * GAIT_CADENCE), 0.08) : stat;
}

/**
 * Its pace in the water (body lengths a second): the walk clip governs only walking. Not a bird's or a bat's flight (MA1,
 * movement audit problem 1): that runs at L2's cruise for its size, up to it and down from it at half a g
 * (`behaviour-schedule.ts` airPaces); capped by a walk clip's pace, this flew a coot at 0.4 m/s. A flying insect's range
 * is still reckoned from it (`reachOf`).
 */
export function freeBodyLengthsPerSecond(profile: ArkBehaviourProfile): number {
    const speed = profile.speed ?? 40;
    const stat = Math.min(Math.max(0.6 + (speed / 100) * 1.4, 0.4), 2.2);
    return profile.gait ? Math.max(Math.min(stat, profile.gait * GAIT_CADENCE), 0.08) : stat;
}

/**
 * Its pace swimming (body lengths a second), from its own speed stat, never its walk clip's (lane MA3 water 2: held to the
 * walk clip's cadence, as `freeBodyLengthsPerSecond` is, a coot paddled at 0.14 m/s and a harbour seal at the same). The
 * schedule keeps it to a swimmer's cruise for its size (`behaviour-schedule.ts` swimSpeedOf).
 */
export function swimBodyLengthsPerSecond(profile: ArkBehaviourProfile): number {
    const speed = profile.speed ?? 40;
    return Math.min(Math.max(0.6 + (speed / 100) * 1.4, 0.4), 2.2);
}

/**
 * The length (m) a swimmer's pace is counted in, at true size: its own up to 2 m (a seal, a dolphin), then growing as
 * √L (cruising speed grows far slower than length: a 14 m humpback cruises at about 6 m/s, not 16). Motion pass §3.
 */
export function swimPaceLength(length: number): number {
    const L = Math.max(length, 0.05);
    return L <= 2 ? L : 2 * Math.sqrt(L / 2);
}

/** A bird that swims first and floats on the surface, a duck, a goose, a swan, a coot (not an otter: its pace as before). */
function floatsOnWater(profile: ArkBehaviourProfile): boolean {
    return profile.move === "swim" && profile.moves.includes("fly") && !profile.breathes;
}

/**
 * Its pace swimming (m/s, the water legs' 1.4 of its free pace before the trip's own 0.85-1.2). A bird that swims
 * first, a duck, a goose, a swan, a coot: from its own speed stat (`swimBodyLengthsPerSecond`), no longer its walk clip's cadence (lane
 * MA3 water 2: a coot paddled at 0.15 m/s), at most a paddler's √L m/s (a coot 0.57, a mallard 0.75, a goose 0.9, a swan
 * 1.1: a swan swam at 1.9 m/s). Anything else (a fish, a seal, a penguin) as before: its free pace.
 */
export function swimSpeedOf(profile: ArkBehaviourProfile, length: number): number {
    const L = profile.move === "swim" ? swimPaceLength(length) : Math.max(length, 0.05);
    if (!floatsOnWater(profile)) return freeBodyLengthsPerSecond(profile) * L * 1.4;
    return Math.min(swimBodyLengthsPerSecond(profile) * L * 1.4, Math.sqrt(Math.max(length, 0.05)));
}

/** How many times its walking pace it runs (its run clip's pace over its walk's, so the run plays at its own rate; 1: it never runs). */
export function runFactor(profile: ArkBehaviourProfile): number {
    if (!profile.walkPace) return 2.2;
    if (!profile.runPace) return 1;
    return Math.min(Math.max(profile.runPace / bodyLengthsPerSecond(profile), 1), 4);
}
