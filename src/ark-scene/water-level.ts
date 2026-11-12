/**
 * Where the water's surface is (graphics pass, batch 5). The sea rises and
 * falls with the tide (`ark-clock.ts` seaLevelAt); the lake and the river keep
 * their own fixed level, whatever the tide does. The ground shader, the two
 * water meshes (`terrain.ts`) and the sampler all use this one rule, so an
 * animal floats on the surface that is drawn.
 *
 * Pure: no three.js.
 */

import {arkWorld, LAKE, sampleGround, smoothstep, type GroundSample} from "@/ark-scene/world";

/** The lake's and the river's surface (m), fixed (today's world; the v2 world's descends with its river: `freshLevelAt`). */
export const FRESH_LEVEL = 0;

/** The v2 world's sample carries its own fresh water (`islands/wild/ground.ts`): how much, and its surface. */
type V2Fresh = {fresh?: number; freshLevel?: number | null};

/** How much a point is fresh water (0…1; 0.5 and up is drawn as the lake or river), from its ground sample. */
export function freshFrom(sample: Pick<GroundSample, "river" | "inland">, x: number, z: number): number {
    if (arkWorld() === "v2") return (sample as V2Fresh).fresh ?? 0;
    const lake = smoothstep(LAKE.r + 4, LAKE.r, Math.hypot(x - LAKE.x, z - LAKE.z));
    const river = sample.river < 5 && sample.inland > 4 ? 1 : 0;
    return Math.min(lake + river, 1);
}

export function freshWaterAt(x: number, z: number): number {
    return freshFrom(sampleGround(x, z), x, z);
}

/** The fresh water's surface over a point (m): today's world's fixed level; v2's lake's or river's own level there (the river descends). */
export function freshLevelAt(x: number, z: number): number {
    if (arkWorld() !== "v2") return FRESH_LEVEL;
    return freshLevelFrom(sampleGround(x, z));
}

/** `freshLevelAt` from a ground sample already taken there (no second sample). */
export function freshLevelFrom(sample: GroundSample): number {
    if (arkWorld() !== "v2") return FRESH_LEVEL;
    return (sample as V2Fresh).freshLevel ?? FRESH_LEVEL;
}

/**
 * Part C (lane TB): another island's own water, inside its square: its surface over a point (the town's canal, ponds and
 * pools at their own levels), its ground's height where there is no water, or null where its water is the sea's.
 * Unset (one island, or before the town is in): every answer below is exactly as before.
 */
export type IslandWater = {
    /** Trip planning (`waterLevelAt`): the water's level, the ground's height on dry land, null at sea (the tide's). */
    level: (x: number, z: number) => number | null;
    /** Every frame (`sea-depth.ts` waterSurfaceAt): the water's level, or null (the sea's, and dry land's: no water over it). */
    surface: (x: number, z: number) => number | null;
};

let islandWater: IslandWater | null = null;

export function setIslandWater(water: IslandWater | null): void {
    islandWater = water;
}

export function islandWaterNow(): IslandWater | null {
    return islandWater;
}

/** The water's surface over a point: the lake's or river's level there, else the sea's level now. */
export function waterLevelAt(x: number, z: number, seaLevel: number): number {
    const own = islandWater ? islandWater.level(x, z) : null;
    if (own !== null) return own;
    return freshWaterAt(x, z) >= 0.5 ? freshLevelAt(x, z) : seaLevel;
}
