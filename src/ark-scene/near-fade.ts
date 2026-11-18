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

import {Vector2, Vector3} from "three";

/** Fully gone this close (m), fully drawn from the second value on. */
export const ARK_NEAR_FADE = {value: new Vector2(0.6, 2.2)};

/** The fade's far edge as a share of the camera's distance to its target. */
export const NEAR_FADE_SHARE = 0.45;
export const NEAR_FADE_MAX = 2.2;

/**
 * V2 replay (`replay/shot.ts`): a clip is filmed through the wood, and what dissolves then is whatever stands between
 * the camera and its subject, not only what brushes the lens: inside a cone round the view's own axis (`x`: the tangent
 * of its half angle; 0, the Ark as it is: no cone), the leaves from `y` to `z` metres from the camera fade out, all of
 * them nearer. Off the axis the wood stands as it is, so the picture keeps its trees at its sides.
 */
export const ARK_NEAR_CONE = {value: new Vector3(0, 0, 0)};
/** The cone (null: none): its half angle's tangent, and how far from the camera it reaches (m; the subject's own distance, less its body). */
export function setNearCone(cone: {tan: number; end: number} | null): void {
    if (!cone || !(cone.tan > 0) || !(cone.end > 0)) ARK_NEAR_CONE.value.set(0, 0, 0);
    else ARK_NEAR_CONE.value.set(cone.tan, cone.end * 0.82, cone.end);
}
/** How far from the camera a tree may stand and still be drawn with the fade (the trees' near pool, `asset-trees.ts`). */
export function nearFadeReach(): number {
    return Math.max(NEAR_FADE_MAX, ARK_NEAR_CONE.value.x > 0 ? ARK_NEAR_CONE.value.z : 0);
}

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
uniform vec3 arkNearCone;
// Interleaved gradient noise: a fine, even screen-space threshold for the dither.
float arkNearDither(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }`;

export const ARK_NEAR_FADE_CLIP = `
{
    float arkAway = length(vViewPosition);
    float arkKeep = smoothstep(arkNearFade.x, arkNearFade.y, arkAway);
    if (arkNearCone.x > 0.0) {
        // (V2 replay: between the camera and its subject, round the view's axis.)
        float arkOff = length(vViewPosition.xy) / max(vViewPosition.z, 1e-3);
        float arkIn = 1.0 - smoothstep(arkNearCone.x * 0.7, arkNearCone.x, arkOff);
        arkKeep = min(arkKeep, mix(1.0, smoothstep(arkNearCone.y, arkNearCone.z, arkAway), arkIn));
    }
    if (arkKeep < 0.999 && arkKeep <= arkNearDither(gl_FragCoord.xy)) discard;
}`;
