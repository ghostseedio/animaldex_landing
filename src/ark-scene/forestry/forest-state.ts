/**
 * Logging and replanting on the wild island, as drawn (owner 2026-11-17; AnimalDex decision 379). What every tree in a
 * logging's stand looks like at a moment: standing, falling (a few seconds as the felling front reaches it), lying felled
 * until it is hauled away, a stump, then a sapling growing back into the tree it replaces. A pure function of the shared
 * Ark day and the shared forestry module (`positions/forestry.ts`, the server's own copy), so every viewer sees the same
 * tree fall at the same moment, and the server's deaths (the front reaching an animal's home) line up with it.
 *
 * The crews (who fells, who plants) are drawn from the same numbers: `forest-crews.ts`.
 */

import {ARK_DAY_MS} from "@/lib/ark-clock";
import {cutDay, forestUnit, frontShare, growthAt, HAUL_DAYS, HABITAT_GROWTH, inStand, plantDay, type Logging} from "@/ark-scene/positions/forestry";

/** A tree's fall, from upright to lying (real seconds): seen only by a viewer watching at that moment. */
export const FALL_SECONDS = 4;
/** The fall in Ark days. */
export const FALL_DAYS = (FALL_SECONDS * 1000) / ARK_DAY_MS;
/** A sapling's size at planting, as a share of the grown tree. */
export const SAPLING_SCALE = 0.1;
/** The sapling stands this far (m) from its stump, toward the stand's middle, so the two never share a place. */
export const SAPLING_ASIDE = 0.7;

export type TreeFate =
    | {state: "standing"}
    /** `fall` 0 upright … 1 on the ground; `dir` the heading it falls toward (radians, x = cos, z = sin). */
    | {state: "falling"; fall: number; dir: number}
    | {state: "log"; dir: number}
    | {state: "stump"}
    /** A sapling at `growth` (0 just planted … 1 grown); its stump still there until it is grown. */
    | {state: "sapling"; growth: number; stump: boolean};

/** The heading a tree at (x, z) falls toward: the way the front travels, a little either side by the tree. */
export function fallHeading(g: Logging, x: number, z: number): number {
    return g.bearing + Math.PI + (forestUnit(`fall#${g.k}#${Math.round(x * 10)}#${Math.round(z * 10)}`) - 0.5) * 0.9;
}

const smooth = (k: number) => {
    const c = Math.min(Math.max(k, 0), 1);
    // An accelerating topple: slow at first, fast at the end (a tree hinging over its cut).
    return c * c * c;
};

/** A tree at (x, z) at Ark day `day` under logging `g` (standing when outside the stand). */
export function treeFate(g: Logging, x: number, z: number, day: number): TreeFate {
    if (!inStand(g, x, z)) return {state: "standing"};
    const cut = cutDay(g, x, z);
    if (day < cut) return {state: "standing"};
    const dir = fallHeading(g, x, z);
    if (day < cut + FALL_DAYS) return {state: "falling", fall: smooth((day - cut) / FALL_DAYS), dir};
    if (day < cut + HAUL_DAYS) return {state: "log", dir};
    const growth = growthAt(g, x, z, day);
    if (growth < 0) return {state: "stump"};
    return {state: "sapling", growth, stump: growth < 1};
}

/** Where a tree's sapling stands: beside its stump, toward the stand's middle. */
export function saplingSpot(g: Logging, x: number, z: number): {x: number; z: number} {
    const dx = g.stand.x - x;
    const dz = g.stand.z - z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 1e-3) return {x: x + SAPLING_ASIDE, z};
    return {x: x + (dx / d) * SAPLING_ASIDE, z: z + (dz / d) * SAPLING_ASIDE};
}

/** A sapling's drawn size (share of the grown tree) at its growth. */
export function saplingScale(growth: number): number {
    return SAPLING_SCALE + (1 - SAPLING_SCALE) * Math.min(Math.max(growth, 0), 1);
}

/**
 * How bare the stand's ground is at `day` (0 forest floor … 1 freshly cleared): it bares as the front crosses, stays bare
 * through planting, and greens back as the saplings reach the habitat's share (`HABITAT_GROWTH`) and on to grown.
 */
export function bareness(g: Logging, day: number): number {
    if (day < g.start) return 0;
    const crossed = Math.min((day - g.start) / Math.max(cutDay(g, g.stand.x, g.stand.z) - g.start, 1e-6) / 2, 1);
    const mid = growthAt(g, g.stand.x, g.stand.z, day);
    if (mid < 0) return crossed;
    return Math.max(0, 1 - mid / Math.max(HABITAT_GROWTH * 1.6, 1e-6));
}

/** Whether anything in the stand moves fast enough at `day` to need drawing every frame (a tree mid-fall). */
export function fallingNow(g: Logging, trees: ReadonlyArray<{x: number; z: number}>, day: number): boolean {
    for (const t of trees) {
        const cut = cutDay(g, t.x, t.z);
        if (day >= cut && day < cut + FALL_DAYS) return true;
    }
    return false;
}

/** The share of the stand the front has crossed at `day` (0 … 1). */
export function frontAt(g: Logging, day: number): number {
    return Math.min(Math.max(day - g.start, 0), 1);
}

export {frontShare, plantDay};
