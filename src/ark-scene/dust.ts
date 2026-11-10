/**
 * Small puffs for the acted-out chases (`acts.ts`): dust kicked up on land,
 * a burst of bubbles in the water. One draw call of soft points, drawn only
 * while a puff is alive; the particles' paths are seeded, so a puff looks the
 * same every time it is played.
 */

import {BufferAttribute, BufferGeometry, Color, NormalBlending, Points, ShaderMaterial} from "three";
import type {Puff} from "@/ark-scene/acts";
import {ARK_DAYLIGHT} from "@/ark-scene/glsl";
import {seeded} from "@/ark-scene/world";

const PER_PUFF = 9;
const CAPACITY = PER_PUFF * 12;
const LIFE = 1.1;

const VERTEX = `
attribute float alpha;
attribute float size;
attribute vec3 tint;
uniform float pixelRatio;
varying float vAlpha;
varying vec3 vTint;
void main() {
    vAlpha = alpha;
    vTint = tint;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = pixelRatio * clamp(size * 340.0 / -mv.z, 2.0, 90.0);
}`;

const FRAGMENT = `
uniform float daylight;
varying float vAlpha;
varying vec3 vTint;
void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.35, 1.0, r)) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vTint * mix(0.35, 1.0, daylight), a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

type Particle = {x: number; y: number; z: number; vx: number; vy: number; vz: number; born: number; size: number; kind: Puff["kind"]};

const DUST = new Color("#c9b08a");
const BUBBLE = new Color("#e8f4f7");

export class DustPuffs {
    readonly points: Points;
    private readonly geometry = new BufferGeometry();
    private readonly material: ShaderMaterial;
    private readonly positions = new Float32Array(CAPACITY * 3);
    private readonly alphas = new Float32Array(CAPACITY);
    private readonly sizes = new Float32Array(CAPACITY);
    private readonly tints = new Float32Array(CAPACITY * 3);
    private particles: Particle[] = [];
    private serial = 0;

    constructor() {
        this.geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
        this.geometry.setAttribute("alpha", new BufferAttribute(this.alphas, 1));
        this.geometry.setAttribute("size", new BufferAttribute(this.sizes, 1));
        this.geometry.setAttribute("tint", new BufferAttribute(this.tints, 3));
        this.material = new ShaderMaterial({
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
            uniforms: {pixelRatio: {value: 1}, daylight: ARK_DAYLIGHT},
            transparent: true,
            depthWrite: false,
            blending: NormalBlending
        });
        this.points = new Points(this.geometry, this.material);
        this.points.frustumCulled = false;
        this.points.renderOrder = 7;
        this.points.visible = false;
    }

    setPixelRatio(ratio: number) {
        this.material.uniforms.pixelRatio.value = ratio;
    }

    add(puff: Puff, now: number) {
        const random = seeded(1000 + this.serial++ * 7919);
        for (let i = 0; i < PER_PUFF; i++) {
            const angle = (i / PER_PUFF) * Math.PI * 2 + random() * 0.6;
            const speed = puff.size * (0.6 + random() * 0.7);
            const up = puff.kind === "bubble" ? 0.9 + random() * 0.8 : 0.25 + random() * 0.35;
            this.particles.push({
                x: puff.x + Math.cos(angle) * puff.size * 0.15,
                y: puff.y + 0.05,
                z: puff.z + Math.sin(angle) * puff.size * 0.15,
                vx: Math.cos(angle) * speed * (puff.kind === "bubble" ? 0.35 : 1),
                vy: up * Math.max(puff.size, 0.4),
                vz: Math.sin(angle) * speed * (puff.kind === "bubble" ? 0.35 : 1),
                born: now - random() * 0.08,
                size: Math.max(puff.size, 0.3) * (0.18 + random() * 0.14),
                kind: puff.kind
            });
        }
        if (this.particles.length > CAPACITY) this.particles.splice(0, this.particles.length - CAPACITY);
    }

    step(now: number) {
        this.particles = this.particles.filter((p) => now - p.born < LIFE);
        this.points.visible = this.particles.length > 0;
        if (!this.points.visible) return;
        this.particles.forEach((p, i) => {
            const t = Math.max(now - p.born, 0);
            // Dust spreads and settles; bubbles rise and slow.
            const drag = 1 - Math.exp(-t * 2.4);
            this.positions[i * 3] = p.x + p.vx * drag / 2.4;
            this.positions[i * 3 + 1] = p.y + p.vy * drag / 2.4 - (p.kind === "dust" ? 0.35 * t * t : 0);
            this.positions[i * 3 + 2] = p.z + p.vz * drag / 2.4;
            const life = t / LIFE;
            this.alphas[i] = (p.kind === "dust" ? 0.55 : 0.75) * Math.min(t / 0.08, 1) * (1 - life) ** 1.5;
            this.sizes[i] = p.size * (1 + life * (p.kind === "dust" ? 1.6 : 0.4));
            const tint = p.kind === "dust" ? DUST : BUBBLE;
            this.tints[i * 3] = tint.r;
            this.tints[i * 3 + 1] = tint.g;
            this.tints[i * 3 + 2] = tint.b;
        });
        this.geometry.setDrawRange(0, this.particles.length);
        for (const name of ["position", "alpha", "size", "tint"]) (this.geometry.getAttribute(name) as BufferAttribute).needsUpdate = true;
    }

    clear() {
        this.particles = [];
        this.points.visible = false;
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}
