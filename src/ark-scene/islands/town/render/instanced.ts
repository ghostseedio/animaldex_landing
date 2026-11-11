/**
 * The town's instanced things (docs/ark/town-island.md): trees by kind, and the props that implied people move (parked
 * cars, wheelie bins, washing on the line, boats at their moorings, the market's stalls) plus the street lamps. One
 * InstancedMesh per kind for the whole island; each instance keeps its chunk, so the streamer draws only the instances
 * in chunks it draws (`setDrawn`), as Part B's `ChunkedInstances` does for the wild island's plants.
 */

import {Color, DynamicDrawUsage, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry, type Material} from "three";
import {Geo, tone, type Frame} from "@/ark-scene/islands/town/render/kit";
import {townChunkOf} from "@/ark-scene/islands/town/chunks";

export type TreeKind = "oak" | "lime" | "plane" | "birch" | "willow" | "poplar" | "pine" | "yew" | "apple" | "cherry" | "acacia" | "palm" | "hedge_shrub";

const LEAF: Record<string, string> = {oak: "#4f7a36", lime: "#5d8a3c", plane: "#5a8238", birch: "#7aa04a", willow: "#7a9a4a", poplar: "#56803a", pine: "#2f5a36", yew: "#2c4a2e", apple: "#6a9440", cherry: "#d8a4b4", acacia: "#7a8a42", palm: "#5a8a3a", hedge_shrub: "#46703a"};

/** A tree's mesh in its own frame (its foot at the origin), true size for a mature town tree of its kind. */
export function treeGeometry(kind: string): BufferGeometry {
    const g = new Geo();
    const f: Frame = {x: 0, y: 0, z: 0, rot: 0};
    const bark = tone(kind === "birch" ? "#d8d4c8" : kind === "plane" ? "#9a9078" : "#5e4a38");
    const leaf = tone(LEAF[kind] ?? LEAF.oak);
    switch (kind) {
        case "pine":
            g.cylinder(f, 0, 0, 0, 0.3, 0.18, 4, bark, 6);
            for (let i = 0; i < 4; i++) g.cylinder(f, 0, 3 + i * 2.6, 0, 3.0 - i * 0.6, 0.2, 3.6, leaf.map((v) => v * (0.9 + i * 0.05)) as [number, number, number], 8);
            break;
        case "poplar":
            g.cylinder(f, 0, 0, 0, 0.3, 0.2, 3, bark, 6);
            g.blob(0, 9, 0, 2.2, 7.5, 2.2, leaf, 11, 1);
            break;
        case "yew":
            g.cylinder(f, 0, 0, 0, 0.4, 0.3, 1.6, bark, 6);
            g.blob(0, 3.6, 0, 3.0, 3.4, 3.0, leaf, 7, 1);
            break;
        case "willow":
            g.cylinder(f, 0, 0, 0, 0.45, 0.32, 3.6, bark, 6);
            g.blob(0, 6.2, 0, 5.2, 3.6, 5.2, leaf, 5, 1);
            g.blob(0, 3.8, 0, 5.8, 2.6, 5.8, leaf.map((v) => v * 0.92) as [number, number, number], 6, 1);
            break;
        case "birch":
            g.cylinder(f, 0, 0, 0, 0.18, 0.12, 7, bark, 6);
            g.blob(0, 8.5, 0, 2.6, 3.8, 2.6, leaf, 3, 1);
            break;
        case "apple":
        case "cherry":
            g.cylinder(f, 0, 0, 0, 0.22, 0.16, 1.8, bark, 6);
            g.blob(0, 3.4, 0, 2.6, 1.9, 2.6, leaf, kind === "apple" ? 13 : 17, 1);
            break;
        case "acacia":
            g.cylinder(f, 0, 0, 0, 0.3, 0.2, 4.8, bark, 6);
            g.blob(0, 6.0, 0, 5.2, 1.2, 5.2, leaf, 19, 1);
            break;
        case "palm":
            g.cylinder(f, 0, 0, 0, 0.3, 0.22, 7, bark, 6);
            g.blob(0, 7.4, 0, 2.6, 0.9, 2.6, leaf, 23, 0);
            break;
        case "hedge_shrub":
            g.blob(0, 0.9, 0, 1.4, 1.1, 1.4, leaf, 29, 1);
            break;
        default: {
            // Oak, lime, plane: a broad crown of three lobes.
            const tall = kind === "lime" ? 1.15 : kind === "plane" ? 1.2 : 1;
            g.cylinder(f, 0, 0, 0, 0.5, 0.35, 4.2 * tall, bark, 7);
            g.blob(0, 7.6 * tall, 0, 4.6, 3.8 * tall, 4.6, leaf, 31, 1);
            g.blob(2.2, 6.6 * tall, 1.0, 3.0, 2.6 * tall, 3.0, leaf.map((v) => v * 0.94) as [number, number, number], 37, 1);
            g.blob(-2.0, 6.8 * tall, -1.4, 3.2, 2.6 * tall, 3.0, leaf.map((v) => v * 1.04) as [number, number, number], 41, 1);
            break;
        }
    }
    return g.toGeometry();
}

/** An instanced set whose instances are kept as built and written to the GPU buffer only for drawn chunks. */
export class ChunkedSet {
    readonly mesh: InstancedMesh;
    private matrices: Float32Array;
    private colours: Float32Array | null;
    private chunks: Uint16Array;
    private visible: Uint8Array;
    private count = 0;
    private drawn: ((chunk: number) => boolean) | null = null;

    constructor(geometry: BufferGeometry, material: Material, readonly capacity: number, coloured = false) {
        this.mesh = new InstancedMesh(geometry, material, Math.max(capacity, 1));
        this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        this.matrices = new Float32Array(Math.max(capacity, 1) * 16);
        this.colours = coloured ? new Float32Array(Math.max(capacity, 1) * 3) : null;
        if (coloured) this.mesh.setColorAt(0, new Color(1, 1, 1));
        this.chunks = new Uint16Array(Math.max(capacity, 1));
        this.visible = new Uint8Array(Math.max(capacity, 1));
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
    }

    /** Sets instance `i`: its matrix (and colour), whether it shows at all now (a car parked, a bin out). */
    set(i: number, matrix: Matrix4, show = true, colour?: Color) {
        matrix.toArray(this.matrices, i * 16);
        this.chunks[i] = townChunkOf(this.matrices[i * 16 + 12], this.matrices[i * 16 + 14]);
        this.visible[i] = show ? 1 : 0;
        if (colour && this.colours) colour.toArray(this.colours, i * 3);
        this.count = Math.max(this.count, i + 1);
    }

    setShown(i: number, show: boolean) {
        this.visible[i] = show ? 1 : 0;
    }

    setDrawn(drawn: ((chunk: number) => boolean) | null) {
        this.drawn = drawn;
        this.write();
    }

    /** Writes the shown instances in drawn chunks to the GPU buffer, in their built order. */
    write() {
        const out = this.mesh.instanceMatrix.array as Float32Array;
        const colourOut = this.mesh.instanceColor ? (this.mesh.instanceColor.array as Float32Array) : null;
        let n = 0;
        for (let i = 0; i < this.count; i++) {
            if (!this.visible[i]) continue;
            if (this.drawn && !this.drawn(this.chunks[i])) continue;
            out.set(this.matrices.subarray(i * 16, i * 16 + 16), n * 16);
            if (colourOut && this.colours) colourOut.set(this.colours.subarray(i * 3, i * 3 + 3), n * 3);
            n++;
        }
        this.mesh.count = n;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    get shown(): number {
        return this.mesh.count;
    }

    dispose() {
        this.mesh.geometry.dispose();
        this.mesh.dispose();
    }
}

const m = new Matrix4();
const q = new Quaternion();
const up = new Vector3(0, 1, 0);
const v = new Vector3();
const s = new Vector3();

export function placeMatrix(x: number, y: number, z: number, turn: number, scale = 1, out = m): Matrix4 {
    q.setFromAxisAngle(up, turn);
    v.set(x, y, z);
    s.set(scale, scale, scale);
    return out.compose(v, q, s);
}

// MARK: - Props implied people move

export function carGeometry(): BufferGeometry {
    const g = new Geo();
    const f: Frame = {x: 0, y: 0, z: 0, rot: 0};
    const body = tone("#ffffff");
    g.box(f, 0, 0.3, 0, 1.75, 0.65, 4.2, body);
    g.box(f, 0, 0.95, -0.25, 1.6, 0.55, 2.2, body.map((c) => c * 0.96) as [number, number, number]);
    // Windows (dark) on the cabin's faces: drawn as a slightly bigger dark band.
    g.box(f, 0, 1.0, -0.25, 1.62, 0.42, 2.0, tone("#2a3036").map((c) => c * 1) as [number, number, number]);
    g.box(f, 0, 1.43, -0.25, 1.5, 0.08, 2.0, body);
    for (const [lx, lz] of [[-0.8, 1.35], [0.8, 1.35], [-0.8, -1.35], [0.8, -1.35]] as const) g.box(f, lx, 0, lz, 0.25, 0.62, 0.62, tone("#1c1c1c"));
    // Lights.
    g.box(f, 0, 0.55, 2.1, 1.4, 0.16, 0.04, tone("#efeadc"));
    g.box(f, 0, 0.6, -2.1, 1.4, 0.14, 0.04, tone("#8a1a1a"));
    return g.toGeometry();
}

export function binGeometry(): BufferGeometry {
    const g = new Geo();
    const f: Frame = {x: 0, y: 0, z: 0, rot: 0};
    g.box(f, 0, 0.05, 0, 0.58, 0.95, 0.72, tone("#ffffff"));
    g.box(f, 0, 1.0, -0.02, 0.62, 0.07, 0.78, tone("#ffffff").map((c) => c * 0.85) as [number, number, number]);
    for (const lx of [-0.24, 0.24]) g.box(f, lx, 0, -0.32, 0.06, 0.18, 0.18, tone("#1c1c1c"));
    return g.toGeometry();
}

export function washingGeometry(): BufferGeometry {
    const g = new Geo();
    const f: Frame = {x: 0, y: 0, z: 0, rot: 0};
    for (const lx of [-2.2, 2.2]) g.box(f, lx, 0, 0, 0.07, 1.9, 0.07, tone("#c8c4bc"));
    g.box(f, 0, 1.82, 0, 4.4, 0.02, 0.02, tone("#e8e4dc"));
    const cloth = ["#f2f0ea", "#6a8ac0", "#d86a5a", "#f0d27a", "#8ac08a", "#ffffff"];
    for (let k = 0; k < 6; k++) g.box(f, -1.8 + k * 0.72, 1.2 - (k % 2) * 0.15, 0, 0.55, 0.6 + (k % 2) * 0.15, 0.02, tone(cloth[k]));
    return g.toGeometry();
}

export function boatGeometry(): BufferGeometry {
    const g = new Geo();
    const f: Frame = {x: 0, y: 0, z: 0, rot: 0};
    const hull = tone("#ffffff");
    g.box(f, 0, -0.5, 0, 2.2, 1.0, 7.0, hull);
    g.pyramid({x: 0, y: -0.5, z: 3.5, rot: 0}, 0, 0, 0, 1.5, 0.9, hull);
    g.box(f, 0, 0.5, -0.6, 1.8, 1.4, 2.6, tone("#f2efe6"));
    g.box(f, 0, 1.9, -0.6, 2.0, 0.1, 2.8, tone("#3a4a5a"));
    g.box(f, 0, 0.44, 0, 2.26, 0.12, 7.04, tone("#2a2a2a"));
    g.cylinder(f, 0, 1.9, -1.2, 0.06, 0.05, 3.2, tone("#c8c4bc"), 5);
    return g.toGeometry();
}

export function stallGeometry(): BufferGeometry {
    const g = new Geo();
    const f: Frame = {x: 0, y: 0, z: 0, rot: 0};
    g.box(f, 0, 0.8, 0, 2.8, 0.1, 1.4, tone("#c8b490"));
    for (const [lx, lz] of [[-1.35, -0.65], [1.35, -0.65], [-1.35, 0.65], [1.35, 0.65]] as const) g.box(f, lx, 0, lz, 0.07, 2.3, 0.07, tone("#5a4a3a"));
    // A striped canopy (the instance colour tints the stripes).
    for (let k = 0; k < 4; k++) g.box(f, -1.05 + k * 0.7, 2.3, 0, 0.7, 0.08, 1.8, k % 2 ? tone("#ffffff") : tone("#f4f0e6"));
    g.box(f, 0, 0.9, 0, 2.4, 0.3, 1.0, tone("#d89a4a"));
    return g.toGeometry();
}

export function lampGeometry(): {post: BufferGeometry; head: BufferGeometry} {
    const g = new Geo();
    const f: Frame = {x: 0, y: 0, z: 0, rot: 0};
    g.cylinder(f, 0, 0, 0, 0.09, 0.06, 4.2, tone("#2b2e31"), 6);
    g.box(f, 0, 4.15, 0.25, 0.08, 0.08, 0.6, tone("#2b2e31"));
    g.box(f, 0, 4.25, 0.55, 0.42, 0.12, 0.42, tone("#2b2e31"));
    const h = new Geo();
    h.box(f, 0, 3.98, 0.55, 0.3, 0.27, 0.3, tone("#fff2c8"));
    return {post: g.toGeometry(), head: h.toGeometry()};
}

export function propMaterial(): MeshStandardMaterial {
    return new MeshStandardMaterial({vertexColors: true, roughness: 0.6, metalness: 0.1});
}
