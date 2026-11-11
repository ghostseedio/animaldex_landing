/**
 * Which places are on something's surface (a trunk's bark, a branch, a rock's face or top, a wall, a post, a log, a
 * burrow's mouth): an animal there is on that thing, not passing through it (a rock's collider is its drawn box, its
 * face inside the box). The behaviour schedule's places (`world-sampler.ts` tags), the scenery's own ids
 * (`<scenery tag>:<host>:<n>`) and the map's roosts (`map:<id>`) all read the same way.
 */

/** Behaviour tags and scenery tags that are on a surface. */
const ON_SURFACE: ReadonlySet<string> = new Set([
    // behaviour's (world-sampler.ts ATTACH_TAGS)
    "leaf",
    "branch",
    "bark",
    "flower",
    "rock_face",
    "rock_top",
    "house_wall",
    "porch_light",
    "cliff_ledge",
    "cave_mouth",
    "tree_hollow",
    "post",
    "log_top",
    "canopy_hang",
    "burrow_entrance",
    "pond_surface",
    "tide_pool",
    // the scenery's (sampler.ts)
    "canopy_perch",
    "canopy_climb",
    "flower_head",
    "house_eave",
    "lamp",
    "ledge",
    "limb",
    "fence_post",
    "roof_edge",
    "log",
    "burrow",
    // the map's roosts (map/place.ts scheduleRoost): a canopy point, a burrow, a den's mouth
    "canopy",
    "den"
]);

/**
 * Whether a place (a Spot's `point` id) is on a surface. `tagOf` gives a behaviour place's tag from its id (the
 * sampler's points); scenery and map ids carry their tag at the front.
 */
export function onSurface(point: string | null | undefined, tagOf?: (id: string) => string | undefined): boolean {
    if (!point) return false;
    const id = point.startsWith("map:") ? point.slice(4) : point;
    const tag = tagOf?.(id) ?? id.split(":")[0];
    return ON_SURFACE.has(tag);
}

/** Places on a rock: the rocks touching such a place (within ROCK_TOUCH) are its surface too. */
const ROCKY: ReadonlySet<string> = new Set(["rock_face", "rock_top", "cliff_ledge", "ledge", "cave_mouth", "den", "rock_foot"]);
const ROCK_TOUCH = 0.6;
function tagOfPoint(point: string | null | undefined): string {
    if (!point) return "";
    return (point.startsWith("map:") ? point.slice(4) : point).split(":")[0];
}

/** How far from a climb's end the thing it climbs may be (m): a branch's trunk, a rock top's rock. */
export const CLIMBED = 1.6;

/** The scenery host a place is on (`decor12`, `fill3`: a tree, a rock), from its id (`<tag>:<host>:<n>`), or null. */
export function hostOf(point: string | null | undefined): string | null {
    if (!point) return null;
    const parts = (point.startsWith("map:") ? point.slice(4) : point).split(":");
    return parts.length >= 3 && /^(decor|fill)\d+$/.test(parts[1]) ? parts[1] : null;
}

/** The bit of a trip that holds it now: a leg's mode, or "stay" at its destination, "shadow" beside its leader. */
export function tripPhase(trip: {shadow?: unknown; arrive: number; start: number; legs: ReadonlyArray<{mode: string; seconds: number}>}, epoch: number): string {
    if (trip.shadow) return "shadow";
    if (epoch >= trip.arrive) return "stay";
    let t = epoch - trip.start;
    for (const leg of trip.legs) {
        if (t < leg.seconds) return leg.mode;
        t -= leg.seconds;
    }
    return trip.legs.length ? trip.legs[trip.legs.length - 1].mode : "stay";
}

type TripLike = {
    shadow?: unknown;
    arrive: number;
    start: number;
    from: {x: number; z: number; point: string | null};
    to: {x: number; z: number; point: string | null};
    legs: ReadonlyArray<{mode: string; seconds: number; from: {x: number; z: number; point: string | null}; to: {x: number; z: number; point: string | null}}>;
};

/**
 * The surface points a trip has it on now, or climbing between (`behaviour-schedule.ts` Trip): at a branch, a rock's
 * face, a burrow's mouth; on a climb's way up or down. Null when it is on open ground or in the air.
 */
export function attachedOn(trip: TripLike, epoch: number): Array<{x: number; z: number; r?: number; host?: string}> | null {
    const out: Array<{x: number; z: number; r?: number; host?: string}> = [];
    const on = (spot: {x: number; z: number; point: string | null}, r?: number) => {
        if (!onSurface(spot.point)) return;
        // (The whole of the tree or rock it is on: a bird on a branch beside its trunk. On a rock's face or top, the rocks
        // touching it too: a toad in the crevice between two, a lizard across two tops.)
        const host = hostOf(spot.point);
        const rocky = ROCKY.has(tagOfPoint(spot.point));
        const reach = Math.max(r ?? 0, rocky ? ROCK_TOUCH : 0);
        out.push({x: spot.x, z: spot.z, ...(reach ? {r: reach} : {}), ...(host ? {host} : {})});
    };
    const phase = tripPhase(trip, epoch);
    if (phase === "stay") on(trip.to);
    else if (phase === "surface" || phase === "pause") {
        on(trip.from);
        on(trip.to);
        // (On a climb, the thing it climbs is its surface the whole way: the trunk under a branch it goes up to, the rock
        // under a top it scrambles onto; within CLIMBED metres of where the climb ends or starts.)
        for (const leg of trip.legs) {
            if (leg.mode !== "surface") continue;
            on(leg.from, CLIMBED);
            on(leg.to, CLIMBED);
        }
    }
    // (Setting off from a surface: its first seconds.)
    if (epoch < trip.start + 3) on(trip.from);
    return out.length ? out : null;
}
