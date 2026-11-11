/**
 * Close-up detail (graphics pass, batch 2): what appears only round the
 * camera when it comes close, so the far view stays cheap. Pebbles and shells
 * on the beach, a strandline of seaweed, fallen leaves, twigs, pinecones,
 * ferns and mushrooms on the forest floor, clover and small rosettes in the
 * grass, scree under the rocks.
 *
 * Deterministic: each 2 m cell of ground is filled from its own seed and the
 * ground it is (`sampler.ts` surfaces), so everyone sees the same pebble in
 * the same place. Cells are built a few per frame as the view moves and kept
 * in a small cache.
 */

import {
    BufferAttribute,
    BufferGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    DoubleSide,
    DynamicDrawUsage,
    Group,
    IcosahedronGeometry,
    InstancedMesh,
    Matrix4,
    MeshStandardMaterial,
    Quaternion,
    Vector3
} from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {sampleGround, seeded, zoneAt} from "@/ark-scene/world";

type DetailKind = "pebble" | "shell" | "seaweed" | "leaf" | "twig" | "pinecone" | "fern" | "mushroom" | "clover";
const KINDS: DetailKind[] = ["pebble", "shell", "seaweed", "leaf", "twig", "pinecone", "fern", "mushroom", "clover"];

type Item = {kind: DetailKind; x: number; y: number; z: number; yaw: number; tilt: number; scale: number; colour: number};

const CELL = 2;
/** Detail out to this far from what the camera looks at, and only while the camera is this close. */
const RADIUS = 16;
const SHOW_WITHIN = 42;
const CAP: Record<DetailKind, number> = {pebble: 2600, shell: 700, seaweed: 600, leaf: 3600, twig: 900, pinecone: 500, fern: 700, mushroom: 400, clover: 2600};

function colourGeometry(geometry: BufferGeometry, shade: (x: number, y: number, z: number) => number): BufferGeometry {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat.getAttribute("uv")) flat.deleteAttribute("uv");
    flat.computeVertexNormals();
    const position = flat.getAttribute("position");
    const colours = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
        const v = shade(position.getX(i), position.getY(i), position.getZ(i));
        colours[i * 3] = colours[i * 3 + 1] = colours[i * 3 + 2] = v;
    }
    flat.setAttribute("color", new BufferAttribute(colours, 3));
    return flat;
}

function flatLeaf(length: number, width: number, steps = 5): BufferGeometry {
    const points: number[] = [];
    for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 1) / steps;
        const w0 = width * Math.sin(Math.PI * t0);
        const w1 = width * Math.sin(Math.PI * t1);
        const z0 = t0 * length;
        const z1 = t1 * length;
        const c0 = 0.15 * w0;
        const c1 = 0.15 * w1;
        points.push(0, 0, z0, w0, c0, z0, w1, c1, z1, 0, 0, z0, w1, c1, z1, 0, 0, z1);
        points.push(0, 0, z0, 0, 0, z1, -w1, c1, z1, 0, 0, z0, -w1, c1, z1, -w0, c0, z0);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    return geometry;
}

function shapes(): Record<DetailKind, BufferGeometry> {
    const pebble = new IcosahedronGeometry(0.05, 1);
    pebble.scale(1.2, 0.55, 0.9);
    pebble.translate(0, 0.012, 0);
    // A scallop: a fan of ribs, cupped.
    const shell = new BufferGeometry();
    const fan: number[] = [];
    const ribs = 9;
    for (let i = 0; i < ribs; i++) {
        const a0 = Math.PI * (0.1 + 0.8 * i / ribs);
        const a1 = Math.PI * (0.1 + 0.8 * (i + 1) / ribs);
        const r = 0.035;
        fan.push(0, 0.004, 0, Math.cos(a0) * r, 0.012, Math.sin(a0) * r, Math.cos(a1) * r, 0.012, Math.sin(a1) * r);
    }
    shell.setAttribute("position", new BufferAttribute(new Float32Array(fan), 3));
    const seaweed = flatLeaf(0.42, 0.035, 6);
    const leaf = flatLeaf(0.09, 0.035, 4);
    leaf.translate(0, 0.004, -0.045);
    const twig = new CylinderGeometry(0.008, 0.012, 0.36, 4, 1);
    twig.rotateZ(Math.PI / 2);
    twig.translate(0, 0.01, 0);
    const pinecone = new ConeGeometry(0.03, 0.08, 6, 2);
    pinecone.rotateZ(Math.PI / 2.2);
    pinecone.translate(0, 0.03, 0);
    const fronds: BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
        const frond = flatLeaf(0.42, 0.06, 6);
        // Arching up and out.
        const position = frond.getAttribute("position");
        for (let k = 0; k < position.count; k++) {
            const z = position.getZ(k);
            position.setY(k, position.getY(k) + Math.sin(z / 0.42 * Math.PI * 0.8) * 0.18);
        }
        frond.rotateY(i / 6 * Math.PI * 2 + 0.3);
        fronds.push(frond);
    }
    const fern = mergeGeometries(fronds)!;
    const stem = new CylinderGeometry(0.012, 0.016, 0.07, 6, 1);
    stem.translate(0, 0.035, 0);
    const cap = new IcosahedronGeometry(0.04, 1);
    cap.scale(1, 0.5, 1);
    cap.translate(0, 0.075, 0);
    stem.deleteAttribute("uv");
    stem.deleteAttribute("normal");
    cap.deleteAttribute("uv");
    cap.deleteAttribute("normal");
    const mushroom = mergeGeometries([stem.toNonIndexed(), cap.toNonIndexed()])!;
    const clovers: BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
        const lobe = flatLeaf(0.035, 0.02, 3);
        lobe.translate(0, 0.03, 0);
        lobe.rotateY(i / 3 * Math.PI * 2);
        clovers.push(lobe);
    }
    const clover = mergeGeometries(clovers)!;
    return {
        pebble: colourGeometry(pebble, (_, y) => 0.8 + 3 * y),
        shell: colourGeometry(shell, (x, _, z) => 0.82 + 0.18 * Math.abs(Math.sin(Math.atan2(z, x) * 9))),
        seaweed: colourGeometry(seaweed, () => 1),
        leaf: colourGeometry(leaf, () => 1),
        twig: colourGeometry(twig, () => 1),
        pinecone: colourGeometry(pinecone, (x) => 0.75 + 4 * Math.abs(x)),
        fern: colourGeometry(fern, (_, y) => 0.7 + 1.6 * y),
        mushroom: colourGeometry(mushroom, (_, y) => (y > 0.06 ? 1.0 : 0.95)),
        clover: colourGeometry(clover, () => 1)
    };
}

const TINTS: Record<DetailKind, string[]> = {
    pebble: ["#bdb4a3", "#9c968c", "#7f7a72", "#d8cfbd", "#a89676", "#e6e0d2"],
    shell: ["#f1e6d3", "#e8cbb8", "#f4ede2", "#d9b8a0"],
    seaweed: ["#3e4a24", "#4b3f22", "#2f3b1f"],
    leaf: ["#8a5a2b", "#a8742f", "#6e4a26", "#9b8a3a", "#b0612a"],
    twig: ["#5e4a36", "#6d5841", "#4a3b2c"],
    pinecone: ["#6b4a2c", "#7a5634"],
    fern: ["#4f7d33", "#5b8a3a", "#45702c"],
    mushroom: ["#c7a27a", "#b8452f", "#e9dcc4", "#9a6a43"],
    clover: ["#5d8f3a", "#6c9c42", "#4f7f32"]
};

/** What a cell grows, from its ground: expected items per m². */
function densities(x: number, z: number): {height: number; per: Partial<Record<DetailKind, number>>} {
    const s = sampleGround(x, z);
    const zone = zoneAt(s);
    const h = s.height;
    const per: Partial<Record<DetailKind, number>> = {};
    if (h < -0.6) return {height: h, per};
    const beach = (1 - Math.min(Math.max((s.land - 0.45) / 0.55, 0), 1)) * (1 - s.cliff);
    const forest = (s.weights.rainforest ?? 0) + (s.weights.woodland ?? 0) + (s.weights.mountains ?? 0) * 0.4;
    const grass = 1 - beach - forest;
    if (beach > 0.3) {
        per.pebble = 0.9 * beach;
        per.shell = h > -0.1 ? 0.1 * beach : 0;
        // The strandline: the high-water mark.
        per.seaweed = h > 0.35 && h < 0.7 ? 0.9 * beach : 0;
    }
    if (forest > 0.3 && h > 0.4) {
        per.leaf = 6 * forest;
        per.twig = 0.5 * forest;
        per.pinecone = zone === "woodland" || zone === "mountains" ? 0.35 * forest : 0;
        per.fern = 0.35 * forest;
        per.mushroom = 0.12 * forest;
    }
    if (grass > 0.3 && h > 0.5) {
        per.clover = 1.6 * grass;
        per.pebble = (per.pebble ?? 0) + 0.12;
        per.leaf = (per.leaf ?? 0) + 0.15;
    }
    if (zone === "desert" || zone === "mountains" || zone === "polar") per.pebble = (per.pebble ?? 0) + 0.8;
    return {height: h, per};
}

function buildCell(cx: number, cz: number, share: number): Item[] {
    const random = seeded(((cx * 73856093) ^ (cz * 19349663)) >>> 0);
    const {per} = densities(cx * CELL + CELL / 2, cz * CELL + CELL / 2);
    const items: Item[] = [];
    for (const kind of KINDS) {
        const expected = (per[kind] ?? 0) * CELL * CELL * share;
        let count = Math.floor(expected) + (random() < expected - Math.floor(expected) ? 1 : 0);
        // Clumps: ferns, mushrooms and clover come in little groups round one spot.
        const clump = kind === "fern" || kind === "mushroom" || kind === "clover";
        const ox = random() * CELL;
        const oz = random() * CELL;
        while (count-- > 0) {
            const x = cx * CELL + (clump ? ox + (random() - 0.5) * 0.9 : random() * CELL);
            const z = cz * CELL + (clump ? oz + (random() - 0.5) * 0.9 : random() * CELL);
            const y = sampleGround(x, z).height;
            if (kind !== "pebble" && kind !== "shell" && y < -0.02) continue;
            const tints = TINTS[kind];
            items.push({kind, x, y, z, yaw: random() * Math.PI * 2, tilt: (random() - 0.5) * 0.4, scale: kind === "pebble" ? 0.4 + random() ** 2 * 2.4 : 0.7 + random() * 0.6, colour: Math.floor(random() * tints.length)});
        }
    }
    return items;
}

export class NearDetail {
    readonly group = new Group();
    private readonly meshes = new Map<DetailKind, InstancedMesh>();
    private readonly cells = new Map<string, Item[]>();
    private readonly wanted: Array<[number, number]> = [];
    private lastCell = "";
    private share = 1;
    private readonly matrix = new Matrix4();
    private readonly rotation = new Quaternion();
    private readonly position = new Vector3();
    private readonly size = new Vector3();
    private readonly axis = new Vector3();
    private readonly tilt = new Quaternion();
    private readonly colour = new Color();
    private dirty = false;

    constructor() {
        const geometry = shapes();
        const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.85, side: DoubleSide});
        for (const kind of KINDS) {
            const mesh = new InstancedMesh(geometry[kind], material, CAP[kind]);
            mesh.instanceMatrix.setUsage(DynamicDrawUsage);
            mesh.count = 0;
            mesh.frustumCulled = false;
            mesh.receiveShadow = true;
            mesh.castShadow = kind === "fern" || kind === "mushroom";
            this.meshes.set(kind, mesh);
            this.group.add(mesh);
        }
    }

    /** The tier's share of the detail: 1 high, 0.6 medium, 0.35 low. Changing it rebuilds the cells. */
    setShare(share: number) {
        if (share === this.share) return;
        this.share = share;
        this.cells.clear();
        this.lastCell = "";
    }

    /** Call each frame with what the camera looks at and how far it is. */
    update(target: {x: number; z: number}, viewDistance: number) {
        const show = viewDistance < SHOW_WITHIN && this.share > 0;
        this.group.visible = show;
        if (!show) return;
        const cx = Math.floor(target.x / CELL);
        const cz = Math.floor(target.z / CELL);
        const key = `${cx},${cz}`;
        if (key !== this.lastCell) {
            this.lastCell = key;
            const reach = Math.ceil(RADIUS / CELL);
            this.wanted.length = 0;
            for (let dz = -reach; dz <= reach; dz++) {
                for (let dx = -reach; dx <= reach; dx++) {
                    if (dx * dx + dz * dz > reach * reach) continue;
                    this.wanted.push([cx + dx, cz + dz]);
                }
            }
            // Nearest first.
            this.wanted.sort((a, b) => (a[0] - cx) ** 2 + (a[1] - cz) ** 2 - ((b[0] - cx) ** 2 + (b[1] - cz) ** 2));
            Array.from(this.cells.keys()).forEach((cell) => {
                const [x, z] = cell.split(",").map(Number);
                if ((x - cx) ** 2 + (z - cz) ** 2 > (reach + 2) ** 2) this.cells.delete(cell);
            });
            this.dirty = true;
        }
        // A few new cells per frame, so moving never stalls a frame.
        let built = 0;
        for (const [x, z] of this.wanted) {
            const cell = `${x},${z}`;
            if (this.cells.has(cell)) continue;
            this.cells.set(cell, buildCell(x, z, this.share));
            this.dirty = true;
            if (++built >= 10) break;
        }
        if (this.dirty) this.write(cx, cz);
    }

    private write(cx: number, cz: number) {
        this.dirty = false;
        const counts = new Map<DetailKind, number>();
        const reach2 = (Math.ceil(RADIUS / CELL) + 0.5) ** 2;
        this.cells.forEach((items, cell) => {
            const [x, z] = cell.split(",").map(Number);
            if ((x - cx) ** 2 + (z - cz) ** 2 > reach2) return;
            for (const item of items) {
                const mesh = this.meshes.get(item.kind)!;
                const n = counts.get(item.kind) ?? 0;
                if (n >= CAP[item.kind]) continue;
                this.rotation.setFromAxisAngle(this.axis.set(0, 1, 0), item.yaw);
                this.tilt.setFromAxisAngle(this.axis.set(1, 0, 0), item.tilt * (item.kind === "fern" || item.kind === "mushroom" ? 0.3 : 1));
                this.rotation.multiply(this.tilt);
                this.matrix.compose(this.position.set(item.x, item.y, item.z), this.rotation, this.size.setScalar(item.scale));
                mesh.setMatrixAt(n, this.matrix);
                mesh.setColorAt(n, this.colour.set(TINTS[item.kind][item.colour]));
                counts.set(item.kind, n + 1);
            }
        });
        this.meshes.forEach((mesh, kind) => {
            mesh.count = counts.get(kind) ?? 0;
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        });
    }

    dispose() {
        this.meshes.forEach((mesh) => {
            mesh.geometry.dispose();
            mesh.dispose();
        });
    }
}
