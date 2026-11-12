/**
 * The town's ground as it is drawn (lane TB, the owner's "animals sinking into the ground"): what a town animal's feet
 * stand on. Pure, in the town's local frame; `islands/scene.ts` answers it in the world frame.
 *
 * - **The ground tile**: the 1.1 m grid the town's ground is drawn with (`render/index.ts` groundGrid and groundTile:
 *   433 × 433 vertices at `sampleTownGround`'s height, each cell cut into two triangles along the diagonal from its
 *   (x + 1, z) corner to its (x, z + 1) corner), not the analytic height the schedule and placement read.
 * - **Walk surfaces** on top of it: every upward-facing triangle of the town's decals (roads 6 cm up, pavements
 *   16 cm, markings, paths, drives, the square's setts, bridge decks, farm fields and yards, the zoo's ground) and the
 *   floors the town's displays add (the zoo houses' floors, the garden rooms' floors: `render/zoo-houses.ts`,
 *   `pet-homes.ts`). Roads, pavements, floors, paths, enclosures, fields and interiors are all ground, so nothing
 *   stands into a pavement or a floor.
 *
 * The drawn height at a point is the highest of these there (a decal always lies on the tile; where the tile shows
 * through, the tile). `src/lib/ark-town-grounding.test.ts` holds the tile against the drawn mesh's own triangles.
 */

import {sampleTownGround} from "@/ark-scene/islands/town/ground";
import {TOWN_HALF, TOWN_SEGMENTS} from "@/ark-scene/islands/town/plan";

const SIZE = TOWN_SEGMENTS + 1;
const STEP = (TOWN_HALF * 2) / TOWN_SEGMENTS;

let heights: Float32Array | null = null;

/** The ground grid's heights as the drawn tiles have them (`render/index.ts` groundGrid; optional: else sampled on demand). */
export function primeTownDrawnGrid(grid: Float32Array | null): void {
    if (grid && grid.length === SIZE * SIZE) heights = grid;
}

function vertex(column: number, row: number): number {
    heights ??= new Float32Array(SIZE * SIZE).fill(Number.NaN);
    const k = row * SIZE + column;
    let h = heights[k];
    if (Number.isNaN(h)) h = heights[k] = sampleTownGround(-TOWN_HALF + column * STEP, -TOWN_HALF + row * STEP).height;
    return h;
}

function outside(x: number, z: number): boolean {
    return x <= -TOWN_HALF || z <= -TOWN_HALF || x >= TOWN_HALF || z >= TOWN_HALF;
}

/** The ground tile's height at a point (m, local frame): its own triangles. */
export function townTileHeight(x: number, z: number): number {
    if (outside(x, z)) return sampleTownGround(x, z).height;
    const fx = (x + TOWN_HALF) / STEP;
    const fz = (z + TOWN_HALF) / STEP;
    const column = Math.min(Math.floor(fx), TOWN_SEGMENTS - 1);
    const row = Math.min(Math.floor(fz), TOWN_SEGMENTS - 1);
    const u = fx - column;
    const v = fz - row;
    // a (c, r), b (c + 1, r), d (c, r + 1), e (c + 1, r + 1): `groundTile`'s triangles a-d-b (u + v ≤ 1) and b-d-e.
    if (u + v <= 1) {
        const a = vertex(column, row);
        return a + (vertex(column + 1, row) - a) * u + (vertex(column, row + 1) - a) * v;
    }
    const e = vertex(column + 1, row + 1);
    return e + (vertex(column, row + 1) - e) * (1 - u) + (vertex(column + 1, row) - e) * (1 - v);
}

// MARK: - Walk surfaces

/** Upward-facing triangles bucketed on a 2 m grid over the town's square (compressed rows). */
export type TownWalkSurfaces = {tris: Float32Array; offsets: Uint32Array; items: Uint32Array; count: number};

const CELL = 2;
const CELLS = Math.ceil((TOWN_HALF * 2) / CELL);

/** Anything with flat triangle positions (x y z per vertex, three vertices a triangle): a town `Geo`, a BufferGeometry's array. */
export type TrianglesLike = {pos: ArrayLike<number>} | ArrayLike<number>;

function positionsOf(source: TrianglesLike): ArrayLike<number> {
    return "pos" in (source as object) && !(ArrayBuffer.isView(source) || Array.isArray(source)) ? (source as {pos: ArrayLike<number>}).pos : (source as ArrayLike<number>);
}

/** The walk surfaces' index from the town's decal geometry and the displays' floors (local frame). */
export function townWalkSurfaces(sources: readonly TrianglesLike[]): TownWalkSurfaces {
    let total = 0;
    for (const s of sources) total += Math.floor(positionsOf(s).length / 9);
    const tris = new Float32Array(total * 9);
    let count = 0;
    for (const s of sources) {
        const p = positionsOf(s);
        for (let t = 0; t + 8 < p.length; t += 9) {
            // Upward-facing only (a kerb's face, a wall's side never carries feet).
            const ux = p[t + 3] - p[t];
            const uy = p[t + 4] - p[t + 1];
            const uz = p[t + 5] - p[t + 2];
            const vx = p[t + 6] - p[t];
            const vy = p[t + 7] - p[t + 1];
            const vz = p[t + 8] - p[t + 2];
            const nx = uy * vz - uz * vy;
            const ny = uz * vx - ux * vz;
            const nz = ux * vy - uy * vx;
            const l = Math.hypot(nx, ny, nz);
            if (l < 1e-9 || Math.abs(ny) / l < 0.5) continue;
            for (let k = 0; k < 9; k++) tris[count * 9 + k] = p[t + k];
            count++;
        }
    }
    // Bucket each triangle into the cells its bounds cover.
    const cellsOf = (i: number): [number, number, number, number] => {
        const o = i * 9;
        const x0 = Math.min(tris[o], tris[o + 3], tris[o + 6]);
        const x1 = Math.max(tris[o], tris[o + 3], tris[o + 6]);
        const z0 = Math.min(tris[o + 2], tris[o + 5], tris[o + 8]);
        const z1 = Math.max(tris[o + 2], tris[o + 5], tris[o + 8]);
        const c = (v: number) => Math.min(Math.max(Math.floor((v + TOWN_HALF) / CELL), 0), CELLS - 1);
        return [c(x0), c(x1), c(z0), c(z1)];
    };
    const counts = new Uint32Array(CELLS * CELLS + 1);
    for (let i = 0; i < count; i++) {
        const [i0, i1, j0, j1] = cellsOf(i);
        for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) counts[j * CELLS + k + 1]++;
    }
    for (let c = 1; c <= CELLS * CELLS; c++) counts[c] += counts[c - 1];
    const offsets = counts;
    const items = new Uint32Array(offsets[CELLS * CELLS]);
    const fill = offsets.slice(0, CELLS * CELLS);
    for (let i = 0; i < count; i++) {
        const [i0, i1, j0, j1] = cellsOf(i);
        for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) items[fill[j * CELLS + k]++] = i;
    }
    return {tris: tris.subarray(0, count * 9), offsets, items, count};
}

let surfaces: TownWalkSurfaces | null = null;

/** The town's walk surfaces now (the scene sets them when the town is built and when its zoo or displays change). */
export function setTownWalkSurfaces(next: TownWalkSurfaces | null): void {
    surfaces = next;
}

export function townWalkSurfacesNow(): TownWalkSurfaces | null {
    return surfaces;
}

export type TownDrawnGround = {height: number; nx: number; ny: number; nz: number};

/** The highest walk surface over a point and its triangle's normal (null: none there). */
function surfaceAt(x: number, z: number, own: TownWalkSurfaces | null): TownDrawnGround | null {
    if (!own || outside(x, z)) return null;
    const ci = Math.floor((x + TOWN_HALF) / CELL);
    const cj = Math.floor((z + TOWN_HALF) / CELL);
    const cell = cj * CELLS + ci;
    const t = own.tris;
    let best: TownDrawnGround | null = null;
    for (let k = own.offsets[cell]; k < own.offsets[cell + 1]; k++) {
        const o = own.items[k] * 9;
        const ax = t[o];
        const az = t[o + 2];
        const bx = t[o + 3];
        const bz = t[o + 5];
        const cx = t[o + 6];
        const cz = t[o + 8];
        const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(det) < 1e-12) continue;
        const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
        const w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
        const w2 = 1 - w0 - w1;
        const eps = -1e-6;
        if (w0 < eps || w1 < eps || w2 < eps) continue;
        const y = w0 * t[o + 1] + w1 * t[o + 4] + w2 * t[o + 7];
        if (best && y <= best.height) continue;
        // Its normal, facing up.
        const ux = bx - ax;
        const uy = t[o + 4] - t[o + 1];
        const uz = bz - az;
        const vx = cx - ax;
        const vy = t[o + 7] - t[o + 1];
        const vz = cz - az;
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1;
        const s = ny < 0 ? -1 / l : 1 / l;
        nx *= s;
        ny *= s;
        nz *= s;
        best = {height: y, nx, ny, nz};
    }
    return best;
}

/** The town's drawn ground's height at a point (m, local frame): the tile, or the walk surface on it. */
export function townDrawnHeight(x: number, z: number, own: TownWalkSurfaces | null = surfaces): number {
    const tile = townTileHeight(x, z);
    const top = surfaceAt(x, z, own);
    return top && top.height > tile ? top.height : tile;
}

/** The town's drawn ground with its normal (the tile's triangle's, or the walk surface's), local frame. */
export function townDrawnGround(x: number, z: number, own: TownWalkSurfaces | null = surfaces): TownDrawnGround {
    const top = surfaceAt(x, z, own);
    const tile = townTileHeight(x, z);
    if (top && top.height > tile) return top;
    // The tile's triangle's normal (flat shaded), from its two edges.
    const e = 0.05;
    const dx = (townTileHeight(x + e, z) - townTileHeight(x - e, z)) / (2 * e);
    const dz = (townTileHeight(x, z + e) - townTileHeight(x, z - e)) / (2 * e);
    const l = Math.hypot(dx, 1, dz);
    return {height: tile, nx: -dx / l, ny: 1 / l, nz: -dz / l};
}
