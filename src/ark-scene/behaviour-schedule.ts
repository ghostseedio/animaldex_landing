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

import {bodyLengthsPerSecond, type ArkBehaviour, type ArkBehaviourProfile, type ArkInteraction, type ArkRoost} from "@/ark-scene/behaviour-profile";
import {alongPath, MAX_SLOPE, MOUNTAIN_SLOPE, navGrid, navGridBuild, pathLength, type NavGrid, type NavPoint} from "@/ark-scene/behaviour-nav";
import {worldSampler, worldSamplerBuild, type ArkWorldSampler, type AttachPoint, type AttachTag} from "@/ark-scene/world-sampler";
import type {SlicedBuild} from "@/ark-scene/behaviour-build";
import {isAwake} from "@/lib/ark-daylight";
import {animalPersonality} from "@/lib/ark-clock";
import {hashString} from "@/ark-scene/world";
import type {ArkZone} from "@/ark-scene/types";

export const SLOT_SECONDS = 80;

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

export type Spot = {x: number; y: number; z: number; /** The surface's normal there (up on the ground). */ nx: number; ny: number; nz: number; point: string | null};

export type Leg = {
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
};

/** One beat of its time at its destination: from `at` seconds after it arrives, it does `beat` at (x, z) facing yaw (a step walks there). */
export type StayBeat = {at: number; beat: ArkBeat; x: number; z: number; yaw: number};

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

function pick(profile: ArkBehaviourProfile, hours: number, roll: number, bold: number, curious: number, avoid?: ArkBehaviour | null): ArkBehaviour {
    const entries = (Object.entries(profile.weights) as Array<[ArkBehaviour, number]>)
        .map(([b, w]) => [b, b === avoid ? hourly(profile, b, w, hours, bold, curious) * 0.25 : hourly(profile, b, w, hours, bold, curious)] as const)
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
    tree_hole: ["bark", "branch"],
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
    bask_rock: ["rock_top"],
    graze_grass: ["grass"],
    perch_branch: ["branch"],
    perch_rock: ["rock_top"],
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
    private sampler: SlicedBuild<ArkWorldSampler> | null = worldSamplerBuild();
    private nav: SlicedBuild<NavGrid> | null = null;
    private world: ScheduleWorld | null = null;
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
            if (nav) this.world = {sampler: worldSampler(), nav};
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

/** How far it can go in one slot at its own pace (ground, water; flyers go four times as fast). */
export function reachOf(profile: ArkBehaviourProfile, animal: ScheduleAnimal): number {
    const flyer = profile.move === "fly";
    return bodyLengthsPerSecond(profile) * Math.max(animal.length, 0.05) * (flyer ? 4 : profile.move === "swim" ? 1.4 : 1) * SLOT_SECONDS * 0.75;
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

function groundSpot(world: ScheduleWorld, x: number, z: number): Spot {
    return {x, y: Math.max(world.sampler.heightAt(x, z), 0), z, nx: 0, ny: 1, nz: 0, point: null};
}

const raised = (world: ScheduleWorld, p: Spot) => p.y > Math.max(world.sampler.heightAt(p.x, p.z), 0) + 0.4;
const wet = (world: ScheduleWorld, p: {x: number; z: number}) => world.sampler.heightAt(p.x, p.z) < 0;

/** A seeded attach point of these tags within reach of a centre (and suiting its size), or null. */
function placeNear(world: ScheduleWorld, centre: {x: number; z: number}, length: number, tags: AttachTag[], radius: number, roll: number): AttachPoint | null {
    for (const tag of tags) {
        const near = world.sampler.attachPoints(tag, {x: centre.x, z: centre.z, r: radius});
        const fits = near.filter((p) => length >= p.size[0] * 0.5 && length <= p.size[1] * 1.5);
        const list = fits.length ? fits : near;
        if (list.length) {
            // Nearer places a little more likely: sorted by distance, a seeded pick weighted to the front (each animal its own).
            const sorted = [...list].sort((a, b) => Math.hypot(a.x - centre.x, a.z - centre.z) - Math.hypot(b.x - centre.x, b.z - centre.z) || a.id.localeCompare(b.id));
            return sorted[Math.floor(roll ** 1.4 * sorted.length)];
        }
    }
    return null;
}

/** How steep it walks: a mountain animal takes the slopes. */
export function maxSlopeOf(animal: ScheduleAnimal): number {
    return animal.zone === "mountains" ? MOUNTAIN_SLOPE : MAX_SLOPE;
}

/** A point in the water near a spot, at the depth it swims at. */
function waterSpot(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, x: number, z: number, random: () => number): Spot {
    const water = world.nav.nearest(x, z, "swim", Math.max(animal.length * 0.6, 0.4)) ?? world.nav.nearest(x, z, "swim", 0.2, 20) ?? {x, z};
    const floor = world.sampler.heightAt(water.x, water.z);
    const y = floats(profile) || (!aquatic(profile) && !profile.breathes) ? 0 : profile.seabed ? floor : Math.max(floor + animal.length * 0.6, Math.min(-animal.length * 0.4 - random() * Math.max(-floor - animal.length, 0), -0.2));
    return {x: water.x, y: Math.min(y, 0), z: water.z, nx: 0, ny: 1, nz: 0, point: null};
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
export function roostOf(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal): Spot {
    const group = animal.group;
    if (group && !FLOCKING.has(profile.social)) {
        // The group sleeps together: round its leader's roost, each a little apart.
        const lead = roostOf(world, group.profile, group.leader);
        if (!lead.point || !raised(world, lead)) {
            const angle = group.rank * 2.39996;
            const d = Math.max(animal.length, group.leader.length) * (0.9 + 0.35 * Math.sqrt(group.rank));
            const x = lead.x + Math.cos(angle) * d;
            const z = lead.z + Math.sin(angle) * d;
            if (wet(world, lead)) return {...waterSpot(world, profile, animal, x, z, () => 0.5)};
            const land = world.nav.nearest(x, z, "walk", 0.5, 4, maxSlopeOf(animal)) ?? lead;
            return groundSpot(world, land.x, land.z);
        }
    }
    const seed = rng(hashString(`${animal.id}#roost`))();
    // A water animal (a fish, a crab) never roosts on a land place, whatever its profile says (a seal hauls out: it may).
    const tags = aquatic(profile) && !amphibious(profile) ? [] : ROOST_TAGS[profile.roost] ?? [];
    const point = tags.length ? placeNear(world, animal.home, animal.length, tags, Math.min(homeRadius(profile, animal) * 1.5, animal.range ?? Infinity), seed) : null;
    if (point) return spotOf(point);
    if (aquatic(profile) || profile.roost === "water" || profile.roost === "bottom" || profile.roost === "reef") {
        const water = world.nav.nearest(animal.home.x, animal.home.z, "swim", 0.4) ?? animal.home;
        const floor = world.sampler.heightAt(water.x, water.z);
        const y = profile.roost === "water" && floats(profile) ? 0 : profile.seabed || profile.roost === "bottom" ? floor : Math.min(floor + Math.max(-floor * 0.5, 0.4), -0.3);
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
    return poseOnTrip(world, tripAt(world, group.profile, group.leader, epoch, hoursAt, group.activity), epoch);
}

/** What its group's leader is set on at a moment (its intent: no route worked out). */
function leaderIntentAt(world: ScheduleWorld, group: ScheduleGroup, epoch: number, hoursAt: HoursAt): Intent {
    return intent(world, group.profile, group.leader, group.activity, slotOf(group.leader, epoch), hoursAt);
}

/** The group's middle for a member's slot: where its leader is halfway through it. */
function groupCentre(world: ScheduleWorld, animal: ScheduleAnimal, slot: number, hoursAt: HoursAt): {x: number; z: number} | null {
    const group = animal.group;
    if (!group) return null;
    const at = leaderAt(world, group, slotStart(animal, slot) + SLOT_SECONDS / 2, hoursAt);
    return {x: at.x, z: at.z};
}

// MARK: The slot

/** A slot's goal: what for, where (null: wherever the last slot left it), how it travels, and its time there. */
type Intent = {doing: ArkDoing; to: Spot | null; mode: TripMode; stay: Array<Omit<StayBeat, "x" | "z" | "yaw"> & {dx?: number; dz?: number; turn?: number}>; follow?: boolean; /** Its heading once there (a prey animal faces the predator it watches); else seeded. */ face?: number};

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
                add("bite", 3 + random() * 5);
                add("chew", 1.5 + random() * 2.5);
                if (random() < 0.28) add("scan", 2 + random() * 2.5, {turn: (random() - 0.5) * 1.6});
                if (random() < 0.55) add("step", 1.4, {dx: doing === "browse" ? 0.15 : 0.35 + random() * 0.45, dz: (random() - 0.5) * 0.4, turn: (random() - 0.5) * 0.9});
            }
            break;
        case "forage":
        case "visit_flowers":
            for (let n = 0; n < 16; n++) {
                add("peck", 1.5 + random() * 3);
                if (random() < 0.3) add("scan", 1.5 + random() * 2, {turn: (random() - 0.5) * 1.4});
                if (random() < 0.6) add("step", 1, {dx: 0.4 + random() * 0.8, dz: (random() - 0.5) * 0.8, turn: (random() - 0.5) * 1.4});
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
            for (let n = 0; n < 18; n++) add("play", 0.9 + random() * 0.8, {dx: 0.6 + random() * 0.9, dz: (random() - 0.5) * 1.4, turn: (random() - 0.5) * 2.4});
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
    const raw = rawIntent(world, profile, animal, activity, slot, hoursAt);
    if (raw.to || raw.follow) return raw;
    for (let back = 1; back <= 4; back++) {
        const earlier = rawIntent(world, profile, animal, activity, slot - back, hoursAt);
        if (earlier.to || earlier.follow) return raw;
    }
    const centre = groupCentre(world, animal, slot, hoursAt) ?? animal.home;
    const home = rangeSpot(world, profile, animal, centre, Math.min(homeRadius(profile, animal), 2), rng(hashString(`${animal.id}#home#${slot}`)));
    return {doing: STAY_DOINGS.has(raw.doing) && raw.doing !== "sleep" ? "wander" : raw.doing, to: home, mode: aquatic(profile) ? "water" : profile.move === "fly" ? "air" : "ground", stay: raw.stay};
}

function rawIntent(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Intent {
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
        if (watchTurn && !FLOCKING.has(profile.social) && !wasAwake) return {doing: "watch", to: roost, mode: "stay", stay: stayBeats("watch", random, null)};
        const travel: TripMode = aquatic(profile) ? "water" : flyer && raised(world, roost) ? "air" : profile.surface && roost.ny < 0.7 ? "surface" : "ground";
        return {doing: wasAwake ? "to_roost" : "sleep", to: roost, mode: wasAwake ? travel : "stay", stay: []};
    }
    // Air-breathers come up to breathe every few slots, then go back down.
    if (profile.breathes && profile.move === "swim" && (slot + hashString(animal.id)) % 3 === 0) {
        const near = world.nav.nearest(animal.home.x + (random() - 0.5) * 8, animal.home.z + (random() - 0.5) * 8, "swim", 0.6) ?? animal.home;
        return {doing: "breathe", to: {x: near.x, y: 0, z: near.z, nx: 0, ny: 1, nz: 0, point: null}, mode: "water", stay: []};
    }
    const personality = animalPersonality(animal.id);
    const centre = groupCentre(world, animal, slot, hoursAt) ?? animal.home;
    // A group member keeps within its group's spread of its leader (both capped where predator and prey were kept apart).
    const radius = group ? Math.min(homeRadius(profile, animal), groupSpread(animal.length, size), (group.leader.range ?? Infinity) / 2) : homeRadius(profile, animal);
    const groupAnimal: ScheduleAnimal = group ? {...animal, home: {x: centre.x, y: animal.home.y, z: centre.z}} : animal;
    // Shared wariness (visual only; flee-envelope.md §6.3.3): a predator it can see at its slot's start, awake, from the
    // predator's own schedule (the same for every viewer), sends it to the far side of its range to watch it. Near the
    // camera the local layer (`reactive.ts`) adds the look, the alarm and any dash on top. (Its own seeded stream: an
    // animal with no predator in sight chooses exactly as before.)
    const threat = threatAt(world, animal, start, hoursAt, centre);
    if (threat) {
        const wary = rng(hashString(`${animal.id}#wary#${slot}`));
        const away = {x: centre.x + ((centre.x - threat.x) / threat.d) * radius * 0.7, z: centre.z + ((centre.z - threat.z) / threat.d) * radius * 0.7};
        const spot = rangeSpot(world, profile, groupAnimal, away, Math.max(radius * 0.25, 0.5), wary);
        return {doing: "watch", to: spot, mode: aquatic(profile) ? "water" : profile.move === "fly" ? "air" : "ground", stay: stayBeats("watch", wary, null), face: Math.atan2(threat.x - spot.x, threat.z - spot.z)};
    }
    if (watchTurn) {
        // At the group's edge, facing out.
        const spot = rangeSpot(world, profile, groupAnimal, centre, radius * 0.9, random);
        return {doing: "watch", to: spot, mode: aquatic(profile) ? "water" : "ground", stay: stayBeats("watch", random, null)};
    }
    // A flocking species' member flies with its leader when its leader is in the air (most of the time, not always).
    // A school keeps together nearly always (a loose cluster round its leader).
    if (group && FLOCKING.has(profile.social) && (flyer || aquatic(profile)) && random() < (aquatic(profile) ? 0.9 : 0.75)) {
        const lead = leaderIntentAt(world, group, start + 1, hoursAt);
        if ((lead.mode === "air" || (aquatic(profile) && lead.mode === "water")) && lead.to) return {doing: lead.doing, to: null, mode: lead.mode, stay: [], follow: true};
    }
    // Young play near their group.
    if (animal.young && group && random() < 0.45) {
        return {doing: "play", to: rangeSpot(world, profile, groupAnimal, centre, Math.max(radius * 0.5, 1), random), mode: aquatic(profile) ? "water" : "ground", stay: stayBeats("play", random, null)};
    }
    // Its own choice; a group member is a little less likely to do just what its leader does now.
    const leaderDoing = group ? leaderIntentAt(world, group, start + 1, hoursAt).doing : null;
    let behaviour = pick(profile, hours, random(), personality.boldness, personality.curiosity, leaderDoing as ArkBehaviour | null);
    // A browser's grazing is at bushes and trees.
    let doing: ArkDoing = behaviour as ArkDoing;
    if ((behaviour === "graze" || behaviour === "forage") && (profile.diet === "browser" || profile.diet === "fruit") && walks(profile) && !flyer) doing = "browse";
    else if (behaviour === "graze" || (behaviour === "forage" && profile.diet === "grazer")) doing = "graze";
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
            const point = placeNear(world, centre, animal.length, tags, Math.min(far ? Math.min(45, reachOf(profile, animal) / 2, homeRadius(profile, animal) * 1.5) : radius * 1.4, cap), random());
            if (point) {
                const up = point.y > world.sampler.heightAt(point.x, point.z) + 0.5;
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
                    const stands = flyer && (point.tag === "cliff_ledge" || point.tag === "rock_top") ? world.sampler.heightAt(x, z) > 0.05 : world.nav.walkable(x, z, maxSlopeOf(animal));
                    if (stands && (point.tag !== "water_edge" || world.sampler.heightAt(x, z) > 0.02)) {
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
            const perch = roll < 0.5 ? placeNear(world, centre, animal.length, ["branch", "rock_top", "cliff_ledge"], radius, random()) : null;
            if (perch) return {doing: behaviour, to: spotOf(perch), mode: "air", stay: stayBeats("perch", random, null)};
            if (roll > 0.88 && floats(profile)) return {doing: behaviour, to: waterSpot(world, profile, animal, centre.x + (random() - 0.5) * radius, centre.z + (random() - 0.5) * radius, random), mode: "air", stay: stayBeats("rest", random, null)};
            return {doing: behaviour, to: rangeSpot(world, {...profile, move: "walk", seabed: false}, groupAnimal, centre, radius, random), mode: "air", stay: stayBeats("forage", random, null)};
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
                doing: profile.move === "swim" ? "swim" : behaviour === "wander" && profile.surface ? "crawl" : doing,
                to: rangeSpot(world, profile, groupAnimal, centre, radius, random),
                mode: aquatic(profile) ? "water" : flyer && profile.move === "fly" ? "air" : profile.surface ? "surface" : "ground",
                stay: stayBeats(doing, random, null)
            };
        default: {
            const stayDoing: ArkDoing = STAY_DOINGS.has(doing) ? doing : "rest";
            // A group member that rests keeps near its group (it walks to it first if it has drifted away).
            if (group) return {doing: stayDoing, to: rangeSpot(world, profile, groupAnimal, centre, radius * 0.6, random), mode: aquatic(profile) ? "water" : "ground", stay: stayBeats(stayDoing, random, null)};
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
        yaw += beat.turn ?? 0;
        if ((beat.dx || beat.dz) && onGround) {
            const l = Math.max(animal.length, 0.05);
            const nx = x + (Math.sin(yaw) * (beat.dx ?? 0) + Math.cos(yaw) * (beat.dz ?? 0)) * l;
            const nz = z + (Math.cos(yaw) * (beat.dx ?? 0) - Math.sin(yaw) * (beat.dz ?? 0)) * l;
            // Only onto ground it can walk, and never out of its range (a stalker stops at the edge).
            const within = Math.hypot(nx - animal.home.x, nz - animal.home.z) <= Math.max(homeRadius(profile, animal) * 1.6, 2);
            if (world.nav.walkable(nx, nz, maxSlopeOf(animal)) && within) {
                x = nx;
                z = nz;
            }
        }
        out.push({at: beat.at, beat: beat.beat, x, z, yaw});
    }
    const y = onGround ? Math.max(world.sampler.heightAt(x, z), 0) + (at.y - Math.max(world.sampler.heightAt(at.x, at.z), 0)) : at.y;
    return {beats: out, finish: {...at, x, y: onGround ? y : at.y, z}};
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
    const a = random() * Math.PI * 2;
    const d = (0.8 + random() * 2.2) * Math.max(animal.length, 0.3) * (1 + 0.35 * Math.sqrt(group.rank));
    const dx = Math.cos(a) * d;
    const dz = Math.sin(a) * d;
    const dy = (random() - 0.5) * Math.max(animal.length, 0.3) * (aquatic(group.profile) ? 2.4 : 1.6);
    const at = poseOnTrip(world, trips[trips.length - 1], end);
    const fx = at.x + dx;
    const fz = at.z + dz;
    let finish: Spot;
    if (at.aloft) finish = {x: fx, y: at.y + dy, z: fz, nx: 0, ny: 1, nz: 0, point: null};
    else if (at.y < 0 || wet(world, {x: fx, z: fz})) finish = {x: fx, y: Math.min(Math.max(at.y + dy, world.sampler.heightAt(fx, fz) + 0.2), at.y >= -0.01 ? 0 : -0.15), z: fz, nx: 0, ny: 1, nz: 0, point: null};
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
function settle(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, slot: number, now: Intent): {beats: StayBeat[]; finish: Spot} | null {
    if (!now.to) return null;
    const yaw = now.face ?? rng(hashString(`${animal.id}#yaw#${slot}`))() * Math.PI * 2;
    return placeStay(world, profile, animal, now.to, yaw, now.stay, Infinity);
}

/** Where a slot ends, worked out the same way by every caller (from its intent alone: never from the route there). */
function finishOf(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt, depth = 0): Spot {
    const i = intent(world, profile, animal, activity, slot, hoursAt);
    if (i.follow && animal.group) return shadowOf(world, animal, slot, hoursAt).finish;
    const settled = settle(world, profile, animal, slot, i);
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

// MARK: Memo

/**
 * Intents and trips, remembered per world, clock and animal for the last few dozen slots: a group's members, its
 * leader's flock and a predator's spacing all ask for the same leader's slot many times. Pure results, so this
 * changes nothing but the time taken. `forgetSchedules` after an animal's home, group or range changes.
 */
type Memo = {intents: Map<number, Intent>; trips: Map<number, Trip>};
let memos = new WeakMap<ScheduleWorld, WeakMap<HoursAt, WeakMap<ScheduleAnimal, Memo>>>();
function memoOf(world: ScheduleWorld, hoursAt: HoursAt, animal: ScheduleAnimal): Memo {
    let byClock = memos.get(world);
    if (!byClock) memos.set(world, (byClock = new WeakMap()));
    let byAnimal = byClock.get(hoursAt);
    if (!byAnimal) byClock.set(hoursAt, (byAnimal = new WeakMap()));
    let memo = byAnimal.get(animal);
    if (!memo) byAnimal.set(animal, (memo = {intents: new Map(), trips: new Map()}));
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
}

function tripFor(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt, now: Intent, knownFrom: Spot | null): Trip {
    const start = slotStart(animal, slot);
    const end = start + SLOT_SECONDS;
    const from = knownFrom ?? finishOf(world, profile, animal, activity, slot - 1, hoursAt);
    const random = rng(hashString(`${animal.id}#route#${slot}`));
    const cruise = profile.altitude ? CRUISE[profile.altitude] : 0;
    const base = {slot, doing: now.doing, start, end, from, cruise, shadow: null as Trip["shadow"]};

    // A flock member with its leader in the air: catch up, then fly at its side (its own place in the flock, new each slot).
    if (now.follow && animal.group) {
        const shadow = shadowOf(world, animal, slot, hoursAt);
        const finish = shadow.finish;
        const catchUp = 6;
        const joinAt = poseOnTrip(world, shadow.trips[0], start + catchUp);
        const joined = shadowPoint(world, joinAt, shadow, start + catchUp, 0);
        const join: Spot = {x: joined.x, y: joined.y, z: joined.z, nx: 0, ny: 1, nz: 0, point: null};
        const legs: Leg[] = [
            now.mode === "water"
                ? {mode: "water", from, to: join, path: [from, join], length: Math.hypot(join.x - from.x, join.z - from.z), seconds: catchUp, beat: "swim"}
                : {mode: "air", from, to: join, path: [from, join], length: Math.hypot(join.x - from.x, join.z - from.z), seconds: catchUp, beat: "fly", cruise: Math.max(cruise * 0.5, 1)},
            {mode: "shadow", from: join, to: finish, path: null, length: 0, seconds: SLOT_SECONDS - catchUp, beat: "fly"}
        ];
        return {...base, mode: now.mode === "water" ? "water" : "air", arrive: end, to: finish, finish, path: null, legs, stay: [], length: 0, running: false, shadow: {trips: shadow.trips, dx: shadow.dx, dy: shadow.dy, dz: shadow.dz}};
    }

    const to = now.to ?? from;
    let mode = now.mode;
    if (!now.to || (Math.hypot(to.x - from.x, to.z - from.z) < 0.05 && Math.abs(to.y - from.y) < 0.05)) mode = "stay";
    // Up off the ground at either end (a branch, a wall, a rock top): a flyer flies it, anything else climbs it.
    if ((mode === "ground" || mode === "water") && (raised(world, from) || raised(world, to))) mode = flies(profile) ? "air" : "surface";
    // A bird walks a few steps; further than that it flies.
    if (mode === "ground" && flies(profile) && Math.hypot(to.x - from.x, to.z - from.z) > Math.max(3, animal.length * 6)) mode = "air";

    const pace = bodyLengthsPerSecond(profile) * Math.max(animal.length, 0.05);
    const speed = pace * (0.8 + 0.4 * random());
    const legs: Leg[] = [];
    const ground = (a: Spot, b: Spot, beat: ArkBeat = "walk") => {
        const path = world.nav.path(a, b, "walk", 0.5, 900, maxSlopeOf(animal));
        const last = path[path.length - 1];
        if (Math.hypot(last.x - b.x, last.z - b.z) > 0.01) path.push({x: b.x, z: b.z});
        // A varied route: now and then a pause on the way.
        const length = Math.max(pathLength(path), Math.abs(b.y - a.y));
        if (length > 3 && random() < 0.3 && path.length >= 2) {
            const mid = alongPath(path, 0.4 + random() * 0.2);
            const midSpot = groundSpot(world, mid.x, mid.z);
            const firstPath = world.nav.path(a, midSpot, "walk", 0.5, 400, maxSlopeOf(animal));
            // Each half ends where it is going even when the grid can't reach it (from the water, say): it used to stop
            // short and take no time at all, and the animal jumped to the pause.
            if (Math.hypot(firstPath[firstPath.length - 1].x - midSpot.x, firstPath[firstPath.length - 1].z - midSpot.z) > 0.01) firstPath.push({x: midSpot.x, z: midSpot.z});
            const secondPath = world.nav.path(midSpot, b, "walk", 0.5, 400, maxSlopeOf(animal));
            if (Math.hypot(secondPath[secondPath.length - 1].x - b.x, secondPath[secondPath.length - 1].z - b.z) > 0.01) secondPath.push({x: b.x, z: b.z});
            const l1 = pathLength(firstPath);
            const l2 = Math.max(pathLength(secondPath), 0.01);
            legs.push({mode: "ground", from: a, to: midSpot, path: firstPath, length: l1, seconds: l1 / speed, beat});
            legs.push({mode: "pause", from: midSpot, to: midSpot, path: null, length: 0, seconds: 2 + random() * 4, beat: random() < 0.6 ? "scan" : "pause"});
            legs.push({mode: "ground", from: midSpot, to: b, path: secondPath, length: l2, seconds: l2 / speed, beat});
        } else legs.push({mode: "ground", from: a, to: b, path, length, seconds: length / speed, beat});
    };
    const water = (a: Spot, b: Spot) => {
        const path = world.nav.path(a, b, "swim", 0.3);
        const last = path[path.length - 1];
        if (Math.hypot(last.x - b.x, last.z - b.z) > 0.01) path.push({x: b.x, z: b.z});
        const length = pathLength(path) + Math.abs(b.y - a.y);
        legs.push({mode: "water", from: a, to: b, path, length, seconds: length / (speed * 1.4), beat: "swim"});
    };
    /** The water's edge to cross at: the drinking and shore points nearest a spot. */
    const edgeNear = (p: Spot): Spot | null => {
        const near = world.sampler.attachPoints("water_edge", {x: p.x, z: p.z, r: Math.max(homeRadius(profile, animal) * 2, 12)});
        if (!near.length) return null;
        const best = [...near].sort((m, n) => Math.hypot(m.x - p.x, m.z - p.z) - Math.hypot(n.x - p.x, n.z - p.z) || m.id.localeCompare(n.id))[0];
        return spotOf(best);
    };
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
                    if (toWet) {
                        ground(from, edge);
                        legs.push({mode: "enter", from: edge, to: offshore, path: [edge, offshore], length: Math.hypot(offshore.x - edge.x, offshore.z - edge.z), seconds: 2.2, beat: "enter_water"});
                        water(offshore, to);
                    } else {
                        water(from, offshore);
                        legs.push({mode: "exit", from: offshore, to: edge, path: [offshore, edge], length: Math.hypot(offshore.x - edge.x, offshore.z - edge.z), seconds: 2.4, beat: "exit_water"});
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
            const air = speed * 4;
            if (now.doing === "soar") {
                // Wide, irregular arcs: through three seeded points high over its range, then down to its perch or the ground.
                const route: NavPoint[] = [from];
                const centre = {x: (from.x + to.x) / 2, z: (from.z + to.z) / 2};
                const r = Math.max(homeRadius(profile, animal) * 0.8, 6);
                let a = random() * Math.PI * 2;
                for (let k = 0; k < 3; k++) {
                    a += (0.8 + random() * 1.4) * (random() < 0.5 ? -1 : 1);
                    route.push({x: centre.x + Math.cos(a) * r * (0.5 + random() * 0.6), z: centre.z + Math.sin(a) * r * (0.5 + random() * 0.6)});
                }
                route.push(to);
                const length = pathLength(route) + Math.abs(to.y - from.y);
                legs.push({mode: "air", from, to, path: route, length, seconds: Math.max(length / (air * 0.8), SLOT_SECONDS * 0.55), beat: "glide", cruise: cruise * 1.2});
            } else {
                // Its own line: bowed to one side by a seeded amount.
                const side = (random() - 0.5) * 0.7 * flat;
                const mid = {x: (from.x + to.x) / 2 + ((to.z - from.z) / (flat || 1)) * side, z: (from.z + to.z) / 2 - ((to.x - from.x) / (flat || 1)) * side};
                const route = [from, mid, to];
                const length = pathLength(route) + Math.abs(to.y - from.y);
                legs.push({mode: "air", from, to, path: route, length, seconds: length / air, beat: "fly", cruise: flat < 4 ? Math.min(cruise, flat * 0.5 + 0.5) : cruise});
            }
            break;
        }
        case "surface": {
            const length = Math.hypot(to.x - from.x, to.z - from.z) + Math.abs(to.y - from.y);
            legs.push({mode: "surface", from, to, path: [from, to], length, seconds: length / (speed * 0.6), beat: "climb"});
            break;
        }
        default:
            break;
    }
    // Fitted into the slot: a long way is a run; never more than four fifths of the slot on the way.
    let travel = legs.reduce((sum, leg) => sum + leg.seconds, 0);
    const running = mode === "ground" && travel > SLOT_SECONDS * 0.45;
    if (running) for (const leg of legs) if (leg.mode === "ground") {
        leg.seconds /= 2.2;
        leg.beat = "run";
    }
    travel = legs.reduce((sum, leg) => sum + leg.seconds, 0);
    if (travel > SLOT_SECONDS * 0.8) for (const leg of legs) leg.seconds *= (SLOT_SECONDS * 0.8) / travel;
    travel = Math.min(travel, SLOT_SECONDS * 0.8);
    const settled = settle(world, profile, animal, slot, {...now, to}) ?? {beats: [], finish: to};
    // Its beats fitted into the time left (all of them, so it ends where `finishOf` says); a shake first after a swim.
    const left = SLOT_SECONDS - travel;
    // The last beat starts at least 3 s before the slot ends, so a last step is finished by then.
    const room = Math.max(left - (after ? 2.6 : 0) - 3, 0);
    const lastAt = settled.beats.length ? settled.beats[settled.beats.length - 1].at : 0;
    const squeeze = lastAt > room && lastAt > 0 ? room / lastAt : 1;
    let beats = settled.beats.map((b) => ({...b, at: b.at * squeeze + (after ? 2.6 : 0)}));
    if (after) beats = [{at: 0, beat: after, x: to.x, z: to.z, yaw: settled.beats[0]?.yaw ?? 0}, ...beats];
    const stay = {beats, finish: now.to ? settled.finish : from};
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

/** Which way the water is from an edge point (its own heading faces the water). */
function edgeYaw(world: ScheduleWorld, edge: Spot): number {
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        if (world.sampler.heightAt(edge.x + Math.sin(a) * 1.5, edge.z + Math.cos(a) * 1.5) < 0) return a;
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
    const breathe = 1 + ease * (0.18 * Math.sin(epochSeconds * 0.35 + phase) + 0.08 * Math.sin(epochSeconds * 0.9 + phase * 2));
    const inWater = at.y < -0.01;
    const y = at.aloft || inWater ? at.y + shadow.dy * (1 + ease * 0.25 * Math.sin(epochSeconds * 0.5 + phase)) : at.y;
    const x = at.x + shadow.dx * breathe;
    const z = at.z + shadow.dz * breathe;
    const floor = world.sampler.heightAt(x, z);
    const ground = at.aloft ? -Infinity : inWater ? floor + 0.2 : Math.max(floor, 0);
    const ceiling = inWater ? -0.1 : Infinity;
    return {x, y: Math.min(Math.max(y, ground), ceiling), z, yaw: at.yaw + ease * 0.12 * Math.sin(epochSeconds * 0.4 + phase)};
}

function legPose(world: ScheduleWorld, leg: Leg, u: number, trip: Trip, epochSeconds: number): TripPose {
    const {from, to} = leg;
    const moving = u < 1;
    const up = {nx: 0, ny: 1, nz: 0};
    switch (leg.mode) {
        case "ground":
        case "water": {
            const at = alongPath(leg.path ?? [from, to], u);
            const ground = world.sampler.heightAt(at.x, at.z);
            const level = (p: Spot) => {
                const h = world.sampler.heightAt(p.x, p.z);
                return h > 0 ? p.y - h : 0;
            };
            const base = ground > 0 ? ground : Math.max(Math.min(from.y + (to.y - from.y) * u, 0), ground);
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
            const ground = Math.max(world.sampler.heightAt(at.x, at.z), 0);
            // Take off, climb to its band, cruise, and come down to land (gliding in on long legs).
            const rise = Math.min(u / 0.18, 1);
            const fall = Math.min((1 - u) / 0.22, 1);
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
            const at = poseOnTrip(world, lead, Math.min(epochSeconds, lead.end - 0.001));
            if (u >= 1) return {x: to.x, y: to.y, z: to.z, yaw: at.yaw, moving: false, aloft: at.aloft, ...up, beat: at.beat};
            const p = shadowPoint(world, at, shadow, epochSeconds, Math.min(u / 0.08, 1));
            // Blend into its own finish over the last seconds, so the next slot starts where this one ends.
            const blend = Math.max((u - 0.92) / 0.08, 0);
            return {x: p.x + (to.x - p.x) * blend, y: p.y + (to.y - p.y) * blend, z: p.z + (to.z - p.z) * blend, yaw: p.yaw, moving: at.moving, aloft: at.aloft, ...up, beat: at.beat};
        }
        case "pause":
        default:
            return {x: from.x, y: from.y, z: from.z, yaw: Math.atan2(to.x - from.x, to.z - from.z) || 0, moving: false, aloft: false, ...up, beat: leg.beat};
    }
}

/** Where an animal on a trip is at a world time (its foot point), which way it faces, and its beat. */
export function poseOnTrip(world: ScheduleWorld, trip: Trip, epochSeconds: number): TripPose {
    const into = epochSeconds - trip.start;
    if (into < trip.arrive - trip.start) {
        let t = Math.max(into, 0);
        for (const leg of trip.legs) {
            if (t < leg.seconds || leg === trip.legs[trip.legs.length - 1]) return legPose(world, leg, leg.seconds > 0 ? Math.min(t / leg.seconds, 1) : 1, trip, epochSeconds);
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
    const startYaw = lastPose ? lastPose.yaw : stay[0]?.yaw ?? 0;
    const up = {nx: to.nx, ny: to.ny, nz: to.nz};
    if (!stay.length) return {x: to.x, y: to.y, z: to.z, yaw: startYaw, moving: false, aloft: false, ...up, beat: trip.doing === "sleep" || trip.doing === "to_roost" ? "sleep" : "rest"};
    let i = 0;
    while (i + 1 < stay.length && stay[i + 1].at <= since) i++;
    const beat = stay[i];
    const before = i > 0 ? stay[i - 1] : {x: to.x, z: to.z, yaw: startYaw};
    const stepSeconds = beat.beat === "play" ? 0.8 : beat.beat === "stalk" ? 2.5 : 1.2;
    const u = Math.min(Math.max((since - beat.at) / stepSeconds, 0), 1);
    const x = before.x + (beat.x - before.x) * u;
    const z = before.z + (beat.z - before.z) * u;
    const onGround = Math.abs(to.y - Math.max(world.sampler.heightAt(to.x, to.z), 0)) < 0.05 && !(to.y < 0);
    const y = onGround && (x !== to.x || z !== to.z) ? Math.max(world.sampler.heightAt(x, z), 0) : to.y;
    let dyaw = beat.yaw - before.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const moving = u < 1 && (beat.x !== before.x || beat.z !== before.z);
    return {x, y: i === stay.length - 1 && u >= 1 ? trip.finish.y : y, z, yaw: before.yaw + dyaw * Math.min(u * 1.5, 1), moving, aloft: false, ...up, beat: beat.beat};
}

/** In the air for the whole of a behaviour, not just its trip (none now: flights are goals, they land). */
export function airborneDoing(doing: ArkDoing): boolean {
    return doing === "fly" || doing === "soar";
}

// MARK: Predators and prey

/** How far a prey animal notices a predator in the shared layer (about the reactive layer's sight for a walking hunter by day). */
export const WARY_METRES = 35;

/**
 * The nearest of its predators it can see at a moment (awake, within `WARY_METRES` of where it is about), or null.
 * Pure: the predator's own schedule, which never depends on its prey's.
 */
export function threatAt(world: ScheduleWorld, animal: ScheduleAnimal, epochSeconds: number, hoursAt: HoursAt, near: {x: number; z: number} = animal.home): {x: number; z: number; d: number} | null {
    if (!animal.threats?.length) return null;
    let best: {x: number; z: number; d: number} | null = null;
    for (const threat of animal.threats) {
        const trip = tripAt(world, threat.profile, threat.animal, epochSeconds, hoursAt, threat.activity);
        if (trip.doing === "sleep" || trip.doing === "to_roost") continue;
        const at = poseOnTrip(world, trip, epochSeconds);
        const d = Math.hypot(at.x - near.x, at.z - near.z);
        if (d < WARY_METRES && d > 0.01 && (!best || d < best.d)) best = {x: at.x, z: at.z, d};
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
    for (const i of list) {
        const threats = tops.filter((p) => p !== i && p.slug !== i.slug && eats(p.slug, i.slug)).map((p) => ({animal: p.animal, profile: p.profile, activity: p.activity}));
        i.animal.threats = threats.length ? threats : null;
    }
}

/** The least a predator is kept from an animal it eats (or that eats it), beyond both their reaches: 20 m (owner's problem 6). */
export const SAFE_METRES = 20;

export type HomeInput = {id: string; slug: string; home: {x: number; z: number}; length: number; walkable: (x: number, z: number) => boolean};
export type SpacedHome = {home: {x: number; z: number}; range: number | null; prey: {x: number; z: number} | null};

/**
 * Predators' home ranges kept a safe distance from their prey's (visual only; the server decides every meal).
 * `reachOf(id)` is how far an animal (a leader with its group round it) can get from its home. A predator whose reach
 * comes within the safe distance (6 body lengths, at least `SAFE_METRES`) of the reach of an animal it eats (or of one that
 * eats it) is moved to the nearest clear walkable spot, searching outward to 120 m; where none is clear, it goes to
 * the clearest spot found and both ranges shrink until they keep the distance. Biggest predators first. Returns the
 * moved homes and range caps (prey whose range shrank are in it too, with their own home).
 */
export function spaceHomes(animals: HomeInput[], eats: (predator: string, prey: string) => boolean, reachOf: (id: string) => number): Map<string, SpacedHome> {
    const out = new Map<string, SpacedHome>();
    const home = new Map(animals.map((a) => [a.id, {...a.home}]));
    const reach = new Map(animals.map((a) => [a.id, reachOf(a.id)]));
    const sorted = [...animals].sort((a, b) => b.length - a.length || a.id.localeCompare(b.id));
    for (const predator of sorted) {
        const prey = animals.filter((other) => other.id !== predator.id && eats(predator.slug, other.slug));
        if (!prey.length) continue;
        const enemies = animals.filter((other) => other.id !== predator.id && (eats(predator.slug, other.slug) || eats(other.slug, predator.slug)));
        const safeTo = (other: HomeInput) => Math.max(SAFE_METRES, Math.max(predator.length, other.length) * 6);
        const need = (other: HomeInput) => safeTo(other) + reach.get(predator.id)! + reach.get(other.id)!;
        const clearance = (x: number, z: number) => Math.min(...enemies.map((o) => Math.hypot(home.get(o.id)!.x - x, home.get(o.id)!.z - z) - need(o)));
        const start = home.get(predator.id)!;
        let best = {x: start.x, z: start.z, c: clearance(start.x, start.z)};
        if (best.c < 0) {
            const mx = prey.reduce((s, p) => s + home.get(p.id)!.x, 0) / prey.length;
            const mz = prey.reduce((s, p) => s + home.get(p.id)!.z, 0) / prey.length;
            const away = Math.atan2(start.x - mx, start.z - mz);
            let found = false;
            for (let d = 3; d <= 120 && !found; d += 3) {
                for (let k = 0; k < 24 && !found; k++) {
                    const a = away + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.27;
                    const x = start.x + Math.sin(a) * d;
                    const z = start.z + Math.cos(a) * d;
                    if (!predator.walkable(x, z)) continue;
                    const c = clearance(x, z);
                    if (c > best.c) best = {x, z, c};
                    if (c >= 0) found = true;
                }
            }
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
    }
    return out;
}
