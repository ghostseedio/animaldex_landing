/**
 * A town bird's perch on a building is on the building's drawn roof, never in it (the owner, 2026-11-16: "i saw a bird
 * inside a house or roof").
 *
 * The roofs' and eaves' perches (`areas.ts` urbanSpots) took their heights from the plan's numbers: the ridge at the
 * building's `top`, an eave 0.2 m out from the wall at `eaves - 0.2`. The drawn roofs are thicker and overhang: an eave
 * perch stood inside the overhang's slab (every one of 144 houses' eave perches checked), and a ridge perch a few cm
 * into the ridge (48 of 72 houses'), so a pigeon or a gull resting there was drawn inside the roof.
 *
 * Each such perch is now lifted onto the highest drawn surface over its point within reach (`ROOF_REACH` above it),
 * found by a vertical line through the building's own solid triangles (`render/buildings.ts`, the same geometry the
 * town draws). Pure in the plan.
 */

import type {Building} from "@/ark-scene/islands/town/plan";
import {buildBuilding, newBuildingChunk} from "@/ark-scene/islands/town/render/buildings";

/** How far above a planned perch a drawn surface is looked for (m): the roof's thickness and ridge, not a tower over it. */
export const ROOF_REACH = 0.6;
/** How far below a planned perch (m): a perch over a roof that falls away under it is set down onto it. */
export const ROOF_DROP = 0.4;
/** Its feet this far over the surface (m). */
const ON = 0.01;

/** The heights of the solid's surfaces crossed by the vertical line at (x, z): flat triangles, positions in threes. */
export function surfacesAt(pos: ArrayLike<number>, x: number, z: number, out: number[] = []): number[] {
    out.length = 0;
    for (let i = 0; i + 8 < pos.length; i += 9) {
        const ax = pos[i], az = pos[i + 2];
        const bx = pos[i + 3], bz = pos[i + 5];
        const cx = pos[i + 6], cz = pos[i + 8];
        if ((x < ax && x < bx && x < cx) || (x > ax && x > bx && x > cx) || (z < az && z < bz && z < cz) || (z > az && z > bz && z > cz)) continue;
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(d) < 1e-9) continue;
        const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
        const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
        const w = 1 - u - v;
        if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
        out.push(u * pos[i + 1] + v * pos[i + 4] + w * pos[i + 7]);
    }
    return out;
}

/**
 * A perch's height on the drawn surface: the highest surface over its point from `ROOF_DROP` below to `ROOF_REACH`
 * above it, or the planned height when there is none (a ledge over open ground).
 */
export function perchOnSurface(pos: ArrayLike<number>, x: number, y: number, z: number): number {
    const heights = surfacesAt(pos, x, z);
    let best = Number.NEGATIVE_INFINITY;
    for (const h of heights) if (h >= y - ROOF_DROP && h <= y + ROOF_REACH && h > best) best = h;
    if (!Number.isFinite(best)) return y;
    // (A step up just over the surface found, a ridge cap or a coping on the slab: onto it too, a small bird's height at a time.)
    for (let lifted = true; lifted; ) {
        lifted = false;
        for (const h of heights) {
            if (h > best + 1e-4 && h < best + BIRD_ROOM) {
                best = h;
                lifted = true;
            }
        }
    }
    return best + ON;
}

/** The room a small bird needs over its perch (m): no drawn surface closer over it. */
export const BIRD_ROOM = 0.25;

/** The building's drawn solid (its walls and roof), positions only (not kept: asked once per building, then dropped). */
export function buildingSolid(b: Building): number[] {
    const chunk = newBuildingChunk(null);
    buildBuilding(chunk, b);
    return chunk.solid.pos;
}
