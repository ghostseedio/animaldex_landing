/**
 * Where grass bends at a muzzle (for the graphics lane's grass shader): the
 * mouths of the grazers nearest the camera that have their heads down to bite,
 * as up to `GRASS_PRESS_MAX` points. Uniform-shaped, like `glsl.ts` `ARK_ENV`,
 * so the grass material can bind them directly:
 *
 *   ARK_GRASS_PRESS.value        Float32Array of vec4 (x, y, z, radius m), GRASS_PRESS_MAX of them
 *   ARK_GRASS_PRESS_COUNT.value  how many are in use this frame
 *
 * A blade within `radius` of a point (in x/z, near its height) bends down and
 * away from it. Written every frame by the scene (`index.ts`, from each
 * grazer's behaviour beat); visual only.
 */

export const GRASS_PRESS_MAX = 16;
export const ARK_GRASS_PRESS = {value: new Float32Array(GRASS_PRESS_MAX * 4)};
export const ARK_GRASS_PRESS_COUNT = {value: 0};

/** The frame's points, nearest the camera first (the scene sorts them); extra points are dropped. */
export function setGrassPress(points: Array<{x: number; y: number; z: number; radius: number}>) {
    const out = ARK_GRASS_PRESS.value;
    const count = Math.min(points.length, GRASS_PRESS_MAX);
    for (let i = 0; i < count; i++) {
        out[i * 4] = points[i].x;
        out[i * 4 + 1] = points[i].y;
        out[i * 4 + 2] = points[i].z;
        out[i * 4 + 3] = points[i].radius;
    }
    ARK_GRASS_PRESS_COUNT.value = count;
}
