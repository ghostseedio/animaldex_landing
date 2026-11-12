/**
 * The materials the town's displays are drawn with (lane TB): the zoo houses' and garden rooms' cutaway walls, the
 * tanks' glass and water, the lit panels, the cage bars, and the plain interior. Shared by `zoo-houses.ts` and
 * `pet-homes.ts`; the weather, the cloud shade and the street lamps from lane GA's `townWeather` where they belong.
 *
 * **The cutaway** (`cutawayMaterial`): a house's walls and roof drawn whole from afar, cut down to a low wall as the
 * camera comes close (from 70 m in to 40 m), so its tanks and residents are seen from any side and from above; the
 * cut fragments are dropped with a dither, in the sun's shadow pass too, so nothing cut casts a shadow inside. Each
 * vertex carries its house's middle, floor and full height (`aCut`).
 */

import {BufferAttribute, Color, DoubleSide, MeshBasicMaterial, MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking, Vector3, type BufferGeometry, type Camera, type Mesh} from "three";
import {townWeather} from "@/ark-scene/islands/town/render/materials";

/** The camera's distance (m) at which a house starts to open, and is open. */
export const CUT_FAR = 70;
export const CUT_NEAR = 40;
/** How high the walls stand once cut (m over the floor). */
export const CUT_LOW = 1.05;

/** The main camera's position for the cut (set from the mesh's own render, so the shadow pass cuts the same). */
export type CutEye = {value: Vector3};

export function cutEye(): CutEye {
    return {value: new Vector3(0, 1e6, 0)};
}

const CUT_VERTEX_PARS = `
attribute vec4 aCut;
varying vec3 vCutWorld;
varying vec4 vCutHouse;
`;
const CUT_VERTEX_BODY = `
vCutWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vCutHouse = vec4((modelMatrix * vec4(aCut.x, aCut.y, aCut.z, 1.0)).xyz, aCut.w);
`;
const CUT_FRAGMENT_PARS = `
uniform vec3 uCutEye;
varying vec3 vCutWorld;
varying vec4 vCutHouse;
float cutDither(vec2 p) { return fract(sin(dot(floor(p), vec2(12.9898, 78.233))) * 43758.5453); }
`;
const CUT_FRAGMENT_BODY = `
{
    float open = 1.0 - smoothstep(${CUT_NEAR.toFixed(1)}, ${CUT_FAR.toFixed(1)}, distance(uCutEye, vCutHouse.xyz));
    float cutY = vCutHouse.y + mix(vCutHouse.w + 6.0, ${CUT_LOW.toFixed(2)}, open);
    float band = (vCutWorld.y - cutY) / 0.35;
    if (band > cutDither(gl_FragCoord.xy * 0.5)) discard;
}
`;

function patchCut(shader: {uniforms: Record<string, {value: unknown}>; vertexShader: string; fragmentShader: string}, eye: CutEye) {
    shader.uniforms.uCutEye = eye;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>${CUT_VERTEX_PARS}`).replace("#include <begin_vertex>", `#include <begin_vertex>${CUT_VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>${CUT_FRAGMENT_PARS}`).replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>${CUT_FRAGMENT_BODY}`);
}

/** The cutaway walls' and roof's material (the town's weather on them), and its depth material for the sun's shadow. */
export function cutawayMaterial(eye: CutEye): {material: MeshStandardMaterial; depth: MeshDepthMaterial} {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.82, metalness: 0, side: DoubleSide});
    material.onBeforeCompile = (shader) => patchCut(shader as never, eye);
    material.customProgramCacheKey = () => "town-cutaway";
    townWeather(material, {soak: 0.25});
    const depth = new MeshDepthMaterial({depthPacking: RGBADepthPacking});
    depth.onBeforeCompile = (shader) => patchCut(shader as never, eye);
    depth.customProgramCacheKey = () => "town-cutaway-depth";
    return {material, depth};
}

/** Keeps the cut's eye on the main (perspective) camera: called from the cutaway mesh's own render. */
export function followEye(mesh: Mesh, eye: CutEye): void {
    mesh.onBeforeRender = (_renderer, _scene, camera: Camera) => {
        if ((camera as {isPerspectiveCamera?: boolean}).isPerspectiveCamera) eye.value.copy(camera.position);
    };
}

/** Each vertex's house (middle x, floor, middle z, full height), as `aCut`: from per-house vertex ranges. */
export function cutAttribute(geometry: BufferGeometry, ranges: ReadonlyArray<{from: number; to: number; x: number; y: number; z: number; h: number}>): void {
    const count = geometry.getAttribute("position").count;
    const data = new Float32Array(count * 4);
    for (const r of ranges) {
        for (let v = r.from; v < Math.min(r.to, count); v++) data.set([r.x, r.y, r.z, r.h], v * 4);
    }
    geometry.setAttribute("aCut", new BufferAttribute(data, 4));
}

/** A display's inside: the floors, the sand, the stands, the rocks and plants (indoors: no rain, no cloud, no street lamps). */
export function interiorMaterial(): MeshStandardMaterial {
    return townWeather(new MeshStandardMaterial({vertexColors: true, roughness: 0.86, metalness: 0}), {soak: 0, cloud: false, lamps: false});
}

/** Outdoors on a display (a garden pond's stones, a room's frame and base): the town's weather. */
export function outdoorMaterial(): MeshStandardMaterial {
    return townWeather(new MeshStandardMaterial({vertexColors: true, roughness: 0.84, metalness: 0}), {soak: 0.35});
}

/** Glass: clear, a little green, the faintest reflection (never soaked). */
export function glassMaterial(): MeshStandardMaterial {
    return townWeather(new MeshStandardMaterial({color: new Color("#dcebe6"), transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0.25, depthWrite: false, side: DoubleSide}), {soak: 0, cloud: false});
}

/** A tank's water: tinted by its kind (vertex colours), lit faintly from within so a tank glows at night. */
export function waterMaterial(): MeshStandardMaterial {
    return new MeshStandardMaterial({vertexColors: true, transparent: true, opacity: 0.34, roughness: 0.12, metalness: 0.05, depthWrite: false, emissive: new Color("#1a4a5a"), emissiveIntensity: 0.35});
}

/** The lit panels: a tank's back light, its strip light, a vivarium's heat lamp (unlit by the scene: they are the light). */
export function glowMaterial(): MeshBasicMaterial {
    return new MeshBasicMaterial({vertexColors: true, toneMapped: true});
}

/** A cage's bars: thin vertical wires over its sides and lid (a procedural pattern on its faces). */
export function barsMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({color: new Color("#d8d4c8"), roughness: 0.4, metalness: 0.6, transparent: true, side: DoubleSide, depthWrite: false});
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vBarsWorld;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvBarsWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vBarsWorld;")
            .replace("#include <alphatest_fragment>", "float barsU = fract((vBarsWorld.x + vBarsWorld.z) * 28.0);\ndiffuseColor.a = barsU < 0.16 ? 0.95 : 0.0;\nif (diffuseColor.a < 0.01) discard;\n#include <alphatest_fragment>");
    };
    material.customProgramCacheKey = () => "town-cage-bars";
    return material;
}
