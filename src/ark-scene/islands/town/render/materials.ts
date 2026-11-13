/**
 * The town's shared material kit (lane GA, docs/ark/town-island.md §11): how the town's surfaces answer the one world's
 * weather and night, the same way the wild island's do.
 *
 * - **Rain:** a soaked surface darkens and shines (the shared `ARK_ENV.wetness`, the wild ground's own uniform); faces
 *   turned up to the sky shine most.
 * - **Cloud shade:** the wild ground's drifting cloud shadows (the same noise and the same clock, so a shadow crosses
 *   the strait from one island to the other unbroken).
 * - **Street lamps at night:** each surface is lit by its nearest street lamp, through three's own physically based
 *   direct light (diffuse and specular), so a wet street mirrors the lamps. The lamps' places are a small map
 *   (`TOWN_LIGHT.lampMap`, built by `render/furniture.ts`): per 1 m cell, its nearest lamp and whether a building stands
 *   between them (so a back garden behind a house stays dark).
 *
 * The API for the other town lanes (buildings, scenery):
 *
 *     import {townWeather} from "@/ark-scene/islands/town/render/materials";
 *     const walls = townWeather(new MeshStandardMaterial({...}), {soak: 0.4});
 *
 * It chains the material's own `onBeforeCompile` (and its program cache key), so it can wrap a material that already
 * patches its shader, and it works on instanced meshes. Nothing here allocates per frame.
 */

import {Color, Material, Vector2, Vector4, type DataTexture, type MeshStandardMaterial, type WebGLProgramParametersWithUniforms} from "three";
import {ARK_ENV, ARK_TIME, ARK_WIND} from "@/ark-scene/glsl";
import {TOWN_HALF} from "@/ark-scene/islands/town/plan";

/** The lamp map's texels a side (1 m cells over the town's square). */
export const TOWN_LAMP_TEXELS = 476;
/** How far a lamp's offset may reach in the map (m), and its height scale (m): the RGBA8 encoding. */
export const TOWN_LAMP_REACH = 16;
export const TOWN_LAMP_HEIGHT = 16;

/** The street lamps' light, shared by every town material (set by `render/index.ts` and `render/furniture.ts`). */
export const TOWN_LIGHT = {
    /** RGBA8, read cell by cell (never filtered): per 1 m cell, R/G its nearest lamp head's offset from the cell's middle in x/z (±16 m as 0–1), B the head's height (0–16 m), A how much of it the cell sees (0: none, or a building in the way). */
    lampMap: {value: null as DataTexture | null},
    /** The map's square in the town's own frame: x0, z0, side (m), texels a side. */
    lampRect: {value: new Vector4(-TOWN_HALF, -TOWN_HALF, TOWN_HALF * 2, TOWN_LAMP_TEXELS)},
    /** The town root's world x/z (the town's own frame is the world's less this): `render/index.ts` keeps it. */
    origin: {value: new Vector2()},
    /** 0 by day, 1 when the lamps are lit (`people.ts` lampsOn). */
    lampOn: {value: 0},
    lampColour: {value: new Color("#ffcf94")},
    /** The lamps' strength (three's physical units, tuned against the scene's moonlight and exposure). */
    lampPower: {value: 90}
};

/** Noise and cloud shade, the wild ground's own functions (`glsl.ts` NOISE_GLSL, CLOUD_GLSL) under the town's names, so a material that already has the Ark's can take these too. */
export const TOWN_NOISE_GLSL = `
float townHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float townNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(townHash(i), townHash(i + vec2(1.0, 0.0)), f.x), mix(townHash(i + vec2(0.0, 1.0)), townHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float townFbm(vec2 p) {
    float sum = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
        sum += amplitude * townNoise(p);
        p = p * 2.03 + vec2(17.3, -9.1);
        amplitude *= 0.5;
    }
    return sum / 0.9375;
}
float townCloudShade(vec3 world) {
    vec2 p = world.xz * 0.011 - townWind * townTime * 0.016;
    return 1.0 - 0.2 * smoothstep(0.5, 0.85, townFbm(p));
}`;

/** The uniforms the town's GLSL reads (bound to the shared objects: one value for every material). */
export const TOWN_UNIFORMS = {
    townTime: ARK_TIME,
    townWind: ARK_WIND,
    townWetness: ARK_ENV.wetness,
    townRain: ARK_ENV.rain,
    townLampMap: TOWN_LIGHT.lampMap,
    townLampRect: TOWN_LIGHT.lampRect,
    townOrigin: TOWN_LIGHT.origin,
    townLampOn: TOWN_LIGHT.lampOn,
    townLampColour: TOWN_LIGHT.lampColour,
    townLampPower: TOWN_LIGHT.lampPower
};

export const TOWN_PARS_GLSL = `
uniform float townTime;
uniform vec2 townWind;
uniform float townWetness;
uniform float townRain;
uniform sampler2D townLampMap;
uniform vec4 townLampRect;
uniform vec2 townOrigin;
uniform float townLampOn;
uniform vec3 townLampColour;
uniform float townLampPower;
varying vec3 vTownWorld;
varying vec3 vTownNormal;
${TOWN_NOISE_GLSL}`;

export const TOWN_VERTEX_PARS = `
varying vec3 vTownWorld;
varying vec3 vTownNormal;`;

/** After `worldpos_vertex`: the world position and normal (instancing included). */
export const TOWN_VERTEX_BODY = `
{
    vec4 townW = vec4(transformed, 1.0);
    vec3 townN = objectNormal;
    #ifdef USE_INSTANCING
    townW = instanceMatrix * townW;
    townN = mat3(instanceMatrix) * townN;
    #endif
    townW = modelMatrix * townW;
    vTownWorld = townW.xyz;
    vTownNormal = normalize(mat3(modelMatrix) * townN);
}`;

/**
 * Before `lights_fragment_end`: the nearest street lamp as one more direct light, through the material's own BRDF
 * (`RE_Direct`), so the wet street's low roughness gives the lamps' long reflections. Nothing at all by day.
 */
export const TOWN_LAMP_LIGHT_GLSL = `
#if defined( RE_Direct )
if (townLampOn > 0.001) {
    // The four cells round this point, each with its own lamp. Their light is blended, never their lamps' places: a
    // blend of two cells' offsets (two lamps, or a lamp and a cell with none) put a phantom lamp right by the ground,
    // and every edge between two lamps' cells and every pool's rim drew a thin bright line (the owner's "light streaks
    // everywhere" at night). At most two distinct lamps meet in one cell's corners.
    vec2 townLocal = vTownWorld.xz - townOrigin;
    vec2 townCell = (townLocal - townLampRect.xy) / townLampRect.z * townLampRect.w - 0.5;
    vec2 townBase = floor(townCell);
    vec2 townFrac = townCell - townBase;
    int townSide = int(townLampRect.w + 0.5);
    vec3 townLampA = vec3(0.0);
    vec3 townLampB = vec3(0.0);
    float townWA = 0.0;
    float townWB = 0.0;
    for (int k = 0; k < 4; k++) {
        ivec2 o = ivec2(k - (k / 2) * 2, k / 2);
        ivec2 t = ivec2(townBase) + o;
        if (t.x < 0 || t.y < 0 || t.x >= townSide || t.y >= townSide) continue;
        vec4 texel = texelFetch(townLampMap, t, 0);
        if (texel.a <= 0.0) continue;
        float w = (o.x == 1 ? townFrac.x : 1.0 - townFrac.x) * (o.y == 1 ? townFrac.y : 1.0 - townFrac.y) * texel.a;
        vec2 middle = (vec2(t) + 0.5) / townLampRect.w * townLampRect.z + townLampRect.xy + townOrigin;
        vec3 at = vec3(middle.x + (texel.r * 2.0 - 1.0) * ${TOWN_LAMP_REACH.toFixed(1)}, texel.b * ${TOWN_LAMP_HEIGHT.toFixed(1)}, middle.y + (texel.g * 2.0 - 1.0) * ${TOWN_LAMP_REACH.toFixed(1)});
        // (The same lamp read from two cells differs by the 8-bit step, 0.13 m at most.)
        if (townWA == 0.0 || distance(at, townLampA) < 0.4) {
            if (townWA == 0.0) townLampA = at;
            townWA += w;
        } else if (townWB == 0.0 || distance(at, townLampB) < 0.4) {
            if (townWB == 0.0) townLampB = at;
            townWB += w;
        }
    }
    for (int j = 0; j < 2; j++) {
        float share = j == 0 ? townWA : townWB;
        if (share <= 0.0) continue;
        vec3 toLamp = (j == 0 ? townLampA : townLampB) - vTownWorld;
        float d2 = dot(toLamp, toLamp);
        // A pool about 12 m across, fading out by 15 m (the map has nothing past 16 m).
        float fade = 1.0 - smoothstep(90.0, 220.0, d2);
        IncidentLight townLamp;
        townLamp.direction = normalize((viewMatrix * vec4(toLamp, 0.0)).xyz);
        townLamp.color = townLampColour * (townLampOn * townLampPower * share * fade / (d2 + 3.0));
        townLamp.visible = true;
        RE_Direct(townLamp, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
    }
}
#endif`;

export type TownWeatherOptions = {
    /** How much darker it is soaked: 0 none (metal, glass, plastic), 0.25 paint and render, 0.4 brick, stone and wood (default 0.35). */
    soak?: number;
    /** Its roughness soaked (default 0.32); dry, the material's own. */
    wetRoughness?: number;
    /** Lit by the street lamps at night (default true). */
    lamps?: boolean;
    /** The drifting cloud shade (default true; off for things high in the air or indoors). */
    cloud?: boolean;
};

/** Patches the town's weather, cloud shade and lamp light into a standard material's shader (and returns it). */
export function townWeather<T extends MeshStandardMaterial>(material: T, options: TownWeatherOptions = {}): T {
    const soak = options.soak ?? 0.35;
    const wetRoughness = options.wetRoughness ?? 0.32;
    const lamps = options.lamps !== false;
    const cloud = options.cloud !== false;
    const previous = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey;
    const defaultKey = previousKey === Material.prototype.customProgramCacheKey;
    const key = `town-weather:${soak}:${wetRoughness}:${lamps ? 1 : 0}${cloud ? 1 : 0}`;
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
        previous.call(material, shader, renderer);
        patchTownShader(shader, {soak, wetRoughness, lamps, cloud});
    };
    material.customProgramCacheKey = () => `${defaultKey ? previous.toString() : previousKey.call(material)}|${key}`;
    material.needsUpdate = true;
    return material;
}

/** The patch itself (also used by the town's ground and paving, `render/surfaces.ts`, with `colour`/`roughness` off: they do their own). */
export function patchTownShader(shader: WebGLProgramParametersWithUniforms, options: {soak: number; wetRoughness: number; lamps: boolean; cloud: boolean; colour?: boolean; roughness?: boolean}) {
    Object.assign(shader.uniforms, TOWN_UNIFORMS);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>${TOWN_VERTEX_PARS}`).replace("#include <worldpos_vertex>", `#include <worldpos_vertex>${TOWN_VERTEX_BODY}`);
    let fragment = shader.fragmentShader.replace("#include <common>", `#include <common>${TOWN_PARS_GLSL}`);
    if (options.colour !== false) {
        fragment = fragment.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
diffuseColor.rgb *= 1.0 - townWetness * ${options.soak.toFixed(3)};${options.cloud ? "\ndiffuseColor.rgb *= townCloudShade(vTownWorld);" : ""}`
        );
    }
    if (options.roughness !== false) {
        fragment = fragment.replace(
            "#include <roughnessmap_fragment>",
            `#include <roughnessmap_fragment>
// Faces turned to the sky soak most; walls run wet too, a little less.
roughnessFactor = mix(roughnessFactor, min(roughnessFactor, ${options.wetRoughness.toFixed(3)}), townWetness * mix(0.6, 1.0, smoothstep(-0.1, 0.7, normalize(vTownNormal).y)));`
        );
    }
    if (options.lamps) fragment = fragment.replace("#include <lights_fragment_end>", `${TOWN_LAMP_LIGHT_GLSL}\n#include <lights_fragment_end>`);
    shader.fragmentShader = fragment;
}
