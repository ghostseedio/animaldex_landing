/**
 * The town island's water (docs/ark/town-island.md): the sea round it and in the harbour (tidal: it rides on the
 * scene's sea level), and the still fresh water of the canal, the millpond and the farm pond (held by the lock).
 * One small shader for both: depth-tinted colour (turquoise shallows to deep blue offshore; green-brown fresh water),
 * waves from shared-clock noise, the sky by Fresnel, the sun's (or the moon's) glint, foam at the shore. It reads the
 * same light uniforms as the wild island's water (`glsl.ts`), so both islands sit under one sky.
 */

import {DataTexture, DoubleSide, LinearFilter, Mesh, PlaneGeometry, RGBAFormat, ShaderMaterial, UniformsLib, UniformsUtils, type BufferGeometry} from "three";
import {ARK_DAYLIGHT, ARK_ENV, ARK_GLINT, ARK_SKY_HORIZON, ARK_SKY_ZENITH, ARK_SUN, ARK_TIME} from "@/ark-scene/glsl";
import {TOWN_HALF} from "@/ark-scene/islands/town/plan";

const VERTEX = `
#include <fog_pars_vertex>
uniform float seaLevel;
uniform float fresh;
varying vec3 vWorld;
void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    if (fresh < 0.5) world.y += seaLevel;
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;

const FRAGMENT = `
#include <fog_pars_fragment>
uniform float arkTime;
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform vec3 skyHorizon;
uniform vec3 skyZenith;
uniform float daylight;
uniform sampler2D depthMap;
uniform float halfSize;
uniform float fresh;
uniform float seaLevel;
varying vec3 vWorld;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float waves(vec2 p, float t) {
    float a = vnoise(p * 0.35 + vec2(t * 0.06, t * 0.045));
    float b = vnoise(p * 0.9 - vec2(t * 0.11, -t * 0.07));
    float c = vnoise(p * 2.3 + vec2(-t * 0.19, t * 0.16));
    return a * 0.55 + b * 0.3 + c * 0.15;
}
void main() {
    vec2 uv = (vWorld.xz + halfSize) / (2.0 * halfSize);
    float depth = fresh > 0.5 ? 1.4 : texture2D(depthMap, uv).r * 16.0 + seaLevel;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) depth = 18.0;
    float scale = fresh > 0.5 ? 0.35 : 1.0;
    // Far off the ripples are smaller than a pixel: they fade before they alias (as the wild sea's do), and the sun's
    // glint rolls off under white. Unfaded, a pond or the harbour seen from a whole view toward the sun was a patch of
    // white noise that crawled every frame.
    float far = smoothstep(60.0, 260.0, distance(cameraPosition, vWorld));
    scale *= 1.0 - 0.85 * far;
    float e = 0.35;
    float w0 = waves(vWorld.xz, arkTime);
    float wx = waves(vWorld.xz + vec2(e, 0.0), arkTime);
    float wz = waves(vWorld.xz + vec2(0.0, e), arkTime);
    vec3 n = normalize(vec3((w0 - wx) * 2.2 * scale, 1.0, (w0 - wz) * 2.2 * scale));
    vec3 view = normalize(cameraPosition - vWorld);
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(view, n), 0.0), 5.0);
    vec3 sky = mix(skyHorizon, skyZenith, clamp(reflect(-view, n).y * 1.6, 0.0, 1.0));
    vec3 shallow = fresh > 0.5 ? vec3(0.17, 0.26, 0.2) : vec3(0.16, 0.52, 0.52);
    vec3 deep = fresh > 0.5 ? vec3(0.07, 0.12, 0.1) : vec3(0.03, 0.17, 0.3);
    float d = smoothstep(0.0, fresh > 0.5 ? 2.5 : 9.0, depth);
    vec3 body = mix(shallow, deep, d) * (0.35 + 0.65 * daylight);
    vec3 colour = mix(body, sky, fresnel * 0.85);
    vec3 r = reflect(-sunDirection, n);
    float glint = pow(max(dot(r, view), 0.0), 220.0) * 3.0 + pow(max(dot(r, view), 0.0), 24.0) * 0.12;
    float sunCeiling = mix(30.0, 0.8, far);
    glint = sunCeiling * (1.0 - exp(-glint / sunCeiling));
    colour += sunColor * glint * (fresh > 0.5 ? 0.6 : 1.0);
    // Foam at the shore and on the harbour wall's foot.
    float foam = fresh > 0.5 ? 0.0 : (1.0 - smoothstep(0.0, 0.55, depth)) * smoothstep(0.35, 0.75, vnoise(vWorld.xz * 1.4 + arkTime * 0.2));
    colour = mix(colour, vec3(0.92, 0.95, 0.95) * (0.4 + 0.6 * daylight), foam * 0.75);
    float alpha = fresh > 0.5 ? 0.92 : mix(0.45, 1.0, smoothstep(0.0, 6.0, depth));
    gl_FragColor = vec4(colour, max(alpha, fresnel));
    #include <colorspace_fragment>
    #include <fog_fragment>
}`;

export type TownWater = {sea: Mesh; fresh: Mesh | null; dispose: () => void};

/** The sea's depth map: metres of water under the sea's mean level, from the ground's heights (R = depth / 16). */
export function seaDepthMap(heights: Float32Array, size: number): DataTexture {
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
        const depth = Math.min(Math.max(-heights[i], 0), 16);
        data[i * 4] = Math.round((depth / 16) * 255);
        data[i * 4 + 3] = 255;
    }
    const texture = new DataTexture(data, size, size, RGBAFormat);
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

function waterMaterial(depth: DataTexture, fresh: boolean): ShaderMaterial {
    const material = new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: UniformsUtils.merge([
            UniformsLib.fog,
            {depthMap: {value: null}, halfSize: {value: TOWN_HALF}, fresh: {value: fresh ? 1 : 0}, seaLevel: {value: 0}, arkTime: {value: 0}, sunDirection: {value: null}, sunColor: {value: null}, skyHorizon: {value: null}, skyZenith: {value: null}, daylight: {value: 1}}
        ]),
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        fog: true
    });
    material.uniforms.depthMap.value = depth;
    material.uniforms.arkTime = ARK_TIME;
    material.uniforms.sunDirection = ARK_SUN;
    material.uniforms.sunColor = ARK_GLINT;
    material.uniforms.skyHorizon = ARK_SKY_HORIZON;
    material.uniforms.skyZenith = ARK_SKY_ZENITH;
    material.uniforms.daylight = ARK_DAYLIGHT;
    if (!fresh) material.uniforms.seaLevel = ARK_ENV.seaLevel;
    return material;
}

/** The sea (a plane far past the island, so the horizon is water) and the fresh water's surfaces (one mesh). */
export function buildTownWater(depth: DataTexture, freshGeometry: BufferGeometry | null): TownWater {
    const seaMaterial = waterMaterial(depth, false);
    const seaGeometry = new PlaneGeometry(6000, 6000, 1, 1);
    seaGeometry.rotateX(-Math.PI / 2);
    const sea = new Mesh(seaGeometry, seaMaterial);
    sea.name = "town:sea";
    sea.renderOrder = 2;
    sea.frustumCulled = false;
    let fresh: Mesh | null = null;
    let freshMaterial: ShaderMaterial | null = null;
    if (freshGeometry) {
        freshMaterial = waterMaterial(depth, true);
        fresh = new Mesh(freshGeometry, freshMaterial);
        fresh.name = "town:fresh-water";
        fresh.renderOrder = 2;
    }
    return {
        sea,
        fresh,
        dispose: () => {
            seaGeometry.dispose();
            seaMaterial.dispose();
            freshGeometry?.dispose();
            freshMaterial?.dispose();
        }
    };
}
