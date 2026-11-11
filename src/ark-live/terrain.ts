/**
 * The terrain as movement sees it (design §4.4): one cell a metre, each with its ground height, what may be done on it
 * (walk, blocked, soil, climbable up to a height, shore), its zone, the water over it (depth and kind) and its slope,
 * and the pen it belongs to (a zoo enclosure, Part C; a smallholding's yard and paddock, DECISIONS.md #10).
 *
 * Two views of the same cells, both from the scene's own sampler (`world-sampler.ts`) through one function
 * (`cellAt`), so they agree exactly:
 * - `Atlas`: every cell of an island, baked once (the server; about 4 s for today's island, cached to disk by the
 *   sampler's version).
 * - `LazyTerrain`: cells worked out as they are asked for, kept (the page, which only asks near its animal).
 *
 * Pure: no Node, no DOM.
 */

import type {ArkWorldSampler, AttachTag} from "@/ark-scene/world-sampler";
import {waterLevelAt} from "@/ark-scene/water-level";
import {LAKE, riverDistance, sampleGround} from "@/ark-scene/world";
import {GARDEN_POND} from "@/ark-scene/micro-decor";
import {paddockRect, plotFrame, type HomePlot} from "@/ark-scene/props/home-layout";
import {ARK_ZONES, type ArkZone} from "@/ark-scene/types";
import type {IslandId} from "@/ark-live/islands";

export const CELL_SIZE = 1;

export const CELL = {WALK: 1, BLOCKED: 2, SOIL: 4, CLIMB: 8, SHORE: 16, WATER: 32} as const;
export const WATER_KIND = {NONE: 0, SALT: 1, FRESH: 2, BRACKISH: 3} as const;
export type WaterKindCode = (typeof WATER_KIND)[keyof typeof WATER_KIND];
/** Pens: 0 none; 1–99 a zoo enclosure (Part C); 100 + n the n-th smallholding's yard and paddock. */
export const FARM_PEN_BASE = 100;

export type TerrainCell = {
    /** The ground (or the water's floor) at the cell's middle (m). */
    height: number;
    flags: number;
    zone: ArkZone;
    /** The water over it (m; 0 on land). */
    depth: number;
    water: WaterKindCode;
    /** Rise over run. */
    slope: number;
    pen: number;
    /** How high above the ground it can be climbed (m; 0 where it can't). */
    climbTop: number;
};

export interface Terrain {
    readonly island: IslandId;
    readonly half: number;
    /** The cell under a point, or null outside the island's square. */
    cell(x: number, z: number): TerrainCell | null;
    /** The ground's height at a point (m). */
    height(x: number, z: number): number;
}

/** Tags a climber can hold on to, and how close (m) a cell's middle must be to one. */
const CLIMB_TAGS: AttachTag[] = ["bark", "branch", "canopy_hang", "tree_hollow", "cliff_ledge", "rock_face", "post"];
const CLIMB_REACH = 0.9;
const CLIMB_MAX = 25;
/** Zones whose ground can be dug. */
const SOIL_ZONES = new Set<ArkZone>(["grassland", "woodland", "rainforest", "farm_garden", "desert", "seashore", "wetland"]);
/** A smallholding's yard round its origin, in its frame (`map/hamlet.ts`). */
const YARD = {x0: -4.8, x1: 4.8, z0: -3.8, z1: 3.8};

export type PenSource = {plots: HomePlot[]};

function farmPenAt(x: number, z: number, plots: HomePlot[]): number {
    let index = 0;
    for (const plot of plots) {
        if (plot.kind !== "smallholding") continue;
        const frame = plotFrame(plot);
        const local = frame.toLocal(x, z);
        const paddock = paddockRect(plot);
        const inside = (r: {x0: number; x1: number; z0: number; z1: number}) => local.x >= r.x0 && local.x <= r.x1 && local.z >= r.z0 && local.z <= r.z1;
        if (inside(YARD) || inside(paddock)) return FARM_PEN_BASE + index;
        index++;
    }
    return 0;
}

/** One cell from the sampler: the one rule both views use. */
export function cellAt(sampler: ArkWorldSampler, x: number, z: number, pens: PenSource | null): TerrainCell {
    const ground = sampleGround(x, z);
    const height = sampler.heightAt(x, z);
    const isWater = sampler.isWater(x, z);
    const level = waterLevelAt(x, z, 0);
    const depth = isWater ? Math.max(level - height, 0) : 0;
    let water: WaterKindCode = WATER_KIND.NONE;
    if (depth > 0) {
        const pond = Math.hypot(x - GARDEN_POND.x, z - GARDEN_POND.z) < GARDEN_POND.radius + 0.5;
        const lake = Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 3;
        const river = riverDistance(x, z);
        if (pond || lake || (river < 6 && ground.inland > 4)) water = WATER_KIND.FRESH;
        else if (river < 9 && ground.inland > -10) water = WATER_KIND.BRACKISH;
        else water = WATER_KIND.SALT;
    }
    const blocked = sampler.blocked(x, z, 0);
    const slope = sampler.slope(x, z);
    const zone = sampler.zoneAt(x, z);
    let flags = 0;
    if (depth > 0) flags |= CELL.WATER;
    if (!blocked && depth <= 0) flags |= CELL.WALK;
    if (blocked) flags |= CELL.BLOCKED;
    if (!blocked && depth <= 0 && SOIL_ZONES.has(zone) && slope < 1) flags |= CELL.SOIL;
    if ((depth > 0 && depth < 0.6) || (depth <= 0 && height < 0.6)) flags |= CELL.SHORE;
    let climbTop = 0;
    for (const tag of CLIMB_TAGS) {
        for (const p of sampler.attachPoints(tag, {x, z, r: CLIMB_REACH})) climbTop = Math.max(climbTop, Math.min(p.y - height, CLIMB_MAX));
    }
    if (climbTop > 0.2) flags |= CELL.CLIMB;
    else climbTop = 0;
    const pen = pens ? farmPenAt(x, z, pens.plots) : 0;
    return {height, flags, zone, depth, water, slope, pen, climbTop};
}

const ZONE_INDEX = new Map<string, number>(ARK_ZONES.map((zone, i) => [zone, i]));

/** Every cell of an island, in typed arrays (12 bytes a cell when stored). */
export class Atlas implements Terrain {
    readonly n: number;
    readonly height_: Float32Array;
    readonly flags: Uint8Array;
    readonly zone: Uint8Array;
    readonly depthCm: Int16Array;
    readonly water: Uint8Array;
    readonly slope: Uint8Array;
    readonly pen: Uint8Array;
    readonly climbTop: Uint8Array;

    constructor(readonly island: IslandId, readonly half: number, readonly version: string) {
        this.n = Math.round((half * 2) / CELL_SIZE);
        const size = this.n * this.n;
        this.height_ = new Float32Array(size);
        this.flags = new Uint8Array(size);
        this.zone = new Uint8Array(size);
        this.depthCm = new Int16Array(size);
        this.water = new Uint8Array(size);
        this.slope = new Uint8Array(size);
        this.pen = new Uint8Array(size);
        this.climbTop = new Uint8Array(size);
    }

    /** Bake every cell from the sampler (`onRow` reports progress). */
    static bake(island: IslandId, half: number, sampler: ArkWorldSampler, pens: PenSource | null, onRow?: (row: number, of: number) => void): Atlas {
        const atlas = new Atlas(island, half, sampler.version);
        for (let j = 0; j < atlas.n; j++) {
            for (let i = 0; i < atlas.n; i++) {
                const x = -half + (i + 0.5) * CELL_SIZE;
                const z = -half + (j + 0.5) * CELL_SIZE;
                atlas.set(j * atlas.n + i, cellAt(sampler, x, z, pens));
            }
            onRow?.(j, atlas.n);
        }
        return atlas;
    }

    private set(k: number, c: TerrainCell): void {
        this.height_[k] = c.height;
        this.flags[k] = c.flags;
        this.zone[k] = ZONE_INDEX.get(c.zone) ?? 0;
        this.depthCm[k] = Math.max(-32768, Math.min(32767, Math.round(c.depth * 100)));
        this.water[k] = c.water;
        this.slope[k] = Math.min(255, Math.round(c.slope * 40));
        this.pen[k] = c.pen;
        this.climbTop[k] = Math.min(255, Math.round(c.climbTop * 10));
    }

    index(x: number, z: number): number {
        const i = Math.floor((x + this.half) / CELL_SIZE);
        const j = Math.floor((z + this.half) / CELL_SIZE);
        if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
        return j * this.n + i;
    }

    cell(x: number, z: number): TerrainCell | null {
        const k = this.index(x, z);
        if (k < 0) return null;
        return {
            height: this.height_[k],
            flags: this.flags[k],
            zone: ARK_ZONES[this.zone[k]] ?? "grassland",
            depth: this.depthCm[k] / 100,
            water: this.water[k] as WaterKindCode,
            slope: this.slope[k] / 40,
            pen: this.pen[k],
            climbTop: this.climbTop[k] / 10
        };
    }

    /** The ground's height, bilinear between cell middles. */
    height(x: number, z: number): number {
        const fx = (x + this.half) / CELL_SIZE - 0.5;
        const fz = (z + this.half) / CELL_SIZE - 0.5;
        const i = Math.max(0, Math.min(this.n - 2, Math.floor(fx)));
        const j = Math.max(0, Math.min(this.n - 2, Math.floor(fz)));
        const u = Math.max(0, Math.min(1, fx - i));
        const v = Math.max(0, Math.min(1, fz - j));
        const h = (a: number, b: number) => this.height_[b * this.n + a];
        const a = h(i, j);
        const b = h(i + 1, j);
        const c = h(i, j + 1);
        const d = h(i + 1, j + 1);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }

    /** The stored form: a header line, then the arrays (little-endian). */
    toBytes(): Uint8Array {
        const header = new TextEncoder().encode(JSON.stringify({v: 1, island: this.island, half: this.half, n: this.n, version: this.version}) + "\n");
        const size = this.n * this.n;
        const body = size * 12;
        const out = new Uint8Array(header.length + body);
        out.set(header, 0);
        let o = header.length;
        const put = (bytes: Uint8Array) => {
            out.set(bytes, o);
            o += bytes.length;
        };
        put(new Uint8Array(this.height_.buffer.slice(0)));
        put(this.flags);
        put(this.zone);
        put(new Uint8Array(this.depthCm.buffer.slice(0)));
        put(this.water);
        put(this.slope);
        put(this.pen);
        put(this.climbTop);
        return out;
    }

    static fromBytes(bytes: Uint8Array): Atlas {
        const nl = bytes.indexOf(10);
        const meta = JSON.parse(new TextDecoder().decode(bytes.subarray(0, nl))) as {v: number; island: IslandId; half: number; n: number; version: string};
        const atlas = new Atlas(meta.island, meta.half, meta.version);
        const size = atlas.n * atlas.n;
        let o = nl + 1;
        const take = (len: number) => {
            const slice = bytes.slice(o, o + len);
            o += len;
            return slice;
        };
        atlas.height_.set(new Float32Array(take(size * 4).buffer));
        atlas.flags.set(take(size));
        atlas.zone.set(take(size));
        atlas.depthCm.set(new Int16Array(take(size * 2).buffer));
        atlas.water.set(take(size));
        atlas.slope.set(take(size));
        atlas.pen.set(take(size));
        atlas.climbTop.set(take(size));
        return atlas;
    }
}

/** Cells worked out on demand from the sampler and kept (the page: only near its own animal). */
export class LazyTerrain implements Terrain {
    private readonly cells = new Map<number, TerrainCell>();
    readonly n: number;

    constructor(readonly island: IslandId, readonly half: number, private readonly sampler: ArkWorldSampler, private readonly pens: PenSource | null) {
        this.n = Math.round((half * 2) / CELL_SIZE);
    }

    cell(x: number, z: number): TerrainCell | null {
        const i = Math.floor((x + this.half) / CELL_SIZE);
        const j = Math.floor((z + this.half) / CELL_SIZE);
        if (i < 0 || j < 0 || i >= this.n || j >= this.n) return null;
        const k = j * this.n + i;
        let c = this.cells.get(k);
        if (!c) {
            c = cellAt(this.sampler, -this.half + (i + 0.5) * CELL_SIZE, -this.half + (j + 0.5) * CELL_SIZE, this.pens);
            // Rounded as the atlas stores it, so both views agree to the byte.
            c = {...c, depth: Math.round(c.depth * 100) / 100, slope: Math.min(255, Math.round(c.slope * 40)) / 40, climbTop: Math.min(255, Math.round(c.climbTop * 10)) / 10, height: Math.fround(c.height)};
            this.cells.set(k, c);
        }
        return c;
    }

    /** The ground's height, bilinear between cell middles: exactly the atlas's, so the page and the server agree. */
    height(x: number, z: number): number {
        const fx = (x + this.half) / CELL_SIZE - 0.5;
        const fz = (z + this.half) / CELL_SIZE - 0.5;
        const i = Math.max(0, Math.min(this.n - 2, Math.floor(fx)));
        const j = Math.max(0, Math.min(this.n - 2, Math.floor(fz)));
        const u = Math.max(0, Math.min(1, fx - i));
        const v = Math.max(0, Math.min(1, fz - j));
        const h = (a: number, b: number) => this.cell(-this.half + (a + 0.5) * CELL_SIZE, -this.half + (b + 0.5) * CELL_SIZE)!.height;
        const a = h(i, j);
        const b = h(i + 1, j);
        const c = h(i, j + 1);
        const d = h(i + 1, j + 1);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }

    size(): number {
        return this.cells.size;
    }
}
