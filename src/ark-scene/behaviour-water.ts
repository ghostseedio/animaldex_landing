/**
 * The water's surface as the behaviour system reads it (Part C): the world's own (`ArkWorldSampler.waterSurface`: the
 * bigger wild island's lake and river stand above the sea at their own level), else 0, the sea's, where all of today's
 * island's and the town's water is. Every test of "in the water", "on it" or "above it" in the schedule and the
 * recipes measures from this, so on today's island each reads exactly as it did.
 */

import type {ArkWorldSampler} from "@/ark-scene/world-sampler";

type Sampler = Pick<ArkWorldSampler, "heightAt" | "waterSurface">;

/** The water's surface over a point (m): 0 unless the world says otherwise. */
export function waterSurfaceOf(sampler: Sampler, x: number, z: number): number {
    return sampler.waterSurface ? sampler.waterSurface(x, z) : 0;
}

/** What stands there: the ground, or the water's surface over it. */
export function topOf(sampler: Sampler, x: number, z: number): number {
    return Math.max(sampler.heightAt(x, z), waterSurfaceOf(sampler, x, z));
}
