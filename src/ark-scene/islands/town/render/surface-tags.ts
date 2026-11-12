/**
 * What a town decal is made of (lane GA): each decal vertex carries one float (`Geo.extra`, the `aTag` attribute) that
 * the paving shader (`render/surfaces.ts`) reads as
 *
 *     tag = surface × 8 + (alongZ ? 4 : 0) + (across + 1)
 *
 * - `surface`: one of `SURF` (0, plain, is the old flat vertex colour: anything untagged draws as before);
 * - `alongZ`: the surface's rows (slabs, kerbs, setts) run along the town's z axis, not x;
 * - `across`: −1 to 1 across a street (its kerb to kerb), so the shader knows its wheel tracks, its crown and its
 *   gutters; 0 on a flat patch.
 *
 * All three vertices of a triangle share `surface` and `alongZ`, so the interpolated tag never crosses a surface.
 */

import type {Geo} from "@/ark-scene/islands/town/render/kit";

export const SURF = {
    plain: 0,
    asphalt: 1,
    paint: 2,
    slabs: 3,
    setts: 4,
    gravel: 5,
    blocks: 6,
    earth: 7,
    sand: 8,
    crop: 9,
    grass: 10,
    kerb: 11,
    flags: 12,
    manhole: 13,
    grate: 14
} as const;

export type SurfaceId = (typeof SURF)[keyof typeof SURF];

export function surfaceTag(surface: SurfaceId, alongZ = false, across = 0): number {
    return surface * 8 + (alongZ ? 4 : 0) + (Math.min(Math.max(across, -1), 1) + 1);
}

/** Whether a frame turned `rot` (its local x along (cos, sin)) has its rows along z. */
export function alongZ(rot: number): boolean {
    return Math.abs(Math.sin(rot)) > Math.abs(Math.cos(rot));
}

/** Draws `draw` into `geo` with its tag set to a surface (flat: across 0), then puts the tag back. */
export function tagged(geo: Geo, surface: SurfaceId, rowsAlongZ: boolean, draw: () => void) {
    const before = geo.tag;
    geo.tag = surfaceTag(surface, rowsAlongZ);
    try {
        draw();
    } finally {
        geo.tag = before;
    }
}

/** Reads a tag back (the shader's own arithmetic, for the tests). */
export function readTag(tag: number): {surface: number; alongZ: boolean; across: number} {
    const surface = Math.floor(tag / 8 + 1e-4);
    const rest = tag - surface * 8;
    return {surface, alongZ: rest >= 4 - 1e-4, across: (rest >= 4 - 1e-4 ? rest - 4 : rest) - 1};
}
