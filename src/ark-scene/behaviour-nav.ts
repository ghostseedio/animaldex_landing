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
import {chunked, SlicedBuild, type BuildTask} from "@/ark-scene/behaviour-build";
import {TERRAIN_HALF} from "@/ark-scene/world";

export type NavPoint = {x: number; z: number};

const CELL = 2;

/** The grid's extent: the sampler's own square (Part C: another island's, `ArkWorldSampler.half`), else the wild island's terrain. */
function extentOf(sampler: ArkWorldSampler): {size: number; half: number} {
    const half = sampler.half ?? TERRAIN_HALF;
    return {half, size: Math.ceil((half * 2) / CELL)};
}
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

/** The grid's cells: walkable (1 dry ground with nothing in the way), steepness (rise over run), water depth, ground height. */
export type NavCells = {version: string; size: number; walk: Uint8Array; steep: Float32Array; depth: Float32Array; height: Float32Array};

/**
 * The grid's cells as tasks, a row at a time (`behaviour-build.ts`): heights and depths first, then each inner
 * cell's slope and whether it can be walked. The same numbers in the same order as the build all at once.
 */
export function navCellTasks(sampler: ArkWorldSampler): {tasks: BuildTask[]; cells: NavCells} {
    const {size, half} = extentOf(sampler);
    const cells: NavCells = {version: sampler.version, size: size, walk: new Uint8Array(size * size), steep: new Float32Array(size * size), depth: new Float32Array(size * size), height: new Float32Array(size * size)};
    const {walk, steep, depth, height} = cells;
    const heights = chunked(() => size, 1, (j) => {
        for (let i = 0; i < size; i++) {
            const x = -half + (i + 0.5) * CELL;
            const z = -half + (j + 0.5) * CELL;
            const h = sampler.heightAt(x, z);
            const k = j * size + i;
            height[k] = h;
            depth[k] = h < 0 ? -h : 0;
        }
    });
    const walkable = chunked(() => size - 2, 1, (row) => {
        const j = row + 1;
        for (let i = 1; i < size - 1; i++) {
            const k = j * size + i;
            const h = height[k];
            if (h <= 0.05) continue;
            const slope = Math.max(Math.abs(height[k + 1] - height[k - 1]), Math.abs(height[k + size] - height[k - size])) / (2 * CELL);
            steep[k] = slope;
            const x = -half + (i + 0.5) * CELL;
            const z = -half + (j + 0.5) * CELL;
            if (sampler.blocked(x, z, 0.2)) continue;
            walk[k] = 1;
        }
    });
    return {tasks: [heights, walkable], cells};
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
    /** Cells across, and half the square it covers (m): the sampler's island (Part C), else the wild island's terrain. */
    private readonly size: number;
    private readonly half: number;

    /** Built now from the sampler, or from cells already worked out (`navGridBuild`, a slice at a time). */
    constructor(private readonly sampler: ArkWorldSampler, built?: NavCells) {
        let cells = built ?? null;
        if (!cells) {
            const job = navCellTasks(sampler);
            new SlicedBuild(job.tasks, () => job.cells).run();
            cells = job.cells;
        }
        this.version = sampler.version;
        ({size: this.size, half: this.half} = extentOf(sampler));
        this.walk = cells.walk;
        this.steep = cells.steep;
        this.depth = cells.depth;
        this.height = cells.height;
    }

    /** The cells (read only: for the determinism tests and the scene stats). */
    get cells(): NavCells {
        return {version: this.version, size: this.size, walk: this.walk, steep: this.steep, depth: this.depth, height: this.height};
    }

    private cellOf(x: number, z: number): [number, number] {
        return [Math.min(Math.max(Math.floor((x + this.half) / CELL), 0), this.size - 1), Math.min(Math.max(Math.floor((z + this.half) / CELL), 0), this.size - 1)];
    }

    private centre(i: number, j: number): NavPoint {
        return {x: -this.half + (i + 0.5) * CELL, z: -this.half + (j + 0.5) * CELL};
    }

    /** Dry, clear and no steeper than `maxSlope` (a mountain goat's is higher than a cow's). */
    walkable(x: number, z: number, maxSlope = MAX_SLOPE): boolean {
        const [i, j] = this.cellOf(x, z);
        const k = j * this.size + i;
        return this.walk[k] === 1 && this.steep[k] <= maxSlope;
    }

    /** Water at least this deep there. */
    swimmable(x: number, z: number, minDepth: number): boolean {
        const [i, j] = this.cellOf(x, z);
        return this.depth[j * this.size + i] >= minDepth;
    }

    depthAt(x: number, z: number): number {
        const [i, j] = this.cellOf(x, z);
        return this.depth[j * this.size + i];
    }

    /** The nearest cell of the kind (walkable, or water this deep) to a point, searched outwards in rings. */
    nearest(x: number, z: number, kind: "walk" | "swim", minDepth = 0.5, maxRing = 12, maxSlope = MAX_SLOPE): NavPoint | null {
        const [ci, cj] = this.cellOf(x, z);
        const ok = (k: number) => (kind === "walk" ? this.walk[k] === 1 && this.steep[k] <= maxSlope : this.depth[k] >= minDepth);
        if (ok(cj * this.size + ci)) return {x, z};
        for (let r = 1; r <= maxRing; r++) {
            let best: NavPoint | null = null;
            let bestD = Infinity;
            for (let dj = -r; dj <= r; dj++) {
                for (let di = -r; di <= r; di++) {
                    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
                    const i = ci + di;
                    const j = cj + dj;
                    if (i < 0 || j < 0 || i >= this.size || j >= this.size || !ok(j * this.size + i)) continue;
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
        const span = Math.hypot(b.x - a.x, b.z - a.z);
        const steps = Math.ceil(span / (CELL * 0.5));
        // On foot, the ground along the line itself is never a cliff either (2026-11-11: a straight run between two
        // gentle cells stepped 8.7 m up a cliff in between, which the cells' own slope, over 4 m, did not see): the rise
        // between samples a metre apart, ends included, is at most half as steep again as its walk allows.
        let last = kind === "walk" ? this.sampler.heightAt(a.x, a.z) : 0;
        for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const x = a.x + (b.x - a.x) * t;
            const z = a.z + (b.z - a.z) * t;
            if (s < steps && (kind === "walk" ? !this.walkable(x, z, maxSlope) : !this.swimmable(x, z, minDepth))) return false;
            if (kind === "walk") {
                const h = this.sampler.heightAt(x, z);
                if (Math.abs(h - last) > maxSlope * 1.5 * (span / steps) + 0.05) return false;
                last = h;
            }
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
        const start = sj * this.size + si;
        const goal = gj * this.size + gi;
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
            const i = k % this.size;
            const j = (k - i) / this.size;
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
                    if (ni < 0 || nj < 0 || ni >= this.size || nj >= this.size) continue;
                    const nk = nj * this.size + ni;
                    // (The goal's cell may be blocked, a drinking spot by a pond, a rock's top: it is entered from open
                    // ground, never straight from a blocked start, across whatever blocks them both: a dog crossed the
                    // garden pond from one drinking spot to the next.)
                    if (!ok(nk) && (nk !== goal || (k === start && !ok(start)))) continue;
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
        const raw: NavPoint[] = [a, ...cells.map((k) => this.centre(k % this.size, Math.floor(k / this.size)))];
        // Reached: it ends at b itself (and still starts at a when both are in one cell: it used to lose a, and jump).
        if (best === goal) {
            if (raw.length > 1) raw[raw.length - 1] = b;
            else raw.push(b);
        }
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

    /** Each walk cell's connected stretch of ground (no steeper than the slope), worked out once per slope. */
    private readonly regions = new Map<number, Int32Array>();

    /**
     * Which connected stretch of walkable ground a point is on, for a walker that takes slopes up to `maxSlope` (cells
     * joined as the path search joins them: the 8 round each): -1 off any. A point on a blocked cell (a drinking spot by
     * the pond, the foot of a rock) is on its walkable neighbours' stretch (the lowest number of them). Anything on one
     * stretch can walk to anything else on it.
     */
    region(x: number, z: number, maxSlope = MAX_SLOPE): number {
        let ids = this.regions.get(maxSlope);
        if (!ids) {
            ids = new Int32Array(this.size * this.size).fill(-1);
            const ok = (k: number) => this.walk[k] === 1 && this.steep[k] <= maxSlope;
            const stack: number[] = [];
            let next = 0;
            for (let k0 = 0; k0 < this.size * this.size; k0++) {
                if (ids[k0] >= 0 || !ok(k0)) continue;
                ids[k0] = next;
                stack.push(k0);
                while (stack.length) {
                    const k = stack.pop()!;
                    const i = k % this.size;
                    const j = (k - i) / this.size;
                    for (let dj = -1; dj <= 1; dj++) {
                        for (let di = -1; di <= 1; di++) {
                            const ni = i + di;
                            const nj = j + dj;
                            if ((!di && !dj) || ni < 0 || nj < 0 || ni >= this.size || nj >= this.size) continue;
                            const nk = nj * this.size + ni;
                            if (ids[nk] >= 0 || !ok(nk)) continue;
                            ids[nk] = next;
                            stack.push(nk);
                        }
                    }
                }
                next++;
            }
            this.regions.set(maxSlope, ids);
        }
        const [ci, cj] = this.cellOf(x, z);
        const own = ids[cj * this.size + ci];
        if (own >= 0) return own;
        let best = -1;
        for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
                const i = ci + di;
                const j = cj + dj;
                if (i < 0 || j < 0 || i >= this.size || j >= this.size) continue;
                const id = ids[j * this.size + i];
                if (id >= 0 && (best < 0 || id < best)) best = id;
            }
        }
        return best;
    }
}

let grid: NavGrid | null = null;
/** A grid being built a slice at a time (`navGridBuild`), finished at once if it is asked for before it is done. */
let building: {sampler: ArkWorldSampler; build: SlicedBuild<NavGrid>} | null = null;
/** The grid for this sampler, built once (and again when the sampler's version changes). */
export function navGrid(sampler: ArkWorldSampler): NavGrid {
    if (!grid || grid.version !== sampler.version) grid = building && building.sampler === sampler ? building.build.run() : new NavGrid(sampler);
    return grid;
}

/** The grid for this sampler built a row at a time (`SlicedBuild.step`); it becomes `navGrid`'s once done. */
export function navGridBuild(sampler: ArkWorldSampler): SlicedBuild<NavGrid> {
    if (grid && grid.version === sampler.version) {
        const built = grid;
        return new SlicedBuild<NavGrid>([], () => built);
    }
    if (building && building.sampler === sampler) return building.build;
    const job = navCellTasks(sampler);
    const build = new SlicedBuild<NavGrid>(job.tasks, () => {
        const made = new NavGrid(sampler, job.cells);
        grid = made;
        if (building?.build === build) building = null;
        return made;
    });
    building = {sampler, build};
    return build;
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
