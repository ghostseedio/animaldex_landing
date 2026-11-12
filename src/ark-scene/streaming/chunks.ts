/**
 * The world in chunks (Part B, docs/ark/streaming.md). Pure: no three.js, no DOM, so the tests, the workers and the
 * scene share it.
 *
 * The grid is the ground's own: a chunk is `CHUNK_SEGMENTS` of the terrain's segments square (48 × 1.1 m = 52.8 m on
 * today's island), its edges on the ground's grid lines, so a terrain tile is exactly the ground's vertices inside
 * its chunk and a chunked picture is the unchunked one. Chunking never moves anything: it only decides what is
 * drawn and what is kept loaded; every position stays a pure function of the shared clock and the ids.
 *
 * A chunk is `in` (within the render distance: everything drawn, at full detail), `map` (beyond it, within the
 * tier's map distance, or anywhere on an island the camera is not over: the ground and the trees, animals as markers)
 * or `out` (past the map distance: nothing drawn, the haze has already hidden it). Going `in` happens at the render
 * distance; going back out only past it plus a margin (hysteresis), so a camera resting on a boundary does not
 * flicker chunks in and out. Several islands each have their own grid, placed in the world by an offset
 * (`streaming/index.ts`).
 */

export type ChunkGrid = {
    /** World x and z of the grid's first corner (the terrain's -half). */
    originX: number;
    originZ: number;
    /** A chunk's side (m). */
    size: number;
    columns: number;
    rows: number;
    /** The ground's segments per chunk (a terrain tile's side in segments). */
    segments: number;
};

export type ChunkState = "in" | "map" | "out";

/** A chunk's vertical reach, for the distance to it: the ground's lowest and highest, plus room for what stands on it. */
export type ChunkSpan = {minY: number; maxY: number};

/** Terrain segments per chunk side. */
export const CHUNK_SEGMENTS = 48;
/** Above the ground's highest point: trees, animals in the air, a flyer's circle. */
export const CHUNK_HEADROOM = 30;

/** The grid over a square terrain `half` m from the origin each way, `segments` across, `perChunk` segments a chunk. */
export function chunkGridFor(half: number, segments: number, perChunk = CHUNK_SEGMENTS): ChunkGrid {
    const segment = (half * 2) / segments;
    const count = Math.max(1, Math.ceil(segments / perChunk));
    return {originX: -half, originZ: -half, size: segment * perChunk, columns: count, rows: count, segments: perChunk};
}

export function chunkCount(grid: ChunkGrid): number {
    return grid.columns * grid.rows;
}

/** The chunk a world point falls in (a point off the grid: the nearest edge chunk, so a sea animal far out still has one). */
export function chunkOf(grid: ChunkGrid, x: number, z: number): number {
    const column = Math.min(Math.max(Math.floor((x - grid.originX) / grid.size), 0), grid.columns - 1);
    const row = Math.min(Math.max(Math.floor((z - grid.originZ) / grid.size), 0), grid.rows - 1);
    return row * grid.columns + column;
}

export function chunkColumn(grid: ChunkGrid, key: number): number {
    return key % grid.columns;
}

export function chunkRow(grid: ChunkGrid, key: number): number {
    return Math.floor(key / grid.columns);
}

/** A chunk's square on the ground: [minX, minZ, maxX, maxZ]. */
export function chunkRect(grid: ChunkGrid, key: number): [number, number, number, number] {
    const x = grid.originX + chunkColumn(grid, key) * grid.size;
    const z = grid.originZ + chunkRow(grid, key) * grid.size;
    return [x, z, x + grid.size, z + grid.size];
}

/** Distance (m) from a point to the nearest point of a chunk's box (its square, from its span's bottom to its top). */
export function distanceToChunk(grid: ChunkGrid, key: number, x: number, y: number, z: number, span: ChunkSpan): number {
    const [minX, minZ, maxX, maxZ] = chunkRect(grid, key);
    const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
    const dz = z < minZ ? minZ - z : z > maxZ ? z - maxZ : 0;
    const dy = y < span.minY ? span.minY - y : y > span.maxY ? y - span.maxY : 0;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Distance (m) from a point to the farthest corner of a chunk's box. */
export function farthestInChunk(grid: ChunkGrid, key: number, x: number, y: number, z: number, span: ChunkSpan): number {
    const [minX, minZ, maxX, maxZ] = chunkRect(grid, key);
    const dx = Math.max(Math.abs(x - minX), Math.abs(x - maxX));
    const dz = Math.max(Math.abs(z - minZ), Math.abs(z - maxZ));
    const dy = Math.max(Math.abs(y - span.minY), Math.abs(y - span.maxY));
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export type ChunkView = {
    /** The camera's eye, in the island's own frame. */
    x: number;
    y: number;
    z: number;
    /** The render distance now (m): within it a chunk is drawn in full. */
    distance: number;
    /** The margin past it before an `in` chunk goes (m). */
    hysteresis: number;
    /** Past the render distance and within this (m), a chunk is drawn in map style; past it, not at all. */
    mapDistance: number;
    /**
     * Not the island the camera is over: its chunks are map style, never in and never out (the other island across the
     * strait stays in the picture, decision 141, whatever the map distance: on v2's farther view at the low tier the
     * map distance left most of the town out).
     */
    capMap?: boolean;
};

/**
 * Each chunk's state for a view, from the states before (hysteresis): `in` within `distance` (or `distance +
 * hysteresis` if it was `in`), unless the island is capped at map style; else `map` within `mapDistance` (plus the
 * hysteresis if it was drawn), or anywhere on a capped island; else `out`. Pure.
 */
export function chunkStates(grid: ChunkGrid, spans: ChunkSpan[], view: ChunkView, before: ArrayLike<number> | null, into?: Uint8Array): Uint8Array {
    const n = chunkCount(grid);
    const out = into && into.length === n ? into : new Uint8Array(n);
    for (let key = 0; key < n; key++) {
        const d = distanceToChunk(grid, key, view.x, view.y, view.z, spans[key] ?? DEFAULT_SPAN);
        const was = before ? before[key] : STATE_OUT;
        const within = !view.capMap && (d <= view.distance || (was === STATE_IN && d <= view.distance + view.hysteresis));
        const mapped = view.capMap || d <= view.mapDistance || (was !== STATE_OUT && was !== undefined && before !== null && d <= view.mapDistance + view.hysteresis);
        out[key] = within ? STATE_IN : mapped ? STATE_MAP : STATE_OUT;
    }
    return out;
}

export const STATE_OUT = 0;
export const STATE_MAP = 1;
export const STATE_IN = 2;
export const DEFAULT_SPAN: ChunkSpan = {minY: -12, maxY: 50 + CHUNK_HEADROOM};

export function stateName(code: number): ChunkState {
    return code === STATE_IN ? "in" : code === STATE_MAP ? "map" : "out";
}

/**
 * How strongly the edge haze is on (0…1): only when something with content lies past `distance` (the map distance:
 * nothing nearer is ever hidden), so a world that fits inside it looks exactly as it did; ramped over `ramp` m of that
 * reach so it never pops. Never in the map view.
 */
export function hazeStrength(farthestContent: number, distance: number, map: boolean, ramp = 25): number {
    if (map || !(farthestContent > distance - ramp)) return 0;
    return Math.min(Math.max((farthestContent - (distance - ramp)) / ramp, 0), 1);
}

/** The farthest point of any chunk holding content, from the eye (m); 0 if none does. */
export function farthestContent(grid: ChunkGrid, spans: ChunkSpan[], content: ArrayLike<number>, x: number, y: number, z: number): number {
    let far = 0;
    const n = chunkCount(grid);
    for (let key = 0; key < n; key++) {
        if (!content[key]) continue;
        far = Math.max(far, farthestInChunk(grid, key, x, y, z, spans[key] ?? DEFAULT_SPAN));
    }
    return far;
}

/**
 * The tile ranges of the ground's grid for a chunk: rows and columns of vertices [from, to] inclusive, so neighbouring
 * tiles share their edge vertices (no gaps, no T-junctions at the same stride).
 */
export function tileRange(grid: ChunkGrid, key: number, groundSegments: number): {col0: number; col1: number; row0: number; row1: number} {
    const column = chunkColumn(grid, key);
    const row = chunkRow(grid, key);
    const col0 = Math.min(column * grid.segments, groundSegments);
    const row0 = Math.min(row * grid.segments, groundSegments);
    return {col0, col1: Math.min(col0 + grid.segments, groundSegments), row0, row1: Math.min(row0 + grid.segments, groundSegments)};
}
