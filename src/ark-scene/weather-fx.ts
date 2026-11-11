/**
 * The weather you can see (liveliness wiring), from the shared clock's
 * weather (`ark-clock.ts` `weatherAt`, or a pinned environment):
 *
 * - rain: streaks round the camera, slanted by the wind, a few pixels wide
 *   whatever the screen (so they read on a phone), more of them the harder
 *   it rains; rings where the drops hit the water near what the camera
 *   looks at;
 * - fog and rain haze: the scene's fog drawn in closer and greyer;
 * - lightning in a storm: a flash of the whole picture (`lightningAt`);
 * - wind: leaves and bits blown past near the camera when it is strong.
 *
 * Every particle moves in its shader from the shared clock (`ARK_TIME`) in a
 * box that follows the camera: nothing is updated per drop on the CPU, and
 * where a drop is is a pure function of the time and its seed. One draw call
 * each; at the low tier fewer drops, no leaves; with reduced motion no
 * streaks (the haze stays). Visual only.
 */

import {
    Color,
    DoubleSide,
    Group,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    Mesh,
    PlaneGeometry,
    ShaderMaterial,
    Vector2,
    Vector3,
    type Fog,
    type PerspectiveCamera,
    type WebGLRenderer
} from "three";
import {ARK_DAYLIGHT, ARK_TIME} from "@/ark-scene/glsl";
import {keepFrameAlpha} from "@/ark-scene/traces";
import type {QualityTier} from "@/ark-scene/post";

/** What the effects read each frame (the clock's weather, or the pinned environment). */
export type WeatherFxInput = {
    rain: number;
    wind: number;
    windDirection: number;
    fog: number;
    storm: number;
    /** 0–1 this frame's lightning (`lightningAt`). */
    lightning: number;
    seaLevel: number;
    underwater: boolean;
};

const TIER_DROPS: Record<QualityTier, number> = {high: 8000, medium: 4800, low: 2600};
const TIER_RINGS: Record<QualityTier, number> = {high: 420, medium: 260, low: 140};
const TIER_LEAVES: Record<QualityTier, number> = {high: 220, medium: 140, low: 0};

/** The rain's box round the camera (m): wide and deep, as tall as it is wide. */
const RAIN_BOX = new Vector3(34, 26, 34);
const RING_BOX = 46;
const LEAF_BOX = new Vector3(30, 12, 30);

function seeds(count: number, salt: number): Float32Array {
    // A fixed sequence (no Math.random): every viewer's drop n starts in the same place.
    const out = new Float32Array(count * 4);
    let h = 2166136261 ^ salt;
    const next = () => {
        h ^= h << 13;
        h ^= h >>> 17;
        h ^= h << 5;
        return ((h >>> 0) % 1000003) / 1000003;
    };
    for (let i = 0; i < out.length; i++) out[i] = next();
    return out;
}

const RAIN_VERTEX = `
attribute vec4 drop;
uniform float arkTime;
uniform vec3 box;
uniform vec3 centre;
uniform vec2 wind;
uniform float fall;
uniform float streak;
uniform float amount;
uniform vec2 resolution;
uniform float pixelWidth;
varying float vAlpha;
varying float vAlong;
void main() {
    // Thin the rain: a drop shows only while its seed is under the amount.
    float shown = step(drop.w, amount);
    vec3 v = vec3(wind.x, -fall * (0.85 + 0.3 * drop.w), wind.y);
    vec3 p = drop.xyz * box + v * arkTime;
    // Wrapped into the box round the camera: an endless rain that follows it.
    vec3 local = mod(p - centre + box * 0.5, box) - box * 0.5;
    vec3 head = centre + local;
    vec3 tail = head - normalize(v) * streak * (0.7 + 0.6 * drop.w);
    vec4 a = projectionMatrix * viewMatrix * vec4(head, 1.0);
    vec4 b = projectionMatrix * viewMatrix * vec4(tail, 1.0);
    vec4 here = mix(a, b, position.y);
    vec2 dir = normalize((b.xy / max(b.w, 0.001) - a.xy / max(a.w, 0.001)) * resolution + vec2(1e-5, 0.0));
    // pixelWidth device pixels across, whatever the distance (NDC spans 2 for the whole buffer).
    vec2 side = vec2(-dir.y, dir.x) * 2.0 * pixelWidth / resolution * here.w;
    here.xy += side * position.x;
    gl_Position = here;
    float d = length(local);
    // Faint right at the lens and toward the box's edge, so the box never shows.
    vAlpha = shown * smoothstep(0.6, 2.2, d) * (1.0 - smoothstep(box.x * 0.32, box.x * 0.5, length(local.xz))) * (1.0 - smoothstep(box.y * 0.3, box.y * 0.5, abs(local.y)));
    vAlong = position.y;
}`;

const RAIN_FRAGMENT = `
uniform vec3 tint;
uniform float opacity;
uniform float daylight;
varying float vAlpha;
varying float vAlong;
void main() {
    float a = vAlpha * opacity * (1.0 - vAlong * 0.75);
    if (a < 0.004) discard;
    gl_FragColor = vec4(tint * mix(0.3, 1.0, daylight), a);
    #include <colorspace_fragment>
}`;

const RING_VERTEX = `
attribute vec4 drop;
uniform float arkTime;
uniform vec2 centre;
uniform float boxSize;
uniform float seaLevel;
uniform float amount;
varying vec2 vUv;
varying float vAge;
varying float vShown;
void main() {
    // Each ring repeats on its own beat; where it lands moves with each beat (a pure function of the time).
    float period = 0.55 + drop.z * 0.6;
    float beat = floor(arkTime / period + drop.w * 7.0);
    float age = fract(arkTime / period + drop.w * 7.0);
    vec2 jitter = fract(vec2(sin(beat * 12.9898 + drop.x * 78.233), sin(beat * 39.346 + drop.y * 11.135)) * 43758.5453);
    vec2 p = (fract(drop.xy + jitter * 0.37) - 0.5) * boxSize;
    vec2 world = centre + mod(p - centre + boxSize * 0.5, boxSize) - boxSize * 0.5;
    float size = 0.16 + 0.22 * drop.z;
    vec3 at = vec3(world.x + position.x * size, seaLevel + 0.012, world.y + position.y * size);
    gl_Position = projectionMatrix * viewMatrix * vec4(at, 1.0);
    vUv = position.xy;
    vAge = age;
    vShown = step(drop.w, amount) * (1.0 - smoothstep(boxSize * 0.3, boxSize * 0.5, length(world - centre)));
}`;

const RING_FRAGMENT = `
uniform float daylight;
uniform float opacity;
varying vec2 vUv;
varying float vAge;
varying float vShown;
void main() {
    float r = length(vUv) * 2.0;
    float edge = vAge;
    float ring = (1.0 - smoothstep(0.0, 0.16, abs(r - edge))) * (1.0 - vAge) * (1.0 - vAge);
    float a = ring * vShown * opacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vec3(0.86, 0.92, 0.96) * mix(0.35, 1.0, daylight), a);
    #include <colorspace_fragment>
}`;

const LEAF_VERTEX = `
attribute vec4 drop;
uniform float arkTime;
uniform vec3 box;
uniform vec3 centre;
uniform vec2 wind;
uniform float amount;
varying float vAlpha;
varying vec3 vTint;
varying vec2 vUv;
void main() {
    vec3 v = vec3(wind.x, 0.0, wind.y) * (0.7 + 0.6 * drop.w);
    float t = arkTime + drop.w * 40.0;
    // Gusting along, fluttering up and down.
    vec3 p = drop.xyz * box + v * t + vec3(sin(t * 1.7 + drop.x * 9.0), sin(t * 2.3 + drop.y * 7.0) * 0.6, cos(t * 1.3 + drop.z * 5.0)) * 0.6;
    vec3 local = mod(p - centre + box * 0.5, box) - box * 0.5;
    local.y = local.y * 0.5 + box.y * 0.1;
    vec3 world = centre + local;
    float spin = t * (2.0 + drop.w * 4.0);
    vec2 q = position.xy * (0.05 + drop.z * 0.05);
    q = vec2(q.x * cos(spin) - q.y * sin(spin), (q.x * sin(spin) + q.y * cos(spin)) * abs(cos(spin * 0.7)));
    vec4 view = viewMatrix * vec4(world, 1.0);
    view.xy += q;
    gl_Position = projectionMatrix * view;
    vAlpha = step(drop.w, amount) * (1.0 - smoothstep(box.x * 0.32, box.x * 0.5, length(local.xz))) * smoothstep(1.0, 3.0, -view.z);
    vTint = mix(vec3(0.33, 0.42, 0.18), vec3(0.55, 0.38, 0.17), drop.y);
    vUv = position.xy;
}`;

const LEAF_FRAGMENT = `
uniform float daylight;
varying float vAlpha;
varying vec3 vTint;
varying vec2 vUv;
void main() {
    float leaf = 1.0 - smoothstep(0.35, 0.5, length(vUv * vec2(1.0, 1.8)));
    float a = leaf * vAlpha;
    if (a < 0.05) discard;
    gl_FragColor = vec4(vTint * mix(0.3, 1.0, daylight), a);
    #include <colorspace_fragment>
}`;

function instanced(base: PlaneGeometry | InstancedBufferGeometry, count: number, salt: number): InstancedBufferGeometry {
    const geometry = new InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.setAttribute("position", base.getAttribute("position"));
    geometry.setAttribute("drop", new InstancedBufferAttribute(seeds(count, salt), 4));
    geometry.instanceCount = count;
    return geometry;
}

export class WeatherFx {
    readonly root = new Group();
    private readonly rain: Mesh;
    private readonly rings: Mesh;
    private readonly leaves: Mesh;
    private readonly rainMaterial: ShaderMaterial;
    private readonly ringMaterial: ShaderMaterial;
    private readonly leafMaterial: ShaderMaterial;
    private readonly fogNear: number;
    private readonly fogFar: number;
    private readonly baseExposure: number;
    private tier: QualityTier;
    private lite = false;
    private reducedMotion = false;
    private readonly grey = new Color("#8f969c");
    private readonly fogColour = new Color();
    /** This frame's rain, haze and flash (for stats and tests). */
    readonly now = {rain: 0, haze: 0, flash: 0, drops: 0};

    constructor(tier: QualityTier, fog: Fog, renderer: WebGLRenderer) {
        this.tier = tier;
        this.fogNear = fog.near;
        this.fogFar = fog.far;
        this.baseExposure = renderer.toneMappingExposure;
        // A streak: a quad from its head (y 0) to its tail (y 1), widened across in pixels.
        const streak = new PlaneGeometry(1, 1);
        streak.translate(0, 0.5, 0);
        this.rainMaterial = keepFrameAlpha(new ShaderMaterial({
            vertexShader: RAIN_VERTEX,
            fragmentShader: RAIN_FRAGMENT,
            uniforms: {
                arkTime: ARK_TIME,
                daylight: ARK_DAYLIGHT,
                box: {value: RAIN_BOX.clone()},
                centre: {value: new Vector3()},
                wind: {value: new Vector2()},
                fall: {value: 9},
                streak: {value: 0.55},
                amount: {value: 0},
                resolution: {value: new Vector2(800, 600)},
                pixelWidth: {value: 1.6},
                tint: {value: new Color("#c9d4dc")},
                opacity: {value: 0.5}
            },
            transparent: true,
            depthWrite: false,
            side: DoubleSide
        }));
        this.rain = new Mesh(instanced(streak, TIER_DROPS.high, 11), this.rainMaterial);
        this.rain.frustumCulled = false;
        this.rain.renderOrder = 6;
        const ring = new PlaneGeometry(1, 1);
        this.ringMaterial = keepFrameAlpha(new ShaderMaterial({
            vertexShader: RING_VERTEX,
            fragmentShader: RING_FRAGMENT,
            uniforms: {arkTime: ARK_TIME, daylight: ARK_DAYLIGHT, centre: {value: new Vector2()}, boxSize: {value: RING_BOX}, seaLevel: {value: 0}, amount: {value: 0}, opacity: {value: 0.55}},
            transparent: true,
            depthWrite: false,
            side: DoubleSide
        }), true);
        // Flat on the water: the quad's x and y are the world's x and z.
        this.rings = new Mesh(instanced(ring, TIER_RINGS.high, 23), this.ringMaterial);
        this.rings.frustumCulled = false;
        this.rings.renderOrder = 2;
        const leaf = new PlaneGeometry(1, 1);
        this.leafMaterial = keepFrameAlpha(new ShaderMaterial({
            vertexShader: LEAF_VERTEX,
            fragmentShader: LEAF_FRAGMENT,
            uniforms: {arkTime: ARK_TIME, daylight: ARK_DAYLIGHT, box: {value: LEAF_BOX.clone()}, centre: {value: new Vector3()}, wind: {value: new Vector2()}, amount: {value: 0}},
            transparent: true,
            depthWrite: false,
            side: DoubleSide
        }));
        this.leaves = new Mesh(instanced(leaf, TIER_LEAVES.high, 37), this.leafMaterial);
        this.leaves.frustumCulled = false;
        this.root.add(this.rain, this.rings, this.leaves);
        this.setTier(tier, false);
    }

    setTier(tier: QualityTier, lite: boolean) {
        this.tier = tier;
        this.lite = lite;
        (this.rain.geometry as InstancedBufferGeometry).instanceCount = Math.round(TIER_DROPS[tier] * (lite ? 0.6 : 1));
        (this.rings.geometry as InstancedBufferGeometry).instanceCount = Math.round(TIER_RINGS[tier] * (lite ? 0.6 : 1));
        (this.leaves.geometry as InstancedBufferGeometry).instanceCount = lite ? 0 : TIER_LEAVES[tier];
    }

    setReducedMotion(reduced: boolean) {
        this.reducedMotion = reduced;
    }

    /** Every frame: the weather now, the camera, what it looks at, the fog to draw in, the renderer's exposure for a flash. */
    update(input: WeatherFxInput, camera: PerspectiveCamera, target: Vector3, fog: Fog | null, horizon: Color, renderer: WebGLRenderer, width: number, height: number) {
        const rain = Math.min(Math.max(input.rain, 0), 1);
        const wind = Math.min(Math.max(input.wind, 0), 1);
        const dirX = Math.cos(input.windDirection);
        const dirZ = Math.sin(input.windDirection);
        // Rain: on while it rains, in the air (not seen from under the water), and not with reduced motion.
        const showRain = rain > 0.02 && !input.underwater && !this.reducedMotion;
        this.rain.visible = showRain;
        if (showRain) {
            const u = this.rainMaterial.uniforms;
            (u.centre.value as Vector3).copy(camera.position);
            const push = 1.5 + 7 * wind;
            (u.wind.value as Vector2).set(dirX * push, dirZ * push);
            u.amount.value = 0.12 + 0.88 * rain;
            u.fall.value = 8 + 3 * rain;
            u.streak.value = 0.5 + 0.6 * rain;
            u.opacity.value = 0.38 + 0.34 * rain;
            // In the drawing buffer's pixels: about 1.5 CSS pixels wide on any screen, so the streaks read on a phone too.
            const ratio = renderer.getPixelRatio();
            (u.resolution.value as Vector2).set(Math.max(width * ratio, 1), Math.max(height * ratio, 1));
            u.pixelWidth.value = 1.5 * ratio;
        }
        // Rings where it hits the water, round what the camera looks at (and under the camera when close).
        const showRings = rain > 0.05 && !input.underwater && !this.reducedMotion;
        this.rings.visible = showRings;
        if (showRings) {
            const u = this.ringMaterial.uniforms;
            const close = camera.position.distanceTo(target) < 40;
            (u.centre.value as Vector2).set(close ? (target.x + camera.position.x) / 2 : target.x, close ? (target.z + camera.position.z) / 2 : target.z);
            u.seaLevel.value = input.seaLevel;
            u.amount.value = 0.1 + 0.9 * rain;
            u.opacity.value = 0.35 + 0.35 * rain;
        }
        // Leaves on a strong wind (never at the low tier or in the lighter view).
        // (Only near the ground: leaves round a camera high over the island would be in the sky.)
        const showLeaves = wind > 0.5 && !input.underwater && !this.reducedMotion && !this.lite && this.tier !== "low" && camera.position.y - target.y < 24;
        this.leaves.visible = showLeaves;
        if (showLeaves) {
            const u = this.leafMaterial.uniforms;
            (u.centre.value as Vector3).copy(camera.position);
            const push = 2 + 9 * wind;
            (u.wind.value as Vector2).set(dirX * push, dirZ * push);
            u.amount.value = Math.min((wind - 0.5) * 1.6, 1);
        }
        // Haze: fog, and rain thickening the air; greyer as it closes in. (The underwater fog is the scene's own.)
        const haze = Math.min(Math.max(Math.max(input.fog, 0.55 * rain + 0.35 * input.storm), 0), 1);
        if (fog && !input.underwater) {
            // Steep at first: even a shower greys the middle distance.
            const thick = Math.sqrt(haze);
            fog.near = this.fogNear + (8 - this.fogNear) * thick;
            fog.far = this.fogFar + (170 - this.fogFar) * thick;
            this.fogColour.copy(horizon).lerp(this.grey, 0.45 * haze);
            fog.color.copy(this.fogColour);
        }
        // Lightning: the whole picture flashes (no flash with reduced motion).
        const flash = this.reducedMotion ? 0 : Math.min(Math.max(input.lightning, 0), 1);
        // Under rain the day is duller (the sun's own dimming is the lighting's, by the cloud); a flash lights it all.
        const dull = Math.min(0.32 * rain + 0.12 * input.storm, 0.38);
        renderer.toneMappingExposure = this.baseExposure * (1 - dull) * (1 + 1.6 * flash);
        this.now.rain = showRain ? rain : 0;
        this.now.haze = haze;
        this.now.flash = flash;
        this.now.drops = showRain ? Math.round((this.rain.geometry as InstancedBufferGeometry).instanceCount * (0.12 + 0.88 * rain)) : 0;
    }

    dispose() {
        for (const mesh of [this.rain, this.rings, this.leaves]) {
            mesh.geometry.dispose();
            (mesh.material as ShaderMaterial).dispose();
        }
    }
}
