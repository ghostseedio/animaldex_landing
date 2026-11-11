/**
 * The town island on Part B's chunk grid (landing `ark-streaming`, docs/ark/streaming.md): the same shape as
 * `streaming/chunks.ts`'s `ChunkGrid` (48 of the ground's 1.1 m segments a chunk, 52.8 m), so the streamer takes the
 * town's grid, spans and content as they are once both land. Pure.
 *
 * The town's square is 9 × 9 chunks (475.2 m): every building, tree, prop and patch of ground belongs to the chunk its
 * middle falls in, and is built into that chunk's meshes (`render/index.ts`), so a chunk can be hidden or released
 * whole. Chunking never moves anything.
 */

import {TOWN_CHUNK_SEGMENTS, TOWN_CHUNKS, TOWN_HALF, TOWN_SEGMENTS} from "@/ark-scene/islands/town/plan";

/** Structurally Part B's `ChunkGrid`. */
export type TownChunkGrid = {originX: number; originZ: number; size: number; columns: number; rows: number; segments: number};
/** Structurally Part B's `ChunkSpan`. */
export type TownChunkSpan = {minY: number; maxY: number};

export const TOWN_GRID: TownChunkGrid = {
    originX: -TOWN_HALF,
    originZ: -TOWN_HALF,
    size: (TOWN_HALF * 2) / TOWN_CHUNKS,
    columns: TOWN_CHUNKS,
    rows: TOWN_CHUNKS,
    segments: TOWN_CHUNK_SEGMENTS
};

export const TOWN_CHUNK_COUNT = TOWN_CHUNKS * TOWN_CHUNKS;
export {TOWN_SEGMENTS};

/** The chunk a point falls in (off the grid: the nearest edge chunk), as Part B's `chunkOf`. */
export function townChunkOf(x: number, z: number): number {
    const g = TOWN_GRID;
    const column = Math.min(Math.max(Math.floor((x - g.originX) / g.size), 0), g.columns - 1);
    const row = Math.min(Math.max(Math.floor((z - g.originZ) / g.size), 0), g.rows - 1);
    return row * g.columns + column;
}

export function townChunkRect(key: number): [number, number, number, number] {
    const g = TOWN_GRID;
    const x = g.originX + (key % g.columns) * g.size;
    const z = g.originZ + Math.floor(key / g.columns) * g.size;
    return [x, z, x + g.size, z + g.size];
}

/** Distance from a point to a chunk's box (Part B's `distanceToChunk`). */
export function townChunkDistance(key: number, x: number, y: number, z: number, span: TownChunkSpan): number {
    const [minX, minZ, maxX, maxZ] = townChunkRect(key);
    const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
    const dz = z < minZ ? minZ - z : z > maxZ ? z - maxZ : 0;
    const dy = y < span.minY ? span.minY - y : y > span.maxY ? y - span.maxY : 0;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
