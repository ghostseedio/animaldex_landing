/**
 * Everything that grows or stands on the world, drawn instanced: one mesh
 * per kind (and shape variant) of `decor.ts`, plus the grass.
 *
 * The shapes are built here in code. Trees are clusters of soft canopy
 * blobs whose normals point out from the canopy's middle (so light wraps
 * them like foliage, not like faceted balls), shaded darker inside and
 * below, with real trunks; palms have drooping fronds, acacias flat crowns,
 * conifers stacked tiers. Rocks are displaced and smooth. Leaves, blades,
 * reeds and kelp sway in the wind (or the swell) from a shared clock, each
 * on its own phase.
 */

import {
    BufferAttribute,
    BufferGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    DoubleSide,
    IcosahedronGeometry,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    MeshStandardMaterial,
    Quaternion,
    BoxGeometry,
    CircleGeometry,
    Vector3,
    type Material
} from "three";
import {mergeGeometries, mergeVertices} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {grassTufts, worldDecor, type DecorKind} from "@/ark-scene/decor";
import {ARK_TIME, ARK_WIND} from "@/ark-scene/glsl";
import {canopyTree, DECOR_SINK, FLOWER_SHAPE, LEAF_LIFT, limbAt} from "@/ark-scene/micro-decor";
import {ZONE_PALETTES} from "@/ark-scene/palettes";
import {seeded} from "@/ark-scene/world";

// MARK: - Building blocks

/** Every part ends up with the same attributes: position, normal, color, arkLeaf (1 = takes the instance's tint and the wind). */
function finish(geometry: BufferGeometry, shade: (y: number, t: number, i: number) => number, leaf: number, colour: Color = WHITE): BufferGeometry {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat.getAttribute("uv")) flat.deleteAttribute("uv");
    if (!flat.getAttribute("normal")) flat.computeVertexNormals();
    flat.computeBoundingBox();
    const box = flat.boundingBox!;
    const position = flat.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    const leaves = new Float32Array(position.count);
    for (let i = 0; i < position.count; i++) {
        const y = position.getY(i);
        const t = (y - box.min.y) / Math.max(box.max.y - box.min.y, 1e-4);
        const value = shade(y, t, i);
        colors[i * 3] = colour.r * value;
        colors[i * 3 + 1] = colour.g * value;
        colors[i * 3 + 2] = colour.b * value;
        leaves[i] = leaf;
    }
    flat.setAttribute("color", new BufferAttribute(colors, 3));
    flat.setAttribute("arkLeaf", new BufferAttribute(leaves, 1));
    return flat;
}

const WHITE = new Color(1, 1, 1);
const BARK = new Color("#5b4632");
const DARK_BARK = new Color("#43352a");

function trunk(height: number, radius: number, lean = 0, colour = BARK): BufferGeometry {
    const geometry = new CylinderGeometry(radius * 0.55, radius, height, 7, 3);
    geometry.translate(0, height / 2, 0);
    if (lean) {
        const position = geometry.getAttribute("position");
        for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) + lean * (position.getY(i) / height) ** 2);
    }
    geometry.computeVertexNormals();
    return finish(geometry, (_, t) => 0.75 + 0.35 * t, 0, colour);
}

type Blob = {x: number; y: number; z: number; r: number; squash?: number};

/** Soft canopy: blobs whose normals lean out from the canopy's middle, darker inside and below. */
function canopy(blobs: Blob[], detail = 1): BufferGeometry {
    const centre = new Vector3();
    for (const blob of blobs) centre.add(new Vector3(blob.x, blob.y, blob.z));
    centre.divideScalar(blobs.length);
    const parts = blobs.map((blob, index) => {
        const sphere = new IcosahedronGeometry(blob.r, detail);
        sphere.scale(1, blob.squash ?? 0.82, 1);
        sphere.translate(blob.x, blob.y, blob.z);
        const position = sphere.getAttribute("position");
        const normal = sphere.getAttribute("normal");
        const out = new Vector3();
        const own = new Vector3();
        for (let i = 0; i < position.count; i++) {
            out.set(position.getX(i), position.getY(i), position.getZ(i)).sub(centre).normalize();
            own.set(normal.getX(i), normal.getY(i), normal.getZ(i));
            own.lerp(out, 0.7).normalize();
            normal.setXYZ(i, own.x, own.y, own.z);
        }
        const variation = 0.92 + ((index * 37) % 11) / 55;
        return finish(sphere, (y) => {
            const inside = Math.min(Math.max((y - (blob.y - blob.r)) / (blob.r * 2), 0), 1);
            return variation * (0.58 + 0.55 * inside);
        }, 1);
    });
    return mergeGeometries(parts)!;
}

function randomBlobs(random: () => number, count: number, centreY: number, spread: number, radius: number, squash = 0.82): Blob[] {
    const blobs: Blob[] = [{x: 0, y: centreY, z: 0, r: radius * 1.15, squash}];
    for (let i = 1; i < count; i++) {
        const angle = random() * Math.PI * 2;
        const distance = spread * (0.45 + 0.55 * random());
        blobs.push({x: Math.cos(angle) * distance, y: centreY + (random() - 0.4) * spread * 0.9, z: Math.sin(angle) * distance, r: radius * (0.7 + 0.4 * random()), squash});
    }
    return blobs;
}

// MARK: - Shapes

/**
 * A tree's trunk as its shape draws it (before the instance's turn and
 * scale): for the small animals that live on bark (`micro.ts`). `lean` bends
 * it along local x by lean · (y / height)²; `sides` is the cylinder's.
 */
export type Trunk = {height: number; radius: number; top: number; lean: number; sides: number; /** Leaves hide it above this (local m). */ clear: number};

export function trunkOf(kind: DecorKind, variant: number): Trunk | null {
    switch (kind) {
        case "broadleaf": {
            const random = seeded(101 + variant);
            const height = 2.1 + variant * 0.35;
            return {height: height + 0.6, radius: 0.2, top: 0.11, lean: (random() - 0.5) * 0.3, sides: 7, clear: height - 0.15};
        }
        case "rainforest": {
            const random = seeded(211 + variant);
            const height = 4.2 + variant * 1.1;
            randomBlobs(random, 9, height + 0.7, 2.2, 1.2, 0.62);
            randomBlobs(random, 6, height * 0.6, 1.6, 1.0, 0.8);
            return {height: height + 0.5, radius: 0.26, top: 0.143, lean: (random() - 0.5) * 0.6, sides: 7, clear: height * 0.6 - 0.9};
        }
        case "orchard":
            return {height: 1.3, radius: 0.12, top: 0.066, lean: 0, sides: 7, clear: 0.95};
        case "cactus":
            return {height: 2.4, radius: 0.24, top: 0.24, lean: 0, sides: 9, clear: 2.35};
        default:
            return null;
    }
}

function broadleaf(variant: number): BufferGeometry {
    const random = seeded(101 + variant);
    const height = 2.1 + variant * 0.35;
    return mergeGeometries([trunk(height + 0.6, 0.2, (random() - 0.5) * 0.3), canopy(randomBlobs(random, 6 + variant, height + 1.3, 1.3, 1.05))])!;
}

/** A canopy tree (`micro-decor.ts` canopyTree): a tall trunk, long limbs under pads of leaves, a crown. */
function canopyShape(variant: number): BufferGeometry {
    const tree = canopyTree(variant);
    const random = seeded(1301 + variant);
    const parts: BufferGeometry[] = [];
    const stem = new CylinderGeometry(tree.top, tree.base, tree.height, 9, 4);
    stem.translate(0, tree.height / 2, 0);
    parts.push(finish(stem, (_, t) => 0.72 + 0.35 * t, 0, BARK));
    const up = new Vector3(0, 1, 0);
    const direction = new Vector3();
    const turn = new Quaternion();
    for (const limb of tree.limbs) {
        const start = limbAt(limb, tree.base, 0);
        const end = limbAt(limb, tree.base, 1);
        const length = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z) + tree.base * 0.8;
        const piece = new CylinderGeometry(limb.tip, limb.base, length, 7, 2);
        // Along +y from its base, then turned onto the limb's direction.
        piece.translate(0, length / 2, 0);
        direction.set(start.dx, start.dy, start.dz).normalize();
        turn.setFromUnitVectors(up, direction);
        piece.applyQuaternion(turn);
        piece.translate(0, limb.height, 0);
        parts.push(finish(piece, () => 0.85, 0, BARK));
        // A pad of leaves over its tip.
        const pad = randomBlobs(random, 4, 0, 0.55, tree.pad.radius, tree.pad.squash).map((blob) => ({...blob, x: blob.x + end.x, y: blob.y + end.y + tree.pad.lift, z: blob.z + end.z}));
        parts.push(canopy(pad, 0));
    }
    parts.push(canopy(randomBlobs(random, 7, tree.crown.y, 1.2, tree.crown.radius, tree.crown.squash), 1));
    return mergeGeometries(parts)!;
}

function rainforest(variant: number): BufferGeometry {
    const random = seeded(211 + variant);
    const height = 4.2 + variant * 1.1;
    // A full, layered crown: a wide flattened top over a lower tier of leaves that hides the trunk.
    const top = randomBlobs(random, 9, height + 0.7, 2.2, 1.2, 0.62);
    const under = randomBlobs(random, 6, height * 0.6, 1.6, 1.0, 0.8);
    return mergeGeometries([trunk(height + 0.5, 0.26, (random() - 0.5) * 0.6), canopy(top, 1), canopy(under, 0)])!;
}

function conifer(): BufferGeometry {
    const tiers = [0, 1, 2, 3].map((i) => {
        const radius = 1.25 - i * 0.26;
        const cone = new ConeGeometry(radius, 1.7 - i * 0.18, 9, 2);
        cone.translate(0, 1.35 + i * 0.95, 0);
        // A ragged hem: every other rim vertex droops a little.
        const position = cone.getAttribute("position");
        for (let v = 0; v < position.count; v++) {
            const y = position.getY(v);
            const low = y < 1.35 + i * 0.95 - (1.7 - i * 0.18) / 2 + 0.01;
            if (low && v % 2 === 0) position.setY(v, y - 0.18);
        }
        cone.computeVertexNormals();
        return finish(cone, (_, t) => 0.62 + 0.5 * t + i * 0.04, 1);
    });
    return mergeGeometries([trunk(1.4, 0.16, 0, DARK_BARK), ...tiers])!;
}

function acacia(): BufferGeometry {
    const random = seeded(331);
    const stemA = trunk(2.6, 0.13, 0.5);
    const stemB = trunk(2.3, 0.1, -0.6);
    const crown: Blob[] = [];
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + random() * 0.4;
        const distance = i === 0 ? 0 : 1.2 + random() * 0.5;
        crown.push({x: Math.cos(angle) * distance, y: 2.85 + random() * 0.15, z: Math.sin(angle) * distance, r: 1.05, squash: 0.3});
    }
    return mergeGeometries([stemA, stemB, canopy(crown)])!;
}

function palm(): BufferGeometry {
    const parts: BufferGeometry[] = [];
    // A trunk that curves as it rises.
    const segments = 7;
    let x = 0;
    let y = 0;
    for (let i = 0; i < segments; i++) {
        const length = 0.75;
        const piece = new CylinderGeometry(0.11 - i * 0.006, 0.13 - i * 0.006, length, 6);
        const tilt = 0.06 + i * 0.045;
        piece.rotateZ(-tilt);
        piece.translate(x + Math.sin(tilt) * length / 2, y + Math.cos(tilt) * length / 2, 0);
        x += Math.sin(tilt) * length;
        y += Math.cos(tilt) * length;
        parts.push(finish(piece, () => (i % 2 ? 0.85 : 1), 0, new Color("#7a6248")));
    }
    // Fronds: long drooping leaves fanned out round the crown.
    for (let f = 0; f < 8; f++) {
        const angle = (f / 8) * Math.PI * 2;
        const leaf = new BufferGeometry();
        const points: number[] = [];
        const steps = 5;
        const length = 2.1;
        for (let s = 0; s < steps; s++) {
            const t0 = s / steps;
            const t1 = (s + 1) / steps;
            const w0 = 0.32 * Math.sin(Math.PI * Math.min(t0 + 0.12, 1));
            const w1 = 0.32 * Math.sin(Math.PI * Math.min(t1 + 0.12, 1));
            const d0 = t0 * length;
            const d1 = t1 * length;
            const h0 = 0.35 * t0 - 1.1 * t0 * t0;
            const h1 = 0.35 * t1 - 1.1 * t1 * t1;
            points.push(d0, h0, -w0, d1, h1, -w1, d1, h1, w1, d0, h0, -w0, d1, h1, w1, d0, h0, w0);
        }
        leaf.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
        leaf.rotateY(angle);
        leaf.translate(x, y, 0);
        leaf.computeVertexNormals();
        parts.push(finish(leaf, (_, t) => 0.7 + 0.45 * t, 1));
    }
    return mergeGeometries(parts)!;
}

function shrub(): BufferGeometry {
    const random = seeded(441);
    return canopy(randomBlobs(random, 4, 0.45, 0.45, 0.42, 0.75), 0);
}

function cactus(): BufferGeometry {
    const parts: BufferGeometry[] = [];
    const column = (radius: number, height: number, x: number, y: number) => {
        const body = new CylinderGeometry(radius, radius, height, 9, 1);
        body.translate(x, y + height / 2, 0);
        const cap = new IcosahedronGeometry(radius, 1);
        cap.scale(1, 0.8, 1);
        cap.translate(x, y + height, 0);
        parts.push(finish(body, (_, t) => 0.72 + 0.35 * t, 1), finish(cap, () => 1.05, 1));
    };
    column(0.24, 2.4, 0, 0);
    // Two arms: out, then up.
    for (const [side, at, rise] of [[1, 0.9, 0.9], [-1, 1.3, 0.7]] as const) {
        const elbow = new CylinderGeometry(0.15, 0.15, 0.45, 8);
        elbow.rotateZ(Math.PI / 2);
        elbow.translate(side * 0.38, at, 0);
        parts.push(finish(elbow, () => 0.85, 1));
        column(0.15, rise, side * 0.6, at - 0.05);
    }
    return mergeGeometries(parts)!;
}

export function rock(variant: number): BufferGeometry {
    const random = seeded(551 + variant);
    let geometry: BufferGeometry = new IcosahedronGeometry(0.85, 1);
    geometry.deleteAttribute("normal");
    geometry.deleteAttribute("uv");
    geometry = mergeVertices(geometry);
    const position = geometry.getAttribute("position");
    const bumps = Array.from({length: 6}, () => new Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize());
    const v = new Vector3();
    for (let i = 0; i < position.count; i++) {
        v.set(position.getX(i), position.getY(i), position.getZ(i));
        const dir = v.clone().normalize();
        let push = 0;
        for (const bump of bumps) push += Math.max(dir.dot(bump), 0) ** 3 * 0.22;
        v.multiplyScalar(0.85 + push - 0.08 * Math.abs(dir.y));
        position.setXYZ(i, v.x * 1.1, v.y * 0.62, v.z * 0.95);
    }
    geometry.computeVertexNormals();
    geometry.translate(0, 0.18, 0);
    return finish(geometry, (_, t, i) => 0.72 + 0.32 * t + ((i * 7919) % 13) / 130, 1);
}

function reed(): BufferGeometry {
    const random = seeded(661);
    const parts: BufferGeometry[] = [];
    for (let b = 0; b < 9; b++) {
        const height = 1.1 + random() * 0.7;
        const blade = new ConeGeometry(0.035, height, 3);
        blade.translate((random() - 0.5) * 0.45, height / 2, (random() - 0.5) * 0.45);
        parts.push(finish(blade, (_, t) => 0.6 + 0.55 * t, 1));
    }
    for (let c = 0; c < 2; c++) {
        const head = new CylinderGeometry(0.05, 0.05, 0.22, 6);
        head.translate((random() - 0.5) * 0.3, 1.55 + c * 0.15, (random() - 0.5) * 0.3);
        parts.push(finish(head, () => 1, 0, new Color("#5a3d27")));
    }
    return mergeGeometries(parts)!;
}

function lily(): BufferGeometry {
    const pad = new CircleGeometry(0.42, 12, 0.35, Math.PI * 2 - 0.35);
    pad.rotateX(-Math.PI / 2);
    return finish(pad, (_, __, i) => 0.9 + (i % 3) * 0.05, 1);
}

function coral(variant: number): BufferGeometry {
    const random = seeded(771 + variant);
    if (variant === 1) {
        // A brain coral: a squat, lumpy dome.
        const dome = rock(variant);
        dome.scale(0.8, 0.9, 0.8);
        return dome;
    }
    if (variant === 2) {
        // Tube sponges: a clutch of open-topped tubes.
        const tubes: BufferGeometry[] = [];
        for (let k = 0; k < 5; k++) {
            const height = 0.35 + random() * 0.55;
            const tube = new CylinderGeometry(0.09, 0.07, height, 7, 1, true);
            tube.translate((random() - 0.5) * 0.4, height / 2, (random() - 0.5) * 0.4);
            tubes.push(finish(tube, (_, t) => 0.65 + 0.5 * t, 1));
        }
        return mergeGeometries(tubes)!;
    }
    const parts: BufferGeometry[] = [];
    for (let b = 0; b < 7; b++) {
        const height = 0.5 + random() * 0.6;
        const branch = new ConeGeometry(0.07, height, 5);
        branch.translate(0, height / 2, 0);
        branch.rotateZ((random() - 0.5) * 1.1);
        branch.rotateY(random() * Math.PI * 2);
        parts.push(finish(branch, (_, t) => 0.7 + 0.5 * t, 1));
    }
    return mergeGeometries(parts)!;
}

function kelp(): BufferGeometry {
    const random = seeded(881);
    const parts: BufferGeometry[] = [];
    for (let r = 0; r < 3; r++) {
        const height = 2.2 + random() * 1.2;
        const steps = 8;
        const points: number[] = [];
        const ox = (random() - 0.5) * 0.5;
        const oz = (random() - 0.5) * 0.5;
        for (let s = 0; s < steps; s++) {
            const y0 = (s / steps) * height;
            const y1 = ((s + 1) / steps) * height;
            const w = 0.12;
            const a0 = s * 0.5;
            const a1 = (s + 1) * 0.5;
            const p = (y: number, a: number, side: number): [number, number, number] => [ox + Math.cos(a) * w * side, y, oz + Math.sin(a) * w * side];
            points.push(...p(y0, a0, -1), ...p(y1, a1, -1), ...p(y1, a1, 1), ...p(y0, a0, -1), ...p(y1, a1, 1), ...p(y0, a0, 1));
        }
        const ribbon = new BufferGeometry();
        ribbon.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
        ribbon.computeVertexNormals();
        parts.push(finish(ribbon, (_, t) => 0.6 + 0.5 * t, 1));
    }
    return mergeGeometries(parts)!;
}

function barn(): BufferGeometry {
    const wall = new Color("#9b4b36");
    const roof = new Color("#4d4440");
    const trim = new Color("#efe6d6");
    const body = new BoxGeometry(6.4, 3.2, 4.4);
    body.translate(0, 1.6, 0);
    // The roof: a prism over the long side.
    const roofShape = new BufferGeometry();
    const w = 3.5;
    const d = 2.55;
    const h = 1.9;
    const top = 3.15;
    const v = [
        -w, top, -d, w, top, -d, w, top + h, 0, -w, top, -d, w, top + h, 0, -w, top + h, 0,
        -w, top, d, -w, top + h, 0, w, top + h, 0, -w, top, d, w, top + h, 0, w, top, d,
        -w + 0.15, top, -d + 0.1, -w + 0.15, top + h - 0.05, 0, -w + 0.15, top, d - 0.1,
        w - 0.15, top, -d + 0.1, w - 0.15, top, d - 0.1, w - 0.15, top + h - 0.05, 0
    ];
    roofShape.setAttribute("position", new BufferAttribute(new Float32Array(v), 3));
    roofShape.computeVertexNormals();
    const door = new BoxGeometry(1.8, 2.3, 0.1);
    door.translate(0, 1.15, 2.22);
    const doorTrim = new BoxGeometry(2.1, 2.55, 0.06);
    doorTrim.translate(0, 1.27, 2.21);
    return mergeGeometries([
        finish(body, (_, t) => 0.8 + 0.25 * t, 0, wall),
        finish(roofShape, () => 1, 0, roof),
        finish(doorTrim, () => 1, 0, trim),
        finish(door, () => 0.75, 0, wall)
    ])!;
}

function hay(): BufferGeometry {
    const bale = new CylinderGeometry(0.62, 0.62, 1.15, 14);
    bale.rotateZ(Math.PI / 2);
    bale.translate(0, 0.6, 0);
    return finish(bale, (_, t) => 0.78 + 0.3 * t, 0, new Color("#d6b25e"));
}

function fence(): BufferGeometry {
    const wood = new Color("#8a6b4a");
    const parts: BufferGeometry[] = [];
    for (const x of [-1.2, 1.2]) {
        const post = new BoxGeometry(0.1, 1, 0.1);
        post.translate(x, 0.5, 0);
        parts.push(finish(post, (_, t) => 0.75 + 0.3 * t, 0, wood));
    }
    for (const y of [0.45, 0.85]) {
        const rail = new BoxGeometry(2.45, 0.07, 0.05);
        rail.translate(0, y, 0);
        parts.push(finish(rail, () => 0.95, 0, wood));
    }
    return mergeGeometries(parts)!;
}

function orchard(variant: number): BufferGeometry {
    const random = seeded(991 + variant);
    return mergeGeometries([trunk(1.3, 0.12), canopy(randomBlobs(random, 5, 1.85, 0.6, 0.62), 0)])!;
}

/**
 * A garden flower (`micro-decor.ts` FLOWER_SHAPE): a stem with two leaves
 * and a head that takes the instance's colour. Three shapes: a daisy (a
 * ring of petals round a yellow eye), a round head, a cup. No wind: the
 * small animals sitting on the heads stay on them.
 */
function flower(variant: number): BufferGeometry {
    const stemHeight = FLOWER_SHAPE.stem[variant];
    const head = FLOWER_SHAPE.head;
    const green = new Color("#4f7a34");
    const parts: BufferGeometry[] = [];
    const stem = new CylinderGeometry(0.006, 0.008, stemHeight, 5);
    stem.translate(0, stemHeight / 2, 0);
    parts.push(finish(stem, (_, t) => 0.7 + 0.3 * t, 0, green));
    for (const [side, at] of [[1, 0.35], [-1, 0.55]] as const) {
        const blade = new BufferGeometry();
        const y = stemHeight * at;
        blade.setAttribute("position", new BufferAttribute(new Float32Array([0, y, 0, side * 0.07, y + 0.05, 0.018, side * 0.07, y + 0.05, -0.018, 0, y, 0, side * 0.07, y + 0.05, -0.018, side * 0.07, y + 0.05, 0.018]), 3));
        blade.computeVertexNormals();
        parts.push(finish(blade, () => 0.9, 0, green));
    }
    if (variant === 0) {
        // A daisy: eight petals round an eye, flat on top of the stem.
        for (let p = 0; p < 8; p++) {
            const petal = new IcosahedronGeometry(head * 0.5, 0);
            petal.scale(1, 0.18, 0.45);
            petal.translate(head * 0.55, 0, 0);
            petal.rotateY(p / 8 * Math.PI * 2);
            petal.translate(0, stemHeight + head * FLOWER_SHAPE.squash * 0.5, 0);
            parts.push(finish(petal, () => 1, 1));
        }
        const eye = new IcosahedronGeometry(head * 0.38, 1);
        eye.scale(1, 0.5, 1);
        eye.translate(0, stemHeight + head * FLOWER_SHAPE.squash * 0.6, 0);
        parts.push(finish(eye, () => 1, 0, new Color("#e8b62c")));
    } else {
        const bloom = new IcosahedronGeometry(head, 1);
        bloom.scale(1, FLOWER_SHAPE.squash * (variant === 2 ? 1.5 : 1), 1);
        bloom.translate(0, stemHeight + (variant === 2 ? head * 0.2 : 0), 0);
        parts.push(finish(bloom, (_, t) => 0.82 + 0.25 * t, 1));
    }
    return mergeGeometries(parts)!;
}

/** A fallen leaf, lying flat with its edges a little curled. */
function fallenLeaf(variant: number): BufferGeometry {
    const length = variant ? 0.11 : 0.085;
    const width = variant ? 0.05 : 0.06;
    const points: number[] = [];
    const steps = 5;
    for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 1) / steps;
        const w0 = width * Math.sin(Math.PI * t0);
        const w1 = width * Math.sin(Math.PI * t1);
        const z0 = (t0 - 0.5) * length;
        const z1 = (t1 - 0.5) * length;
        const curl = 0.008;
        points.push(0, 0, z0, w0, curl, z0, w1, curl, z1, 0, 0, z0, w1, curl, z1, 0, 0, z1);
        points.push(0, 0, z0, 0, 0, z1, -w1, curl, z1, 0, 0, z0, -w1, curl, z1, -w0, curl, z0);
    }
    const leaf = new BufferGeometry();
    leaf.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    leaf.computeVertexNormals();
    const normal = leaf.getAttribute("normal");
    for (let i = 0; i < normal.count; i++) normal.setXYZ(i, 0, 1, 0);
    return finish(leaf, (_, __, i) => 0.85 + (i % 5) * 0.04, 1);
}

/** A grass tuft: nine tapered blades leaning out, dark at the root and light at the tip. */
function tuft(): BufferGeometry {
    const random = seeded(1201);
    const points: number[] = [];
    for (let b = 0; b < 9; b++) {
        const angle = random() * Math.PI * 2;
        const lean = 0.15 + random() * 0.25;
        const height = 0.32 + random() * 0.28;
        const width = 0.035;
        const ox = Math.cos(angle) * 0.08 * random();
        const oz = Math.sin(angle) * 0.08 * random();
        const tx = ox + Math.cos(angle) * lean * height;
        const tz = oz + Math.sin(angle) * lean * height;
        const px = -Math.sin(angle) * width;
        const pz = Math.cos(angle) * width;
        points.push(ox - px, 0, oz - pz, ox + px, 0, oz + pz, tx, height, tz);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    geometry.computeVertexNormals();
    // Grass is lit as if it faced up, so it reads like the lawn it stands on.
    const normal = geometry.getAttribute("normal");
    for (let i = 0; i < normal.count; i++) normal.setXYZ(i, 0, 1, 0);
    return finish(geometry, (_, t) => 0.45 + 0.75 * t, 1);
}

// MARK: - Material

/** The shared foliage material: vertex colour × the instance's tint (leaves only), swaying with the wind above `windHeight`. */
function foliageMaterial(windAmount: number, windHeight: number, doubleSide = false): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.88, metalness: 0});
    if (doubleSide) material.side = DoubleSide;
    const uniforms = {arkTime: ARK_TIME, arkWind: ARK_WIND, windAmount: {value: windAmount}, windHeight: {value: windHeight}};
    material.customProgramCacheKey = () => `ark-foliage-${doubleSide ? 2 : 1}`;
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
attribute vec3 arkTint;
attribute float arkLeaf;
uniform float arkTime;
uniform vec2 arkWind;
uniform float windAmount;
uniform float windHeight;`)
            .replace("#include <color_vertex>", `#include <color_vertex>
vColor.rgb *= mix(vec3(1.0), arkTint, arkLeaf);`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>
{
    vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float sway = sin(arkTime * 1.5 + root.x * 0.21 + root.z * 0.17) + 0.45 * sin(arkTime * 2.9 + root.x * 0.53 - root.z * 0.31);
    float bend = pow(max(transformed.y, 0.0) / windHeight, 2.0) * windAmount * arkLeaf;
    transformed.xz += arkWind * sway * bend;
}`);
    };
    return material;
}

// MARK: - The meshes

type Shape = {kind: DecorKind; variant: number; build: () => BufferGeometry; wind: number; windHeight: number; doubleSide?: boolean; shadow: boolean};

const SHAPES: Shape[] = [
    ...[0, 1, 2].map((variant) => ({kind: "broadleaf" as const, variant, build: () => broadleaf(variant), wind: 0.06, windHeight: 4, shadow: true})),
    ...[0, 1].map((variant) => ({kind: "rainforest" as const, variant, build: () => rainforest(variant), wind: 0.05, windHeight: 8, shadow: true})),
    {kind: "conifer", variant: 0, build: conifer, wind: 0.05, windHeight: 4.5, shadow: true},
    {kind: "acacia", variant: 0, build: acacia, wind: 0.04, windHeight: 3.2, shadow: true},
    {kind: "palm", variant: 0, build: palm, wind: 0.12, windHeight: 5, doubleSide: true, shadow: true},
    {kind: "shrub", variant: 0, build: shrub, wind: 0.04, windHeight: 1, shadow: true},
    {kind: "cactus", variant: 0, build: cactus, wind: 0, windHeight: 1, shadow: true},
    ...[0, 1, 2].map((variant) => ({kind: "rock" as const, variant, build: () => rock(variant), wind: 0, windHeight: 1, shadow: true})),
    {kind: "reed", variant: 0, build: reed, wind: 0.14, windHeight: 1.6, shadow: false},
    {kind: "lily", variant: 0, build: lily, wind: 0, windHeight: 1, shadow: false},
    ...[0, 1, 2].map((variant) => ({kind: "coral" as const, variant, build: () => coral(variant), wind: 0, windHeight: 1, doubleSide: variant === 2, shadow: false})),
    {kind: "kelp", variant: 0, build: kelp, wind: 0.2, windHeight: 3, doubleSide: true, shadow: false},
    {kind: "barn", variant: 0, build: barn, wind: 0, windHeight: 1, shadow: true},
    {kind: "hay", variant: 0, build: hay, wind: 0, windHeight: 1, shadow: true},
    {kind: "fence", variant: 0, build: fence, wind: 0, windHeight: 1, shadow: true},
    ...[0, 1, 2].map((variant) => ({kind: "orchard" as const, variant, build: () => orchard(variant), wind: 0.05, windHeight: 2.5, shadow: true})),
    ...[0, 1, 2].map((variant) => ({kind: "flower" as const, variant, build: () => flower(variant), wind: 0, windHeight: 1, doubleSide: true, shadow: false})),
    ...[0, 1].map((variant) => ({kind: "leaf" as const, variant, build: () => fallenLeaf(variant), wind: 0, windHeight: 1, doubleSide: true, shadow: false})),
    // No wind: the animals on its limbs stay on them.
    ...[0, 1].map((variant) => ({kind: "canopy" as const, variant, build: () => canopyShape(variant), wind: 0, windHeight: 1, shadow: true}))
];

export type Vegetation = {
    meshes: InstancedMesh[];
    /** Grass: drawn only on tiers that can afford it. */
    grass: InstancedMesh;
    setGrassCount: (count: number) => void;
    setShadows: (on: boolean) => void;
    triangles: number;
    dispose: () => void;
};

function variantCount(kind: DecorKind): number {
    return SHAPES.filter((shape) => shape.kind === kind).length;
}

export function buildVegetation(maxGrass: number): Vegetation {
    const items = worldDecor();
    const meshes: InstancedMesh[] = [];
    const materials: Material[] = [];
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const scale = new Vector3();
    const at = new Vector3();
    const tint = new Color();
    const shadowCasters: InstancedMesh[] = [];
    let triangles = 0;

    for (const shape of SHAPES) {
        const mine = items.filter((item) => item.kind === shape.kind && item.variant % variantCount(shape.kind) === shape.variant);
        if (!mine.length) continue;
        const geometry = shape.build();
        const material = foliageMaterial(shape.wind, shape.windHeight, shape.doubleSide);
        const mesh = new InstancedMesh(geometry, material, mine.length);
        mesh.userData.kind = shape.kind;
        const tints = new Float32Array(mine.length * 3);
        mine.forEach((item, i) => {
            rotation.setFromAxisAngle(up, item.rotation);
            const s = item.scale;
            scale.set(s, shape.kind === "rock" ? s * (0.8 + 0.4 * ((i * 7) % 5) / 5) : s, s);
            at.set(item.x, item.y + (shape.kind === "lily" ? 0 : shape.kind === "leaf" ? LEAF_LIFT : -DECOR_SINK), item.z);
            matrix.compose(at, rotation, scale);
            mesh.setMatrixAt(i, matrix);
            tint.set(item.color);
            tints[i * 3] = tint.r;
            tints[i * 3 + 1] = tint.g;
            tints[i * 3 + 2] = tint.b;
        });
        geometry.setAttribute("arkTint", new InstancedBufferAttribute(tints, 3));
        mesh.computeBoundingSphere();
        mesh.receiveShadow = true;
        if (shape.shadow) shadowCasters.push(mesh);
        triangles += (geometry.getAttribute("position").count / 3) * mine.length;
        meshes.push(mesh);
        materials.push(material);
    }

    // Grass.
    const tufts = grassTufts(maxGrass);
    const grassGeometry = tuft();
    const grassMaterial = foliageMaterial(0.35, 0.6, true);
    materials.push(grassMaterial);
    const grass = new InstancedMesh(grassGeometry, grassMaterial, Math.max(tufts.length, 1));
    const grassTints = new Float32Array(Math.max(tufts.length, 1) * 3);
    // Each tuft takes its ground's own colour, a little greener and lighter, so the grass grows out of the ground rather than sitting on it.
    const green = new Color("#7a9446");
    const dry = new Color("#c2a35c");
    tufts.forEach((t, i) => {
        rotation.setFromAxisAngle(up, t.rotation);
        matrix.compose(at.set(t.x, t.y - 0.03, t.z), rotation, scale.setScalar(t.scale));
        grass.setMatrixAt(i, matrix);
        tint.set(ZONE_PALETTES[t.zone].ground[0]).lerp(green, 0.35).lerp(dry, t.dry * 0.5).multiplyScalar(1.12);
        grassTints[i * 3] = tint.r;
        grassTints[i * 3 + 1] = tint.g;
        grassTints[i * 3 + 2] = tint.b;
    });
    grassGeometry.setAttribute("arkTint", new InstancedBufferAttribute(grassTints, 3));
    grass.count = tufts.length;
    grass.computeBoundingSphere();
    grass.receiveShadow = true;
    const grassTriangles = grassGeometry.getAttribute("position").count / 3;

    return {
        meshes,
        grass,
        setGrassCount: (count) => {
            grass.count = Math.min(count, tufts.length);
            grass.visible = grass.count > 0;
        },
        setShadows: (on) => {
            for (const mesh of shadowCasters) mesh.castShadow = on;
        },
        get triangles() {
            return triangles + grassTriangles * grass.count;
        },
        dispose: () => {
            for (const mesh of [...meshes, grass]) {
                mesh.geometry.dispose();
                mesh.dispose();
            }
            materials.forEach((material) => material.dispose());
        }
    };
}
