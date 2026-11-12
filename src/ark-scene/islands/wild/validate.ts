/**
 * The wild island's spawn validator (the owner's brief, Part C: "re-run the spawn validator"). Every catalogue species
 * of the wild island's zones is placed on the new island the way the Ark places it, on the map's own lists over the
 * wild island's sampler (`sites.ts` wildMapPoints), at its own cluster's slot and at the highest slot its zone reaches
 * at a year (the islands plan's counts, §2.1), and fails when its spot:
 *
 * - is off the island's square or has no room (no cell, range, whale cell or attach point of any of its tags);
 * - is in the wrong medium (a swimmer on dry ground, a walker in the water) or the wrong water (sea or fresh; the
 *   estuary's tags are brackish: either);
 * - is outside its tag's depth band (the reef, the shallows, the deep);
 * - is on a surface none of its tags allows;
 * - stands inside scenery (a trunk, a rock, a mound);
 * - is too steep for a walker (behaviour's walk grid: `MAX_SLOPE`, a mountain animal's `MOUNTAIN_SLOPE`);
 * - is on reserved room it does not own: a smaller animal inside a big animal's range, a swimmer under 6 m in a
 *   whale's water (decisions 53, 54);
 * - (big land animals, ≥ 2.5 m) is not on one of its zone's ranges, or the range is not open, gentle ground;
 * - (whales, ≥ 6 m) is not on a whale cell 15 m deep or more;
 * - (small animals sitting on the scenery) has no attach point of its tags that fits its length;
 * - sleeps where its roost tag does not hold within its reach.
 *
 * Pure: the same island gives the same report. `src/lib/ark-wild-island.test.ts` runs it.
 */

import {mapSlugs, mapSpecies, mapSpeciesStored, trueMicro, type MapSpecies} from "@/ark-scene/map/species";
import {FRESH_TAGS, SEA_TAGS, type MapTag} from "@/ark-scene/map/tags";
import {MAX_SLOPE, MOUNTAIN_SLOPE} from "@/ark-scene/behaviour-nav";
import {arkBody} from "@/ark-scene/stats";
import type {ArkZone} from "@/ark-scene/types";
import type {SpawnPoint} from "@/ark-scene/map/points";
import {wildMapSampler} from "@/ark-scene/islands/wild/map-sampler";
import {WILD_PLAN_COUNTS, wildMapPoints} from "@/ark-scene/islands/wild/sites";
import {BIG_LAND_LENGTH, inRange, nearWhale, rangesOf, WHALE_DEPTH, WHALE_LENGTH, whaleCells} from "@/ark-scene/islands/wild/reserves";
import {gridSlope} from "@/ark-scene/islands/wild/terrain-cache";
import {WILD_ZONES} from "@/ark-scene/islands/wild/biomes";
import {WILD_HALF} from "@/ark-scene/islands/wild/frame";

export const WILD_CHECKS = ["no_room", "off_island", "wrong_medium", "wrong_water", "wrong_depth_band", "invalid_surface", "inside_scenery", "off_walk_grid", "reserved_room", "big_not_on_range", "whale_not_in_deep", "small_not_on_attach_point", "roost_invalid"] as const;
export type WildCheck = typeof WILD_CHECKS[number];
export type WildFailure = {slug: string; zone: ArkZone; check: WildCheck; detail: string; slot: number};

/** The depth bands (m) a sea tag's swimmers keep to (`map/validate.ts`'s, the same numbers). */
const DEPTH_BANDS: Partial<Record<MapTag, [number, number]>> = {
    coral_reef: [0.5, 7], cleaner_station: [0.5, 7], anemone: [0.5, 7], seagrass: [0.3, 3.6],
    coastal_shallows: [0.3, 5.2], seabed: [0.6, 10], kelp: [2, 9], open_ocean: [3, 999], attached_to_large: [3, 999],
    sea_surface: [2.5, 999], deep_water: [7.5, 999]
};
const BRACKISH = new Set<MapTag>(["estuary", "mangrove", "salt_lake", "mudflat"]);
/** A swimmer's own water (tags whose animals live in the water's column, not on its shore). */
const WATER_MOVES = new Set(["swim", "drift", "fixed"]);
const WALKS = new Set(["walk", "crawl", "hop", "burrow", "slither"]);

export type WildPlacement = {
    slug: string;
    zone: ArkZone;
    slot: number;
    /** Where it stands (after the settle). */
    x: number;
    z: number;
    how: "cell" | "range" | "whale" | "attach" | "fallback";
    tag: MapTag | null;
    own: boolean;
    /** Its list's cell (the tag holds there), and how far the settle moved it from its lap (m). */
    cellX: number;
    cellZ: number;
    settled: number;
};

function lengthOf(slug: string): number {
    return arkBody({model_slug: slug}).metres;
}

/** Fresh water's own tags (a fish or a swimmer of these lives in the water; a frog or a heron on their shore). */
const FRESH_WATER_TAGS = new Set<MapTag>(["pond", "stream_river", "lake", "waterfall_rapids", "garden_pond"]);
/** The canopy's tags (a climber, a hanger or a percher of these takes a tree's limb or branch, `map/place.ts`). */
const CANOPY_TAGS = new Set<MapTag>(["canopy", "trunks_bark", "leaves", "host_nests", "bamboo"]);

/** Lives in the water (the sea's column or its floor, a lake's or a river's water), not on the shore beside it. */
export function aquatic(species: MapSpecies): boolean {
    const tag = species.spawn;
    if (tag === "sea_ice") return false;
    if (SEA_TAGS.has(tag)) return true;
    if (FRESH_WATER_TAGS.has(tag)) return species.fish || WATER_MOVES.has(species.move);
    if (BRACKISH.has(tag)) return species.fish || species.move === "swim";
    return species.fish;
}

/** The catalogue species of the wild island's zones (the map table's stored zone), not held. */
export function wildSpecies(): Array<{slug: string; zone: ArkZone; species: MapSpecies; length: number}> {
    const out: Array<{slug: string; zone: ArkZone; species: MapSpecies; length: number}> = [];
    for (const slug of mapSlugs()) {
        const stored = mapSpeciesStored(slug);
        if (!stored || !WILD_ZONES.includes(stored.zone)) continue;
        const species = mapSpecies(slug, stored.zone);
        if (!species) continue;
        out.push({slug, zone: stored.zone, species, length: lengthOf(slug)});
    }
    return out;
}

/** The highest cluster slot a zone reaches at a year (every animal its own cluster: the most slots it can need). */
export function yearSlots(zone: ArkZone): number {
    return Math.max(WILD_PLAN_COUNTS[zone]?.year ?? 0, 1);
}

const filtered = new Map<SpawnPoint[], SpawnPoint[]>();
/** A list without the whales' water (for every swimmer under 6 m). */
function withoutWhaleWater(list: SpawnPoint[]): SpawnPoint[] {
    let out = filtered.get(list);
    if (!out) {
        out = list.filter((p) => !(p.water === "sea" && nearWhale(p.x, p.z, 2.5)));
        filtered.set(list, out);
    }
    return out;
}

/**
 * A range's or a whale cell's laps (more big clusters than spots): the first on the spot, the next ones round it,
 * `radius` m out on a golden-angle turn, inside the clear disc, so two clusters never share a spot.
 */
export function lapAround(x: number, z: number, lap: number, radius: number): {x: number; z: number} {
    if (lap <= 0) return {x, z};
    const a = lap * 2.399963;
    const r = radius * Math.min(1, 0.6 + 0.1 * lap);
    return {x: x + Math.cos(a) * r, z: z + Math.sin(a) * r};
}

/** A rock climber (behaviour's mountain slope): a species of the mountains, cliffs, sea cliffs, boulders or the snow. */
function climber(species: MapSpecies): boolean {
    return ["mountain_alpine", "cliffs", "sea_cliffs", "rocks_boulders", "snow_ice"].some((tag) => species.allowed.has(tag as MapTag));
}

/** The zone's own fallback tag (`map/species.ts` for a species with no text), for a species none of whose tags this island has. */
const ZONE_FALLBACK: Partial<Record<ArkZone, MapTag>> = {
    coral_reef: "coral_reef", open_ocean: "open_ocean", seashore: "sandy_beach", river_lake: "lake", wetland: "marsh_reeds", rainforest: "forest_floor",
    woodland: "forest_floor", grassland: "grassland", desert: "desert_sand", mountains: "mountain_alpine", polar: "tundra"
};

/** A spot's problems for a body of this kind (the medium, the water, scenery, the slope, reserved room). */
function spotOk(x: number, z: number, wet: boolean, sea: boolean | null, walker: boolean, steep: number, radius: number, big: boolean, whale: boolean): boolean {
    const sampler = wildMapSampler();
    const g = sampler.ground(x, z);
    if (Math.abs(x) > WILD_HALF || Math.abs(z) > WILD_HALF) return false;
    if (wet) {
        if (!g.water || (sea !== null && (g.water === "sea") !== sea)) return false;
        if (!whale && g.water === "sea" && nearWhale(x, z)) return false;
        return true;
    }
    if (g.water && g.depth > 0.3) return false;
    if (sampler.blocked(x, z, radius)) return false;
    if (walker && gridSlope(x, z) > steep) return false;
    if (!big && inRange(x, z)) return false;
    return true;
}

/**
 * The settle (as the scene's placement settles a spot): the nearest free spot within 2.5 m of a cluster's lap, on a
 * fixed spiral, for the body's medium, its size, its slope and the reserved room; null when there is none.
 */
function settle(x: number, z: number, wet: boolean, sea: boolean | null, walker: boolean, steep: number, radius: number): {x: number; z: number; d: number} | null {
    if (spotOk(x, z, wet, sea, walker, steep, radius, false, false)) return {x, z, d: 0};
    for (let k = 1; k <= 40; k++) {
        const d = 2.5 * Math.sqrt(k / 40);
        const a = k * 2.399963;
        const px = x + Math.cos(a) * d;
        const pz = z + Math.sin(a) * d;
        if (spotOk(px, pz, wet, sea, walker, steep, radius, false, false)) return {x: px, z: pz, d};
    }
    return null;
}

/** Where a species' cluster at `slot` stands on the wild island (the Ark's rules: `map/place.ts`, on the wild sampler). */
export function placeWild(slug: string, zone: ArkZone, species: MapSpecies, length: number, slot: number): WildPlacement | null {
    const mp = wildMapPoints();
    const wet = aquatic(species);
    const base = {slug, zone, slot};
    if (wet && length >= WHALE_LENGTH && SEA_TAGS.has(species.spawn)) {
        const cells = whaleCells();
        if (!cells.length) return null;
        const c = cells[slot % cells.length];
        const at = lapAround(c.x, c.z, Math.floor(slot / cells.length), 8);
        return {...base, x: at.x, z: at.z, how: "whale", tag: "deep_water", own: true, cellX: c.x, cellZ: c.z, settled: 0};
    }
    if (!wet && length >= BIG_LAND_LENGTH && WALKS.has(species.move)) {
        const ranges = rangesOf(zone);
        if (ranges.length) {
            const r = ranges[slot % ranges.length];
            const at = lapAround(r.x, r.z, Math.floor(slot / ranges.length), 4);
            return {...base, x: at.x, z: at.z, how: "range", tag: null, own: true, cellX: r.x, cellZ: r.z, settled: 0};
        }
    }
    const tags: MapTag[] = [species.spawn, ...Array.from(species.allowed).filter((t) => t !== species.spawn && t !== species.roost)];
    const attach = (list: readonly MapTag[]): WildPlacement | null => {
        for (const tag of list) {
            const {list: points, own} = mp.attachOf(tag, length, zone);
            if (!points.length) continue;
            const p = points[slot % points.length];
            return {...base, x: p.x, z: p.z, how: "attach", tag, own, cellX: p.x, cellZ: p.z, settled: 0};
        }
        return null;
    };
    // A small animal sits on the scenery (a leaf, bark, a rock face, a hole); a canopy climber, hanger or percher takes a
    // tree's limb or branch.
    const micro = species.small && trueMicro(species, slug, length) && !wet;
    const canopy = !wet && (species.attach === "limb" || species.attach === "trunk" || CANOPY_TAGS.has(species.spawn)) && species.move !== "walk";
    if (micro || canopy) {
        const found = attach(canopy ? [species.spawn, ...tags.filter((t) => CANOPY_TAGS.has(t)), ...tags] : tags);
        if (found) return found;
    }
    const walker = WALKS.has(species.move);
    const steep = climber(species) ? MOUNTAIN_SLOPE : MAX_SLOPE;
    const radius = Math.min(Math.max(length * 0.2, 0.05), 0.6);
    const sea = wet ? (SEA_TAGS.has(species.spawn) ? true : FRESH_TAGS.has(species.spawn) && !BRACKISH.has(species.spawn) ? false : null) : null;
    const fromCells = (list: readonly MapTag[], how: "cell" | "fallback"): WildPlacement | null => {
        for (const tag of list) {
            const part = mp.partitionOf(tag, wet, zone);
            const cells = wet ? withoutWhaleWater(part.list) : part.list;
            if (!cells.length) continue;
            const pick = mp.pick(cells, part.own, zone, slot, part.borrowers);
            const settled = settle(pick.x, pick.z, wet, sea, walker, steep, radius);
            const at = settled ?? {x: pick.x, z: pick.z, d: -1};
            return {...base, x: at.x, z: at.z, how, tag, own: part.own, cellX: pick.point.x, cellZ: pick.point.z, settled: at.d};
        }
        return null;
    };
    return fromCells(tags, "cell") ?? attach(tags) ?? (ZONE_FALLBACK[zone] ? fromCells([ZONE_FALLBACK[zone]!], "fallback") : null);
}

export type WildReport = {
    failures: WildFailure[];
    species: number;
    placements: number;
    byHow: Record<string, number>;
    borrowed: number;
    zones: Record<string, {species: number; big: number; whales: number; small: number}>;
    /** Species none of whose tags this island has (homestead tags): placed on their zone's own ground. */
    fallbacks: string[];
    /** Species whose roost tag is nowhere within reach (a house): they sleep at home. */
    roostsAtHome: string[];
};

/** The validator: every wild species at its own slot and at its zone's year slot. */
export function validateWild(limit = Infinity): WildReport {
    const sampler = wildMapSampler();
    const mp = wildMapPoints();
    const failures: WildFailure[] = [];
    const list = wildSpecies().slice(0, limit);
    const slots = new Map<string, number>();
    const byHow: Record<string, number> = {};
    const zones: WildReport["zones"] = {};
    let placements = 0;
    let borrowed = 0;
    const fallbacks = new Set<string>();
    const roostsAtHome: string[] = [];
    for (const {slug, zone, species, length} of list) {
        const own = slots.get(zone) ?? 0;
        slots.set(zone, own + 1);
        const z0 = (zones[zone] ??= {species: 0, big: 0, whales: 0, small: 0});
        z0.species++;
        for (const slot of [own, own + yearSlots(zone)]) {
            const fail = (check: WildCheck, detail: string) => failures.push({slug, zone, check, detail, slot});
            const place = placeWild(slug, zone, species, length, slot);
            if (!place) {
                fail("no_room", `no cell, range, whale cell or attach point for ${species.spawn}${species.allowed.size > 1 ? ` (or ${species.allowed.size - 1} more tags)` : ""}`);
                continue;
            }
            placements++;
            byHow[place.how] = (byHow[place.how] ?? 0) + 1;
            if (!place.own) borrowed++;
            if (slot === own) {
                if (place.how === "range") z0.big++;
                if (place.how === "whale") z0.whales++;
                if (place.how === "attach") z0.small++;
            }
            const {x, z} = place;
            if (Math.abs(x) > WILD_HALF || Math.abs(z) > WILD_HALF) fail("off_island", `${x.toFixed(1)},${z.toFixed(1)}`);
            const ground = sampler.ground(x, z);
            const wet = aquatic(species);
            if (place.how === "whale") {
                if (ground.water !== "sea" || ground.depth < WHALE_DEPTH) fail("whale_not_in_deep", `${ground.water ?? "dry"} ${ground.depth.toFixed(1)} m at ${x.toFixed(0)},${z.toFixed(0)}`);
                continue;
            }
            if (place.how === "range") {
                if (ground.water) fail("big_not_on_range", `in the ${ground.water} at ${x.toFixed(0)},${z.toFixed(0)}`);
                if (gridSlope(x, z) > 0.3) fail("big_not_on_range", `slope ${gridSlope(x, z).toFixed(2)} at ${x.toFixed(0)},${z.toFixed(0)}`);
                if (sampler.blocked(x, z, Math.min(length * 0.3, 2.5))) fail("inside_scenery", `range at ${x.toFixed(0)},${z.toFixed(0)}`);
                continue;
            }
            if (place.how === "attach") continue;
            if (place.how === "fallback") fallbacks.add(slug);
            const tag = place.tag!;
            if (place.settled < 0) fail("inside_scenery", `no spot within 2.5 m of its lap fits (medium, scenery, slope, reserved) at ${x.toFixed(1)},${z.toFixed(1)} (${tag})`);
            // The medium and the water.
            if (wet && !ground.water) fail("wrong_medium", `a swimmer on dry ground (${tag}) at ${x.toFixed(1)},${z.toFixed(1)}`);
            if (!wet && ground.water && ground.depth > 0.3 && !species.allowed.has("open_sky")) fail("wrong_medium", `a walker in ${ground.depth.toFixed(1)} m of ${ground.water} water (${tag}) at ${x.toFixed(1)},${z.toFixed(1)}`);
            if (wet && ground.water && !BRACKISH.has(tag)) {
                if (SEA_TAGS.has(tag) && ground.water !== "sea") fail("wrong_water", `${tag} in fresh water`);
                if (FRESH_TAGS.has(tag) && ground.water !== "fresh") fail("wrong_water", `${tag} in the sea`);
            }
            const band = DEPTH_BANDS[tag];
            if (wet && band && ground.water === "sea" && (ground.depth < band[0] - 0.4 || ground.depth > band[1] + 1.5)) fail("wrong_depth_band", `${tag} at ${ground.depth.toFixed(1)} m (band ${band[0]}–${band[1]})`);
            // The surface: its cell holds the tag (the cell's middle; laps stay inside the cell).
            const cellGround = sampler.ground(place.cellX, place.cellZ);
            if (!cellGround.tags.includes(tag)) fail("invalid_surface", `${tag} does not hold at its cell ${place.cellX.toFixed(1)},${place.cellZ.toFixed(1)}`);
            if (!wet) {
                if (sampler.blocked(x, z, Math.min(Math.max(length * 0.2, 0.05), 0.6))) fail("inside_scenery", `at ${x.toFixed(1)},${z.toFixed(1)}`);
                if (WALKS.has(species.move)) {
                    const limit = climber(species) ? MOUNTAIN_SLOPE : MAX_SLOPE;
                    const slope = gridSlope(x, z);
                    if (slope > limit) fail("off_walk_grid", `slope ${slope.toFixed(2)} > ${limit} at ${x.toFixed(1)},${z.toFixed(1)}`);
                }
                if (inRange(x, z) && length < BIG_LAND_LENGTH) fail("reserved_room", `in a big animal's range at ${x.toFixed(1)},${z.toFixed(1)}`);
            } else if (ground.water === "sea" && nearWhale(x, z) && length < WHALE_LENGTH) fail("reserved_room", `in a whale's water at ${x.toFixed(1)},${z.toFixed(1)}`);
            // Where it sleeps.
            if (species.roost && slot === own) {
                const roostWet = SEA_TAGS.has(species.roost) || (FRESH_TAGS.has(species.roost) && wet);
                const near = mp.nearest(species.roost, roostWet, x, z, 90) ?? mp.nearest(species.roost, !roostWet, x, z, 90);
                const perch = !near && mp.attachOf(species.roost, length, zone).list.length > 0;
                // A roost the island has nowhere (a house: no buildings on the wild island) or nowhere in reach: it sleeps at
                // home, the schedule's own choice (`map/place.ts` gives no den). Listed, not failed.
                if (!near && !perch) roostsAtHome.push(`${slug} (${species.roost})`);
            }
        }
        if (species.small && trueMicro(species, slug, length) && !aquatic(species)) {
            const any = [species.spawn, ...Array.from(species.allowed)].some((tag) => mp.attachOf(tag, length, zone).list.length > 0);
            if (!any && species.move !== "fly") failures.push({slug, zone, check: "small_not_on_attach_point", detail: `no attach point of its tags fits ${(length * 100).toFixed(1)} cm`, slot: own});
        }
    }
    return {failures, species: list.length, placements, byHow, borrowed, zones, fallbacks: Array.from(fallbacks), roostsAtHome};
}
