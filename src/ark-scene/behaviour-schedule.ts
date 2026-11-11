/**
 * The NPC-style behaviour schedule (visual only): what an animal is doing at
 * any moment, and where, as a pure function of the time and its id.
 *
 * - Time is cut into slots of `SLOT_SECONDS` of world time (epoch seconds, the
 *   same for every viewer and the livestream). Each slot is one trip: the
 *   animal goes from where the last slot left it to this slot's target, then
 *   does the slot's behaviour there.
 * - Asleep slots (its activity against the hour, the same rule the tap card
 *   uses) are spent at its roost. The first asleep slot is a visible trip to
 *   the roost ("to_roost": fly to the tree, walk to the den); the first awake
 *   slot leaves it.
 * - An awake slot's behaviour is a seeded choice from its profile's weights
 *   (`behaviour-profile.ts`), shaped by the hour: busiest at dawn and dusk
 *   for crepuscular animals and the two-peak ones, resting in the midday heat,
 *   basking in the morning sun, moths to the light at night.
 * - Targets are the world's attach points and terrain (`world-sampler.ts`),
 *   paths the navigation grid's (`behaviour-nav.ts`).
 *
 * No per-viewer randomness: the seed is the animal's id and the slot.
 * Nothing here decides anything in the Ark (the server does that).
 */

import {bodyLengthsPerSecond, type ArkBehaviour, type ArkBehaviourProfile, type ArkInteraction, type ArkRoost} from "@/ark-scene/behaviour-profile";
import {alongPath, MAX_SLOPE, MOUNTAIN_SLOPE, navGrid, pathLength, type NavGrid, type NavPoint} from "@/ark-scene/behaviour-nav";
import type {ArkWorldSampler, AttachPoint, AttachTag} from "@/ark-scene/world-sampler";
import {isAwake} from "@/lib/ark-daylight";
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

/** What it is doing (one state, which the animation, the tap card and follow all read). */
export type ArkDoing =
    | "sleep"
    | "to_roost"
    | "rest"
    | "wander"
    | "forage"
    | "graze"
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
    | "idle";

/** How it travels this trip: on the ground (the walk grid), through the air, through the water, along a surface, or not at all. */
export type TripMode = "ground" | "air" | "water" | "surface" | "stay";

export type Spot = {x: number; y: number; z: number; /** The surface's normal there (up on the ground). */ nx: number; ny: number; nz: number; point: string | null};

export type Trip = {
    slot: number;
    doing: ArkDoing;
    mode: TripMode;
    /** World seconds: the trip's start, when it arrives, when the slot ends. */
    start: number;
    arrive: number;
    end: number;
    from: Spot;
    to: Spot;
    /** The ground or water path (x, z), for ground and water trips. */
    path: NavPoint[] | null;
    length: number;
    /** Flyers: the height band's cruising height above the ground (m). */
    cruise: number;
    /** Running rather than walking (a long way to go in the slot). */
    running: boolean;
};

export type ScheduleAnimal = {
    id: string;
    zone: ArkZone;
    /** Its home: where the server placed it (its spot), the middle of its home area. */
    home: {x: number; y: number; z: number};
    /** Drawn length (m). */
    length: number;
    /** Lives in the sea (its swimming is in the sea's water volume). */
    sea: boolean;
};

/** The hour (0–24) at a world time: the viewer's clock, or a pinned hour. */
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

/** The behaviour's pull at this hour (the profile's weight shaped by the day). */
function hourly(profile: ArkBehaviourProfile, behaviour: ArkBehaviour, weight: number, hours: number): number {
    const dawn = Math.exp(-(((hours - 6.5) / 1.5) ** 2));
    const dusk = Math.exp(-(((hours - 18.5) / 1.5) ** 2));
    const midday = Math.exp(-(((hours - 13) / 2) ** 2));
    const morning = Math.exp(-(((hours - 9) / 1.8) ** 2));
    const night = hours < 5 || hours > 20 ? 1 : 0;
    const busy = profile.activity === "crepuscular" || profile.twoPeaks ? 1 + 1.5 * (dawn + dusk) - (profile.siesta || profile.twoPeaks ? 0.7 * midday : 0) : 1;
    switch (behaviour) {
        case "rest":
        case "groom":
            return weight * (profile.siesta ? 1 + 2.5 * midday : 1) * (busy > 1 ? 0.6 : 1);
        case "forage":
        case "graze":
        case "visit_flowers":
        case "stalk":
            return weight * busy;
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

function pick(profile: ArkBehaviourProfile, hours: number, roll: number): ArkBehaviour {
    const entries = (Object.entries(profile.weights) as Array<[ArkBehaviour, number]>).map(([b, w]) => [b, hourly(profile, b, w, hours)] as const).filter(([, w]) => w > 0);
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
    open: []
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
    water_surface: ["pond_surface"]
};

/** Which places each behaviour goes to (the first of its interactions that has one near home). */
const BEHAVIOUR_PLACES: Partial<Record<ArkBehaviour, ArkInteraction[]>> = {
    drink: ["drink_edge"],
    bask: ["bask_rock"],
    graze: ["graze_grass"],
    forage: ["leaf_litter", "dig_soil", "graze_grass", "tide_pool", "flower", "bark", "wall", "water_surface"],
    perch: ["perch_branch", "perch_rock", "cliff_ledge"],
    climb: ["perch_branch", "bark"],
    burrow: ["burrow_mouth", "dig_soil"],
    hide: ["shade", "burrow_mouth", "reeds"],
    visit_flowers: ["flower"],
    circle_light: ["porch_light"],
    rest: ["shade"]
};

export type ScheduleWorld = {sampler: ArkWorldSampler; nav: NavGrid};
export function scheduleWorld(sampler: ArkWorldSampler): ScheduleWorld {
    return {sampler, nav: navGrid(sampler)};
}

/** How far it can go in one slot at its own pace (ground, water; flyers go four times as fast). */
export function reachOf(profile: ArkBehaviourProfile, animal: ScheduleAnimal): number {
    const flyer = profile.move === "fly";
    return bodyLengthsPerSecond(profile) * Math.max(animal.length, 0.05) * (flyer ? 4 : profile.move === "swim" ? 1.4 : 1) * SLOT_SECONDS * 0.75;
}

/**
 * Its home area's radius: by how it moves and its size, and never more than half what it can cover in a slot, so
 * any trip inside its home area is finished in its slot at its own pace (no rushing, no sliding feet).
 */
function homeRadius(profile: ArkBehaviourProfile, animal: ScheduleAnimal): number {
    const flyer = profile.move === "fly";
    const base = flyer ? 18 : profile.move === "swim" ? 14 : 6;
    const wanted = Math.min(Math.max(base + animal.length * 5, 3), flyer ? 40 : 26);
    return Math.max(Math.min(wanted, reachOf(profile, animal) / 2), 0.4);
}

function spotOf(point: AttachPoint): Spot {
    return {x: point.x, y: point.y, z: point.z, nx: point.nx, ny: point.ny, nz: point.nz, point: point.id};
}

function groundSpot(world: ScheduleWorld, x: number, z: number): Spot {
    return {x, y: Math.max(world.sampler.heightAt(x, z), 0), z, nx: 0, ny: 1, nz: 0, point: null};
}

/** A seeded attach point of these tags within reach of home (and suiting its size), or null. */
function placeNear(world: ScheduleWorld, animal: ScheduleAnimal, tags: AttachTag[], radius: number, roll: number, sizeOk = true): AttachPoint | null {
    for (const tag of tags) {
        const near = world.sampler.attachPoints(tag, {x: animal.home.x, z: animal.home.z, r: radius});
        const fits = sizeOk ? near.filter((p) => animal.length >= p.size[0] * 0.5 && animal.length <= p.size[1] * 1.5) : near;
        const list = fits.length ? fits : near;
        if (list.length) {
            // Nearer places a little more likely: sort by distance, then a seeded pick weighted to the front.
            const sorted = [...list].sort((a, b) => Math.hypot(a.x - animal.home.x, a.z - animal.home.z) - Math.hypot(b.x - animal.home.x, b.z - animal.home.z) || a.id.localeCompare(b.id));
            return sorted[Math.floor(roll * roll * sorted.length)];
        }
    }
    return null;
}

/** Its roost: the same place every night (seeded by its id), from its profile's roost kind. */
export function roostOf(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal): Spot {
    const seed = rng(hashString(`${animal.id}#roost`))();
    const tags = ROOST_TAGS[profile.roost] ?? [];
    const point = tags.length ? placeNear(world, animal, tags, homeRadius(profile, animal) * 1.5, seed) : null;
    if (point) return spotOf(point);
    // In the water (a swimmer's, or a duck's), on the sea floor, or at home.
    if (aquatic(profile) || profile.roost === "water" || profile.roost === "bottom" || profile.roost === "reef") {
        const water = world.nav.nearest(animal.home.x, animal.home.z, "swim", 0.4) ?? animal.home;
        const floor = world.sampler.heightAt(water.x, water.z);
        const y = profile.roost === "water" && floats(profile) ? 0 : profile.seabed || profile.roost === "bottom" ? floor : Math.min(floor + Math.max(-floor * 0.5, 0.4), -0.3);
        return {x: water.x, y, z: water.z, nx: 0, ny: 1, nz: 0, point: null};
    }
    return {...animal.home, nx: 0, ny: 1, nz: 0, point: null};
}

/** Lives in the water: a swimmer, or a seabed walker (crabs, lobsters, stars) whose ground is the sea floor. */
export function aquatic(profile: ArkBehaviourProfile): boolean {
    return profile.move === "swim" || profile.seabed;
}

/** A swimmer that floats on the surface (a duck, a swan) rather than swimming down in the water. */
export function floats(profile: ArkBehaviourProfile): boolean {
    return profile.move === "swim" ? profile.moves.includes("fly") && !profile.breathes : profile.roost === "water";
}

/** A point to wander to within the home area: walkable (or in the water for a swimmer). */
function wanderSpot(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, random: () => number): Spot {
    const r = homeRadius(profile, animal) * Math.sqrt(random());
    const a = random() * Math.PI * 2;
    const x = animal.home.x + Math.cos(a) * r;
    const z = animal.home.z + Math.sin(a) * r;
    if (aquatic(profile)) {
        const water = world.nav.nearest(x, z, "swim", Math.max(animal.length * 0.6, 0.4)) ?? animal.home;
        const floor = world.sampler.heightAt(water.x, water.z);
        const y = floats(profile) ? 0 : profile.seabed ? floor : Math.max(floor + animal.length * 0.6, Math.min(-animal.length * 0.4 - random() * Math.max(-floor - animal.length, 0), -0.2));
        return {x: water.x, y, z: water.z, nx: 0, ny: 1, nz: 0, point: null};
    }
    const land = world.nav.nearest(x, z, "walk", 0.5, 12, maxSlopeOf(animal)) ?? animal.home;
    return groundSpot(world, land.x, land.z);
}

/** How steep it walks: a mountain animal takes the slopes. */
export function maxSlopeOf(animal: ScheduleAnimal): number {
    return animal.zone === "mountains" ? MOUNTAIN_SLOPE : MAX_SLOPE;
}

// MARK: The slot

const STAY: ReadonlySet<ArkDoing> = new Set<ArkDoing>(["rest", "groom", "idle", "sleep"]);

type Intent = {doing: ArkDoing; to: Spot | null; mode: TripMode};

/**
 * What a slot is for, and where (null: wherever the last slot left it). Pure in (id, slot, the hour). After four
 * slots in a row of staying put, the fifth goes back home: so where a slot ends never depends on more than the
 * four slots before it, and every caller works it out the same way.
 */
function intent(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Intent {
    const raw = rawIntent(world, profile, animal, activity, slot, hoursAt);
    if (raw.to) return raw;
    for (let back = 1; back <= 4; back++) if (rawIntent(world, profile, animal, activity, slot - back, hoursAt).to) return raw;
    const home = profile.move === "swim" ? wanderSpot(world, profile, {...animal}, () => 0) : groundSpot(world, animal.home.x, animal.home.z);
    return {doing: raw.doing === "rest" || raw.doing === "groom" ? "wander" : raw.doing, to: home, mode: aquatic(profile) ? "water" : profile.move === "fly" ? "air" : "ground"};
}

function rawIntent(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt): Intent {
    const start = slotStart(animal, slot);
    const hours = hoursAt(start);
    const awake = awakeAt(profile, activity, hours);
    const wasAwake = awakeAt(profile, activity, hoursAt(start - SLOT_SECONDS));
    const flyer = profile.move === "fly" || profile.moves.includes("fly");
    if (profile.move === "sessile") return {doing: awake ? "idle" : "sleep", to: {...animal.home, nx: 0, ny: 1, nz: 0, point: null}, mode: "stay"};
    if (!awake) {
        const roost = roostOf(world, profile, animal);
        const travel: TripMode = aquatic(profile) ? "water" : flyer && roost.y > world.sampler.heightAt(roost.x, roost.z) + 0.5 ? "air" : profile.surface ? "surface" : "ground";
        return {doing: wasAwake ? "to_roost" : "sleep", to: roost, mode: wasAwake ? travel : "stay"};
    }
    const random = rng(hashString(`${animal.id}#${slot}`));
    // Air-breathers come up to breathe every few slots, then go back down.
    if (profile.breathes && profile.move === "swim" && (slot + hashString(animal.id)) % 3 === 0) {
        const near = world.nav.nearest(animal.home.x + (random() - 0.5) * 8, animal.home.z + (random() - 0.5) * 8, "swim", 0.6) ?? animal.home;
        return {doing: "breathe", to: {x: near.x, y: 0, z: near.z, nx: 0, ny: 1, nz: 0, point: null}, mode: "water"};
    }
    const behaviour = pick(profile, hours, random());
    const places = BEHAVIOUR_PLACES[behaviour];
    const radius = homeRadius(profile, animal);
    if (places) {
        for (const place of places) {
            if (!profile.interactions.includes(place) && behaviour !== "rest") continue;
            const tags = INTERACTION_TAGS[place] ?? [];
            const point = placeNear(world, animal, tags, place === "drink_edge" || place === "porch_light" ? Math.min(45, reachOf(profile, animal) / 2) : radius * 1.4, random());
            if (point) {
                const up = point.y > world.sampler.heightAt(point.x, point.z) + 0.5;
                const mode: TripMode = profile.surface && point.ny < 0.7 ? "surface" : flyer && (up || behaviour === "visit_flowers" || behaviour === "circle_light") ? "air" : aquatic(profile) ? "water" : "ground";
                return {doing: behaviour as ArkDoing, to: spotOf(point), mode};
            }
        }
    }
    switch (behaviour) {
        case "fly":
        case "soar":
            return {doing: behaviour, to: wanderSpot(world, {...profile, move: "walk"}, animal, random), mode: "air"};
        case "swim":
        case "dive":
            if (profile.move === "swim" || profile.moves.includes("swim")) {
                const water = wanderSpot(world, {...profile, move: "swim"}, animal, random);
                return {doing: profile.move === "swim" ? "swim" : behaviour, to: water, mode: "water"};
            }
            return {doing: "rest", to: null, mode: "stay"};
        case "wander":
        case "forage":
        case "graze":
        case "stalk":
            return {doing: profile.move === "swim" ? "swim" : behaviour === "stalk" ? "forage" : behaviour === "wander" && profile.surface ? "crawl" : (behaviour as ArkDoing), to: wanderSpot(world, profile, animal, random), mode: aquatic(profile) ? "water" : flyer && profile.move === "fly" ? "air" : profile.surface ? "surface" : "ground"};
        default:
            return {doing: STAY.has(behaviour as ArkDoing) ? (behaviour as ArkDoing) : "rest", to: null, mode: "stay"};
    }
}

/** Where a slot ends: its target, or (staying put) where the slot before ended, back at most a few slots (else home). */
function endOf(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkBehaviourProfile["activity"] | null | undefined, slot: number, hoursAt: HoursAt, depth = 0): Spot {
    const i = intent(world, profile, animal, activity, slot, hoursAt);
    if (i.to || depth >= 6) return i.to ?? {...animal.home, nx: 0, ny: 1, nz: 0, point: null};
    return endOf(world, profile, animal, activity, slot - 1, hoursAt, depth + 1);
}

const CRUISE: Record<"low" | "mid" | "high", number> = {low: 1.6, mid: 6, high: 14};

/** The trip an animal is on at a world time (pure: the same for every viewer). */
export function tripAt(world: ScheduleWorld, profile: ArkBehaviourProfile, animal: ScheduleAnimal, epochSeconds: number, hoursAt: HoursAt, activity?: ArkBehaviourProfile["activity"] | null, previous?: Trip | null): Trip {
    const slot = Math.floor((epochSeconds + slotOffset(animal.id)) / SLOT_SECONDS);
    const start = slotStart(animal, slot);
    const end = start + SLOT_SECONDS;
    const now = intent(world, profile, animal, activity, slot, hoursAt);
    // Where the last slot ended (the last trip's own target, when the caller still has it: the same answer, cheaper).
    const from = previous && previous.slot === slot - 1 ? previous.to : endOf(world, profile, animal, activity, slot - 1, hoursAt);
    const to = now.to ?? from;
    let path: NavPoint[] | null = null;
    let mode = now.mode;
    if (!now.to || (Math.hypot(to.x - from.x, to.z - from.z) < 0.05 && Math.abs(to.y - from.y) < 0.05)) mode = "stay";
    // Up off the ground at either end (a branch, a wall, a rock top): a flyer flies it, anything else climbs it.
    const raised = (p: Spot) => p.y > Math.max(world.sampler.heightAt(p.x, p.z), 0) + 0.4;
    if ((mode === "ground" || mode === "water") && (raised(from) || raised(to))) mode = profile.move === "fly" || profile.moves.includes("fly") ? "air" : "surface";
    // A bird walks a few steps; further than that it flies.
    if (mode === "ground" && (profile.move === "fly" || profile.moves.includes("fly")) && Math.hypot(to.x - from.x, to.z - from.z) > Math.max(3, animal.length * 6)) mode = "air";
    const amphibious = profile.move === "swim" || profile.moves.includes("swim");
    const wet = (p: Spot) => world.sampler.heightAt(p.x, p.z) < 0;
    // An amphibious animal between land and water goes straight (out of the pond, down the bank).
    if (mode === "ground" && amphibious && (wet(from) || wet(to))) path = [from, to];
    else if (mode === "ground") path = world.nav.path(from, to, "walk", 0.5, 900, maxSlopeOf(animal));
    else if (mode === "water") path = world.nav.path(from, to, "swim", 0.3);
    // Where the grid can't reach its target (it starts or ends off the grid), the last stretch is straight.
    if (path) {
        const last = path[path.length - 1];
        if (Math.hypot(last.x - to.x, last.z - to.z) > 0.01) path = [...path, {x: to.x, z: to.z}];
    }
    const flat = path ? pathLength(path) : Math.hypot(to.x - from.x, to.z - from.z);
    const length = mode === "ground" ? Math.max(flat, Math.abs(to.y - from.y)) : flat + Math.abs(to.y - from.y);
    // Its own pace (body lengths a second from its speed stat); a flyer goes faster; a long way in the slot is a run.
    const pace = bodyLengthsPerSecond(profile) * Math.max(animal.length, 0.05) * (mode === "air" ? 4 : mode === "water" ? 1.4 : 1);
    let travel = length / Math.max(pace, 0.02);
    const running = mode === "ground" && travel > SLOT_SECONDS * 0.45;
    if (running) travel /= 2.2;
    travel = Math.min(travel, SLOT_SECONDS * 0.8);
    const cruise = profile.altitude ? CRUISE[profile.altitude] : 0;
    return {slot, doing: now.doing, mode, start, arrive: start + (mode === "stay" ? 0 : travel), end, from, to, path, length, cruise, running};
}

export type TripPose = {x: number; y: number; z: number; yaw: number; /** Moving now (walking, flying, swimming). */ moving: boolean; /** In the air now. */ aloft: boolean; nx: number; ny: number; nz: number};

/** Where an animal on a trip is at a world time (its middle's foot point), and which way it faces. */
export function poseOnTrip(world: ScheduleWorld, trip: Trip, epochSeconds: number): TripPose {
    const {from, to} = trip;
    const travel = trip.arrive - trip.start;
    const u = travel > 0 ? Math.min(Math.max((epochSeconds - trip.start) / travel, 0), 1) : 1;
    const moving = u < 1 && trip.mode !== "stay";
    const yawTo = Math.atan2(to.x - from.x, to.z - from.z);
    switch (trip.mode) {
        case "ground":
        case "water": {
            const at = alongPath(trip.path ?? [from, to], u);
            const ground = world.sampler.heightAt(at.x, at.z);
            // Ground: on it. Water: at the depth it is heading for, under the surface and above the floor (on land on the way, on the land).
            const base = ground > 0 ? ground : Math.max(Math.min(from.y + (to.y - from.y) * u, 0), ground);
            // An end a little off the terrain (a step onto a log, a point the scenery puts higher) is eased in, not snapped.
            const level = (p: Spot) => {
                const h = world.sampler.heightAt(p.x, p.z);
                return h > 0 ? p.y - h : 0;
            };
            const y = base + level(from) * (1 - u) + level(to) * u;
            // An air-breather on its way up rises to the surface at the end; on its way down, back to its depth.
            return {x: at.x, y, z: at.z, yaw: moving ? at.yaw : yawTo, moving, aloft: false, nx: 0, ny: 1, nz: 0};
        }
        case "air": {
            if (airborneDoing(trip.doing)) return circling(world, trip, epochSeconds);
            // Take off, climb to the band's height, cruise, and come down to land at the target (a perch, the ground or the water).
            const k = u;
            const x = from.x + (to.x - from.x) * k;
            const z = from.z + (to.z - from.z) * k;
            const base = from.y + (to.y - from.y) * k;
            const ground = Math.max(world.sampler.heightAt(x, z), 0);
            const climb = Math.sin(Math.PI * k);
            // From or into the water (a puffin, a gannet), the ends may be under the surface.
            const floor = Math.min(ground, base);
            const y = Math.max(base + (trip.cruise + Math.max(ground - base, 0)) * climb, floor + 0.05 * climb);
            return {x, y, z, yaw: yawTo, moving, aloft: moving && climb > 0.05, nx: 0, ny: 1, nz: 0};
        }
        case "surface": {
            const x = from.x + (to.x - from.x) * u;
            const z = from.z + (to.z - from.z) * u;
            const y = from.y + (to.y - from.y) * u;
            const nx = from.nx + (to.nx - from.nx) * u;
            const ny = from.ny + (to.ny - from.ny) * u;
            const nz = from.nz + (to.nz - from.nz) * u;
            const n = Math.hypot(nx, ny, nz) || 1;
            return {x, y, z, yaw: yawTo, moving, aloft: false, nx: nx / n, ny: ny / n, nz: nz / n};
        }
        default:
            return {x: to.x, y: to.y, z: to.z, yaw: Math.atan2(to.x - from.x, to.z - from.z) || 0, moving: false, aloft: false, nx: to.nx, ny: to.ny, nz: to.nz};
    }
}

/**
 * Flying or soaring for the slot: take off from where it was, circle (wide and high when soaring) over the
 * middle of the way, and come down to land at the target as the slot ends.
 */
function circling(world: ScheduleWorld, trip: Trip, epochSeconds: number): TripPose {
    const {from, to} = trip;
    const span = trip.end - trip.start;
    const u = Math.min(Math.max((epochSeconds - trip.start) / span, 0), 1);
    const cx = (from.x + to.x) / 2;
    const cz = (from.z + to.z) / 2;
    const radius = trip.doing === "soar" ? 9 : 5;
    const height = Math.max(world.sampler.heightAt(cx, cz), 0) + trip.cruise * (trip.doing === "soar" ? 1.2 : 1);
    const turns = trip.doing === "soar" ? 1.2 : 2;
    const angle = u * turns * Math.PI * 2 + (trip.slot % 7);
    const ring = {x: cx + Math.cos(angle) * radius, z: cz + Math.sin(angle) * radius};
    const tangent = Math.atan2(-Math.sin(angle), Math.cos(angle));
    const up = Math.min(u / 0.12, 1);
    const down = Math.min((1 - u) / 0.12, 1);
    const k = Math.min(up, down);
    const ends = u < 0.5 ? from : to;
    const ease = k * k * (3 - 2 * k);
    const x = ends.x + (ring.x - ends.x) * ease;
    const z = ends.z + (ring.z - ends.z) * ease;
    const y = ends.y + (height - ends.y) * ease;
    return {x, y, z, yaw: ease > 0.5 ? tangent : Math.atan2(ring.x - ends.x, ring.z - ends.z), moving: u < 1, aloft: ease > 0.05, nx: 0, ny: 1, nz: 0};
}

/** In the air for the whole of a behaviour (circling, soaring), not just its trip. */
export function airborneDoing(doing: ArkDoing): boolean {
    return doing === "fly" || doing === "soar";
}
