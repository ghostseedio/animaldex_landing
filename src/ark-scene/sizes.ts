/**
 * How big each animal stands in the world: true to life (motion pass §3,
 * `docs/ark/true-scale.md`). The models are all one unit long, head toward
 * +z (`ark.json` `extent`), so the size comes from the data alone
 * (`stats.ts` `arkBody`):
 *
 * - its body length: the catalogue's stored measurement where there is one,
 *   else the data-gap value, else the size stat through the catalogue's mass
 *   anchors (an estimate, labelled as one);
 * - drawn at that length, in the world's metres (the trees, rocks, fences
 *   and the cottage are metres too): no curve, no floor, no cap. A blue whale
 *   is 25 m, a house mouse 8 cm. The model is scaled by `drawn / its extent
 *   along its body-length axis` (`stats.ts` `bodyAxisExtent`); a mammal whose
 *   rig found a tail is drawn so its head and body match, the tail as modelled.
 *
 * A small animal is found by its marker: any animal drawn smaller than
 * `MARKER_BELOW_PIXELS` on screen (from afar, or a beetle a few metres off)
 * gets a soft dot over it, and its icon once tapped; close by it is drawn at
 * its true size and found by looking.
 */

import {arkBody, type ArkStatsSource} from "@/ark-scene/stats";

/** Plans that live in water and float at the surface when their zone is water. */
export const SWIMMING_PLANS = new Set(["fish", "ray", "cetacean", "turtle", "jellyfish", "cephalopod"]);

/** The length an animal is drawn at, in metres: its true length along its model's body axis. `plan` only matters for a species the catalogue lacks. */
export function displayLength(animal: ArkStatsSource | string, plan?: string | null): number {
    return arkBody(typeof animal === "string" ? {model_slug: animal} : animal, plan).display;
}

/** Drawn smaller than this on screen (CSS px), an animal also gets a marker so it can be found. */
export const MARKER_BELOW_PIXELS = 5;

/** CSS pixels a length (m) covers on screen at `distance` (m), for a vertical field of view and a viewport height. */
export function screenPixels(length: number, distance: number, viewportHeight: number, fovDegrees: number): number {
    return (length * viewportHeight) / (2 * Math.tan((fovDegrees * Math.PI) / 360) * Math.max(distance, 0.01));
}

/**
 * The order the scene hands out its models in, most first: how large the animal is on screen (its drawn length over
 * its distance), so a whale or an elephant far off keeps its model before a beetle near by, which is a few pixels
 * across and only needs its marker.
 */
export function screenWeight(length: number, distance: number): number {
    return length / Math.max(distance, 0.5);
}

/** On screen this many CSS px or more, an animal gets its near model however far off it is (a whale across the bay). */
export const NEAR_BY_SIZE_PIXELS = 220;

/** Whether an animal is large enough on screen for its near model, whatever its distance (true scale: a 25 m whale at 80 m). */
export function nearBySize(length: number, distance: number, viewportHeight: number, fovDegrees: number): boolean {
    return screenPixels(length, distance, viewportHeight, fovDegrees) >= NEAR_BY_SIZE_PIXELS;
}

/** Whether an animal past the model cap is shown by its marker (too small on screen for an icon to mean anything) rather than its icon. */
export function markerNotIcon(pixels: number): boolean {
    return pixels < MARKER_BELOW_PIXELS * 2;
}

/** An icon's size (m) for an animal past the model cap: its own size, not a floor (a beetle's icon is a beetle's size). */
export function iconSize(length: number): number {
    return length * 1.1;
}
