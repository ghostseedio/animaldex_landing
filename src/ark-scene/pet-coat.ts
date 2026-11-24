/**
 * Lane COATS: drawing a pet's own coat (`ArkAnimal.coat`, colours from `pet-coat-colour.ts`) on the plain Domestic Cat
 * and Domestic Dog models, in their own materials only (`ARK_PET_COAT`): every other species' shader is unchanged.
 *
 * Per animal, nothing new is uploaded: the coat rides in the `arkVary` attribute the animal already has (`coatVary`;
 * every attribute slot of a fur-shelled, rigged mesh is in use, and the fur shells and reflections copy `arkVary` with
 * the rest). Per kind, one small map (256 px, made offline from the kind's near model, `public/ark/assets/v1/coats`):
 *   R: the skin's light and shade with its hue taken out (x2: the fur's middle is 1),
 *   G: the white rank (white where G > 1 - white: belly, paws, chest and muzzle first, the back last),
 *   B: the patch field (the second colour where it is above a threshold the animal's seed moves),
 *   A: R with the tabby's stripes averaged out over the nearby body (a solid coat keeps the body's shading only).
 * The map is drawn on the near model's layout (and its rig's, which shares it), for the model version it was made
 * from only; the far model, or another version, reads the light and shade from its own skin and the colours as an
 * average (base, second and white by their shares), which is all a far animal shows.
 */

import {LinearFilter, NoColorSpace, Vector2, TextureLoader, type BufferGeometry, type InstancedBufferAttribute, type Texture} from "three";
import {ARK_VARY_ATTRIBUTE} from "@/ark-scene/ark-variation";
import {COAT_SLUGS, coatDraw, coatVary} from "@/ark-scene/pet-coat-colour";
import type {ArkCoat} from "@/ark-scene/types";

/** The coat maps: the kind's near model version each was made from, and its skin's middle light (linear) for the far form. */
export const COAT_MAPS: Readonly<Record<string, {version: string; skinLum: number}>> = {
    "domestic-cat": {version: "c13e332cb8b7", skinLum: 0.353},
    "domestic-dog": {version: "2520092cec2c", skinLum: 0.458}
};

export type PetCoatUniforms = {arkCoatMap: {value: Texture | null}; arkCoatReady: {value: number}; arkCoatSkinLum: {value: number}};

/** The model's own height range (y), for the saddle: per material (the near, far and rig models differ). */
type CoatShape = {arkCoatY: {value: [number, number]}};

const maps = new Map<string, PetCoatUniforms>();

/**
 * The coat uniforms of a kind's material (one set per kind and level: shells and reflections share them), or null for
 * a kind that wears no coats. `version`: the kind's model version now (`ModelLibrary.versionOf`); the map is only
 * used on the near level of the version it was made for.
 */
export function petCoatUniforms(slug: string, level: "near" | "far", version: string | null, base: string): PetCoatUniforms | null {
    if (!COAT_SLUGS.has(slug)) return null;
    const spec = COAT_MAPS[slug];
    const withMap = level === "near" && spec && version === spec.version;
    const key = `${slug}:${withMap ? "map" : "plain"}`;
    let uniforms = maps.get(key);
    if (!uniforms) {
        uniforms = {arkCoatMap: {value: null}, arkCoatReady: {value: 0}, arkCoatSkinLum: {value: spec?.skinLum ?? 0.4}};
        maps.set(key, uniforms);
        if (withMap) {
            const made = uniforms;
            new TextureLoader().setCrossOrigin("anonymous").loadAsync(`${base}/coats/${slug}.${spec.version}.png`).then(
                (texture) => {
                    // Data, not colour: read as stored.
                    texture.colorSpace = NoColorSpace;
                    texture.flipY = false;
                    // No mipmaps: the map's many small islands would bleed into each other (white specks at the seams).
                    texture.generateMipmaps = false;
                    texture.minFilter = LinearFilter;
                    texture.magFilter = LinearFilter;
                    texture.needsUpdate = true;
                    made.arkCoatMap.value = texture;
                    made.arkCoatReady.value = 1;
                },
                () => undefined // (No map: the plain form, as on the far level.)
            );
        }
    }
    return uniforms;
}

// One packing per coat object (the snapshot's own; a new snapshot brings new objects, the old ones go with it).
const draws = new WeakMap<ArkCoat, [number, number, number]>();

/**
 * After `setVary` (and before `setVaryPower`): instance `index` wears its animal's coat, when its kind wears coats and
 * it has one. A no-op otherwise (the plain variation stays). Per frame: one lookup and three writes.
 */
export function setCoat(geometry: BufferGeometry, index: number, slug: string, coat: ArkCoat | null | undefined) {
    if (!coat || !COAT_SLUGS.has(slug)) return;
    const attribute = geometry.getAttribute(ARK_VARY_ATTRIBUTE) as InstancedBufferAttribute | undefined;
    if (!attribute || index >= attribute.count) return;
    let packed = draws.get(coat);
    if (!packed) {
        packed = coatVary(coatDraw(coat));
        draws.set(coat, packed);
    }
    attribute.setXYZ(index, packed[0], packed[1], packed[2]);
    attribute.needsUpdate = true;
}

const VERTEX_DECLARATIONS = `
#ifdef ARK_PET_COAT
varying vec4 vArkCoatA;
varying vec4 vArkCoatB;
varying float vArkCoatHeight;
uniform vec2 arkCoatY;
vec3 arkCoatUnpack(float p) {
    p = floor(p + 0.5);
    float r = floor(p / 65536.0);
    p -= r * 65536.0;
    float g = floor(p / 256.0);
    vec3 c = vec3(r, g, p - g * 256.0) / 255.0;
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
#endif`;

// (Decoded here, in the vertex shader's full precision: a 24-bit colour does not survive a fragment's mediump.)
const VERTEX = `
#ifdef ARK_PET_COAT
vArkCoatHeight = clamp((position.y - arkCoatY.x) / max(arkCoatY.y - arkCoatY.x, 1e-4), 0.0, 1.0);
if (arkVary.z < 0.0) {
    float arkCoatFrac = arkVary.x - floor(arkVary.x + 0.5);
    float arkCoatWhite = clamp((abs(arkCoatFrac) - 0.05) / 0.4, 0.0, 1.0);
    // w: the white share, or minus one minus it to keep the kind's own skin (a ginger).
    vArkCoatA = vec4(arkCoatUnpack(arkVary.y), arkCoatFrac < 0.0 ? -1.0 - arkCoatWhite : arkCoatWhite);
    vArkCoatB = vec4(arkCoatUnpack(-arkVary.z - 1.0), fract(arkVary.w * 0.0137 + 0.31));
} else {
    vArkCoatA = vec4(0.0, 0.0, 0.0, -10.0);
    vArkCoatB = vec4(0.0);
}
#endif`;

const FRAGMENT_DECLARATIONS = `
#ifdef ARK_PET_COAT
varying vec4 vArkCoatA;
varying vec4 vArkCoatB;
varying float vArkCoatHeight;
uniform sampler2D arkCoatMap;
uniform float arkCoatReady;
uniform float arkCoatSkinLum;
// A colour in the fur's light and shade l (1: the fur's middle). Only a clearly coloured coat deepens and warms in its
// shade (a ginger's or a brown's shadows go richer, not olive); a grey or near-neutral shades evenly, so it never goes
// mauve. The dark side is eased, so a mid-tone stays a mid-tone in its shadows.
vec3 arkCoatShade(vec3 c, float l) {
    float mx = max(c.r, max(c.g, c.b));
    float spread = (mx - min(c.r, min(c.g, c.b))) / max(mx, 1e-4);
    float sat = clamp(spread * 1.6, 0.0, 1.0) * smoothstep(0.25, 0.5, spread);
    // A light coat keeps its full shading (eased, it reads flat and plastic) and is never lit past its own colour by
    // much (a cream or light grey is not silver-white); a darker one has its shadows eased and keeps its highlights.
    float light = smoothstep(0.15, 0.45, dot(c, vec3(0.2126, 0.7152, 0.0722)));
    l = l < 1.0 ? 1.0 - (1.0 - l) * mix(0.7, 0.95, light) : min(l, mix(1.6, 1.12, light));
    return c * pow(vec3(max(l, 1e-3)), vec3(1.0 - 0.25 * sat, 1.0, 1.0 + 0.45 * sat));
}
// How much of the skin's own stripes a coat keeps: a little on a mid-tone (a tabby's colours), least on a solid black,
// dark chocolate or white.
float arkCoatStripes(vec3 c) {
    float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return 0.05 + 0.17 * smoothstep(0.03, 0.08, y) * (1.0 - smoothstep(0.2, 0.45, y));
}
#endif`;

const FRAGMENT = `
#ifdef ARK_PET_COAT
if (vArkCoatA.w > -5.0) {
    vec3 arkSkin = diffuseColor.rgb;
    bool arkKeep = vArkCoatA.w < 0.0;
    float arkWhite = arkKeep ? -1.0 - vArkCoatA.w : vArkCoatA.w;
    vec3 arkBase = vArkCoatA.rgb;
    vec3 arkSecond = vArkCoatB.rgb;
    // White fur: a warm off-white (linear luminance 0.70), brought down to a light coat's own colour (a white dog's
    // photo colour is its white: never drawn brighter than that), and to no less than 0.55 on a dark coat's white.
    float arkBaseY = dot(arkBase, vec3(0.2126, 0.7152, 0.0722));
    vec3 arkWhiteFur = vec3(0.74, 0.70, 0.62) * min(1.0, max(arkBaseY, 0.55) / 0.70);
    vec3 c;
#ifdef USE_MAP
    if (arkCoatReady > 0.5) {
        vec4 m = texture2D(arkCoatMap, vMapUv);
        // (The skin's brightest strokes, a retriever's pale feathering, capped: they read as white flecks on another coat.)
        float l = min(m.r * 2.0, 1.25);
        float soft = m.a * 2.0;
        c = arkKeep ? arkSkin : arkCoatShade(arkBase, mix(soft, l, arkCoatStripes(arkBase)));
        // A piebald's second colour in hard patches; any other's as soft shading over its top (back, head and ears: the
        // model's upper part, from its rest shape, so the feathering's every-way normals make no flecks), so a red dog's
        // darker saddle is not a skin of blotches.
        float arkPatch = arkWhite >= 0.25
            ? smoothstep(0.58, 0.64, fract(m.b + vArkCoatB.w))
            : smoothstep(0.5, 0.85, vArkCoatHeight) * 0.6;
        c = mix(c, arkCoatShade(arkSecond, mix(soft, l, arkCoatStripes(arkSecond))), arkPatch);
        float arkWhiteAt = arkWhite > 0.02 ? smoothstep(1.0 - arkWhite - 0.03, 1.0 - arkWhite + 0.03, m.g) : 0.0;
        // A little white (not a piebald) stays low: paws, legs, chest and belly, never flecked along the back (the
        // feathering's cards rank unevenly up there).
        if (arkWhite < 0.25) arkWhiteAt *= 1.0 - smoothstep(0.4, 0.55, vArkCoatHeight);
        c = mix(c, arkCoatShade(arkWhiteFur, mix(soft, l, 0.25)), arkWhiteAt);
    } else
#endif
    {
        // The far form: the light and shade of its own skin, the colours by their shares.
        float l = dot(arkSkin, vec3(0.2126, 0.7152, 0.0722)) / arkCoatSkinLum;
        vec3 mean = arkKeep ? arkSkin : arkCoatShade(mix(arkBase, arkSecond, 0.35), l);
        c = mix(mean, arkWhiteFur * (0.5 + 0.5 * min(l, 1.4)), arkWhite);
    }
    diffuseColor.rgb = max(c, vec3(0.0));
}
#endif`;

/**
 * Add the coat to a coat kind's shader (inside `onBeforeCompile`, after `varyShader`, so its colour is set before the
 * variation's, which a coat's negative z skips). A no-op unless the material defines ARK_PET_COAT.
 */
export function coatShader(shader: {vertexShader: string; fragmentShader: string; uniforms: Record<string, {value: unknown}>}, uniforms: PetCoatUniforms | null, minY = 0, maxY = 1) {
    if (!uniforms) return;
    const shape: CoatShape = {arkCoatY: {value: [minY, maxY]}};
    Object.assign(shader.uniforms, uniforms, {arkCoatY: {value: new Vector2(...shape.arkCoatY.value)}});
    shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>${VERTEX_DECLARATIONS}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>${VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>${FRAGMENT_DECLARATIONS}`)
        .replace("#include <map_fragment>", `#include <map_fragment>${FRAGMENT}`);
}
