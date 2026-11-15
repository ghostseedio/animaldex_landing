/**
 * What a meal leaves on the ground (`meals.ts` traceOf, `live-meals.ts` traces): a few feathers, a tuft or two of fur,
 * a scatter of scales, and the grass pressed flat where a bigger animal fed. Small and quiet (never blood): flat bits
 * lying on the ground, lit like the ground, laid out by the meal's seed so every viewer sees the same scatter, fading
 * by rule. Two draw calls.
 */

import {CanvasTexture, Color, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, Quaternion, Vector3} from "three";
import {mealRandom, type TraceKind} from "@/ark-scene/meals";

/** `dung`: a land mammal's droppings (`dung.ts`): a few small dark pellets, drawn with the meals' traces. */
export type TraceDraw = {key: string; x: number; y: number; z: number; kind: TraceKind | "dung"; flattened: boolean; size: number; amount: number; alpha: number; seed: string};

/** Each kind's bits: how many (at full), their size (m, length by width, of the trace's spread), their colours. */
const BITS: Record<Exclude<TraceKind, "none"> | "dung", {count: number; length: number; width: number; colors: number[]}> = {
    dung: {count: 5, length: 0.05, width: 0.045, colors: [0x3b2f22, 0x4a3a28, 0x33291e]},
    feathers: {count: 14, length: 0.09, width: 0.026, colors: [0xe9e4d8, 0xc9c1b1, 0x8f877a, 0x6d665c]},
    fur: {count: 12, length: 0.07, width: 0.05, colors: [0xa07e5a, 0x8a6c4c, 0xb89a74, 0x7a6048]},
    scales: {count: 10, length: 0.022, width: 0.018, colors: [0xc4cdc9, 0xa9b3ae, 0xd9dccf]}
};

function softTexture(): CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.55, "rgba(255,255,255,0.55)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new CanvasTexture(canvas);
}

export class MealTraces {
    readonly bits: InstancedMesh;
    readonly patches: InstancedMesh;
    private readonly bitMaterial: MeshLambertMaterial;
    private readonly patchMaterial: MeshBasicMaterial;
    private readonly texture = softTexture();
    private readonly matrix = new Matrix4();
    private readonly q = new Quaternion();
    private readonly p = new Vector3();
    private readonly s = new Vector3();
    private readonly up = new Vector3(0, 1, 0);
    private readonly color = new Color();
    private capacity = 0;
    private patchCapacity = 0;

    constructor() {
        const bit = new PlaneGeometry(1, 1);
        bit.rotateX(-Math.PI / 2);
        // (Soft-edged: a tuft or a feather, never a hard square.)
        this.bitMaterial = new MeshLambertMaterial({color: 0xffffff, alphaMap: this.texture, side: DoubleSide, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3});
        this.bits = new InstancedMesh(bit, this.bitMaterial, 1);
        this.bits.frustumCulled = false;
        this.bits.renderOrder = 2;
        this.bits.count = 0;
        this.bits.visible = false;
        const patch = new PlaneGeometry(1, 1);
        patch.rotateX(-Math.PI / 2);
        // The pressed patch: a little darker and drier than the grass round it.
        this.patchMaterial = new MeshBasicMaterial({color: 0x3d3524, alphaMap: this.texture, transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
        this.patches = new InstancedMesh(patch, this.patchMaterial, 1);
        this.patches.frustumCulled = false;
        this.patches.renderOrder = 1;
        this.patches.count = 0;
        this.patches.visible = false;
        this.grow(64);
        this.growPatches(8);
    }

    private grow(capacity: number) {
        this.capacity = capacity;
        const m = new InstancedBufferAttribute(new Float32Array(capacity * 16), 16);
        m.setUsage(DynamicDrawUsage);
        this.bits.instanceMatrix = m;
        const c = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        c.setUsage(DynamicDrawUsage);
        this.bits.instanceColor = c;
    }

    private growPatches(capacity: number) {
        this.patchCapacity = capacity;
        const m = new InstancedBufferAttribute(new Float32Array(capacity * 16), 16);
        m.setUsage(DynamicDrawUsage);
        this.patches.instanceMatrix = m;
    }

    /** The frame's traces; `ground(x, z)` the drawn ground's height (bits lie on it, each where it fell). */
    set(traces: TraceDraw[], ground: (x: number, z: number) => number) {
        let n = 0;
        let np = 0;
        let alpha = 0;
        const want = traces.reduce((sum, t) => sum + (t.kind === "none" ? 0 : BITS[t.kind].count), 0);
        if (want > this.capacity) this.grow(Math.max(want, this.capacity * 2));
        if (traces.length > this.patchCapacity) this.growPatches(Math.max(traces.length, this.patchCapacity * 2));
        for (const t of traces) {
            if (t.alpha <= 0.01) continue;
            alpha = Math.max(alpha, t.alpha);
            if (t.flattened) {
                // Flattened ground: an oval a little bigger than the prey, along a seeded heading.
                const r = mealRandom(`${t.seed}#patch`);
                this.q.setFromAxisAngle(this.up, r() * Math.PI);
                this.s.set(t.size * 1.1 * t.alpha, 1, t.size * 0.75 * t.alpha);
                this.p.set(t.x, ground(t.x, t.z) + 0.02, t.z);
                this.matrix.compose(this.p, this.q, this.s);
                this.patches.setMatrixAt(np++, this.matrix);
            }
            if (t.kind === "none") continue;
            const spec = BITS[t.kind];
            const r = mealRandom(`${t.seed}#bits`);
            // Bits build up while it feeds (`amount`), then fade one by one (the last ones first) as the trace ages.
            const shown = Math.round(spec.count * Math.min(t.amount, 1) * Math.min(t.alpha * 1.4, 1));
            const scale = Math.min(Math.max(t.size / 0.6, 0.6), 2.2);
            for (let i = 0; i < spec.count; i++) {
                const angle = r() * Math.PI * 2;
                // Most near the middle, a few blown further.
                const radius = t.size * (0.15 + 0.6 * Math.pow(r(), 1.6));
                const yaw = r() * Math.PI * 2;
                const tint = spec.colors[Math.floor(r() * spec.colors.length)];
                const tilt = (r() - 0.5) * 0.5;
                const size = 0.75 + 0.5 * r();
                if (i >= shown) continue;
                const x = t.x + Math.cos(angle) * radius;
                const z = t.z + Math.sin(angle) * radius;
                this.q.setFromAxisAngle(this.up, yaw);
                this.s.set(spec.width * scale * size, 1, spec.length * scale * size);
                this.p.set(x, ground(x, z) + 0.012 + Math.abs(tilt) * 0.01, z);
                this.matrix.compose(this.p, this.q, this.s);
                this.bits.setMatrixAt(n, this.matrix);
                this.bits.setColorAt(n, this.color.setHex(tint));
                n++;
            }
        }
        this.bits.count = n;
        this.bits.visible = n > 0;
        this.patches.count = np;
        this.patches.visible = np > 0;
        this.bitMaterial.opacity = Math.min(alpha * 1.2, 1);
        this.patchMaterial.opacity = 0.2 * Math.min(alpha * 1.2, 1);
        this.bits.instanceMatrix.needsUpdate = true;
        if (this.bits.instanceColor) this.bits.instanceColor.needsUpdate = true;
        this.patches.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        this.bits.geometry.dispose();
        this.patches.geometry.dispose();
        this.bitMaterial.dispose();
        this.patchMaterial.dispose();
        this.texture.dispose();
        this.bits.dispose();
        this.patches.dispose();
    }
}
