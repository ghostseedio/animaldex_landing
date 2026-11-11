/**
 * Close-up detail (graphics pass, batch 2): what appears only round the
 * camera when it comes close, so the far view stays cheap. Pebbles and shells
 * on the beach, a strandline of seaweed, fallen leaves, twigs, pinecones,
 * ferns and mushrooms on the forest floor, clover and small rosettes in the
 * grass, scree under the rocks. Batch 4: the crops of Home's fields on their
 * rows (`fields.ts`, the same rows the ground paints): sprouts, cabbages,
 * wheat and maize.
 *
 * Deterministic: each 2 m cell of ground is filled from its own seed and the
 * ground it is (`sampler.ts` surfaces), so everyone sees the same pebble in
 * the same place. Cells are built a few per frame as the view moves and kept
 * in a small cache.
 */

import {
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    Color,
    SRGBColorSpace,
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
import {sampleGround, seeded, smoothstep, zoneAt, ZONE_SITES} from "@/ark-scene/world";
import {fieldRipe, snapToRow, type Crop} from "@/ark-scene/fields";
import {setNearFade} from "@/ark-scene/near-fade";

type DetailKind = "pebble" | "shell" | "seaweed" | "leaf" | "twig" | "pinecone" | "fern" | "mushroom" | "clover" | "sprout" | "cabbage" | "wheat" | "maize" | "wheatband" | "litter" | "needles" | "sapling";
/** The kinds built per cell round the camera (the wheat stands are built once for the whole farm: `wheatStands`). */
const KINDS: DetailKind[] = ["pebble", "shell", "seaweed", "leaf", "twig", "pinecone", "fern", "mushroom", "clover", "sprout", "cabbage", "wheat", "maize", "litter", "needles", "sapling"];

/** The plant each crop grows, and how many stand per m² of its field. Ploughed ground grows none. */
const CROP_PLANTS: Partial<Record<Crop, {kind: DetailKind; perM2: number}>> = {
    sprouts: {kind: "sprout", perM2: 5},
    cabbage: {kind: "cabbage", perM2: 3.2},
    cereal: {kind: "wheat", perM2: 6.5},
    maize: {kind: "maize", perM2: 2.8}
};

/** `up`: lie along the ground's own slope (the litter mats), instead of standing upright with a small tilt. */
type Item = {kind: DetailKind; x: number; y: number; z: number; yaw: number; tilt: number; scale: number; colour: number; up?: [number, number, number]};

const CELL = 2;
/** The farm's wheat stands show while the camera is this close to what it looks at. */
const STANDS_WITHIN = 140;
/** Detail out to this far from what the camera looks at, and only while the camera is this close. */
const RADIUS = 16;
const SHOW_WITHIN = 42;
const CAP: Record<DetailKind, number> = {pebble: 2600, shell: 700, seaweed: 600, leaf: 3600, twig: 900, pinecone: 500, fern: 700, mushroom: 400, clover: 2600, sprout: 2400, cabbage: 1800, wheat: 1600, maize: 1400, wheatband: 2600, litter: 1800, needles: 2400, sapling: 300};

/**
 * The forest floor's litter (batch 5), painted once in code (no third-party art): fallen leaves in browns, rusts and
 * yellows with their midribs, a few twigs and needles, thinning to clear at the edge so a mat never shows a corner.
 */
let litterTexture: CanvasTexture | null = null;
function litterMapTexture(): CanvasTexture | null {
    if (litterTexture) return litterTexture;
    if (typeof document === "undefined") return null;
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const g = canvas.getContext("2d");
    if (!g) return null;
    const random = seeded(8086);
    g.clearRect(0, 0, size, size);
    const tones = [[122, 78, 40], [150, 96, 44], [104, 70, 42], [168, 120, 52], [96, 84, 46], [140, 62, 34], [118, 104, 58]];
    const inside = () => {
        const a = random() * Math.PI * 2;
        const r = Math.sqrt(random()) * 112;
        return [128 + Math.cos(a) * r, 128 + Math.sin(a) * r];
    };
    // Needles and twigs under the leaves.
    for (let i = 0; i < 90; i++) {
        const [x, y] = inside();
        const a = random() * Math.PI;
        const l = 6 + random() * 9;
        g.strokeStyle = `rgb(${110 + random() * 40},${70 + random() * 25},${36 + random() * 15})`;
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
    }
    for (let i = 0; i < 8; i++) {
        const [x, y] = inside();
        const a = random() * Math.PI;
        const l = 25 + random() * 35;
        g.strokeStyle = "rgb(78,62,46)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
    }
    for (let i = 0; i < 95; i++) {
        const [x, y] = inside();
        const [r, gg, b] = tones[Math.floor(random() * tones.length)];
        const shade = 0.8 + 0.35 * random();
        const l = 7 + random() * 8;
        g.save();
        g.translate(x, y);
        g.rotate(random() * Math.PI * 2);
        g.fillStyle = `rgb(${Math.round(r * shade)},${Math.round(gg * shade)},${Math.round(b * shade)})`;
        g.beginPath();
        g.ellipse(0, 0, l, l * (0.38 + 0.2 * random()), 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "rgba(40,28,18,0.45)";
        g.lineWidth = 0.7;
        g.beginPath();
        g.moveTo(-l, 0);
        g.lineTo(l, 0);
        g.stroke();
        g.restore();
    }
    litterTexture = new CanvasTexture(canvas);
    litterTexture.colorSpace = SRGBColorSpace;
    litterTexture.anisotropy = 4;
    return litterTexture;
}

/** A flat litter mat, 0.9 m across, lit as ground (normal up). */
function litterGeometry(): BufferGeometry {
    const h = 0.45;
    const positions = new Float32Array([-h, 0.012, -h, h, 0.012, h, h, 0.012, -h, -h, 0.012, -h, -h, 0.012, h, h, 0.012, h]);
    const uvs = new Float32Array([0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setAttribute("normal", new BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(18).fill(1), 3));
    return geometry;
}

/**
 * Standing wheat as a mass (batch 5): a strip of a field's stalks and ears, painted once in code (no third-party art):
 * dense stems, golden ears leaning a little, darker and denser low down. Neutral light tones; the instance tints it ripe
 * or green.
 */
let wheatTexture: CanvasTexture | null = null;
function wheatBandTexture(): CanvasTexture | null {
    if (wheatTexture) return wheatTexture;
    if (typeof document === "undefined") return null;
    const width = 256;
    const height = 128;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d");
    if (!g) return null;
    const random = seeded(31337);
    g.clearRect(0, 0, width, height);
    // The mass low down: a dense, darker band of stems.
    for (let i = 0; i < 260; i++) {
        const x = random() * width;
        const top = height * (0.35 + 0.35 * random());
        const tone = Math.round(120 + 60 * random());
        g.strokeStyle = `rgb(${tone},${Math.round(tone * 0.95)},${Math.round(tone * 0.7)})`;
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x, height);
        g.lineTo(x + 6 * random(), top);
        g.stroke();
    }
    // Stalks to the ears, back (darker) to front (lighter), all leaning the same way a little.
    for (let i = 0; i < 150; i++) {
        const front = i / 150;
        const x = random() * width;
        const lean = 5 + 9 * random();
        const top = height * (0.05 + 0.18 * random());
        const tone = Math.round(150 + 80 * front + 20 * random());
        g.strokeStyle = `rgb(${tone},${Math.round(tone * 0.93)},${Math.round(tone * 0.66)})`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, height);
        g.quadraticCurveTo(x + lean * 0.3, height * 0.5, x + lean, top + 12);
        g.stroke();
        // The ear: a plump grain head along the stalk's end, with whiskers.
        g.save();
        g.translate(x + lean, top + 6);
        g.rotate(0.18 + 0.12 * random());
        g.fillStyle = `rgb(${Math.min(255, tone + 30)},${Math.round((tone + 30) * 0.88)},${Math.round((tone + 30) * 0.58)})`;
        g.beginPath();
        g.ellipse(0, 0, 2.6, 8, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = `rgba(${tone},${Math.round(tone * 0.9)},${Math.round(tone * 0.6)},0.7)`;
        g.lineWidth = 0.6;
        for (let k = -2; k <= 2; k++) {
            g.beginPath();
            g.moveTo(k * 0.8, -6);
            g.lineTo(k * 2.2, -16);
            g.stroke();
        }
        g.restore();
    }
    wheatTexture = new CanvasTexture(canvas);
    wheatTexture.colorSpace = SRGBColorSpace;
    wheatTexture.anisotropy = 4;
    return wheatTexture;
}

/** Two crossed upright cards 1 m long, 0.72 m tall, leaning a little; lit from above like a crop's top (not their faces). */
function wheatBandGeometry(): BufferGeometry {
    const positions: number[] = [];
    const uvs: number[] = [];
    const h = 0.72;
    const lean = 0.09;
    for (const turn of [0.33, -0.33]) {
        const c = Math.cos(turn);
        const s = Math.sin(turn);
        const corner = (u: number, v: number) => {
            const x = (u - 0.5) * 1.0;
            const y = v * h;
            const z = v * lean;
            positions.push(x * c + z * s, y, -x * s + z * c);
            uvs.push(u, v);
        };
        corner(0, 0); corner(1, 0); corner(1, 1);
        corner(0, 0); corner(1, 1); corner(0, 1);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
    const count = positions.length / 3;
    const normals = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        normals[i * 3 + 1] = 1;
        // Darker low in the stand, where the light does not reach.
        const v = uvs[i * 2 + 1];
        colours[i * 3] = colours[i * 3 + 1] = colours[i * 3 + 2] = 0.6 + 0.45 * v;
    }
    geometry.setAttribute("normal", new BufferAttribute(normals, 3));
    geometry.setAttribute("color", new BufferAttribute(colours, 3));
    return geometry;
}

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

/** A fallen cluster of pine needles: thin slivers in a loose star (batch 5). */
function needleCluster(): BufferGeometry {
    const random = seeded(4411);
    const points: number[] = [];
    for (let i = 0; i < 14; i++) {
        const a = random() * Math.PI * 2;
        const l = 0.05 + random() * 0.04;
        const ox = (random() - 0.5) * 0.04;
        const oz = (random() - 0.5) * 0.04;
        const w = 0.0025;
        const dx = Math.cos(a);
        const dz = Math.sin(a);
        points.push(ox - dz * w, 0.004, oz + dx * w, ox + dz * w, 0.004, oz - dx * w, ox + dx * l, 0.006 + random() * 0.006, oz + dz * l);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    return geometry;
}

/** A sapling of the understorey: a thin stem, a few leaves high on it (batch 5). */
function sapling(): BufferGeometry {
    const stem = new CylinderGeometry(0.006, 0.012, 0.75, 4, 1);
    stem.translate(0, 0.375, 0);
    stem.deleteAttribute("uv");
    stem.deleteAttribute("normal");
    const parts: BufferGeometry[] = [stem.toNonIndexed()];
    for (let i = 0; i < 7; i++) {
        const leaf = flatLeaf(0.11, 0.045, 3);
        leaf.rotateX(-0.35);
        leaf.rotateY(i * 2.39);
        leaf.translate(0, 0.38 + i * 0.055, 0);
        parts.push(leaf);
    }
    return mergeGeometries(parts)!;
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
    // Crops (batch 4).
    const sproutLeaves: BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
        const leaf = flatLeaf(0.08, 0.026, 3);
        leaf.rotateX(-0.75);
        leaf.rotateY(i * Math.PI / 2 + 0.4);
        sproutLeaves.push(leaf);
    }
    const sprout = mergeGeometries(sproutLeaves)!;
    const ball = new IcosahedronGeometry(0.1, 1);
    ball.scale(1, 0.82, 1);
    ball.translate(0, 0.095, 0);
    ball.deleteAttribute("uv");
    ball.deleteAttribute("normal");
    const wraps: BufferGeometry[] = [ball.toNonIndexed()];
    for (let i = 0; i < 6; i++) {
        const leaf = flatLeaf(0.17, 0.09, 4);
        leaf.rotateX(-0.45);
        leaf.rotateY(i / 6 * Math.PI * 2);
        leaf.translate(0, 0.015, 0);
        wraps.push(leaf);
    }
    const cabbage = mergeGeometries(wraps)!;
    // A tuft of wheat: thin stems leaning a little, each with its ear.
    const stems: number[] = [];
    const stemRandom = seeded(9090);
    for (let i = 0; i < 14; i++) {
        const a = stemRandom() * Math.PI * 2;
        const r = 0.05 * Math.sqrt(stemRandom());
        const bx = Math.cos(a) * r;
        const bz = Math.sin(a) * r;
        const h = 0.62 + stemRandom() * 0.2;
        const tx = bx * 2.2 + (stemRandom() - 0.5) * 0.05;
        const tz = bz * 2.2 + (stemRandom() - 0.5) * 0.05;
        const w = 0.004;
        const side = {x: -Math.sin(a) * w, z: Math.cos(a) * w};
        stems.push(bx - side.x, 0, bz - side.z, bx + side.x, 0, bz + side.z, tx, h, tz);
        // The ear: a narrow diamond along the stem's top.
        const e = 0.008;
        const ex = {x: -Math.sin(a) * e, z: Math.cos(a) * e};
        const mid = {x: tx, y: h + 0.035, z: tz};
        stems.push(tx, h - 0.005, tz, mid.x + ex.x, mid.y, mid.z + ex.z, tx, h + 0.075, tz);
        stems.push(tx, h - 0.005, tz, tx, h + 0.075, tz, mid.x - ex.x, mid.y, mid.z - ex.z);
    }
    const wheat = new BufferGeometry();
    wheat.setAttribute("position", new BufferAttribute(new Float32Array(stems), 3));
    // Maize: a stalk, long arching leaves up it, a tassel on top.
    const stalk = new CylinderGeometry(0.012, 0.022, 1.7, 5, 1);
    stalk.translate(0, 0.85, 0);
    stalk.deleteAttribute("uv");
    stalk.deleteAttribute("normal");
    const tassel = new ConeGeometry(0.03, 0.18, 4, 1);
    tassel.translate(0, 1.78, 0);
    tassel.deleteAttribute("uv");
    tassel.deleteAttribute("normal");
    const maizeParts: BufferGeometry[] = [stalk.toNonIndexed(), tassel.toNonIndexed()];
    for (let i = 0; i < 7; i++) {
        const leaf = flatLeaf(0.6, 0.045, 5);
        const position = leaf.getAttribute("position");
        for (let k = 0; k < position.count; k++) {
            const z = position.getZ(k);
            position.setY(k, position.getY(k) + Math.sin(z / 0.6 * Math.PI * 0.75) * 0.22 - (z / 0.6) ** 2 * 0.12);
        }
        leaf.rotateY(i * 2.4);
        leaf.translate(0, 0.25 + i * 0.17, 0);
        maizeParts.push(leaf);
    }
    const maize = mergeGeometries(maizeParts)!;
    return {
        pebble: colourGeometry(pebble, (_, y) => 0.8 + 3 * y),
        shell: colourGeometry(shell, (x, _, z) => 0.82 + 0.18 * Math.abs(Math.sin(Math.atan2(z, x) * 9))),
        seaweed: colourGeometry(seaweed, () => 1),
        leaf: colourGeometry(leaf, () => 1),
        twig: colourGeometry(twig, () => 1),
        pinecone: colourGeometry(pinecone, (x) => 0.75 + 4 * Math.abs(x)),
        fern: colourGeometry(fern, (_, y) => 0.7 + 1.6 * y),
        mushroom: colourGeometry(mushroom, (_, y) => (y > 0.06 ? 1.0 : 0.95)),
        clover: colourGeometry(clover, () => 1),
        sprout: colourGeometry(sprout, () => 1),
        cabbage: colourGeometry(cabbage, (_, y) => (y > 0.05 ? 1.08 : 0.92)),
        wheat: colourGeometry(wheat, (_, y) => 0.85 + 0.3 * Math.min(y / 0.75, 1)),
        maize: colourGeometry(maize, (_, y) => 0.8 + 0.15 * Math.min(y / 1.7, 1)),
        wheatband: wheatBandGeometry(),
        litter: litterGeometry(),
        needles: colourGeometry(needleCluster(), () => 1),
        sapling: colourGeometry(sapling(), (_, y) => (y > 0.3 ? 1.05 : 0.7))
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
    clover: ["#5d8f3a", "#6c9c42", "#4f7f32"],
    sprout: ["#5f9136", "#6b9a3c", "#558632"],
    cabbage: ["#6f9466", "#7a9e70", "#628a5c"],
    // Ripe first, then still green (fieldRipe picks the pair).
    wheat: ["#d2b468", "#c4a75c", "#a6a85c", "#97a052"],
    maize: ["#4f7d2e", "#5a8834", "#46722a"],
    // Ripe first, then still green (as wheat).
    wheatband: ["#e2c272", "#d6b466", "#b4b464", "#a6aa5c"],
    litter: ["#ffffff", "#e8dccb", "#d9d2c0", "#f2e2c8"],
    needles: ["#9a6a3a", "#8a5e34", "#b07a40"],
    sapling: ["#5a8a36", "#6b9640", "#4f7a30"]
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
        per.twig = 0.6 * forest;
        per.pinecone = zone === "woodland" || zone === "mountains" ? 0.35 * forest : 0;
        // Batch 5: a floor, not a painted texture: litter mats, needles under the conifers, more and bigger ferns, saplings.
        per.litter = 1.3 * forest;
        per.needles = zone === "woodland" || zone === "mountains" ? 2.6 * forest : 0;
        per.fern = 0.6 * forest;
        per.sapling = 0.1 * forest;
        per.mushroom = 0.14 * forest;
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
            const yaw = random() * Math.PI * 2;
            const tilt = (random() - 0.5) * 0.4;
            const roll = random();
            const scale = kind === "pebble" ? 0.4 + roll ** 2 * 2.4 : kind === "fern" ? 0.7 + roll * 1.3 : kind === "sapling" ? 0.7 + roll * 0.8 : 0.7 + roll * 0.6;
            const item: Item = {kind, x, y, z, yaw, tilt, scale, colour: Math.floor(random() * tints.length)};
            if (kind === "litter") {
                // Along the ground's slope, so the mat lies on it edge to edge.
                const e = 0.4;
                const nx = sampleGround(x - e, z).height - sampleGround(x + e, z).height;
                const nz = sampleGround(x, z - e).height - sampleGround(x, z + e).height;
                const l = Math.hypot(nx, 2 * e, nz);
                item.up = [nx / l, (2 * e) / l, nz / l];
            }
            items.push(item);
        }
    }
    // Home's crops (batch 4): only well inside the fields; each plant moved onto its row's middle.
    const centre = sampleGround(cx * CELL + CELL / 2, cz * CELL + CELL / 2);
    if ((centre.weights.farm_garden ?? 0) * smoothstep(0.6, 1, centre.land) > 0.75 && centre.height > 0.2) {
        const tries = Math.round(7 * CELL * CELL * share);
        for (let k = 0; k < tries; k++) {
            const px = cx * CELL + random() * CELL;
            const pz = cz * CELL + random() * CELL;
            const keep = random();
            const yaw = random() * Math.PI * 2;
            const size = random();
            const tone = random();
            const plant = snapToRow(px, pz);
            const grows = plant ? CROP_PLANTS[plant.crop] : undefined;
            if (!plant || !grows || keep > grows.perM2 / 7) continue;
            // Cereal (batch 5) stands as a mass along its rows (`wheatStands`, the whole farm at once); single stalks
            // here only on the field's outer fringe.
            if (grows.kind === "wheat" && plant.edge > WHEAT_FRINGE) continue;
            const ripe = grows.kind === "wheat" ? (fieldRipe(plant.cell) ? 0 : 2) + (tone < 0.5 ? 0 : 1) : Math.floor(tone * TINTS[grows.kind].length);
            items.push({kind: grows.kind, x: plant.x, y: sampleGround(plant.x, plant.z).height, z: plant.z, yaw, tilt: (size - 0.5) * 0.2, scale: 0.8 + size * 0.4, colour: ripe});
        }
    }
    return items;
}

/** Inside this far from a cereal field's edge the wheat stands as a mass; outside it, single stalks (the fringe). */
const WHEAT_FRINGE = 1.3;

/**
 * Every cereal field's standing wheat on the farm (batch 5), as crossed cards along the rows: built once, cheap (4
 * triangles a card), so the field reads as one crop at every distance instead of a patch round the camera. Each card has
 * a rank so a tier can thin them evenly.
 */
let wheatCache: Array<Item & {rank: number}> | null = null;
/** Runtime prebuild hook (runtime/prebuild.ts): the same stands, placed in the scenery worker before the mount. */
export function primeWheatStands(items: Array<Item & {rank: number}>): void {
    wheatCache = items;
}

export function wheatStands(): Array<Item & {rank: number}> {
    if (wheatCache) return wheatCache;
    wheatCache = wheatStandsFresh();
    return wheatCache;
}

function wheatStandsFresh(): Array<Item & {rank: number}> {
    const farm = ZONE_SITES.farm_garden;
    const items: Array<Item & {rank: number}> = [];
    for (let cx = Math.floor((farm.x - 46) / CELL); cx <= Math.ceil((farm.x + 46) / CELL); cx++) {
        for (let cz = Math.floor((farm.z - 40) / CELL); cz <= Math.ceil((farm.z + 40) / CELL); cz++) {
            // A cheap first test per cell; each card then checks its own ground, as the ground shader paints the rows.
            const centre = sampleGround(cx * CELL + CELL / 2, cz * CELL + CELL / 2);
            if ((centre.weights.farm_garden ?? 0) * smoothstep(0.6, 1, centre.land) < 0.45 || centre.height < 0.2) continue;
            const random = seeded(((cx * 92821) ^ (cz * 68917) ^ 0x5a17) >>> 0);
            for (let k = 0; k < Math.round(6.5 * CELL * CELL); k++) {
                const px = cx * CELL + random() * CELL;
                const pz = cz * CELL + random() * CELL;
                const turn = random();
                const size = random();
                const tone = random();
                const rank = random();
                const plant = snapToRow(px, pz);
                if (!plant || plant.crop !== "cereal" || plant.edge <= WHEAT_FRINGE) continue;
                const ground = sampleGround(plant.x, plant.z);
                // Where the ground paints rows (terrain.ts cropsHere): well inside the farm, off the sand.
                if ((ground.weights.farm_garden ?? 0) * smoothstep(0.6, 1, ground.land) < 0.7 || ground.height < 0.2) continue;
                items.push({
                    kind: "wheatband",
                    x: plant.x,
                    y: ground.height - 0.02,
                    z: plant.z,
                    yaw: Math.atan2(-plant.direction.z, plant.direction.x) + (turn - 0.5) * 0.5,
                    tilt: (size - 0.5) * 0.08,
                    scale: 0.85 + size * 0.3,
                    colour: (fieldRipe(plant.cell) ? 0 : 2) + (tone < 0.5 ? 0 : 1),
                    rank
                });
            }
        }
    }
    return items.sort((a, b) => a.rank - b.rank);
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
    private materials: MeshStandardMaterial[] = [];
    /** The per-cell detail (shown only close up) and the farm's wheat stands (shown from further). */
    private readonly detail = new Group();
    private readonly stands: InstancedMesh;
    private standsTotal = 0;

    constructor() {
        const geometry = shapes();
        const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.85, side: DoubleSide});
        const wheatMaterial = new MeshStandardMaterial({vertexColors: true, roughness: 0.9, side: DoubleSide, map: wheatBandTexture(), alphaTest: 0.4});
        // Litter lies on the ground: cut out, and drawn just in front of it.
        const litterMaterial = new MeshStandardMaterial({vertexColors: true, roughness: 0.95, map: litterMapTexture(), alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
        this.materials = [material, wheatMaterial, litterMaterial];
        this.group.add(this.detail);
        const stands = wheatStands();
        this.stands = new InstancedMesh(geometry.wheatband, wheatMaterial, Math.max(stands.length, 1));
        stands.forEach((item, i) => {
            this.rotation.setFromAxisAngle(this.axis.set(0, 1, 0), item.yaw);
            this.tilt.setFromAxisAngle(this.axis.set(1, 0, 0), item.tilt);
            this.rotation.multiply(this.tilt);
            this.matrix.compose(this.position.set(item.x, item.y, item.z), this.rotation, this.size.setScalar(item.scale));
            this.stands.setMatrixAt(i, this.matrix);
            this.stands.setColorAt(i, this.colour.set(TINTS.wheatband[item.colour]));
        });
        this.standsTotal = stands.length;
        this.stands.count = stands.length;
        this.stands.receiveShadow = true;
        this.stands.computeBoundingSphere();
        this.group.add(this.stands);
        for (const kind of KINDS) {
            const mesh = new InstancedMesh(geometry[kind], kind === "litter" ? litterMaterial : material, CAP[kind]);
            mesh.instanceMatrix.setUsage(DynamicDrawUsage);
            mesh.count = 0;
            mesh.frustumCulled = false;
            mesh.receiveShadow = true;
            mesh.castShadow = kind === "fern" || kind === "mushroom" || kind === "maize" || kind === "sapling";
            this.meshes.set(kind, mesh);
            this.detail.add(mesh);
        }
    }

    /** The tier's share of the detail: 1 high, 0.6 medium, 0.35 low. Changing it rebuilds the cells. */
    setShare(share: number) {
        if (share === this.share) return;
        this.share = share;
        // The wheat stands thin evenly (they are sorted by rank), never below half: the field must still read as one.
        this.stands.count = Math.round(this.standsTotal * Math.max(share, 0.5));
        this.cells.clear();
        this.lastCell = "";
    }

    /** Call each frame with what the camera looks at and how far it is. */
    update(target: {x: number; z: number}, viewDistance: number) {
        // The near-camera fade's reach follows the view (near-fade.ts): a close-up keeps its subject.
        setNearFade(viewDistance);
        const show = viewDistance < SHOW_WITHIN && this.share > 0;
        this.detail.visible = show;
        this.stands.visible = viewDistance < STANDS_WITHIN;
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
                if (item.up) {
                    // Turned to lie on the slope, then spun about its own up.
                    this.rotation.setFromUnitVectors(this.axis.set(0, 1, 0), this.position.set(item.up[0], item.up[1], item.up[2]));
                    this.tilt.setFromAxisAngle(this.axis.set(0, 1, 0), item.yaw);
                    this.rotation.multiply(this.tilt);
                } else {
                    this.rotation.setFromAxisAngle(this.axis.set(0, 1, 0), item.yaw);
                    this.tilt.setFromAxisAngle(this.axis.set(1, 0, 0), item.tilt * (item.kind === "fern" || item.kind === "mushroom" || item.kind === "sapling" ? 0.3 : 1));
                    this.rotation.multiply(this.tilt);
                }
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
        this.stands.geometry.dispose();
        this.stands.dispose();
        this.materials.forEach((material) => material.dispose());
    }
}
