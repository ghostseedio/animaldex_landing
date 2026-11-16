/**
 * A floater drawn from its place, not its schedule (p3, lane ZOOFIX; the coordinator's frame: a mallard on the town's
 * canal stood ON the water, legs and feet showing). The schedule's pose floats a duck at its float line on any water
 * (`index.ts` fromSchedule); a town animal drawn at its place (before its schedule is in, walked off its spot, or as a
 * far figure) stood at its place's height, which on the town's waters is the surface (`town/placement.ts`: every town
 * water is above the sea), or on the bed under it. Here: a floater (its band's motion "float": a duck, a goose, a swan,
 * a coot) over water rides at its kind's float line, its feet under the surface; anything else, or no water, null.
 */

import {fitInWater, waterMotion, waterSpec, type SpeciesDepth, type WaterSpec} from "@/ark-scene/sea-depth";

/** Its float on water whose surface is `surface` over a bed at `ground`: its base (lowest point) at its float line and the water spec the rig reads (its float idle, its paddle), or null. */
export function floatOver(band: SpeciesDepth | null | undefined, ground: number, surface: number, tall: number): {base: number; water: WaterSpec} | null {
    if (!band || waterMotion(band) !== "float" || !(ground < surface - 0.05)) return null;
    const water = waterSpec(band, ground, 0, 0, 0, surface);
    return {base: fitInWater(water, tall).base, water};
}
