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
