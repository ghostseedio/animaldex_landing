/**
 * The town's ground and paving (lane GA, docs/ark/town-island.md §11; the owner's bug 4, "the ground looks like giant
 * pixels"): tiled PBR materials at true scale in place of flat vertex colours.
 *
 * - **The ground** (the 1.1 m grid's tiles): the wild ground's own CC0 texture strips (grass, soil, sand, mud, leaf
 *   litter), chosen per vertex by what covers it (`ground.ts` surfaceWeights, blurred over the grid) and blended
 *   along ragged, noise-broken edges, so neither the grid nor its cells ever show. Lawns are mown in stripes, paddocks
 *   worn, farmyards muddy, the sand wet at the water.
 * - **The paving** (the decals, by their tag: `surface-tags.ts`): asphalt with its wheel tracks, oil line, gutters
 *   and repair patches; worn paint; slab pavements with stains; granite setts, kerbs and quay flags; gravel; block
 *   paving; earth tracks with ruts; crops; iron manhole covers and gully gratings.
 * - **Weather and night**, as on the wild island and through the town's shared kit (`materials.ts`): rain darkens and
 *   glosses every surface, puddles gather in the gutters, ruts and hollows and ripple while it rains (and mirror the
 *   sky and the street lamps), the cloud shade drifts over, and the nearest lamp lights each surface at night.
 * - **Close up** (inside ~20 m): a finer sample of each texture's own grain on top, as the wild ground's near detail.
 *
 * Tiers: the low tier (`TOWN_TEXTURES.lite`) samples each layer once and draws no normal maps, close-up grain or
 * ripples; the textures and the puddles stay. Until the textures are in, the old flat colours with a grain.
 */

import {Color, MeshStandardMaterial, Vector3, type WebGLProgramParametersWithUniforms} from "three";
import {ARK_GROUND_TEXTURES, GROUND_MEANS} from "@/ark-scene/ground-textures";
import {ARK_ENV} from "@/ark-scene/glsl";
import {patchTownShader} from "@/ark-scene/islands/town/render/materials";
import {TOWN_LAYER_MEANS, TOWN_LAYER_METRES, TOWN_TEXTURES} from "@/ark-scene/islands/town/render/textures";
import {GRATE, MANHOLE} from "@/ark-scene/islands/town/render/streets";

const lin = (hex: string) => {
    const c = new Color(hex);
    return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};
const f = (n: number) => n.toFixed(4);

const UNIFORMS = {
    groundAlbedo: ARK_GROUND_TEXTURES.albedo,
    groundNormal: ARK_GROUND_TEXTURES.normal,
    groundReady: ARK_GROUND_TEXTURES.ready,
    groundMeans: {value: GROUND_MEANS.map(([r, g, b]) => new Vector3(r, g, b))},
    townAlbedo: TOWN_TEXTURES.albedo,
    townNormal: TOWN_TEXTURES.normal,
    townReady: TOWN_TEXTURES.ready,
    townNormals: TOWN_TEXTURES.normals,
    townLite: TOWN_TEXTURES.lite,
    townMeans: {value: TOWN_LAYER_MEANS.map(([r, g, b]) => new Vector3(r, g, b))},
    envSeaLevel: ARK_ENV.seaLevel
};

/** Samplers, the layer reads and the rain's ripples, shared by the ground and the paving. */
const PAVE_PARS = `
uniform highp sampler2DArray groundAlbedo;
uniform highp sampler2DArray groundNormal;
uniform float groundReady;
uniform vec3 groundMeans[9];
uniform highp sampler2DArray townAlbedo;
uniform highp sampler2DArray townNormal;
uniform float townReady;
uniform float townNormals;
uniform float townLite;
uniform vec3 townMeans[6];
uniform float envSeaLevel;
vec3 townDetailN = vec3(0.0, 0.0, 1.0);
float townRough = 0.9;
float townMetal = 0.0;
// A layer of a texture array. Where the material is stochastic (asphalt, gravel, grass, soil) it is "bombed": two
// grids of 2-tile cells half a cell apart, each cell its own random offset, blended so each grid fades out at its own
// cell edges. So no tile repeats, at the texture's true size (the gradients are taken once: no seams in the mips).
// Patterned layers (slabs, setts, kerbs) are read once.
vec4 townLayer(highp sampler2DArray tex, float layer, vec2 uv, float stochastic) {
    vec2 gx = dFdx(uv);
    vec2 gy = dFdy(uv);
    if (stochastic < 0.5 || townLite > 0.5) return textureGrad(tex, vec3(uv, layer), gx, gy);
    vec2 g = uv * 0.5;
    vec2 fa = fract(g);
    vec2 fb = fract(g + 0.5);
    vec2 oa = vec2(townHash(floor(g) + layer), townHash(floor(g) + layer + 4.7));
    vec2 ob = vec2(townHash(floor(g + 0.5) + layer + 9.1), townHash(floor(g + 0.5) + layer + 2.3));
    float wa = min(min(fa.x, 1.0 - fa.x), min(fa.y, 1.0 - fa.y)) + 0.02;
    float wb = min(min(fb.x, 1.0 - fb.x), min(fb.y, 1.0 - fb.y)) + 0.02;
    vec4 a = textureGrad(tex, vec3(uv + oa * 7.0, layer), gx, gy);
    vec4 b = textureGrad(tex, vec3(uv + ob * 7.0, layer), gx, gy);
    // Weighted toward the stronger one, so the blend keeps the texture's contrast.
    float k = smoothstep(0.3, 0.7, wb / (wa + wb));
    return mix(a, b, k);
}
vec3 townLayerN(highp sampler2DArray tex, float layer, vec2 uv, float stochastic) {
    vec2 gx = dFdx(uv);
    vec2 gy = dFdy(uv);
    if (stochastic < 0.5) return textureGrad(tex, vec3(uv, layer), gx, gy).xyz * 2.0 - 1.0;
    vec2 g = uv * 0.5;
    vec2 fa = fract(g);
    vec2 fb = fract(g + 0.5);
    vec2 oa = vec2(townHash(floor(g) + layer), townHash(floor(g) + layer + 4.7));
    vec2 ob = vec2(townHash(floor(g + 0.5) + layer + 9.1), townHash(floor(g + 0.5) + layer + 2.3));
    float wa = min(min(fa.x, 1.0 - fa.x), min(fa.y, 1.0 - fa.y)) + 0.02;
    float wb = min(min(fb.x, 1.0 - fb.x), min(fb.y, 1.0 - fb.y)) + 0.02;
    vec3 a = textureGrad(tex, vec3(uv + oa * 7.0, layer), gx, gy).xyz * 2.0 - 1.0;
    vec3 b = textureGrad(tex, vec3(uv + ob * 7.0, layer), gx, gy).xyz * 2.0 - 1.0;
    return normalize(mix(a, b, smoothstep(0.3, 0.7, wb / (wa + wb))));
}
// Raindrops on standing water: rings spreading from random points, two layers of cells, as a normal's tilt.
vec2 townRipples(vec2 p, float t) {
    vec2 tilt = vec2(0.0);
    for (int k = 0; k < 2; k++) {
        vec2 cell = floor(p);
        vec2 at = fract(p) - 0.5 - (vec2(townHash(cell + 3.1), townHash(cell + 5.7)) - 0.5) * 0.5;
        float h = townHash(cell + float(k) * 17.0);
        float phase = fract(t * (0.8 + 0.5 * h) + h);
        float r = length(at);
        float ring = r - phase * 0.48;
        tilt += (at / max(r, 1e-3)) * sin(ring * 46.0) * exp(-ring * ring * 260.0) * (1.0 - phase);
        p = p * 1.43 + vec2(3.3, 7.1);
    }
    return tilt;
}`;

/** The world shading normal from the ground's own and a tangent-space detail normal (rows along x, or z). */
const NORMAL_GLSL = (rowsAlongZ: string) => `
#include <normal_fragment_begin>
if (townNormals > 0.5 || townDetailN.z < 0.999) {
    vec3 nw = normalize(vTownNormal);
    vec3 tw;
    vec3 bw;
    if (abs(nw.y) > 0.5) {
        tw = ${rowsAlongZ} ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
        tw = normalize(tw - nw * dot(nw, tw));
        bw = ${rowsAlongZ} ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
        bw = normalize(bw - nw * dot(nw, bw) - tw * dot(tw, bw));
    } else {
        // A face (a kerb's): along the street, and up.
        tw = ${rowsAlongZ} ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
        bw = vec3(0.0, 1.0, 0.0);
    }
    vec3 pw = normalize(tw * townDetailN.x + bw * townDetailN.y + nw * max(townDetailN.z, 0.05));
    normal = normalize((viewMatrix * vec4(pw, 0.0)).xyz);
}`;

const ROUGH_GLSL = `
#include <roughnessmap_fragment>
roughnessFactor = townRough;`;

const METAL_GLSL = `
#include <metalnessmap_fragment>
metalnessFactor = townMetal;`;

/** Wet, puddles, ripples: the common end of both materials (`col`, `rough`, `nT`, `soak`, `pool`, `q`, `near` in scope). */
const WET_GLSL = `
{
    float wet = townWetness;
    col *= 1.0 - wet * soak;
    rough = mix(rough, min(rough, 0.26), wet * step(0.05, soak));
    if (wet > 0.04 && pool > 0.0) {
        float pud = townFbm(q * 0.23 + 3.7) * 0.72 + townNoise(q * 1.25 + 1.3) * 0.28 + pool * 0.22;
        float level = 1.06 - wet * (0.2 + 0.32 * pool);
        float puddle = smoothstep(level, level + 0.05, pud) * smoothstep(0.04, 0.4, wet);
        // Water over the ground: darker, and a mirror (the sky's light and the street lamps reflect in it).
        col = mix(col, col * 0.5, puddle);
        rough = mix(rough, 0.04, puddle);
        nT = normalize(mix(nT, vec3(0.0, 0.0, 1.0), puddle));
        if (townRain > 0.02 && townLite < 0.5) {
            float ripplesNear = 1.0 - smoothstep(8.0, 34.0, dist);
            if (ripplesNear > 0.0) nT = normalize(nT + vec3(townRipples(q * 2.7, townTime) * 0.55 * townRain * puddle * ripplesNear, 0.0));
        }
    }
    townRough = clamp(rough, 0.04, 1.0);
    townDetailN = nT;
}`;

// MARK: - The ground

const GROUND_TINTS = {soil: lin("#8c7b5c"), sand: lin("#d3c196"), mud: lin("#5f563f"), forest: lin("#6b5d3e"), dry: lin("#b5a463")};

const GROUND_COLOUR = `
#include <color_fragment>
{
    vec2 local = vTownWorld.xz - townOrigin;
    vec2 q = local;
    float dist = distance(cameraPosition, vTownWorld);
    float fade = 1.0 - smoothstep(80.0, 300.0, dist);
    float near = (1.0 - smoothstep(6.0, 22.0, dist)) * (1.0 - townLite);
    // What covers the ground here, its edges ragged: the weights cross 0.5 along a line the noise breaks up.
    float edge = (townNoise(local * 0.8) - 0.5) * 0.5 + (townNoise(local * 3.3 + 7.0) - 0.5) * 0.2;
    vec4 ws = smoothstep(0.34, 0.66, vTownSurf + edge);
    float lawn = smoothstep(0.4, 0.6, vTownSurf2.x + edge * 0.5);
    float worn = smoothstep(0.35, 0.75, vTownSurf2.y * (0.6 + 0.8 * townFbm(local * 0.18 + 2.0)));
    float bed = vTownSurf2.z;
    vec3 tint = diffuseColor.rgb;
    tint = mix(tint, ${GROUND_TINTS.soil}, ws.x * 0.6);
    tint = mix(tint, ${GROUND_TINTS.sand}, ws.y * 0.6);
    tint = mix(tint, ${GROUND_TINTS.mud}, ws.z * 0.6);
    tint = mix(tint, ${GROUND_TINTS.forest}, ws.w * 0.6);
    // Grass: clumps, dry patches on the rises, mown stripes on the lawns (the park, the gardens, the zoo's lawns).
    float clumps = townFbm(local * 0.45);
    tint *= 0.86 + 0.28 * clumps;
    tint = mix(tint, ${GROUND_TINTS.dry} * (0.8 + 0.3 * clumps), smoothstep(0.58, 0.82, townFbm(local * 0.06 + 9.0)) * 0.3 * (1.0 - ws.y));
    // (Its edges a pixel soft, so the stripes never crawl.)
    float stripeAt = local.x / 2.6 + 0.08 * townNoise(local * 0.2);
    float stripeW = max(fwidth(stripeAt), 1e-4);
    float stripe = smoothstep(0.5 - stripeW, 0.5 + stripeW, fract(stripeAt)) * (1.0 - smoothstep(1.0 - stripeW, 1.0, fract(stripeAt)));
    tint *= 1.0 + lawn * (stripe - 0.5) * 0.09 * (1.0 - smoothstep(60.0, 200.0, dist));
    // Paddocks worn to soil at the gates and along the fence.
    float wSoil = max(ws.x, worn * (1.0 - ws.y));
    tint = mix(tint, ${GROUND_TINTS.soil} * 0.9, worn * 0.7);
    vec3 col = tint;
    float rough = 0.95;
    vec3 nT = vec3(0.0, 0.0, 1.0);
    float soak = 0.22 + 0.18 * wSoil;
    float pool = max(wSoil * 0.55, ws.z * 0.7) * (1.0 - bed);
    if (groundReady > 0.5) {
        float st = 1.0;
        vec3 t = townLayer(groundAlbedo, 0.0, local * 0.34, st).rgb / groundMeans[0];
        vec3 n = vec3(0.0, 0.0, 1.0);
        bool normals = townLite < 0.5;
        if (normals) n = townLayerN(groundNormal, 0.0, local * 0.34, st);
        #define TOWN_GROUND_LAYER(L, W, S) if (W > 0.01) { vec3 t_ = townLayer(groundAlbedo, L, local * S, st).rgb / groundMeans[int(L)]; t = mix(t, t_, W); if (normals) n = normalize(mix(n, townLayerN(groundNormal, L, local * S, st), W)); }
        TOWN_GROUND_LAYER(1.0, ws.w, 0.4)
        TOWN_GROUND_LAYER(2.0, wSoil, 0.3)
        // Farmyards: mud in the low, trodden places.
        float mudPatch = max(ws.z, ws.x * smoothstep(0.5, 0.72, townFbm(local * 0.21 + 4.0)));
        TOWN_GROUND_LAYER(6.0, mudPatch, 0.33)
        float wetSand = ws.y * (1.0 - smoothstep(0.0, 0.7, vTownWorld.y - envSeaLevel));
        TOWN_GROUND_LAYER(3.0, ws.y * (1.0 - wetSand), 0.25)
        TOWN_GROUND_LAYER(4.0, wetSand, 0.25)
        // Close up: the grain of the same ground, four times finer.
        if (near > 0.01) {
            vec3 d_ = townLayer(groundAlbedo, mix(0.0, 2.0, step(0.5, wSoil)), local * 1.37 + 0.31, 0.0).rgb / groundMeans[int(mix(0.0, 2.0, step(0.5, wSoil)))];
            t *= mix(1.0, dot(d_, vec3(0.3333)), 0.3 * near);
        }
        col = tint * mix(vec3(1.0), t, fade);
        nT = normalize(mix(vec3(0.0, 0.0, 1.0), n, fade * 0.85));
        if (mudPatch > 0.3) rough = mix(rough, 0.8, mudPatch);
    } else {
        col *= 0.88 + 0.24 * (townNoise(local * 1.7) * 0.6 + townNoise(local * 0.23) * 0.4);
    }
    // The beds of the canal, the ponds and the sea: darker with depth.
    col *= mix(1.0, 0.72, bed);
${WET_GLSL}
    diffuseColor.rgb = col;
}`;

/** The ground tiles' material (each vertex: `aTownSurf` soil, sand, mud, forest floor; `aTownSurf2` lawn, wear, bed). */
export function townGroundMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.95, metalness: 0});
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
        Object.assign(shader.uniforms, UNIFORMS);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nattribute vec4 aTownSurf;\nattribute vec4 aTownSurf2;\nvarying vec4 vTownSurf;\nvarying vec4 vTownSurf2;")
            .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTownSurf = aTownSurf;\nvTownSurf2 = aTownSurf2;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\nvarying vec4 vTownSurf;\nvarying vec4 vTownSurf2;`)
            .replace("#include <color_fragment>", GROUND_COLOUR)
            .replace("#include <roughnessmap_fragment>", ROUGH_GLSL)
            .replace("#include <normal_fragment_begin>", NORMAL_GLSL("false"));
        patchTownShader(shader, {soak: 0, wetRoughness: 0.3, lamps: true, cloud: true, colour: false, roughness: false});
        // The cloud shade (the kit's colour step is off here: the ground does its own wetting).
        shader.fragmentShader = shader.fragmentShader.replace("    diffuseColor.rgb = col;\n}", "    diffuseColor.rgb = col * townCloudShade(vTownWorld);\n}");
        // (The paving's functions read the kit's noise: after it.)
        shader.fragmentShader = shader.fragmentShader.replace(/(float townCloudShade\(vec3 world\) \{[\s\S]*?\n\})/, `$1\n${PAVE_PARS}`);
    };
    material.customProgramCacheKey = () => "town-ground-2";
    return material;
}

// MARK: - The paving

const P = {
    road: lin("#55585c"),
    iron: lin("#3a3936"),
    rust: lin("#6d4a32")
};

const PAVING_COLOUR = `
#include <color_fragment>
{
    float tag = vTownTag + 0.0005;
    float sid = floor(tag / 8.0);
    float rest = tag - sid * 8.0;
    float zAxis = step(4.0, rest);
    float across = clamp(rest - zAxis * 4.0 - 1.0, -1.0, 1.0);
    vTownRows = zAxis;
    vec2 local = vTownWorld.xz - townOrigin;
    vec2 q = zAxis > 0.5 ? local.yx : local;
    int id = int(sid + 0.5);
    float dist = distance(cameraPosition, vTownWorld);
    float fade = 1.0 - smoothstep(90.0, 320.0, dist);
    float near = (1.0 - smoothstep(6.0, 22.0, dist)) * (1.0 - townLite);
    bool normals = townNormals > 0.5;
    vec3 tint = diffuseColor.rgb;
    vec3 col = tint;
    float rough = 0.92;
    vec3 nT = vec3(0.0, 0.0, 1.0);
    float soak = 0.0;
    float pool = 0.0;
    float layer = -1.0;
    float metres = 1.0;
    float st = 0.0;
    vec2 uv = q;
    if (id == 1 || id == 2) { layer = 0.0; metres = ${f(TOWN_LAYER_METRES[0])}; st = 1.0; soak = 0.42; pool = 0.35; }
    else if (id == 3) { layer = 1.0; metres = ${f(TOWN_LAYER_METRES[1])}; soak = 0.36; pool = 0.22; }
    else if (id == 4) { layer = 2.0; metres = ${f(TOWN_LAYER_METRES[2])}; soak = 0.4; pool = 0.32; }
    else if (id == 5) { layer = 3.0; metres = ${f(TOWN_LAYER_METRES[3])}; st = 1.0; soak = 0.35; pool = 0.5; }
    else if (id == 6) { layer = 4.0; metres = ${f(TOWN_LAYER_METRES[4])}; soak = 0.34; pool = 0.2; }
    else if (id == 11 || id == 12) { layer = 5.0; metres = ${f(TOWN_LAYER_METRES[5])}; soak = 0.3; pool = id == 12 ? 0.3 : 0.0; }
    // A kerb's face: along the street, and up.
    if (id == 11 && abs(vTownNormal.y) < 0.5) uv = vec2(q.x, vTownWorld.y);
    if (layer >= 0.0 && townReady > 0.5) {
        vec4 t = townLayer(townAlbedo, layer, uv / metres, st);
        vec3 c = t.rgb / townMeans[int(layer)];
        // Gravel reads by its stones: more of the texture's own contrast.
        if (id == 5) c = max(mix(vec3(1.0), c, 1.6), vec3(0.2));
        if (near > 0.01) {
            vec3 d = townLayer(townAlbedo, layer, uv / metres * 4.1 + 0.37, 0.0).rgb / townMeans[int(layer)];
            c *= mix(1.0, dot(d, vec3(0.3333)), 0.22 * near);
        }
        col = tint * mix(vec3(1.0), c, fade);
        rough = mix(0.85, t.a, fade);
        if (normals) nT = normalize(mix(vec3(0.0, 0.0, 1.0), townLayerN(townNormal, layer, uv / metres, st), fade));
    } else if (id > 0) {
        col *= 0.9 + 0.2 * townNoise(local * 2.3);
    }
    // Wear and grime over the whole of each surface: a slow drift of tone, so no two stretches match.
    if (id > 0) col *= 0.93 + 0.14 * townFbm(q * 0.06 + sid);
    if (id == 1) {
        // Asphalt: two lanes kerb to kerb; the wheel tracks polished darker, the oil line down each lane's middle,
        // grime and leaves in the gutters, and the odd rectangle of newer asphalt over a dug trench.
        float l = abs(across);
        float lane = abs(l - 0.5);
        float wheel = exp(-pow((lane - 0.24) / 0.075, 2.0));
        float oil = exp(-pow(lane / 0.05, 2.0)) * smoothstep(0.4, 0.8, townNoise(q * vec2(0.7, 1.9)));
        float gutter = smoothstep(0.82, 0.98, l);
        col *= 1.0 - 0.07 * wheel - 0.22 * oil - 0.16 * gutter;
        rough -= 0.12 * wheel + 0.18 * oil;
        vec2 cell = vec2(floor(q.x / 7.0), floor((across + 1.0) * 1.5));
        vec2 inCell = vec2(fract(q.x / 7.0), fract((across + 1.0) * 1.5));
        float patchHere = step(0.84, townHash(cell + 11.3)) * step(0.12, inCell.x) * step(inCell.x, 0.78) * step(0.08, inCell.y) * step(inCell.y, 0.86);
        col *= 1.0 - 0.17 * patchHere;
        pool = 0.3 + 0.5 * gutter + 0.2 * wheel;
        if (groundReady > 0.5 && gutter > 0.01) {
            vec4 leaves = texture(groundAlbedo, vec3(q * 0.4, 1.0));
            float fall = gutter * smoothstep(0.55, 0.8, townNoise(q * 0.9 + 4.0));
            col = mix(col, leaves.rgb * 0.8, fall * 0.7 * fade);
        }
    } else if (id == 2) {
        // Paint: worn where the wheels run and in flakes, the asphalt showing through.
        vec3 road = ${P.road} * (0.93 + 0.14 * townFbm(q * 0.06 + 1.0));
        if (townReady > 0.5) road *= mix(vec3(1.0), townLayer(townAlbedo, 0.0, q / ${f(TOWN_LAYER_METRES[0])}, 1.0).rgb / townMeans[0], fade);
        float l = abs(across);
        float wear = 0.18 + 0.4 * exp(-pow((abs(l - 0.5) - 0.24) / 0.09, 2.0));
        float cover = smoothstep(wear - 0.08, wear + 0.08, townFbm(q * 3.1) * 0.6 + townNoise(q * 11.0) * 0.4 * near + 0.2 * (1.0 - near));
        col = mix(road, tint * (0.9 + 0.1 * townNoise(q * 5.0)), cover);
        rough = mix(rough, 0.55, cover);
        nT = normalize(mix(nT, vec3(0.0, 0.0, 1.0), cover * 0.6));
        soak = mix(0.4, 0.15, cover);
        pool = 0.3;
    } else if (id == 3) {
        // Slabs: odd ones replaced (lighter, newer), old stains and chewing gum, the kerb side dirtier.
        float cell = townHash(floor(q / vec2(0.6, 0.3)) + 2.0);
        col *= 1.0 + 0.1 * step(0.93, cell) - 0.06 * step(cell, 0.06);
        float gum = smoothstep(0.82, 0.9, townNoise(q * 13.0)) * smoothstep(0.4, 0.7, townNoise(q * 0.7));
        col *= 1.0 - 0.35 * gum * (0.4 + 0.6 * near);
        col *= 1.0 - 0.08 * smoothstep(-0.6, -1.0, across);
    } else if (id == 7) {
        // Earth: a farm track's two ruts and grassy crown, mud in the low places.
        vec3 soil = ${GROUND_TINTS.soil};
        vec3 c = vec3(1.0);
        if (groundReady > 0.5) c = mix(vec3(1.0), townLayer(groundAlbedo, 2.0, q * 0.3, 1.0).rgb / groundMeans[2], fade);
        col = tint * c;
        float rut = exp(-pow((abs(across) - 0.45) / 0.13, 2.0));
        float crown = (1.0 - smoothstep(0.08, 0.22, abs(across))) * smoothstep(0.3, 0.6, townNoise(q * 2.2));
        if (groundReady > 0.5) col = mix(col, ${lin("#6f8c4a")} * townLayer(groundAlbedo, 0.0, q * 0.34, 1.0).rgb / groundMeans[0], crown * 0.8 * fade);
        float mud = max(rut * 0.8, smoothstep(0.55, 0.75, townFbm(q * 0.2 + 4.0)));
        if (groundReady > 0.5) col = mix(col, ${GROUND_TINTS.mud} * townLayer(groundAlbedo, 6.0, q * 0.33, 1.0).rgb / groundMeans[6], mud * 0.6 * fade);
        col = mix(col, soil * 0.8, rut * 0.25);
        rough = 0.92 - 0.12 * mud;
        soak = 0.45;
        pool = 0.4 + 0.5 * rut;
        if (normals && groundReady > 0.5) nT = normalize(mix(vec3(0.0, 0.0, 1.0), townLayerN(groundNormal, 2.0, q * 0.3, 1.0), fade));
    } else if (id == 8) {
        if (groundReady > 0.5) col = tint * mix(vec3(1.0), townLayer(groundAlbedo, 3.0, q * 0.25, 1.0).rgb / groundMeans[3], fade);
        rough = 0.95;
        soak = 0.3;
        pool = 0.15;
        if (normals && groundReady > 0.5) nT = normalize(mix(vec3(0.0, 0.0, 1.0), townLayerN(groundNormal, 3.0, q * 0.25, 1.0), fade));
    } else if (id == 9 || id == 10) {
        // Crops and grass: green rows take the grass, brown rows the tilled soil.
        float plant = id == 10 ? 1.0 : smoothstep(0.0, 0.03, tint.g - tint.r);
        if (groundReady > 0.5) {
            vec3 g = townLayer(groundAlbedo, 0.0, q * 0.34, 1.0).rgb / groundMeans[0];
            vec3 s = townLayer(groundAlbedo, 8.0, q * 0.3, 1.0).rgb / groundMeans[8];
            col = tint * mix(vec3(1.0), mix(s, g, plant), fade);
            if (normals) nT = normalize(mix(vec3(0.0, 0.0, 1.0), townLayerN(groundNormal, plant > 0.5 ? 0.0 : 8.0, q * 0.32, 1.0), fade));
        }
        col *= 0.9 + 0.18 * townFbm(q * 0.5);
        rough = 0.95;
        soak = 0.3;
        pool = (1.0 - plant) * 0.35;
    } else if (id == 11) {
        // Kerbs: the road's grime up the face, a little lighter on top where feet wear them.
        if (abs(vTownNormal.y) < 0.5) col *= 0.84;
        soak = 0.3;
    } else if (id == 13 || id == 14) {
        // Iron in the road: a manhole cover's frame and diamond tread, or a gully grating's bars over the dark drain.
        float u = across;
        float v = fract(q.x / (id == 13 ? ${f(MANHOLE)} : ${f(GRATE.along)})) * 2.0 - 1.0;
        float frame = step(0.82, max(abs(u), abs(v)));
        vec3 iron = ${P.iron} * (0.85 + 0.3 * townNoise(q * 6.0));
        float rust = smoothstep(0.55, 0.8, townFbm(q * 3.0 + 9.0));
        iron = mix(iron, ${P.rust}, rust * 0.45);
        if (id == 13) {
            vec2 g = abs(fract(vec2(u + v, u - v) * 5.0) - 0.5);
            float tread = step(0.36, max(g.x, g.y));
            col = iron * (1.0 - 0.25 * tread) * (1.0 - 0.15 * frame);
            // Polished by the tyres in its middle.
            rough = 0.5 - 0.15 * (1.0 - frame) - 0.1 * tread;
            if (normals) nT = normalize(vec3(sign(fract((u + v) * 5.0) - 0.5) * tread * 0.25, sign(fract((u - v) * 5.0) - 0.5) * tread * 0.25, 1.0));
            pool = 0.0;
        } else {
            float slot = step(abs(fract(u * 3.5 + 0.5) - 0.5), 0.3) * (1.0 - frame);
            col = mix(iron, vec3(0.008, 0.008, 0.007), slot);
            rough = mix(0.55, 0.9, slot);
            if (normals) nT = normalize(vec3(sin(u * 3.5 * 6.2832) * 0.35 * (1.0 - frame), 0.0, 1.0));
        }
        townMetal = mix(0.55, 0.0, rust * 0.6);
        soak = 0.05;
    }
${WET_GLSL}
    diffuseColor.rgb = col;
}`;

/** The decals' material (`surface-tags.ts` tags in `aTag`): the town's paving. Untagged decals draw as before. */
export function townPavingMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
        Object.assign(shader.uniforms, UNIFORMS);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nattribute float aTag;\nvarying float vTownTag;")
            .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTownTag = aTag;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying float vTownTag;\nfloat vTownRows = 0.0;")
            .replace("#include <color_fragment>", PAVING_COLOUR)
            .replace("#include <roughnessmap_fragment>", ROUGH_GLSL)
            .replace("#include <metalnessmap_fragment>", METAL_GLSL)
            .replace("#include <normal_fragment_begin>", NORMAL_GLSL("(vTownRows > 0.5)"));
        patchTownShader(shader, {soak: 0, wetRoughness: 0.3, lamps: true, cloud: true, colour: false, roughness: false});
        shader.fragmentShader = shader.fragmentShader.replace("    diffuseColor.rgb = col;\n}", "    diffuseColor.rgb = col * townCloudShade(vTownWorld);\n}").replace(/(float townCloudShade\(vec3 world\) \{[\s\S]*?\n\})/, `$1\n${PAVE_PARS}`);
    };
    material.customProgramCacheKey = () => "town-paving-2";
    return material;
}
