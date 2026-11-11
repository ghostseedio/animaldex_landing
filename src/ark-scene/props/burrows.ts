/**
 * The ways in that den, burrow, cave and crevice animals sleep in (docs/ark/props.md, "Burrows and dens"): the
 * sleep lane walks such an animal into its roost's entrance and sinks it in (`sleep.ts` goesIntoRoost: a `burrow:`,
 * `burrow_entrance:` or `cave_mouth:` point), so the props draw the entrance there.
 * - **A burrow mouth:** a dark hole going down into the slope, with a lip of turned earth and a fan of spoil thrown
 *   out downhill.
 * - **A rock den:** a dark crevice at the foot of a rock, with a few fallen stones before it (a `cave_mouth:` point,
 *   or a crevice sleeper's).
 *
 * Each is sized to its animal's drawn body, seated on the ground's slope, and drawn only for an animal aboard. Where
 * it is comes from the scene's schedule (`scene-modules.ts` roostOf), the same for every viewer. Several animals
 * sharing one roost share one entrance, sized to the biggest.
 */

import {BufferGeometry, CircleGeometry, Color, CylinderGeometry, IcosahedronGeometry, SphereGeometry, Vector3} from "three";
import {LodBatch, lumpy, merge, paint, place, type PropInstance} from "@/ark-scene/props/kit";
import {seeded, hashString} from "@/ark-scene/world";

/** A way in to draw: its roost point (id and where), the animal's drawn length, its roost kind. */
export type DenEntrance = {point: string; x: number; y: number; z: number; nx: number; ny: number; nz: number; length: number; kind: string; slug: string};

/** Which roosts get an entrance drawn, and how (the sleep lane's ways in). */
export function entranceStyle(point: string | null, kind: string): "burrow" | "rock" | null {
    if (!point) return null;
    if (point.startsWith("cave_mouth:")) return "rock";
    if (point.startsWith("burrow:") || point.startsWith("burrow_entrance:")) return kind === "crevice" ? "rock" : "burrow";
    // A crevice sleeper on a rock's face: the crevice it tucks into, in that face.
    if (kind === "crevice" && point.startsWith("rock_face:")) return "rock";
    return null;
}

/** The mouth's radius for an animal drawn `length` metres long: it fits through, the hole a little wider than its body. */
export function mouthRadius(length: number): number {
    return Math.min(Math.max(length * 0.26, 0.07), 0.85);
}

const LIP = new Color("#7d6a50");
const SPOIL = new Color("#a08767");
const DARK = new Color("#0e0a07");
const STONE = new Color("#8a8379");

/**
 * A burrow mouth at radius 1 (instances scale it): the hole leans into the ground facing +z (downhill), its lip of
 * turned earth round the back, the spoil fanned out in front. Stands on y = 0.
 */
export function burrowMouth(seed = 31): BufferGeometry {
    const random = seeded(7300 + seed);
    const parts: BufferGeometry[] = [];
    // The hole: a dark oval flush with the ground, and its throat running down and back into the slope (open, seen
    // from inside: the material is two-sided), so it reads as depth from any camera above it.
    const mouth = new CircleGeometry(1, 22);
    mouth.rotateX(-Math.PI / 2);
    mouth.scale(1, 1, 0.72);
    parts.push(paint(place(mouth, 0, 0.015, 0), DARK, () => 1));
    const throat = new CylinderGeometry(0.98, 0.55, 1.4, 16, 1, true);
    throat.translate(0, -0.7, 0);
    throat.scale(1, 1, 0.72);
    throat.rotateX(-0.6);
    parts.push(paint(place(throat, 0, 0.02, -0.05), DARK, (y) => 0.6 + 0.4 * Math.max(0, 1 + y)));
    // The lip: low lumps of turned earth round the back and sides.
    for (let k = 0; k < 12; k++) {
        const a = Math.PI * 0.3 + (k / 11) * Math.PI * 1.4;
        const lump = new IcosahedronGeometry(0.22 + random() * 0.1, 1);
        lumpy(lump, 0.3, random);
        lump.scale(1.4, 0.38 + 0.2 * Math.max(0, -Math.cos(a)), 1.1);
        parts.push(paint(place(lump, Math.sin(a) * 1.15, 0.02, -Math.cos(a) * 0.9), LIP, (y) => 0.82 + y * 0.5));
    }
    // The spoil: loose, paler earth thrown out downhill, a low fan with clods in it.
    const fan = new SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    fan.scale(1.55, 0.16, 1.3);
    lumpy(fan, 0.15, random);
    parts.push(paint(place(fan, 0, -0.03, 1.6), SPOIL, (y, i) => 0.9 + ((i * 7) % 9) / 60 + y * 0.3));
    for (let k = 0; k < 9; k++) {
        const clod = new IcosahedronGeometry(0.07 + random() * 0.07, 0);
        lumpy(clod, 0.3, random);
        parts.push(paint(place(clod, (random() - 0.5) * 2.6, 0.06, 0.9 + random() * 1.8), SPOIL, () => 0.85 + random() * 0.2));
    }
    return merge(parts);
}

/** A rock den at radius 1: a dark crevice at the foot of a rock facing +z, a few fallen stones before it. */
export function rockDen(seed = 37): BufferGeometry {
    const random = seeded(7400 + seed);
    const parts: BufferGeometry[] = [];
    // The opening: a dark, tall, irregular slot.
    const slot = new SphereGeometry(1, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    slot.scale(0.7, 1.05, 0.45);
    lumpy(slot, 0.2, random);
    parts.push(paint(place(slot, 0, -0.05, -0.05), DARK, () => 1));
    // The rock round it: lumps framing the slot's sides and top.
    // Two leaning slabs and a capstone frame it, as a crevice between boulders (not a ring of stones).
    for (const [x, y, sx, sy, tilt] of [[-0.95, 0.45, 0.55, 1.1, 0.25], [0.95, 0.4, 0.6, 1.0, -0.3], [0.1, 1.15, 1.25, 0.45, 0.08]] as const) {
        const rock = new IcosahedronGeometry(1, 1);
        lumpy(rock, 0.22, random);
        rock.scale(sx, sy, 0.6);
        rock.rotateZ(tilt);
        parts.push(paint(place(rock, x, y, -0.35), STONE, (yy) => 0.76 + yy * 0.08));
    }
    // Fallen stones and a little worn earth before it.
    for (let k = 0; k < 6; k++) {
        const stone = new IcosahedronGeometry(0.12 + random() * 0.12, 0);
        lumpy(stone, 0.3, random);
        parts.push(paint(place(stone, (random() - 0.5) * 2, 0.05, 0.6 + random() * 1.1), STONE, () => 0.85 + random() * 0.15));
    }
    const worn = new SphereGeometry(1, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    worn.scale(1.2, 0.05, 1.0);
    parts.push(paint(place(worn, 0, -0.01, 0.9), SPOIL, () => 0.85));
    return merge(parts);
}

/** The entrances to draw, one per roost point (the biggest animal sizing it), each as an instance. */
export function entranceInstances(entrances: DenEntrance[]): {burrows: PropInstance[]; rocks: PropInstance[]; marks: Record<string, {x: number; y: number; z: number; facing: number}>} {
    const byPoint = new Map<string, DenEntrance>();
    for (const entrance of entrances) {
        const before = byPoint.get(entrance.point);
        if (!before || entrance.length > before.length || (entrance.length === before.length && entrance.slug < before.slug)) byPoint.set(entrance.point, entrance);
    }
    const burrows: PropInstance[] = [];
    const rocks: PropInstance[] = [];
    const marks: Record<string, {x: number; y: number; z: number; facing: number}> = {};
    for (const entrance of Array.from(byPoint.values()).sort((a, b) => a.point.localeCompare(b.point))) {
        const style = entranceStyle(entrance.point, entrance.kind);
        if (!style) continue;
        // Facing downhill (the ground's normal leans that way) or out of a rock's face; on level ground, a turn from its id.
        const flat = Math.hypot(entrance.nx, entrance.nz);
        const facing = flat > 0.05 ? Math.atan2(entrance.nx, entrance.nz) : ((hashString(entrance.point) % 628) / 100);
        // A burrow seated on the slope (its up most of the way to the ground's normal); a rock den stands upright.
        const up = style === "rock" ? new Vector3(0, 1, 0) : new Vector3(entrance.nx * 0.8, 0.2 + entrance.ny * 0.8, entrance.nz * 0.8).normalize();
        const item: PropInstance = {x: entrance.x, y: entrance.y - 0.02, z: entrance.z, turn: facing, scale: mouthRadius(entrance.length), up};
        (style === "rock" ? rocks : burrows).push(item);
        const key = `den:${entrance.slug}`;
        if (!marks[key]) marks[key] = {x: entrance.x, y: entrance.y, z: entrance.z, facing};
    }
    return {burrows, rocks, marks};
}

/** The entrances' batches (two draw calls near, none far). */
export function buildEntrances(entrances: DenEntrance[], material: import("three").Material): {batches: LodBatch[]; marks: Record<string, {x: number; y: number; z: number; facing: number}>} {
    const {burrows, rocks, marks} = entranceInstances(entrances);
    const batches: LodBatch[] = [];
    if (burrows.length) batches.push(new LodBatch("den-burrows", burrows, burrowMouth(), null, material, {cap: 40, reach: 0.9}));
    if (rocks.length) batches.push(new LodBatch("den-rocks", rocks, rockDen(), null, material, {cap: 24, reach: 0.9}));
    return {batches, marks};
}
