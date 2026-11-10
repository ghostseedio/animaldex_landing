/**
 * How big each animal stands in the world. The models are all about one
 * unit on their longest side (`ark.json` `extent`), so the size comes from
 * the data alone (`stats.ts` `arkBody`):
 *
 * - its body length L: the stored measurement where there is one, else
 *   from the size stat through the catalogue's mass anchors
 *   (`L = 0.33 · mass^(1/3)`, an estimate);
 * - drawn at `D = clamp(1.2 · L^0.6, 0.18, 9)` metres, so a mouse is still
 *   seen beside an elephant and a whale doesn't swallow the bay; the model
 *   is scaled by `D / its longest side`.
 *
 * Below the floor the animal also gets a small marker so it can be found.
 */

import {arkBody, type ArkStatsSource} from "@/ark-scene/stats";

/** Plans that live in water and float at the surface when their zone is water. */
export const SWIMMING_PLANS = new Set(["fish", "ray", "cetacean", "turtle", "jellyfish", "cephalopod"]);

/** The length an animal is drawn at, in metres. `plan` only matters for a species the catalogue lacks. */
export function displayLength(animal: ArkStatsSource | string, plan?: string | null): number {
    return arkBody(typeof animal === "string" ? {model_slug: animal} : animal, plan).display;
}
