/**
 * PERF-WEB audit (area: geometric queries): prototype accelerations, each meant to answer exactly as the original, to
 * the bit. Untracked helper, not for commit; loaded by .audit-geom-bench.mts (replays) and .audit-geom-patches.mts
 * (end-to-end fingerprint runs). Scene modules come through require (one instance: see .audit-geom-town.mts).
 */
import {createRequire} from "node:module";
const req = createRequire(import.meta.url);
const {colliderDistance} = req("@/ark-scene/collide/colliders");

type C = any;
const CELL = 4;
/** As `SKIP_SLACK` (islands/town/geom.ts): far beyond any rounding of the sums it guards. */
const SLACK = 1e-6;

// MARK: the collider index (CSR over a dense grid, canonical ids, stamps)

export type FastIndex = {
    list: C[];
    n: number;
    cx: Float64Array; cz: Float64Array; bound: Float64Array; gap: Float64Array; y0: Float64Array; y1: Float64Array;
    ci0: Int32Array; ci1: Int32Array; cj0: Int32Array; cj1: Int32Array;
    iMin: number; jMin: number; ni: number; nj: number;
    start: Int32Array; items: Int32Array;
    mark: Int32Array; epoch: number;
    /** Colliders whose drawn footprint reaches past the cells their `reach` lists them in (the index's own check). */
    escapes: number;
    cand: Int32Array;
};
const indexes = new WeakMap<object, FastIndex>();

/** The conservative footprint radius about (cx, cz): every point of the collider's footprint is within it. */
function footprintBound(c: C): number {
    if (c.shape === "circle") return c.r;
    if (c.shape === "segment") return Math.max(Math.hypot(c.ax - c.cx, c.az - c.cz), Math.hypot(c.bx - c.cx, c.bz - c.cz)) + c.r;
    // box: its farthest corner in its own frame. Only for a true rotation (cos, sin a unit vector) and a box the right
    // way out: its formula is then the box's signed distance, at least |p - c| less that corner. Else never skipped.
    const k = Math.hypot(c.cos, c.sin);
    if (!(Math.abs(k - 1) < 1e-12) || !(c.hx0 <= c.hx1) || !(c.hz0 <= c.hz1)) return Infinity;
    const lx = Math.max(Math.abs(c.hx0), Math.abs(c.hx1));
    const lz = Math.max(Math.abs(c.hz0), Math.abs(c.hz1));
    return Math.hypot(lx, lz);
}

export function fastIndexOf(set: C): FastIndex {
    let ix = indexes.get(set);
    if (ix) return ix;
    const raw: C[] = set.list;
    const canon = new Map<C, number>();
    const list: C[] = [];
    for (const c of raw) if (!canon.has(c)) canon.set(c, list.push(c) - 1);
    const n = list.length;
    const cx = new Float64Array(n), cz = new Float64Array(n), bound = new Float64Array(n), gap = new Float64Array(n), y0 = new Float64Array(n), y1 = new Float64Array(n);
    const ci0 = new Int32Array(n), ci1 = new Int32Array(n), cj0 = new Int32Array(n), cj1 = new Int32Array(n);
    let iMin = Infinity, iMax = -Infinity, jMin = Infinity, jMax = -Infinity, escapes = 0;
    for (let id = 0; id < n; id++) {
        const c = list[id];
        cx[id] = c.cx;
        cz[id] = c.cz;
        const b = footprintBound(c);
        bound[id] = b + SLACK;
        if (b > c.reach + 1e-9) escapes++;
        gap[id] = c.gap;
        y0[id] = c.y0;
        y1[id] = c.y1;
        // (The constructor's own cells: `ColliderSet` lists a collider in every cell its reach covers.)
        ci0[id] = Math.floor((c.cx - c.reach) / CELL);
        ci1[id] = Math.floor((c.cx + c.reach) / CELL);
        cj0[id] = Math.floor((c.cz - c.reach) / CELL);
        cj1[id] = Math.floor((c.cz + c.reach) / CELL);
        iMin = Math.min(iMin, ci0[id]);
        iMax = Math.max(iMax, ci1[id]);
        jMin = Math.min(jMin, cj0[id]);
        jMax = Math.max(jMax, cj1[id]);
    }
    if (!n) iMin = iMax = jMin = jMax = 0;
    const ni = iMax - iMin + 1;
    const nj = jMax - jMin + 1;
    // CSR in the constructor's per-cell order: the list in order, each collider in each of its cells (a collider object
    // listed twice in `list` is in its cells twice there too: kept, by its canonical id).
    const counts = new Int32Array(ni * nj + 1);
    for (const c of raw) {
        const id = canon.get(c)!;
        for (let i = ci0[id]; i <= ci1[id]; i++) for (let j = cj0[id]; j <= cj1[id]; j++) counts[(i - iMin) * nj + (j - jMin) + 1]++;
    }
    for (let k = 1; k < counts.length; k++) counts[k] += counts[k - 1];
    const start = counts.slice();
    const fill = counts.slice();
    const items = new Int32Array(start[start.length - 1]);
    for (const c of raw) {
        const id = canon.get(c)!;
        for (let i = ci0[id]; i <= ci1[id]; i++) for (let j = cj0[id]; j <= cj1[id]; j++) items[fill[(i - iMin) * nj + (j - jMin)]++] = id;
    }
    ix = {list, n, cx, cz, bound, gap, y0, y1, ci0, ci1, cj0, cj1, iMin, jMin, ni, nj, start, items, mark: new Int32Array(n), epoch: 0, escapes, cand: new Int32Array(Math.max(n, 16))};
    indexes.set(set, ix);
    return ix;
}

/** Can collider `id` be nearer than `best` to (x, z)? False only when its footprint bound proves it farther. */
function mayBeat(ix: FastIndex, id: number, x: number, z: number, best: number): boolean {
    const lim = best + ix.bound[id];
    if (lim < 0) return false;
    const dx = x - ix.cx[id];
    const dz = z - ix.cz[id];
    return dx * dx + dz * dz <= lim * lim;
}

/** `ColliderSet.distance`, exactly: the same candidates in the same order (stamps for `includes`), the hopeless skipped. */
export function fastDistance(set: C, x: number, z: number, cap = 4, skip?: (c: C) => boolean): number {
    const ix = fastIndexOf(set);
    let best = cap;
    const i0 = Math.floor((x - cap) / CELL);
    const i1 = Math.floor((x + cap) / CELL);
    const j0 = Math.floor((z - cap) / CELL);
    const j1 = Math.floor((z + cap) / CELL);
    const {start, items, mark, list} = ix;
    const single = i0 === i1 && j0 === j1;
    const epoch = single ? 0 : ++ix.epoch;
    for (let i = i0; i <= i1; i++) {
        const ii = i - ix.iMin;
        if (ii < 0 || ii >= ix.ni) continue;
        for (let j = j0; j <= j1; j++) {
            const jj = j - ix.jMin;
            if (jj < 0 || jj >= ix.nj) continue;
            const cell = ii * ix.nj + jj;
            for (let k = start[cell]; k < start[cell + 1]; k++) {
                const id = items[k];
                if (!single) {
                    if (mark[id] === epoch) continue;
                    mark[id] = epoch;
                }
                if (!mayBeat(ix, id, x, z, best)) continue;
                const c = list[id];
                if (skip && skip(c)) continue;
                const d = colliderDistance(c, x, z);
                if (d < best) best = d;
            }
        }
    }
    return best;
}

/** `ColliderSet.clearance`, exactly (its filters are pure: asked only of the candidates that may beat the best). */
export function fastClearance(set: C, x: number, z: number, radius = 0, cap = 4, base = -Infinity, height = Infinity): number {
    const ix = fastIndexOf(set);
    let best = cap;
    const i0 = Math.floor((x - cap) / CELL);
    const i1 = Math.floor((x + cap) / CELL);
    const j0 = Math.floor((z - cap) / CELL);
    const j1 = Math.floor((z + cap) / CELL);
    const {start, items, mark, list, gap, y0, y1} = ix;
    const single = i0 === i1 && j0 === j1;
    const epoch = single ? 0 : ++ix.epoch;
    const finite = Number.isFinite(base);
    for (let i = i0; i <= i1; i++) {
        const ii = i - ix.iMin;
        if (ii < 0 || ii >= ix.ni) continue;
        for (let j = j0; j <= j1; j++) {
            const jj = j - ix.jMin;
            if (jj < 0 || jj >= ix.nj) continue;
            const cell = ii * ix.nj + jj;
            for (let k = start[cell]; k < start[cell + 1]; k++) {
                const id = items[k];
                if (!single) {
                    if (mark[id] === epoch) continue;
                    mark[id] = epoch;
                }
                // (bodyMeets, spansCollider: as `colliders.ts` has them.)
                if (gap[id] > 0 && radius * 2 < gap[id]) continue;
                if (finite && !(base + height > y0[id] && base < y1[id] - 0.02)) continue;
                if (!mayBeat(ix, id, x, z, best)) continue;
                const d = colliderDistance(list[id], x, z);
                if (d < best) best = d;
            }
        }
    }
    return best;
}

/**
 * The candidates for every step of a sweep along a → b at `cap` (cells over the run's bounds and a margin, each collider
 * once), those that pass `keep`, minus those whose footprint bound keeps them farther than `cap` from the whole run.
 * Returns how many are in `ix.cand`.
 */
function gather(ix: FastIndex, ax: number, az: number, bx: number, bz: number, cap: number, keep: (id: number) => boolean): number {
    const x0 = Math.min(ax, bx) - cap - SLACK;
    const x1 = Math.max(ax, bx) + cap + SLACK;
    const z0 = Math.min(az, bz) - cap - SLACK;
    const z1 = Math.max(az, bz) + cap + SLACK;
    const i0 = Math.max(Math.floor(x0 / CELL), ix.iMin);
    const i1 = Math.min(Math.floor(x1 / CELL), ix.iMin + ix.ni - 1);
    const j0 = Math.max(Math.floor(z0 / CELL), ix.jMin);
    const j1 = Math.min(Math.floor(z1 / CELL), ix.jMin + ix.nj - 1);
    const {start, items, mark, cand} = ix;
    const epoch = ++ix.epoch;
    const vx = bx - ax;
    const vz = bz - az;
    const l2 = vx * vx + vz * vz;
    let m = 0;
    for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
            const cell = (i - ix.iMin) * ix.nj + (j - ix.jMin);
            for (let k = start[cell]; k < start[cell + 1]; k++) {
                const id = items[k];
                if (mark[id] === epoch) continue;
                mark[id] = epoch;
                if (!keep(id)) continue;
                // (Its centre's distance to the run, less its bound, more than the cap: no step can find it nearer.)
                const px = ix.cx[id] - ax;
                const pz = ix.cz[id] - az;
                const t = l2 > 0 ? Math.min(Math.max((px * vx + pz * vz) / l2, 0), 1) : 0;
                const qx = px - vx * t;
                const qz = pz - vz * t;
                const lim = cap + ix.bound[id] + SLACK;
                if (qx * qx + qz * qz > lim * lim) continue;
                cand[m++] = id;
            }
        }
    }
    return m;
}

/** `ColliderSet.sweep`, exactly: the same march, each step's clearance from the run's candidates that near() lists there. */
export function fastSweep(set: C, ax: number, az: number, bx: number, bz: number, radius: number, slack = 0.01): number {
    const ix = fastIndexOf(set);
    const length = Math.hypot(bx - ax, bz - az);
    const need = radius - slack;
    const cap = radius + 2;
    const gap = ix.gap;
    const m = gather(ix, ax, az, bx, bz, cap, (id) => !(gap[id] > 0 && radius * 2 < gap[id]));
    const {cand, ci0, ci1, cj0, cj1, list} = ix;
    let s = 0;
    for (let guard = 0; guard < 4000; guard++) {
        const t = length > 0 ? s / length : 1;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        // (clearance(x, z, radius, cap): near()'s cells for this point, by each candidate's own cells.)
        const qi0 = Math.floor((x - cap) / CELL);
        const qi1 = Math.floor((x + cap) / CELL);
        const qj0 = Math.floor((z - cap) / CELL);
        const qj1 = Math.floor((z + cap) / CELL);
        let best = cap;
        for (let k = 0; k < m; k++) {
            const id = cand[k];
            if (ci1[id] < qi0 || ci0[id] > qi1 || cj1[id] < qj0 || cj0[id] > qj1) continue;
            if (!mayBeat(ix, id, x, z, best)) continue;
            const d = colliderDistance(list[id], x, z);
            if (d < best) best = d;
        }
        const free = best - need;
        if (free < 0) return Math.max(t, 0);
        if (s >= length) return 1;
        s = Math.min(s + Math.max(free, 0.02), length);
    }
    return 1;
}

export function fastSegmentClear(set: C, ax: number, az: number, bx: number, bz: number, radius: number, slack = 0.01): boolean {
    return fastSweep(set, ax, az, bx, bz, radius, slack) >= 1;
}

/** `ColliderSet.sweepAll`, exactly (its `skip` is pure in every caller: asked once a candidate). */
export function fastSweepAll(set: C, ax: number, az: number, bx: number, bz: number, radius: number, slack = 0.01, skip?: (c: C) => boolean): number {
    const ix = fastIndexOf(set);
    const length = Math.hypot(bx - ax, bz - az);
    const need = radius - slack;
    const cap = radius + 2;
    const list0 = ix.list;
    const m = gather(ix, ax, az, bx, bz, cap, skip ? (id) => !skip(list0[id]) : () => true);
    const {cand, ci0, ci1, cj0, cj1, list} = ix;
    let s = 0;
    for (let guard = 0; guard < 4000; guard++) {
        const t = length > 0 ? s / length : 1;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        const qi0 = Math.floor((x - cap) / CELL);
        const qi1 = Math.floor((x + cap) / CELL);
        const qj0 = Math.floor((z - cap) / CELL);
        const qj1 = Math.floor((z + cap) / CELL);
        let best = cap;
        for (let k = 0; k < m; k++) {
            const id = cand[k];
            if (ci1[id] < qi0 || ci0[id] > qi1 || cj1[id] < qj0 || cj0[id] > qj1) continue;
            if (!mayBeat(ix, id, x, z, best)) continue;
            const d = colliderDistance(list[id], x, z);
            if (d < best) best = d;
        }
        const free = best - need;
        if (free < 0) return Math.max(t, 0);
        if (s >= length) return 1;
        s = Math.min(s + Math.max(free, 0.02), length);
    }
    return 1;
}

/** `ColliderSet.near`, exactly (the same list, the same order): stamps in place of `out.includes`. */
export function fastNear(set: C, x: number, z: number, r: number, out: C[] = []): C[] {
    const ix = fastIndexOf(set);
    out.length = 0;
    const i0 = Math.floor((x - r) / CELL);
    const i1 = Math.floor((x + r) / CELL);
    const j0 = Math.floor((z - r) / CELL);
    const j1 = Math.floor((z + r) / CELL);
    const {start, items, mark, list} = ix;
    const single = i0 === i1 && j0 === j1;
    const epoch = single ? 0 : ++ix.epoch;
    for (let i = i0; i <= i1; i++) {
        const ii = i - ix.iMin;
        if (ii < 0 || ii >= ix.ni) continue;
        for (let j = j0; j <= j1; j++) {
            const jj = j - ix.jMin;
            if (jj < 0 || jj >= ix.nj) continue;
            const cell = ii * ix.nj + jj;
            for (let k = start[cell]; k < start[cell + 1]; k++) {
                const id = items[k];
                if (!single) {
                    if (mark[id] === epoch) continue;
                    mark[id] = epoch;
                }
                out.push(list[id]);
            }
        }
    }
    return out;
}

/** `ColliderSet.blocked`, exactly (a first hit: any order of the same candidates gives the same answer). */
export function fastBlocked(set: C, x: number, z: number, radius: number, base = -Infinity, height = Infinity): boolean {
    return fastClearanceBelow(set, x, z, radius, radius + 0.01, base, height, radius);
}

/** Whether `clearance(x, z, radius, cap, base, height) < limit`, stopping at the first that is (`blocked`'s question). */
function fastClearanceBelow(set: C, x: number, z: number, radius: number, cap: number, base: number, height: number, limit: number): boolean {
    const ix = fastIndexOf(set);
    const i0 = Math.floor((x - cap) / CELL);
    const i1 = Math.floor((x + cap) / CELL);
    const j0 = Math.floor((z - cap) / CELL);
    const j1 = Math.floor((z + cap) / CELL);
    const {start, items, list, gap, y0, y1} = ix;
    const finite = Number.isFinite(base);
    for (let i = i0; i <= i1; i++) {
        const ii = i - ix.iMin;
        if (ii < 0 || ii >= ix.ni) continue;
        for (let j = j0; j <= j1; j++) {
            const jj = j - ix.jMin;
            if (jj < 0 || jj >= ix.nj) continue;
            const cell = ii * ix.nj + jj;
            for (let k = start[cell]; k < start[cell + 1]; k++) {
                const id = items[k];
                if (gap[id] > 0 && radius * 2 < gap[id]) continue;
                if (finite && !(base + height > y0[id] && base < y1[id] - 0.02)) continue;
                if (!mayBeat(ix, id, x, z, limit)) continue;
                if (colliderDistance(list[id], x, z) < limit) return true;
            }
        }
    }
    return false;
}

// MARK: exact memo of a pure (x, z) -> number function (direct-mapped, by the bits)

export function exactCache2(fn: (x: number, z: number) => number, bits = 14): ((x: number, z: number) => number) & {hits: number; misses: number} {
    const size = 1 << bits;
    const kx = new Float64Array(size).fill(NaN);
    const kz = new Float64Array(size).fill(NaN);
    const val = new Float64Array(size);
    const f = new Float64Array(2);
    const u = new Int32Array(f.buffer);
    const wrapped = ((x: number, z: number) => {
        f[0] = x;
        f[1] = z;
        let h = Math.imul(u[0] ^ Math.imul(u[1], 0x9e3779b1), 0x85ebca6b) ^ Math.imul(u[2] ^ Math.imul(u[3], 0x27d4eb2f), 0xc2b2ae35);
        h ^= h >>> 15;
        const slot = h & (size - 1);
        // (Object.is: -0 and 0 are different inputs, NaN never hits.)
        if (Object.is(kx[slot], x) && Object.is(kz[slot], z)) {
            wrapped.hits++;
            return val[slot];
        }
        wrapped.misses++;
        const v = fn(x, z);
        kx[slot] = x;
        kz[slot] = z;
        val[slot] = v;
        return v;
    }) as ((x: number, z: number) => number) & {hits: number; misses: number};
    wrapped.hits = 0;
    wrapped.misses = 0;
    return wrapped;
}

// MARK: the town's ground height, exactly (islands/town/ground.ts sampleTownGround(x, z).height)

const plan = req("@/ark-scene/islands/town/plan");
const ground = req("@/ark-scene/islands/town/ground");
const geom = req("@/ark-scene/islands/town/geom");
const rural = req("@/ark-scene/islands/town/rural");
const safari = req("@/ark-scene/islands/town/safari");
const dome = req("@/ark-scene/islands/town/dome");
const streetClip = req("@/ark-scene/islands/town/street-clip");
const {COAST, DOWNTOWN_LOBE, SAFARI_LOBE, RURAL_LOBE, coastWobble, CANAL, CANAL_LEVEL, CANAL_WIDTH, HARBOUR_BASIN, MILLPOND, TOWN_LEVEL, townPlan} = plan;
const DOME_LOBE = dome.DOME_LOBE;
const {fbm, smoothstep, roughness, safariWaterLevel, MILLPOND_BANK} = ground;
const {bounds, inBox, polylineDistance, polylineWithin} = geom;
const {ruralPondNorm} = rural;
const {inSafari, safariDitch, SAFARI_WATERS, safariWaterNorm} = safari;

// (plan.ts's norms, verbatim.)
function safariNorm(x: number, z: number): number {
    const L = SAFARI_LOBE;
    const dx = x - L.x;
    const dz = z - L.z;
    const n = Math.pow(Math.pow(Math.abs(dx / L.a), L.power) + Math.pow(Math.abs(dz / L.b), L.power), 1 / L.power);
    return n - 0.7 * coastWobble(Math.atan2(dz, dx) - 0.8);
}
function ruralNorm(x: number, z: number): number {
    const L = RURAL_LOBE;
    const dx = x - L.x;
    const dz = z - L.z;
    const n = Math.pow(Math.pow(Math.abs(dx / L.a), L.power) + Math.pow(Math.abs(dz / L.b), L.power), 1 / L.power);
    return n - 0.7 * coastWobble(Math.atan2(dz, dx) + 2.1);
}
function mainNorm(x: number, z: number): number {
    const a = x < 0 ? COAST.west : COAST.east;
    const b = z < 0 ? COAST.north : COAST.south;
    const p = COAST.power;
    const n = Math.pow(Math.pow(Math.abs(x / a), p) + Math.pow(Math.abs(z / b), p), 1 / p);
    return n - coastWobble(Math.atan2(z, x));
}
function lobeNorm(x: number, z: number): number {
    const L = DOWNTOWN_LOBE;
    const dx = x - L.x;
    const dz = z - L.z;
    const n = Math.pow(Math.pow(Math.abs(dx / L.a), L.power) + Math.pow(Math.abs(dz / L.b), L.power), 1 / L.power);
    return n - 0.8 * coastWobble(Math.atan2(dz, dx) + 1.9);
}
function domeNorm(x: number, z: number): number {
    const L = DOME_LOBE;
    const dx = x - L.x;
    const dz = z - L.z;
    const n = Math.pow(Math.pow(Math.abs(dx / L.a), L.power) + Math.pow(Math.abs(dz / L.b), L.power), 1 / L.power);
    return n - 0.5 * coastWobble(Math.atan2(dz, dx) + 0.6);
}

/** |coastWobble| at most (its four amplitudes). */
const WOBBLE = 0.028 + 0.02 + 0.012 + 0.006;
/**
 * An upper bound of a lobe's term `(1 - n) * (r / max(n, 0.05))` at a point, from its offset (dx, dz) to the lobe's
 * centre, without its powers or its wobble: n >= max(|dx/a|, |dz/b|) - c * WOBBLE (a p-norm, p >= 1, is at least its
 * largest part), and past n > 1 the term is r (1/n - 1) <= max(|dx|, |dz|) (1/nLow - 1). +Infinity when none is known.
 */
function lobeUpper(dx: number, dz: number, a: number, b: number, c: number): number {
    const nLow = Math.max(Math.abs(dx / a), Math.abs(dz / b)) - c * WOBBLE - 1e-9;
    if (!(nLow > 1)) return Infinity;
    return Math.max(Math.abs(dx), Math.abs(dz)) * (1 / nLow - 1) + SLACK;
}

/**
 * `inland`, exactly: the main island's term always; each lobe's only where it could change the smooth union. Where a
 * lobe's term is provably more than the union's width below what the union holds so far, the original's step is
 * `Math.max(acc, t) + 0 * 0 * k * 0.25`, which is `acc + 0`: that, without the lobe's powers, atan2 and four sines.
 */
export function fastInland(x: number, z: number): number {
    const r = Math.hypot(x, z) || 1;
    const n = mainNorm(x, z);
    const main = (1 - n) * (r / Math.max(n, 0.05));
    const L = DOWNTOWN_LOBE;
    const k = 10;
    let both: number;
    if (lobeUpper(x - L.x, z - L.z, L.a, L.b, 0.8) < main - k - SLACK) both = main + 0;
    else {
        const rl = Math.hypot(x - L.x, z - L.z) || 1;
        const nl = lobeNorm(x, z);
        const lobe = (1 - nl) * (rl / Math.max(nl, 0.05));
        const h = Math.max(k - Math.abs(main - lobe), 0) / k;
        both = Math.max(main, lobe) + h * h * k * 0.25;
    }
    const S = SAFARI_LOBE;
    const k2 = 16;
    let three: number;
    if (lobeUpper(x - S.x, z - S.z, S.a, S.b, 0.7) < both - k2 - SLACK) three = both + 0;
    else {
        const rs = Math.hypot(x - S.x, z - S.z) || 1;
        const ns = safariNorm(x, z);
        const safariT = (1 - ns) * (rs / Math.max(ns, 0.05));
        const h2 = Math.max(k2 - Math.abs(both - safariT), 0) / k2;
        three = Math.max(both, safariT) + h2 * h2 * k2 * 0.25;
    }
    const R = RURAL_LOBE;
    let four: number;
    if (lobeUpper(x - R.x, z - R.z, R.a, R.b, 0.7) < three - k2 - SLACK) four = three + 0;
    else {
        const rr = Math.hypot(x - R.x, z - R.z) || 1;
        const nr = ruralNorm(x, z);
        const ruralT = (1 - nr) * (rr / Math.max(nr, 0.05));
        const h3 = Math.max(k2 - Math.abs(three - ruralT), 0) / k2;
        four = Math.max(three, ruralT) + h3 * h3 * k2 * 0.25;
    }
    const D = DOME_LOBE;
    const k3 = 12;
    if (lobeUpper(x - D.x, z - D.z, D.a, D.b, 0.5) < four - k3 - SLACK) return four + 0;
    const rd = Math.hypot(x - D.x, z - D.z) || 1;
    const nd = domeNorm(x, z);
    const domeT = (1 - nd) * (rd / Math.max(nd, 0.05));
    const h4 = Math.max(k3 - Math.abs(four - domeT), 0) / k3;
    return Math.max(four, domeT) + h4 * h4 * k3 * 0.25;
}

// (The street grade, by a 16 m index of the clipped streets' test boxes: the same streets in the same order, the same
// box test, the same max and break.)
let streets: any[] | null = null;
let streetIndex: {x0: number; z0: number; n: number; cells: Int32Array[]} | null = null;
const SG = 16;
function streetIndexOf() {
    if (streetIndex) return streetIndex;
    streets = streetClip.clipStreets(townPlan().streets);
    const half = plan.TOWN_HALF + 40;
    const n = Math.ceil((2 * half) / SG);
    const lists: number[][] = Array.from({length: n * n}, () => []);
    streets!.forEach((c, s) => {
        const ia = Math.max(Math.floor((c.box.x0 - 5 + half) / SG) - 1, 0);
        const ib = Math.min(Math.floor((c.box.x1 + 5 + half) / SG) + 1, n - 1);
        const ja = Math.max(Math.floor((c.box.z0 - 5 + half) / SG) - 1, 0);
        const jb = Math.min(Math.floor((c.box.z1 + 5 + half) / SG) + 1, n - 1);
        for (let i = ia; i <= ib; i++) for (let j = ja; j <= jb; j++) lists[i * n + j].push(s);
    });
    streetIndex = {x0: -half, z0: -half, n, cells: lists.map((l) => Int32Array.from(l))};
    return streetIndex;
}
export function fastStreetGrade(x: number, z: number): number {
    const ix = streetIndexOf();
    const i = Math.floor((x - ix.x0) / SG);
    const j = Math.floor((z - ix.z0) / SG);
    if (!(i >= 0 && j >= 0 && i < ix.n && j < ix.n)) return ground.streetGrade(x, z);
    const list = ix.cells[i * ix.n + j];
    let grade = 0;
    for (let k = 0; k < list.length; k++) {
        const c = streets![list[k]];
        if (x < c.box.x0 - 5 || x > c.box.x1 + 5 || z < c.box.z0 - 5 || z > c.box.z1 + 5) continue;
        const reach = Math.max(c.band, c.half);
        grade = Math.max(grade, smoothstep(reach + 4.5, reach + 0.5, polylineDistance(c.street.line, x, z)));
        if (grade >= 1) break;
    }
    return grade;
}

// (ground.ts's own, verbatim.)
const SEA_FLOOR = -16;
const BASIN_FLOOR = -3.6;
const MILLPOND_RIM = CANAL_LEVEL + 0.1;
const MILLPOND_SHELF = CANAL_LEVEL - 0.35;
const MILLPOND_BED = 0.2;
const CANAL_BED = CANAL_LEVEL - 1.7;
function landHeight(x: number, z: number, rough: number): number {
    const hill = smoothstep(-112, -182, z) * 5.5 * (1 - smoothstep(-40, -110, x) * 0.4);
    const roll = (fbm(x * 0.022 + 7.3, z * 0.022 - 3.1) - 0.5) * 2.2 * rough;
    return TOWN_LEVEL + hill + roll;
}
const pondBounds = new WeakMap<object, any>();
const SAFARI_BANK = 1.45;

export type HeightOptions = {lazyInland: boolean; streetIndex: boolean};

/** sampleTownGround(x, z).height, without the surface (the height never reads it): areaAt and the habitats' box loop go. */
export function makeTownHeight(opts: HeightOptions) {
    const inlandOf: (x: number, z: number) => number = opts.lazyInland ? fastInland : plan.inland;
    const gradeOf: (x: number, z: number) => number = opts.streetIndex ? fastStreetGrade : ground.streetGrade;
    return function townHeightFast(x: number, z: number): number {
        const inl = inlandOf(x, z);
        const grade = gradeOf(x, z);
        const rough = roughness(x, z, grade);
        const beach = smoothstep(40, 72, x) * smoothstep(92, 118, z);
        const land = landHeight(x, z, rough);
        const shoreWidth = 9 + 17 * beach;
        let height: number;
        if (inl >= 0) {
            const t = smoothstep(0, shoreWidth, inl);
            height = 0.25 + (land - 0.25) * t;
        } else {
            height = Math.max(0.25 + inl * (0.3 - 0.18 * beach) - Math.max(-inl - 24, 0) * 0.35, SEA_FLOOR) + (fbm(x * 0.05, z * 0.05) - 0.5) * 0.8;
            const past = Math.max(Math.abs(x), Math.abs(z)) - 237.6;
            if (past > 0) height -= smoothstep(0, 12, past) * smoothstep(20, 45, -inl) * 30;
        }
        if (inBox(HARBOUR_BASIN, x, z, 0)) {
            height = BASIN_FLOOR + (fbm(x * 0.1, z * 0.1) - 0.5) * 0.6;
        } else if (inBox(HARBOUR_BASIN, x, z, 1.2)) {
            height = Math.min(height, TOWN_LEVEL);
        }
        if (polylineWithin(CANAL, x, z, CANAL_WIDTH / 2 + 0.55)) {
            const distance = polylineDistance(CANAL, x, z);
            const t = smoothstep(CANAL_WIDTH / 2 + 0.55, CANAL_WIDTH / 2 - 0.2, distance);
            height = height + (CANAL_BED - height) * t;
        }
        const pond = Math.hypot((x - MILLPOND.x) / MILLPOND.rx, (z - MILLPOND.z) / MILLPOND.rz);
        if (pond < MILLPOND_BANK) {
            if (pond >= 1) {
                height = height + (MILLPOND_RIM - height) * smoothstep(MILLPOND_BANK, 1, pond);
            } else {
                height = MILLPOND_RIM - (MILLPOND_RIM - MILLPOND_SHELF) * smoothstep(1, 0.86, pond) - (MILLPOND_SHELF - MILLPOND_BED) * smoothstep(0.86, 0.5, pond);
            }
        }
        const p = townPlan();
        for (const w of p.waters) {
            if (w.kind !== "farm_pond") continue;
            let b = pondBounds.get(w.poly);
            if (!b) pondBounds.set(w.poly, (b = bounds(w.poly)));
            if (x < b.x0 - 4 || x > b.x1 + 4 || z < b.z0 - 4 || z > b.z1 + 4) continue;
            const cx = (b.x0 + b.x1) / 2;
            const cz = (b.z0 + b.z1) / 2;
            const r = Math.hypot((x - cx) / ((b.x1 - b.x0) / 2), (z - cz) / ((b.z1 - b.z0) / 2));
            if (w.id === "rural_pond" && r < 1.6) {
                const level = landHeight(cx, cz, roughness(cx, cz)) - 0.45;
                const n = ruralPondNorm(x, z);
                if (n < 1.6) {
                    height = n < 1 ? level - 0.06 - (w.depth - 0.06) * smoothstep(1, 0.45, n) : level + 0.06 + (height - level - 0.06) * smoothstep(1, 1.6, n);
                }
                continue;
            }
            if (r < 1.5) {
                const level = landHeight(cx, cz, roughness(cx, cz)) - 0.45;
                const t = smoothstep(1.5, 0.8, r);
                height = height + (level - w.depth - height) * t;
            }
        }
        if (inl > 0 && inSafari(x, z)) {
            let h = height;
            const ditch = safariDitch(x, z);
            // (The street grade is this point's, worked out above: the original asks streetGrade(x, z) again.)
            if (ditch > 0) h -= 0.9 * ditch * (1 - grade);
            for (const w of SAFARI_WATERS) {
                const nn = safariWaterNorm(w, x, z);
                if (nn >= SAFARI_BANK) continue;
                const level = safariWaterLevel(w);
                const rim = level + 0.12;
                if (nn >= 1) {
                    h = h + (rim - h) * smoothstep(SAFARI_BANK, 1, nn);
                } else {
                    h = rim - 0.3 * smoothstep(1, 0.82, nn) - (w.depth - 0.18) * smoothstep(0.82, 0.25, nn);
                }
            }
            height = h;
        }
        return height;
    };
}

// MARK: segmentClear, a deep point first (the march only when none is found)

/**
 * `ColliderSet.segmentClear`, exactly. A run (0 < length <= 79 m) with a point more than 2 cm (+1e-6) inside `need` of a
 * shape the body meets is blocked: the clearance is 1-Lipschitz (every shape's distance is its exact signed distance,
 * every footprint inside the cells its reach lists it in: `escapes` 0, checked once a set), and the march steps by what
 * is free, at least 2 cm, so it lands on a point inside `need` before it could pass that one (and 79 m takes at most
 * 3,951 of its 4,000 steps). Each shape listed in the cells the run crosses is asked at the run's point nearest its
 * middle, the cells in order from a; any other run is marched (`fastSweep`).
 */
export function fastSegmentClear2(set: C, ax: number, az: number, bx: number, bz: number, radius: number, slack = 0.01): boolean {
    const ix = fastIndexOf(set);
    const vx = bx - ax;
    const vz = bz - az;
    const length = Math.hypot(vx, vz);
    if (ix.escapes === 0 && length > 0 && length <= 79) {
        const deep = radius - slack - 0.02 - SLACK;
        const l2 = vx * vx + vz * vz;
        const {start, items, mark, list, gap, cx, cz} = ix;
        const epoch = ++ix.epoch;
        const steps = Math.ceil(length) + 1;
        let last = -1;
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const i = Math.floor((ax + vx * t) / CELL) - ix.iMin;
            const j = Math.floor((az + vz * t) / CELL) - ix.jMin;
            if (i < 0 || j < 0 || i >= ix.ni || j >= ix.nj) continue;
            const cell = i * ix.nj + j;
            if (cell === last) continue;
            last = cell;
            for (let k = start[cell]; k < start[cell + 1]; k++) {
                const id = items[k];
                if (mark[id] === epoch) continue;
                mark[id] = epoch;
                if (gap[id] > 0 && radius * 2 < gap[id]) continue;
                const u = Math.min(Math.max(((cx[id] - ax) * vx + (cz[id] - az) * vz) / l2, 0), 1);
                if (colliderDistance(list[id], ax + vx * u, az + vz * u) < deep) return false;
            }
        }
    }
    return fastSweep(set, ax, az, bx, bz, radius, slack) >= 1;
}

/** An exact memo of a pure 6-number -> boolean function (direct-mapped, by the bits; -0 and 0 apart, NaN never kept). */
export function exactCache6(fn: (a: number, b: number, c: number, d: number, e: number, f: number) => boolean, bits = 14) {
    const size = 1 << bits;
    const keys = new Float64Array(size * 6).fill(NaN);
    const vals = new Uint8Array(size);
    const f = new Float64Array(6);
    const u = new Int32Array(f.buffer);
    const wrapped = ((a: number, b: number, c: number, d: number, e: number, g: number) => {
        f[0] = a, f[1] = b, f[2] = c, f[3] = d, f[4] = e, f[5] = g;
        let h = 0x811c9dc5;
        for (let k = 0; k < 12; k++) h = Math.imul(h ^ u[k], 0x01000193);
        h ^= h >>> 13;
        const slot = h & (size - 1);
        const o = slot * 6;
        if (Object.is(keys[o], a) && Object.is(keys[o + 1], b) && Object.is(keys[o + 2], c) && Object.is(keys[o + 3], d) && Object.is(keys[o + 4], e) && Object.is(keys[o + 5], g)) {
            wrapped.hits++;
            return vals[slot] === 1;
        }
        wrapped.misses++;
        const v = fn(a, b, c, d, e, g);
        keys[o] = a, keys[o + 1] = b, keys[o + 2] = c, keys[o + 3] = d, keys[o + 4] = e, keys[o + 5] = g;
        vals[slot] = v ? 1 : 0;
        return v;
    }) as ((a: number, b: number, c: number, d: number, e: number, f: number) => boolean) & {hits: number; misses: number};
    wrapped.hits = 0;
    wrapped.misses = 0;
    return wrapped;
}

/**
 * `set.distance(x, z, cap) >= limit`, exactly (the nav grid's fits: clearanceAt(x, z) >= radius): false as soon as one
 * shape is nearer than `limit`. Only the cells within `limit` when every footprint is inside its listed cells (a shape
 * nearer than `limit` has a point there), else the cells within `cap` as `distance` reads them.
 */
export function fastDistanceAtLeast(set: C, x: number, z: number, cap: number, limit: number): boolean {
    if (!(cap >= limit)) return false;
    const ix = fastIndexOf(set);
    const r = ix.escapes === 0 ? Math.max(limit, 0) : cap;
    const i0 = Math.floor((x - r) / CELL) - ix.iMin;
    const i1 = Math.floor((x + r) / CELL) - ix.iMin;
    const j0 = Math.floor((z - r) / CELL) - ix.jMin;
    const j1 = Math.floor((z + r) / CELL) - ix.jMin;
    const {start, items, list} = ix;
    for (let i = Math.max(i0, 0); i <= Math.min(i1, ix.ni - 1); i++) {
        for (let j = Math.max(j0, 0); j <= Math.min(j1, ix.nj - 1); j++) {
            const cell = i * ix.nj + j;
            for (let k = start[cell]; k < start[cell + 1]; k++) {
                const id = items[k];
                if (!mayBeat(ix, id, x, z, limit)) continue;
                if (colliderDistance(list[id], x, z) < limit) return false;
            }
        }
    }
    return true;
}

/** `sweepAll(...) >= 1` (the nav's runClear and stepClear), exactly: as `fastSegmentClear2`, every shape, `skip` aside. */
export function fastSweepAllClear(set: C, ax: number, az: number, bx: number, bz: number, radius: number, slack = 0.01, skip?: (c: C) => boolean): boolean {
    const ix = fastIndexOf(set);
    const vx = bx - ax;
    const vz = bz - az;
    const length = Math.hypot(vx, vz);
    if (ix.escapes === 0 && length > 0 && length <= 79) {
        const deep = radius - slack - 0.02 - SLACK;
        const l2 = vx * vx + vz * vz;
        const {start, items, mark, list, cx, cz} = ix;
        const epoch = ++ix.epoch;
        const steps = Math.ceil(length) + 1;
        let last = -1;
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const i = Math.floor((ax + vx * t) / CELL) - ix.iMin;
            const j = Math.floor((az + vz * t) / CELL) - ix.jMin;
            if (i < 0 || j < 0 || i >= ix.ni || j >= ix.nj) continue;
            const cell = i * ix.nj + j;
            if (cell === last) continue;
            last = cell;
            for (let k = start[cell]; k < start[cell + 1]; k++) {
                const id = items[k];
                if (mark[id] === epoch) continue;
                mark[id] = epoch;
                const c = list[id];
                if (skip && skip(c)) continue;
                const u = Math.min(Math.max(((cx[id] - ax) * vx + (cz[id] - az) * vz) / l2, 0), 1);
                if (colliderDistance(c, ax + vx * u, az + vz * u) < deep) return false;
            }
        }
    }
    return fastSweepAll(set, ax, az, bx, bz, radius, slack, skip) >= 1;
}
