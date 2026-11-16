/**
 * The sea's own look from under the surface, drawn (3.3 batch, lane E; rules and numbers in `sea-look.ts`).
 *
 * Built only when the camera first goes under the sea, and let go again after `SEA_LOOK_LINGER` seconds above it: a
 * land view never builds or holds any of it. What it holds while under: one `Points` of marine snow (one draw call,
 * no texture; 1,500 / 800 / 300 points by tier), its positions worked out in the vertex shader from the sea's shared
 * clock, wrapped about the camera. Reduced motion keeps the motes but holds them still.
 */

import {BufferAttribute, BufferGeometry, Color, NormalBlending, Points, ShaderMaterial, type Camera, type Object3D} from "three";
import type {QualityTier} from "@/ark-scene/post";
import {SEA_LOOK_LINGER, SNOW_BOX, SNOW_CEILING, SNOW_COUNT, SNOW_PERIOD, snowSeed} from "@/ark-scene/sea-look";

const SNOW_VERTEX = /* glsl */ `
uniform float uTime;
uniform vec3 uBox;
uniform float uPixel;
uniform float uLight;
varying float vAlpha;
void main() {
    // (The same rule as sea-look.ts snowPoint: the seed's place in the box, sunk and drifted by the clock, wrapped about the camera.)
    float phase = position.x * 6.2831853 + position.z * 4.0;
    float u = uTime / ${SNOW_PERIOD.toFixed(1)};
    vec3 p = vec3((position.x + u) * uBox.x + 0.12 * sin(6.2831853 * 7.0 * u + phase), (position.y - 3.0 * u) * uBox.y, (position.z + u) * uBox.z + 0.12 * cos(6.2831853 * 5.0 * u + phase));
    p = cameraPosition + (fract((p - cameraPosition) / uBox + 0.5) - 0.5) * uBox;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = max(-mv.z, 0.05);
    // A mote is drawn 9–21 mm across (a flake of marine snow, larger than life so it reads): a few pixels close by, one far off.
    float size = (0.009 + 0.012 * fract(phase * 3.7)) * uPixel / d;
    gl_PointSize = clamp(size, 1.0, 9.0);
    // Faded in from the lens (never a blob across the view), out toward the box's edge, and never above the surface.
    float seen = smoothstep(0.25, 0.9, d) * (1.0 - smoothstep(3.4, 4.9, d)) * step(p.y, -${SNOW_CEILING.toFixed(2)});
    // The ones the sun reaches glint: brighter near the surface by day.
    float lit = mix(0.35, 1.0, uLight) * mix(1.0, 0.55, smoothstep(1.0, 9.0, -p.y));
    vAlpha = seen * lit * mix(0.5, 1.0, fract(phase * 1.3)) * min(size, 1.0);
}
`;

const SNOW_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
    vec2 c = gl_PointCoord - 0.5;
    float soft = 1.0 - smoothstep(0.1, 0.5, length(c));
    if (vAlpha * soft < 0.01) discard;
    gl_FragColor = vec4(uColor, vAlpha * soft);
    #include <colorspace_fragment>
}
`;

export class SeaLookView {
    private snow: Points | null = null;
    private material: ShaderMaterial | null = null;
    private builtFor: QualityTier | null = null;
    /** The clock second the camera was last under the sea (for the linger). */
    private lastUnder = -Infinity;
    private heldTime = 0;

    constructor(private readonly parent: Object3D) {}

    /** Whether anything is built (the tests and the report's numbers). */
    get built(): boolean {
        return this.snow !== null;
    }

    private build(tier: QualityTier): void {
        this.release();
        const count = SNOW_COUNT[tier];
        const seeds = new Float32Array(count * 3);
        const seed = {x: 0, y: 0, z: 0};
        for (let i = 0; i < count; i++) {
            snowSeed(i, seed);
            seeds.set([seed.x, seed.y, seed.z], i * 3);
        }
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(seeds, 3));
        this.material = new ShaderMaterial({
            vertexShader: SNOW_VERTEX,
            fragmentShader: SNOW_FRAGMENT,
            uniforms: {uTime: {value: 0}, uBox: {value: [SNOW_BOX.x, SNOW_BOX.y, SNOW_BOX.z]}, uPixel: {value: 800}, uLight: {value: 1}, uColor: {value: new Color("#dff3ea")}},
            transparent: true,
            depthWrite: false,
            blending: NormalBlending
        });
        this.snow = new Points(geometry, this.material);
        // (Its positions are the shader's: never culled by the seeds' own box.)
        this.snow.frustumCulled = false;
        this.snow.renderOrder = 4;
        this.snow.name = "sea-snow";
        this.parent.add(this.snow);
        this.builtFor = tier;
    }

    private release(): void {
        if (!this.snow) return;
        this.parent.remove(this.snow);
        this.snow.geometry.dispose();
        this.material?.dispose();
        this.snow = null;
        this.material = null;
        this.builtFor = null;
    }

    /**
     * Each frame: `under` is the scene's own "the camera is under the sea"; `clock` the sea's shared clock wrapped to
     * its period (`seaClockSeconds`); `now` any running seconds (for the linger); `viewHeight` the canvas's height in
     * device pixels (a mote's size on screen).
     */
    step(under: boolean, camera: Camera, daylight: number, clock: number, now: number, tier: QualityTier, viewHeight: number, reducedMotion: boolean): void {
        if (under) {
            this.lastUnder = now;
            if (!this.snow || this.builtFor !== tier) this.build(tier);
        } else if (this.snow && now - this.lastUnder > SEA_LOOK_LINGER) {
            this.release();
        }
        if (!this.snow || !this.material) return;
        this.snow.visible = under;
        if (!under) return;
        if (!reducedMotion) this.heldTime = clock;
        const uniforms = this.material.uniforms;
        uniforms.uTime.value = this.heldTime;
        uniforms.uLight.value = Math.min(Math.max(daylight, 0), 1);
        // (World size → pixels at 1 m: the canvas's height over the view's tangent.)
        const fov = (camera as Camera & {fov?: number}).fov ?? 50;
        uniforms.uPixel.value = viewHeight / (2 * Math.tan(fov * Math.PI / 360));
    }

    dispose(): void {
        this.release();
    }
}
