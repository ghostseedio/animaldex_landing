/**
 * What animals leave behind (liveliness wiring): footprints in sand, mud,
 * snow and soil; rings on the water where one wades or swims at the
 * surface; dust kicked up running on dry ground; and worn paths where the
 * schedule keeps sending animals the same way. (The grass bending under
 * walkers is the scene's own, `grass-press.ts`.)
 *
 * Cheap and close: only animals near the camera leave traces (the scene
 * passes those), each kind is one draw call from a fixed ring of instances,
 * and every trace fades on its own (mud and snow keep prints longest; the
 * tide washes the wet sand). Where a print falls is where the shared pose
 * put the foot, so every viewer's zebra leaves the same trail; how many are
 * still showing depends on how long the viewer has watched.
 */

import {
    AddEquation,
    CustomBlending,
    DynamicDrawUsage,
    OneFactor,
    OneMinusSrcAlphaFactor,
    SrcAlphaFactor,
    ZeroFactor,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    PlaneGeometry,
    Quaternion,
    ShaderMaterial,
    Vector3,
    Group,
    type BufferGeometry
} from "three";
import {DustPuffs} from "@/ark-scene/dust";
import {ARK_DAYLIGHT} from "@/ark-scene/glsl";
import type {QualityTier} from "@/ark-scene/post";
import {surfaceAt, type ArkEnvironment, type SurfaceKind} from "@/ark-scene/sampler";
import {hash32} from "@/lib/ark-clock";

/** An animal near the camera this frame, as far as its traces go. */
export type TraceWalker = {
    id: string;
    x: number;
    /** Its feet's height (the pose's base). */
    y: number;
    z: number;
    yaw: number;
    /** Drawn length (m). */
    length: number;
    /** On its feet on land (not aloft, not swimming). */
    onGround: boolean;
    /** Wading, or swimming or floating at the surface. */
    atSurface: boolean;
    /** A bird's three toes, not a paw or hoof. */
    bird: boolean;
    /** From the camera (m). */
    distance: number;
};

/** How a surface takes a print: how long it lasts (s), how dark, and whether it is snow (prints show blue-grey). */
const PRINT: Partial<Record<SurfaceKind, {life: number; strength: number; snow?: boolean}>> = {
    sand: {life: 120, strength: 0.5},
    wet_sand: {life: 50, strength: 0.75},
    mud: {life: 240, strength: 0.8},
    snow: {life: 300, strength: 0.65, snow: true},
    soil: {life: 90, strength: 0.42},
    tilled: {life: 90, strength: 0.45},
    forest_floor: {life: 35, strength: 0.22}
};
/** Ground that dusts up underfoot when dry. */
const DUSTY: ReadonlySet<SurfaceKind> = new Set<SurfaceKind>(["sand", "soil", "tilled"]);

const CAPACITY: Record<QualityTier, {prints: number; ripples: number; worn: number}> = {
    high: {prints: 512, ripples: 96, worn: 600},
    medium: {prints: 320, ripples: 64, worn: 400},
    low: {prints: 160, ripples: 32, worn: 200}
};
/** Animals further than this from the camera (m) leave no new traces. */
export const TRACE_WITHIN = 28;

const PRINT_VERTEX = `
attribute vec4 print;
varying vec2 vUv;
varying vec4 vPrint;
void main() {
    vUv = uv;
    vPrint = print;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;

const PRINT_FRAGMENT = `
uniform float now;
uniform float daylight;
varying vec2 vUv;
varying vec4 vPrint;
void main() {
    float age = now - vPrint.x;
    float life = vPrint.y;
    if (age < 0.0 || age > life) discard;
    vec2 p = vUv * 2.0 - 1.0;
    float shape;
    if (vPrint.w > 0.5) {
        // A bird's foot: three toes forward, one back.
        float t1 = 1.0 - smoothstep(0.08, 0.16, abs(p.x) + max(-p.y, 0.0) * 2.0 + max(p.y - 0.9, 0.0) * 4.0);
        vec2 q = vec2(abs(p.x), p.y);
        float t2 = 1.0 - smoothstep(0.07, 0.15, abs(q.x * 0.82 - q.y * 0.57) + max(-(q.x * 0.57 + q.y * 0.82), 0.0) * 3.0 + max(q.x * 0.57 + q.y * 0.82 - 0.8, 0.0) * 4.0);
        float back = 1.0 - smoothstep(0.07, 0.15, abs(p.x) + max(p.y, 0.0) * 3.0 + max(-p.y - 0.45, 0.0) * 4.0);
        shape = max(max(t1, t2), back);
    } else {
        // A pad or a hoof: an oval, split at the front.
        float oval = 1.0 - smoothstep(0.62, 0.95, length(p * vec2(1.25, 0.9)));
        float cleft = smoothstep(0.02, 0.1, abs(p.x)) + (1.0 - smoothstep(-0.2, 0.1, p.y));
        shape = oval * min(cleft, 1.0) * (0.75 + 0.25 * (1.0 - smoothstep(0.2, 0.9, length(p))));
    }
    float strength = abs(vPrint.z);
    // A clean edge to the shape, then the surface's own depth of print (sand light, mud deep), fading with age.
    float a = smoothstep(0.08, 0.4, shape) * min(strength * 1.4, 0.92) * (1.0 - smoothstep(life * 0.55, life, age)) * smoothstep(0.0, 0.25, age);
    if (a < 0.01) discard;
    vec3 colour = vPrint.z < 0.0 ? vec3(0.36, 0.44, 0.58) : vec3(0.13, 0.1, 0.07);
    gl_FragColor = vec4(colour * mix(0.5, 1.0, daylight), a);
    #include <colorspace_fragment>
}`;

const RIPPLE_FRAGMENT = `
uniform float now;
uniform float daylight;
varying vec2 vUv;
varying vec4 vPrint;
void main() {
    float age = now - vPrint.x;
    float life = vPrint.y;
    if (age < 0.0 || age > life) discard;
    float k = age / life;
    float r = length(vUv * 2.0 - 1.0);
    float ring = (1.0 - smoothstep(0.0, 0.09, abs(r - (0.15 + 0.85 * k)))) * (1.0 - k) * (1.0 - k);
    float a = min(ring * vPrint.z * 1.8, 0.9);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vec3(0.9, 0.95, 0.98) * mix(0.4, 1.0, daylight), a);
    #include <colorspace_fragment>
}`;

const WORN_FRAGMENT = `
uniform float daylight;
varying vec2 vUv;
varying vec4 vPrint;
void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float n = fract(sin(dot(floor(vUv * 9.0) + vec2(vPrint.w), vec2(12.9898, 78.233))) * 43758.5453);
    float a = min((1.0 - smoothstep(0.35, 1.0, length(p))) * vPrint.z * 1.6 * (0.75 + 0.25 * n), 0.6);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vec3(0.34, 0.27, 0.18) * mix(0.45, 1.0, daylight), a);
    #include <colorspace_fragment>
}`;

/**
 * Normal blending for the colour, but the frame's alpha left as it is: the scene draws into a target with an alpha
 * channel that the output pass composites over the page, so a half-transparent decal would otherwise let the page's
 * background show through it (a print on sand vanished).
 */
export function keepFrameAlpha<T extends {blending: number; blendEquation: number; blendSrc: number; blendDst: number; blendSrcAlpha: number | null; blendDstAlpha: number | null}>(material: T, additive = false): T {
    material.blending = CustomBlending;
    material.blendEquation = AddEquation;
    material.blendSrc = SrcAlphaFactor;
    material.blendDst = additive ? OneFactor : OneMinusSrcAlphaFactor;
    material.blendSrcAlpha = ZeroFactor;
    material.blendDstAlpha = OneFactor;
    return material;
}

type Walker = {x: number; z: number; travelled: number; side: number; seen: number; lastRipple: number; lastDust: number; wasSurface: boolean};

class Ring {
    readonly mesh: InstancedMesh;
    readonly attribute: InstancedBufferAttribute;
    private next = 0;
    private filled = 0;

    constructor(fragment: string, capacity: number, private readonly now: {value: number}, order: number) {
        const geometry: BufferGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
        this.attribute = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
        this.attribute.setUsage(DynamicDrawUsage);
        geometry.setAttribute("print", this.attribute);
        const material = keepFrameAlpha(new ShaderMaterial({
            vertexShader: PRINT_VERTEX,
            fragmentShader: fragment,
            uniforms: {now: this.now, daylight: ARK_DAYLIGHT},
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2
        }));
        this.mesh = new InstancedMesh(geometry, material, capacity);
        this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = order;
    }

    get capacity(): number {
        return this.attribute.count;
    }

    push(matrix: Matrix4, a: number, b: number, c: number, d: number) {
        const i = this.next;
        this.mesh.setMatrixAt(i, matrix);
        this.attribute.setXYZW(i, a, b, c, d);
        this.next = (i + 1) % this.capacity;
        this.filled = Math.min(this.filled + 1, this.capacity);
        this.mesh.count = this.filled;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.attribute.needsUpdate = true;
    }

    clear() {
        this.next = 0;
        this.filled = 0;
        this.mesh.count = 0;
    }

    get count(): number {
        return this.filled;
    }

    dispose() {
        this.mesh.geometry.dispose();
        (this.mesh.material as ShaderMaterial).dispose();
        this.mesh.dispose();
    }
}

export class Traces {
    readonly root = new Group();
    private readonly time = {value: 0};
    private prints: Ring;
    private ripples: Ring;
    private worn: Ring;
    private readonly dust = new DustPuffs();
    private readonly walkers = new Map<string, Walker>();
    private tier: QualityTier;
    private reducedMotion = false;
    private readonly matrix = new Matrix4();
    private readonly quaternion = new Quaternion();
    private readonly up = new Vector3(0, 1, 0);
    private readonly at = new Vector3();
    private readonly size = new Vector3();
    /** How many of each were laid (for stats and tests). */
    readonly counts = {prints: 0, ripples: 0, dust: 0};

    constructor(tier: QualityTier) {
        this.tier = tier;
        const caps = CAPACITY[tier];
        this.prints = new Ring(PRINT_FRAGMENT, caps.prints, this.time, 1);
        this.ripples = new Ring(RIPPLE_FRAGMENT, caps.ripples, this.time, 2);
        this.worn = new Ring(WORN_FRAGMENT, caps.worn, this.time, 0);
        this.root.add(this.worn.mesh, this.prints.mesh, this.ripples.mesh, this.dust.points);
    }

    setTier(tier: QualityTier) {
        if (tier === this.tier) return;
        this.tier = tier;
        const caps = CAPACITY[tier];
        for (const [key, fragment, order] of [["prints", PRINT_FRAGMENT, 1], ["ripples", RIPPLE_FRAGMENT, 2], ["worn", WORN_FRAGMENT, 0]] as const) {
            const old = this[key];
            this.root.remove(old.mesh);
            old.dispose();
            this[key] = new Ring(fragment, caps[key], this.time, order);
            this.root.add(this[key].mesh);
        }
    }

    setReducedMotion(reduced: boolean) {
        this.reducedMotion = reduced;
    }

    setPixelRatio(ratio: number) {
        this.dust.setPixelRatio(ratio);
    }

    /**
     * One animal near the camera this frame. `elapsed` is the scene's clock
     * (s); `environment` the sea level and wetness now.
     */
    observe(w: TraceWalker, elapsed: number, environment: ArkEnvironment) {
        if (w.distance > TRACE_WITHIN || this.reducedMotion) return;
        let memo = this.walkers.get(w.id);
        if (!memo) {
            memo = {x: w.x, z: w.z, travelled: 0, side: hash32(w.id, "foot") % 2 ? 1 : -1, seen: elapsed, lastRipple: -1, lastDust: -1, wasSurface: w.atSurface};
            this.walkers.set(w.id, memo);
        }
        const dt = Math.max(elapsed - memo.seen, 1e-3);
        const moved = Math.hypot(w.x - memo.x, w.z - memo.z);
        memo.seen = elapsed;
        // A jump (a new spot, an act's cut): no trail across it.
        if (moved > Math.max(3, w.length * 3)) {
            memo.x = w.x;
            memo.z = w.z;
            memo.travelled = 0;
            memo.wasSurface = w.atSurface;
            return;
        }
        const speed = moved / dt;
        memo.x = w.x;
        memo.z = w.z;
        const stride = Math.max(w.length * 0.32, 0.07);
        if (w.onGround && moved > 0) {
            memo.travelled += moved;
            let surface: ReturnType<typeof surfaceAt> | null = null;
            while (memo.travelled >= stride) {
                memo.travelled -= stride;
                surface ??= surfaceAt(w.x, w.z, environment);
                const kind = PRINT[surface.surface];
                if (!kind || surface.waterDepth > 0.01 || w.y < environment.seaLevel) continue;
                memo.side = -memo.side;
                const across = memo.side * Math.max(w.length * 0.07, 0.015);
                const px = w.x + Math.cos(w.yaw) * across;
                const pz = w.z - Math.sin(w.yaw) * across;
                const footprint = Math.min(Math.max(w.length * (w.bird ? 0.16 : 0.1), 0.025), 0.32);
                // A little over the ground (the terrain mesh is coarser than its height function), the decal pulled forward too.
                this.at.set(px, w.y + 0.035, pz);
                this.quaternion.setFromAxisAngle(this.up, w.yaw);
                this.size.set(footprint * (w.bird ? 1 : 0.75), 1, footprint);
                this.matrix.compose(this.at, this.quaternion, this.size);
                const strength = Math.min(kind.strength * (0.7 + 0.5 * Math.max(surface.wetness, environment.wetness)), 1);
                this.prints.push(this.matrix, elapsed, kind.life, kind.snow ? -strength : strength, w.bird ? 1 : 0);
                this.counts.prints++;
            }
            // Dust off dry, bare ground at a run.
            if (speed > Math.max(1.3, w.length * 1.1) && elapsed - memo.lastDust > 0.32 && environment.wetness < 0.3) {
                surface ??= surfaceAt(w.x, w.z, environment);
                if (DUSTY.has(surface.surface) && surface.wetness < 0.3) {
                    memo.lastDust = elapsed;
                    this.dust.add({x: w.x - Math.sin(w.yaw) * w.length * 0.4, y: w.y + 0.03, z: w.z - Math.cos(w.yaw) * w.length * 0.4, size: Math.min(Math.max(w.length * 0.25, 0.08), 0.6), kind: "dust"}, elapsed);
                    this.counts.dust++;
                }
            }
        }
        // Rings on the water: as it moves at the surface, and a bigger one as it goes in.
        if (w.atSurface) {
            const entering = !memo.wasSurface;
            const every = speed > 0.08 ? 0.55 : 2.2;
            if (entering || elapsed - memo.lastRipple > every) {
                memo.lastRipple = elapsed;
                const size = Math.min(Math.max(w.length * (entering ? 3.2 : 1.8), 0.4), 6);
                this.at.set(w.x, environment.seaLevel + 0.015, w.z);
                this.quaternion.identity();
                this.size.set(size, 1, size);
                this.matrix.compose(this.at, this.quaternion, this.size);
                this.ripples.push(this.matrix, elapsed, entering ? 2.6 : 1.9, entering ? 0.7 : 0.45, 0);
                this.counts.ripples++;
            }
        }
        memo.wasSurface = w.atSurface;
    }

    /** The worn patches round the camera (`wornPatches`): laid again whenever the set changes. */
    setWorn(patches: Array<{x: number; y: number; z: number; size: number; strength: number}>) {
        this.worn.clear();
        for (const p of patches.slice(0, this.worn.capacity)) {
            this.at.set(p.x, p.y + 0.03, p.z);
            const seed = hash32(`${Math.round(p.x * 10)},${Math.round(p.z * 10)}`);
            this.quaternion.setFromAxisAngle(this.up, (seed % 628) / 100);
            this.size.set(p.size, 1, p.size);
            this.matrix.compose(this.at, this.quaternion, this.size);
            // Worn patches don't fade; the last number seeds their grain.
            this.worn.push(this.matrix, 0, 0, p.strength, (seed % 997) / 7);
        }
    }

    /** After the frame's animals: the clocks, the dust, and the walkers not seen for a while let go. */
    step(elapsed: number) {
        this.time.value = elapsed;
        this.dust.step(elapsed);
        if (this.walkers.size > 200) {
            this.walkers.forEach((memo, id) => {
                if (elapsed - memo.seen > 5) this.walkers.delete(id);
            });
        }
    }

    stats(): {prints: number; ripples: number; worn: number} {
        return {prints: this.prints.count, ripples: this.ripples.count, worn: this.worn.count};
    }

    dispose() {
        this.prints.dispose();
        this.ripples.dispose();
        this.worn.dispose();
        this.dust.dispose();
    }
}
