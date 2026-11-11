/**
 * Where the water's surface is (graphics pass, batch 5). The sea rises and
 * falls with the tide (`ark-clock.ts` seaLevelAt); the lake and the river keep
 * their own fixed level, whatever the tide does. The ground shader, the two
 * water meshes (`terrain.ts`) and the sampler all use this one rule, so an
 * animal floats on the surface that is drawn.
 *
 * Pure: no three.js.
 */

import {LAKE, sampleGround, smoothstep, type GroundSample} from "@/ark-scene/world";

/** The lake's and the river's surface (m), fixed. */
export const FRESH_LEVEL = 0;

/** How much a point is fresh water (0…1; 0.5 and up is drawn as the lake or river), from its ground sample. */
export function freshFrom(sample: Pick<GroundSample, "river" | "inland">, x: number, z: number): number {
    const lake = smoothstep(LAKE.r + 4, LAKE.r, Math.hypot(x - LAKE.x, z - LAKE.z));
    const river = sample.river < 5 && sample.inland > 4 ? 1 : 0;
    return Math.min(lake + river, 1);
}

export function freshWaterAt(x: number, z: number): number {
    return freshFrom(sampleGround(x, z), x, z);
}

/** The water's surface over a point: the lake's or river's fixed level there, else the sea's level now. */
export function waterLevelAt(x: number, z: number, seaLevel: number): number {
    return freshWaterAt(x, z) >= 0.5 ? FRESH_LEVEL : seaLevel;
}
