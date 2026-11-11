/**
 * The near-camera fade (graphics pass, batch 4): a trunk, limb or crown that
 * passes right beside the camera dissolves in a fine screen-space dither
 * instead of filling the picture with a dark, unlit shard.
 *
 * The fade's reach follows how close the camera is to what it looks at, so a
 * close-up keeps its subject: it ends at `NEAR_FADE_SHARE` of the distance to
 * the orbit target (never past 2.2 m), so only what is well nearer than the
 * target dissolves: a bee's flower 1 m away, a caterpillar's leaf at 0.55 m and
 * an ant's bark at 0.12 m all stay whole.
 *
 * Only materials that already cut out (leaf cards) or draw the trees nearest
 * the camera use it, so the GPU keeps its early depth test everywhere else.
 * The dither is per pixel on the screen, not per viewer: nothing about the
 * shared world changes.
 */

import {Vector2} from "three";

/** Fully gone this close (m), fully drawn from the second value on. */
export const ARK_NEAR_FADE = {value: new Vector2(0.6, 2.2)};

/** The fade's far edge as a share of the camera's distance to its target. */
export const NEAR_FADE_SHARE = 0.45;
export const NEAR_FADE_MAX = 2.2;

/** Where the fade ends (m) for a camera this far from what it looks at. */
export function nearFadeEnd(viewDistance: number): number {
    return Math.min(NEAR_FADE_MAX, Math.max(0, viewDistance) * NEAR_FADE_SHARE);
}

/** Call each frame with the camera's distance to its target. */
export function setNearFade(viewDistance: number): void {
    const end = nearFadeEnd(viewDistance);
    ARK_NEAR_FADE.value.set(end * 0.27, end);
}

/**
 * Fragment-shader pieces. `ARK_NEAR_FADE_PARS` goes after `#include <common>`; `ARK_NEAR_FADE_CLIP` after
 * `#include <clipping_planes_fragment>` (it reads three's `vViewPosition`, the fragment's offset to the camera).
 */
export const ARK_NEAR_FADE_PARS = `
uniform vec2 arkNearFade;
// Interleaved gradient noise: a fine, even screen-space threshold for the dither.
float arkNearDither(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }`;

export const ARK_NEAR_FADE_CLIP = `
{
    float arkKeep = smoothstep(arkNearFade.x, arkNearFade.y, length(vViewPosition));
    if (arkKeep < 0.999 && arkKeep <= arkNearDither(gl_FragCoord.xy)) discard;
}`;
