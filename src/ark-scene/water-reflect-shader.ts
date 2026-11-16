/**
 * p3 (reflect): the animal shader's reflection pass (`animal-material.ts` with `reflect`, drawn by
 * `water-reflect-render.ts`; the rule is `water-reflect.ts`).
 *
 * Each instance carries its water's plane in `arkReflect[gl_InstanceID]` = (surface height, strength, tint, 0). After
 * the animal's own vertex work (its pose, its rig's clip frame, its look, its sleep: all of it, unchanged), the world
 * point is mirrored about the plane, rippled sideways by the water's own moving noise (more the further from the
 * waterline, as a real reflection breaks up; still under reduced motion), and slid along the camera's ray onto the
 * plane: on screen exactly the mirrored point, but at the water's depth, so the bank's ground hides it where there is
 * no water and the lake's bed under the water does not. The part of the animal under the surface is not mirrored
 * (discarded). The colour is the lit animal, darkened and drawn toward the water's own colour, faded with height over
 * the water and, as on real water, stronger the lower the view (Fresnel).
 */

import {ARK_DAYLIGHT} from "@/ark-scene/glsl";
import {REFLECT_PER_MESH} from "@/ark-scene/water-reflect";
import {Vector4} from "three";

export type ReflectUniforms = {arkReflect: {value: Vector4[]}; arkReflectTime: {value: number}; arkReflectDaylight: {value: number}};

/** Uniforms for one species mesh's reflection: shared by its depth pass and its colour pass. */
export function reflectUniforms(time: {value: number}): ReflectUniforms {
    return {arkReflect: {value: Array.from({length: REFLECT_PER_MESH}, () => new Vector4())}, arkReflectTime: time, arkReflectDaylight: ARK_DAYLIGHT};
}

export const REFLECT_VERTEX_DECLARATIONS = `
uniform vec4 arkReflect[${REFLECT_PER_MESH}];
uniform float arkReflectTime;
varying float vArkReflectAbove;
varying vec2 vArkReflect;
varying vec3 vArkReflectAt;
float arkReflectHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float arkReflectNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(arkReflectHash(i), arkReflectHash(i + vec2(1.0, 0.0)), u.x), mix(arkReflectHash(i + vec2(0.0, 1.0)), arkReflectHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

export const REFLECT_VERTEX = `
{
    vec4 arkPlane = arkReflect[gl_InstanceID];
    float arkH = arkPlane.x;
    vec4 arkW = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
    vArkReflectAbove = arkW.y - arkH;
    vec3 arkM = vec3(arkW.x, 2.0 * arkH - arkW.y, arkW.z);
    // The surface's ripple: the reflection breaks up more the further a point is from the waterline (the harbour's sea more).
    float arkLift = max(arkW.y - arkH, 0.0);
    vec2 arkP = arkW.xz * 0.8;
    vec2 arkWob = vec2(arkReflectNoise(arkP + vec2(arkReflectTime * 0.45, arkLift * 1.7)), arkReflectNoise(arkP.yx + vec2(arkLift * 1.3, -arkReflectTime * 0.38))) - 0.5;
    arkM.xz += arkWob * (0.03 + 0.07 * min(arkLift, 3.0)) * (arkPlane.z > 1.5 ? 1.8 : 1.0);
    vec3 arkRay = arkM - cameraPosition;
    float arkT = clamp((arkH - cameraPosition.y) / min(arkRay.y, -1e-4), 0.0, 1.0);
    vec3 arkQ = cameraPosition + arkRay * arkT;
    mvPosition = viewMatrix * vec4(arkQ, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // Its own parts in their mirrored order (the depth pass keeps the nearest), all at the water's depth.
    gl_Position.z += 5e-6 * length(arkM - arkQ) * gl_Position.w;
    // (The mirror turns its triangles over: drawn back faces (\`BackSide\`), lit by the animal's own outward normals, not
    // the inward ones three gives a flipped side.)
    #if defined(FLIP_SIDED) && !defined(FLAT_SHADED)
    vNormal = -vNormal;
    #endif
    vArkReflect = arkPlane.yz;
    vArkReflectAt = arkQ;
}
`;

export const REFLECT_FRAGMENT_DECLARATIONS = `
uniform float arkReflectDaylight;
varying float vArkReflectAbove;
varying vec2 vArkReflect;
varying vec3 vArkReflectAt;
`;

/** The water's colours as the water shaders draw them (town fresh, the wild lake, the harbour's sea). */
export const REFLECT_FRAGMENT = `
{
    if (vArkReflectAbove < 0.0) discard;
    vec3 arkTint = vArkReflect.y < 0.5 ? vec3(0.17, 0.26, 0.2) : vArkReflect.y < 1.5 ? vec3(0.16, 0.42, 0.36) : vec3(0.16, 0.52, 0.52);
    arkTint *= 0.35 + 0.65 * arkReflectDaylight;
    vec3 arkEye = normalize(cameraPosition - vArkReflectAt);
    float arkFresnel = 0.02 + 0.98 * pow(1.0 - clamp(arkEye.y, 0.0, 1.0), 5.0);
    float arkFade = 1.0 - 0.55 * smoothstep(0.0, 3.0, vArkReflectAbove);
    // (Still water mirrors an animal in nearly its own colours, a little darker: a pale wash read as a ghost.)
    gl_FragColor.rgb = mix(gl_FragColor.rgb * 0.78, arkTint, 0.16);
    gl_FragColor.a = clamp(vArkReflect.x * arkFade * (0.72 + 0.28 * arkFresnel), 0.0, 1.0);
}
`;
