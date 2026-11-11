/**
 * The terrain the Ark map attaches to (B3/B4), as an interface: the map
 * never reads a mesh or a hard-coded position, only this. The graphics lane
 * (`ark-graphics`) owns the terrain and the scenery and provides the real
 * sampler; until it lands, `world-sampler.ts` is a stub over today's world
 * (`world.ts`, `decor.ts`, `micro-decor.ts`), so the switch is a merge.
 *
 * Three things:
 * - `ground(x, z)`: the height, the water, the zone, and the map tags
 *   (`tags.ts`) that hold at that point of the ground (grassland, a stream,
 *   the reef, a beach...). Animals that stand, swim or float use it.
 * - `anchors()`: named places of the scenery the map's rules point at (the
 *   cottage, the canopy trees, the anemone, the cleaning station, caves,
 *   floes...), each with the map tags it stands for.
 * - `attachPoints()`: where small animals sit (the owner, 2026-11-11): a
 *   position, the surface's normal, a heading along it, a microhabitat tag
 *   (leaf, branch, bark, flower head, rock face, tide pool, house wall,
 *   porch light, worm hole, burrow entrance; the eaves, upside down) and the
 *   body lengths it fits. The stub takes them from the graphics lane's
 *   scenery interface (`src/ark-scene/sampler.ts` attachPoints).
 */

import type {ArkZone} from "@/ark-scene/types";
import type {MapTag} from "@/ark-scene/map/tags";

/** The graphics lane's attach-point tags (owner, 2026-11-11). */
export const ATTACH_TAGS = ["leaf", "branch", "bark", "flower_head", "rock_face", "tide_pool", "house_wall", "house_eave", "porch_light", "worm_hole", "burrow_entrance"] as const;
export type AttachTag = typeof ATTACH_TAGS[number];

export type AttachPoint = {
    /** Stable for the same scenery (the map keys nothing on it; it is for reports and tests). */
    id: string;
    tag: AttachTag;
    x: number;
    y: number;
    z: number;
    /** The surface's normal (the way an animal's back faces), unit. */
    normal: [number, number, number];
    /** A heading along the surface (unit, square to the normal): the way it crawls. */
    tangent: [number, number, number];
    /** The body lengths (m) it fits. */
    size: {min: number; max: number};
    /** The zone it is in (for spreading a zone's animals over its own points). */
    zone: ArkZone;
};

export type GroundSurface = {
    /** The ground's (or the sea floor's) height. */
    height: number;
    /** Water over it: the sea, fresh (the lake, the river, pools), or none. */
    water: "sea" | "fresh" | null;
    /** How deep the water is (0 on dry ground). */
    depth: number;
    /** The zone it belongs to (the nearest land zone; the reef's or the ocean's at sea). */
    zone: ArkZone;
    /** The map tags that hold at this point of the ground. */
    tags: readonly MapTag[];
};

export type MapAnchor = {
    /** What it is: `canopy_tree`, `cottage`, `garden_pond`, `anemone`, `cleaning_station`, `cave`, `floe`, `termite_mound`, `dung_pat`, `log`, `waterfall`... */
    name: string;
    x: number;
    y: number;
    z: number;
    /** How far round it counts as being at it (m). */
    radius: number;
    zone: ArkZone;
    tags: readonly MapTag[];
};

export interface ArkMapSampler {
    /** Which terrain this is (a version, for caches and reports). */
    readonly id: string;
    /** The square of the world that holds anything: |x|, |z| ≤ half. */
    readonly half: number;
    ground(x: number, z: number): GroundSurface;
    /** Is a body of this radius (m) at (x, z) inside scenery (a trunk, a rock, a building)? */
    blocked(x: number, z: number, radius: number): boolean;
    /** Optional: something tall (a tree, a shrub, a big rock) stands just in front of this spot from the default camera (the south). */
    covered?(x: number, z: number): boolean;
    /** Optional: on the behaviour lane's walk grid here, no steeper than `maxSlope` (so a walker placed here can walk away from it). */
    walkable?(x: number, z: number, maxSlope: number): boolean;
    anchors(): readonly MapAnchor[];
    attachPoints(): readonly AttachPoint[];
}

/**
 * The map tags an attach point stands for, by its tag: its own (a house
 * wall is the house) and, for the ones low by the ground (a fallen leaf, a
 * flower head, a rock face, a worm hole, a burrow's entrance, a tide pool),
 * the ground's tags where it is among `context` (a flower in the meadow is
 * the meadow's, a burrow's entrance in the desert is the desert's).
 */
export const ATTACH_MEANS: Record<AttachTag, {own: readonly MapTag[]; context: readonly MapTag[]}> = {
    leaf: {own: ["leaves"], context: ["canopy", "scrub", "garden", "forest_floor", "marsh_reeds", "stream_river", "lake", "pond", "waterfall_rapids", "flower_meadow", "grassland", "farm_barn", "town_park", "bamboo", "mangrove", "logs_deadwood", "compost"]},
    branch: {own: ["canopy", "host_nests"], context: ["scrub", "garden", "mangrove", "bamboo", "town_park", "farm_barn"]},
    bark: {own: ["trunks_bark"], context: ["canopy", "logs_deadwood", "garden", "town_park", "farm_barn", "mangrove"]},
    flower_head: {own: ["flower_meadow"], context: ["garden", "grassland", "scrub", "town_park", "farm_barn", "mountain_alpine", "tundra", "marsh_reeds", "desert_sand"]},
    rock_face: {own: ["rocks_boulders"], context: ["cliffs", "sea_cliffs", "caves", "mountain_alpine", "desert_sand", "rocky_shore", "tundra", "snow_ice", "garden", "grassland", "scrub", "stream_river", "waterfall_rapids"]},
    tide_pool: {own: ["rocky_shore"], context: ["coastal_shallows", "seabed", "kelp", "sea_cliffs"]},
    house_wall: {own: ["house"], context: ["garden", "farm_barn", "town_park"]},
    /** Under the eaves and the porch roof: a ceiling, for clingers upside down (geckos, spiders). */
    house_eave: {own: ["house"], context: []},
    porch_light: {own: ["house"], context: []},
    worm_hole: {own: ["soil"], context: ["garden", "grassland", "forest_floor", "farm_barn", "compost", "flower_meadow", "town_park", "marsh_reeds", "scrub", "logs_deadwood"]},
    burrow_entrance: {own: ["burrows", "soil"], context: ["grassland", "desert_sand", "scrub", "forest_floor", "mountain_alpine", "tundra", "sandy_beach", "termite_ant_mounds", "garden", "farm_barn", "mudflat", "marsh_reeds", "stream_river", "lake", "rocks_boulders", "sea_cliffs"]}
};

/** The map tags a point stands for, given the ground's tags under it. */
export function attachPointTags(point: AttachPoint, groundTags: readonly MapTag[]): MapTag[] {
    const means = ATTACH_MEANS[point.tag];
    return [...means.own, ...means.context.filter((tag) => groundTags.includes(tag))];
}

/** Does the point fit a body this long (m)? */
export function attachFits(point: AttachPoint, length: number): boolean {
    return length >= point.size.min && length <= point.size.max;
}
