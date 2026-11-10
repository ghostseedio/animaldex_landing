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
    type BufferGeometry
} from "three";
import {ARK_DAYLIGHT, ARK_GLINT, ARK_SKY_HORIZON, ARK_SKY_ZENITH, ARK_SUN, ARK_TIME, ARK_WIND, CLOUD_GLSL, NOISE_GLSL} from "@/ark-scene/glsl";
import {FIELD_TONES, ROCK, SNOW, WATER, WET_SAND, ZONE_PALETTES} from "@/ark-scene/palettes";
import {fbm, LAKE, noise, sampleGround, smoothstep, TERRAIN_HALF} from "@/ark-scene/world";

const SEGMENTS = 200;

function srgb(hex: string): Color {
    return new Color(hex);
}

// MARK: - Ground

function groundGeometry(): {geometry: BufferGeometry; depth: DataTexture} {
    const geometry = new PlaneGeometry(TERRAIN_HALF * 2, TERRAIN_HALF * 2, SEGMENTS, SEGMENTS);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.getAttribute("position") as BufferAttribute;
    const count = position.count;
    const size = SEGMENTS + 1;
    const colors = new Float32Array(count * 3);
    const layers = new Float32Array(count * 4);
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
        const snow = Math.max(polar * smoothstep(0.3, 1, sample.land), smoothstep(16, 25, sample.height + 3 * (noise(x * 0.3, z * 0.3) - 0.5)));
        layers[i * 4] = sandLayer;
        layers[i * 4 + 1] = mud;
        layers[i * 4 + 2] = farmland;
        layers[i * 4 + 3] = snow;

        const at = i * 4;
        const depth = Math.max(-sample.height, 0);
        depthPixels[at] = Math.min(255, Math.round(depth / 12 * 255));
        depthPixels[at + 1] = Math.round(sample.reef * 255);
        const fresh = smoothstep(LAKE.r + 4, LAKE.r, Math.hypot(x - LAKE.x, z - LAKE.z)) + (sample.river < 5 && sample.inland > 4 ? 1 : 0);
        depthPixels[at + 2] = Math.round(Math.min(fresh, 1) * 255);
        depthPixels[at + 3] = 255;
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
    geometry.computeVertexNormals();
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.setAttribute("arkLayers", new BufferAttribute(layers, 4));

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
        arkCaustics: ARK_CAUSTICS
    };
    material.customProgramCacheKey = () => "ark-ground";
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
attribute vec4 arkLayers;
varying vec4 vArkLayers;
varying vec3 vArkWorld;
varying vec3 vArkNormal;`)
            .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
vArkWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vArkNormal = normalize(mat3(modelMatrix) * objectNormal);
vArkLayers = arkLayers;`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
varying vec4 vArkLayers;
varying vec3 vArkWorld;
varying vec3 vArkNormal;
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
float arkWet = 0.0;`)
            .replace("#include <color_fragment>", `#include <color_fragment>
{
    vec3 world = vArkWorld;
    vec2 p = world.xz;
    float near = 1.0 - smoothstep(40.0, 160.0, distance(cameraPosition, world));
    float sandW = vArkLayers.x;
    float mudW = vArkLayers.y;
    float farmW = vArkLayers.z;
    float snowW = vArkLayers.w;
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

    // Home: fields a few metres across, turned off the grid, tilled rows, hedgerows between.
    if (farmW > 0.01) {
        vec2 f = vec2(dot(p, vec2(0.94, 0.34)) / 9.0, dot(p, vec2(-0.34, 0.94)) / 6.5);
        f.x += floor(f.y) * 0.37;
        vec2 cell = floor(f);
        int pick = int(floor(arkHash(cell * 1.31 + 7.0) * ${FIELD_TONES.length}.0));
        vec3 field = fieldTones[0];
        for (int k = 1; k < ${FIELD_TONES.length}; k++) { if (k == pick) field = fieldTones[k]; }
        bool tilled = arkHash(cell + 3.7) > 0.72;
        if (tilled) field = soilTone * (0.85 + 0.25 * (0.5 + 0.5 * sin(f.x * 6.2831 * 9.0)));
        // Crop rows across each field, and the patchiness of real growth.
        field *= 1.0 + 0.1 * sin(f.x * 6.2831 * 11.0) * near;
        field *= 0.88 + 0.2 * arkFbm(p * 0.7) + 0.08 * (arkNoise(p * 5.0) - 0.5) * near;
        float farm = smoothstep(0.3, 0.98, farmW + (arkNoise(p * 0.11 + 3.0) - 0.5) * 0.4);
        vec2 edge = abs(fract(f) - 0.5);
        float hedge = smoothstep(0.468, 0.492, max(edge.x, edge.y)) * smoothstep(0.45, 0.95, farm);
        field = mix(field, hedgeTone * (0.75 + 0.5 * arkNoise(p * 3.0)), hedge * (0.6 + 0.4 * arkNoise(p * 1.1)));
        ground = mix(ground, field, farm * 0.94);
    }

    // Rock wherever it is steep, banded like strata, lighter on the edges.
    float slope = 1.0 - clamp(vArkNormal.y, 0.0, 1.0);
    float steep = smoothstep(0.22, 0.42, slope + (arkNoise(p * 0.5) - 0.5) * 0.12);
    float strata = 0.5 + 0.5 * sin(world.y * 1.1 + arkFbm(p * 0.15) * 6.0);
    vec3 rock = mix(rockTone, rockLight, strata * 0.12 + 0.45 * arkFbm(p * 0.9) + 0.15 * arkNoise(p * 4.0));
    ground = mix(ground, rock, steep * step(0.3, world.y + 0.4));

    // Snow on the peaks and the ice, thinning on steep faces.
    float snow = snowW * (1.0 - steep * 0.75);
    ground = mix(ground, snowTone * (0.94 + 0.06 * arkNoise(p * 0.7)), smoothstep(0.25, 0.75, snow));

    // The waterline: wet, darker sand just above the water.
    float waterline = 1.0 - smoothstep(0.0, 0.55, world.y);
    ground = mix(ground, wetSand * 0.82, waterline * smoothstep(-0.6, 0.0, world.y) * 0.75 * (1.0 - snowW));
    arkWet = max(arkWet, waterline * 0.8);

    diffuseColor.rgb = ground * arkCloudShade(world);
    // The sun's caustics on the sea floor, fading with depth.
    if (world.y < -0.05 && arkCaustics > 0.0) {
        float under = smoothstep(-0.05, -0.6, world.y) * (1.0 - smoothstep(-4.0, -11.0, world.y));
        diffuseColor.rgb += vec3(0.75, 0.95, 0.9) * min(arkCausticAt(world.xz, arkTime), 1.5) * under * arkCaustics * 0.12;
    }
}`)
            .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.32, arkWet);`);
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
    vec3 at = texture2D(depthMap, clamp(uv, 0.0, 1.0)).rgb;
    float depth = mix(10.0, at.r * 12.0, inside);
    float reefy = at.g * inside;
    float fresh = at.b * inside;
    float distanceToEye = distance(cameraPosition, vWorld);

    // Fresh water is calmer; far away the waves fade before they shimmer.
    float calm = mix(1.0, 0.35, fresh) * (1.0 - smoothstep(60.0, 260.0, distanceToEye) * 0.85);
    vec2 slope = waves(vWorld.xz, arkTime, calm);
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
    vec3 skyColour = mix(skyHorizon, skyZenith, pow(clamp(r.y, 0.0, 1.0), 0.6));
    vec3 colour = mix(body, skyColour, clamp(fresnel * 1.15, 0.0, 0.85));
    float glint = pow(max(dot(r, sunDirection), 0.0), 220.0);
    colour += sunColor * glint * 2.2 * arkCloudShade(vWorld);

    // Foam: lines that run up the shore and fade, broken by noise; a lacy edge where water meets land.
    float shore = 1.0 - smoothstep(0.0, 1.1, depth);
    float lines = smoothstep(0.65, 1.0, sin(depth * 9.0 - arkTime * 1.4 + arkNoise(vWorld.xz * 0.5) * 3.0));
    float lace = smoothstep(0.35, 0.75, arkNoise(vWorld.xz * 1.8 + arkTime * 0.3));
    float foam = shore * (lines * 0.55 + (1.0 - smoothstep(0.0, 0.18, depth)) * 0.9) * mix(0.55, 1.0, lace) * inside * (1.0 - fresh * 0.75);
    colour = mix(colour, foamColor * mix(0.2, 1.0, daylight), clamp(foam, 0.0, 0.9));

    // Clear in the shallows, so what lives there shows through; opaque where it's deep.
    float alpha = mix(0.32, 1.0, smoothstep(0.1, 5.0, depth));
    alpha = max(alpha, max(fresnel, foam));
    alpha = max(alpha, fresh * 0.82);
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
                daylight: {value: 1}
            }
        ]),
        transparent: true,
        depthWrite: false,
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
