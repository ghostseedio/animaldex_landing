/**
 * Everything that grows or stands on the world, drawn instanced: one mesh
 * per kind (and shape variant) of `decor.ts`, plus the grass.
 *
 * The shapes are built here in code. Trees are clusters of soft canopy
 * blobs whose normals point out from the canopy's middle (so light wraps
 * them like foliage, not like faceted balls), shaded darker inside and
 * below, with real trunks; palms have drooping fronds, acacias flat crowns,
 * conifers stacked tiers. Rocks are displaced and smooth. Leaves, blades
 * and reeds sway in the wind from a shared clock, each on its own phase.
 * Under the sea, the reef, kelp, seagrass and fish schools are `reef-render.ts`
 * and `fish-render.ts` (batch 4), built and updated from here.
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
    CanvasTexture,
    CircleGeometry,
    SRGBColorSpace,
    Vector3,
    type Material,
    type Object3D
} from "three";
import {mergeGeometries, mergeVertices} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {forestFill, grassTufts, rockRadius, rockSquash, worldDecor, type DecorKind} from "@/ark-scene/decor";
import {ARK_TIME, ARK_WIND, NOISE_GLSL} from "@/ark-scene/glsl";
import {ARK_GROUND_TEXTURES} from "@/ark-scene/ground-textures";
import {withGrassPress} from "@/ark-scene/grass-press";
import {ARK_NEAR_FADE, ARK_NEAR_FADE_CLIP, ARK_NEAR_FADE_PARS} from "@/ark-scene/near-fade";
import {canopyTree, DECOR_SINK, FLOWER_SHAPE, LEAF_LIFT, limbAt} from "@/ark-scene/micro-decor";
import {ZONE_PALETTES} from "@/ark-scene/palettes";
import {seeded} from "@/ark-scene/world";
import {buildReef} from "@/ark-scene/reef-render";
import {FishView} from "@/ark-scene/fish-render";

// MARK: - Building blocks

/** Every part ends up with the same attributes: position, normal, color, arkLeaf (1 = takes the instance's tint and the wind). */
function finish(geometry: BufferGeometry, shade: (y: number, t: number, i: number) => number, leaf: number, colour: Color = WHITE, keepUv = false): BufferGeometry {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    // Every part samples the foliage texture: leaf cards their own leaves, everything else its opaque white corner.
    if (!keepUv || !flat.getAttribute("uv")) {
        const corner = new Float32Array(flat.getAttribute("position").count * 2).fill(0.985);
        flat.setAttribute("uv", new BufferAttribute(corner, 2));
    }
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
    // 1 on leaf cards (they take the foliage texture), 0 on everything else (solid colour, never the texture).
    flat.setAttribute("arkCard", new BufferAttribute(new Float32Array(position.count).fill(keepUv ? 1 : 0), 1));
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
function canopy(blobs: Blob[], detail = 1, solid = true): BufferGeometry {
    const centre = new Vector3();
    for (const blob of blobs) centre.add(new Vector3(blob.x, blob.y, blob.z));
    centre.divideScalar(blobs.length);
    const parts = (solid ? blobs : []).map((blob, index) => {
        const sphere = new IcosahedronGeometry(blob.r * 0.82, detail);
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
            return variation * (0.5 + 0.5 * inside);
        }, 1);
    });
    // Batch 1: leaf cards round each blob (alpha-cut clusters of leaves), so crowns have ragged, leafy edges, not balls.
    const random = seeded(Math.round(Math.abs(centre.x * 131 + centre.y * 71 + centre.z * 37 + blobs.length * 7)) + 5);
    const cards: number[] = [];
    const cardUv: number[] = [];
    const cardNormal: number[] = [];
    const cardShade: number[] = [];
    const dir = new Vector3();
    const side = new Vector3();
    const up = new Vector3();
    const facing = new Vector3();
    for (const blob of blobs) {
        const count = 6 + Math.round(blob.r * 6);
        for (let c = 0; c < count; c++) {
            dir.set(random() * 2 - 1, random() * 1.6 - 0.5, random() * 2 - 1).normalize();
            const reach = blob.r * (0.55 + 0.45 * random());
            const cx = blob.x + dir.x * reach;
            const cy = blob.y + dir.y * reach * (blob.squash ?? 0.82);
            const cz = blob.z + dir.z * reach;
            const size = blob.r * (0.75 + 0.45 * random());
            facing.copy(dir).add(new Vector3(random() - 0.5, random() - 0.3, random() - 0.5)).normalize();
            side.set(0, 1, 0).cross(facing);
            if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
            side.normalize().multiplyScalar(size / 2);
            up.copy(facing).cross(side).normalize().multiplyScalar(size / 2);
            const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [cx + side.x * a + up.x * b, cy + side.y * a + up.y * b, cz + side.z * a + up.z * b]);
            const uvs = [[0, 0], [0.92, 0], [0.92, 0.92], [0, 0.92]];
            for (const k of [0, 1, 2, 0, 2, 3]) {
                cards.push(...corners[k]);
                cardUv.push(...uvs[k]);
                const out = new Vector3(corners[k][0], corners[k][1], corners[k][2]).sub(centre).normalize();
                cardNormal.push(out.x, out.y, out.z);
                const inside = Math.min(Math.max((corners[k][1] - (blob.y - blob.r)) / (blob.r * 2), 0), 1);
                cardShade.push(0.62 + 0.5 * inside);
            }
        }
    }
    const leaves = new BufferGeometry();
    leaves.setAttribute("position", new BufferAttribute(new Float32Array(cards), 3));
    leaves.setAttribute("normal", new BufferAttribute(new Float32Array(cardNormal), 3));
    leaves.setAttribute("uv", new BufferAttribute(new Float32Array(cardUv), 2));
    parts.push(finish(leaves, (_, __, i) => cardShade[i], 1, WHITE, true));
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
        // Leaf cards only (graphics pass): the solid low-poly pads read as big dark kites close up.
        parts.push(canopy(pad, 0, false));
    }
    parts.push(canopy(randomBlobs(random, 7, tree.crown.y, 1.2, tree.crown.radius, tree.crown.squash), 1, false));
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
    let geometry: BufferGeometry = new IcosahedronGeometry(0.85, 3);
    geometry.deleteAttribute("normal");
    geometry.deleteAttribute("uv");
    geometry = mergeVertices(geometry);
    const position = geometry.getAttribute("position");
    const v = new Vector3();
    // The shape is decor.ts rockRadius, so the attach points (sampler.ts) sit on this very surface.
    for (let i = 0; i < position.count; i++) {
        v.set(position.getX(i), position.getY(i), position.getZ(i)).normalize();
        v.multiplyScalar(rockRadius(variant, v.x, v.y, v.z));
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

// The reef's corals, sponges and anemones, the kelp and the seagrass (graphics pass, batch 4): `reef.ts` places them,
// `reef-render.ts` draws them (real shapes, near and far versions, the shared surge). The decor's old coral domes and
// kelp cards are no longer drawn.

/** A barn's look: its colours and its size against today's (length, height, width). */
export type BarnStyle = {wall: string; roof: string; trim: string; size: [number, number, number]};

/** Today's barn (the decor's `barn`). */
export const BARN_STYLE: BarnStyle = {wall: "#9b4b36", roof: "#4d4440", trim: "#efe6d6", size: [1, 1, 1]};

/**
 * The barn's mesh, or a variant of it (the props lane's hamlet: another plot's barn or a smaller farm shed). With
 * `BARN_STYLE` it is today's barn, byte for byte (`ark-props.test`).
 */
export function barnGeometry(style: BarnStyle = BARN_STYLE): BufferGeometry {
    const wall = new Color(style.wall);
    const roof = new Color(style.roof);
    const trim = new Color(style.trim);
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
    const merged = mergeGeometries([
        finish(body, (_, t) => 0.8 + 0.25 * t, 0, wall),
        finish(roofShape, () => 1, 0, roof),
        finish(doorTrim, () => 1, 0, trim),
        finish(door, () => 0.75, 0, wall)
    ])!;
    const [sx, sy, sz] = style.size;
    if (sx !== 1 || sy !== 1 || sz !== 1) merged.scale(sx, sy, sz);
    return merged;
}

function barn(): BufferGeometry {
    return barnGeometry();
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
    } else if (variant === 1) {
        // Graphics pass: a wild rose / cosmos: five broad, rounded petals, slightly cupped, round a golden boss.
        for (let p = 0; p < 5; p++) {
            const petal = new IcosahedronGeometry(head * 0.62, 1);
            petal.scale(1, 0.14, 0.82);
            petal.translate(head * 0.58, head * 0.08, 0);
            petal.rotateZ(0.18);
            petal.rotateY(p / 5 * Math.PI * 2 + 0.3);
            petal.translate(0, stemHeight + head * FLOWER_SHAPE.squash * 0.35, 0);
            parts.push(finish(petal, (_, t) => 0.85 + 0.2 * t, 1));
        }
        const boss = new IcosahedronGeometry(head * 0.3, 1);
        boss.scale(1, 0.55, 1);
        boss.translate(0, stemHeight + head * FLOWER_SHAPE.squash * 0.55, 0);
        parts.push(finish(boss, () => 1, 0, new Color("#d9a82a")));
    } else {
        // A cup (a tulip or poppy bud opening): six petals standing up round the middle.
        for (let p = 0; p < 6; p++) {
            const petal = new IcosahedronGeometry(head * 0.55, 1);
            petal.scale(0.16, 1, 0.75);
            petal.translate(head * 0.42, head * 0.55, 0);
            petal.rotateZ(-0.32);
            petal.rotateY(p / 6 * Math.PI * 2);
            petal.translate(0, stemHeight, 0);
            parts.push(finish(petal, (_, t) => 0.7 + 0.4 * t, 1));
        }
        const heart = new IcosahedronGeometry(head * 0.22, 1);
        heart.translate(0, stemHeight + head * 0.35, 0);
        parts.push(finish(heart, () => 1, 0, new Color("#3a2a1a")));
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
    // Batch 1: more, finer blades of mixed height (short lawn round long stems), not a few big flat spikes.
    for (let b = 0; b < 14; b++) {
        const angle = random() * Math.PI * 2;
        const lean = 0.12 + random() * 0.3;
        const tall = random();
        const height = tall > 0.8 ? 0.42 + random() * 0.22 : 0.14 + random() * 0.22;
        const width = 0.012 + random() * 0.014;
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
    return finish(geometry, (_, t) => 0.62 + 0.55 * t, 1);
}

// MARK: - Material

/**
 * The foliage texture (batch 1), drawn once in code: clusters of grey leaves on clear ground (the leaf cards
 * take their colour from the tree's tint), and an opaque white corner that every solid part samples.
 */
let foliageTexture: CanvasTexture | null = null;
function leafTexture(): CanvasTexture | null {
    if (foliageTexture) return foliageTexture;
    if (typeof document === "undefined") return null;
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const g = canvas.getContext("2d");
    if (!g) return null;
    const random = seeded(4242);
    g.clearRect(0, 0, size, size);
    for (let i = 0; i < 150; i++) {
        const a = random() * Math.PI * 2;
        const r = Math.sqrt(random()) * 98;
        const x = 118 + Math.cos(a) * r;
        const y = 124 + Math.sin(a) * r * 0.92;
        const length = 13 + random() * 11;
        const tone = Math.round(150 + 100 * random() * (1 - (y / size) * 0.4));
        g.save();
        g.translate(x, y);
        g.rotate(a + (random() - 0.5) * 1.6);
        g.fillStyle = `rgb(${tone},${tone},${tone})`;
        g.beginPath();
        g.ellipse(0, 0, length, length * 0.42, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = `rgba(0,0,0,0.25)`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(-length * 0.9, 0);
        g.lineTo(length * 0.9, 0);
        g.stroke();
        g.restore();
    }
    // A few twigs through the cluster.
    g.strokeStyle = "rgb(70,60,50)";
    g.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(118, 210);
        g.lineTo(118 + (random() - 0.5) * 160, 40 + random() * 120);
        g.stroke();
    }
    g.fillStyle = "#ffffff";
    g.fillRect(size - 48, 0, 48, 48);
    foliageTexture = new CanvasTexture(canvas);
    foliageTexture.colorSpace = SRGBColorSpace;
    foliageTexture.anisotropy = 4;
    return foliageTexture;
}

/** The shared foliage material: vertex colour × the instance's tint (leaves only), swaying with the wind above `windHeight`. */
function foliageMaterial(windAmount: number, windHeight: number, doubleSide = false, cards = false): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.88, metalness: 0, map: leafTexture()});
    if (doubleSide || cards) material.side = DoubleSide;
    if (cards) material.alphaTest = 0.45;
    const uniforms = {arkTime: ARK_TIME, arkWind: ARK_WIND, windAmount: {value: windAmount}, windHeight: {value: windHeight}, arkNearFade: ARK_NEAR_FADE};
    material.customProgramCacheKey = () => `ark-foliage-${doubleSide ? 2 : 1}-${cards ? "c" : "s"}-b4`;
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\nvarying float vArkCard;${cards ? ARK_NEAR_FADE_PARS : ""}`)
            // Trees beside the camera dissolve (batch 4: near-fade.ts), never a dark shard across the view. Only on the
            // leaf-card trees, which cut out already, so nothing else loses the early depth test.
            .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>${cards ? ARK_NEAR_FADE_CLIP : ""}`)
            // Foliage is lit from its own (soft) normals on both sides: never flipped dark on a back face.
            .replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
#ifdef DOUBLE_SIDED
normal *= faceDirection;
nonPerturbedNormal *= faceDirection;
#endif`)
            .replace("#include <map_fragment>", `#ifdef USE_MAP
diffuseColor *= mix(vec4(1.0), texture2D(map, vMapUv), vArkCard);
#endif`);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
attribute vec3 arkTint;
attribute float arkLeaf;
attribute float arkCard;
varying float vArkCard;
uniform float arkTime;
uniform vec2 arkWind;
uniform float windAmount;
uniform float windHeight;`)
            .replace("#include <color_vertex>", `#include <color_vertex>
vColor.rgb *= mix(vec3(1.0), arkTint, arkLeaf);
vArkCard = arkCard;`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>
{
    vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    // Frequencies make whole cycles in the shared clock's 600 s window (runtime lane), so every viewer sees the same phase.
    float sway = sin(arkTime * 1.49749 + root.x * 0.21 + root.z * 0.17) + 0.45 * sin(arkTime * 2.90074 + root.x * 0.53 - root.z * 0.31);
    float bend = pow(max(transformed.y, 0.0) / windHeight, 2.0) * windAmount * arkLeaf;
    transformed.xz += arkWind * sway * bend;
    // Leaves flutter on their own, faster and stronger in wind (graphics pass): trunk a little, crown more, leaves most.
    float gust = length(arkWind);
    transformed += vec3(sin(arkTime * 6.30413 + transformed.y * 3.1 + root.x), sin(arkTime * 5.09985 + transformed.x * 2.7 + root.z) * 0.6, cos(arkTime * 5.69675 + transformed.z * 2.9)) * 0.035 * arkCard * gust;
}`);
    };
    return material;
}

/**
 * Rocks (batch 1): the CC0 rock texture from the ground's array, projected three ways in world space (no stretching
 * on any face), moss on the dry tops, darker and glossy where the sea wets them, a pale salt line above that.
 */
function rockMaterial(): MeshStandardMaterial {
    const material = foliageMaterial(0, 1);
    material.map = null;
    const uniforms = {groundAlbedo: ARK_GROUND_TEXTURES.albedo, groundNormal: ARK_GROUND_TEXTURES.normal, groundReady: ARK_GROUND_TEXTURES.ready};
    const base = material.onBeforeCompile;
    material.customProgramCacheKey = () => "ark-rock-1";
    material.onBeforeCompile = (shader, renderer) => {
        base(shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vRockWorld;\nvarying vec3 vRockNormal;")
            .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
vRockWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
vRockNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
varying vec3 vRockWorld;
varying vec3 vRockNormal;
uniform highp sampler2DArray groundAlbedo;
uniform float groundReady;
${NOISE_GLSL}
float rockShadeH = 0.0;`)
            .replace("#include <color_fragment>", `#include <color_fragment>
{
    vec3 w = vRockWorld;
    vec3 n = normalize(vRockNormal);
    vec3 k = pow(abs(n), vec3(4.0));
    k /= (k.x + k.y + k.z);
    vec3 detail = vec3(1.0);
    if (groundReady > 0.5) {
        float s = 0.45;
        vec3 t = texture(groundAlbedo, vec3(w.zy * s, 5.0)).rgb * k.x + texture(groundAlbedo, vec3(w.xz * s, 5.0)).rgb * k.y + texture(groundAlbedo, vec3(w.xy * s, 5.0)).rgb * k.z;
        detail = t / vec3(0.227, 0.144, 0.08);
        detail = mix(vec3(dot(detail, vec3(0.3333))), detail, 0.35);
    }
    vec3 c = diffuseColor.rgb * detail;
    float top = smoothstep(0.55, 0.9, n.y) * smoothstep(0.4, 0.7, arkFbm(w.xz * 0.9 + w.y));
    float dry = smoothstep(0.35, 0.9, w.y);
    c = mix(c, vec3(0.2, 0.27, 0.1) * (0.7 + 0.6 * arkNoise(w.xz * 6.0)), top * dry * 0.8);
    float wet = 1.0 - smoothstep(0.1, 0.55, w.y);
    c *= mix(1.0, 0.55, wet);
    c = mix(c, c * 1.25 + 0.025, smoothstep(0.5, 0.58, w.y) * (1.0 - smoothstep(0.58, 0.75, w.y)) * 0.6);
    diffuseColor.rgb = c;
    rockShadeH = wet;
}`)
            .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.3, rockShadeH);`);
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
    /** The forest fill (graphics pass): the share of the extra trees drawn, 0…1, by tier. */
    setFill: (fraction: number) => void;
    /** Hide these decor kinds' own shapes (the asset library's trees stand in for them once loaded). */
    hideKinds: (kinds: Set<string>) => void;
    /**
     * Under the sea (batch 4): the reef's near and far versions re-sorted round the camera, the fish placed (only the
     * schools in the picture), the surge's clock run.
     */
    update: (camera: Object3D) => void;
    triangles: number;
    dispose: () => void;
};

function variantCount(kind: DecorKind): number {
    return SHAPES.filter((shape) => shape.kind === kind).length;
}

export function buildVegetation(maxGrass: number): Vegetation {
    const items = worldDecor();
    const fill = forestFill();
    const fillMeshes: Array<{mesh: InstancedMesh; base: number; extra: number; triangles: number}> = [];
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
        const own = items.filter((item) => item.kind === shape.kind && item.variant % variantCount(shape.kind) === shape.variant);
        const extra = fill.filter((item) => item.kind === shape.kind && item.variant % variantCount(shape.kind) === shape.variant);
        const mine = [...own, ...extra];
        if (!mine.length) continue;
        const geometry = shape.build();
        const cards = ["broadleaf", "rainforest", "acacia", "orchard", "canopy", "shrub"].includes(shape.kind);
        const material = shape.kind === "rock" ? rockMaterial() : foliageMaterial(shape.wind, shape.windHeight, shape.doubleSide, cards);
        const mesh = new InstancedMesh(geometry, material, mine.length);
        mesh.userData.kind = shape.kind;
        const tints = new Float32Array(mine.length * 3);
        mine.forEach((item, i) => {
            rotation.setFromAxisAngle(up, item.rotation);
            const s = item.scale;
            scale.set(s, shape.kind === "rock" ? s * rockSquash(item) : s, s);
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
        const perInstance = geometry.getAttribute("position").count / 3;
        triangles += perInstance * own.length;
        if (extra.length) fillMeshes.push({mesh, base: own.length, extra: extra.length, triangles: perInstance});
        meshes.push(mesh);
        materials.push(material);
    }

    // Grass.
    const tufts = grassTufts(maxGrass);
    const grassGeometry = tuft();
    // (Bent where a grazer bites or a walker steps: `grass-press.ts`, wired by the release.)
    const grassMaterial = withGrassPress(foliageMaterial(0.35, 0.6, true));
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
        tint.set(ZONE_PALETTES[t.zone].ground[0]).lerp(green, 0.5).lerp(dry, t.dry * 0.45).multiplyScalar(1.1);
        grassTints[i * 3] = tint.r;
        grassTints[i * 3 + 1] = tint.g;
        grassTints[i * 3 + 2] = tint.b;
    });
    grassGeometry.setAttribute("arkTint", new InstancedBufferAttribute(grassTints, 3));
    grass.count = tufts.length;
    grass.computeBoundingSphere();
    grass.receiveShadow = true;
    const grassTriangles = grassGeometry.getAttribute("position").count / 3;

    // Under the sea (graphics pass, batch 4): the reef and the ambient fish schools, decoration only.
    const reef = buildReef();
    const fish = new FishView();
    const seaView = new Vector3();
    meshes.push(...reef.meshes, ...fish.meshes);

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
        hideKinds: (kinds) => {
            for (const mesh of meshes) if (kinds.has(mesh.userData.kind)) mesh.visible = false;
        },
        setFill: (fraction) => {
            for (const entry of fillMeshes) entry.mesh.count = entry.base + Math.round(entry.extra * Math.min(Math.max(fraction, 0), 1));
            // The tier's share (1 / 0.6 / 0.3) pulls the reef's reaches in and thins the schools.
            reef.setReach(0.4 + 0.6 * fraction);
            fish.setTier(Math.max(fraction, 0.35), 0.5 + 0.5 * fraction);
        },
        update: (camera) => {
            camera.getWorldDirection(seaView);
            reef.update(camera.position);
            fish.update(camera.position, seaView);
        },
        get triangles() {
            return triangles + grassTriangles * grass.count + fillMeshes.reduce((sum, entry) => sum + (entry.mesh.count - entry.base) * entry.triangles, 0) + reef.triangles + fish.triangles;
        },
        dispose: () => {
            reef.dispose();
            fish.dispose();
            for (const mesh of [...meshes.filter((mesh) => !reef.meshes.includes(mesh) && !fish.meshes.includes(mesh)), grass]) {
                mesh.geometry.dispose();
                mesh.dispose();
            }
            materials.forEach((material) => material.dispose());
        }
    };
}
