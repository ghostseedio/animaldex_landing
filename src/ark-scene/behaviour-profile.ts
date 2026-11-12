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
    /** Some field is a body-plan default (data missing). */
    defaulted: boolean;
    /** Not in the table: the body plan's defaults. */
    fallback: boolean;
};

const ACTIVITY: Record<string, ArkProfileActivity> = {d: "diurnal", n: "nocturnal", c: "crepuscular", a: "any"};
const ROWS = (table as {species: Record<string, string>}).species;
const cache = new Map<string, ArkBehaviourProfile>();

export function decodeBehaviourRow(slug: string, row: string): ArkBehaviourProfile {
    const [move, moves, activity, rhythm, roost, social, diet, behaviours, interactions, flags, size, speed, dominance, gait, walkPace, runPace, water = "", fine = ""] = row.split("|");
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
        : {slug, ...GROUND, ...PLAN_DEFAULTS[plan ?? ""], twoPeaks: false, siesta: false, breathes: false, seabed: false, water: null, size: null, speed: null, dominance: null, gait: null, walkPace: null, runPace: null, defaulted: true, fallback: true};
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

/** How many times its walking pace it runs (its run clip's pace over its walk's, so the run plays at its own rate; 1: it never runs). */
export function runFactor(profile: ArkBehaviourProfile): number {
    if (!profile.walkPace) return 2.2;
    if (!profile.runPace) return 1;
    return Math.min(Math.max(profile.runPace / bodyLengthsPerSecond(profile), 1), 4);
}
