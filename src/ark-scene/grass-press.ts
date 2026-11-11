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
 * grazer's behaviour beat and each walker's body); visual only.
 *
 * `withGrassPress` is the shader hook (release integration, 2026-11-11), put on
 * the grass tufts' material in `vegetation.ts` with one call. GRAPHICS LANE: it
 * is yours to restyle or fold into your grass shader; it only needs the two
 * uniforms above. It assumes the grass instances are turned about y and scaled
 * evenly (as `buildVegetation` sets them), and it does not bend the shadow.
 */

import type {Material} from "three";

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

/**
 * Bends a grass material's blades down and away from the frame's press points: more at the tip than the root,
 * most at the point and none at `radius`, only for a blade near the point's height. Adds to the material's own
 * shader (its wind stays), before the vertex is projected; its program gets its own cache key.
 */
export function withGrassPress<M extends Material>(material: M): M {
    const base = material.onBeforeCompile.bind(material);
    const key = material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey = () => `${key()}-press`;
    material.onBeforeCompile = (shader, renderer) => {
        base(shader, renderer);
        shader.uniforms.arkGrassPress = ARK_GRASS_PRESS;
        shader.uniforms.arkGrassPressCount = ARK_GRASS_PRESS_COUNT;
        shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
uniform vec4 arkGrassPress[${GRASS_PRESS_MAX}];
uniform float arkGrassPressCount;`).replace("#include <project_vertex>", `#ifdef USE_INSTANCING
if (arkGrassPressCount > 0.5) {
    mat4 grassToWorld = modelMatrix * instanceMatrix;
    vec3 grassRoot = (grassToWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    mat3 grassTurn = mat3(grassToWorld);
    float grassScale = max(dot(grassTurn[0], grassTurn[0]), 1e-6);
    float grassTip = clamp(transformed.y / 0.5, 0.0, 1.0);
    vec3 grassPush = vec3(0.0);
    float grassDown = 0.0;
    for (int i = 0; i < ${GRASS_PRESS_MAX}; i++) {
        if (float(i) >= arkGrassPressCount) break;
        vec4 press = arkGrassPress[i];
        vec2 away = grassRoot.xz - press.xz;
        float d = length(away);
        float k = (1.0 - smoothstep(press.w * 0.25, press.w, d)) * (1.0 - smoothstep(0.4, 1.0, abs(grassRoot.y - press.y)));
        if (k <= 0.0) continue;
        grassPush += vec3(away.x, 0.0, away.y) / max(d, 1e-3) * k * press.w * 0.5;
        grassDown = max(grassDown, k);
    }
    // World push into the instance's own space (turned about y, scaled evenly), then the blade bowed down.
    transformed += (transpose(grassTurn) * grassPush) / grassScale * grassTip;
    transformed.y *= 1.0 - 0.55 * grassDown * grassTip;
}
#endif
#include <project_vertex>`);
    };
    return material;
}
