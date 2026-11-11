/**
 * The world's ground and water.
 *
 * Ground: one heightfield mesh, one shader. Each vertex carries its zones'
 * blended base colour (with ambient occlusion baked from the ground's own
 * hollows) and four layer weights — sand, wet mud, farmland, snow — and the
 * fragment shader paints the detail from world-space noise: grass with
 * clumps and dry patches, sand with ripples, rock wherever the slope is
 * steep (banded like strata), snow on the peaks and the ice, wet mud at the
 * wetland, tilled fields with hedgerows at Home, darker wet sand at the
 * waterline, and cloud shadows drifting over all of it.
 *
 * Water: one plane that reads the depth under it from a map made with the
 * ground. Turquoise over the reef's shallows, deep blue offshore, calmer and
 * greener on the lake and the river; procedural waves for the normal, the
 * sky in it by Fresnel, the sun's glint, and foam lines along every shore.
 * Clear in the shallows, so what swims there shows through.
 */

import {
    BufferAttribute,
    Color,
    DataTexture,
    LinearFilter,
    Mesh,
    MeshStandardMaterial,
    PlaneGeometry,
    RGBAFormat,
    ShaderMaterial,
    UniformsLib,
    UniformsUtils,
    Vector3,
    DoubleSide,
    type BufferGeometry
} from "three";
import {ARK_DAYLIGHT, ARK_ENV, ARK_GLINT, ARK_SKY_HORIZON, ARK_SKY_ZENITH, ARK_SUN, ARK_TIME, ARK_WIND, CLOUD_GLSL, NOISE_GLSL} from "@/ark-scene/glsl";
import {FIELD_TONES, ROCK, SNOW, WATER, WET_SAND, ZONE_PALETTES} from "@/ark-scene/palettes";
import {fbm, LAKE, noise, RIVER, sampleGround, smoothstep, TERRAIN_HALF} from "@/ark-scene/world";
import {ARK_GROUND_TEXTURES, GROUND_MEANS} from "@/ark-scene/ground-textures";
import {fieldsGlsl, HEADLAND} from "@/ark-scene/fields";

/** How rough the sea is: 1 in the usual breeze, more in wind and storms (set with the environment). */
export const WATER_WIND = {value: 1};

/** 1 on the low tier: one texture sample per layer and no normal maps. */
export const ARK_GROUND_LITE = {value: 0};

const SEGMENTS = 240;

function srgb(hex: string): Color {
    return new Color(hex);
}

/** A colour as a GLSL constant in the shader's linear space (batch 4: the crops' tones). */
function linearVec3(hex: string): string {
    const c = new Color(hex);
    return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
}

// MARK: - Ground

/** The river's direction downstream at a point: along its nearest segment (radians, atan2(dz, dx); always 0…π, it runs south). */
function flowAngle(x: number, z: number): number {
    let best = Infinity;
    let angle = Math.PI / 2;
    for (let i = 1; i < RIVER.length; i++) {
        const [ax, az] = RIVER[i - 1];
        const [bx, bz] = RIVER[i];
        const dx = bx - ax;
        const dz = bz - az;
        const t = Math.min(Math.max(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0), 1);
        const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
        if (d < best) {
            best = d;
            angle = Math.atan2(dz, dx);
        }
    }
    return Math.min(Math.max(angle, 0), Math.PI);
}

/**
 * Scree (batch 4): the gentler ground just below a steep rock face, where what falls off it gathers. Read from the
 * heightfield itself: for each point, the nearest steep ground above it within about 7 m, uphill, weighted by how
 * close it is. Writes `out[i * 2]`.
 */
function screeLayer(heights: Float32Array, size: number, out: Float32Array) {
    const cell = (TERRAIN_HALF * 2) / SEGMENTS;
    const slopes = new Float32Array(size * size);
    for (let row = 0; row < size; row++) {
        for (let column = 0; column < size; column++) {
            const i = row * size + column;
            const left = heights[row * size + Math.max(column - 1, 0)];
            const right = heights[row * size + Math.min(column + 1, size - 1)];
            const up = heights[Math.max(row - 1, 0) * size + column];
            const down = heights[Math.min(row + 1, size - 1) * size + column];
            const dx = (right - left) / (2 * cell);
            const dz = (down - up) / (2 * cell);
            slopes[i] = 1 - 1 / Math.sqrt(1 + dx * dx + dz * dz);
        }
    }
    const directions = Array.from({length: 12}, (_, k) => [Math.cos((k / 12) * Math.PI * 2), Math.sin((k / 12) * Math.PI * 2)]);
    for (let row = 0; row < size; row++) {
        for (let column = 0; column < size; column++) {
            const i = row * size + column;
            const h = heights[i];
            if (h < 2.5 || slopes[i] > 0.42) continue;
            let scree = 0;
            for (let reach = 2; reach <= 6; reach++) {
                for (const [dc, dr] of directions) {
                    const c = Math.round(column + dc * reach);
                    const r = Math.round(row + dr * reach);
                    if (c < 0 || r < 0 || c >= size || r >= size) continue;
                    const j = r * size + c;
                    if (heights[j] < h + reach * cell * 0.35) continue;
                    scree = Math.max(scree, smoothstep(0.4, 0.6, slopes[j]) * (1 - (reach - 1) / 6));
                }
                if (scree > 0.8) break;
            }
            out[i * 2] = scree * smoothstep(2.5, 6, h) * (1 - smoothstep(0.3, 0.42, slopes[i]));
        }
    }
}

function groundGeometry(): {geometry: BufferGeometry; depth: DataTexture} {
    const geometry = new PlaneGeometry(TERRAIN_HALF * 2, TERRAIN_HALF * 2, SEGMENTS, SEGMENTS);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.getAttribute("position") as BufferAttribute;
    const count = position.count;
    const size = SEGMENTS + 1;
    const colors = new Float32Array(count * 3);
    const layers = new Float32Array(count * 4);
    // Batch 1 (graphics): forest floor, open ground (grassland and desert: bare soil patches), wet bank (river and lake), cliff.
    const layers2 = new Float32Array(count * 4);
    // Batch 4 (graphics): scree at the foot of the rock faces (x) and how much a point is the mountain (y).
    const rockLayers = new Float32Array(count * 2);
    const heights = new Float32Array(count);
    const color = new Color();
    const mix = new Color();
    const palettes = Object.fromEntries(Object.entries(ZONE_PALETTES).map(([zone, palette]) => [zone, [srgb(palette.ground[0]), srgb(palette.ground[1])]])) as Record<string, [Color, Color]>;
    const sand = srgb(ZONE_PALETTES.seashore.ground[0]);
    const reefFloor = srgb(ZONE_PALETTES.coral_reef.ground[0]);
    const seaFloor = srgb(ZONE_PALETTES.open_ocean.ground[0]);

    // The water plane reads depth (r), reef (g) and fresh water (b) from this map.
    const depthPixels = new Uint8Array(count * 4);

    for (let i = 0; i < count; i++) {
        const x = position.getX(i);
        const z = position.getZ(i);
        const sample = sampleGround(x, z);
        position.setY(i, sample.height);
        heights[i] = sample.height;
        const w = sample.weights;

        color.setRGB(0, 0, 0);
        for (const [zone, weight] of Object.entries(w)) {
            if (weight < 0.004) continue;
            const [a, b] = palettes[zone];
            mix.copy(a).lerp(b, fbm(x * 0.07 + 11, z * 0.07 - 3));
            color.r += mix.r * weight;
            color.g += mix.g * weight;
            color.b += mix.b * weight;
        }
        const polar = w.polar ?? 0;
        const beach = (1 - smoothstep(0.45, 1, sample.land)) * (1 - polar) * (1 - sample.cliff);
        color.lerp(sand, beach * 0.85);
        if (sample.height < 0) {
            const floor = mix.copy(seaFloor).lerp(reefFloor, sample.reef);
            color.lerp(floor, smoothstep(0.2, 3, -sample.height));
        }
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        // Layers: sand (beaches, desert, the reef floor), wet mud (wetland), farmland, snow.
        const sandLayer = Math.min(1, beach + (w.desert ?? 0) * 0.9 + (w.seashore ?? 0) * 0.7 + (sample.height < 0 ? sample.reef : 0));
        const mud = (w.wetland ?? 0) * smoothstep(0.2, 1, sample.land) * (1 - beach);
        const farmland = (w.farm_garden ?? 0) * smoothstep(0.6, 1, sample.land) * (sample.height > 0.2 ? 1 : 0);
        // The ice's snow only: the mountain's is drawn per pixel by height and slope (graphics pass).
        const snow = polar * smoothstep(0.3, 1, sample.land);
        layers[i * 4] = sandLayer;
        layers[i * 4 + 1] = mud;
        layers[i * 4 + 2] = farmland;
        layers[i * 4 + 3] = snow;
        const land = smoothstep(0.3, 1, sample.land);
        layers2[i * 4] = ((w.rainforest ?? 0) + (w.woodland ?? 0) + (w.mountains ?? 0) * 0.35) * land * (1 - snow);
        layers2[i * 4 + 1] = ((w.grassland ?? 0) + (w.desert ?? 0) * 0.5 + (w.mountains ?? 0) * 0.3) * land;
        const lakeBank = smoothstep(LAKE.r + 5, LAKE.r + 0.5, Math.hypot(x - LAKE.x, z - LAKE.z));
        layers2[i * 4 + 2] = Math.max(lakeBank, smoothstep(6.5, 2.5, sample.river) * (sample.inland > 3 ? 1 : 0)) * (1 - snow);
        layers2[i * 4 + 3] = sample.cliff;
        rockLayers[i * 2 + 1] = Math.min(1, (w.mountains ?? 0) + smoothstep(10, 22, sample.height)) * (1 - polar);

        const at = i * 4;
        const depth = Math.max(-sample.height, 0);
        depthPixels[at] = Math.min(255, Math.round(depth / 12 * 255));
        depthPixels[at + 1] = Math.round(sample.reef * 255);
        const fresh = smoothstep(LAKE.r + 4, LAKE.r, Math.hypot(x - LAKE.x, z - LAKE.z)) + (sample.river < 5 && sample.inland > 4 ? 1 : 0);
        depthPixels[at + 2] = Math.round(Math.min(fresh, 1) * 255);
        // The river's flow (graphics pass): its direction downstream as an angle in 0.5…1 (0 = still water).
        depthPixels[at + 3] = sample.river < 5 && sample.inland > 3 && Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r + 2 ? Math.round((0.5 + flowAngle(x, z) / (Math.PI * 2)) * 255) : 0;
    }

    // Ambient occlusion from the ground's own shape: a vertex lower than its
    // neighbours (a gully, the foot of a slope) gets less sky.
    const reach = 3;
    for (let row = 0; row < size; row++) {
        for (let column = 0; column < size; column++) {
            const i = row * size + column;
            let sum = 0;
            let n = 0;
            for (let dr = -reach; dr <= reach; dr += reach) {
                for (let dc = -reach; dc <= reach; dc += reach) {
                    const r = row + dr;
                    const c = column + dc;
                    if (r < 0 || c < 0 || r >= size || c >= size || (dr === 0 && dc === 0)) continue;
                    sum += heights[r * size + c];
                    n++;
                }
            }
            const hollow = Math.max(sum / n - heights[i], 0);
            const ao = 1 - Math.min(hollow * 0.22, 0.42);
            colors[i * 3] *= ao;
            colors[i * 3 + 1] *= ao;
            colors[i * 3 + 2] *= ao;
        }
    }
    screeLayer(heights, size, rockLayers);
    geometry.computeVertexNormals();
    geometry.setAttribute("arkRock", new BufferAttribute(rockLayers, 2));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.setAttribute("arkLayers", new BufferAttribute(layers, 4));
    geometry.setAttribute("arkLayers2", new BufferAttribute(layers2, 4));

    const depth = new DataTexture(depthPixels, size, size, RGBAFormat);
    depth.flipY = false;
    depth.magFilter = LinearFilter;
    depth.minFilter = LinearFilter;
    depth.needsUpdate = true;
    return {geometry, depth};
}

/** How strongly the sun's caustics play on the sea floor (the layers addendum): by day, stronger seen from under the water. */
export const ARK_CAUSTICS = {value: 0.25};

function groundMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.94, metalness: 0});
    const uniforms = {
        arkTime: ARK_TIME,
        arkWind: ARK_WIND,
        fieldTones: {value: FIELD_TONES.map(srgb)},
        sandTone: {value: srgb(ZONE_PALETTES.seashore.ground[0])},
        wetSand: {value: srgb(WET_SAND)},
        rockTone: {value: srgb(ROCK)},
        rockLight: {value: srgb("#a89d8a")},
        snowTone: {value: srgb(SNOW)},
        mudTone: {value: srgb("#6e6646")},
        soilTone: {value: srgb("#7a5c3e")},
        hedgeTone: {value: srgb("#3f5a2a")},
        dryGrass: {value: srgb("#b9a35e")},
        arkCaustics: ARK_CAUSTICS,
        groundAlbedo: ARK_GROUND_TEXTURES.albedo,
        groundNormal: ARK_GROUND_TEXTURES.normal,
        groundReady: ARK_GROUND_TEXTURES.ready,
        groundMeans: {value: GROUND_MEANS.map(([r, g, b]) => new Vector3(r, g, b))},
        groundLite: ARK_GROUND_LITE,
        envWetness: ARK_ENV.wetness,
        envSnow: ARK_ENV.snow,
        envSeaLevel: ARK_ENV.seaLevel,
        envWind: ARK_ENV.wind,
        rockDark: {value: srgb("#5c574f")},
        arkDaylight: ARK_DAYLIGHT
    };
    material.customProgramCacheKey = () => "ark-ground-3";
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
attribute vec4 arkLayers;
attribute vec4 arkLayers2;
attribute vec2 arkRock;
varying vec4 vArkLayers;
varying vec4 vArkLayers2;
varying vec2 vArkRock;
varying vec3 vArkWorld;
varying vec3 vArkNormal;`)
            .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
vArkWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vArkNormal = normalize(mat3(modelMatrix) * objectNormal);
vArkLayers = arkLayers;
vArkLayers2 = arkLayers2;
vArkRock = arkRock;`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
varying vec4 vArkLayers;
varying vec4 vArkLayers2;
varying vec2 vArkRock;
varying vec3 vArkWorld;
varying vec3 vArkNormal;
uniform vec3 rockDark;
uniform float arkDaylight;
uniform highp sampler2DArray groundAlbedo;
uniform highp sampler2DArray groundNormal;
uniform float groundReady;
uniform float groundLite;
uniform float envWetness;
uniform float envSnow;
uniform float envSeaLevel;
uniform float envWind;
uniform vec3 groundMeans[9];
uniform vec3 fieldTones[${FIELD_TONES.length}];
uniform float arkCaustics;
float arkCausticAt(vec2 p, float t) {
    float c = 0.0;
    vec2 q = p * 0.85;
    for (int i = 0; i < 3; i++) {
        q += vec2(sin(q.y * 1.7 + t * 0.55 + float(i)), cos(q.x * 1.3 - t * 0.47 - float(i))) * 0.42;
        c += abs(sin(q.x + q.y));
    }
    return pow(1.0 - c / 3.0, 5.0) * 6.0;
}
uniform vec3 sandTone;
uniform vec3 wetSand;
uniform vec3 rockTone;
uniform vec3 rockLight;
uniform vec3 snowTone;
uniform vec3 mudTone;
uniform vec3 soilTone;
uniform vec3 hedgeTone;
uniform vec3 dryGrass;
${NOISE_GLSL}
${CLOUD_GLSL}
// The texture layers (ground-textures.ts), sampled twice at turned scales and blended by noise, so no tile repeats.
vec3 arkGroundTex(float layer, vec2 p, float scale) {
    vec2 a = p * scale;
    vec3 c = texture(groundAlbedo, vec3(a, layer)).rgb;
    if (groundLite > 0.5) return c;
    vec2 b = mat2(0.8, -0.6, 0.6, 0.8) * p * scale * 0.61 + vec2(0.37, 0.71);
    return mix(c, texture(groundAlbedo, vec3(b, layer)).rgb, smoothstep(0.3, 0.7, arkNoise(p * 0.09 + layer * 7.0)));
}
vec3 arkGroundNor(float layer, vec2 p, float scale) {
    vec2 a = p * scale;
    vec3 n = texture(groundNormal, vec3(a, layer)).xyz;
    vec2 b = mat2(0.8, -0.6, 0.6, 0.8) * p * scale * 0.61 + vec2(0.37, 0.71);
    vec3 m = texture(groundNormal, vec3(b, layer)).xyz;
    // The second sample is turned: turn its x/y back before blending.
    vec2 mxy = mat2(0.8, 0.6, -0.6, 0.8) * (m.xy * 2.0 - 1.0);
    vec3 nb = vec3(mxy, m.z * 2.0 - 1.0);
    return normalize(mix(n * 2.0 - 1.0, nb, smoothstep(0.3, 0.7, arkNoise(p * 0.09 + layer * 7.0))));
}
vec3 arkGroundTriplanar(float layer, vec3 w, vec3 n, float scale) {
    vec3 k = pow(abs(n), vec3(4.0));
    k /= (k.x + k.y + k.z);
    return texture(groundAlbedo, vec3(w.zy * scale, layer)).rgb * k.x + texture(groundAlbedo, vec3(w.xz * scale, layer)).rgb * k.y + texture(groundAlbedo, vec3(w.xy * scale, layer)).rgb * k.z;
}
vec3 arkGroundDetailN = vec3(0.0, 0.0, 1.0);
// Batch 4: a world-space nudge to the shading normal (the ledges of the rock beds), and how snowy the point is.
vec3 arkBend = vec3(0.0);
float arkSnowy = 0.0;
// How much bare soil a field shows between its plants (the soil texture's share there).
float arkFieldSoil = 0.0;
${fieldsGlsl()}
float arkWet = 0.0;`)
            .replace("#include <color_fragment>", `#include <color_fragment>
{
    vec3 world = vArkWorld;
    vec2 p = world.xz;
    // Screen derivatives of the ground position, taken here in uniform control flow (the fields' rows use them).
    vec2 arkDpdx = dFdx(p);
    vec2 arkDpdy = dFdy(p);
    float near = 1.0 - smoothstep(40.0, 160.0, distance(cameraPosition, world));
    float sandW = vArkLayers.x;
    float mudW = vArkLayers.y;
    float farmW = vArkLayers.z;
    // The rock beds (batch 4): strata about 5 m thick, dipping gently and bending a little with the ground, each
    // either hard (it stands as a cliff band, dark and streaked) or soft (it weathers back into a ledge that catches
    // snow and scree). Their contrast fades where a bed is only a few pixels tall, so far views never shimmer.
    float slopeHere = 1.0 - clamp(normalize(vArkNormal).y, 0.0, 1.0);
    float massif = vArkRock.y;
    // Dipping a few degrees and gently folded, so the beds cross the slopes instead of tracing their contours.
    float bedAt = world.y * 0.19 + (arkFbm(p * 0.018) - 0.5) * 1.8 + dot(p, vec2(0.011, -0.007));
    float bedClear = 1.0 - smoothstep(0.08, 0.2, fwidth(bedAt));
    float bed = floor(bedAt);
    float within = fract(bedAt);
    float hard = step(0.42, arkHash(vec2(bed, 3.1)));
    // Each bed's own tone, drifting a little along it.
    float bedTone = clamp(arkHash(vec2(bed, 7.7)) + 0.35 * (arkFbm(p * 0.035 + bed * 1.7) - 0.5), 0.0, 1.0);
    // Thin bedding planes inside each bed, and ribs and gullies running down the steep faces.
    float planes = (1.0 - smoothstep(0.03, 0.07, fwidth(bedAt))) * smoothstep(0.82, 0.97, fract(bedAt * 3.6 + 0.3 * arkNoise(p * 0.2)));
    vec2 faceAt = abs(vArkNormal.x) > abs(vArkNormal.z) ? vec2(world.z, world.y) : vec2(world.x, world.y);
    float rib = 1.0 - abs(2.0 * arkFbm(vec2(faceAt.x * 0.16, faceAt.y * 0.035 + 5.0)) - 1.0);
    // The top of a soft bed is a ledge; the foot of a hard one, an overhang in shade.
    // Both come and go along the bed, so no line runs unbroken round the mountain.
    float showing = smoothstep(0.3, 0.7, arkNoise(vec2(dot(p, vec2(0.6, 0.8)) * 0.09, bed * 1.3)));
    float ledge = smoothstep(0.72, 0.93, within) * (1.0 - smoothstep(0.93, 1.0, within)) * (1.0 - hard) * showing;
    float underhang = (1.0 - smoothstep(0.0, 0.2, within)) * hard * (0.35 + 0.65 * showing);

    // Mountain snow (graphics pass): continuous above a snow line that wanders with the ground, soft-edged, combed into
    // wind streaks. Batch 4: the upper third holds snow on all but the steepest hard faces, and below the line it lies
    // in lines along the ledges. The weather's snow cover brings the line down.
    float snowLine = 27.0 - 12.0 * envSnow;
    float snowAt = world.y + 5.0 * (arkFbm(p * 0.05) - 0.5) + 1.2 * (arkNoise(p * 0.6) - 0.5);
    float alpine = smoothstep(snowLine - 4.0, snowLine + 2.5, snowAt);
    float high = smoothstep(snowLine + 2.0, snowLine + 11.0, world.y);
    float holdTo = mix(0.48, 0.7, high) - 0.12 * hard * smoothstep(0.4, 0.6, slopeHere);
    alpine *= 1.0 - smoothstep(holdTo, holdTo + 0.28, slopeHere + 0.14 * (arkNoise(p * 0.4) - 0.5));
    float streak = smoothstep(0.25, 0.75, arkNoise(vec2(dot(p, vec2(0.8, 0.6)) * 0.12, dot(p, vec2(-0.6, 0.8)) * 1.4)));
    alpine *= mix(0.8, 1.0, streak) * smoothstep(0.0, 0.25, alpine);
    // Rock ribs stand bare through the snow on the steep faces; the gullies between them fill.
    alpine *= 1.0 - smoothstep(0.55, 0.85, rib) * smoothstep(0.32, 0.55, slopeHere) * (1.0 - 0.5 * high);
    // Snow along a ledge lies in patches, only where the ledge is gentle enough to hold it.
    float ledgeSnow = ledge * bedClear * smoothstep(snowLine - 9.0, snowLine - 3.0, snowAt) * (1.0 - alpine) * massif
        * smoothstep(0.45, 0.75, arkNoise(vec2(dot(p, vec2(0.7, 0.7)) * 0.35, bed))) * (1.0 - smoothstep(0.45, 0.65, slopeHere));
    float snowW = max(max(vArkLayers.w, alpine), ledgeSnow * 0.75);
    vec3 base = diffuseColor.rgb;

    // Grass and earth: clumps, dry patches, a fine grain close up.
    float clumps = arkFbm(p * 0.45);
    float patches = smoothstep(0.55, 0.8, arkFbm(p * 0.06 + 9.0));
    vec3 ground = base * (0.84 + 0.32 * clumps);
    ground = mix(ground, dryGrass * (0.8 + 0.3 * clumps), patches * 0.32 * (1.0 - sandW) * (1.0 - snowW));
    ground *= 1.0 + (arkNoise(p * 3.1) - 0.5) * 0.16 * near;

    // Sand: wind ripples, lighter crests.
    float ripple = sin(dot(p, vec2(0.82, 0.57)) * 2.4 + arkFbm(p * 0.3) * 6.0) * 0.5 + 0.5;
    vec3 sandy = mix(base, sandTone, 0.35) * (0.9 + 0.12 * ripple * near + 0.08 * arkNoise(p * 0.8));
    ground = mix(ground, sandy, smoothstep(0.15, 0.85, sandW));

    // Wetland: dark wet mud in the low hollows, the rest reedy grass.
    float wetPatch = smoothstep(0.5, 0.68, arkFbm(p * 0.22 + 4.0));
    ground = mix(ground, mudTone * (0.85 + 0.25 * arkNoise(p * 1.7)), mudW * wetPatch * 0.7);
    arkWet = max(arkWet, mudW * wetPatch);

    // Home: fields a few metres across, turned off the grid, hedgerows between. Batch 4: each grows its crop
    // (fields.ts: pasture, bare tilled soil, sprouts, cabbages, cereal or maize) in rows that run one way or the
    // other, with a headland at the edge; the close-up plants (near-detail.ts) stand on the same rows.
    if (farmW > 0.01) {
        vec2 f = vec2(dot(p, vec2(0.94, 0.34)) / 9.0, dot(p, vec2(-0.34, 0.94)) / 6.5);
        f.x += floor(f.y) * 0.37;
        float rowAt;
        float alongAt;
        float edgeAt;
        vec2 cell;
        vec2 rowAxis;
        float spacing;
        int crop = arkField(p, rowAt, alongAt, edgeAt, cell, rowAxis, spacing);
        int pick = int(floor(arkHash(cell * 1.31 + 7.0) * ${FIELD_TONES.length}.0));
        vec3 field = fieldTones[0];
        for (int k = 1; k < ${FIELD_TONES.length}; k++) { if (k == pick) field = fieldTones[k]; }
        if (crop > 0) {
            // 1 on a row's middle, 0 between; its contrast fades where rows are under a few pixels apart.
            float inRow = 0.5 + 0.5 * cos(6.2831853 * rowAt);
            float rowWidth = (abs(dot(arkDpdx, rowAxis)) + abs(dot(arkDpdy, rowAxis))) / spacing;
            float rowsClear = 1.0 - smoothstep(0.22, 0.55, rowWidth);
            float growth = 0.85 + 0.3 * arkFbm(p * 0.45 + cell);
            vec3 soil = soilTone * (0.86 + 0.14 * arkNoise(p * 1.7));
            vec3 plant = vec3(0.0);
            float cover = 0.0;
            float coverMean = 0.0;
            if (crop == 1) {
                // Ploughed: ridges and furrows.
                plant = soil;
                soil *= 0.72;
                cover = inRow;
                coverMean = 0.5;
            } else if (crop == 2) {
                plant = ${linearVec3("#5f9136")} * growth;
                cover = smoothstep(0.72, 0.95, inRow) * smoothstep(0.25, 0.6, arkNoise(vec2(alongAt * 4.0, rowAt)));
                coverMean = 0.18;
            } else if (crop == 3) {
                // Cabbages: blue-green heads along each row.
                plant = ${linearVec3("#6f9466")} * growth;
                float heads = smoothstep(0.25, 0.75, 0.5 + 0.5 * cos(6.2831853 * alongAt / 0.45));
                cover = smoothstep(0.45, 0.85, inRow) * heads;
                coverMean = 0.4;
            } else if (crop == 4) {
                // Cereal, ripe or still green by field, rippling as the wind runs over it.
                plant = mix(${linearVec3("#a3a65a")}, ${linearVec3("#cdae62")}, float((arkFieldHash(ivec2(cell)) >> 17u) & 1u)) * growth;
                soil = plant * 0.62;
                cover = 0.55 + 0.45 * inRow;
                coverMean = 0.8;
                plant *= 1.0 + 0.1 * envWind * sin(dot(p, vec2(0.55, 0.83)) * 0.7 - arkTime * 1.7 + 2.0 * arkNoise(p * 0.15));
            } else {
                // Maize: dark green rows over the soil.
                plant = ${linearVec3("#4f7d2e")} * growth;
                cover = smoothstep(0.35, 0.8, inRow);
                coverMean = 0.55;
            }
            vec3 rows = mix(soil, plant, cover);
            vec3 blended = mix(soil, plant, coverMean);
            vec3 cropped = mix(blended, rows, rowsClear);
            // The headland: a grassy strip round the edge. And rows only well inside the farm: never where it fades out
            // onto a beach or a bank (there the field keeps its plain tone).
            float cropsHere = smoothstep(0.62, 0.85, farmW) * (1.0 - smoothstep(0.08, 0.35, sandW)) * (1.0 - smoothstep(0.1, 0.4, vArkLayers2.z));
            float headland = smoothstep(${(HEADLAND - 0.25).toFixed(2)}, ${(HEADLAND + 0.05).toFixed(2)}, edgeAt) * cropsHere;
            field = mix(field * 0.9, cropped, headland);
            arkFieldSoil = headland * (1.0 - mix(coverMean, cover, rowsClear));
            // Ridges and furrows as shape: the normal tips across the rows.
            arkBend += vec3(rowAxis.x, 0.0, rowAxis.y) * (-sin(6.2831853 * rowAt)) * 0.22 * rowsClear * headland * (crop == 4 ? 0.3 : 1.0);
        }
        // The patchiness of real growth.
        field *= 0.9 + 0.16 * arkFbm(p * 0.7) + 0.08 * (arkNoise(p * 5.0) - 0.5) * near;
        float farm = smoothstep(0.3, 0.98, farmW + (arkNoise(p * 0.11 + 3.0) - 0.5) * 0.4);
        vec2 edge = abs(fract(f) - 0.5);
        float hedge = smoothstep(0.468, 0.492, max(edge.x, edge.y)) * smoothstep(0.45, 0.95, farm);
        field = mix(field, hedgeTone * (0.75 + 0.5 * arkNoise(p * 3.0)), hedge * (0.6 + 0.4 * arkNoise(p * 1.1)));
        ground = mix(ground, field, farm * 0.94);
    }

    // Rock wherever it is steep, in its beds (batch 4): each bed its own grey-brown, the hard ones darker and streaked
    // where water runs down them, a pale lip along each ledge and shade under each overhang.
    float slope = 1.0 - clamp(vArkNormal.y, 0.0, 1.0);
    float steep = smoothstep(0.22, 0.42, slope + (arkNoise(p * 0.5) - 0.5) * 0.12);
    float beds = bedClear * mix(0.45, 1.0, massif);
    vec3 rock = mix(rockDark, rockLight, mix(0.45, 0.12 + 0.8 * bedTone - 0.2 * hard, beds) + 0.25 * (arkFbm(p * 0.9) - 0.5) + 0.1 * (arkNoise(p * 4.0) - 0.5));
    // Some beds warmer (iron), some cooler.
    rock *= mix(vec3(1.0), mix(vec3(0.94, 0.97, 1.04), vec3(1.07, 0.99, 0.9), arkHash(vec2(bed, 1.9))), beds);
    float runs = smoothstep(0.5, 0.85, arkNoise(vec2(faceAt.x * 1.1, faceAt.y * 0.05 + bed * 3.0)));
    float gully = smoothstep(0.35, 0.05, rib) * massif;
    rock *= 1.0 - beds * (0.3 * runs * hard + 0.2 * underhang + 0.12 * planes) + beds * 0.1 * ledge;
    rock *= 1.0 - 0.3 * gully + 0.12 * smoothstep(0.7, 0.95, rib) * massif;
    ground = mix(ground, rock, steep * step(0.3, world.y + 0.4));
    // The ledges and overhangs as shape, not just paint: the shading normal tips up at a ledge and down under a hang.
    {
        vec3 nw0 = normalize(vArkNormal);
        vec3 upOnFace = vec3(0.0, 1.0, 0.0) - nw0 * nw0.y;
        // And across the face: the ribs stand out, the gullies sink.
        vec3 acrossFace = normalize(cross(vec3(0.0, 1.0, 0.0), nw0) + vec3(1e-4));
        float ribSlope = arkFbm(vec2((faceAt.x + 0.6) * 0.16, faceAt.y * 0.035 + 5.0)) - arkFbm(vec2((faceAt.x - 0.6) * 0.16, faceAt.y * 0.035 + 5.0));
        arkBend += upOnFace * (0.6 * ledge - 0.35 * underhang) * steep * beds + acrossFace * ribSlope * 6.0 * steep * massif;
    }

    // Scree (batch 4): grey stone gathered at the foot of the faces, lighter than the rock it fell from.
    float scree = smoothstep(0.12, 0.55, vArkRock.x + (arkNoise(p * 0.9) - 0.5) * 0.3) * (1.0 - steep);
    vec3 screeTone = mix(rockTone, rockLight, 0.45 + 0.35 * arkNoise(p * 3.7)) * (0.82 + 0.3 * arkNoise(p * 11.0));
    ground = mix(ground, screeTone, scree * 0.9 * (1.0 - smoothstep(0.3, 0.7, snowW)));

    // Snow on the peaks and the ice, thinning on steep faces (less so up high), dimmer at night (batch 4: the moon's
    // light on snow read as a lamp).
    float snow = snowW * (1.0 - steep * 0.5 * (1.0 - high));
    float snowNight = mix(0.58, 1.0, smoothstep(0.2, 0.65, arkDaylight));
    ground = mix(ground, snowTone * snowNight * (0.9 + 0.08 * arkNoise(p * 0.7) + 0.04 * streak), smoothstep(0.12, 0.8, snow));
    arkSnowy = smoothstep(0.12, 0.8, snow);

    // The waterline: wet, darker sand just above the water.
    float waterline = 1.0 - smoothstep(0.0, 0.55, world.y);
    ground = mix(ground, wetSand * 0.82, waterline * smoothstep(-0.6, 0.0, world.y) * 0.75 * (1.0 - snowW));
    arkWet = max(arkWet, waterline * 0.8);

    // The photo textures (batch 1): each layer's texture divided by its mean, times the colour the ground had there,
    // so the zones keep their hue and the ground gains real detail; fading to the plain colour far away.
    if (groundReady > 0.5) {
        float dist = distance(cameraPosition, world);
        float fade = 1.0 - smoothstep(70.0, 260.0, dist);
        float forestW = vArkLayers2.x;
        float openW = vArkLayers2.y;
        float bankW = vArkLayers2.z;
        // Weights, in the order they cover each other.
        float wSand = smoothstep(0.15, 0.85, sandW) * (1.0 - snowW);
        float wWet = waterline * smoothstep(-0.6, 0.0, world.y) * (1.0 - snowW);
        float wForest = smoothstep(0.25, 0.7, forestW) * smoothstep(0.35, 0.65, arkFbm(p * 0.08 + 2.0) + 0.25) * (1.0 - wSand);
        float wSoil = openW * smoothstep(0.6, 0.78, arkFbm(p * 0.11 + 5.0)) * 0.85 * (1.0 - wSand);
        float wMud = max(mudW * wetPatch, bankW * smoothstep(0.35, 0.7, arkFbm(p * 0.3 + 1.0) + bankW * 0.4)) * (1.0 - wSand);
        float wFarm = farmW > 0.01 ? smoothstep(0.3, 0.98, farmW + (arkNoise(p * 0.11 + 3.0) - 0.5) * 0.4) : 0.0;
        float wRock = steep * step(0.3, world.y + 0.4);
        float wSnow = smoothstep(0.25, 0.75, snow);
        float rockMacro = 1.0;
        vec3 n = normalize(vArkNormal);
        // The ground's colour under the new layers: the forest floor browner, bare soil, dark wet banks.
        ground = mix(ground, ground * vec3(0.78, 0.66, 0.5) + vec3(0.03, 0.02, 0.0), wForest * 0.75);
        ground = mix(ground, soilTone * 1.05, wSoil * 0.55);
        ground = mix(ground, mudTone * 1.1, wMud * 0.6);
        arkWet = max(arkWet, wMud * 0.6);
        // Living grass, not khaki (graphics pass): richer green where nothing else covers the ground, drier on the rises.
        float grassy = (1.0 - wSand) * (1.0 - wWet) * (1.0 - wForest) * (1.0 - wSoil) * (1.0 - wMud) * (1.0 - wRock) * (1.0 - smoothstep(0.25, 0.75, snow)) * (1.0 - wFarm);
        float rise = smoothstep(0.45, 0.75, arkFbm(p * 0.05 + 7.0));
        ground = mix(ground, ground * mix(vec3(0.78, 1.08, 0.6), vec3(1.0, 0.98, 0.8), rise * 0.6) * 1.04, grassy * 0.7);
        vec3 tex = arkGroundTex(0.0, p, 0.34) / groundMeans[0];
        vec3 nor = groundLite > 0.5 ? vec3(0.0, 0.0, 1.0) : arkGroundNor(0.0, p, 0.34);
        vec3 col = tex;
        #define ARK_LAYER(L, W, S) if (W > 0.01) { vec3 t_ = arkGroundTex(L, p, S) / groundMeans[int(L)]; col = mix(col, t_, W); if (groundLite < 0.5) nor = normalize(mix(nor, arkGroundNor(L, p, S), W)); }
        ARK_LAYER(1.0, wForest, 0.4)
        ARK_LAYER(2.0, wSoil, 0.3)
        ARK_LAYER(6.0, wMud, 0.33)
        ARK_LAYER(3.0, wSand, 0.25)
        ARK_LAYER(4.0, wWet, 0.25)
        if (wFarm > 0.01) {
            // The tilled-soil texture where soil shows between the plants; little of it under pasture and cereal.
            col = mix(col, arkGroundTex(8.0, p, 0.3) / groundMeans[8], wFarm * mix(0.2, 0.8, arkFieldSoil));
        }
        if (wRock > 0.01) {
            // Two scales (batch 4): the 5 m detail only up close (from afar its repeats read as a fingerprint), and
            // under it a 27 m layer, greyed, that carries the rock's light and dark patches far out.
            vec3 r_ = vec3(1.0);
            float near_ = 1.0 - smoothstep(25.0, 90.0, dist);
            if (near_ > 0.01) r_ = mix(vec3(1.0), arkGroundTriplanar(5.0, world, n, 0.2) / groundMeans[5], near_);
            if (groundLite < 0.5) {
                vec3 m_ = arkGroundTriplanar(5.0, world + vec3(31.0, 7.0, 17.0), n, 0.037) / groundMeans[5];
                rockMacro = mix(1.0, dot(m_, vec3(0.3333)), 0.75 * (1.0 - near_ * 0.4) * wRock);
            }
            col = mix(col, r_, wRock);
            nor = normalize(mix(nor, vec3(0.0, 0.0, 1.0), wRock * 0.5));
        }
        if (scree > 0.01 && groundLite < 0.5) {
            vec3 s_ = arkGroundTriplanar(5.0, world * 2.3, n, 0.2) / groundMeans[5];
            col = mix(col, vec3(dot(s_, vec3(0.3333))), scree * 0.7);
        }
        ARK_LAYER(7.0, wSnow, 0.18)
        // Detail strength: full up close, gone far away; the plain colour (with the cloud shade) is under it.
        col = mix(vec3(1.0), col, fade);
        ground *= col;
        // The rock's far layer reaches past the detail's fade (to about 700 m: the whole island from its far view).
        ground *= mix(1.0, rockMacro, 1.0 - smoothstep(300.0, 700.0, dist));
        // A little of the textures' own colour, so grass looks like grass and not tinted paper.
        arkGroundDetailN = normalize(mix(vec3(0.0, 0.0, 1.0), nor, fade * 0.9));
    }
    // The swash (graphics pass): each wave runs up the beach as a thin wet film with a lace of foam at its edge, then
    // slides back, leaving the sand dark and shiny; bigger in wind. Only on sand by the sea.
    {
        float h = world.y - envSeaLevel;
        float beachy = smoothstep(0.2, 0.7, sandW) * (1.0 - snowW) * step(-0.08, h) * (1.0 - smoothstep(1.2, 1.6, h));
        if (beachy > 0.0) {
            float phase = arkTime * 0.42 + arkFbm(p * 0.04) * 6.2831;
            float run = 0.5 + 0.5 * sin(phase);
            float reach = (0.12 + 0.3 * run * run) * (0.8 + 0.8 * envWind);
            float film = smoothstep(reach + 0.02, reach - 0.06, h);
            // A soft, broken lace (not a dashed line): wider and fading where the noise is low.
            float lace = smoothstep(0.06, 0.0, abs(h - reach)) * smoothstep(0.3, 0.8, arkFbm(p * 1.4 + vec2(arkTime * 0.2, 0.0))) * 0.65;
            // The sand a wave just left: wet for a while above the film.
            float left = smoothstep(reach + 0.25, reach, h) * (1.0 - film);
            ground = mix(ground, ground * vec3(0.62, 0.66, 0.68), film * beachy * 0.85);
            ground *= mix(1.0, 0.8, left * beachy);
            ground = mix(ground, vec3(0.92, 0.94, 0.93), lace * beachy * 0.85);
            arkWet = max(arkWet, (film + left * 0.7) * beachy);
        }
    }
    // The sea bed (batch 4): under water the beach sand turns to coral sand and rubble (grey-brown fragments in
    // patches, a coarse grain), much darker than a dry beach, so what grows on the reef stands out from its floor.
    {
        float bedDepth = envSeaLevel - world.y;
        if (bedDepth > 0.02) {
            float bedW = smoothstep(0.02, 0.6, bedDepth) * smoothstep(0.1, 0.6, sandW);
            float rubble = smoothstep(0.48, 0.72, arkFbm(p * 0.32 + 3.0));
            float grain = arkNoise(p * 5.5);
            vec3 coralSand = ${linearVec3("#9c8e72")} * (0.84 + 0.3 * arkFbm(p * 1.3));
            vec3 rubbleTone = mix(${linearVec3("#7b7468")}, ${linearVec3("#8d766c")}, arkNoise(p * 0.7)) * (0.7 + 0.5 * grain);
            vec3 bedTone = mix(coralSand, rubbleTone, rubble * 0.85) * (0.9 + 0.2 * grain);
            // The ground's own colour there is the reef palette's pale sand: keep its texture detail, take the bed's tone.
            ground = mix(ground, ground * bedTone / ${linearVec3("#d8c7a6")}, bedW);
        }
    }
    // Rain-wet ground: darker and glossier (sand dries first).
    ground *= mix(1.0, 0.74, envWetness * (1.0 - 0.4 * sandW) * (1.0 - snowW));
    arkWet = max(arkWet, envWetness * 0.75 * (1.0 - snowW));
    diffuseColor.rgb = ground * arkCloudShade(world);
    // Under water (graphics pass): the light that reaches the bed is absorbed with depth, red first, so the sand turns
    // blue-green and darker the deeper it lies (never blown out white), with sand ripples on the bed.
    float depthBelow = envSeaLevel - world.y;
    if (depthBelow > 0.0) {
        vec3 absorb = exp(-depthBelow * vec3(0.45, 0.15, 0.1)) * mix(1.0, 0.8, smoothstep(0.0, 2.0, depthBelow));
        float bedRipple = sin(dot(p, vec2(0.6, 0.8)) * 5.5 + arkNoise(p * 0.7) * 4.0) * 0.5 + 0.5;
        diffuseColor.rgb *= absorb * (0.92 + 0.12 * bedRipple * (1.0 - smoothstep(-2.0, 0.0, -depthBelow + 2.0) * 0.0));
    }
    // The sun's caustics on the sea floor, fading with depth.
    if (world.y < envSeaLevel - 0.05 && arkCaustics > 0.0) {
        float under = smoothstep(0.05, 0.6, depthBelow) * (1.0 - smoothstep(4.0, 11.0, depthBelow));
        diffuseColor.rgb += vec3(0.6, 0.9, 0.85) * min(arkCausticAt(world.xz, arkTime), 1.5) * under * arkCaustics * 0.1 * exp(-depthBelow * 0.15);
    }
}`)
            .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
// Wet ground shines; a bed under the water does not (batch 4: the reef's sand mirrored the sun and read as snow).
roughnessFactor = mix(roughnessFactor, 0.32, arkWet * (1.0 - smoothstep(0.02, 0.3, envSeaLevel - vArkWorld.y)));`)
            .replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
if (groundReady > 0.5 && groundLite < 0.5) {
    // The layers' normal maps, in world space round the ground's own normal (u along +x, v along +z), then to view space.
    vec3 nw = normalize(vArkNormal);
    vec3 tw = normalize(vec3(1.0, 0.0, 0.0) - nw * nw.x);
    vec3 bw = cross(tw, nw);
    vec3 pw = normalize(tw * arkGroundDetailN.x + bw * arkGroundDetailN.y + nw * arkGroundDetailN.z);
    pw = normalize(pw + arkBend);
    normal = normalize((viewMatrix * vec4(pw, 0.0)).xyz);
}`)
            // Snow in shade is blue (batch 4): what lights it there is the sky, so its share of the light leans blue.
            .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
reflectedLight.indirectDiffuse *= mix(vec3(1.0), vec3(0.8, 0.94, 1.28), arkSnowy);`);
    };
    return material;
}

// MARK: - Water

const WATER_VERTEX = `
#include <common>
#include <fog_pars_vertex>
varying vec3 vWorld;
void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}
`;

const WATER_FRAGMENT = `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D depthMap;
uniform float halfSize;
uniform vec3 deep;
uniform vec3 open;
uniform vec3 shallow;
uniform vec3 reef;
uniform vec3 lake;
uniform vec3 skyHorizon;
uniform vec3 skyZenith;
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform vec3 foamColor;
uniform float daylight;
uniform float seaLevel;
uniform float windStrength;
varying vec3 vWorld;
${NOISE_GLSL}
${CLOUD_GLSL}

// Gentle swell: a few travelling waves; returns the slope (dh/dx, dh/dz).
vec2 waves(vec2 p, float t, float calm) {
    vec2 slope = vec2(0.0);
    vec2 dirs[4];
    dirs[0] = normalize(vec2(1.0, 0.35));
    dirs[1] = normalize(vec2(-0.4, 1.0));
    dirs[2] = normalize(vec2(0.75, -0.65));
    dirs[3] = normalize(vec2(-0.9, -0.2));
    float freqs[4];
    freqs[0] = 0.42; freqs[1] = 0.67; freqs[2] = 1.13; freqs[3] = 1.71;
    for (int i = 0; i < 4; i++) {
        float f = freqs[i];
        float a = 0.05 / (1.0 + float(i)) * calm;
        float phase = dot(dirs[i], p) * f + t * sqrt(9.8 * f) * 0.55;
        slope += dirs[i] * cos(phase) * a * f;
    }
    // Small ripples from noise.
    float e = 0.35;
    float n0 = arkNoise(p * 1.6 + t * 0.4);
    slope += vec2(arkNoise(p * 1.6 + vec2(e, 0.0) + t * 0.4) - n0, arkNoise(p * 1.6 + vec2(0.0, e) + t * 0.4) - n0) * 0.18 * calm;
    return slope;
}

void main() {
    vec2 uv = (vWorld.xz + halfSize) / (2.0 * halfSize);
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    vec4 atFull = texture2D(depthMap, clamp(uv, 0.0, 1.0));
    vec3 at = atFull.rgb;
    // The river flows (graphics pass): ripples carried downstream, streaks of foam over the shallows and stones.
    float flowing = smoothstep(0.42, 0.5, atFull.a) * inside;
    vec2 flowDir = vec2(cos((atFull.a - 0.5) * 6.2831853), sin((atFull.a - 0.5) * 6.2831853));
    float depth = mix(10.0, at.r * 12.0, inside) + seaLevel;
    float reefy = at.g * inside;
    float fresh = at.b * inside;
    float distanceToEye = distance(cameraPosition, vWorld);

    // Fresh water is calmer; far away the waves fade before they shimmer.
    float calm = mix(1.0, 0.35, fresh) * (1.0 - smoothstep(60.0, 260.0, distanceToEye) * 0.85) * windStrength;
    vec2 slope = waves(vWorld.xz - flowDir * arkTime * 1.4 * flowing, arkTime, calm + flowing * 0.8);
    vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec3 view = normalize(cameraPosition - vWorld);

    // Colour through the water: shallow turquoise to deep blue, the reef's own, the lake's green.
    vec3 body = mix(shallow, open, smoothstep(0.2, 3.5, depth));
    body = mix(body, deep, smoothstep(4.0, 11.0, depth));
    body = mix(body, reef, reefy * (1.0 - smoothstep(2.0, 6.5, depth)) * 0.9);
    body = mix(body, lake * mix(1.0, 0.8, smoothstep(0.5, 3.0, depth)), fresh);
    body *= arkCloudShade(vWorld) * mix(0.1, 1.0, daylight * daylight);

    // The sky in it (Fresnel), and the low sun's glint.
    float facing = max(dot(n, view), 0.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);
    vec3 r = reflect(-view, n);
    vec3 skyColour = mix(skyHorizon, skyZenith, pow(clamp(r.y, 0.0, 1.0), 0.35));
    vec3 colour = mix(body, skyColour, clamp(fresnel * 1.1, 0.0, 0.72));
    float glint = pow(max(dot(r, sunDirection), 0.0), 220.0);
    // A tight glint and a broader sheen, broken by the ripples.
    float sheen = pow(max(dot(r, sunDirection), 0.0), 28.0) * 0.12;
    colour += sunColor * (glint * 2.6 + sheen) * arkCloudShade(vWorld);

    // Foam: lines that run up the shore and fade, broken by noise; a lacy edge where water meets land.
    float shore = 1.0 - smoothstep(0.0, 1.5, depth);
    float lines = smoothstep(0.6, 1.0, sin(depth * 7.0 - arkTime * 1.4 + arkNoise(vWorld.xz * 0.5) * 3.0));
    float lace = smoothstep(0.35, 0.75, arkNoise(vWorld.xz * 1.8 + arkTime * 0.3));
    float foam = shore * (lines * 0.55 + (1.0 - smoothstep(0.0, 0.18, depth)) * 0.9) * mix(0.55, 1.0, lace) * inside * (1.0 - fresh * 0.75);
    if (flowing > 0.01) {
        vec2 q = vec2(dot(vWorld.xz, flowDir), dot(vWorld.xz, vec2(-flowDir.y, flowDir.x)));
        float streak = smoothstep(0.62, 0.9, arkNoise(vec2(q.x * 0.35 - arkTime * 1.6, q.y * 2.6))) * smoothstep(0.7, 0.2, depth);
        float rapids = smoothstep(0.55, 0.85, arkNoise(vWorld.xz * 1.3 - flowDir * arkTime * 2.0)) * smoothstep(0.55, 0.15, depth);
        foam = max(foam, (streak * 0.55 + rapids * 0.7) * flowing);
    }
    colour = mix(colour, foamColor * mix(0.2, 1.0, daylight), clamp(foam, 0.0, 0.9));

    // Clear in the shallows, so what lives there shows through; opaque where it's deep.
    float alpha = mix(0.2, 1.0, smoothstep(0.1, 5.5, depth));
    alpha = max(alpha, max(fresnel, foam));
    alpha = max(alpha, fresh * 0.82);
    // Seen from under the water (graphics pass): the bright Snell's window overhead, rippling, and outside it the
    // surface mirrors the dim blue-green below (total internal reflection). Opaque, never a hole to the sky.
    if (cameraPosition.y < seaLevel - 0.02) {
        vec3 up = normalize(vec3(-slope.x * 2.5, -1.0, -slope.y * 2.5));
        float straight = max(dot(-view, -up), 0.0);
        float window = smoothstep(0.62, 0.8, straight);
        vec3 below = mix(vec3(0.04, 0.2, 0.24), vec3(0.08, 0.3, 0.32), daylight) * mix(0.35, 1.0, daylight);
        vec3 through = mix(skyHorizon, skyZenith, 0.4) * (0.9 + 0.6 * pow(max(dot(-view, sunDirection), 0.0), 40.0)) * mix(0.25, 1.1, daylight);
        colour = mix(below, through, window);
        alpha = 1.0;
    }
    gl_FragColor = vec4(colour, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
}
`;

function waterMesh(depth: DataTexture): {mesh: Mesh; material: ShaderMaterial} {
    const material = new ShaderMaterial({
        vertexShader: WATER_VERTEX,
        fragmentShader: WATER_FRAGMENT,
        uniforms: UniformsUtils.merge([
            UniformsLib.fog,
            {
                depthMap: {value: null},
                halfSize: {value: TERRAIN_HALF},
                deep: {value: srgb(WATER.deep)},
                open: {value: srgb(WATER.open)},
                shallow: {value: srgb(WATER.shallow)},
                reef: {value: srgb(WATER.reef)},
                lake: {value: srgb(WATER.lake)},
                skyHorizon: {value: srgb("#e3d4bf")},
                skyZenith: {value: srgb("#7fa2c0")},
                sunDirection: {value: null},
                sunColor: {value: srgb("#fff0d6")},
                foamColor: {value: srgb("#f4f1ea")},
                arkTime: {value: 0},
                arkWind: {value: null},
                daylight: {value: 1},
                seaLevel: {value: 0},
                windStrength: {value: 1}
            }
        ]),
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        fog: true
    });
    material.uniforms.depthMap.value = depth;
    // Shared, live values.
    material.uniforms.arkTime = ARK_TIME;
    material.uniforms.arkWind = ARK_WIND;
    material.uniforms.sunDirection = ARK_SUN;
    // The hour's light (`daylight.ts`): the sky it reflects, the glint (the moon's at night), how lit the water is.
    material.uniforms.skyHorizon = ARK_SKY_HORIZON;
    material.uniforms.skyZenith = ARK_SKY_ZENITH;
    material.uniforms.sunColor = ARK_GLINT;
    material.uniforms.daylight = ARK_DAYLIGHT;
    material.uniforms.seaLevel = ARK_ENV.seaLevel;
    material.uniforms.windStrength = WATER_WIND;
    const geometry = new PlaneGeometry(4000, 4000, 1, 1);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 2;
    return {mesh, material};
}

// MARK: - The landscape

export type Landscape = {
    ground: Mesh;
    water: Mesh;
    dispose: () => void;
};

export function buildLandscape(): Landscape {
    const {geometry, depth} = groundGeometry();
    const material = groundMaterial();
    const ground = new Mesh(geometry, material);
    ground.receiveShadow = true;
    ground.castShadow = true;
    const water = waterMesh(depth);
    return {
        ground,
        water: water.mesh,
        dispose: () => {
            geometry.dispose();
            material.dispose();
            depth.dispose();
            water.mesh.geometry.dispose();
            water.material.dispose();
        }
    };
}
