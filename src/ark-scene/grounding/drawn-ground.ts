/**
 * The ground as it is drawn (motion 100x pass, lane L3: "animals float or sink").
 *
 * The terrain is drawn as one mesh (`terrain.ts` groundArrays): a 240 × 240 grid of 1.1 m cells over the
 * 264 m square, each vertex at `sampleGround`'s height, each cell cut into two triangles along the diagonal
 * from its (x, z + 1) corner to its (x + 1, z) corner. Between vertices the drawn ground is those flat
 * triangles, not the analytic ground the schedule and placement read (`world-sampler.ts` reads the analytic
 * height on a 0.5 m lattice, bilinearly): on a ridge the triangles cut under it and an animal stood on the
 * analytic height floats; in a hollow they bridge over it and it sinks. Here is the drawn triangle's height
 * at any point, exactly as the mesh has it (float32 vertex positions and heights, the same triangle split),
 * its normal, and how far the drawn ground is from the analytic one.
 *
 * Pure and shared: every viewer's drawn ground is the same mesh. Vertex heights are worked out the first
 * time a cell is asked for (`sampleGround`, the same call `groundArrays` makes) and kept.
 * `src/lib/ark-grounding.test.ts` holds this against `groundArrays()` itself, so a change to the terrain's
 * grid fails there first.
 */

import {sampleGround, TERRAIN_HALF} from "@/ark-scene/world";

/** `terrain.ts` SEGMENTS: the drawn ground's cells along a side. */
export const DRAWN_GROUND_SEGMENTS = 240;
const SIZE = DRAWN_GROUND_SEGMENTS + 1;
const SEGMENT = (TERRAIN_HALF * 2) / DRAWN_GROUND_SEGMENTS;

let heights: Float32Array | null = null;

/** A vertex's height, as the mesh stores it (its x and z rounded to float32 as `groundArrays` stores them, then sampled). */
function vertex(column: number, row: number): number {
    heights ??= new Float32Array(SIZE * SIZE).fill(Number.NaN);
    const k = row * SIZE + column;
    let h = heights[k];
    if (Number.isNaN(h)) {
        const x = Math.fround(column * SEGMENT - TERRAIN_HALF);
        const z = Math.fround(row * SEGMENT - TERRAIN_HALF);
        h = heights[k] = sampleGround(x, z).height;
    }
    return h;
}

/**
 * Prime the vertex heights from the drawn mesh's own positions (`GroundArrays.positions`, x y z per vertex in
 * the grid's order) so nothing is sampled twice. Optional: without it the heights are sampled on demand and
 * come out the same.
 */
export function primeDrawnGround(positions: ArrayLike<number> | null): void {
    if (!positions || positions.length !== SIZE * SIZE * 3) return;
    heights = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) heights[i] = positions[i * 3 + 1];
}

export type DrawnGround = {height: number; nx: number; ny: number; nz: number};

/** Off the mesh (out at sea past the terrain square) the analytic ground stands in. */
function outside(x: number, z: number): boolean {
    return x <= -TERRAIN_HALF || z <= -TERRAIN_HALF || x >= TERRAIN_HALF || z >= TERRAIN_HALF;
}

/** The drawn ground's height at a point (m). */
export function drawnGroundHeight(x: number, z: number): number {
    if (outside(x, z)) return sampleGround(x, z).height;
    const fx = (x + TERRAIN_HALF) / SEGMENT;
    const fz = (z + TERRAIN_HALF) / SEGMENT;
    const column = Math.min(Math.floor(fx), DRAWN_GROUND_SEGMENTS - 1);
    const row = Math.min(Math.floor(fz), DRAWN_GROUND_SEGMENTS - 1);
    const u = fx - column;
    const v = fz - row;
    // a (c, r), b (c, r + 1), c (c + 1, r + 1), d (c + 1, r); triangles a-b-d (u + v ≤ 1) and b-c-d.
    if (u + v <= 1) {
        const a = vertex(column, row);
        return a + (vertex(column + 1, row) - a) * u + (vertex(column, row + 1) - a) * v;
    }
    const c = vertex(column + 1, row + 1);
    return c + (vertex(column, row + 1) - c) * (1 - u) + (vertex(column + 1, row) - c) * (1 - v);
}

/** The drawn ground's height and its (flat-shaded) triangle's normal at a point. */
export function drawnGround(x: number, z: number): DrawnGround {
    if (outside(x, z)) {
        const e = 0.25;
        const h = sampleGround(x, z).height;
        const dx = (sampleGround(x + e, z).height - sampleGround(x - e, z).height) / (2 * e);
        const dz = (sampleGround(x, z + e).height - sampleGround(x, z - e).height) / (2 * e);
        const l = Math.hypot(dx, 1, dz);
        return {height: h, nx: -dx / l, ny: 1 / l, nz: -dz / l};
    }
    const fx = (x + TERRAIN_HALF) / SEGMENT;
    const fz = (z + TERRAIN_HALF) / SEGMENT;
    const column = Math.min(Math.floor(fx), DRAWN_GROUND_SEGMENTS - 1);
    const row = Math.min(Math.floor(fz), DRAWN_GROUND_SEGMENTS - 1);
    const u = fx - column;
    const v = fz - row;
    let dx: number;
    let dz: number;
    let height: number;
    if (u + v <= 1) {
        const a = vertex(column, row);
        dx = (vertex(column + 1, row) - a) / SEGMENT;
        dz = (vertex(column, row + 1) - a) / SEGMENT;
        height = a + dx * SEGMENT * u + dz * SEGMENT * v;
    } else {
        const c = vertex(column + 1, row + 1);
        dx = (c - vertex(column, row + 1)) / SEGMENT;
        dz = (c - vertex(column + 1, row)) / SEGMENT;
        height = c - dx * SEGMENT * (1 - u) - dz * SEGMENT * (1 - v);
    }
    const l = Math.hypot(dx, 1, dz);
    return {height, nx: -dx / l, ny: 1 / l, nz: -dz / l};
}
