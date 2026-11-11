/**
 * Navigation for walkers and swimmers (visual only), generated from the world
 * sampler: a grid over the island, each cell walkable (dry, not too steep, no
 * trunk, rock or wall in it) or swimmable (deep enough). Built from
 * `ArkWorldSampler`, never hand-placed, so it is rebuilt whenever the terrain
 * changes (`version`). Paths are A* over the grid, bounded to an animal's
 * home area, smoothed to straight runs where the line is clear, and follow
 * the ground's height (and so its slopes).
 *
 * Collisions (motion pass L5): every path is exact against the world's solid things as drawn (`collide/colliders.ts`:
 * fences, buildings, trunks, rocks, logs), for the body that walks it. Its radius picks a class (`NAV_RADII`); a cell
 * is a node for that class only where its middle is that far from everything solid, a step between two cells only
 * where the whole straight step is, the way onto the grid from where it starts and off it to its goal only where that
 * straight run is, and the smoothing only joins points whose straight run is. So a path never passes through a fence,
 * a trunk, a rock or a wall, and a big animal never squeezes between two trunks it would not fit between. Which
 * stretch of ground a point is on (`region`) joins cells the same way, so a goal on its stretch is one its path reaches.
 */

import type {ArkWorldSampler} from "@/ark-scene/world-sampler";
import type {ColliderSet} from "@/ark-scene/collide/colliders";
import {chunked, SlicedBuild, type BuildTask} from "@/ark-scene/behaviour-build";
import {TERRAIN_HALF} from "@/ark-scene/world";

export type NavPoint = {x: number; z: number};

const CELL = 2;
const SIZE = Math.ceil((TERRAIN_HALF * 2) / CELL);
/** Steeper than this (rise over run) is a cliff to a walker. */
export const MAX_SLOPE = 0.9;
/** A mountain animal's (goats, ibex, snow leopards): steep ground is theirs. */
export const MOUNTAIN_SLOPE = 2.4;
/**
 * The body radii paths are worked out for (m): a body is planned as the smallest class at least its radius (the
 * widest as the widest). A path's default (callers that give none): the walk grid's old clearance.
 */
export const NAV_RADII = [0.2, 0.35, 0.55, 0.8, 1.2, 2] as const;
export const NAV_DEFAULT_RADIUS = 0.2;
/** The class index for a body radius. */
export function navClass(radius: number): number {
    for (let c = 0; c < NAV_RADII.length; c++) if (radius <= NAV_RADII[c] + 1e-6) return c;
    return NAV_RADII.length - 1;
}
/** The 8 neighbours' offsets (di, dj), in the order edges are cached. */
const STEPS: ReadonlyArray<readonly [number, number]> = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

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
    const cells: NavCells = {version: sampler.version, size: SIZE, walk: new Uint8Array(SIZE * SIZE), steep: new Float32Array(SIZE * SIZE), depth: new Float32Array(SIZE * SIZE), height: new Float32Array(SIZE * SIZE)};
    const {walk, steep, depth, height} = cells;
    const heights = chunked(() => SIZE, 1, (j) => {
        for (let i = 0; i < SIZE; i++) {
            const x = -TERRAIN_HALF + (i + 0.5) * CELL;
            const z = -TERRAIN_HALF + (j + 0.5) * CELL;
            const h = sampler.heightAt(x, z);
            const k = j * SIZE + i;
            height[k] = h;
            depth[k] = h < 0 ? -h : 0;
        }
    });
    const walkable = chunked(() => SIZE - 2, 1, (row) => {
        const j = row + 1;
        for (let i = 1; i < SIZE - 1; i++) {
            const k = j * SIZE + i;
            const h = height[k];
            if (h <= 0.05) continue;
            const slope = Math.max(Math.abs(height[k + 1] - height[k - 1]), Math.abs(height[k + SIZE] - height[k - SIZE])) / (2 * CELL);
            steep[k] = slope;
            const x = -TERRAIN_HALF + (i + 0.5) * CELL;
            const z = -TERRAIN_HALF + (j + 0.5) * CELL;
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
    /** The world's solid things as drawn (`collide/colliders.ts`); none: the cells alone, as before. */
    private readonly solid: ColliderSet | null;
    /** Each cell middle's distance to the nearest solid thing (m, at most CLEAR_CAP), worked out when first asked. */
    private clr: Float32Array | null = null;
    /** Per body class: each cell's 8 steps (`STEPS`), 0 not yet known, 1 clear, 2 through something solid. */
    private readonly steps = new Map<number, Uint8Array>();

    /** Built now from the sampler, or from cells already worked out (`navGridBuild`, a slice at a time). */
    constructor(private readonly sampler: ArkWorldSampler, built?: NavCells) {
        let cells = built ?? null;
        if (!cells) {
            const job = navCellTasks(sampler);
            new SlicedBuild(job.tasks, () => job.cells).run();
            cells = job.cells;
        }
        this.version = sampler.version;
        this.walk = cells.walk;
        this.steep = cells.steep;
        this.depth = cells.depth;
        this.height = cells.height;
        this.solid = sampler.colliders ?? null;
    }

    /** The cells (read only: for the determinism tests and the scene stats). */
    get cells(): NavCells {
        return {version: this.version, size: SIZE, walk: this.walk, steep: this.steep, depth: this.depth, height: this.height};
    }

    /** The world's solid things the paths keep clear of (null: none known). */
    get colliders(): ColliderSet | null {
        return this.solid;
    }

    private cellOf(x: number, z: number): [number, number] {
        return [Math.min(Math.max(Math.floor((x + TERRAIN_HALF) / CELL), 0), SIZE - 1), Math.min(Math.max(Math.floor((z + TERRAIN_HALF) / CELL), 0), SIZE - 1)];
    }

    private centre(i: number, j: number): NavPoint {
        return {x: -TERRAIN_HALF + (i + 0.5) * CELL, z: -TERRAIN_HALF + (j + 0.5) * CELL};
    }

    /** A cell middle's clearance (m, at most CLEAR_CAP). */
    private clearanceOf(k: number): number {
        if (!this.solid) return CLEAR_CAP;
        if (!this.clr) {
            const clr = new Float32Array(SIZE * SIZE);
            for (let j = 0; j < SIZE; j++) {
                for (let i = 0; i < SIZE; i++) {
                    const c = this.centre(i, j);
                    clr[j * SIZE + i] = this.solid.distance(c.x, c.z, CLEAR_CAP);
                }
            }
            this.clr = clr;
        }
        return this.clr[k];
    }

    /** How far a point is from everything solid (m, at most CLEAR_CAP): a body this wide fits there. */
    clearanceAt(x: number, z: number): number {
        return this.solid ? this.solid.distance(x, z, CLEAR_CAP) : CLEAR_CAP;
    }

    /** A straight run from a to b for a body of this radius touches nothing solid (none known: always). */
    runClear(a: NavPoint, b: NavPoint, radius: number): boolean {
        return !this.solid || this.solid.sweepAll(a.x, a.z, b.x, b.z, radius) >= 1;
    }

    /** Is the step from cell k by STEPS[d] clear of everything solid for this class? (Cached; both ways at once.) */
    private stepClear(k: number, d: number, cls: number): boolean {
        if (!this.solid) return true;
        let cache = this.steps.get(cls);
        if (!cache) this.steps.set(cls, (cache = new Uint8Array(SIZE * SIZE * 8)));
        const known = cache[k * 8 + d];
        if (known) return known === 1;
        const [di, dj] = STEPS[d];
        const i = k % SIZE;
        const j = (k - i) / SIZE;
        const nk = (j + dj) * SIZE + (i + di);
        const r = NAV_RADII[cls];
        const half = (di && dj ? Math.SQRT2 : 1) * CELL * 0.5;
        // (Distance is 1-Lipschitz: every point of the step is within half its length of one end.)
        let ok = Math.min(this.clearanceOf(k), this.clearanceOf(nk)) - half >= r;
        if (!ok) ok = this.solid.sweepAll(-TERRAIN_HALF + (i + 0.5) * CELL, -TERRAIN_HALF + (j + 0.5) * CELL, -TERRAIN_HALF + (i + di + 0.5) * CELL, -TERRAIN_HALF + (j + dj + 0.5) * CELL, r) >= 1;
        cache[k * 8 + d] = ok ? 1 : 2;
        cache[nk * 8 + ((d + 4) % 8)] = ok ? 1 : 2;
        return ok;
    }

    /**
     * With colliders: a cell a body of class `cls` stands in, by the ground alone (dry land, an inner cell, no steeper
     * than the slope) and its middle's exact clearance; the walk grid's margins round obstacles (`walk`, which placement
     * reads) are not needed for it, so a path threads a paddock's gate and keeps to its body's width off a trunk.
     */
    private fitsCell(k: number, maxSlope: number, r: number): boolean {
        const i = k % SIZE;
        const j = (k - i) / SIZE;
        if (i < 1 || j < 1 || i >= SIZE - 1 || j >= SIZE - 1) return false;
        return this.height[k] > 0.05 && this.steep[k] <= maxSlope && this.clearanceOf(k) >= r;
    }

    /**
     * A body of this radius can stand exactly here (collisions): dry ground no steeper than its slope, nothing solid
     * within its radius. Without colliders: `walkable`.
     */
    fits(x: number, z: number, radius: number, maxSlope = MAX_SLOPE): boolean {
        if (!this.solid) return this.walkable(x, z, maxSlope);
        const [i, j] = this.cellOf(x, z);
        const k = j * SIZE + i;
        if (i < 1 || j < 1 || i >= SIZE - 1 || j >= SIZE - 1 || this.height[k] <= 0.05 || this.steep[k] > maxSlope) return false;
        return this.sampler.heightAt(x, z) > 0.02 && this.clearanceAt(x, z) >= radius;
    }

    /** Per body class and slope: each cell's steps through a fence's gate to a cell on its far side (`gateJumps`). */
    private readonly jumps = new Map<string, Map<number, Array<{to: number; cost: number; via: [NavPoint, NavPoint]}>>>();

    /**
     * The steps through the fences' gates for a body class (collisions): a gate is narrower than the walk grid's cells,
     * so a path goes through it by its own two points, GATE_REACH either side of its middle, from a cell beside one and
     * on to a cell beside the other, each run clear for its body (too narrow a gate for it: no step).
     */
    private gateJumps(cls: number, maxSlope: number): Map<number, Array<{to: number; cost: number; via: [NavPoint, NavPoint]}>> {
        const key = `${cls}|${maxSlope}`;
        let jumps = this.jumps.get(key);
        if (jumps) return jumps;
        jumps = new Map();
        this.jumps.set(key, jumps);
        const gates = this.solid?.gates ?? [];
        const r = NAV_RADII[cls];
        for (const gate of gates) {
            const a = {x: gate.x - gate.nx * GATE_REACH, z: gate.z - gate.nz * GATE_REACH};
            const b = {x: gate.x + gate.nx * GATE_REACH, z: gate.z + gate.nz * GATE_REACH};
            if (!this.fits(a.x, a.z, r, maxSlope) || !this.fits(b.x, b.z, r, maxSlope) || !this.runClear(a, b, r)) continue;
            const beside = (p: NavPoint) => {
                const [ci, cj] = this.cellOf(p.x, p.z);
                const out: Array<{k: number; d: number}> = [];
                for (let dj = -1; dj <= 1; dj++) {
                    for (let di = -1; di <= 1; di++) {
                        const k = (cj + dj) * SIZE + (ci + di);
                        if (!this.fitsCell(k, maxSlope, r)) continue;
                        const c = this.centre(ci + di, cj + dj);
                        if (this.runClear(c, p, r)) out.push({k, d: Math.hypot(c.x - p.x, c.z - p.z) / CELL});
                    }
                }
                return out;
            };
            const near = beside(a);
            const far = beside(b);
            const through = (GATE_REACH * 2) / CELL;
            for (const one of near) {
                for (const two of far) {
                    if (one.k === two.k) continue;
                    const there = jumps.get(one.k) ?? [];
                    there.push({to: two.k, cost: one.d + through + two.d, via: [a, b]});
                    jumps.set(one.k, there);
                    const back = jumps.get(two.k) ?? [];
                    back.push({to: one.k, cost: one.d + through + two.d, via: [b, a]});
                    jumps.set(two.k, back);
                }
            }
        }
        return jumps;
    }

    /** Dry, clear and no steeper than `maxSlope` (a mountain goat's is higher than a cow's). */
    walkable(x: number, z: number, maxSlope = MAX_SLOPE): boolean {
        const [i, j] = this.cellOf(x, z);
        const k = j * SIZE + i;
        return this.walk[k] === 1 && this.steep[k] <= maxSlope;
    }

    /**
     * A path can start or end here for a body of this radius: a cell round it (within SEED_RING) it fits in, joined to it
     * by a clear straight run. (Without colliders: always.)
     */
    attachable(x: number, z: number, radius: number, maxSlope = MAX_SLOPE): boolean {
        if (!this.solid) return true;
        const cls = navClass(radius);
        const r = NAV_RADII[cls];
        const [ci, cj] = this.cellOf(x, z);
        for (let dj = -SEED_RING; dj <= SEED_RING; dj++) {
            for (let di = -SEED_RING; di <= SEED_RING; di++) {
                const i = ci + di;
                const j = cj + dj;
                if (i < 1 || j < 1 || i >= SIZE - 1 || j >= SIZE - 1) continue;
                if (this.fitsCell(j * SIZE + i, maxSlope, r) && this.runClear({x, z}, this.centre(i, j), r)) return true;
            }
        }
        return false;
    }

    /** Walkable, and a body of this radius standing exactly there touches nothing solid. */
    standable(x: number, z: number, radius: number, maxSlope = MAX_SLOPE): boolean {
        return this.walkable(x, z, maxSlope) && this.clearanceAt(x, z) >= radius;
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

    /**
     * The nearest cell of the kind (walkable, or water this deep) to a point, searched outwards in rings. With a body
     * radius, a point (the point itself, or a cell's middle) that body fits at.
     */
    nearest(x: number, z: number, kind: "walk" | "swim", minDepth = 0.5, maxRing = 12, maxSlope = MAX_SLOPE, radius = 0): NavPoint | null {
        const [ci, cj] = this.cellOf(x, z);
        const r = radius > 0 && this.solid ? radius : 0;
        const ok = (k: number) => (kind === "walk" ? (r ? this.fitsCell(k, maxSlope, r) : this.walk[k] === 1 && this.steep[k] <= maxSlope) : this.depth[k] >= minDepth && (!r || this.clearanceOf(k) >= r));
        const k0 = cj * SIZE + ci;
        if (kind === "walk" ? (r ? this.fits(x, z, r, maxSlope) : this.walk[k0] === 1 && this.steep[k0] <= maxSlope) : this.depth[k0] >= minDepth && (!r || this.clearanceAt(x, z) >= r)) return {x, z};
        if (ok(k0)) return this.centre(ci, cj);
        for (let ring = 1; ring <= maxRing; ring++) {
            let best: NavPoint | null = null;
            let bestD = Infinity;
            for (let dj = -ring; dj <= ring; dj++) {
                for (let di = -ring; di <= ring; di++) {
                    if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
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

    /** Dry ground no steeper than the slope (an inner cell): the ground's own rule, colliders aside. */
    private groundAt(x: number, z: number, maxSlope: number): boolean {
        const [i, j] = this.cellOf(x, z);
        const k = j * SIZE + i;
        return i >= 1 && j >= 1 && i < SIZE - 1 && j < SIZE - 1 && this.height[k] > 0.05 && this.steep[k] <= maxSlope;
    }

    private clear(a: NavPoint, b: NavPoint, kind: "walk" | "swim", minDepth: number, maxSlope = MAX_SLOPE, radius = 0): boolean {
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
            if (s < steps && (kind === "walk" ? !(radius > 0 ? this.groundAt(x, z, maxSlope) : this.walkable(x, z, maxSlope)) : !this.swimmable(x, z, minDepth))) return false;
            if (kind === "walk") {
                const h = this.sampler.heightAt(x, z);
                if (Math.abs(h - last) > maxSlope * 1.5 * (span / steps) + 0.05) return false;
                last = h;
            }
        }
        // And nothing solid on the way, for its body (collisions: a fence between two samples, a trunk beside the line).
        return radius <= 0 || this.runClear(a, b, radius);
    }

    /**
     * A path from a to b (A*, 8 neighbours, uphill costs more) for a body of `radius` (its class: `NAV_RADII`), at most
     * `maxNodes` cells expanded, smoothed to straight runs. Every run of it is clear of everything solid for that body
     * (a start already inside something gets out by the shortest step). Unreachable: as far as it got towards b. Always
     * starts at a and ends at a reachable point; it ends at b itself only when b is reached.
     */
    path(a: NavPoint, b: NavPoint, kind: "walk" | "swim" = "walk", minDepth = 0.5, maxNodes = 900, maxSlope = MAX_SLOPE, radius = NAV_DEFAULT_RADIUS): NavPoint[] {
        const cls = navClass(radius);
        const r = this.solid ? NAV_RADII[cls] : 0;
        if (this.clear(a, b, kind, minDepth, maxSlope, r)) return [a, b];
        const ok = (k: number) => (kind === "walk" ? (r ? this.fitsCell(k, maxSlope, r) : this.walk[k] === 1 && this.steep[k] <= maxSlope) : this.depth[k] >= minDepth && (!r || this.clearanceOf(k) >= r));
        const [si, sj] = this.cellOf(a.x, a.z);
        const [gi, gj] = this.cellOf(b.x, b.z);
        const start = sj * SIZE + si;
        const goal = gj * SIZE + gi;
        // Off the grid to b: from a cell next to b's (or b's own) whose straight run to b is clear. Without colliders, as
        // before: b's own cell, which may be blocked (a drinking spot by a pond, a rock's top), entered from open ground.
        const exits = (k: number) => {
            const i = k % SIZE;
            const j = (k - i) / SIZE;
            if (!r) return k === goal;
            return Math.max(Math.abs(i - gi), Math.abs(j - gj)) <= SEED_RING && this.runClear(this.centre(i, j), b, r);
        };
        const g = new Map<number, number>();
        const from = new Map<number, number>();
        const open = new Heap();
        // Onto the grid from a: its own cell, or (colliders) any of the 9 round it whose straight run from a is clear;
        // a start inside something solid (a placement in a rock) takes the nearest of them whatever is in the way.
        const inside = r > 0 && this.clearanceAt(a.x, a.z) < r - 0.01;
        if (!r) {
            g.set(start, 0);
            open.push(Math.hypot(gi - si, gj - sj), start);
        } else {
            let nearest = -1;
            let nearestD = Infinity;
            for (let dj = -SEED_RING; dj <= SEED_RING; dj++) {
                for (let di = -SEED_RING; di <= SEED_RING; di++) {
                    const i = si + di;
                    const j = sj + dj;
                    if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) continue;
                    const k = j * SIZE + i;
                    if (!ok(k) && k !== goal) continue;
                    const c = this.centre(i, j);
                    const d = Math.hypot(c.x - a.x, c.z - a.z) / CELL;
                    if (inside) {
                        if (ok(k) && d < nearestD) {
                            nearestD = d;
                            nearest = k;
                        }
                        continue;
                    }
                    if (!ok(k) || !this.runClear(a, c, r)) continue;
                    g.set(k, d);
                    open.push(d + Math.hypot(gi - i, gj - j), k);
                }
            }
            if (inside && nearest >= 0) {
                g.set(nearest, nearestD);
                open.push(nearestD, nearest);
            }
        }
        let best = -1;
        let bestH = Infinity;
        let reached = -1;
        let expanded = 0;
        // (Through a gate: the step's two points, by the cell it lands on.)
        const jumps = r && kind === "walk" ? this.gateJumps(cls, maxSlope) : null;
        const via = new Map<number, [NavPoint, NavPoint]>();
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
            if (exits(k)) {
                reached = k;
                break;
            }
            for (let d = 0; d < 8; d++) {
                const [di, dj] = STEPS[d];
                const ni = i + di;
                const nj = j + dj;
                if (ni < 0 || nj < 0 || ni >= SIZE || nj >= SIZE) continue;
                const nk = nj * SIZE + ni;
                // (Without colliders: the goal's cell may be blocked, a drinking spot by a pond, a rock's top: it is entered
                // from open ground, never straight from a blocked start, across whatever blocks them both: a dog crossed
                // the garden pond from one drinking spot to the next.)
                if (!ok(nk) && (r || nk !== goal || (k === start && !ok(start)))) continue;
                if (r && ok(k) && !this.stepClear(k, d, cls)) continue;
                const climb = kind === "walk" ? Math.max(this.height[nk] - this.height[k], 0) * 2 : 0;
                const cost = (g.get(k) ?? 0) + Math.hypot(di, dj) + climb;
                if (cost >= (g.get(nk) ?? Infinity)) continue;
                g.set(nk, cost);
                from.set(nk, k);
                via.delete(nk);
                open.push(cost + Math.hypot(gi - ni, gj - nj), nk);
            }
            for (const jump of jumps?.get(k) ?? []) {
                const cost = (g.get(k) ?? 0) + jump.cost;
                if (cost >= (g.get(jump.to) ?? Infinity)) continue;
                g.set(jump.to, cost);
                from.set(jump.to, k);
                via.set(jump.to, jump.via);
                const ti = jump.to % SIZE;
                open.push(cost + Math.hypot(gi - ti, gj - (jump.to - ti) / SIZE), jump.to);
            }
        }
        const end = reached >= 0 ? reached : best;
        const cells: number[] = [];
        for (let k: number | undefined = end; k !== undefined && k >= 0; k = from.get(k)) cells.push(k);
        cells.reverse();
        // (Without colliders the start's own cell is a's, and is left out, as before: a stands for it.)
        if (!r && cells.length && cells[0] === start) cells.shift();
        const raw: NavPoint[] = [a];
        for (const k of cells) {
            const through = via.get(k);
            if (through) raw.push(through[0], through[1]);
            raw.push(this.centre(k % SIZE, Math.floor(k / SIZE)));
        }
        // Reached: it ends at b itself (and still starts at a when both are in one cell: it used to lose a, and jump).
        if (reached >= 0) {
            if (!r && raw.length > 1) raw[raw.length - 1] = b;
            else raw.push(b);
        }
        // Smooth: from each point, jump to the furthest one in a clear straight line.
        const out: NavPoint[] = [raw[0]];
        let at = 0;
        while (at < raw.length - 1) {
            let next = raw.length - 1;
            while (next > at + 1 && !this.clear(raw[at], raw[next], kind, minDepth, maxSlope, r)) next--;
            out.push(raw[next]);
            at = next;
        }
        return out;
    }

    heightAt(x: number, z: number): number {
        return this.sampler.heightAt(x, z);
    }

    /** Each walk cell's connected stretch of ground (no steeper than the slope), per slope and body class. */
    private readonly regions = new Map<string, Int32Array>();

    /**
     * Which connected stretch of walkable ground a point is on, for a walker that takes slopes up to `maxSlope` and is
     * `radius` wide (cells joined as the path search joins them: the 8 round each, by a step clear of everything solid
     * for its class): -1 off any. A point on a blocked cell (a drinking spot by the pond, the foot of a rock) is on its
     * walkable neighbours' stretch (the lowest number of them). Anything on one stretch can walk to anything else on it.
     */
    region(x: number, z: number, maxSlope = MAX_SLOPE, radius = NAV_DEFAULT_RADIUS): number {
        const cls = navClass(radius);
        const r = this.solid ? NAV_RADII[cls] : 0;
        const key = `${maxSlope}|${r ? cls : -1}`;
        let ids = this.regions.get(key);
        if (!ids) {
            ids = new Int32Array(SIZE * SIZE).fill(-1);
            const ok = (k: number) => (r ? this.fitsCell(k, maxSlope, r) : this.walk[k] === 1 && this.steep[k] <= maxSlope);
            const jumps = r ? this.gateJumps(cls, maxSlope) : null;
            const stack: number[] = [];
            let next = 0;
            for (let k0 = 0; k0 < SIZE * SIZE; k0++) {
                if (ids[k0] >= 0 || !ok(k0)) continue;
                ids[k0] = next;
                stack.push(k0);
                while (stack.length) {
                    const k = stack.pop()!;
                    const i = k % SIZE;
                    const j = (k - i) / SIZE;
                    for (let d = 0; d < 8; d++) {
                        const [di, dj] = STEPS[d];
                        const ni = i + di;
                        const nj = j + dj;
                        if (ni < 0 || nj < 0 || ni >= SIZE || nj >= SIZE) continue;
                        const nk = nj * SIZE + ni;
                        if (ids[nk] >= 0 || !ok(nk)) continue;
                        if (r && !this.stepClear(k, d, cls)) continue;
                        ids[nk] = next;
                        stack.push(nk);
                    }
                    for (const jump of jumps?.get(k) ?? []) {
                        if (ids[jump.to] >= 0) continue;
                        ids[jump.to] = next;
                        stack.push(jump.to);
                    }
                }
                next++;
            }
            this.regions.set(key, ids);
        }
        const [ci, cj] = this.cellOf(x, z);
        const own = ids[cj * SIZE + ci];
        if (own >= 0) return own;
        let best = -1;
        for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
                const i = ci + di;
                const j = cj + dj;
                if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) continue;
                const id = ids[j * SIZE + i];
                if (id >= 0 && (best < 0 || id < best)) best = id;
            }
        }
        return best;
    }
}

/** How far a cell's clearance is measured (m): enough for the widest class and a step's half. */
const CLEAR_CAP = 4;
/** How many rings of cells round a path's start and its goal it may join the grid from (by a clear straight run). */
const SEED_RING = 2;
/** A gate's two points, either side of its middle (m). */
const GATE_REACH = 1.1;

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
