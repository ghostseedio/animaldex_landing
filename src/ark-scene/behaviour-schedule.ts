/**
 * The NPC-style behaviour schedule (visual only): what an animal is doing at
 * any moment, and where, as a pure function of the time and its id.
 *
 * - Time is cut into slots of `SLOT_SECONDS` of world time (epoch seconds, the
 *   same for every viewer and the livestream), offset per animal. Each slot is
 *   one goal: the animal travels from where the last slot left it to the
 *   slot's destination (a feeding spot, water, a perch, shelter, its roost, its
 *   group) by a route of its own (legs: walk, pause, fly, swim, slide into the
 *   water and climb out), then spends the rest of the slot there in beats
 *   (bite, chew, step and look up while grazing; peck and scan on the ground;
 *   preen on a perch; shake off after a swim).
 * - Asleep slots (its activity against the hour, the rule the tap card uses)
 *   are spent at its roost; the first is a visible trip there.
 * - An awake slot's goal is the animal's own seeded choice from its profile's
 *   needs (`behaviour-profile.ts`), shaped by the hour and by its personality
 *   (`ark-clock.ts`): never a timeline shared by its species.
 * - A group (herd, troop, flock, school) keeps together around its leader, but
 *   each member chooses its own goal there: some graze while one watches, some
 *   rest while others move; young play near the group. Only flocking species fly
 *   together, and even they don't always.
 * - Predators keep their home ranges a safe distance from their prey's (`spaceHomes`);
 *   they may stalk towards the edge of their range, and never catch anything.
 *
 * No per-viewer randomness: every choice is seeded by the animal's id and the
 * slot. Nothing here decides anything in the Ark (the server does that).
 */

import {bodyLengthsPerSecond, freeBodyLengthsPerSecond, PACE_CAP, runFactor, type ArkBehaviour, type ArkBehaviourProfile, type ArkInteraction, type ArkRoost} from "@/ark-scene/behaviour-profile";
import {alongPath, MAX_SLOPE, MOUNTAIN_SLOPE, navGrid, navGridBuild, pathLength, type NavGrid, type NavPoint} from "@/ark-scene/behaviour-nav";
import {bodyShape} from "@/ark-scene/collide/bodies";
import {hostOf, onSurface, surfaceOf} from "@/ark-scene/collide/attach";
import {colliderDistance, type Collider} from "@/ark-scene/collide/colliders";
import {worldSampler, worldSamplerBuild, type ArkWorldSampler, type AttachPoint, type AttachTag} from "@/ark-scene/world-sampler";
import {waterLevelAt} from "@/ark-scene/water-level";
import {DEN_DRY, SURF_REACH} from "@/ark-scene/map/points";
import {topOf, waterSurfaceOf} from "@/ark-scene/behaviour-water";
import {once, SlicedBuild, type BuildTask} from "@/ark-scene/behaviour-build";
import {isAwake} from "@/lib/ark-daylight";
import {animalPersonality} from "@/lib/ark-clock";
import {hashString} from "@/ark-scene/world";
import type {ArkZone, ArkThrive} from "@/ark-scene/types";
import {roostOffset, sleepSpacing, sleepStyle} from "@/ark-scene/sleep";
import {coatOf, episodeOfTrip, episodePose, forgetRecipes, marksOf, nestSiteOf, recipeRoostTags, sexLook, sitterIntent, type RecipeCoat, MARK_SECONDS, recipeIntent, type Episode, type RecipeMark, type RecipePose, type ScheduleKit, type TripOwner} from "@/ark-scene/behaviour-recipes";

export const SLOT_SECONDS = 80;
/** The raised perches a group sleeps along in a row or a cluster (sleep lane). */
const RAISED_TAGS: AttachTag[] = ["branch", "canopy_hang", "cliff_ledge", "post", "rock_top", "tree_hollow"];
/** A night watch stands this many slots (sleep lane: about five minutes). */
export const NIGHT_WATCH_SLOTS = 4;

/** Each animal's slots are shifted by its own offset (from its id), so a thousand animals don't all change plans in the same frame. */
export function slotOffset(id: string): number {
    return (hashString(`${id}#slot`) % 8000) / 100;
}
export function slotStart(animal: ScheduleAnimal, slot: number): number {
    return slot * SLOT_SECONDS - slotOffset(animal.id);
}
function slotOf(animal: ScheduleAnimal, epochSeconds: number): number {
    return Math.floor((epochSeconds + slotOffset(animal.id)) / SLOT_SECONDS);
}

/** What it is doing (one state, which the animation, the tap card and follow all read). */
export type ArkDoing =
    | "sleep"
    | "to_roost"
    | "watch"
    | "rest"
    | "wander"
    | "forage"
    | "graze"
    | "browse"
    | "drink"
    | "perch"
    | "fly"
    | "soar"
    | "swim"
    | "breathe"
    | "dive"
    | "bask"
    | "burrow"
    | "climb"
    | "groom"
    | "hide"
    | "visit_flowers"
    | "circle_light"
    | "crawl"
    | "stalk"
    | "play"
    | "idle";

/** The moment-to-moment part of what it is doing (for the clips: a graze clip on "bite", a scan clip on "scan", a shake on "shake"). */
export type ArkBeat = "walk" | "run" | "fly" | "glide" | "swim" | "enter_water" | "exit_water" | "climb" | "pause" | "shake" | "bite" | "chew" | "step" | "scan" | "peck" | "drink" | "preen" | "rest" | "sleep" | "play" | "stalk";

/** How it travels a leg. */
export type TripMode = "ground" | "air" | "water" | "surface" | "stay";
type LegMode = TripMode | "enter" | "exit" | "pause" | "shadow";

export type Spot = {x: number; y: number; z: number; /** The surface's normal there (up on the ground). */ nx: number; ny: number; nz: number; point: string | null; /** The way it faces when it is left there (a slot's finish), when known. */ yaw?: number};

export type Leg = {
    /** A pause: the way it faces (the way it came; a pause from a point to itself has no direction of its own). */
    yaw?: number;
    mode: LegMode;
    from: Spot;
    to: Spot;
    /** The ground or water path (x, z) for ground and water legs; for air legs, the route's waypoints. */
    path: NavPoint[] | null;
    length: number;
    seconds: number;
    beat: ArkBeat;
    /** Air legs: cruising height above the ground. */
    cruise?: number;
    /** Air legs: the share of the leg it climbs over (0.18 if not set) and comes down over (0.22): less to clear a fence. */
    rise?: number;
    fall?: number;
    /** A pause that is a turn on the spot before setting off (it turns over the whole pause, at TURN_RATE). */
    turn?: boolean;
    /** Ground and water legs: how far along its way it looks to face (m; 1.5 if not set). */
    look?: number;
    /** A follower's leg: its walking pace (m/s), for the walk to its own finish at the slot's end. */
    pace?: number;
};

/** One beat of its time at its destination: from `at` seconds after it arrives, it does `beat` at (x, z) facing yaw (a step walks there). */
export type StayBeat = {at: number; beat: ArkBeat; x: number; z: number; yaw: number; /** A step's time (s): its length at its walk's own pace. */ dur?: number};

export type Trip = {
    slot: number;
    doing: ArkDoing;
    /** The main way it travels this slot ("stay" when it doesn't). */
    mode: TripMode;
    /** World seconds: the trip's start, when it arrives, when the slot ends. */
    start: number;
    arrive: number;
    end: number;
    from: Spot;
    /** Where it arrives. */
    to: Spot;
    /** Where it is when the slot ends (after the steps of its stay): where the next slot starts. */
    finish: Spot;
    /** The main ground or water path (x, z). */
    path: NavPoint[] | null;
    legs: Leg[];
    stay: StayBeat[];
    length: number;
    /** Flyers: the height band's cruising height above the ground (m). */
    cruise: number;
    /** Running rather than walking. */
    running: boolean;
    /** A flock member flying with its leader: the leader's trips over this slot, and its place beside it. */
    shadow?: {trips: Trip[]; dx: number; dy: number; dz: number} | null;
    /** A recipe this slot's goal was chosen for (`behaviour-recipes.ts`), and who the trip is (for its episodes). */
    recipe?: string | null;
    owner?: TripOwner | null;
};

/** Its group, when it keeps to one: its leader (its schedule animal, profile and activity), its rank (1…), the group's size. */
export type ScheduleGroup = {leader: ScheduleAnimal; profile: ArkBehaviourProfile; activity: ArkBehaviourProfile["activity"] | null | undefined; rank: number; size: number};

export type ScheduleAnimal = {
    id: string;
    zone: ArkZone;
    /** Its home: where the server placed it (or, for a predator, moved a safe distance from its prey: `spaceHomes`). */
    home: {x: number; y: number; z: number};
    /** Drawn length (m). */
    length: number;
    /** Lives in the sea. */
    sea: boolean;
    /** Young (born on the Ark not long ago): it plays near its group. */
    young?: boolean;
    /** The most its home range may reach (predators near prey). */
    range?: number | null;
    /** For a predator: its nearest prey's home, which it may stalk towards (never past its own range). */
    prey?: {x: number; z: number} | null;
    group?: ScheduleGroup | null;
    /** The predators aboard that could eat it (top predators only: `wireThreats`); it watches one it can see. */
    threats?: ScheduleThreat[] | null;
    /**
     * How well kept it is (`thrive.ts`): the hook for energy (more active when prime, more resting when ordinary)
     * and for who claims the best places first. Not read yet: every band is scheduled the same.
     */
    thrive?: ArkThrive;
    /** A fixed roost the map gives it (its perch, or the roost its text names: `map/place.ts` scheduleRoost); it sleeps there. */
    roost?: Spot | null;
};

/** A predator as its prey sees it: its own schedule animal, profile and activity. */
export type ScheduleThreat = {animal: ScheduleAnimal; profile: ArkBehaviourProfile; activity: ArkBehaviourProfile["activity"] | null | undefined};

/** The hour (0–24) at a world time: the island clock, or a pinned hour. */
export type HoursAt = (epochSeconds: number) => number;

export function sunElevationAt(hours: number): number {
    return 58 * Math.sin((2 * Math.PI * (hours - 6)) / 24);
}

export function awakeAt(profile: ArkBehaviourProfile, activity: ArkBehaviourProfile["activity"] | null | undefined, hours: number): boolean {
    return isAwake(activity ?? profile.activity, sunElevationAt(hours));
}

// MARK: Seeded choices

function rng(seed: number): () => number {
    let s = seed >>> 0 || 1;
    return () => {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return ((s >>> 0) % 1_000_003) / 1_000_003;
    };
}

/** The behaviour's pull at this hour, for this animal (the profile's weight shaped by the day and its personality). */
function hourly(profile: ArkBehaviourProfile, behaviour: ArkBehaviour, weight: number, hours: number, bold: number, curious: number): number {
    const dawn = Math.exp(-(((hours - 6.5) / 1.5) ** 2));
    const dusk = Math.exp(-(((hours - 18.5) / 1.5) ** 2));
    const midday = Math.exp(-(((hours - 13) / 2) ** 2));
    const morning = Math.exp(-(((hours - 9) / 1.8) ** 2));
    const night = hours < 5 || hours > 20 ? 1 : 0;
    const busy = profile.activity === "crepuscular" || profile.twoPeaks ? 1 + 1.5 * (dawn + dusk) - (profile.siesta || profile.twoPeaks ? 0.7 * midday : 0) : 1;
    switch (behaviour) {
        case "rest":
        case "groom":
            return weight * (profile.siesta ? 1 + 2.5 * midday : 1) * (busy > 1 ? 0.6 : 1) * (1 - 0.25 * bold);
        case "forage":
        case "graze":
        case "visit_flowers":
            return weight * busy * (0.85 + 0.3 * curious);
        case "stalk":
            return weight * busy * (0.7 + 0.4 * Math.max(bold, 0));
        case "wander":
            return weight * (0.8 + 0.4 * curious + 0.2 * bold);
        case "hide":
            return weight * (1 - 0.6 * bold);
        case "bask":
            return night ? 0 : weight * (0.4 + 2 * morning);
        case "soar":
            return night ? 0 : weight * (0.3 + 1.5 * midday);
        case "circle_light":
            return night ? weight * 3 : 0;
        case "drink":
            return weight * (1 + dawn + dusk);
        case "flee":
        case "flock":
            return 0;
        default:
            return weight;
    }
}

/**
 * Its own leanings (problem 7: every animal of a kind doing the same thing): each behaviour's pull times 0.65-1.35,
 * and its busy hours shifted up to 45 minutes either way, both its own for life (seeded by its id), so two of a kind
 * with the same profile still choose differently, and not all at the same dawn.
 */
function leaning(id: string, behaviour: ArkBehaviour): number {
    return 0.65 + 0.7 * ((hashString(`${id}#lean#${behaviour}`) % 1000) / 1000);
}
function chronotype(id: string): number {
    return (((hashString(`${id}#chrono`) % 1000) / 1000) - 0.5) * 1.5;
}

function pick(profile: ArkBehaviourProfile, id: string, hoursNow: number, roll: number, bold: number, curious: number, avoid?: ArkBehaviour | null): ArkBehaviour {
    const hours = (((hoursNow + chronotype(id)) % 24) + 24) % 24;
    const entries = (Object.entries(profile.weights) as Array<[ArkBehaviour, number]>)
        .map(([b, w]) => [b, (b === avoid ? hourly(profile, b, w, hours, bold, curious) * 0.25 : hourly(profile, b, w, hours, bold, curious)) * leaning(id, b)] as const)
        .filter(([, w]) => w > 0);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (!total) return "rest";
    let at = roll * total;
    for (const [b, w] of entries) {
        at -= w;
        if (at <= 0) return b;
    }
    return entries[entries.length - 1][0];
}

// MARK: Places

const ROOST_TAGS: Record<ArkRoost, AttachTag[]> = {
    tree: ["branch"],
    tree_hole: ["tree_hollow", "bark", "branch"],
    cliff: ["cliff_ledge", "rock_top"],
    cave: ["cave_mouth", "rock_face"],
    crevice: ["rock_face", "rock_top"],
    rocks: ["rock_top"],
    burrow: ["burrow_entrance"],
    den: ["burrow_entrance", "cave_mouth"],
    ground_cover: ["shade"],
    reeds: ["reeds"],
    water: [],
    bottom: [],
    reef: [],
    leaf: ["leaf_litter", "branch"],
    bark: ["bark"],
    wall: ["house_wall"],
    nest: ["branch", "shade"],
    attached: [],
    open: [],
    // Hauled out where the water meets the land (seals, sea lions, the walrus, penguins).
    shore: ["water_edge", "rock_top"]
};

const INTERACTION_TAGS: Partial<Record<ArkInteraction, AttachTag[]>> = {
    drink_edge: ["water_edge"],
    bask_rock: ["rock_top", "log_top"],
    graze_grass: ["grass"],
    perch_branch: ["branch"],
    perch_rock: ["rock_top", "post", "log_top"],
    dig_soil: ["worm_hole", "burrow_entrance"],
    leaf_litter: ["leaf_litter"],
    flower: ["flower"],
    porch_light: ["porch_light"],
    cave_mouth: ["cave_mouth"],
    cliff_ledge: ["cliff_ledge"],
    tide_pool: ["tide_pool"],
    bark: ["bark"],
    wall: ["house_wall"],
    burrow_mouth: ["burrow_entrance"],
    reeds: ["reeds"],
    shade: ["shade"],
    water_surface: ["pond_surface"],
    shore: ["water_edge"]
};

/** Which places each behaviour goes to (the first of its interactions that has one near home). */
const BEHAVIOUR_PLACES: Partial<Record<ArkBehaviour, ArkInteraction[]>> = {
    drink: ["drink_edge"],
    bask: ["bask_rock", "shore"],
    graze: ["graze_grass"],
    forage: ["leaf_litter", "dig_soil", "graze_grass", "tide_pool", "flower", "bark", "wall", "water_surface"],
    perch: ["perch_branch", "perch_rock", "cliff_ledge"],
    climb: ["perch_branch", "bark"],
    burrow: ["burrow_mouth", "dig_soil"],
    hide: ["shade", "burrow_mouth", "reeds"],
    visit_flowers: ["flower"],
    circle_light: ["porch_light"],
    rest: ["shore", "shade"]
};

export type ScheduleWorld = {sampler: ArkWorldSampler; nav: NavGrid};
export function scheduleWorld(sampler: ArkWorldSampler): ScheduleWorld {
    return {sampler, nav: navGrid(sampler)};
}

/**
 * The shared schedule world (`worldSampler`'s places, then the walk grid) built a few milliseconds at a time between
 * frames (`behaviour-build.ts`): the same world, to the bit, as `scheduleWorld(worldSampler())` all at once. `step`
 * works for about its budget and returns the world once it is built; `spentMs` is the main-thread time it took.
 */
export class ScheduleWorldBuild {
    private sampler: SlicedBuild<ArkWorldSampler> | null;
    private nav: SlicedBuild<NavGrid> | null = null;
    private world: ScheduleWorld | null = null;
    /** Part C: another island's sampler (its own behaviour world in the one world, decision 141); absent: the shared one. */
    private readonly own: ArkWorldSampler | null;

    constructor(own?: ArkWorldSampler | null) {
        this.own = own ?? null;
        this.sampler = this.own ? new SlicedBuild<ArkWorldSampler>([], () => this.own!) : worldSamplerBuild();
    }
    spentMs = 0;
    slices = 0;
    /** The longest single slice (ms): the graphics lane's `allAttachPoints`, one task, sets it unless it was built already. */
    longestMs = 0;

    get done(): boolean {
        return this.world !== null;
    }

    step(budgetMs: number): ScheduleWorld | null {
        if (this.world) return this.world;
        const started = typeof performance !== "undefined" ? performance.now() : Date.now();
        const left = () => budgetMs - ((typeof performance !== "undefined" ? performance.now() : Date.now()) - started);
        this.slices++;
        if (this.sampler) {
            const sampler = this.sampler.step(budgetMs);
            if (sampler) {
                this.sampler = null;
                this.nav = navGridBuild(sampler);
            }
        }
        if (this.nav && (left() > 0 || this.nav.done)) {
            const nav = this.nav.step(Math.max(left(), 0));
            if (nav) this.world = {sampler: this.own ?? worldSampler(), nav};
        }
        const took = (typeof performance !== "undefined" ? performance.now() : Date.now()) - started;
        this.spentMs += took;
        this.longestMs = Math.max(this.longestMs, took);
        return this.world;
    }

    /** Everything left, now. */
    run(): ScheduleWorld {
        for (;;) {
            const world = this.step(Infinity);
            if (world) return world;
        }
    }
}

const FLOCKING = new Set(["flock", "school", "swarm"]);

/**
 * Where a flyer lands to perch: its own kinds first (a seabird's rocks, ledges and posts, never a branch). One with no
 * perch of its own: a flyer anywhere; a bird that walks first a post or a rock top (a hen on the fence), never a branch
 * (lane MA3: a mute swan landed 6 m up in a conifer).
 */
function perchTags(profile: ArkBehaviourProfile): AttachTag[] {
    const tags: AttachTag[] = [];
    if (profile.interactions.includes("perch_branch")) tags.push("branch");
    if (profile.interactions.includes("perch_rock")) tags.push("rock_top", "post");
    if (profile.interactions.includes("cliff_ledge")) tags.push("cliff_ledge");
    return tags.length ? tags : profile.move === "fly" ? ["branch", "post", "rock_top", "cliff_ledge"] : ["post", "rock_top"];
}
const flies = (profile: ArkBehaviourProfile) => profile.move === "fly" || profile.moves.includes("fly");
const swims = (profile: ArkBehaviourProfile) => profile.move === "swim" || profile.moves.includes("swim");
const walks = (profile: ArkBehaviourProfile) => profile.move === "walk" || profile.moves.includes("walk") || profile.moves.includes("hop");

/** Lives in the water: a swimmer, or a seabed walker (crabs, lobsters, stars) whose ground is the sea floor. */
export function aquatic(profile: ArkBehaviourProfile): boolean {
    return profile.move === "swim" || profile.seabed;
}

/** Walks on land and swims (ducks, otters, frogs, crocodiles, penguins, turtles, seals): it crosses at the water's edges. */
export function amphibious(profile: ArkBehaviourProfile): boolean {
    return swims(profile) && (walks(profile) || profile.move !== "swim") && !profile.seabed;
}

/** A swimmer that floats on the surface (a duck, a swan) rather than swimming down in the water. */
export function floats(profile: ArkBehaviourProfile): boolean {
    return profile.move === "swim" ? profile.moves.includes("fly") && !profile.breathes : profile.roost === "water";
}

/**
 * The length (m) a swimmer's pace is counted in, at true size: its own up to 2 m (a seal, a dolphin), then growing as
 * √L (cruising speed grows far slower than length: a 14 m humpback cruises at about 6 m/s, not 16). Motion pass §3.
 */
export function swimPaceLength(length: number): number {
    const L = Math.max(length, 0.05);
    return L <= 2 ? L : 2 * Math.sqrt(L / 2);
}

/** How far it can go in one slot at its own pace (ground, water; flyers go four times as fast). */
export function reachOf(profile: ArkBehaviourProfile, animal: ScheduleAnimal): number {
    const flyer = profile.move === "fly";
    // (On foot at its walk's pace; in the air and the water at its own: the walk clip governs only walking.)
    return (flyer || profile.move === "swim" ? freeBodyLengthsPerSecond(profile) : bodyLengthsPerSecond(profile)) * (profile.move === "swim" ? swimPaceLength(animal.length) : Math.max(animal.length, 0.05)) * (flyer ? 4 : profile.move === "swim" ? 1.4 : 1) * SLOT_SECONDS * 0.75;
}

/**
 * Its home range's radius: by how it moves and its size; never more than half what it can cover in a slot (so
 * every trip in it is done in its time at its own pace), nor more than its `range` (a predator near prey).
 */
export function homeRadius(profile: ArkBehaviourProfile, animal: ScheduleAnimal): number {
    const flyer = profile.move === "fly";
    const base = flyer ? 18 : profile.move === "swim" ? 14 : 6;
    const wanted = Math.min(Math.max(base + animal.length * 5, 3), flyer ? 40 : 26);
    // A range cap (`spaceHomes`) is the whole reach, water and roost included: its everyday range is two thirds of it.
    return Math.max(Math.min(wanted, reachOf(profile, animal) / 2, (animal.range ?? Infinity) / 1.5), 0.4);
}

function spotOf(point: AttachPoint): Spot {
    return {x: point.x, y: point.y, z: point.z, nx: point.nx, ny: point.ny, nz: point.nz, point: point.id};
}

/**
 * The water's surface over a point (Part C: the world's own, `ArkWorldSampler.waterSurface`: the bigger wild island's
 * lake and river stand above the sea at their own level). Absent, as on today's island and the town: 0, the sea's,
 * where all their water's surface is; so every test below reads exactly as it did there.
 */
const surfaceY = (world: ScheduleWorld, x: number, z: number) => waterSurfaceOf(world.sampler, x, z);
/** What stands there: the ground, or the water's surface over it. */
const topAt = (world: ScheduleWorld, x: number, z: number) => topOf(world.sampler, x, z);

function groundSpot(world: ScheduleWorld, x: number, z: number): Spot {
    return {x, y: topAt(world, x, z), z, nx: 0, ny: 1, nz: 0, point: null};
}

/**
 * The water's surface where the schedule puts something on it (graphics batch 6, `water-level.ts`): the lake's and the
 * river's fixed level, the sea's mean (0; the scene's depth bands follow the tide). Read when a trip is planned, not
 * every frame (it samples the ground).
 */
const surfaceAt = (x: number, z: number) => waterLevelAt(x, z, 0);

const raised = (world: ScheduleWorld, p: Spot) => p.y > topAt(world, p.x, p.z) + 0.4;
const wet = (world: ScheduleWorld, p: {x: number; z: number}) => world.sampler.heightAt(p.x, p.z) < surfaceY(world, p.x, p.z);

/**
 * A body this long (m) or longer is too heavy for a limb that only half suits it (lane MA3: a perch's size against the
 * body's mass, which grows as the length cubed: at 0.6 m a bird is 1-2 kg, a swan's 1.5 m is 10 kg). On a branch it
 * takes only a limb that suits its whole length, never one in a crown.
 */
export const HEAVY_PERCH_LENGTH = 0.6;
/** Whether a place suits a body this long: its size range (half again for a light body on a branch; none in a crown). */
export function perchSuits(point: Pick<AttachPoint, "size" | "hidden" | "tag">, length: number): boolean {
    if (length < point.size[0] * 0.5) return false;
    const branch = point.tag === "branch" || point.tag === "canopy_hang";
    if (branch && length >= HEAVY_PERCH_LENGTH) return !point.hidden && length <= point.size[1];
    return length <= point.size[1] * (point.hidden ? 1.05 : 1.5);
}

/** A seeded attach point of these tags within reach of a centre (and suiting its size), or null. */
function placeNear(world: ScheduleWorld, centre: {x: number; z: number}, length: number, tags: AttachTag[], radius: number, roll: number): AttachPoint | null {
    for (const tag of tags) {
        const near = world.sampler.attachPoints(tag, {x: centre.x, z: centre.z, r: radius});
        // (A place inside a tree's crown, on the bigger wild island: no body larger than its own small size; a heavy body
        // only on a limb that suits all of it: `perchSuits`.)
        const fits = near.filter((p) => perchSuits(p, length));
        // (Grounding, L3: never a tree perch that does not suit it, a pelican on a twig or a crane in a crown hidden in the
        // leaves; another goal instead.)
        const list = fits.length ? fits : near.filter((p) => p.tag !== "branch" && p.tag !== "canopy_hang");
        if (list.length) {
            // Nearer places a little more likely: by distance (then id), a seeded pick weighted to the front (each animal
            // its own). The pick is the k-th in that order, found without sorting the whole list (`kthNearest`).
            return kthNearest(list, centre, Math.floor(roll ** 1.4 * list.length));
        }
    }
    return null;
}

/**
 * The k-th of these points by distance from a centre, then by id: what sorting them all and taking the k-th gives (the
 * same distances, `Math.hypot`, and the same tie-break), by selection in linear time. (2026-11-11: a cold schedule's
 * goal searches sorted every leaf in a canopy's 40 m, the main cost of the runtime's resting query at 9,420 animals.)
 */
export function kthNearest<T extends {x: number; z: number; id: string}>(list: readonly T[], centre: {x: number; z: number}, k: number): T {
    const n = list.length;
    const d = new Float64Array(n);
    const order = new Array<number>(n);
    for (let i = 0; i < n; i++) {
        d[i] = Math.hypot(list[i].x - centre.x, list[i].z - centre.z);
        order[i] = i;
    }
    const before = (a: number, b: number) => d[a] - d[b] || list[a].id.localeCompare(list[b].id);
    let lo = 0;
    let hi = n - 1;
    const want = Math.min(Math.max(k, 0), n - 1);
    while (lo < hi) {
        // Median of three as the pivot, then a three-way split round it.
        const mid = (lo + hi) >> 1;
        const a = order[lo];
        const b = order[mid];
        const c = order[hi];
        const pivot = before(a, b) < 0 ? (before(b, c) < 0 ? b : before(a, c) < 0 ? c : a) : before(a, c) < 0 ? a : before(b, c) < 0 ? c : b;
        let lt = lo;
        let gt = hi;
        let i = lo;
        while (i <= gt) {
            const cmp = before(order[i], pivot);
            if (cmp < 0) {
                const t = order[lt];
                order[lt] = order[i];
                order[i] = t;
                lt++;
                i++;
            } else if (cmp > 0) {
                const t = order[gt];
                order[gt] = order[i];
                order[i] = t;
                gt--;
            } else i++;
        }
        if (want < lt) hi = lt - 1;
        else if (want > gt) lo = gt + 1;
        else return list[order[want]];
    }
    return list[order[want]];
}

/** How steep it walks: a mountain animal takes the slopes. */
export function maxSlopeOf(animal: ScheduleAnimal): number {
    return animal.zone === "mountains" ? MOUNTAIN_SLOPE : MAX_SLOPE;
}

/**
 * How wide it is, for its paths (collisions, motion pass L5): half its drawn width (`collide/bodies.ts`, its model's
 * own shape at its length and its sex's scale). Its paths keep this far from every fence, trunk, rock and wall.
 */
const bodies = new WeakMap<ScheduleAnimal, {radius: number; reach: number}>();
function bodyOf(animal: ScheduleAnimal, slug: string): {radius: number; reach: number} {
    let b = bodies.get(animal);
    if (!b) {
        const shape = bodyShape(slug, Math.max(animal.length, 0.05) * sexLook(animal.id, slug).scale);
        bodies.set(animal, (b = {radius: shape.radius, reach: shape.radius + shape.half}));
    }
    return b;
}
export function bodyRadiusOf(animal: ScheduleAnimal, slug: string): number {
    return bodyOf(animal, slug).radius;
}
/** How far its body reaches from its middle whichever way it turns (its capsule's half length): where it stands and turns. */
export function bodyReachOf(animal: ScheduleAnimal, slug: string): number {
    return bodyOf(animal, slug).reach;
}

/**
 * Where a climb up to a raised spot starts (collisions): the nearest ground round it its body fits at whose straight
 * climb to the spot crosses nothing but what it climbs (the spot's own tree or rock: `collide/attach.ts` hostOf),
 * searched outwards; else the nearest walkable ground. The same for the walk check and the trip.
 */
function climbFoot(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, p: Spot): Spot | null {
    const bodyR = bodyRadiusOf(animal, profile.slug);
    const host = hostOf(p.point);
    const own = (c: Collider) => (host !== null && (c.id === `trunk:${host}` || c.id === `rock:${host}`)) || colliderDistance(c, p.x, p.z) < 0.4;
    for (let ring = 1; ring <= 8; ring++) {
        const d = 0.25 + ring * 0.4;
        for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            const x = p.x + Math.sin(a) * d;
            const z = p.z + Math.cos(a) * d;
            if (world.nav.fits(x, z, bodyR, maxSlopeOf(animal)) && world.nav.runClear({x, z}, p, bodyR * 0.5, own)) return groundSpot(world, x, z);
        }
    }
    const at = world.nav.nearest(p.x, p.z, "walk", 0.5, 3, maxSlopeOf(animal), bodyR);
    return at ? groundSpot(world, at.x, at.z) : null;
}

/**
 * A perch up on a surface (a rock's top, a branch, a ledge) its body fits on (collisions): nothing solid but what it is on
 * (its rock and the rocks touching it, its tree) within its reach there. A crocodile on a small rock top beside a taller
 * rock does not; it rests at the rock's foot instead.
 */
function perchFits(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, spot: Spot): boolean {
    const solid = world.nav.colliders;
    if (!solid || !raised(world, spot)) return true;
    const surface = surfaceOf(spot);
    if (!surface) return true;
    const reach = bodyReachOf(animal, profile.slug);
    const height = Math.max(animal.length * 0.5, 0.1);
    // (Up in a tree, the trunks are its tree's: only rocks, walls and fences round a perch count.)
    for (const c of solid.near(spot.x, spot.z, reach + 0.01)) {
        if (c.soft || c.kind === "trunk" || c.y1 - 0.02 <= spot.y || c.y0 >= spot.y + height) continue;
        if ((surface.host && c.id === `rock:${surface.host}`) || colliderDistance(c, surface.x, surface.z) < (surface.r ?? 0.15)) continue;
        if (reach - colliderDistance(c, spot.x, spot.z) > Math.max(reach * 0.25, 0.03)) return false;
    }
    return true;
}

/**
 * A goal on the ground it fits at (collisions): a spot whose body would stand in a trunk, a rock, a fence or a wall (a
 * patch of grass by a barn, the shade spot of one tree in another's trunk, a wander spot by a log) moves to the nearest
 * point its body fits at whichever way it turns there (its reach), walkable, within 4 m (searched outwards, the same for
 * every caller). A spot on a surface (a branch, a rock's face, a burrow's mouth) or off the ground (raised, in the
 * water) stays where it is.
 */
function clearOfSolid(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, spot: Spot, still = false): Spot {
    const nav = world.nav;
    if (!nav.colliders || onSurface(spot.point) || raised(world, spot) || wet(world, spot)) return spot;
    // (Where it lies still, a roost: its width; where it turns, its reach.)
    const r = still ? bodyRadiusOf(animal, profile.slug) : bodyReachOf(animal, profile.slug);
    const slope = maxSlopeOf(animal);
    // (Clear of everything solid, and not on a cliff's face.)
    if (nav.fits(spot.x, spot.z, r, slope)) return spot;
    // (Rings 0.35 m apart, out to 4.2 m, at most 16 points each: the first that fits, in ring order, is the spot; each
    // animal starts its rings at its own bearing and its own offset out, so a group nudged off one trunk or one fence
    // does not line up in a row along it.)
    const seed = hashString(`${animal.id}#clear`);
    const turn = ((seed % 1000) / 1000) * Math.PI * 2;
    const out = ((Math.floor(seed / 1000) % 1000) / 1000) * 0.3;
    for (let ring = 1; ring <= 12; ring++) {
        const d = ring * 0.35 + out;
        const n = Math.min(Math.max(8, Math.round((Math.PI * 2 * d) / 0.35)), 16);
        for (let k = 0; k < n; k++) {
            const a = turn + (k / n) * Math.PI * 2;
            const x = spot.x + Math.cos(a) * d;
            const z = spot.z + Math.sin(a) * d;
            if (!nav.fits(x, z, r, slope)) continue;
            // (The way it came in, from the spot: never past a fence to its far side.)
            if (!nav.runClear({x: spot.x, z: spot.z}, {x, z}, 0.01)) continue;
            return {...spot, x, y: topAt(world, x, z), z};
        }
    }
    return spot;
}

/** A point in the water near a spot, at the depth it swims at. */
function waterSpot(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, x: number, z: number, random: () => number): Spot {
    const water = world.nav.nearest(x, z, "swim", Math.max(animal.length * 0.6, 0.4)) ?? world.nav.nearest(x, z, "swim", 0.2, 20) ?? {x, z};
    const floor = world.sampler.heightAt(water.x, water.z);
    // (On the surface: the lake's and river's fixed level, the sea's mean: the scene's depth bands follow the tide.)
    const level = surfaceAt(water.x, water.z);
    // (Its depth under the surface: below the sea's 0 there, under the lake's or the river's own level on the bigger island.)
    const y = floats(profile) || (!aquatic(profile) && !profile.breathes) ? level : profile.seabed ? floor : Math.max(floor + animal.length * 0.6, Math.min(level - animal.length * 0.4 - random() * Math.max(surfaceY(world, water.x, water.z) - floor - animal.length, 0), level - 0.2));
    return {x: water.x, y: Math.min(y, level), z: water.z, nx: 0, ny: 1, nz: 0, point: null};
}

/**
 * A group member's own side of its group: a point on its own bearing from the group's middle, a little over half the
 * group's spread out (bearings a golden angle apart by rank, each turned a little by its id, the same every slot).
 */
function memberSide(centre: {x: number; z: number}, animal: ScheduleAnimal, rank: number, radius: number): {x: number; z: number} {
    const bearing = rank * 2.399963 + ((hashString(`${animal.id}#side`) % 1000) / 1000 - 0.5) * 0.5;
    return {x: centre.x + Math.sin(bearing) * radius * 0.55, z: centre.z + Math.cos(bearing) * radius * 0.55};
}

/** A point to go to within a range of a centre: walkable land (or water for a swimmer). */
function rangeSpot(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, centre: {x: number; z: number}, radius: number, random: () => number): Spot {
    const r = radius * Math.sqrt(random());
    const a = random() * Math.PI * 2;
    const x = centre.x + Math.cos(a) * r;
    const z = centre.z + Math.sin(a) * r;
    if (aquatic(profile)) return waterSpot(world, profile, animal, x, z, random);
    const land = world.nav.nearest(x, z, "walk", 0.5, 12, maxSlopeOf(animal)) ?? centre;
    return groundSpot(world, land.x, land.z);
}

/** Its roost: the same place every night (seeded by its id), from its profile's roost kind; a group's members by their leader's. */
/**
 * Its roost, as its body can sleep there (collisions): on the ground clear of anything solid and off a cliff's face
 * (`clearOfSolid`), up on a perch only one its body fits on (`perchFits`), else at the perch's foot. The same spot
 * for everyone who asks (the trip there, the stay, `restingAtRoost`), worked out once per world.
 */
let roosts = new WeakMap<ScheduleWorld, WeakMap<ScheduleAnimal, Spot>>();
export function roostOf(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal): Spot {
    let byAnimal = roosts.get(world);
    if (!byAnimal) roosts.set(world, (byAnimal = new WeakMap()));
    const known = byAnimal.get(animal);
    if (known) return known;
    let spot = rawRoostOf(world, profile, animal);
    if (world.nav.colliders && !aquatic(profile)) {
        if (!perchFits(world, profile, animal, spot)) {
            const foot = world.nav.nearest(spot.x, spot.z, "walk", 0.5, 3, maxSlopeOf(animal), bodyReachOf(animal, profile.slug));
            if (foot) spot = groundSpot(world, foot.x, foot.z);
        }
        spot = clearOfSolid(world, profile, animal, spot, true);
    }
    // A roost on the ground it could never walk to: off its own stretch of ground (the walk chain kept it where it was,
    // and its sleep, a stay, jumped it there), or further than it walks in a slot (`tooFarOnFoot`). A bed on its home
    // ground instead, the same every night, and the same for everyone who asks: the way there, its sleep, a night watch,
    // `restingAtRoost`, the props lane's den (decision 202: at its natural pace an alligator jumped 21 m into its sleep).
    // (A walker that swims too, a penguin, the same: its roost on land is one it climbs out to on its own ground, by an
    // edge on it. A roost in the water it swims to.) The bed is on dry land, as a den is (`denDry`: never in the sea, its
    // tide or its surf), unless it sleeps on the shore anyway.
    if (walksGoals(profile) && !flies(profile) && !raised(world, spot)) {
        const fits = (to: Spot) => !wet(world, to) && onItsGround(world, profile, animal, {doing: "sleep", to, mode: "ground", stay: []});
        if (!wet(world, spot) && (!fits(spot) || tooFarOnFoot(world, profile, animal, spot))) {
            const dry = (to: Spot) => profile.roost === "shore" || denDry(world, to.x, to.z);
            const bedFits = (to: Spot) => dry(to) && fits(to) && !tooFarOnFoot(world, profile, animal, to);
            // (The first of a few seeded spots round its home that fits, on dry land.)
            const random = rng(hashString(`${animal.id}#bed`));
            const onLand = {...profile, move: "walk" as const, seabed: false};
            const radius = Math.min(homeRadius(profile, animal), 2);
            let bed: Spot | null = null;
            for (let k = 0; k < 8 && !bed; k++) {
                let at = rangeSpot(world, onLand, animal, animal.home, radius * (1 + k / 4), random);
                if (world.nav.colliders) at = clearOfSolid(world, onLand, animal, at, true);
                if (bedFits(at)) bed = at;
            }
            // (Else the nearest that fits on its home ground: its home itself, then rings out from it, half a metre apart,
            // to BED_REACH: a newt's home by the river's mouth gets a bed up the bank, never in the surf.)
            for (let ring = 0; ring * 0.5 <= BED_REACH && !bed; ring++) {
                const n = ring === 0 ? 1 : Math.min(Math.max(8, Math.round(Math.PI * 2 * ring)), 24);
                for (let k = 0; k < n && !bed; k++) {
                    const a = (k / n) * Math.PI * 2;
                    const x = animal.home.x + Math.cos(a) * ring * 0.5;
                    const z = animal.home.z + Math.sin(a) * ring * 0.5;
                    if (world.sampler.heightAt(x, z) < 0 || !dry({x, z} as Spot)) continue;
                    let at = groundSpot(world, x, z);
                    if (world.nav.colliders) at = clearOfSolid(world, onLand, animal, at, true);
                    if (bedFits(at)) bed = at;
                }
            }
            // (None: its roost as it was.)
            if (bed) spot = bed;
        }
    }
    byAnimal.set(animal, spot);
    return spot;
}

/** How far from its home a bed is looked for (m), when its roost is out of reach (`roostOf`). */
const BED_REACH = 16;

/**
 * Dry land for a bed, as a den's (`map/points.ts` inSurf, DEN_DRY, SURF_REACH): not in the water, and not on ground
 * lower than DEN_DRY within SURF_REACH of it, the sea's spring tide and its surf. Of any water here, not only the sea's
 * (the map tells the river's mouth from the sea its own way: five amphibians' beds by the mouth were in its surf), and
 * with a margin (a tenth of a metre up, a metre out, sampled every metre) for the walk grid's heights against the map's.
 */
function denDry(world: ScheduleWorld, x: number, z: number): boolean {
    const height = world.sampler.heightAt(x, z);
    if (height < 0) return false;
    if (height >= DEN_DRY + 0.1) return true;
    const reach = SURF_REACH + 1;
    for (let d = 1; d <= reach; d++) {
        for (let k = 0; k < 24; k++) if (world.sampler.heightAt(x + Math.cos((k / 24) * Math.PI * 2) * d, z + Math.sin((k / 24) * Math.PI * 2) * d) < 0) return false;
    }
    return true;
}

function rawRoostOf(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal): Spot {
    if (animal.roost) return animal.roost;
    const group = animal.group;
    // (A flock whose text has it sleeping together, huddled or in a row, roosts as a group too: `sleep.ts`.)
    const together = sleepStyle(profile.slug).social !== "apart";
    if (group && (!FLOCKING.has(profile.social) || together)) {
        // The group sleeps together: round its leader's roost, each a little apart; huddled, piled or a young mammal
        // against the adult, touching (`sleepSpacing`); on a raised perch in a row along it or a bat's cluster.
        const lead = roostOf(world, group.profile, group.leader);
        if (lead.point && raised(world, lead) && together) {
            // (The point's id keeps the tag it was made with, not always the schedule's: a limb is a branch.)
            const at = RAISED_TAGS.map((tag) => world.sampler.attachPoints(tag, {x: lead.x, z: lead.z, r: 0.3}).find((p) => p.id === lead.point)).find(Boolean);
            const off = roostOffset(profile.slug, group.rank, Math.max(animal.length, group.leader.length), at?.yaw ?? 0);
            if (off) return {...lead, x: lead.x + off.dx, y: lead.y + off.dy, z: lead.z + off.dz};
        }
        if (!lead.point || !raised(world, lead)) {
            const angle = group.rank * 2.39996;
            const close = sleepSpacing(profile.slug, Boolean(animal.young));
            const d = Math.max(animal.length, group.leader.length) * (close < 1 ? (animal.young && !together ? 0.5 : 0.55 * Math.sqrt(group.rank)) : 0.9 + 0.35 * Math.sqrt(group.rank));
            const x = lead.x + Math.cos(angle) * d;
            const z = lead.z + Math.sin(angle) * d;
            if (wet(world, lead)) return {...waterSpot(world, profile, animal, x, z, () => 0.5)};
            const land = world.nav.nearest(x, z, "walk", 0.5, 4, maxSlopeOf(animal)) ?? lead;
            return groundSpot(world, land.x, land.z);
        }
    }
    const seed = rng(hashString(`${animal.id}#roost`))();
    // A water animal (a fish, a crab) never roosts on a land place, whatever its profile says (a seal hauls out: it may).
    // (A hanger, a bat or a sloth, hangs under a limb first: `recipeRoostTags`.)
    const tags = aquatic(profile) && !amphibious(profile) ? [] : recipeRoostTags(profile) ?? ROOST_TAGS[profile.roost] ?? [];
    const point = tags.length ? placeNear(world, animal.home, animal.length, tags, Math.min(homeRadius(profile, animal) * 1.5, animal.range ?? Infinity), seed) : null;
    // (A water-only animal's roost is in the water: a dry rock or a tree is no roost for a fish.)
    if (point && (!aquatic(profile) || amphibious(profile) || (wet(world, point) && point.y < surfaceY(world, point.x, point.z) + 0.02))) return spotOf(point);
    if (aquatic(profile) || profile.roost === "water" || profile.roost === "bottom" || profile.roost === "reef") {
        const water = world.nav.nearest(animal.home.x, animal.home.z, "swim", 0.4) ?? animal.home;
        const floor = world.sampler.heightAt(water.x, water.z);
        const top = surfaceY(world, water.x, water.z);
        const y = profile.roost === "water" && floats(profile) ? surfaceAt(water.x, water.z) : profile.seabed || profile.roost === "bottom" ? floor : Math.min(floor + Math.max((top - floor) * 0.5, 0.4), top - 0.3);
        return {x: water.x, y, z: water.z, nx: 0, ny: 1, nz: 0, point: null};
    }
    return {...groundSpot(world, animal.home.x, animal.home.z)};
}

// MARK: Groups

/** How far from its home an animal can be seen: its range, half again for water and its roost (`spaceHomes` keeps these apart). */
export function rangeReach(profile: ArkBehaviourProfile, animal: ScheduleAnimal): number {
    return homeRadius(profile, animal) * 1.5;
}

/** How far a group's members keep from their leader: wider for bigger animals and bigger groups. */
export function groupSpread(length: number, size: number): number {
    return 2.5 + 1.6 * Math.max(length, 0.3) * Math.sqrt(Math.max(size, 1));
}

/** Where its group's leader is at a moment (pure: the leader's own schedule). */
function leaderAt(world: ScheduleWorld, group: ScheduleGroup, epoch: number, hoursAt: HoursAt): TripPose {
    return basePoseOnTrip(world, tripAt(world, group.profile, group.leader, epoch, hoursAt, group.activity), epoch);
}

/** What its group's leader is set on at a moment (its intent: no route worked out). */
function leaderIntentAt(world: ScheduleWorld, group: ScheduleGroup, epoch: number, hoursAt: HoursAt): Intent {
    return intent(world, group.profile, group.leader, group.activity, slotOf(group.leader, epoch), hoursAt);
}

/**
 * The group's middle for a member's slot: the place its leader is at halfway through it (its slot's goal), not where
 * the leader's own steps there have walked it by then. (2026-11-11, five lions in a row: each member's slot is offset
 * from the leader's, so each took a different moment of the leader's forage, a line of forward steps, as its middle,
 * and the members near their middles stood along that line.)
 */
function groupCentre(world: ScheduleWorld, animal: ScheduleAnimal, slot: number, hoursAt: HoursAt): {x: number; z: number} | null {
    const group = animal.group;
    if (!group) return null;
    const trip = tripAt(world, group.profile, group.leader, slotStart(animal, slot) + SLOT_SECONDS / 2, hoursAt, group.activity);
    return {x: trip.to.x, z: trip.to.z};
}

// MARK: The slot

/** A slot's goal: what for, where (null: wherever the last slot left it), how it travels, and its time there. */
type Intent = {doing: ArkDoing; to: Spot | null; mode: TripMode; stay: Array<Omit<StayBeat, "x" | "z" | "yaw"> & {dx?: number; dz?: number; turn?: number}>; follow?: boolean; /** Its heading once there (a prey animal faces the predator it watches); else seeded. */ face?: number; recipe?: string};

const STAY_DOINGS: ReadonlySet<ArkDoing> = new Set<ArkDoing>(["rest", "groom", "idle", "sleep", "watch"]);

/**
 * Its beats at the destination: the grazing loop (head down to bite, chew, a step on, now and then the head up to
 * look round), pecking and scanning on the ground, preening on a perch, drinking, basking, play. Offsets are in
 * its own heading's frame (dx forward, dz to the side, in body lengths); times in seconds after it arrives.
 */
function stayBeats(doing: ArkDoing, random: () => number, after: ArkBeat | null): Intent["stay"] {
    const beats: Intent["stay"] = [];
    let t = 0;
    if (after) {
        beats.push({at: 0, beat: after});
        t = after === "shake" ? 2.6 : 0;
    }
    // About a slot's worth (a short trip leaves most of it); a long trip squeezes them (`tripFor`).
    const add = (beat: ArkBeat, seconds: number, extra: {dx?: number; dz?: number; turn?: number} = {}) => {
        if (t > 66) return;
        beats.push({at: t, beat, ...extra});
        t += seconds;
    };
    switch (doing) {
        case "graze":
        case "browse":
            for (let n = 0; n < 14; n++) {
                // Now and then, head down between bites, it turns a little where it stands (26 degrees at most):
                // the only bigger change of its way, and after a pause.
                add("bite", 3 + random() * 5, random() < 0.08 ? {turn: (random() - 0.5) * 0.9} : {});
                add("chew", 1.5 + random() * 2.5);
                if (random() < 0.28) add("scan", 2 + random() * 2.5, {turn: (random() - 0.5) * 1.6});
                // Steps straight on along the way it faces, a few degrees off at most (a grazer drifts forward along the
                // grass; 2026-11-11: a step to one side and the next to the other read as 2-13 turns a minute of movement).
                if (random() < 0.55) add("step", 1.4, {dx: doing === "browse" ? 0.3 + random() * 0.15 : 0.45 + random() * 0.3, turn: (random() - 0.5) * 0.08});
            }
            break;
        case "forage":
        case "visit_flowers":
            for (let n = 0; n < 16; n++) {
                // (As grazing: straight on, a few degrees off; now and then a turn where it stands, 26 degrees at most.)
                add("peck", 1.5 + random() * 3, random() < 0.08 ? {turn: (random() - 0.5) * 0.9} : {});
                if (random() < 0.3) add("scan", 1.5 + random() * 2, {turn: (random() - 0.5) * 1.4});
                if (random() < 0.6) add("step", 1, {dx: 0.5 + random() * 0.4, turn: (random() - 0.5) * 0.08});
            }
            break;
        case "drink":
            add("drink", 6 + random() * 8);
            add("scan", 2 + random() * 2, {turn: (random() - 0.5)});
            add("drink", 4 + random() * 6);
            add("rest", 30);
            break;
        case "watch":
            for (let n = 0; n < 10; n++) add("scan", 3 + random() * 4, {turn: (random() - 0.5) * 2.2});
            break;
        case "perch":
        case "rest":
        case "groom":
        case "bask":
        case "hide":
            for (let n = 0; n < 8; n++) {
                add(doing === "groom" || (doing === "perch" && random() < 0.4) ? "preen" : "rest", 5 + random() * 8);
                if (random() < 0.35) add("scan", 2 + random() * 2, {turn: (random() - 0.5) * 1.2});
            }
            break;
        case "play":
            // Dashes and dodges, not spins (its turns were up to 70 degrees a second: young went round in circles).
            // Dashes, and now and then a dodge (not a spin).
            for (let n = 0; n < 18; n++) add("play", 0.9 + random() * 0.8, {dx: 0.6 + random() * 0.6, dz: (random() - 0.5) * 0.2, turn: n % 3 === 2 ? (random() - 0.5) * 1 : (random() - 0.5) * 0.25});
            break;
        case "stalk":
            for (let n = 0; n < 6; n++) {
                add("stalk", 3 + random() * 3, {dx: 0.25 + random() * 0.25});
                add("pause", 2 + random() * 4);
            }
            break;
        default:
            break;
    }
    return beats;
}

/**
 * What a slot is for, and where (null: wherever the last slot left it). Pure in (id, slot, the hour). After four
 * slots in a row of staying put, the fifth goes back home (or to its group): so where a slot ends never depends on
 * more than the four slots before it, and every caller works it out the same way.
 */
function intent(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Intent {
    return remember(memoOf(world, hoursAt, animal).intents, slot, () => workIntent(world, profile, animal, activity, slot, hoursAt));
}

function workIntent(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Intent {
    const placed = placedIntent(world, profile, animal, activity, slot, hoursAt);
    // (One that never walks its goals, a flyer or a swimmer that stays in the water, goes as planned: its walk chain
    // would keep every goal, so it is not worked out.)
    if (!placed.to || placed.follow || !walksGoals(profile)) return placed;
    // Which goals it walks to is worked out in order through its slots (where each leaves it decides the next), from a
    // start WALK_LEAD blocks of slots back: never chained back through every slot, and the same for every caller. (The
    // lead is where two chains, a block apart, come to agree where it is.)
    const start = (Math.floor(slot / WALK_BLOCK) - WALK_LEAD) * WALK_BLOCK;
    // (Whether it walks there, as a flag: not by comparing goal objects, which a planned intent worked out again after
    // the memo let it go is not, so the answer turned on the order things were asked in, a school's leader's swim read
    // as a walk and its school no longer following. 2026-11-11.)
    const here = walkChain(world, profile, animal, activity, start, hoursAt)[slot - start];
    // (A prey animal watching a predator it cannot walk off from by a plain way watches it from where it is: still facing it.)
    return here === null ? placed : {...placed, to: here, mode: "ground", face: placed.doing === "watch" ? placed.face : undefined};
}

/**
 * (Collisions.) Whether its body can stand at a goal on dry ground: a cliff's face with nowhere near to stand
 * (`clearOfSolid` found none) is not gone to, nor started from (2026-11-12: a tenkile climbed to a shade spot on a
 * mountain's face, raised over the walk grid's ground by the slope, and rested there on ground rising 2.1 in 1 for most of
 * an hour). Surface places (a branch, a rock's top) and wet goals are their own.
 */
function standsAt(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, placed: Intent): boolean {
    const to = placed.to;
    // (A point above the walk grid's ground that is no surface, a shade spot on a steep face, is ground too.)
    if (!to || !world.nav.colliders || !walksGoals(profile) || flies(profile) || placed.mode === "air" || onSurface(to.point) || (raised(world, to) && !to.point) || wet(world, to)) return true;
    return world.nav.fits(to.x, to.z, bodyRadiusOf(animal, profile.slug), maxSlopeOf(animal));
}

/** Slots in a block of the walk chain (`walkChain`), and the blocks it runs before the block it decides. */
const WALK_BLOCK = 6;
const WALK_LEAD = 2;

/**
 * The goals it goes to over WALK_LEAD + 1 blocks of slots from `start`: each slot's planned goal if it walks there from where
 * the slot before left it (`walkable`), else where it already is (it does what it meant to there). It starts where its
 * planned goals before `start` leave it.
 */
function walkChain(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, start: number, hoursAt: HoursAt): Array<Spot | null> {
    // (Each slot's entry: null where it goes as planned; where it does not, the spot it stays at instead.)
    return remember(memoOf(world, hoursAt, animal).chains, start, () => {
        // Where it starts: its last planned goal before the chain, and where its beats there left it.
        let goal: Spot | null = null;
        let at: Spot | null = null;
        for (let back = 1; back <= LOOK_BACK && !goal; back++) {
            const earlier = placedIntent(world, profile, animal, activity, start - back, hoursAt);
            if (earlier.follow) break;
            // (Only a goal on its own stretch of ground: one it can ever walk to, and one its body can stand at.)
            if (earlier.to && onItsGround(world, profile, animal, earlier) && standsAt(world, profile, animal, earlier)) {
                goal = earlier.to;
                at = endOf(world, profile, animal, start - back, earlier, earlier.to, null);
            }
        }
        const out: Array<Spot | null> = [];
        for (let k = start; k < start + WALK_BLOCK * (WALK_LEAD + 1); k++) {
            const placed = placedIntent(world, profile, animal, activity, k, hoursAt);
            if (placed.follow) {
                goal = null;
                at = null;
                out.push(null);
                continue;
            }
            if (!placed.to) {
                out.push(null);
                continue;
            }
            const goes = walkable(world, profile, animal, placed, at);
            const to = goes ? placed.to : {...(at ?? groundSpot(world, animal.home.x, animal.home.z)), yaw: undefined};
            out.push(goes ? null : to);
            at = endOf(world, profile, animal, k, placed, to, goal);
            goal = to;
        }
        return out;
    });
}

/** Where its beats at a goal leave it, placed as `settle` places them (facing from the goal before). */
function endOf(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, slot: number, placed: Intent, to: Spot, before: Spot | null): Spot {
    return placeStay(world, profile, animal, to, arrivalYaw(animal, slot, {...placed, to}, before), placed.stay, Infinity).finish;
}

/** How many slots back its last goal is looked for (where it is now, as `finishOf` finds it). */
const LOOK_BACK = 6;

/** Its intent before the walk check: planned, and kept in the water if it lives there. */
function placedIntent(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Intent {
    return remember(memoOf(world, hoursAt, animal).placed, slot, () => {
        const planned = keepInWater(world, profile, animal, plannedIntent(world, profile, animal, activity, slot, hoursAt));
        // (Collisions: a ground goal its body fits at; a perch up on a rock or a tree its body fits on.)
        if (!planned.to || planned.follow || aquatic(profile)) return planned;
        // (Its roost is made clear once, by `roostOf`, the same for everyone who asks: not moved again here.)
        // (A wary watch's spot off a predator is a goal like any other: made clear too.)
        if (planned.doing === "sleep" || planned.doing === "to_roost" || (planned.doing === "watch" && planned.mode === "stay")) return planned;
        if (!perchFits(world, profile, animal, planned.to)) {
            const foot = world.nav.nearest(planned.to.x, planned.to.z, "walk", 0.5, 3, maxSlopeOf(animal), bodyReachOf(animal, profile.slug));
            if (foot) return {...planned, to: groundSpot(world, foot.x, foot.z), mode: planned.mode === "air" ? "air" : "ground"};
        }
        const to = clearOfSolid(world, profile, animal, planned.to);
        return to === planned.to ? planned : {...planned, to};
    });
}

/**
 * A walk it would not take (the map lane, 2026-11-11: a lion hemmed in among rocks turned full circles; the home-growth
 * lane: a polar bear's route stepped 8.7 m up a cliff). A goal on foot that its walk grid cannot reach from where it is,
 * or only by going well round (a path over 1.3 times the straight way and 2 m more: round a rock to a spot just behind
 * it), or by turning more than 2.2 rad on the way (a slalom through a rock field), is not gone to: it settles where it
 * is (what it meant to do, there; its next goal is another). Long ways keep their detours (to
 * water, to its roost, round a lake): only short ones are checked.
 */
function walkable(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, placed: Intent, before: Spot | null): boolean {
    const to = placed.to;
    // (Off from a predator it has seen it goes by a plain way, or watches it from where it is: `workIntent`.)
    if (!to || placed.follow || !walksGoals(profile)) return true;
    // (A sitter goes to its eggs, the props lane's nest, whatever the way: it never sits beside it. On the merged scenery
    // a boulder by the test's nest made the way a detour, and the duck settled at home: L7, 2026-11-12.)
    if (placed.recipe === "incubate_sit") return true;
    // (Collisions.) A climb up: it walks to the climb's foot first, so that walk is checked as any other: a foot it can
    // reach, by no long way round (2026-11-12: a komodo walked 91 m round to a rock's far side, at 1.6 times its pace).
    // Not a climb home to its roost (going home to sleep may wind, as below: the chains of goals agree on its roost).
    const from0 = before ?? groundSpot(world, animal.home.x, animal.home.z);
    const homeward = placed.doing === "sleep" || placed.doing === "to_roost";
    if (!homeward && placed.mode !== "stay" && !standsAt(world, profile, animal, placed)) return false;
    if (world.nav.colliders && !homeward && !flies(profile) && raised(world, to) && !raised(world, from0)) {
        const foot = climbFoot(world, profile, animal, to);
        if (!foot) return false;
        return walkable(world, profile, animal, {...placed, to: foot, mode: wet(world, foot) ? "water" : "ground"}, from0);
    }
    // A stay (asleep at its roost, a night watch) is where it already is: after a way there it did not take (a roost out
    // of reach), it stays where that left it, never a jump to the roost (decision 202: at its natural pace an alligator's
    // roost moved out of reach, and it jumped 21 m from where it had stayed into its sleep).
    if (placed.mode === "stay") return !before || Math.hypot(before.x - to.x, before.z - to.z) < Math.max(animal.length * 2, 1.5);
    if (placed.mode !== "ground" && placed.mode !== "water") return true;
    // (Going home to sleep may wind: only a roost it cannot reach at all is not gone to.)
    const home = placed.doing === "sleep" || placed.doing === "to_roost";
    let from = before ?? groundSpot(world, animal.home.x, animal.home.z);
    let goal = to;
    if (raised(world, from) || raised(world, to)) return true;
    const fromWet = wet(world, from);
    const toWet = wet(world, to);
    // (Lane MA3: a bird that walks or swims first keeps off the roads the cars drive, the town's: no walk or swim of its
    // ends on one, a duck under the Harbour Road bridge; it does what it came to do where it is. The walk-first rule had
    // the town's pigeons walk their forage out across the high street among the moving cars: the town-cars check.)
    if (flies(profile) && !home && world.sampler.roadway?.(to.x, to.z)) return false;
    if (fromWet && toWet) return true;
    if (fromWet !== toWet) {
        // Out of the water or into it (a seal, a polar bear): the walk is the part on land, from or to the edge it
        // crosses at, as its trip takes it (the home-growth lane's polar bear climbed out at a cliff's foot and walked
        // straight up it to a goal on top).
        if (!amphibious(profile)) return true;
        const edge = waterEdgeNear(world, profile, animal, toWet ? from : to) ?? waterEdgeNear(world, profile, animal, toWet ? to : from);
        if (!edge) return true;
        if (toWet) goal = edge;
        else from = edge;
    }
    // (Lane MA3: nor does it walk across one on the way, a pigeon foraging, a duck out to its bank: the land part.)
    if (flies(profile) && !home && walksOntoRoad(world, from, goal)) return false;
    // A prey animal going off from a predator it watches (the shared wariness) goes, unless its way there would turn it
    // a full circle (the default view's zebra, 47 turns a minute on 3 m): then it watches from where it is.
    const retreat = placed.face !== undefined;
    // Never off its own stretch of ground (pure in the goal: so wherever it is, it can walk to any goal it takes). A
    // retreat too, where the colliders are known: off its ground its way would end straight through a fence (2026-11-12,
    // an elephant watching a predator walked through a paddock's rails); it watches from where it is.
    if ((!retreat || world.nav.colliders) && !onItsGround(world, profile, animal, placed)) return false;
    const straight = Math.hypot(goal.x - from.x, goal.z - from.z);
    if (straight < 0.5 || straight > 25 || home) return true;
    // (The search its trip makes: `tripFor`'s ground.)
    const path = world.nav.path(from, goal, "walk", 0.5, 900, maxSlopeOf(animal), bodyRadiusOf(animal, profile.slug), onSurface(goal.point));
    const end = path[path.length - 1];
    const reached = Math.hypot(end.x - goal.x, end.z - goal.z) < 0.01;
    if (!reached) return retreat;
    // Its turns on the way (the corners' headings, summed): a slalom through a rock field turns it round as surely as a
    // loop does.
    const turnsOn = (least: number) => {
        let turning = 0;
        let heading: number | null = null;
        for (let k = 1; k < path.length; k++) {
            if (Math.hypot(path[k].x - path[k - 1].x, path[k].z - path[k - 1].z) < least) continue;
            const h = Math.atan2(path[k].x - path[k - 1].x, path[k].z - path[k - 1].z);
            if (heading !== null) turning += Math.abs(Math.atan2(Math.sin(h - heading), Math.cos(h - heading)));
            heading = h;
        }
        return turning;
    };
    if (retreat) return turnsOn(0.05) < Math.PI * 2;
    return pathLength(path) <= straight * 1.3 + 2 && turnsOn(0.3) <= 2.2;
}

/**
 * Whether a walk from `from` to `to` goes onto a road's carriageway (`ArkWorldSampler.roadway`, the town's): its goal on
 * one, or its way stepping onto one once it is off the one it starts on (one that landed on a road walks off it). Its
 * straight way, every half metre. False where the world has no roads.
 */
function walksOntoRoad(world: ScheduleWorld, from: {x: number; z: number}, to: {x: number; z: number}): boolean {
    const roadway = world.sampler.roadway;
    if (!roadway) return false;
    if (roadway(to.x, to.z)) return true;
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.5);
    let off = !roadway(from.x, from.z);
    for (let k = 1; k < steps; k++) {
        const on = roadway(from.x + ((to.x - from.x) * k) / steps, from.z + ((to.z - from.z) * k) / steps);
        if (on && off) return true;
        if (!on) off = true;
    }
    return false;
}

/** Whether it walks to its goals (a flyer flies there; a swimmer that never leaves the water swims). */
function walksGoals(profile: ArkBehaviourProfile): boolean {
    return profile.move !== "fly" && !profile.seabed && (profile.move !== "swim" || amphibious(profile));
}

/**
 * Whether a goal is on its own stretch of walkable ground (`NavGrid.region`): the one its home is on (or, one that lives
 * in the water, the ground nearest its home). On foot it goes only there; a dry goal anywhere else (over a cliff, up
 * a mountain lake's ledge) is not gone to, nor one whose nearest edge (where it would climb out) is elsewhere. A goal
 * in the water it swims to.
 */
function onItsGround(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, placed: Intent): boolean {
    const to = placed.to;
    if (!to || placed.follow || placed.face !== undefined || raised(world, to)) return true;
    const walker = profile.move !== "fly" && !profile.seabed && (profile.move !== "swim" || amphibious(profile));
    if (!walker || (placed.mode !== "ground" && placed.mode !== "water")) return true;
    const slope = maxSlopeOf(animal);
    // (Its stretch of ground for its body: cells joined only by steps it fits through: collisions.)
    const r = bodyRadiusOf(animal, profile.slug);
    const homeSpot = groundSpot(world, animal.home.x, animal.home.z);
    let mine = wet(world, homeSpot) ? -1 : world.nav.region(homeSpot.x, homeSpot.z, slope, r);
    if (mine < 0) {
        // (A home in the water, the sea ice say, or on a blocked cell: the ground nearest it, up to 80 m off.)
        const land = world.nav.nearest(homeSpot.x, homeSpot.z, "walk", 0.5, 40, slope, r);
        if (land) mine = world.nav.region(land.x, land.z, slope, r);
    }
    // (A goal in the water it swims to, wherever it is.)
    if (mine < 0 || wet(world, to)) return true;
    if (world.nav.region(to.x, to.z, slope, r) !== mine) return false;
    // (And its path can end there: a cell round the goal its body fits in, by a clear run.)
    if (!world.nav.attachable(to.x, to.z, r, slope, onSurface(to.point))) return false;
    if (!amphibious(profile)) return true;
    // Out of the water onto it, it climbs out at the edge nearest it: that edge on its ground too.
    const edge = waterEdgeNear(world, profile, animal, to);
    return !edge || world.nav.region(edge.x, edge.z, slope, r) === mine;
}

/** In the water and under its surface: where a water-only animal may be sent. */
const underSurface = (world: ScheduleWorld, spot: Spot) => wet(world, spot) && spot.y < surfaceY(world, spot.x, spot.z) + 0.02;

/**
 * A water-only animal (a fish, a seabed walker: `aquatic`, not `amphibious`) is never sent onto land, nor onto a rock
 * above the surface (release integration, 2026-11-11: a reef fish slept on a shore rock, a pacu in a tree, from their
 * roost and rest tags). The scene draws it in its sea-depth band only while it is in the water. Such a goal goes to the
 * water nearest it instead (seeded by the goal, so the same goal always gives the same spot), else by its home.
 */
function keepInWater(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, planned: Intent): Intent {
    const to = planned.to;
    if (!to || !aquatic(profile) || amphibious(profile) || underSurface(world, to)) return planned;
    const random = rng(hashString(`${animal.id}#water#${Math.round(to.x * 2)}#${Math.round(to.z * 2)}`));
    const near = waterSpot(world, profile, animal, to.x, to.z, random);
    const spot = underSurface(world, near) ? near : waterSpot(world, profile, animal, animal.home.x, animal.home.z, random);
    return {...planned, to: spot, mode: planned.mode === "stay" ? "stay" : "water"};
}

function plannedIntent(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Intent {
    // A sitter with eggs in its nest (the props lane's nests: `behaviour-recipes.ts` sitterIntent) sits on it, awake or asleep.
    const start = slotStart(animal, slot);
    const sitting = sitterIntent({world, profile, animal, start, awake: awakeAt(profile, activity, hoursAt(start)), kit: KIT});
    if (sitting) return {doing: sitting.doing as ArkDoing, to: sitting.to, mode: sitting.mode, stay: [], recipe: sitting.recipe};
    const raw = rawIntent(world, profile, animal, activity, slot, hoursAt);
    // (Decision 202: a goal on foot further than it can walk in a slot, at the most its pace cap allows, isn't taken: a
    // goat's drink round its paddock's fence, a komodo's far basking rock. It goes about its home ground instead.)
    // (Its roost is never out of reach: `roostOf`.)
    const sleepy = raw.doing === "sleep" || raw.doing === "to_roost" || raw.doing === "watch";
    if (raw.to && !raw.follow && !sleepy && (raw.mode === "ground" || raw.mode === "surface") && tooFarOnFoot(world, profile, animal, raw.to)) {
        const centre = groupCentre(world, animal, slot, hoursAt) ?? animal.home;
        const random = rng(hashString(`${animal.id}#near#${slot}`));
        const near = rangeSpot(world, profile, animal, centre, Math.min(homeRadius(profile, animal), 2), random);
        // (Anything tied to its place, a drink, a bask, it can't do here: it wanders its home ground.)
        return {doing: "wander", to: near, mode: "ground", stay: stayBeats("wander", random, null)};
    }
    if (raw.to || raw.follow) return raw;
    for (let back = 1; back <= 4; back++) {
        const earlier = rawIntent(world, profile, animal, activity, slot - back, hoursAt);
        if (earlier.to || earlier.follow) return raw;
    }
    const centre = groupCentre(world, animal, slot, hoursAt) ?? animal.home;
    const home = rangeSpot(world, profile, animal, centre, Math.min(homeRadius(profile, animal), 2), rng(hashString(`${animal.id}#home#${slot}`)));
    return {doing: STAY_DOINGS.has(raw.doing) && raw.doing !== "sleep" ? "wander" : raw.doing, to: home, mode: aquatic(profile) ? "water" : profile.move === "fly" ? "air" : "ground", stay: raw.stay};
}

/**
 * Whether a goal on foot is further than it can walk in a slot (decision 202): its way from its home ground, at the
 * fastest its feet allow (1.2 of its walk's pace, or its run's when it runs), in all of the slot but 6 s, with room for
 * starting anywhere in its home range. Straight-line first; a way round (a fence, a lake) only when it is close.
 */
function tooFarOnFoot(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, to: Spot): boolean {
    if (profile.move === "fly" || profile.move === "swim") return false;
    const pace = bodyLengthsPerSecond(profile) * Math.max(animal.length, 0.05);
    const most = 1.2 * pace * Math.max(runFactor(profile), 1) * (SLOT_SECONDS - 6) - homeRadius(profile, animal);
    const straight = Math.hypot(to.x - animal.home.x, to.z - animal.home.z);
    if (straight > most) return true;
    if (straight < most / 1.6) return false;
    const path = world.nav.path(groundSpot(world, animal.home.x, animal.home.z), to, "walk", 0.5, 900, maxSlopeOf(animal), bodyRadiusOf(animal, profile.slug), onSurface(to.point));
    const end = path[path.length - 1];
    if (!end || Math.hypot(end.x - to.x, end.z - to.z) > 0.5) return false;
    return pathLength(path) > most;
}

function rawIntent(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Intent {
    return remember(memoOf(world, hoursAt, animal).raw, slot, () => workRawIntent(world, profile, animal, activity, slot, hoursAt));
}

function workRawIntent(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Intent {
    const start = slotStart(animal, slot);
    const hours = hoursAt(start);
    const awake = awakeAt(profile, activity, hours);
    const wasAwake = awakeAt(profile, activity, hoursAt(start - SLOT_SECONDS));
    const flyer = flies(profile);
    const random = rng(hashString(`${animal.id}#${slot}`));
    const group = animal.group;
    if (profile.move === "sessile") return {doing: awake ? "idle" : "sleep", to: {...animal.home, nx: 0, ny: 1, nz: 0, point: null}, mode: "stay", stay: []};

    // A group's watch: one member at a time (in turn, seeded by the group) keeps watch while the others do their own things,
    // by day and (for herds and troops) through the night.
    const size = group ? group.size : 0;
    const watchTurn = size >= 3 ? (slot + hashString(group!.leader.id)) % size === group!.rank : false;
    if (!awake) {
        const roost = roostOf(world, profile, animal);
        // The night watch (sleep lane): always one of the members (never the leader's turn with nobody up), standing about
        // five minutes at a time on the shared clock (each member's slots are offset, so the turn is read at the middle of
        // its slot from one window for the whole group), so the herd is never all asleep and the guard changes now and then.
        const watchWindow = Math.floor((start + SLOT_SECONDS / 2) / (SLOT_SECONDS * NIGHT_WATCH_SLOTS));
        const nightWatch = size >= 3 ? ((watchWindow + hashString(group!.leader.id)) % (size - 1)) + 1 === group!.rank : false;
        if (nightWatch && !FLOCKING.has(profile.social) && !wasAwake) return {doing: "watch", to: roost, mode: "stay", stay: stayBeats("watch", random, null)};
        const travel: TripMode = aquatic(profile) ? "water" : flyer && raised(world, roost) ? "air" : profile.surface && roost.ny < 0.7 ? "surface" : "ground";
        return {doing: wasAwake ? "to_roost" : "sleep", to: roost, mode: wasAwake ? travel : "stay", stay: []};
    }
    // Air-breathers come up to breathe every few slots, then go back down.
    if (profile.breathes && profile.move === "swim" && (slot + hashString(animal.id)) % 3 === 0) {
        // (About a breath's swim away at its own pace, any way round: at true size a 14 m humpback reached a breath ±4 m
        // away in a second and floated through it. Motion pass §3.)
        // (2026-11-12, motion pass: a breath's swim and its set-off, about 16 s, so the 15 s breath is taken on the move,
        // and out in open water: a penguin on the polar shelf was sent to a "swim" cell it could walk to over the ice,
        // and came up for air standing on it; another to the cell it was in. The first of eight bearings round from its
        // own that gives open water at least most of the way out.)
        const pace = freeBodyLengthsPerSecond(profile) * swimPaceLength(animal.length);
        const bearing = random() * Math.PI * 2;
        const away = Math.max(4, pace * 16 * (0.9 + 0.3 * random()));
        // (And one its body can swim to from its home water: at true size a 1.15 m emperor penguin no longer fitted the
        // polar cove's narrow leads, its swim path stopped short, and the trip turned into a walk over the shelf.)
        const bodyR = bodyRadiusOf(animal, profile.slug);
        const homeWater = world.nav.nearest(animal.home.x, animal.home.z, "swim", 0.3);
        const swimsTo = (cell: NavPoint) => {
            if (!homeWater) return true;
            const path = world.nav.path(homeWater, cell, "swim", 0.3, 600, MAX_SLOPE, bodyR);
            const end = path[path.length - 1];
            return Boolean(end) && Math.hypot(end.x - cell.x, end.z - cell.z) < 0.01;
        };
        let near: NavPoint | null = null;
        let fallback: NavPoint | null = null;
        for (let k = 0; k < 8 && !near; k++) {
            const b = bearing + (k * Math.PI) / 4;
            const cell = world.nav.nearest(animal.home.x + Math.cos(b) * away, animal.home.z + Math.sin(b) * away, "swim", 0.6);
            if (!cell) continue;
            fallback ??= cell;
            if (!world.nav.walkable(cell.x, cell.z) && Math.hypot(cell.x - animal.home.x, cell.z - animal.home.z) >= 0.6 * away && swimsTo(cell)) near = cell;
        }
        const spot = near ?? fallback ?? animal.home;
        return {doing: "breathe", to: {x: spot.x, y: surfaceAt(spot.x, spot.z), z: spot.z, nx: 0, ny: 1, nz: 0, point: null}, mode: "water", stay: []};
    }
    const personality = animalPersonality(animal.id);
    const centre = groupCentre(world, animal, slot, hoursAt) ?? animal.home;
    // A group member keeps within its group's spread of its leader (both capped where predator and prey were kept apart).
    const radius = group ? Math.min(homeRadius(profile, animal), groupSpread(animal.length, size), (group.leader.range ?? Infinity) / 2) : homeRadius(profile, animal);
    const groupAnimal: ScheduleAnimal = group ? {...animal, home: {x: centre.x, y: animal.home.y, z: centre.z}} : animal;
    // Its own side of the group (a member's goals are looked for close round a point on its own bearing from the
    // leader's place, not anywhere round the place itself): four members picking spots at random round one point stood
    // in an even row once in about 650 moments (the capybaras' and lions' rows); round their own sides, a third of the
    // spread across, about once in 200,000.
    const own = group ? memberSide(centre, animal, group.rank, radius) : centre;
    // Shared wariness (visual only; flee-envelope.md §6.3.3): a predator it can see at its slot's start, awake, from the
    // predator's own schedule (the same for every viewer), sends it to the far side of its range to watch it. Near the
    // camera the local layer (`reactive.ts`) adds the look, the alarm and any dash on top. (Its own seeded stream: an
    // animal with no predator in sight chooses exactly as before.)
    const threat = threatAt(world, profile, animal, start, hoursAt, centre, radius);
    if (threat) {
        const wary = rng(hashString(`${animal.id}#wary#${slot}`));
        const away = {x: centre.x + ((centre.x - threat.x) / threat.d) * radius * 0.7, z: centre.z + ((centre.z - threat.z) / threat.d) * radius * 0.7};
        // (A member a little to its own side of the line off the predator: not all of a group's watchers on that line.)
        const spot = rangeSpot(world, profile, groupAnimal, group ? memberSide(away, animal, group.rank, radius * 0.6) : away, Math.max(radius * 0.25, 0.5), wary);
        return {doing: "watch", to: spot, mode: aquatic(profile) ? "water" : profile.move === "fly" ? "air" : "ground", stay: stayBeats("watch", wary, null), face: Math.atan2(threat.x - spot.x, threat.z - spot.z)};
    }
    if (watchTurn) {
        // At the group's edge, facing out.
        const spot = rangeSpot(world, profile, groupAnimal, own, radius * (group ? 0.3 : 0.9), random);
        return {doing: "watch", to: spot, mode: aquatic(profile) ? "water" : "ground", stay: stayBeats("watch", random, null)};
    }
    // A flocking species' member flies with its leader when its leader is in the air (most of the time, not always).
    // A school keeps together nearly always (a loose cluster round its leader).
    if (group && FLOCKING.has(profile.social) && (flyer || aquatic(profile)) && random() < (aquatic(profile) ? 0.9 : 0.75)) {
        const lead = leaderIntentAt(world, group, start + 1, hoursAt);
        // Its place is by its leader; what it does there is its own (a school's fish feed or cruise, a flock's birds fly),
        // so a school is one shape but not one state (problem 7).
        if ((lead.mode === "air" || (aquatic(profile) && lead.mode === "water")) && lead.to) {
            const own: ArkDoing = lead.mode === "air" ? "fly" : random() < 0.45 ? "forage" : "swim";
            return {doing: own, to: null, mode: lead.mode, stay: [], follow: true};
        }
    }
    // Young play near their group.
    if (animal.young && group && random() < 0.45) {
        return {doing: "play", to: rangeSpot(world, profile, groupAnimal, own, Math.max(radius * (group ? 0.3 : 0.5), 1), random), mode: aquatic(profile) ? "water" : "ground", stay: stayBeats("play", random, null)};
    }
    // Its own choice; a group member is a little less likely to do just what its leader does now.
    const leaderDoing = group ? leaderIntentAt(world, group, start + 1, hoursAt).doing : null;
    let behaviour = pick(profile, animal.id, hours, random(), personality.boldness, personality.curiosity, leaderDoing as ArkBehaviour | null);
    // A browser's grazing is at bushes and trees.
    let doing: ArkDoing = behaviour as ArkDoing;
    if ((behaviour === "graze" || behaviour === "forage") && (profile.diet === "browser" || profile.diet === "fruit") && walks(profile) && !flyer) doing = "browse";
    else if (behaviour === "graze" || (behaviour === "forage" && profile.diet === "grazer")) doing = "graze";
    // A recipe from its stored behaviours may take this slot (a perch by the water to fish from, its nest, bare ground).
    const planned = recipeIntent({world, profile, animal, slug: profile.slug, slot, start, hours, behaviour, doing, centre, radius, kit: KIT});
    // (Lane MA3: one that walks or swims first takes a recipe up by air, a nest in a tree, only as often as it flies.)
    if (planned && !(planned.mode === "air" && !airAllowed(profile, animal, slot))) return {doing: planned.doing as ArkDoing, to: planned.to, mode: planned.mode, stay: [], recipe: planned.recipe};
    // A wading bird (a heron, an egret, a stork, an ibis) stands in the shallows to fish and to rest, its legs in the
    // water (lane MA3: the audit's herons were never in the water but for a minute's spear). Its own seeded stream.
    if (profile.water === "wader" && WADING.has(behaviour) && rng(hashString(`${animal.id}#wade#${slot}`))() < WADE_SHARE) {
        const shallows = shallowsNear(world, animal, centre, Math.min(Math.max(radius * 1.6, 8), 40), slot);
        if (shallows) {
            const wadeRandom = rng(hashString(`${animal.id}#wade-beats#${slot}`));
            const far = Math.hypot(shallows.x - centre.x, shallows.z - centre.z) > Math.max(3, animal.length * 6);
            return {doing: behaviour === "wander" ? "forage" : (behaviour as ArkDoing), to: shallows, mode: flyer && far ? "air" : "ground", stay: stayBeats(behaviour === "forage" || behaviour === "wander" ? "watch" : "rest", wadeRandom, null)};
        }
    }
    if (behaviour === "stalk" && !animal.prey) behaviour = "wander";
    if (behaviour === "stalk") {
        // Towards the edge of its own range on its prey's side, slowly, with pauses; never past its range.
        const dx = animal.prey!.x - animal.home.x;
        const dz = animal.prey!.z - animal.home.z;
        const d = Math.hypot(dx, dz) || 1;
        const reach = homeRadius(profile, animal) * (0.6 + 0.3 * random());
        const at = world.nav.nearest(animal.home.x + (dx / d) * reach, animal.home.z + (dz / d) * reach, "walk", 0.5, 6, maxSlopeOf(animal));
        if (at) return {doing: "stalk", to: groundSpot(world, at.x, at.z), mode: "ground", stay: stayBeats("stalk", random, null)};
        behaviour = "wander";
    }
    const placeKinds = doing === "browse" ? (["shade", "perch_branch"] as ArkInteraction[]) : BEHAVIOUR_PLACES[behaviour];
    if (placeKinds) {
        for (const place of placeKinds) {
            // Anyone may rest in the shade; every other place is the animal's own (a seal's shore, a lizard's rock).
            if (!profile.interactions.includes(place) && !(behaviour === "rest" && place === "shade") && doing !== "browse") continue;
            const tags = INTERACTION_TAGS[place] ?? [];
            const far = place === "drink_edge" || place === "porch_light";
            const cap = Math.min(animal.range ?? Infinity, group ? (group.leader.range ?? Infinity) / 2 : Infinity);
            // Water and lights may be a little beyond its usual ground: never more than half again its range (`rangeReach`).
            // (Lane MA3: a duck, a goose or a swan out on its water looks for its bank to rest on up to 20 m off, a slot's
            // swim at a duck's 0.3 m/s: a flock's member searched only its small share of the flock's spread, and its swim
            // reach is its walk clip's, and it never came ashore.)
            const bank = place === "shore" && aquatic(profile) && amphibious(profile) ? 20 : 0;
            const point = placeNear(world, far ? centre : own, animal.length, tags, Math.min(Math.max(far ? Math.min(45, reachOf(profile, animal) / 2, homeRadius(profile, animal) * 1.5) : radius * (group ? 0.5 : 1.4), bank), cap), random());
            if (point) {
                const up = point.y > topAt(world, point.x, point.z) + 0.5;
                // (Lane MA3: a bird that walks or swims first flies up to a perch, a branch, a ledge only as often as it flies:
                // otherwise it does what it came to do on the ground, the next of its places.)
                if (up && flyer && !airAllowed(profile, animal, slot)) continue;
                // A patch of ground (grass, shade, the water's edge, the litter, a cliff's ledge): each animal stands its own
                // place in it, so a herd spreads over the grass and a colony over its ledges instead of stacking on one
                // point or standing in the ledges' even row.
                const spread = point.tag === "grass" ? 3.2 : point.tag === "shade" || point.tag === "leaf_litter" ? 1.4 : point.tag === "cliff_ledge" ? 1.8 : point.tag === "rock_top" ? 1 : point.tag === "water_edge" ? 0.9 : 0;
                if (spread && !up) {
                    const a = random() * Math.PI * 2;
                    const r = spread * (0.25 + 0.75 * Math.sqrt(random())) * Math.max(Math.min(animal.length, 2), 0.3);
                    const x = point.x + Math.cos(a) * r;
                    const z = point.z + Math.sin(a) * r;
                    // (A bird flies to its spot on a ledge: dry ground is enough, it need not be walkable.)
                    const stands = flyer && (point.tag === "cliff_ledge" || point.tag === "rock_top") ? world.sampler.heightAt(x, z) > surfaceY(world, x, z) + 0.05 : world.nav.walkable(x, z, maxSlopeOf(animal));
                    if (stands && (point.tag !== "water_edge" || world.sampler.heightAt(x, z) > surfaceY(world, x, z) + 0.02)) {
                        return {doing, to: {...groundSpot(world, x, z), point: point.id}, mode: aquatic(profile) ? "water" : profile.surface && point.ny < 0.7 ? "surface" : flyer && (doing === "visit_flowers" || doing === "circle_light") ? "air" : "ground", stay: stayBeats(doing, random, null)};
                    }
                }
                const mode: TripMode = profile.surface && point.ny < 0.7 ? "surface" : flyer && (up || doing === "visit_flowers" || doing === "circle_light") ? "air" : aquatic(profile) ? "water" : "ground";
                return {doing, to: spotOf(point), mode, stay: stayBeats(doing, random, null)};
            }
        }
    }
    switch (behaviour) {
        case "fly":
        case "soar": {
            // A goal: a perch, a feeding spot on the ground, or (a floater) the water.
            const roll = random();
            // A waterbird's flights go from water to water (lane MA3: a coot or a swan never flies off its lake to a
            // tree or a field; it swims to the bank and walks out). Further across its water than its swims go.
            if (aquatic(profile) && flies(profile)) {
                const water = waterSpot(world, profile, animal, centre.x + (random() - 0.5) * radius * 2.4, centre.z + (random() - 0.5) * radius * 2.4, random);
                return {doing: behaviour, to: water, mode: "air", stay: stayBeats("rest", random, null)};
            }
            // (Lane MA3: one that walks first flies across its ground and comes down on it, never up to a perch: else it
            // would fly twice, up and down again.)
            const perch = roll < 0.5 && profile.move === "fly" ? placeNear(world, own, animal.length, perchTags(profile), radius * (group ? 0.5 : 1), random()) : null;
            if (perch) return {doing: behaviour, to: spotOf(perch), mode: "air", stay: stayBeats("perch", random, null)};
            if (roll > 0.88 && floats(profile)) return {doing: behaviour, to: waterSpot(world, profile, animal, centre.x + (random() - 0.5) * radius, centre.z + (random() - 0.5) * radius, random), mode: "air", stay: stayBeats("rest", random, null)};
            return {doing: behaviour, to: rangeSpot(world, {...profile, move: "walk", seabed: false}, groupAnimal, own, radius * (group ? 0.3 : 1), random), mode: "air", stay: stayBeats("forage", random, null)};
        }
        case "swim":
        case "dive":
            if (swims(profile)) {
                const water = waterSpot(world, profile, animal, centre.x + (random() - 0.5) * radius * 2, centre.z + (random() - 0.5) * radius * 2, random);
                return {doing: profile.move === "swim" ? "swim" : behaviour, to: water, mode: "water", stay: stayBeats("rest", random, null)};
            }
            return {doing: "rest", to: null, mode: "stay", stay: stayBeats("rest", random, null)};
        case "wander":
        case "forage":
        case "graze":
            return {
                // (A swimmer feeding is foraging, cruising is swimming: its states stay its own, not all "swim".)
                doing: profile.move === "swim" ? (behaviour === "wander" ? "swim" : doing) : behaviour === "wander" && profile.surface ? "crawl" : doing,
                // (Lane MA3: one that walks first keeps its wanders within a walk, never a flight across its range.)
                to: rangeSpot(world, profile, groupAnimal, own, flyer && profile.move === "walk" ? Math.min(radius * (group ? 0.3 : 1), walkReach(profile, animal) * 0.8) : radius * (group ? 0.3 : 1), random),
                mode: aquatic(profile) ? "water" : flyer && profile.move === "fly" ? "air" : profile.surface ? "surface" : "ground",
                stay: stayBeats(doing, random, null)
            };
        default: {
            const stayDoing: ArkDoing = STAY_DOINGS.has(doing) ? doing : "rest";
            // A group member that rests keeps near its group (it walks to it first if it has drifted away).
            if (group) return {doing: stayDoing, to: rangeSpot(world, profile, groupAnimal, centre, radius * 0.6, random), mode: aquatic(profile) ? "water" : "ground", stay: stayBeats(stayDoing, random, null)};
            // A den, burrow, cave, hole or crevice animal mostly rests in it, out of sight (`restingAtRoost`: the runtime's
            // rotation hides the ones resting at home, so one out of sight is plausibly there). Its own seeded stream.
            if (stayDoing === "rest" && ENCLOSED_ROOSTS.has(profile.roost) && rng(hashString(`${animal.id}#den#${slot}`))() < 0.6) {
                const roost = roostOf(world, profile, animal);
                const travel: TripMode = aquatic(profile) ? "water" : flyer && raised(world, roost) ? "air" : profile.surface && roost.ny < 0.7 ? "surface" : "ground";
                return {doing: "rest", to: roost, mode: travel, stay: stayBeats("rest", random, null)};
            }
            return {doing: stayDoing, to: null, mode: "stay", stay: stayBeats(stayDoing, random, null)};
        }
    }
}

const CRUISE: Record<"low" | "mid" | "high", number> = {low: 1.6, mid: 6, high: 14};

/** Its stay's beats placed in the world from where it arrives (steps and play move it; turns turn it). */
function placeStay(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, at: Spot, yaw0: number, beats: Intent["stay"], seconds: number): {beats: StayBeat[]; finish: Spot} {
    const out: StayBeat[] = [];
    let x = at.x;
    let z = at.z;
    let yaw = yaw0;
    const onGround = !raised(world, at) && !wet(world, at);
    for (const beat of beats) {
        if (beat.at > seconds) break;
        // A scan is a look round with the head (its clip and the look chain: `head-look.ts`); the body stays as it stands.
        // (2026-11-11: the body's small glance with each scan, and the arrival turn, added up to over a turn a minute in
        // a grey heron's watch.)
        const glance = 0;
        if (beat.beat !== "scan") yaw += beat.turn ?? 0;
        let dur: number | undefined;
        if ((beat.dx || beat.dz) && onGround) {
            const l = Math.max(animal.length, 0.05);
            // Never further than its walk's pace covers in the step's time: a slow walker takes small steps.
            const stepTime = beat.beat === "play" ? 0.8 : beat.beat === "stalk" ? 2.5 : 1.2;
            const most = (bodyLengthsPerSecond(profile) * stepTime) / Math.max(Math.hypot(beat.dx ?? 0, beat.dz ?? 0), 1e-6);
            const k = Math.min(most, 1);
            const nx = x + (Math.sin(yaw) * (beat.dx ?? 0) + Math.cos(yaw) * (beat.dz ?? 0)) * l * k;
            const nz = z + (Math.cos(yaw) * (beat.dx ?? 0) - Math.sin(yaw) * (beat.dz ?? 0)) * l * k;
            // Only onto ground it can walk, and never out of its range (a stalker stops at the edge).
            const within = Math.hypot(nx - animal.home.x, nz - animal.home.z) <= Math.max(homeRadius(profile, animal) * 1.6, 2);
            // (And the step itself clear of everything solid for its body, and where it ends: collisions.)
            const r = bodyRadiusOf(animal, profile.slug);
            if (world.nav.fits(nx, nz, bodyReachOf(animal, profile.slug), maxSlopeOf(animal)) && within && world.nav.runClear({x, z}, {x: nx, z: nz}, r)) {
                // A step (a stalk is a creep, slow by intent) takes as long as its walk's own pace says, not a fixed
                // 1.2 s: a grazer's step at a fifth of its clip's pace played the walk in slow motion.
                if (beat.beat !== "stalk" && beat.beat !== "play") dur = Math.min(Math.max(Math.hypot(nx - x, nz - z) / (bodyLengthsPerSecond(profile) * l), 0.1), stepTime);
                x = nx;
                z = nz;
            }
        }
        out.push(dur === undefined ? {at: beat.at, beat: beat.beat, x, z, yaw: yaw + glance} : {at: beat.at, beat: beat.beat, x, z, yaw: yaw + glance, dur});
    }
    const y = onGround ? topAt(world, x, z) + (at.y - topAt(world, at.x, at.z)) : at.y;
    return {beats: out, finish: {...at, x, y: onGround ? y : at.y, z, yaw}};
}

/** A flock member's place beside its leader this slot, and its leader's trips over the slot. */
function shadowOf(world: ScheduleWorld, animal: ScheduleAnimal, slot: number, hoursAt: HoursAt): {trips: Trip[]; dx: number; dy: number; dz: number; finish: Spot} {
    const group = animal.group!;
    const start = slotStart(animal, slot);
    const end = start + SLOT_SECONDS;
    const random = rng(hashString(`${animal.id}#flock#${slot}`));
    const first = tripAt(world, group.profile, group.leader, start, hoursAt, group.activity);
    const trips = [first];
    if (first.end < end) trips.push(tripAt(world, group.profile, group.leader, first.end, hoursAt, group.activity, first));
    // A loose cluster, never a row: some ahead, some behind, above or below, each its own distance.
    const at = basePoseOnTrip(world, trips[trips.length - 1], end);
    let dx = 0;
    let dz = 0;
    const dy = (random() - 0.5) * Math.max(animal.length, 0.3) * (aquatic(group.profile) ? 2.4 : 1.6);
    const spread = Math.max(animal.length, 0.3) * (1 + 0.35 * Math.sqrt(group.rank));
    // (On the ground, a place by its leader it can stand at the slot's end: else it slid to the nearest open cell over
    // the slot's last seconds, sideways or backwards, the default view's sparrow. A few seeded tries, then that.)
    // (On its own bearing from its leader, as a herd member's own side (`memberSide`), each slot a little off it, wider
    // a try at a time: a school's members at random bearings stood in an even row now and then, like the herds.)
    const bearing = group.rank * 2.399963 + ((hashString(`${animal.id}#side`) % 1000) / 1000 - 0.5) * 0.5;
    for (let attempt = 0; attempt < 6; attempt++) {
        const a = bearing + (random() - 0.5) * (0.7 + attempt * 0.6);
        const d = (0.8 + random() * 2.2) * spread;
        dx = Math.cos(a) * d;
        dz = Math.sin(a) * d;
        if (at.aloft || at.y < surfaceY(world, at.x, at.z) || world.nav.walkable(at.x + dx, at.z + dz)) break;
    }
    const fx = at.x + dx;
    const fz = at.z + dz;
    let finish: Spot;
    if (at.aloft) finish = {x: fx, y: at.y + dy, z: fz, nx: 0, ny: 1, nz: 0, point: null};
    else if (at.y < surfaceY(world, at.x, at.z) || wet(world, {x: fx, z: fz})) {
        const top = surfaceY(world, fx, fz);
        finish = {x: fx, y: Math.min(Math.max(at.y + dy, world.sampler.heightAt(fx, fz) + 0.2), at.y >= surfaceY(world, at.x, at.z) - 0.01 ? top : top - 0.15), z: fz, nx: 0, ny: 1, nz: 0, point: null};
    }
    else {
        const landed = world.nav.nearest(fx, fz, "walk", 0.5, 4) ?? {x: fx, z: fz};
        finish = groundSpot(world, landed.x, landed.z);
    }
    return {trips, dx, dy, dz, finish};
}

/**
 * Its time at its destination, placed in the world: the beats from where it arrives, turned to a seeded heading
 * (so where it ends never depends on the way it came), and where it is when they are done.
 */
function settle(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, slot: number, now: Intent, activity: ArkBehaviourProfile["activity"] | null | undefined, hoursAt: HoursAt): {beats: StayBeat[]; finish: Spot} | null {
    if (!now.to) return null;
    // It arrives facing the way it came: from its last goal to this one (within about 10 degrees, seeded), so it doesn't
    // turn round on arriving. (Its last goal, not where its last slot ended, which would chain back through every slot;
    // with no goal in the last six slots, roughly its way out from home. Where its route came in some other way, a
    // landing after a wide soar say, it keeps the way it came in and turns to this at TURN_RATE: poseOnTrip.)
    return placeStay(world, profile, animal, now.to, arrivalYaw(animal, slot, now, lastGoal(world, profile, animal, activity, slot, hoursAt)), now.stay, Infinity);
}

/** The heading it settles to at a goal: from the goal before (within about 10 degrees, seeded), else from home. */
function arrivalYaw(animal: ScheduleAnimal, slot: number, now: Intent, before: Spot | null): number {
    const to = now.to!;
    // (Still where its last goal was, asleep at its roost slot after slot: the same heading as long as it stays, seeded by
    // the place, not the slot. 2026-11-12: a sleeping zebra turned to a new heading every slot, and its foal at heel,
    // whose place turns with hers, swung round her and slid backwards.)
    const still = before !== null && Math.hypot(to.x - before.x, to.z - before.z) <= 0.5;
    const roll = rng(hashString(still ? `${animal.id}#yaw#at#${Math.round(to.x * 2)},${Math.round(to.z * 2)}` : `${animal.id}#yaw#${slot}`))();
    const from = before && !still ? before : animal.home;
    const away = Math.hypot(to.x - from.x, to.z - from.z);
    return now.face ?? (away > 0.5 ? Math.atan2(to.x - from.x, to.z - from.z) + (roll - 0.5) * (from === before ? 0.3 : 1.2) : roll * Math.PI * 2);
}

/** Where its last slots were going (the nearest of the four before with a goal), or null. Pure in (id, slot). */
function lastGoal(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Spot | null {
    for (let back = 1; back <= LOOK_BACK; back++) {
        const earlier = intent(world, profile, animal, activity, slot - back, hoursAt);
        if (earlier.follow) return null;
        if (earlier.to) return earlier.to;
    }
    return null;
}

/** Where a slot ends, worked out the same way by every caller (from its intent alone: never from the route there). */
function finishOf(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt, depth = 0): Spot {
    const i = intent(world, profile, animal, activity, slot, hoursAt);
    if (i.follow && animal.group) return shadowOf(world, animal, slot, hoursAt).finish;
    const settled = settle(world, profile, animal, slot, i, activity, hoursAt);
    if (settled) return settled.finish;
    if (depth < 6) return finishOf(world, profile, animal, activity, slot - 1, hoursAt, depth + 1);
    return groundSpot(world, animal.home.x, animal.home.z);
}

/** The trip an animal is on at a world time (pure: the same for every viewer). */
export function tripAt(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epochSeconds: number, hoursAt: HoursAt, activity?: ArkBehaviourProfile["activity"] | null, previous?: Trip | null): Trip {
    const slot = slotOf(animal, epochSeconds);
    return remember(memoOf(world, hoursAt, animal).trips, slot, () => {
        const now = intent(world, profile, animal, activity, slot, hoursAt);
        return tripFor(world, profile, animal, activity, slot, hoursAt, now, previous && previous.slot === slot - 1 ? previous.finish : null);
    });
}

/**
 * What it sets out to do in the slot at a world time: the slot's goal (its doing and recipe, as its trip will have
 * them), not the route there, so it costs no path. The tap card's "Now" and "Next", its own log and the live log's
 * moments read this (`animal-status.ts`). Pure, the same for every viewer; remembered with the trips.
 */
export type SlotPlan = {slot: number; start: number; end: number; doing: ArkDoing; recipe: string | null; mode: TripMode; follow: boolean; /** Watching a predator it saw (the shared wariness). */ wary: boolean};
export function slotPlanAt(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epochSeconds: number, hoursAt: HoursAt, activity?: ArkBehaviourProfile["activity"] | null): SlotPlan {
    const slot = slotOf(animal, epochSeconds);
    const plan = placedIntent(world, profile, animal, activity, slot, hoursAt);
    const start = slotStart(animal, slot);
    return {slot, start, end: start + SLOT_SECONDS, doing: plan.doing, recipe: plan.recipe ?? null, mode: plan.mode, follow: Boolean(plan.follow), wary: plan.doing === "watch" && plan.face !== undefined};
}

// MARK: Memo

/**
 * Intents and trips, remembered per world, clock and animal for the last few dozen slots: a group's members, its
 * leader's flock and a predator's spacing all ask for the same leader's slot many times. Pure results, so this
 * changes nothing but the time taken. `forgetSchedules` after an animal's home, group or range changes.
 */
type Memo = {intents: Map<number, Intent>; raw: Map<number, Intent>; placed: Map<number, Intent>; chains: Map<number, Array<Spot | null>>; trips: Map<number, Trip>};
let memos = new WeakMap<ScheduleWorld, WeakMap<HoursAt, WeakMap<ScheduleAnimal, Memo>>>();
function memoOf(world: ScheduleWorld, hoursAt: HoursAt, animal: ScheduleAnimal): Memo {
    let byClock = memos.get(world);
    if (!byClock) memos.set(world, (byClock = new WeakMap()));
    let byAnimal = byClock.get(hoursAt);
    if (!byAnimal) byClock.set(hoursAt, (byAnimal = new WeakMap()));
    let memo = byAnimal.get(animal);
    if (!memo) byAnimal.set(animal, (memo = {intents: new Map(), raw: new Map(), placed: new Map(), chains: new Map(), trips: new Map()}));
    return memo;
}
function remember<T>(map: Map<number, T>, slot: number, make: () => T): T {
    const hit = map.get(slot);
    if (hit !== undefined) return hit;
    const value = make();
    map.set(slot, value);
    if (map.size > 32) {
        // Drop the slots furthest from this one.
        const far = Array.from(map.keys()).sort((a, b) => Math.abs(b - slot) - Math.abs(a - slot)).slice(0, map.size - 24);
        for (const key of far) map.delete(key);
    }
    return value;
}
export function forgetSchedules() {
    memos = new WeakMap();
    roosts = new WeakMap();
    forgetRecipes();
}

function tripFor(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt, now: Intent, knownFrom: Spot | null): Trip {
    const start = slotStart(animal, slot);
    const end = start + SLOT_SECONDS;
    const from = knownFrom ?? finishOf(world, profile, animal, activity, slot - 1, hoursAt);
    const random = rng(hashString(`${animal.id}#route#${slot}`));
    const cruise = profile.altitude ? CRUISE[profile.altitude] : 0;
    const base = {slot, doing: now.doing, start, end, from, cruise, shadow: null as Trip["shadow"], recipe: now.recipe ?? null, owner: {animal, profile, slug: profile.slug, activity, hoursAt} as TripOwner};

    // A flock member with its leader in the air: catch up, then fly at its side (its own place in the flock, new each slot).
    if (now.follow && animal.group) {
        const shadow = shadowOf(world, animal, slot, hoursAt);
        const finish = shadow.finish;
        const catchUp = 6;
        const joinAt = basePoseOnTrip(world, shadow.trips[0], start + catchUp);
        const joined = shadowPoint(world, joinAt, shadow, start + catchUp, 0);
        const join: Spot = {x: joined.x, y: joined.y, z: joined.z, nx: 0, ny: 1, nz: 0, point: null};
        const legs: Leg[] = [
            now.mode === "water"
                ? {mode: "water", from, to: join, path: [from, join], length: Math.hypot(join.x - from.x, join.z - from.z), seconds: catchUp, beat: "swim"}
                : {mode: "air", from, to: join, path: [from, join], length: Math.hypot(join.x - from.x, join.z - from.z), seconds: catchUp, beat: "fly", cruise: Math.max(cruise * 0.5, 1)},
            {mode: "shadow", from: join, to: finish, path: null, length: 0, seconds: SLOT_SECONDS - catchUp, beat: "fly", pace: bodyLengthsPerSecond(profile) * Math.max(animal.length, 0.05)}
        ];
        return {...base, mode: now.mode === "water" ? "water" : "air", arrive: end, to: finish, finish, path: null, legs, stay: [], length: 0, running: false, shadow: {trips: shadow.trips, dx: shadow.dx, dy: shadow.dy, dz: shadow.dz}};
    }

    const to = now.to ?? from;
    let mode = now.mode;
    if (!now.to || (Math.hypot(to.x - from.x, to.z - from.z) < 0.05 && Math.abs(to.y - from.y) < 0.05)) mode = "stay";
    // Up off the ground at either end (a branch, a wall, a rock top): a flyer flies it, anything else climbs it.
    if ((mode === "ground" || mode === "water") && (raised(world, from) || raised(world, to))) mode = flies(profile) ? "air" : "surface";
    // A bird walks a few steps; further than that it flies. One that walks or swims first (a pigeon, a peafowl, a coot
    // on the bank) walks wherever its feet take it in the slot, and flies only further (lane MA3: the audit's peafowl
    // took off 34 times an hour).
    // (Further than that, only as often as it flies: else it walks on, the long way a run.)
    if (mode === "ground" && flies(profile) && Math.hypot(to.x - from.x, to.z - from.z) > (profile.move === "fly" ? Math.max(3, animal.length * 6) : walkReach(profile, animal)) && airAllowed(profile, animal, slot)) mode = "air";

    const pace = bodyLengthsPerSecond(profile) * Math.max(animal.length, 0.05);
    // (0.85-1.2 of its walk's own pace: its clip plays at 0.85-1.2 its rate.)
    const speed = pace * (0.85 + 0.35 * random());
    // In the air and the water at its own pace (the walk clip's cap is for its feet).
    // (A swimmer over a metre long at true size: counted in √L, not L, or a 14 m humpback cruised at 16 m/s. Motion pass §3.)
    const freeSpeed = freeBodyLengthsPerSecond(profile) * (profile.move === "swim" ? swimPaceLength(animal.length) : Math.max(animal.length, 0.05)) * (speed / pace);
    const legs: Leg[] = [];
    /** A walk's path; one its search gave up on (a long way round) on the same stretch of ground is searched further. */
    // (Its body's width: every run of its paths keeps clear of everything solid for it: collisions.)
    const bodyR = bodyRadiusOf(animal, profile.slug);
    const walkPath = (a: Spot, b: Spot, nodes: number): NavPoint[] => {
        const slope = maxSlopeOf(animal);
        const onto = onSurface(b.point);
        const path = world.nav.path(a, b, "walk", 0.5, nodes, slope, bodyR, onto);
        const end = path[path.length - 1];
        if (Math.hypot(end.x - b.x, end.z - b.z) < 0.01) return path;
        const region = world.nav.region(a.x, a.z, slope, bodyR);
        return region >= 0 && region === world.nav.region(b.x, b.z, slope, bodyR) ? world.nav.path(a, b, "walk", 0.5, 12000, slope, bodyR, onto) : path;
    };
    const ground = (a: Spot, b: Spot, beat: ArkBeat = "walk") => {
        const path = walkPath(a, b, 900);
        const last = path[path.length - 1];
        if (Math.hypot(last.x - b.x, last.z - b.z) > 0.01) path.push({x: b.x, z: b.z});
        // A varied route: now and then a pause on the way.
        const length = Math.max(pathLength(path), Math.abs(b.y - a.y));
        if (length > 3 && random() < 0.3 && path.length >= 2) {
            const mid = alongPath(path, 0.4 + random() * 0.2);
            const midSpot = groundSpot(world, mid.x, mid.z);
            const firstPath = walkPath(a, midSpot, 400);
            // Each half ends where it is going even when the grid can't reach it (from the water, say): it used to stop
            // short and take no time at all, and the animal jumped to the pause.
            if (Math.hypot(firstPath[firstPath.length - 1].x - midSpot.x, firstPath[firstPath.length - 1].z - midSpot.z) > 0.01) firstPath.push({x: midSpot.x, z: midSpot.z});
            const secondPath = walkPath(midSpot, b, 400);
            if (Math.hypot(secondPath[secondPath.length - 1].x - b.x, secondPath[secondPath.length - 1].z - b.z) > 0.01) secondPath.push({x: b.x, z: b.z});
            const l1 = pathLength(firstPath);
            const l2 = Math.max(pathLength(secondPath), 0.01);
            legs.push({mode: "ground", from: a, to: midSpot, path: firstPath, length: l1, seconds: l1 / speed, beat});
            legs.push({mode: "pause", from: midSpot, to: midSpot, path: null, length: 0, seconds: 2 + random() * 4, beat: random() < 0.6 ? "scan" : "pause", yaw: alongPath(firstPath, 1).yaw});
            legs.push({mode: "ground", from: midSpot, to: b, path: secondPath, length: l2, seconds: l2 / speed, beat});
        } else legs.push({mode: "ground", from: a, to: b, path, length, seconds: length / speed, beat});
    };
    const water = (a: Spot, b: Spot) => {
        const path = world.nav.path(a, b, "swim", 0.3, 900, MAX_SLOPE, bodyR);
        const last = path[path.length - 1];
        // (Two waters no water joins, for one that walks too: it walks between them, round the fences, never swims over land.)
        if (Math.hypot(last.x - b.x, last.z - b.z) > 0.01 && world.nav.colliders && (amphibious(profile) || (walks(profile) && !aquatic(profile)))) {
            ground(a, b, "walk");
            return;
        }
        if (Math.hypot(last.x - b.x, last.z - b.z) > 0.01) path.push({x: b.x, z: b.z});
        const length = pathLength(path) + Math.abs(b.y - a.y);
        legs.push({mode: "water", from: a, to: b, path, length, seconds: length / (freeSpeed * 1.4), beat: "swim"});
    };
    /** The water's edge to cross at: the drinking and shore points nearest a spot. */
    const edgeNear = (p: Spot): Spot | null => waterEdgeNear(world, profile, animal, p);
    let after: ArkBeat | null = null;
    switch (mode) {
        case "ground":
        case "water": {
            const fromWet = wet(world, from);
            const toWet = wet(world, to);
            if (amphibious(profile) && fromWet !== toWet) {
                // Into the water at an edge, or out of it at one: walk to the edge, slide in (or swim to it, climb out).
                const edge = edgeNear(toWet ? from : to) ?? edgeNear(toWet ? to : from);
                if (edge) {
                    const out = {x: edge.x + Math.sin(edgeYaw(world, edge)) * Math.max(animal.length, 0.6), z: edge.z + Math.cos(edgeYaw(world, edge)) * Math.max(animal.length, 0.6)};
                    const offshore = waterSpot(world, profile, animal, out.x, out.z, () => 0.3);
                    // (A slide in or a climb out is a few body lengths, never a straight run over land to water deep enough
                    // somewhere else: 2026-11-12, a true-size crocodile "slid in" 45 m across a garden's pickets to the
                    // nearest water deep enough for it. Then it walks and swims its way instead, below.)
                    const slideReach = Math.max(4, animal.length * 3);
                    if (Math.hypot(offshore.x - edge.x, offshore.z - edge.z) > slideReach) {
                        if (toWet) {
                            ground(from, edge);
                            water(edge, to);
                        } else {
                            water(from, edge);
                            ground(edge, to);
                        }
                        break;
                    }
                    if (toWet) {
                        ground(from, edge);
                        const slide = Math.hypot(offshore.x - edge.x, offshore.z - edge.z);
                        legs.push({mode: "enter", from: edge, to: offshore, path: [edge, offshore], length: slide, seconds: Math.min(Math.max(2.2, slide / pace), SLIDE_MOST), beat: "enter_water"});
                        water(offshore, to);
                    } else {
                        water(from, offshore);
                        const climb = Math.hypot(offshore.x - edge.x, offshore.z - edge.z);
                        legs.push({mode: "exit", from: offshore, to: edge, path: [offshore, edge], length: climb, seconds: Math.min(Math.max(2.4, climb / pace), SLIDE_MOST), beat: "exit_water"});
                        ground(edge, to);
                        after = "shake";
                    }
                    break;
                }
            }
            // Over land it walks, in the water it swims: one that does both (a seal, a penguin) goes by the ground under it.
            if ((mode === "water" && !amphibious(profile)) || (fromWet && toWet)) water(from, to);
            else ground(from, to);
            break;
        }
        case "air": {
            const flat = Math.hypot(to.x - from.x, to.z - from.z);
            const air = freeSpeed * 4;
            if (now.doing === "soar") {
                // A long, gentle sweep high over its range towards where it is going, bowed out to one side (a raptor
                // riding the air), not loops round seeded points (the audit's "circling", problem 2). A trip that ends
                // where it began runs out along a seeded heading and back.
                // (2026-11-11: it glides at about half its flapping cruise, so a soar over a near goal sweeps out far
                // enough to fill its time aloft; before, every soar crawled along a few metres at under 1 m/s.)
                const r = Math.max(homeRadius(profile, animal) * 0.8, 6);
                const glideReach = Math.min(60, (air * 0.55 * SLOT_SECONDS * 0.55) / 2.2);
                const span = Math.max(flat, r, glideReach);
                const side = random() < 0.5 ? -1 : 1;
                const bow = side * (0.18 + random() * 0.14) * span;
                let route: NavPoint[];
                if (flat >= span * 0.8) {
                    const dir = Math.atan2(to.x - from.x, to.z - from.z);
                    const ux = Math.sin(dir);
                    const uz = Math.cos(dir);
                    route = [from, {x: from.x + ux * (flat / 3) + uz * bow, z: from.z + uz * (flat / 3) - ux * bow}, {x: from.x + ux * ((2 * flat) / 3) + uz * bow * 0.9, z: from.z + uz * ((2 * flat) / 3) - ux * bow * 0.9}, to];
                } else {
                    // Out along a heading (towards its goal, or seeded), round in one wide U at the far end, and back
                    // to the goal: half a turn, not a loop. Towards the island's middle if the far end would be off it.
                    let dir = flat > 0.5 ? Math.atan2(to.x - from.x, to.z - from.z) + (random() - 0.5) * 0.8 : random() * Math.PI * 2;
                    if (Math.hypot(from.x + Math.sin(dir) * span, from.z + Math.cos(dir) * span) > Math.max(Math.hypot(from.x, from.z), 60)) dir = Math.atan2(-from.x, -from.z) + (random() - 0.5) * 0.8;
                    const ux = Math.sin(dir);
                    const uz = Math.cos(dir);
                    const at = (along: number, across: number): NavPoint => ({x: from.x + ux * along + uz * across, z: from.z + uz * along - ux * across});
                    route = [from, at(span * 0.5, bow * 0.15), at(span * 0.9, bow * 0.45), at(span * 0.85, bow * 0.85), at(span * 0.45, bow * 0.8), to];
                }
                const length = pathLength(route) + Math.abs(to.y - from.y);
                legs.push(overSolids(world, {mode: "air", from, to, path: route, length, seconds: Math.max(length / (air * 0.8), SLOT_SECONDS * 0.55), beat: "glide", cruise: cruise * 1.2}, bodyR));
            } else {
                // Its own line: bowed a little to one side by a seeded amount (a straight flight to where it is going, not
                // a weaving one: problem 2's turns).
                const side = (random() - 0.5) * 0.25 * flat;
                const mid = {x: (from.x + to.x) / 2 + ((to.z - from.z) / (flat || 1)) * side, z: (from.z + to.z) / 2 - ((to.x - from.x) / (flat || 1)) * side};
                const route = [from, mid, to];
                const length = pathLength(route) + Math.abs(to.y - from.y);
                legs.push(overSolids(world, {mode: "air", from, to, path: route, length, seconds: length / air, beat: "fly", cruise: flat < 4 ? Math.min(cruise, flat * 0.5 + 0.5) : cruise}, bodyR));
            }
            break;
        }
        case "surface": {
            const climb = (a: Spot, b: Spot) => {
                const length = Math.hypot(b.x - a.x, b.z - a.z) + Math.abs(b.y - a.y);
                legs.push({mode: "surface", from: a, to: b, path: [a, b], length, seconds: length / (speed * 0.6), beat: "climb"});
            };
            // (Collisions: up onto a rock or a tree from the ground it first walks to its foot, round whatever is in the
            // way, and climbs from there; down, the same the other way: never a straight line through a trunk, a fence or
            // the rock itself from wherever it was.)
            const footOf = (p: Spot): Spot | null => climbFoot(world, profile, animal, p);
            const fromUp = raised(world, from);
            const toUp = raised(world, to);
            const footA = fromUp ? footOf(from) : from;
            const footB = toUp ? footOf(to) : to;
            if (world.nav.colliders && !flies(profile) && (fromUp || toUp) && footA && footB) {
                if (fromUp) climb(from, footA);
                if (Math.hypot(footB.x - footA.x, footB.z - footA.z) > 0.05) ground(footA, footB);
                if (toUp) climb(footB, to);
            } else climb(from, to);
            break;
        }
        default:
            break;
    }
    // (No further than it goes in a second and a bit, nor than a few of its lengths: a slow walker faces the way it is
    // going until it is at a corner, not round it while it still walks the other way.)
    const lookAhead = Math.min(Math.max(Math.min(animal.length * 2.5, speed * 1.2), 0.15), 1.5);
    // A walk, a swim or a flight that sets off well away from the way it faces turns on the spot first, at TURN_RATE
    // (never a spin in 0.8 s while already on its way, and never moving against the way it faces: the release's orca
    // swam backwards as it set off). Under a radian it turns into its way as it goes, never more than that off it.
    const first = legs[0];
    if (first && (first.mode === "ground" || first.mode === "water" || first.mode === "air") && first.path && from.yaw !== undefined && !now.follow) {
        const ahead = alongPath(first.path, Math.min(lookAhead / Math.max(pathLength(first.path), 0.01), 1));
        if (Math.hypot(ahead.x - from.x, ahead.z - from.z) > 0.2) {
            const turn = Math.abs(Math.atan2(Math.sin(Math.atan2(ahead.x - from.x, ahead.z - from.z) - from.yaw), Math.cos(Math.atan2(ahead.x - from.x, ahead.z - from.z) - from.yaw)));
            if (turn > 1) legs.unshift({mode: "pause", from, to: from, path: null, length: 0, seconds: turn / TURN_RATE, beat: "pause", yaw: Math.atan2(ahead.x - from.x, ahead.z - from.z), turn: true});
        }
    }
    // How far along its way it looks to face: a sparrow a few of its lengths, not 1.5 m (a path that doubled back
    // within that had it walking backwards to the corner, the default view's sparrow), a big walker 1.5 m.
    for (const leg of legs) if (leg.mode === "ground" || leg.mode === "water") leg.look = lookAhead;
    // Fitted into the slot: a long way is a run; never more than four fifths of the slot on the way.
    let travel = legs.reduce((sum, leg) => sum + leg.seconds, 0);
    // A long way is a run, at its run's own pace at most (one with no run clip walks it: slowed, never sped up).
    const runs = runFactor(profile);
    // (A way onto a rock or a wall goes on foot first: that part runs too when it is long. Decision 202: a komodo's
    // 40 m round the rocks to its basking ledge walked at twice its pace.)
    const running = (mode === "ground" || mode === "surface") && travel > SLOT_SECONDS * 0.45 && runs > 1.3;
    if (running) for (const leg of legs) if (leg.mode === "ground") {
        leg.seconds /= runs;
        leg.beat = "run";
    }
    travel = legs.reduce((sum, leg) => sum + leg.seconds, 0);
    // Too long for four fifths of the slot: quicker, but on foot never past its clip's pace cap (PACE_CAP: faster, its
    // feet slide; a clawed frog with no run walked at 1.37 of its walk); past that the way takes more of the slot
    // (its stay beats are fitted into what is left), and only a way longer than all but 6 s of it goes faster still.
    if (travel > SLOT_SECONDS * 0.8) {
        let k = (SLOT_SECONDS * 0.8) / travel;
        const onFoot = legs.some((leg) => leg.mode === "ground");
        // (To 1.2 of its pace at most, a margin under the cap: the walk's own pace already varies 0.85-1.2.)
        if (onFoot) k = Math.max(k, speed / pace / Math.min(PACE_CAP, 1.2));
        if (travel * k > SLOT_SECONDS - 6) k = (SLOT_SECONDS - 6) / travel;
        for (const leg of legs) leg.seconds *= k;
        travel *= k;
    }
    const settled = settle(world, profile, animal, slot, {...now, to}, activity, hoursAt) ?? {beats: [], finish: to};
    // Its beats fitted into the time left (all of them, so it ends where `finishOf` says); a shake first after a swim.
    const left = SLOT_SECONDS - travel;
    // The last beat starts at least 3 s before the slot ends, so a last step is finished by then.
    const room = Math.max(left - (after ? 2.6 : 0) - 3, 0);
    const lastAt = settled.beats.length ? settled.beats[settled.beats.length - 1].at : 0;
    const squeeze = lastAt > room && lastAt > 0 ? room / lastAt : 1;
    let beats = settled.beats.map((b) => ({...b, at: b.at * squeeze + (after ? 2.6 : 0)}));
    const finish = now.to ? settled.finish : from;
    // (With no beats after it, a shake faces the way it settles: 2026-11-12, a penguin out of the sea shook facing north
    // and snapped round at the next slot.)
    if (after) beats = [{at: 0, beat: after, x: to.x, z: to.z, yaw: settled.beats[0]?.yaw ?? finish.yaw ?? 0}, ...beats];
    const stay = {beats, finish};
    const mainLeg = legs.find((leg) => leg.mode === "ground" || leg.mode === "water") ?? null;
    return {
        ...base,
        mode: legs.length ? (mode === "stay" ? "ground" : mode) : "stay",
        arrive: start + travel,
        to,
        finish: stay.finish,
        path: mainLeg ? mainLeg.path : null,
        legs,
        stay: stay.beats,
        length: legs.reduce((sum, leg) => sum + leg.length, 0),
        running
    };
}

/**
 * The longest a slide into the water or a climb out takes (s): its clip, not its walk (the walk's capped pace had a
 * harbour seal sliding in for 52 s).
 */
const SLIDE_MOST = 5;

/**
 * How much of what a flyer does by air a bird that walks or swims first does by air (lane MA3): its appetite for flying
 * against a flyer's 0.5, squared (a flight up to a perch is two take-offs, up and down again, and each is a choice to
 * fly), so a pigeon (0.08) one in forty, a hen (0.01) none to speak of. 1 for a flyer, and for one that does not fly.
 */
export function airShare(profile: ArkBehaviourProfile): number {
    if (profile.move === "fly" || !flies(profile)) return 1;
    return Math.min((profile.weights.fly ?? 0) / 0.5, 1) ** 2;
}
/** Whether this slot may take it up by air (a perch, a raised place, a recipe in a tree): its own seeded roll against `airShare`. */
function airAllowed(profile: ArkBehaviourProfile, animal: ScheduleAnimal, slot: number): boolean {
    const share = airShare(profile);
    return share >= 1 || rng(hashString(`${animal.id}#air#${slot}`))() < share;
}

/** What a wading bird does standing in the shallows, and how often a slot of it is spent there (lane MA3). */
const WADING: ReadonlySet<ArkBehaviour> = new Set<ArkBehaviour>(["forage", "rest", "wander", "groom"]);
const WADE_SHARE = 0.55;

/**
 * Shallow water near a centre where a wading bird stands (lane MA3): out from its nearest water's edges, the first
 * point at least 5 cm and at most a third of its length deep (half a metre at most: its legs), seeded per slot. Null
 * where no water's edge is near. The scene keeps it standing on the bed there (`index.ts`, no band: never on the
 * surface).
 */
function shallowsNear(world: ScheduleWorld, animal: ScheduleAnimal, centre: {x: number; z: number}, reach: number, slot: number): Spot | null {
    const edges = world.sampler.attachPoints("water_edge", {x: centre.x, z: centre.z, r: reach});
    if (!edges.length) return null;
    const deepest = Math.min(Math.max(animal.length * 0.33, 0.12), 0.5);
    const random = rng(hashString(`${animal.id}#shallows#${slot}`));
    const sorted = [...edges].sort((m, n) => Math.hypot(m.x - centre.x, m.z - centre.z) - Math.hypot(n.x - centre.x, n.z - centre.z) || m.id.localeCompare(n.id));
    const first = Math.floor(random() ** 1.4 * Math.min(sorted.length, 12));
    for (let k = 0; k < Math.min(sorted.length, 12); k++) {
        const edge = spotOf(sorted[(first + k) % Math.min(sorted.length, 12)]);
        const yaw = edgeYaw(world, edge) + (random() - 0.5) * 0.8;
        for (let d = 0.4; d <= 4; d += 0.3) {
            const x = edge.x + Math.sin(yaw) * d;
            const z = edge.z + Math.cos(yaw) * d;
            const depth = surfaceY(world, x, z) - world.sampler.heightAt(x, z);
            if (depth > deepest) break;
            if (depth >= 0.05) return {x, y: world.sampler.heightAt(x, z), z, nx: 0, ny: 1, nz: 0, point: null, yaw};
        }
    }
    return null;
}

/**
 * How far a bird that walks first walks rather than flies (m, lane MA3): as far as its walk (at most its run, never
 * past its pace cap) takes it in half a slot, the rest of the slot for what it came to do.
 */
function walkReach(profile: ArkBehaviourProfile, animal: ScheduleAnimal): number {
    const pace = bodyLengthsPerSecond(profile) * Math.max(animal.length, 0.05);
    return Math.max(3, animal.length * 6, pace * Math.min(Math.max(runFactor(profile), 1), PACE_CAP) * SLOT_SECONDS * 0.5);
}

/**
 * Where it is on its way into or out of the water now (lane MA3): the slide in ("enter") or the climb out ("exit") and
 * how far along it (0-1), from its trip's legs at a world time; null on any other leg. The rig player plays the
 * entry and exit clips by it, and the pose eases the body from standing to its float line over it.
 */
export function waterEdgeAt(trip: Trip, epochSeconds: number): {mode: "enter" | "exit"; u: number; seconds: number} | null {
    let t = trip.start;
    for (const leg of trip.legs) {
        const end = t + leg.seconds;
        if (epochSeconds < end) {
            if (epochSeconds < t || (leg.mode !== "enter" && leg.mode !== "exit")) return null;
            return {mode: leg.mode, u: leg.seconds > 0 ? Math.min(Math.max((epochSeconds - t) / leg.seconds, 0), 1) : 1, seconds: leg.seconds};
        }
        t = end;
    }
    return null;
}

/** The water's edge to cross at: the drinking and shore points nearest a spot. */
function waterEdgeNear(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, p: Spot): Spot | null {
    const near = world.sampler.attachPoints("water_edge", {x: p.x, z: p.z, r: Math.max(homeRadius(profile, animal) * 2, 12)});
    if (!near.length) return null;
    const best = [...near].sort((m, n) => Math.hypot(m.x - p.x, m.z - p.z) - Math.hypot(n.x - p.x, n.z - p.z) || m.id.localeCompare(n.id))[0];
    return spotOf(best);
}

/** Which way the water is from an edge point (its own heading faces the water). */
function edgeYaw(world: ScheduleWorld, edge: Spot): number {
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const px = edge.x + Math.sin(a) * 1.5;
        const pz = edge.z + Math.cos(a) * 1.5;
        if (world.sampler.heightAt(px, pz) < surfaceY(world, px, pz)) return a;
    }
    return 0;
}

export type TripPose = {
    x: number;
    y: number;
    z: number;
    yaw: number;
    /** Moving now (walking, flying, swimming, a grazing step). */
    moving: boolean;
    /** In the air now. */
    aloft: boolean;
    nx: number;
    ny: number;
    nz: number;
    /** The beat now (bite, chew, scan, walk, swim, enter_water…). */
    beat: ArkBeat;
};

/** A point along a polyline route (x, z), smoothed through its middle points (a bowed line, an arc). */
/** What a low flyer climbs over rather than through (the colliders' kinds: never a trunk, under its crown). */
const FLOWN_OVER: ReadonlySet<string> = new Set(["fence", "building", "post", "hay", "log", "rock"]);

/**
 * A flight that clears what it takes off beside or comes down behind (collisions): where its climb or its descent would
 * cross a fence, a wall, a hay bale or a rock below its top, it climbs (or comes down) over a shorter share of the leg,
 * steeply enough to pass 0.15 m over it (2026-11-12: a masked owl took off low through a garden's pickets). Its route
 * and its pace are as they were.
 */
function overSolids(world: ScheduleWorld, leg: Leg, bodyR: number): Leg {
    const solid = world.nav.colliders;
    const route = leg.path;
    if (!solid || !route || leg.mode !== "air") return leg;
    const cruise = leg.cruise ?? 0;
    if (cruise <= 0.2) return leg;
    let rise = 0.18;
    let fall = 0.22;
    const n = Math.min(Math.max(Math.ceil(leg.length / 0.5), 8), 120);
    const inverse = (need: number) => {
        // (The share of the climb (0-1) that lifts it `need` of its cruise: smoothstep's inverse.)
        let lo = 0;
        let hi = 1;
        for (let k = 0; k < 14; k++) {
            const m = (lo + hi) / 2;
            if (m * m * (3 - 2 * m) < need) lo = m;
            else hi = m;
        }
        return hi;
    };
    const scratch: Collider[] = [];
    for (let j = 1; j < n; j++) {
        const u = j / n;
        // (Only its climb and its descent: in between it is at its cruise.)
        if (u > rise && 1 - u > fall) continue;
        const at = alongRoute(route, u);
        let top = -Infinity;
        for (const c of solid.near(at.x, at.z, bodyR + 0.01, scratch)) {
            if (!FLOWN_OVER.has(c.kind) || c.soft || colliderDistance(c, at.x, at.z) >= bodyR) continue;
            top = Math.max(top, c.y1);
        }
        if (top === -Infinity) continue;
        const base = leg.from.y + (leg.to.y - leg.from.y) * u;
        const ground = Math.max(world.sampler.heightAt(at.x, at.z), 0);
        const need = (top + 0.15 - base) / (cruise + Math.max(ground - base, 0));
        if (need <= 0 || need >= 0.98) continue;
        const k = inverse(need);
        if (u <= 0.5) rise = Math.max(Math.min(rise, u / k), 0.01);
        else fall = Math.max(Math.min(fall, (1 - u) / k), 0.01);
    }
    return rise === 0.18 && fall === 0.22 ? leg : {...leg, rise, fall};
}

function alongRoute(route: NavPoint[], u: number): {x: number; z: number; yaw: number} {
    if (route.length === 3) {
        // A quadratic curve through the middle point.
        const [a, m, b] = route;
        const cx = 2 * m.x - (a.x + b.x) / 2;
        const cz = 2 * m.z - (a.z + b.z) / 2;
        const v = 1 - u;
        const x = v * v * a.x + 2 * v * u * cx + u * u * b.x;
        const z = v * v * a.z + 2 * v * u * cz + u * u * b.z;
        const dx = 2 * v * (cx - a.x) + 2 * u * (b.x - cx);
        const dz = 2 * v * (cz - a.z) + 2 * u * (b.z - cz);
        return {x, z, yaw: Math.atan2(dx, dz)};
    }
    if (route.length > 3) {
        // Catmull-Rom through every point.
        const n = route.length - 1;
        const f = Math.min(u * n, n - 1e-6);
        const i = Math.floor(f);
        const t = f - i;
        const p0 = route[Math.max(i - 1, 0)];
        const p1 = route[i];
        const p2 = route[i + 1];
        const p3 = route[Math.min(i + 2, n)];
        const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
        const dcr = (a: number, b: number, c: number, d: number) => 0.5 * (-a + c + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t * t);
        return {x: cr(p0.x, p1.x, p2.x, p3.x), z: cr(p0.z, p1.z, p2.z, p3.z), yaw: Math.atan2(dcr(p0.x, p1.x, p2.x, p3.x), dcr(p0.z, p1.z, p2.z, p3.z))};
    }
    const at = alongPath(route, u);
    return at;
}

/**
 * A flock or school member's point beside its leader's pose: its own offset, which breathes (the cluster loosens and
 * tightens, each member on its own rhythm; `ease` 0 holds it still, for the moment it joins), above or below in the
 * water and the air, and its own small difference of heading.
 */
function shadowPoint(world: ScheduleWorld, at: TripPose, shadow: NonNullable<Trip["shadow"]>, epochSeconds: number, ease: number): {x: number; y: number; z: number; yaw: number} {
    const phase = (shadow.dx * 7.3 + shadow.dz * 3.1) % (Math.PI * 2);
    // (Slowly and a little: a quick in-and-out round a resting leader read as swimming in circles.)
    const breathe = 1 + ease * 0.08 * Math.sin(epochSeconds * 0.11 + phase);
    const inWater = at.y < surfaceY(world, at.x, at.z) - 0.01;
    const y = at.aloft || inWater ? at.y + shadow.dy * (1 + ease * 0.15 * Math.sin(epochSeconds * 0.15 + phase)) : at.y;
    const x = at.x + shadow.dx * breathe;
    const z = at.z + shadow.dz * breathe;
    const floor = world.sampler.heightAt(x, z);
    const top = surfaceY(world, x, z);
    const ground = at.aloft ? -Infinity : inWater ? floor + 0.2 : Math.max(floor, top);
    const ceiling = inWater ? top - 0.1 : Infinity;
    return {x, y: Math.min(Math.max(y, ground), ceiling), z, yaw: at.yaw + ease * 0.08 * Math.sin(epochSeconds * 0.15 + phase)};
}

function legPose(world: ScheduleWorld, leg: Leg, u: number, trip: Trip, epochSeconds: number): TripPose {
    const {from, to} = leg;
    const moving = u < 1;
    const up = {nx: 0, ny: 1, nz: 0};
    switch (leg.mode) {
        case "ground":
        case "water": {
            const route = leg.path ?? [from, to];
            const at = alongPath(route, u);
            // It faces a point a metre and a half on along its way: a corner is turned through, not snapped.
            const total = pathLength(route);
            if (total > 0.01 && u < 1) {
                const ahead = alongPath(route, Math.min(u + (leg.look ?? 1.5) / total, 1), total);
                if (Math.hypot(ahead.x - at.x, ahead.z - at.z) > 0.05) at.yaw = Math.atan2(ahead.x - at.x, ahead.z - at.z);
            }
            const ground = world.sampler.heightAt(at.x, at.z);
            // (Its height over the ground, or in the water at its depth under the surface: the sea's 0, or on the bigger
            // island the lake's and the river's own level.)
            const level = (p: Spot) => {
                const h = world.sampler.heightAt(p.x, p.z);
                return h > surfaceY(world, p.x, p.z) ? p.y - h : 0;
            };
            const top = surfaceY(world, at.x, at.z);
            const base = ground > top ? ground : Math.max(Math.min(from.y + (to.y - from.y) * u, top), ground);
            const y = base + level(from) * (1 - u) + level(to) * u;
            return {x: at.x, y, z: at.z, yaw: at.yaw, moving, aloft: false, ...up, beat: leg.beat};
        }
        case "enter":
        case "exit": {
            // Down the bank into the water, or up out of it.
            const x = from.x + (to.x - from.x) * u;
            const z = from.z + (to.z - from.z) * u;
            const ground = Math.max(world.sampler.heightAt(x, z), Math.min(from.y, to.y));
            const y = Math.max(from.y + (to.y - from.y) * u, ground);
            return {x, y, z, yaw: Math.atan2(to.x - from.x, to.z - from.z), moving, aloft: false, ...up, beat: leg.beat};
        }
        case "air": {
            const route = leg.path ?? [from, to];
            const at = alongRoute(route, u);
            const base = from.y + (to.y - from.y) * u;
            // (v2: over the drawn rocks' tops too, `flightFloor`: the bigger island's mountain is rock-strewn.)
            const ground = world.sampler.flightFloor ? Math.max(topAt(world, at.x, at.z), world.sampler.flightFloor(at.x, at.z)) : topAt(world, at.x, at.z);
            // Take off, climb to its band, cruise, and come down to land (gliding in on long legs).
            const rise = Math.min(u / (leg.rise ?? 0.18), 1);
            const fall = Math.min((1 - u) / (leg.fall ?? 0.22), 1);
            const k = Math.min(rise, fall);
            const lift = k * k * (3 - 2 * k);
            const floor = Math.min(ground, base);
            const y = Math.max(base + ((leg.cruise ?? trip.cruise) + Math.max(ground - base, 0)) * lift, floor + 0.05 * lift);
            return {x: at.x, y, z: at.z, yaw: at.yaw, moving, aloft: moving && lift > 0.05, ...up, beat: lift > 0.9 && leg.beat === "glide" ? "glide" : "fly"};
        }
        case "surface": {
            const x = from.x + (to.x - from.x) * u;
            const z = from.z + (to.z - from.z) * u;
            const y = from.y + (to.y - from.y) * u;
            const nx = from.nx + (to.nx - from.nx) * u;
            const ny = from.ny + (to.ny - from.ny) * u;
            const nz = from.nz + (to.nz - from.nz) * u;
            const n = Math.hypot(nx, ny, nz) || 1;
            return {x, y, z, yaw: Math.atan2(to.x - from.x, to.z - from.z), moving, aloft: false, nx: nx / n, ny: ny / n, nz: nz / n, beat: "climb"};
        }
        case "shadow": {
            const shadow = trip.shadow!;
            const lead = shadow.trips.find((t) => epochSeconds >= t.start && epochSeconds < t.end) ?? shadow.trips[shadow.trips.length - 1];
            const at = basePoseOnTrip(world, lead, Math.min(epochSeconds, lead.end - 0.001));
            // Blend into its own finish over the last seconds, so the next slot starts where this one ends. On the ground
            // a blend that goes anywhere is a walk there, facing its way (turned into it over its first quarter): never
            // sliding sideways or backwards (the default view's sparrow).
            // (The walk takes as long as its walking pace says, within the last 8% of the leg: at a slower blend its
            // walk clip played in slow motion.)
            const lastPart = 1 - 0.08;
            let settleAt = lastPart;
            let walkYaw: number | null = null;
            if (u >= lastPart) {
                const blendStart = epochSeconds - (u - lastPart) * leg.seconds;
                const lead0 = shadow.trips.find((t) => blendStart >= t.start && blendStart < t.end) ?? lead;
                const p0 = shadowPoint(world, basePoseOnTrip(world, lead0, Math.min(blendStart, lead0.end - 0.001)), shadow, blendStart, 1);
                const walkDist = Math.hypot(to.x - p0.x, to.z - p0.z);
                if (!at.aloft && walkDist > 0.3) {
                    if (leg.pace) settleAt = Math.max(1 - walkDist / leg.pace / leg.seconds, lastPart);
                    if (u >= settleAt) walkYaw = Math.atan2(to.x - p0.x, to.z - p0.z);
                }
            }
            if (u >= 1) return {x: to.x, y: to.y, z: to.z, yaw: walkYaw ?? at.yaw, moving: false, aloft: at.aloft, ...up, beat: at.beat};
            const p = shadowPoint(world, at, shadow, epochSeconds, Math.min(u / 0.08, 1));

            const blend = Math.max((u - settleAt) / (1 - settleAt), 0);
            let yaw = p.yaw;
            if (walkYaw !== null) {
                const turn = Math.atan2(Math.sin(walkYaw - p.yaw), Math.cos(walkYaw - p.yaw));
                yaw = p.yaw + turn * Math.min(blend * 4, 1);
            }
            return {x: p.x + (to.x - p.x) * blend, y: p.y + (to.y - p.y) * blend, z: p.z + (to.z - p.z) * blend, yaw, moving: walkYaw !== null ? blend > 0 : at.moving, aloft: at.aloft, ...up, beat: walkYaw !== null && blend > 0 ? "walk" : at.beat};
        }
        case "pause":
        default:
            return {x: from.x, y: from.y, z: from.z, yaw: leg.yaw ?? (Math.atan2(to.x - from.x, to.z - from.z) || 0), moving: false, aloft: false, ...up, beat: leg.beat};
    }
}

/** How fast an animal turns where it stands (rad/s, about 90 degrees a second). */
export const TURN_RATE = 1.6;

/**
 * Where an animal on a trip is at a world time (its foot point), which way it faces, and its beat, with its recipe's
 * episode laid over (`behaviour-recipes.ts`: a fishing dive, a contest, a dust bath; `act` says which).
 */
export function poseOnTrip(world: ScheduleWorld, trip: Trip, epochSeconds: number): RecipePose {
    return episodePose(world, trip, basePoseOnTrip(world, trip, epochSeconds), epochSeconds, KIT);
}

/** The marks (holes, mounds, hollows) an animal's recent recipe episodes left, still there now (pure: its last slots' trips). */
export function recipeMarks(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epochSeconds: number, hoursAt: HoursAt, activity?: ArkBehaviourProfile["activity"] | null): RecipeMark[] {
    const trips: Trip[] = [];
    for (let back = 0; back < Math.ceil(MARK_SECONDS / SLOT_SECONDS) + 1; back++) trips.push(tripAt(world, profile, animal, epochSeconds - back * SLOT_SECONDS, hoursAt, activity));
    return marksOf(world, trips, epochSeconds, KIT);
}

/** Its coat from its recent recipe acts (wet after a bathe or dive, muddy after a wallow, dusty after a dust bath): pure. */
export function recipeCoat(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epochSeconds: number, hoursAt: HoursAt, activity?: ArkBehaviourProfile["activity"] | null): RecipeCoat {
    const trips: Trip[] = [];
    for (let back = 0; back < Math.ceil(1200 / SLOT_SECONDS) + 1; back++) trips.push(tripAt(world, profile, animal, epochSeconds - back * SLOT_SECONDS, hoursAt, activity));
    return coatOf(world, trips, epochSeconds, KIT);
}

/** An animal's nest site this season (for a builder, until the props lane's nests are wired), or null. */
export function recipeNest(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epochSeconds: number): Spot | null {
    return nestSiteOf(world, profile, animal, profile.slug, KIT, epochSeconds);
}

/** A trip's recipe episode at its destination, if it has one (for the tests and the review sample). */
export function tripEpisode(world: ScheduleWorld, trip: Trip): Episode | null {
    return episodeOfTrip(world, trip, KIT);
}

/** Where an animal on a trip is at a world time without its recipe's episode (the schedule's own pose). */
export function basePoseOnTrip(world: ScheduleWorld, trip: Trip, epochSeconds: number): TripPose {
    const into = epochSeconds - trip.start;
    if (into < trip.arrive - trip.start) {
        let t = Math.max(into, 0);
        for (const leg of trip.legs) {
            if (t < leg.seconds || leg === trip.legs[trip.legs.length - 1]) {
                const pose = legPose(world, leg, leg.seconds > 0 ? Math.min(t / leg.seconds, 1) : 1, trip, epochSeconds);
                // Setting off it turns from the way it was facing to its way over 0.8 s, not in an instant; a big turn is
                // made on the spot first (a turn leg, at TURN_RATE) before it walks.
                const since = Math.max(into, 0);
                const easing = trip.legs[0]?.turn ? trip.legs[0].seconds : 0.8;
                if (since < easing && trip.from.yaw !== undefined && !trip.shadow) {
                    let turn = pose.yaw - trip.from.yaw;
                    while (turn > Math.PI) turn -= Math.PI * 2;
                    while (turn < -Math.PI) turn += Math.PI * 2;
                    return {...pose, yaw: trip.from.yaw + turn * (since / easing)};
                }
                return pose;
            }
            t -= leg.seconds;
        }
    }
    if (trip.shadow) {
        const leg = trip.legs[trip.legs.length - 1];
        return legPose(world, leg, 1, trip, epochSeconds);
    }
    // At its destination: its beats (a step walks it on).
    const since = epochSeconds - trip.arrive;
    const to = trip.to;
    const stay = trip.stay;
    const last = trip.legs[trip.legs.length - 1];
    const lastPose = last ? legPose(world, last, 1, trip, epochSeconds) : null;
    const startYaw = lastPose ? lastPose.yaw : trip.from.yaw ?? stay[0]?.yaw ?? 0;
    const up = {nx: to.nx, ny: to.ny, nz: to.nz};
    if (!stay.length) {
        // (No beats, asleep say: it turns where it lies to the heading it settles to, at TURN_RATE, so its slot ends facing
        // the way the next one starts from. 2026-11-12: it kept the way it came in all slot and snapped round at the next.)
        // (Not under a recipe, whose own steps start from the way it came in.)
        const settleYaw = trip.recipe ? startYaw : trip.finish.yaw ?? startYaw;
        let turn = settleYaw - startYaw;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        const turned = Math.min(Math.max(since / Math.max(Math.abs(turn) / TURN_RATE, 0.8), 0), 1);
        return {x: to.x, y: to.y, z: to.z, yaw: startYaw + turn * turned, moving: false, aloft: false, ...up, beat: trip.doing === "sleep" || trip.doing === "to_roost" ? "sleep" : "rest"};
    }
    let i = 0;
    while (i + 1 < stay.length && stay[i + 1].at <= since) i++;
    const beat = stay[i];
    const before = i > 0 ? stay[i - 1] : {x: to.x, z: to.z, yaw: startYaw};
    const stepSeconds = beat.dur ?? (beat.beat === "play" ? 0.8 : beat.beat === "stalk" ? 2.5 : 1.2);
    const u = Math.min(Math.max((since - beat.at) / stepSeconds, 0), 1);
    const x = before.x + (beat.x - before.x) * u;
    const z = before.z + (beat.z - before.z) * u;
    const onGround = Math.abs(to.y - topAt(world, to.x, to.z)) < 0.05 && !(to.y < surfaceY(world, to.x, to.z));
    const y = onGround && (x !== to.x || z !== to.z) ? topAt(world, x, z) : to.y;
    const wrapTurn = (a: number) => {
        let v = a;
        while (v > Math.PI) v -= Math.PI * 2;
        while (v < -Math.PI) v += Math.PI * 2;
        return v;
    };
    const stepped = beat.x !== before.x || beat.z !== before.z;
    const moving = u < 1 && stepped;
    let yaw: number;
    if (stepped) {
        // A step faces where it goes (it turned into it over its first quarter), and only once it has stopped does it
        // turn to the heading it settles to (over 0.6 s): never walking sideways or backwards.
        const way = Math.atan2(beat.x - before.x, beat.z - before.z);
        const into = before.yaw + wrapTurn(way - before.yaw) * Math.min(u * 4, 1);
        // (Done before the next beat begins, so nothing snaps there.)
        const room = (stay[i + 1]?.at ?? Infinity) - beat.at - stepSeconds;
        const after = Math.min(Math.max((since - beat.at - stepSeconds) / Math.min(Math.max(room, 0.15), 0.6), 0), 1);
        yaw = u < 1 ? into : way + wrapTurn(beat.yaw - way) * after;
    } else {
        // Turning where it stands (on arriving: from the way it came in, a landing kept on its line) at TURN_RATE, in
        // no less than 0.8 s, and done before the next beat begins (the recipes lane saw a 149 degree landing snap).
        const turn = wrapTurn(beat.yaw - before.yaw);
        const room = (stay[i + 1]?.at ?? Infinity) - beat.at;
        const time = Math.min(Math.max(Math.abs(turn) / TURN_RATE, 0.8), Math.max(room, 0.15));
        yaw = before.yaw + turn * Math.min(Math.max((since - beat.at) / time, 0), 1);
    }
    return {x, y: i === stay.length - 1 && u >= 1 ? trip.finish.y : y, z, yaw, moving, aloft: false, ...up, beat: beat.beat};
}

/** In the air for the whole of a behaviour, not just its trip (none now: flights are goals, they land). */
export function airborneDoing(doing: ArkDoing): boolean {
    return doing === "fly" || doing === "soar";
}

// MARK: Predators and prey

/** Roosts an animal resting in is out of sight: a den, a burrow, a cave, a tree hole, a crevice. */
const ENCLOSED_ROOSTS: ReadonlySet<ArkRoost> = new Set<ArkRoost>(["den", "burrow", "cave", "tree_hole", "crevice"]);

/**
 * Whether its schedule has it settled at its roost now (asleep there, or resting there), and whether that roost hides
 * it (`enclosed`: a den, a burrow, a cave, a tree hole, a crevice). Pure and shared: the runtime lane's `arkOutside`
 * rotation (live-budget.ts) can hide these first, so an animal out of sight is plausibly at home, the same for every
 * viewer (it never depends on a viewer's budget).
 */
export function restingAtRoost(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epochSeconds: number, hoursAt: HoursAt, activity?: ArkBehaviourProfile["activity"] | null): {resting: boolean; enclosed: boolean} {
    const trip = tripAt(world, profile, animal, epochSeconds, hoursAt, activity);
    if (epochSeconds < trip.arrive) return {resting: false, enclosed: false};
    const settled = trip.doing === "sleep" || trip.doing === "to_roost" || trip.doing === "rest";
    if (!settled) return {resting: false, enclosed: false};
    const roost = roostOf(world, profile, animal);
    const at = poseOnTrip(world, trip, epochSeconds);
    const home = Math.hypot(at.x - roost.x, at.z - roost.z) < Math.max(animal.length * 2, 1.5) && !at.moving;
    return {resting: home, enclosed: home && ENCLOSED_ROOSTS.has(profile.roost)};
}

/** The farthest any prey animal notices a predator in the shared layer (open ground, a big prey, a big hunter on the move). */
export const WARY_METRES = 55;

/** How far one can see across each zone, against open grassland (trees, reeds and undergrowth hide a hunter). */
const OPENNESS: Partial<Record<ArkZone, number>> = {grassland: 1.15, desert: 1.15, polar: 1.15, mountains: 1, seashore: 1, open_ocean: 1, coral_reef: 0.9, river_lake: 0.9, farm_garden: 0.9, wetland: 0.8, woodland: 0.65, rainforest: 0.5};

/**
 * How far a prey animal notices a predator (scene metres), on the reactive layer's sight model
 * (flee-envelope.md §2): its own sight by how it moves (a bird's best, a fish's short) and its size, how easy the
 * hunter is to see (bigger, and moving, more), and how open its zone is. A zebra sees a lion walking across the
 * grassland about 43 m off, one lying still about 24 m; a forest hides both at half that.
 */
export function waryRange(prey: ArkBehaviourProfile, zone: ArkZone, hunterLength: number, hunterMoving: boolean): number {
    const sight = prey.move === "fly" || prey.moves.includes("fly") ? 40 : aquatic(prey) ? 12 : 30;
    const size = 0.7 + (prey.size ?? 40) / 160;
    const seen = (hunterMoving ? 1.25 : 0.7) * (0.7 + 0.15 * Math.min(Math.max(hunterLength, 0.2), 3));
    return Math.min(Math.max(sight * size * seen * (OPENNESS[zone] ?? 0.8), 4), WARY_METRES);
}

/**
 * The nearest of its predators it can see at a moment (awake, within its `waryRange` of anywhere in its range: `near`
 * and `radius`, where it is about), or null. Pure: the predator's own schedule, which never depends on its prey's
 * (and never the prey's own earlier slots: measuring from where the last slot left it would chain back through every
 * slot before it). `d` is the distance from `near`.
 */
export function threatAt(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epochSeconds: number, hoursAt: HoursAt, near: {x: number; z: number} = animal.home, radius = 0): {x: number; z: number; d: number} | null {
    if (!animal.threats?.length) return null;
    let best: {x: number; z: number; d: number} | null = null;
    for (const threat of animal.threats) {
        const trip = tripAt(world, threat.profile, threat.animal, epochSeconds, hoursAt, threat.activity);
        if (trip.doing === "sleep" || trip.doing === "to_roost") continue;
        const at = poseOnTrip(world, trip, epochSeconds);
        const d = Math.hypot(at.x - near.x, at.z - near.z);
        if (d - radius < waryRange(profile, animal.zone, threat.animal.length, at.moving) && d > 0.01 && (!best || d < best.d)) best = {x: at.x, z: at.z, d};
    }
    return best;
}

/**
 * Each animal's predators (`ScheduleAnimal.threats`), from the food links: only top predators (ones nothing aboard
 * eats), so no schedule ever waits on one that waits on it. Call after the homes are spaced; then `forgetSchedules`.
 */
export function wireThreats(list: Array<{slug: string; animal: ScheduleAnimal; profile: ArkBehaviourProfile; activity: ArkBehaviourProfile["activity"] | null | undefined}>, eats: (predator: string, prey: string) => boolean) {
    const slugs = Array.from(new Set(list.map((i) => i.slug)));
    const hunters = slugs.filter((p) => slugs.some((q) => q !== p && eats(p, q)));
    const top = new Set(hunters.filter((p) => !slugs.some((q) => q !== p && eats(q, p))));
    const tops = list.filter((i) => top.has(i.slug));
    // (Worked out once a kind, not once an animal: who threatens an animal depends only on its kind. The same lists.)
    const ofKind = new Map<string, ScheduleThreat[] | null>();
    for (const i of list) {
        let threats = ofKind.get(i.slug);
        if (threats === undefined) {
            const found = tops.filter((p) => p.slug !== i.slug && eats(p.slug, i.slug)).map((p) => ({animal: p.animal, profile: p.profile, activity: p.activity}));
            ofKind.set(i.slug, (threats = found.length ? found : null));
        }
        i.animal.threats = threats;
    }
}

/**
 * Its fixed roost (the map's: `scheduleRoost`) worked out the first time anything asks for it, not when its schedule is
 * made: the same spot, the cost (a den's search among the rocks) moved out of the mount to its first step, which the
 * scene spreads over frames. (Runtime's phone profile, 2026-11-11: 0.87 s of the mount at 3,137 animals.)
 */
export function withLazyRoost(animal: Omit<ScheduleAnimal, "roost">, find: () => Spot | null): ScheduleAnimal {
    let roost: Spot | null | undefined;
    Object.defineProperty(animal, "roost", {
        get: () => (roost === undefined ? (roost = find()) : roost),
        set: (value: Spot | null | undefined) => {
            roost = value;
        },
        enumerable: true,
        configurable: true
    });
    return animal as ScheduleAnimal;
}

/** The least a predator is kept from an animal it eats (or that eats it), beyond both their reaches: 20 m (owner's problem 6). */
export const SAFE_METRES = 20;
/**
 * The most the body-length part of a safe distance asks (m): six body lengths was for the old drawn sizes (a 3.5 m
 * whale, 21 m); at true size a 14 m humpback would need 84 m, more sea than the island has. Motion pass §3.
 */
export const SAFE_MOST = 40;

export type HomeInput = {id: string; slug: string; home: {x: number; z: number}; length: number; walkable: (x: number, z: number) => boolean};
export type SpacedHome = {home: {x: number; z: number}; range: number | null; prey: {x: number; z: number} | null};

/**
 * Predators' home ranges kept a safe distance from their prey's (visual only; the server decides every meal).
 * `reachOf(id)` is how far an animal (a leader with its group round it) can get from its home. A predator whose reach
 * comes within the safe distance (6 body lengths, at most `SAFE_MOST` and at least `SAFE_METRES`) of the reach of an animal it eats (or of one that
 * eats it) is moved to the nearest clear walkable spot, searching outward to 120 m; where none is clear, it goes to
 * the clearest spot found and both ranges shrink until they keep the distance. Biggest predators first. Returns the
 * moved homes and range caps (prey whose range shrank are in it too, with their own home).
 */
export function spaceHomes(animals: HomeInput[], eats: (predator: string, prey: string) => boolean, reachOf: (id: string) => number): Map<string, SpacedHome> {
    const job = spaceHomesTasks(animals, eats, reachOf);
    return new SlicedBuild(job.tasks, job.finish).run();
}

/**
 * `spaceHomes` as tasks, one predator each, biggest first (`behaviour-build.ts`: about 6 ms a frame), with the same
 * result to the last digit as the loop it replaced (2026-11-11, the backfill scale: 3,140 animals took 3.4 s on a
 * phone). The same rule, worked out more cheaply:
 * - who eats whom once per pair of kinds, and each animal's prey and enemies from an index by kind (was every pair
 *   of animals, for every animal: 5 million `eats` calls at 3,140 animals);
 * - a spot's clearance (its distance to the nearest enemy's reach) from a grid of the enemies' homes, nearest cells
 *   first, stopping where no further enemy can be nearer: the same minimum;
 * - a candidate spot's walkable test (the map's habitat, a ground sample each) only when the spot could change
 *   anything: better than the best so far, or clear.
 */
export function spaceHomesTasks(animals: HomeInput[], eats: (predator: string, prey: string) => boolean, reachOf: (id: string) => number): {tasks: BuildTask[]; finish: () => Map<string, SpacedHome>} {
    const out = new Map<string, SpacedHome>();
    const home = new Map(animals.map((a) => [a.id, {...a.home}]));
    const reach = new Map(animals.map((a) => [a.id, reachOf(a.id)]));
    const sorted = [...animals].sort((a, b) => b.length - a.length || a.id.localeCompare(b.id));
    // Each kind's animals in their given order (the order the old filters kept), and who eats whom by kind.
    const order = new Map(animals.map((a, i) => [a.id, i]));
    const byKind = new Map<string, HomeInput[]>();
    for (const a of animals) {
        const list = byKind.get(a.slug);
        if (list) list.push(a);
        else byKind.set(a.slug, [a]);
    }
    const kinds = Array.from(byKind.keys());
    // Each kind's prey kinds and enemy kinds (it eats them, or they eat it), worked out once per kind.
    const preyKindsOf = new Map<string, string[]>();
    const enemyKindsOf = new Map<string, string[]>();
    const preyKinds = (p: string) => {
        let list = preyKindsOf.get(p);
        if (!list) preyKindsOf.set(p, (list = kinds.filter((k) => eats(p, k))));
        return list;
    };
    const enemyKinds = (p: string) => {
        let list = enemyKindsOf.get(p);
        if (!list) {
            const prey = new Set(preyKinds(p));
            enemyKindsOf.set(p, (list = kinds.filter((k) => prey.has(k) || eats(k, p))));
        }
        return list;
    };
    const ofKinds = (list: string[], not: HomeInput) => {
        const found: HomeInput[] = [];
        for (const kind of list) for (const a of byKind.get(kind)!) if (a.id !== not.id) found.push(a);
        return found.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    };
    const GRID = 12;
    // Each predator a task that resumes (2026-11-11: a predator's whole search, 40 rings of 24 spots, each a habitat
    // test, was one 0.44 s task on the phone): its setup, then one ring of its search a call, then its ending. The same
    // steps in the same order as all at once.
    const tasks: BuildTask[] = sorted.map((predator) => {
        let resume: (() => boolean) | null = null;
        return () => {
            if (!resume) resume = predatorSearch(predator);
            return resume();
        };
    });
    function predatorSearch(predator: HomeInput): () => boolean {
        const itsPrey = preyKinds(predator.slug);
        if (!itsPrey.length) return () => true;
        const prey = ofKinds(itsPrey, predator);
        if (!prey.length) return () => true;
        const enemies = ofKinds(enemyKinds(predator.slug), predator);
        const safeTo = (other: HomeInput) => Math.max(SAFE_METRES, Math.min(Math.max(predator.length, other.length) * 6, SAFE_MOST));
        const need = (other: HomeInput) => safeTo(other) + reach.get(predator.id)! + reach.get(other.id)!;
        // The enemies' homes in a grid (as they are now: earlier predators may have moved), and the most any needs.
        // (Each enemy as numbers: its home and what it needs do not change during this predator's search.)
        const cells = new Map<number, number[]>();
        const cellKey = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096);
        let needMax = 0;
        let minI = Infinity;
        let maxI = -Infinity;
        let minJ = Infinity;
        let maxJ = -Infinity;
        for (const o of enemies) {
            const at = home.get(o.id)!;
            const i = Math.floor(at.x / GRID);
            const j = Math.floor(at.z / GRID);
            const key = cellKey(i, j);
            const needs = need(o);
            const list = cells.get(key);
            if (list) list.push(at.x, at.z, needs);
            else cells.set(key, [at.x, at.z, needs]);
            needMax = Math.max(needMax, needs);
            minI = Math.min(minI, i);
            maxI = Math.max(maxI, i);
            minJ = Math.min(minJ, j);
            maxJ = Math.max(maxJ, j);
        }
        /**
         * min over enemies of (distance to its home − what it needs), exactly: rings of cells outward till none can be
         * less. With `above`, it may stop at the first value at or below it (returning that value): the search only asks
         * whether a spot beats the best so far.
         */
        const clearance = (x: number, z: number, above = -Infinity) => {
            let least = Infinity;
            if (!enemies.length) return least;
            const ci = Math.floor(x / GRID);
            const cj = Math.floor(z / GRID);
            const last = Math.max(ci - minI, maxI - ci, cj - minJ, maxJ - cj);
            for (let r = 0; r <= last; r++) {
                if ((r === 0 ? 0 : (r - 1) * GRID) - needMax >= least) break;
                for (let di = -r; di <= r; di++) {
                    const ring = Math.abs(di) === r;
                    for (let dj = -r; dj <= r; dj += ring ? 1 : 2 * r) {
                        const list = cells.get(cellKey(ci + di, cj + dj));
                        if (!list) continue;
                        for (let n = 0; n < list.length; n += 3) {
                            const v = Math.hypot(list[n] - x, list[n + 1] - z) - list[n + 2];
                            if (v < least) {
                                least = v;
                                if (least <= above) return least;
                            }
                        }
                    }
                }
            }
            return least;
        };
        const start = home.get(predator.id)!;
        let best = {x: start.x, z: start.z, c: clearance(start.x, start.z)};
        let found = false;
        let d = 3;
        const mx = best.c < 0 ? prey.reduce((sum, p) => sum + home.get(p.id)!.x, 0) / prey.length : 0;
        const mz = best.c < 0 ? prey.reduce((sum, p) => sum + home.get(p.id)!.z, 0) / prey.length : 0;
        const away = Math.atan2(start.x - mx, start.z - mz);
        /** One ring of its search; true once the search is over. */
        const ring = (): boolean => {
            if (d > 120 || found) return true;
            for (let k = 0; k < 24 && !found; k++) {
                const a = away + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.27;
                const x = start.x + Math.sin(a) * d;
                const z = start.z + Math.cos(a) * d;
                // (Its walkable test only where it could matter: a spot no better than the best and not clear
                // changes nothing, walkable or not.)
                const c = clearance(x, z, best.c);
                if (c <= best.c && c < 0) continue;
                if (!predator.walkable(x, z)) continue;
                if (c > best.c) best = {x, z, c};
                if (c >= 0) found = true;
            }
            d += 3;
            return d > 120 || found;
        };
        const searched = best.c < 0;
        /** After the search (if it needed one): its home, the shrinking where nowhere was clear, and its result. */
        const ending = () => {
        if (searched) {
            home.set(predator.id, {x: best.x, z: best.z});
            if (!found) {
                // Nowhere clear: both ranges shrink until they keep the distance (half a metre at least).
                for (const other of enemies) {
                    const at = home.get(other.id)!;
                    const d = Math.hypot(at.x - best.x, at.z - best.z);
                    const free = d - safeTo(other);
                    const total = reach.get(predator.id)! + reach.get(other.id)!;
                    if (free >= total) continue;
                    const k = Math.max(free, 1) / total;
                    reach.set(predator.id, Math.max(reach.get(predator.id)! * k, 0.5));
                    reach.set(other.id, Math.max(reach.get(other.id)! * k, 0.5));
                    const prior = out.get(other.id);
                    out.set(other.id, {home: prior?.home ?? {...at}, range: reach.get(other.id)!, prey: prior?.prey ?? null});
                }
            }
        }
        const at = home.get(predator.id)!;
        const nearest = [...prey].sort((a, b) => Math.hypot(home.get(a.id)!.x - at.x, home.get(a.id)!.z - at.z) - Math.hypot(home.get(b.id)!.x - at.x, home.get(b.id)!.z - at.z))[0];
        const shrunk = reach.get(predator.id)! < reachOf(predator.id) - 1e-9;
        out.set(predator.id, {home: {...at}, range: shrunk ? reach.get(predator.id)! : out.get(predator.id)?.range ?? null, prey: {...home.get(nearest.id)!}});
        };
        return () => {
            if (searched && !ring()) return false;
            ending();
            return true;
        };
    }
    return {tasks, finish: () => out};
}

/** What the recipe engine may use of the schedule (passed in, so it imports no schedule code). */
const KIT: ScheduleKit = {
    placeNear,
    spotOf,
    groundSpot,
    rangeSpot,
    waterSpot,
    roostOf,
    tripAt: (world, profile, animal, epochSeconds, hoursAt, activity) => tripAt(world, profile, animal, epochSeconds, hoursAt, activity),
    basePose: basePoseOnTrip,
    flies,
    aquatic,
    floats
};
