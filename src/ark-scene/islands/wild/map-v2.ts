/**
 * The map's and the behaviour world's v2 answers (Part C, P4; docs/ark/wild-island.md §8): what `map/place.ts`,
 * `map/water.ts`, `sea-depth.ts` and the behaviour world (`world-sampler.ts`) ask of the bigger wild island when
 * `world.ts` arkWorld() is "v2", where today's island answers from its own fixed places.
 *
 * - **Big-animal ranges** (decision 54): a land walker drawn 2.5 m or longer has its home on one of its zone's ranges
 *   (`reserves.ts`), the first cluster on the range's middle and the next ones 4 m round it, its herd about it. Only
 *   ranges whose ground holds one of its own tags are its (a crocodile's bank, an elephant's grassland), so it always
 *   stands on ground its text allows.
 * - **Whale cells** (decision 53): the swimmers drawn 6 m or longer take the east drop-off's reserved cells, and every
 *   other swimmer keeps 14 m off them (`map/water.ts` giantCells reads them on v2).
 * - **The cold cove**, the coral the floor animals keep out of, the water's depth over a point (the lake and the river
 *   stand above the sea, at their own level: `water-level.ts` freshLevelAt).
 *
 * Pure: a function of the terrain, the zone, the slot and the rank, so nobody moves when another arrives or leaves.
 */

import type {ArkZone} from "@/ark-scene/types";
import type {ArkMapSampler, GroundSurface} from "@/ark-scene/map/sampler";
import type {MapTag} from "@/ark-scene/map/tags";
import {hashString} from "@/ark-scene/world";
import {sampleWildGround, underWater} from "@/ark-scene/islands/wild/ground";
import {BIG_LAND_LENGTH, rangesOf, whaleCells, WHALE_CLEAR, WHALE_LENGTH, type Range} from "@/ark-scene/islands/wild/reserves";
import {COVE, ICE_FRONT_Z} from "@/ark-scene/islands/wild/fields";
import {WILD_HALF} from "@/ark-scene/islands/wild/frame";
import {wildScenery, type WildItem} from "@/ark-scene/islands/wild/scenery";

export {BIG_LAND_LENGTH, WHALE_CLEAR, WHALE_LENGTH};

/** Metres of water over a point on v2: the sea's, or the lake's, the river's or a pool's above its own bed (0 on dry land). */
export function wildWaterDepth(x: number, z: number): number {
    const s = sampleWildGround(x, z);
    const water = underWater(s);
    if (water === "fresh") return (s.freshLevel ?? 0) - s.height;
    return water === "sea" ? -s.height : 0;
}

/**
 * The water's surface over a point on v2, for the behaviour world (`world-sampler.ts` waterSurface): the lake's, the
 * river's or a pool's own level where fresh water stands there, else the sea's 0 (on dry ground too: the schedule takes
 * the higher of it and the ground). From a 1 m lattice of the fresh water's levels, each corner worked out the first
 * time it is needed and read at the nearest corner (never blended across a shore: a bank never gets half a lake's level).
 */
const SURFACE_STEP = 1;
let surfaceLattice: {n: number; half: number; levels: Float32Array} | null = null;
export function wildWaterSurface(x: number, z: number): number {
    if (!surfaceLattice) {
        const n = Math.ceil((WILD_HALF * 2) / SURFACE_STEP) + 1;
        surfaceLattice = {n, half: WILD_HALF, levels: new Float32Array(n * n).fill(Number.NaN)};
    }
    const {n, half, levels} = surfaceLattice;
    const i = Math.round((x + half) / SURFACE_STEP);
    const j = Math.round((z + half) / SURFACE_STEP);
    if (i < 0 || j < 0 || i >= n || j >= n) return 0;
    const k = j * n + i;
    let level = levels[k];
    if (Number.isNaN(level)) {
        const s = sampleWildGround(-half + i * SURFACE_STEP, -half + j * SURFACE_STEP);
        level = levels[k] = underWater(s) === "fresh" ? (s.freshLevel ?? 0) : 0;
    }
    return level;
}

/** The cold cove's middle on v2: its ice shelf's front, in the inlet of the north shore. */
export function wildCoveCentre(): {x: number; z: number} {
    return {x: COVE.x, z: ICE_FRONT_Z + 6};
}

/** The drawn coral (the wild island's instanced heads: an icosahedron of 0.5 m at scale 1, `render/index.ts`). */
let coral: Map<string, WildItem[]> | null = null;
const CORAL_CELL = 4;
/** Within a drawn coral head (and `margin` round it): a floor animal there would be drawn inside it. */
export function inWildCoral(x: number, z: number, margin: number): boolean {
    if (!coral) {
        coral = new Map();
        for (const item of wildScenery()) {
            if (item.kind !== "coral") continue;
            const key = `${Math.floor(item.x / CORAL_CELL)},${Math.floor(item.z / CORAL_CELL)}`;
            coral.set(key, [...(coral.get(key) ?? []), item]);
        }
    }
    const reach = Math.ceil((1 + margin) / CORAL_CELL);
    const cx = Math.floor(x / CORAL_CELL);
    const cz = Math.floor(z / CORAL_CELL);
    for (let dx = -reach; dx <= reach; dx++) {
        for (let dz = -reach; dz <= reach; dz++) {
            for (const item of coral.get(`${cx + dx},${cz + dz}`) ?? []) if (Math.hypot(item.x - x, item.z - z) < 0.5 * item.scale + margin) return true;
        }
    }
    return false;
}

/** The whales' reserved cells by the zone of their water (decision 53 on v2), each zone's in the reserve's own order. */
export function wildGiantCells(sampler: ArkMapSampler): Map<ArkZone, Array<{x: number; z: number; depth: number; zone: ArkZone}>> {
    const out = new Map<ArkZone, Array<{x: number; z: number; depth: number; zone: ArkZone}>>();
    for (const cell of whaleCells()) {
        const zone = sampler.ground(cell.x, cell.z).zone;
        out.set(zone, [...(out.get(zone) ?? []), {x: cell.x, z: cell.z, depth: cell.depth, zone}]);
    }
    return out;
}

/** Does a species of these tags take a range (a land walker drawn 2.5 m or longer)? */
export function takesRange(move: string, trueLength: number): boolean {
    return trueLength >= BIG_LAND_LENGTH && WALKERS.has(move);
}
const WALKERS: ReadonlySet<string> = new Set(["walk", "crawl", "slither", "hop", "burrow"]);

const rangeLists = new Map<string, Range[]>();
/** A zone's ranges whose middle's ground holds one of these tags (the species' own ground), in the reserve's order. */
function rangesFor(sampler: ArkMapSampler, zone: ArkZone, allowed: ReadonlySet<MapTag>): Range[] {
    const key = `${zone}|${Array.from(allowed).sort().join(",")}`;
    let list = rangeLists.get(key);
    if (!list) {
        list = rangesOf(zone).filter((r) => sampler.ground(r.x, r.z).tags.some((tag) => allowed.has(tag)));
        rangeLists.set(key, list);
    }
    return list;
}

/** A range's laps (more big clusters than ranges): its middle, then round it on a golden-angle turn inside its clear disc. */
function lapAround(x: number, z: number, lap: number, radius: number): {x: number; z: number} {
    if (lap <= 0) return {x, z};
    const a = lap * 2.399963;
    const r = radius * Math.min(1, 0.6 + 0.1 * lap);
    return {x: x + Math.cos(a) * r, z: z + Math.sin(a) * r};
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/**
 * A big land walker's spot on its zone's ranges (decision 54), or null when its zone has no range on its own ground
 * (then the map's cells place it as before). `fits` is its ground test (its tag, the scenery, the walk grid), without
 * the ranges' reservation, which is its own. Its cluster's members on a hexagonal lattice about the spot, `gap` apart.
 */
export function rangeSpot(sampler: ArkMapSampler, zone: ArkZone, allowed: ReadonlySet<MapTag>, slot: number, rank: number, gap: number, fits: (x: number, z: number) => boolean): {x: number; z: number; level: number; ground: GroundSurface} | null {
    const ranges = rangesFor(sampler, zone, allowed);
    if (!ranges.length) return null;
    const n = ranges.length;
    const range = ranges[slot % n];
    const level = Math.floor(slot / n);
    const lap = lapAround(range.x, range.z, level, 4);
    // Its lap's spot, else the nearest within 3 m that fits (a lap's turn may meet a tussock's slope).
    let cx = lap.x;
    let cz = lap.z;
    if (!fits(cx, cz)) {
        let found = false;
        for (let k = 1; k < 120 && !found; k++) {
            const r = 0.25 * Math.sqrt(k);
            const tx = lap.x + Math.cos(k * GOLDEN) * r;
            const tz = lap.z + Math.sin(k * GOLDEN) * r;
            if (fits(tx, tz)) {
                cx = tx;
                cz = tz;
                found = true;
            }
        }
        if (!found) return null;
    }
    let x = cx;
    let z = cz;
    if (rank > 0) {
        const turn = ((hashString(`${zone}#${slot}#range`) >>> 12) % 360) / 180 * Math.PI;
        let seen = 0;
        for (let ring = 1, done = false; ring <= 9 && !done; ring++) {
            let [i, j] = [-ring, ring];
            for (const [di, dj] of [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]) {
                for (let k = 0; k < ring && !done; k++) {
                    const lx = gap * (i + j / 2);
                    const lz = gap * (j * Math.sqrt(3) / 2);
                    const tx = cx + lx * Math.cos(turn) - lz * Math.sin(turn);
                    const tz = cz + lx * Math.sin(turn) + lz * Math.cos(turn);
                    if (fits(tx, tz) && ++seen === rank) {
                        x = tx;
                        z = tz;
                        done = true;
                    }
                    i += di;
                    j += dj;
                }
            }
        }
    }
    return {x, z, level, ground: sampler.ground(x, z)};
}

/** Drop the lists built from the world (`onArkWorld`). */
export function resetWildMapV2(): void {
    coral = null;
    surfaceLattice = null;
    rangeLists.clear();
}
