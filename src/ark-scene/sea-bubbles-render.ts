/**
 * Bubbles under the sea, drawn (3.3 batch, lane E; rules in `sea-bubbles.ts`): the vents' streams near the camera and
 * the pool's free bubbles (divers' bursts, fast swimmers' trails) as ONE `Points` (one draw call, no texture: the
 * bubble's rim and glint are the fragment shader's). Owned by `SeaLookView`, so it exists only while the camera is
 * (or has just been) under the sea. Its two arrays are filled in place each frame: nothing is allocated after the build.
 */

import {BufferAttribute, BufferGeometry, DynamicDrawUsage, Points, ShaderMaterial, type Camera, type Object3D} from "three";
import type {QualityTier} from "@/ark-scene/post";
import {BubblePool, POOL_SIZE, SwimmerBubbles, VENT_BUBBLES, seaVents, ventBubble, type BubblePoint, type SeaVent} from "@/ark-scene/sea-bubbles";

/** The vents drawn at once (the nearest), by tier, and how near the camera a vent must be (m). */
const VENTS_DRAWN: Record<QualityTier, number> = {high: 8, medium: 5, low: 3};
const VENT_WITHIN = 34;

const VERTEX = /* glsl */ `
attribute float aSize;
uniform float uPixel;
uniform float uLight;
uniform float uHaze;
varying float vAlpha;
varying float vSmall;
void main() {
    vec4 mv = viewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = max(-mv.z, 0.05);
    float size = aSize * uPixel / d;
    gl_PointSize = clamp(size, 1.5, 48.0);
    // The water's haze takes them with distance, as it takes everything else.
    vAlpha = step(0.0001, aSize) * exp(-d * uHaze * 1.2) * mix(0.45, 1.0, uLight) * smoothstep(0.15, 0.5, d);
    vSmall = 1.0 - smoothstep(2.5, 7.0, size);
}
`;

const FRAGMENT = /* glsl */ `
varying float vAlpha;
varying float vSmall;
void main() {
    vec2 c = (gl_PointCoord - 0.5) * 2.0;
    float r = length(c);
    if (r > 1.0 || vAlpha < 0.01) discard;
    // A bubble: a bright rim, a clear middle, the surface's glint up and to one side. Far off it is one pale dot.
    float rim = smoothstep(0.55, 0.92, r) * (1.0 - smoothstep(0.92, 1.0, r));
    float glint = 1.0 - smoothstep(0.0, 0.28, length(c - vec2(-0.32, -0.36)));
    float body = mix(0.1 + 0.75 * rim + 0.9 * glint, 0.75 * (1.0 - r * r), vSmall);
    gl_FragColor = vec4(vec3(0.86, 0.97, 0.98), clamp(body, 0.0, 1.0) * vAlpha);
    #include <colorspace_fragment>
}
`;

export class SeaBubblesView {
    readonly pool: BubblePool;
    private readonly swimmers: SwimmerBubbles;
    private readonly points: Points;
    private readonly material: ShaderMaterial;
    private readonly positions: Float32Array;
    private readonly sizes: Float32Array;
    private readonly ventsDrawn: number;
    private readonly near: SeaVent[] = [];
    private readonly bubble: BubblePoint = {x: 0, y: 0, z: 0, size: 0};
    private lastNow = 0;

    constructor(private readonly parent: Object3D, tier: QualityTier, private readonly extraVents: readonly SeaVent[] = []) {
        this.pool = new BubblePool(POOL_SIZE[tier]);
        this.swimmers = new SwimmerBubbles(this.pool);
        this.ventsDrawn = VENTS_DRAWN[tier];
        const capacity = this.ventsDrawn * VENT_BUBBLES + this.pool.capacity;
        this.positions = new Float32Array(capacity * 3);
        this.sizes = new Float32Array(capacity);
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage));
        geometry.setAttribute("aSize", new BufferAttribute(this.sizes, 1).setUsage(DynamicDrawUsage));
        geometry.setDrawRange(0, 0);
        this.material = new ShaderMaterial({vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms: {uPixel: {value: 800}, uLight: {value: 1}, uHaze: {value: 0.058}}, transparent: true, depthWrite: false});
        this.points = new Points(geometry, this.material);
        this.points.frustumCulled = false;
        this.points.renderOrder = 4;
        this.points.name = "sea-bubbles";
        parent.add(this.points);
    }

    /** How many points the buffer holds (the report's numbers). */
    get capacity(): number {
        return this.sizes.length;
    }

    /** An animal drawn in the water near the camera this frame (`sea-bubbles.ts` SwimmerBubbles). */
    swimmer(id: string, x: number, y: number, z: number, breath: number, length: number, now: number): void {
        this.swimmers.track(id, x, y, z, breath, length, now);
    }

    step(visible: boolean, camera: Camera, clock: number, now: number, daylight: number, haze: number, pixelsPerMetre: number, reducedMotion: boolean): void {
        this.points.visible = visible;
        const dt = now - this.lastNow;
        this.lastNow = now;
        if (!visible) return;
        if (!reducedMotion) this.pool.step(dt);
        // The nearest vents (the list is short: a scan, and an insertion into the few kept).
        const near = this.near;
        near.length = 0;
        const cx = camera.position.x;
        const cz = camera.position.z;
        const consider = (vent: SeaVent) => {
            const d = Math.hypot(vent.x - cx, vent.z - cz);
            if (d > VENT_WITHIN) return;
            let at = near.length;
            while (at > 0 && Math.hypot(near[at - 1].x - cx, near[at - 1].z - cz) > d) at--;
            if (at >= this.ventsDrawn) return;
            near.splice(at, 0, vent);
            if (near.length > this.ventsDrawn) near.length = this.ventsDrawn;
        };
        for (const vent of seaVents()) consider(vent);
        for (const vent of this.extraVents) consider(vent);
        let n = 0;
        for (const vent of near) {
            for (let j = 0; j < VENT_BUBBLES; j++) {
                const b = ventBubble(vent, j, clock, this.bubble);
                if (b.size <= 0) continue;
                this.positions[n * 3] = b.x;
                this.positions[n * 3 + 1] = b.y;
                this.positions[n * 3 + 2] = b.z;
                this.sizes[n++] = b.size;
            }
        }
        n += this.pool.write(this.positions, this.sizes, n);
        const geometry = this.points.geometry;
        geometry.setDrawRange(0, n);
        (geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
        (geometry.getAttribute("aSize") as BufferAttribute).needsUpdate = true;
        const uniforms = this.material.uniforms;
        uniforms.uPixel.value = pixelsPerMetre;
        uniforms.uLight.value = Math.min(Math.max(daylight, 0), 1);
        uniforms.uHaze.value = haze;
    }

    dispose(): void {
        this.parent.remove(this.points);
        this.points.geometry.dispose();
        this.material.dispose();
    }
}
