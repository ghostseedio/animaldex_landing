/**
 * Each animal its own (liveliness wiring): a seeded few per cent of size,
 * a slight shift of hue, saturation and brightness, and its own faint
 * mottling, so two zebras side by side are not the same zebra. From
 * `animalVariation(id)` (`ark-clock.ts`): the same for every viewer.
 *
 * Size goes through the animal's drawn length (`index.ts`); the colour and
 * the mottling through a per-instance attribute, `arkVary` = (hue turns,
 * saturation, brightness, pattern), read by the animal material after its
 * texture (`varyShader`, one call in `animal-material.ts`). A mesh without
 * the attribute reads WebGL's default (0, 0, 0, 1) and draws as before.
 */

import {DynamicDrawUsage, InstancedBufferAttribute, type BufferGeometry} from "three";
import {animalVariation, type ArkVariation} from "@/lib/ark-clock";

export const ARK_VARY_ATTRIBUTE = "arkVary";

const cache = new Map<string, Float32Array>();

/** The four numbers an animal draws with: hue (turns), saturation and brightness (times), and its pattern seed. */
export function varyOf(id: string): Float32Array {
    let packed = cache.get(id);
    if (!packed) {
        const v: ArkVariation = animalVariation(id);
        // Its pattern offset (u, v) in one float: whole part u in 997ths, fraction v.
        packed = new Float32Array([v.hue, v.saturation, v.brightness, Math.floor(v.pattern[0] * 997) + v.pattern[1] * 0.999]);
        cache.set(id, packed);
        if (cache.size > 20000) cache.clear();
    }
    return packed;
}

/** Times the species' drawn length (adults about ±8%). */
export function sizeOf(id: string): number {
    return animalVariation(id).size;
}

/** Give an instanced geometry its `arkVary` attribute (capacity instances), identity until set. */
export function attachVary(geometry: BufferGeometry, capacity: number): InstancedBufferAttribute {
    const data = new Float32Array(capacity * 4);
    for (let i = 0; i < capacity; i++) {
        data[i * 4 + 1] = 1;
        data[i * 4 + 2] = 1;
    }
    const attribute = new InstancedBufferAttribute(data, 4);
    attribute.setUsage(DynamicDrawUsage);
    geometry.setAttribute(ARK_VARY_ATTRIBUTE, attribute);
    return attribute;
}

/** Set instance `index` to animal `id`'s look (no-op on a geometry without the attribute). */
export function setVary(geometry: BufferGeometry, index: number, id: string) {
    const attribute = geometry.getAttribute(ARK_VARY_ATTRIBUTE) as InstancedBufferAttribute | undefined;
    if (!attribute || index >= attribute.count) return;
    const v = varyOf(id);
    attribute.setXYZW(index, v[0], v[1], v[2], v[3]);
    attribute.needsUpdate = true;
}

const VERTEX_DECLARATIONS = `
attribute vec4 arkVary;
varying vec4 vArkVary;
varying vec3 vArkVaryPos;`;

const VERTEX = `
vArkVary = arkVary;
vArkVaryPos = position;`;

const FRAGMENT_DECLARATIONS = `
varying vec4 vArkVary;
varying vec3 vArkVaryPos;
uniform float arkVaryScale;
float arkVaryHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float arkVaryNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(arkVaryHash(i), arkVaryHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(arkVaryHash(i + vec3(0.0, 1.0, 0.0)), arkVaryHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
               mix(mix(arkVaryHash(i + vec3(0.0, 0.0, 1.0)), arkVaryHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(arkVaryHash(i + vec3(0.0, 1.0, 1.0)), arkVaryHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}`;

/** After the texture: hue turned (about the grey axis), saturation and brightness scaled, its own faint mottling. */
const FRAGMENT = `
if (vArkVary.z > 0.0) {
    vec3 c = diffuseColor.rgb;
    float angle = vArkVary.x * 6.2831853;
    float cs = cos(angle);
    float sn = sin(angle);
    vec3 k = vec3(0.57735);
    c = c * cs + cross(k, c) * sn + k * dot(k, c) * (1.0 - cs);
    float grey = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(grey), c, vArkVary.y) * vArkVary.z;
    vec2 pattern = vec2(floor(vArkVary.w) / 997.0, fract(vArkVary.w));
    float mottle = arkVaryNoise(vArkVaryPos * arkVaryScale + vec3(pattern * 61.0, pattern.x * 23.0));
    c *= 1.0 + (mottle - 0.5) * 0.12;
    diffuseColor.rgb = max(c, vec3(0.0));
}`;

/**
 * Add the variation to an animal shader (inside `onBeforeCompile`, after the
 * material's own changes). `height`: the model's height in its own units, so
 * the mottling is a few patches across any animal.
 */
export function varyShader(shader: {vertexShader: string; fragmentShader: string; uniforms: Record<string, {value: unknown}>}, height: number) {
    shader.uniforms.arkVaryScale = {value: 3.2 / Math.max(height, 1e-3)};
    shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>${VERTEX_DECLARATIONS}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>${VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>${FRAGMENT_DECLARATIONS}`)
        .replace("#include <map_fragment>", `#include <map_fragment>${FRAGMENT}`);
}
