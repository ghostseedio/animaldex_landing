/**
 * The wild island's frame (Part C, docs/ark/wild-island.md): its terrain square on Part B's chunk grid. Pure.
 *
 * Part B's chunk is 48 of the ground's 1.1 m segments (52.8 m; `streaming/chunks.ts` CHUNK_SEGMENTS), one grid for
 * both islands (decision 63). Decision 21 asked for a 512 m square of 8 × 8 of the plan's 64 m chunks; on Part B's grid
 * the nearest square is 10 × 10 chunks, 528 m (half 264, exactly twice today's 264 m square), so the island's ~390 m of
 * land keeps 60–80 m of its own sea all round for the reef lagoon, the kelp and the drop-off.
 *
 * x east, z south, y up, metres; the opening camera looks north from the southern sea, as on today's island.
 */

/** Half the terrain square (m). */
export const WILD_HALF = 264;
/** The ground's segments across (1.1 m each). */
export const WILD_SEGMENTS = 480;
/** The ground's spacing (m). */
export const WILD_SEGMENT = (WILD_HALF * 2) / WILD_SEGMENTS;
/** Part B: ground segments per chunk. */
export const WILD_CHUNK_SEGMENTS = 48;
/** Chunks across. */
export const WILD_CHUNKS = WILD_SEGMENTS / WILD_CHUNK_SEGMENTS;
export const WILD_CHUNK_COUNT = WILD_CHUNKS * WILD_CHUNKS;

/** Structurally Part B's `ChunkGrid` (`streaming/chunks.ts` chunkGridFor(WILD_HALF, WILD_SEGMENTS)). */
export type WildChunkGrid = {originX: number; originZ: number; size: number; columns: number; rows: number; segments: number};
/** Structurally Part B's `ChunkSpan`. */
export type WildChunkSpan = {minY: number; maxY: number};

export const WILD_GRID: WildChunkGrid = {
    originX: -WILD_HALF,
    originZ: -WILD_HALF,
    size: WILD_SEGMENT * WILD_CHUNK_SEGMENTS,
    columns: WILD_CHUNKS,
    rows: WILD_CHUNKS,
    segments: WILD_CHUNK_SEGMENTS
};

/** The chunk a point falls in (off the grid: the nearest edge chunk), as Part B's `chunkOf`. */
export function wildChunkOf(x: number, z: number): number {
    const g = WILD_GRID;
    const column = Math.min(Math.max(Math.floor((x - g.originX) / g.size), 0), g.columns - 1);
    const row = Math.min(Math.max(Math.floor((z - g.originZ) / g.size), 0), g.rows - 1);
    return row * g.columns + column;
}

/** A chunk's square: [minX, minZ, maxX, maxZ]. */
export function wildChunkRect(key: number): [number, number, number, number] {
    const g = WILD_GRID;
    const x = g.originX + (key % g.columns) * g.size;
    const z = g.originZ + Math.floor(key / g.columns) * g.size;
    return [x, z, x + g.size, z + g.size];
}

/** Distance from a point to a chunk's box (Part B's `distanceToChunk`). */
export function wildChunkDistance(key: number, x: number, y: number, z: number, span: WildChunkSpan): number {
    const [minX, minZ, maxX, maxZ] = wildChunkRect(key);
    const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
    const dz = z < minZ ? minZ - z : z > maxZ ? z - maxZ : 0;
    const dy = y < span.minY ? span.minY - y : y > span.maxY ? y - span.maxY : 0;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
