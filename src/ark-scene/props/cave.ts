/**
 * The mountain's cave (the owner's brief, section 6): a rock hood with an
 * arched mouth set into a steep rise (the sampler's `place("cave")`), a chamber
 * behind it that goes dark toward the back (the light only reaches the
 * front: its walls are shaded darker with depth, so it reads dark even
 * without shadows), damp glossy walls, stalactites and stalagmites, and,
 * when bats are aboard, their roost: a stained patch of ceiling over a heap
 * of guano. Icicles hang from the mouth's lip in the cold.
 *
 * In its own frame: the mouth at the origin on the ground, +z out of it
 * (downhill), the chamber behind (−z) under the hill. The bats themselves
 * are animals (the map lane's roost points); `CAVE_ROOST` is where they hang.
 */

import {BackSide, BufferGeometry, Color, DodecahedronGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3} from "three";
import {keepTriangles, LodPiece, lumpy, merge, paint, place, propMaterial, type PropsTier} from "@/ark-scene/props/kit";
import {caveSite} from "@/ark-scene/props/sampler";
import * as shapes from "@/ark-scene/props/shapes";
import {seeded} from "@/ark-scene/world";

/** The chamber: an ellipsoid's middle and radii, in the cave's frame. */
const CHAMBER = {cx: 0, cy: 0.5, cz: -3.3, rx: 3.1, ry: 2.7, rz: 3.9};
/** The mouth: an arch `w` wide and `h` high. */
const MOUTH = {w: 2.1, h: 2.5};
/** Where the bats hang (the cave's frame): the chamber's ceiling, a little in from the mouth. */
export const CAVE_ROOST = new Vector3(0.4, CHAMBER.cy + CHAMBER.ry * 0.93, -2.6);

const inArch = (x: number, y: number, w: number, h: number) => y < 0.15 ? Math.abs(x) < w : (x / w) ** 2 + ((y - 0.15) / h) ** 2 < 1;

export type Cave = {
    group: Group;
    pieces: LodPiece[];
    /** The cave's frame in the world. */
    origin: Vector3;
    facing: number;
    /** A point in the world from the cave's frame. */
    toWorld: (local: Vector3) => Vector3;
    setRoost: (on: boolean) => void;
    setIcicles: (amount: number) => void;
    dispose: () => void;
};

export function buildCave(tier: PropsTier): Cave {
    const site = caveSite();
    const random = seeded(77117);
    const group = new Group();
    group.name = "props:cave";
    group.position.set(site.x, site.y, site.z);
    group.rotation.y = site.facing;
    group.updateMatrixWorld(true);
    const rock = new Color("#8b8274");
    const damp = new Color("#6c6458");

    // The outcrop: a lumpy massif of rock round the chamber, cut open at the mouth, its foot sunk into the ground.
    const outerShell = new SphereGeometry(1, 40, 24);
    outerShell.scale(CHAMBER.rx * 1.4, CHAMBER.ry * 1.3, CHAMBER.rz * 1.22);
    lumpy(outerShell, 0.28, random);
    outerShell.translate(CHAMBER.cx, CHAMBER.cy, CHAMBER.cz);
    {
        // Ledges: the massif's faces stepped a little, like bedded rock.
        const position = outerShell.getAttribute("position");
        for (let i = 0; i < position.count; i++) {
            const y = position.getY(i);
            const step = Math.floor(y / 0.7) * 0.7;
            const k = 1 + 0.06 * Math.sin(step * 5.1 + i * 0.001) - 0.05 * ((y - step) / 0.7);
            position.setX(i, position.getX(i) * k);
            position.setZ(i, CHAMBER.cz + (position.getZ(i) - CHAMBER.cz) * k);
        }
    }
    const outer = paint(keepTriangles(outerShell, (x, y, z) => !(z > -1.2 && inArch(x, y, MOUTH.w + 0.25, MOUTH.h + 0.25)) && y > -1.2), rock, (y, i) => 0.62 + 0.14 * Math.max(Math.min(y / 3, 1), 0) + ((i * 7) % 9) / 40);

    // The chamber's inside, darker with depth (the light reaches only the front), seen from within.
    const innerShell = new SphereGeometry(1, 30, 18);
    innerShell.scale(CHAMBER.rx, CHAMBER.ry, CHAMBER.rz);
    lumpy(innerShell, 0.1, random);
    innerShell.translate(CHAMBER.cx, CHAMBER.cy, CHAMBER.cz);
    const depthShade = (z: number) => 1 - 0.88 * Math.min(Math.max((-z - 0.2) / 5.2, 0), 1);
    const inner = paint(keepTriangles(innerShell, (x, y, z) => !(z > -1.6 && inArch(x, y, MOUTH.w, MOUTH.h)) && y > -0.05), damp, (y, i, x, z) => depthShade(z) * (0.75 + ((i * 5) % 7) / 30 + 0.15 * Math.sin(y * 6 + x * 3)));

    // The floor: a slab of rock and grit, darker inward.
    const floorGeometry = new SphereGeometry(1, 24, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    floorGeometry.scale(CHAMBER.rx * 0.98, 0.12, CHAMBER.rz * 1.1);
    lumpy(floorGeometry, 0.05, random);
    floorGeometry.translate(0, 0.0, CHAMBER.cz + 0.4);
    const floor = paint(floorGeometry, new Color("#4a443c"), (_, i, x, z) => depthShade(z - 0.8) * (0.7 + ((i * 3) % 5) / 30));

    // The arch: boulders along the mouth's rim, joining the hood to the chamber.
    const rim: BufferGeometry[] = [];
    for (let k = 0; k <= 14; k++) {
        const t = (k / 14) * Math.PI;
        const x = Math.cos(t) * (MOUTH.w + 0.15);
        const y = 0.15 + Math.sin(t) * (MOUTH.h + 0.1);
        const boulder = new DodecahedronGeometry(0.3 + random() * 0.18, 1);
        lumpy(boulder, 0.22, random);
        rim.push(paint(place(boulder, x * 1.08, y + 0.1, -1.0 + random() * 0.2), rock, (yy, i) => 0.68 + ((i * 7) % 9) / 40 + 0.05 * yy));
    }
    // Boulders fallen round the outcrop's foot.
    for (let k = 0; k < 14; k++) {
        const a = random() * Math.PI * 2;
        if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI / 2) < 0.5) continue;
        const reach = 1.05 + random() * 0.25;
        const boulder = new DodecahedronGeometry(0.4 + random() * 0.8, 1);
        lumpy(boulder, 0.3, random);
        rim.push(paint(place(boulder, Math.cos(a) * CHAMBER.rx * 1.4 * reach, 0.1, CHAMBER.cz + Math.sin(a) * CHAMBER.rz * 1.22 * reach), rock, (_, i) => 0.62 + ((i * 7) % 9) / 38));
    }
    // The rock face round the mouth: big slabs and boulders, the cliff the cave opens in.
    for (let k = 0; k < 16; k++) {
        const x = (random() * 2 - 1) * 4.6;
        const y = random() * 3.9;
        if (inArch(x, y, MOUTH.w + 0.7, MOUTH.h + 0.6)) continue;
        const slab = new DodecahedronGeometry(0.7 + random() * 0.7, 1);
        lumpy(slab, 0.3, random);
        slab.scale(1.2, 0.8, 0.6);
        rim.push(paint(place(slab, x, y, -0.8 - random() * 0.5, (random() - 0.5) * 0.6), rock, (yy, i) => 0.6 + ((i * 7) % 9) / 35 + 0.04 * yy));
    }
    for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
            const boulder = new DodecahedronGeometry(0.55 + random() * 0.3, 1);
            lumpy(boulder, 0.25, random);
            rim.push(paint(place(boulder, side * (MOUTH.w + 0.5 + k * 0.6), 0.2 + random() * 0.3, -0.4 + k * 0.3), rock, (_, i) => 0.7 + ((i * 7) % 9) / 40));
        }
    }

    // Stalactites from the ceiling (longer further in), stalagmites under some of them.
    const formations: BufferGeometry[] = [];
    let made = 0;
    for (let tries = 0; tries < 400 && made < 34; tries++) {
        const d = new Vector3(random() * 2 - 1, 0.35 + random() * 0.65, random() * 2 - 1).normalize();
        const p = new Vector3(CHAMBER.cx + d.x * CHAMBER.rx * 0.95, CHAMBER.cy + d.y * CHAMBER.ry * 0.95, CHAMBER.cz + d.z * CHAMBER.rz * 0.95);
        if (p.z > -0.9) continue;
        const depth = Math.min(Math.max(-p.z / 6, 0), 1);
        const length = 0.25 + random() * (0.4 + 0.8 * depth);
        const hanging = shapes.stalactite(length, false, made);
        formations.push(paint(place(hanging, p.x, p.y + 0.05, p.z), new Color("#b5a184"), (y, i) => depthShade(p.z) * (0.75 + 0.35 * (1 + y / length) + ((i * 3) % 5) / 40)));
        made++;
        if (made % 3 === 0) {
            const groundY = 0.05;
            const height = 0.15 + random() * 0.45;
            if ((p.x / (CHAMBER.rx * 0.85)) ** 2 + ((p.z - CHAMBER.cz) / (CHAMBER.rz * 0.85)) ** 2 < 1) {
                formations.push(paint(place(shapes.stalactite(height, true, made), p.x, groundY, p.z), new Color("#a8957a"), (y) => depthShade(p.z) * (0.75 + 0.3 * (y / height))));
            }
        }
    }

    const outerMaterial = propMaterial({cold: true, texture: 5, textureScale: 0.45, flatShading: true});
    const innerMaterial = propMaterial({roughness: 0.4, texture: 5, textureScale: 0.6});
    innerMaterial.side = BackSide;
    const insideMaterial = propMaterial({roughness: 0.38, texture: 5, textureScale: 0.9, textureStrength: 0.6});
    const centre = new Vector3(0, 1, -2).applyMatrix4(group.matrixWorld);
    const pieces = [
        new LodPiece("cave-hood", centre, merge([outer, ...rim]), null, outerMaterial, {near: 200, far: 0, shadow: true}),
        new LodPiece("cave-chamber", centre, inner, null, innerMaterial, {near: 90, far: 0}),
        new LodPiece("cave-formations", centre, merge([floor, ...formations]), null, insideMaterial, {near: 60, far: 0})
    ];
    // Pieces are in the cave's frame: their meshes go under the group.
    for (const piece of pieces) {
        piece.setTier(tier);
        piece.add(group);
    }

    // The roost: a dark, stained patch of ceiling and guano heaped under it (only when bats are aboard).
    const stain = new SphereGeometry(0.9, 12, 6);
    stain.scale(1.1, 0.12, 0.9);
    const roostGeometry = merge([
        paint(place(stain, CAVE_ROOST.x, CAVE_ROOST.y - 0.06, CAVE_ROOST.z), new Color("#2d261f"), () => 0.9),
        place(shapes.heap(0.7, 0.16, "#3f372d", 3, 0.2), CAVE_ROOST.x, 0.04, CAVE_ROOST.z)
    ]);
    const roost = new Mesh(roostGeometry, insideMaterial);
    roost.visible = false;
    group.add(roost);

    // Icicles along the lip of the mouth.
    const icicleParts: BufferGeometry[] = [];
    for (let k = 0; k < 16; k++) {
        const a = 0.25 + (k / 15) * (Math.PI - 0.5);
        const x = Math.cos(a) * (MOUTH.w - 0.05);
        const y = 0.15 + Math.sin(a) * (MOUTH.h - 0.12);
        icicleParts.push(place(shapes.icicle(0.25 + random() * 0.45), x, y, -0.55 - random() * 0.2));
    }
    const ice = new Mesh(merge(icicleParts), new MeshStandardMaterial({vertexColors: true, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85}));
    ice.visible = false;
    group.add(ice);

    return {
        group,
        pieces,
        origin: new Vector3(site.x, site.y, site.z),
        facing: site.facing,
        toWorld: (local) => local.clone().applyMatrix4(group.matrixWorld),
        setRoost: (on) => {
            roost.visible = on;
        },
        setIcicles: (amount) => {
            ice.visible = amount > 0.3;
        },
        dispose: () => {
            for (const piece of pieces) piece.dispose();
            roostGeometry.dispose();
            ice.geometry.dispose();
            (ice.material as MeshStandardMaterial).dispose();
            outerMaterial.dispose();
            innerMaterial.dispose();
            insideMaterial.dispose();
        }
    };
}
