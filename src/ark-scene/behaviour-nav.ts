/**
 * Navigation for walkers and swimmers (visual only), generated from the world
 * sampler: a grid over the island, each cell walkable (dry, not too steep, no
 * trunk, rock or wall in it) or swimmable (deep enough). Built from
 * `ArkWorldSampler`, never hand-placed, so it is rebuilt whenever the terrain
 * changes (`version`). Paths are A* over the grid, bounded to an animal's
 * home area, smoothed to straight runs where the line is clear, and follow
 * the ground's height (and so its slopes).
 */

import type {ArkWorldSampler} from "@/ark-scene/world-sampler";
import {TERRAIN_HALF} from "@/ark-scene/world";

export type NavPoint = {x: number; z: number};

const CELL = 2;
const SIZE = Math.ceil((TERRAIN_HALF * 2) / CELL);
/** Steeper than this (rise over run) is a cliff to a walker. */
export const MAX_SLOPE = 0.9;
/** A mountain animal's (goats, ibex, snow leopards): steep ground is theirs. */
export const MOUNTAIN_SLOPE = 2.4;

/** A binary min-heap of (priority, cell). */
class Heap {
    private readonly keys: number[] = [];
    private readonly values: number[] = [];
    get size(): number {
        return this.keys.length;
    }
    push(key: number, value: number) {
        const keys = this.keys;
        const values = this.values;
        let i = keys.length;
        keys.push(key);
        values.push(value);
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (keys[parent] <= key) break;
            keys[i] = keys[parent];
            values[i] = values[parent];
            i = parent;
        }
        keys[i] = key;
        values[i] = value;
    }
    pop(): number {
        const keys = this.keys;
        const values = this.values;
        const top = values[0];
        const lastKey = keys.pop()!;
        const lastValue = values.pop()!;
        if (keys.length) {
            let i = 0;
            for (;;) {
                const l = i * 2 + 1;
                if (l >= keys.length) break;
                const r = l + 1;
                const c = r < keys.length && keys[r] < keys[l] ? r : l;
                if (keys[c] >= lastKey) break;
                keys[i] = keys[c];
                values[i] = values[c];
                i = c;
            }
            keys[i] = lastKey;
            values[i] = lastValue;
        }
        return top;
    }
}

export class NavGrid {
    readonly version: string;
    /** 1 dry ground with nothing in the way, 0 not. */
    private readonly walk: Uint8Array;
    /** The ground's steepness per cell (rise over run). */
    private readonly steep: Float32Array;
    /** Water depth (m, 0 on land). */
    private readonly depth: Float32Array;
    private readonly height: Float32Array;

    constructor(private readonly sampler: ArkWorldSampler) {
        this.version = sampler.version;
        this.walk = new Uint8Array(SIZE * SIZE);
        this.steep = new Float32Array(SIZE * SIZE);
        this.depth = new Float32Array(SIZE * SIZE);
        this.height = new Float32Array(SIZE * SIZE);
        for (let j = 0; j < SIZE; j++) {
            for (let i = 0; i < SIZE; i++) {
                const x = -TERRAIN_HALF + (i + 0.5) * CELL;
                const z = -TERRAIN_HALF + (j + 0.5) * CELL;
                const h = sampler.heightAt(x, z);
                const k = j * SIZE + i;
                this.height[k] = h;
                this.depth[k] = h < 0 ? -h : 0;
            }
        }
        for (let j = 1; j < SIZE - 1; j++) {
            for (let i = 1; i < SIZE - 1; i++) {
                const k = j * SIZE + i;
                const h = this.height[k];
                if (h <= 0.05) continue;
                const slope = Math.max(Math.abs(this.height[k + 1] - this.height[k - 1]), Math.abs(this.height[k + SIZE] - this.height[k - SIZE])) / (2 * CELL);
                this.steep[k] = slope;
                const x = -TERRAIN_HALF + (i + 0.5) * CELL;
                const z = -TERRAIN_HALF + (j + 0.5) * CELL;
                if (sampler.blocked(x, z, 0.2)) continue;
                this.walk[k] = 1;
            }
        }
    }

    private cellOf(x: number, z: number): [number, number] {
        return [Math.min(Math.max(Math.floor((x + TERRAIN_HALF) / CELL), 0), SIZE - 1), Math.min(Math.max(Math.floor((z + TERRAIN_HALF) / CELL), 0), SIZE - 1)];
    }

    private centre(i: number, j: number): NavPoint {
        return {x: -TERRAIN_HALF + (i + 0.5) * CELL, z: -TERRAIN_HALF + (j + 0.5) * CELL};
    }

    /** Dry, clear and no steeper than `maxSlope` (a mountain goat's is higher than a cow's). */
    walkable(x: number, z: number, maxSlope = MAX_SLOPE): boolean {
        const [i, j] = this.cellOf(x, z);
        const k = j * SIZE + i;
        return this.walk[k] === 1 && this.steep[k] <= maxSlope;
    }

    /** Water at least this deep there. */
    swimmable(x: number, z: number, minDepth: number): boolean {
        const [i, j] = this.cellOf(x, z);
        return this.depth[j * SIZE + i] >= minDepth;
    }

    depthAt(x: number, z: number): number {
        const [i, j] = this.cellOf(x, z);
        return this.depth[j * SIZE + i];
    }

    /** The nearest cell of the kind (walkable, or water this deep) to a point, searched outwards in rings. */
    nearest(x: number, z: number, kind: "walk" | "swim", minDepth = 0.5, maxRing = 12, maxSlope = MAX_SLOPE): NavPoint | null {
        const [ci, cj] = this.cellOf(x, z);
        const ok = (k: number) => (kind === "walk" ? this.walk[k] === 1 && this.steep[k] <= maxSlope : this.depth[k] >= minDepth);
        if (ok(cj * SIZE + ci)) return {x, z};
        for (let r = 1; r <= maxRing; r++) {
            let best: NavPoint | null = null;
            let bestD = Infinity;
            for (let dj = -r; dj <= r; dj++) {
                for (let di = -r; di <= r; di++) {
                    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
                    const i = ci + di;
                    const j = cj + dj;
                    if (i < 0 || j < 0 || i >= SIZE || j >= SIZE || !ok(j * SIZE + i)) continue;
                    const c = this.centre(i, j);
                    const d = Math.hypot(c.x - x, c.z - z);
                    if (d < bestD) {
                        bestD = d;
                        best = c;
                    }
                }
            }
            if (best) return best;
        }
        return null;
    }

    private clear(a: NavPoint, b: NavPoint, kind: "walk" | "swim", minDepth: number, maxSlope = MAX_SLOPE): boolean {
        const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL * 0.5));
        for (let s = 1; s < steps; s++) {
            const t = s / steps;
            const x = a.x + (b.x - a.x) * t;
            const z = a.z + (b.z - a.z) * t;
            if (kind === "walk" ? !this.walkable(x, z, maxSlope) : !this.swimmable(x, z, minDepth)) return false;
        }
        return true;
    }

    /**
     * A path from a to b (A*, 8 neighbours, uphill costs more), at most `maxNodes` cells expanded, smoothed to straight
     * runs. Unreachable: as far as it got towards b. Always starts at a and ends at a reachable point.
     */
    path(a: NavPoint, b: NavPoint, kind: "walk" | "swim" = "walk", minDepth = 0.5, maxNodes = 900, maxSlope = MAX_SLOPE): NavPoint[] {
        if (this.clear(a, b, kind, minDepth, maxSlope)) return [a, b];
        const ok = (k: number) => (kind === "walk" ? this.walk[k] === 1 && this.steep[k] <= maxSlope : this.depth[k] >= minDepth);
        const [si, sj] = this.cellOf(a.x, a.z);
        const [gi, gj] = this.cellOf(b.x, b.z);
        const start = sj * SIZE + si;
        const goal = gj * SIZE + gi;
        const g = new Map<number, number>([[start, 0]]);
        const from = new Map<number, number>();
        const open = new Heap();
        open.push(Math.hypot(gi - si, gj - sj), start);
        let best = start;
        let bestH = Infinity;
        let expanded = 0;
        while (open.size && expanded < maxNodes) {
            const k = open.pop();
            expanded++;
            const i = k % SIZE;
            const j = (k - i) / SIZE;
            const h = Math.hypot(gi - i, gj - j);
            if (h < bestH) {
                bestH = h;
                best = k;
            }
            if (k === goal) break;
            for (let dj = -1; dj <= 1; dj++) {
                for (let di = -1; di <= 1; di++) {
                    if (!di && !dj) continue;
                    const ni = i + di;
                    const nj = j + dj;
                    if (ni < 0 || nj < 0 || ni >= SIZE || nj >= SIZE) continue;
                    const nk = nj * SIZE + ni;
                    if (!ok(nk) && nk !== goal) continue;
                    const climb = kind === "walk" ? Math.max(this.height[nk] - this.height[k], 0) * 2 : 0;
                    const cost = (g.get(k) ?? 0) + Math.hypot(di, dj) + climb;
                    if (cost >= (g.get(nk) ?? Infinity)) continue;
                    g.set(nk, cost);
                    from.set(nk, k);
                    open.push(cost + Math.hypot(gi - ni, gj - nj), nk);
                }
            }
        }
        const cells: number[] = [];
        for (let k: number | undefined = best; k !== undefined && k !== start; k = from.get(k)) cells.push(k);
        cells.reverse();
        const raw: NavPoint[] = [a, ...cells.map((k) => this.centre(k % SIZE, Math.floor(k / SIZE)))];
        if (best === goal) raw[raw.length - 1] = b;
        // Smooth: from each point, jump to the furthest one in a clear straight line.
        const out: NavPoint[] = [raw[0]];
        let at = 0;
        while (at < raw.length - 1) {
            let next = raw.length - 1;
            while (next > at + 1 && !this.clear(raw[at], raw[next], kind, minDepth, maxSlope)) next--;
            out.push(raw[next]);
            at = next;
        }
        return out;
    }

    heightAt(x: number, z: number): number {
        return this.sampler.heightAt(x, z);
    }
}

let grid: NavGrid | null = null;
/** The grid for this sampler, built once (and again when the sampler's version changes). */
export function navGrid(sampler: ArkWorldSampler): NavGrid {
    if (!grid || grid.version !== sampler.version) grid = new NavGrid(sampler);
    return grid;
}

export function pathLength(path: NavPoint[]): number {
    let length = 0;
    for (let i = 1; i < path.length; i++) length += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    return length;
}

/** The point a fraction (0–1) of the way along a path, and the heading there. */
export function alongPath(path: NavPoint[], fraction: number, total = pathLength(path)): {x: number; z: number; yaw: number} {
    if (path.length === 1 || total <= 0) return {x: path[0].x, z: path[0].z, yaw: 0};
    let remaining = Math.min(Math.max(fraction, 0), 1) * total;
    for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        const segment = Math.hypot(b.x - a.x, b.z - a.z);
        if (remaining <= segment || i === path.length - 1) {
            const t = segment > 0 ? Math.min(remaining / segment, 1) : 1;
            return {x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z)};
        }
        remaining -= segment;
    }
    const last = path[path.length - 1];
    return {x: last.x, z: last.z, yaw: 0};
}
