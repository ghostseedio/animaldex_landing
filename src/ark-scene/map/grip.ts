/**
 * Grip points (the owner's brief, section 2; the rig player's sloth shot):
 * a hanger, climber or percher holds its branch, trunk or ledge with its
 * feet, claws or hands, so those are what touch the surface, not the
 * model's middle or its bounding box. From the rig's foot bones (their rest
 * positions, carried through the clip's frame by its bone matrices); with no
 * rig the model's underside (its bounds) stands in, as before.
 *
 * Pure: `index.ts` places the model with it and the validator
 * (`validate.ts`, `validateGrips`) checks the same numbers. The rig player
 * (`rig-player.ts`) only keeps each rig's grip bones (`gripBones`) when it
 * loads one.
 */

import {Vector3, type Bone, type BufferGeometry, type SkinnedMesh} from "three";

/** A rig bone that grips: a foot, a hand, a paw, a claw, a toe (never a wing's "hand" or a fin). */
export const GRIP_BONE = /^(?!.*(?:wing|fin|flipper)).*(?:foot|hand|paw|claw|toe|wrist|ankle)/i;

export type Vec3 = {x: number; y: number; z: number};

/** A rig's bone matrices: per row (a frame), per bone, the 3×4 rows (rest pose in the model's space to that frame), as numbers. */
export type BoneRows = {bones: number; at: (row: number, bone: number, element: number) => number};

/** A grip bone's rest position at a frame row (model units). */
export function bonePoint(rows: BoneRows, row: number, bone: number, rest: Vec3): Vec3 {
    const m = (axis: number) => rows.at(row, bone, axis * 4) * rest.x + rows.at(row, bone, axis * 4 + 1) * rest.y + rows.at(row, bone, axis * 4 + 2) * rest.z + rows.at(row, bone, axis * 4 + 3);
    return {x: m(0), y: m(1), z: m(2)};
}

/** The middle of the grip bones at a frame row (model units), or null when the rig has none. */
export function gripCentroid(rows: BoneRows, row: number, grips: Array<{bone: number; rest: Vec3}>): Vec3 | null {
    if (!grips.length) return null;
    const sum = {x: 0, y: 0, z: 0};
    for (const grip of grips) {
        const p = bonePoint(rows, row, grip.bone, grip.rest);
        sum.x += p.x;
        sum.y += p.y;
        sum.z += p.z;
    }
    return {x: sum.x / grips.length, y: sum.y / grips.length, z: sum.z / grips.length};
}

/**
 * The supporting grips at a frame row: the grip bones within `tolerance`
 * (model units) of the lowest one (the feet down on the surface; a raised
 * leg is not among them), their middle and how many. The scene puts that
 * middle on the surface.
 */
export function gripSupport(rows: BoneRows, row: number, grips: Array<{bone: number; rest: Vec3}>, tolerance: number): {centre: Vec3; count: number} | null {
    if (!grips.length) return null;
    const points = grips.map((grip) => bonePoint(rows, row, grip.bone, grip.rest));
    const lowest = Math.min(...points.map((p) => p.y));
    const down = points.filter((p) => p.y <= lowest + tolerance);
    const centre = {x: 0, y: 0, z: 0};
    for (const p of down) {
        centre.x += p.x / down.length;
        centre.y += p.y / down.length;
        centre.z += p.z / down.length;
    }
    return {centre, count: down.length};
}

/** How close to the lowest grip a supporting one is: this share of the body's longest side. */
export const GRIP_TOLERANCE = 1 / 16;

/**
 * How far each grip bone is from the surface its middle is put on (model
 * units, along the model's up, which the scene turns to the surface's
 * normal): 0 for all of them on a flat surface.
 */
export function gripSpread(rows: BoneRows, row: number, grips: Array<{bone: number; rest: Vec3}>): number {
    const centre = gripCentroid(rows, row, grips);
    if (!centre) return 0;
    let worst = 0;
    for (const grip of grips) worst = Math.max(worst, Math.abs(bonePoint(rows, row, grip.bone, grip.rest).y - centre.y));
    return worst;
}

/** The rig's grip bones (GRIP_BONE) and where each is at rest, in the model's space. */
export function gripBones(mesh: SkinnedMesh, boneNames: string[]): Array<{bone: number; rest: Vec3}> {
    const out: Array<{bone: number; rest: Vec3}> = [];
    const at = new Vector3();
    for (const bone of mesh.skeleton.bones as Bone[]) {
        const index = boneNames.indexOf(bone.name);
        if (index < 0 || !GRIP_BONE.test(bone.name)) continue;
        bone.getWorldPosition(at);
        out.push({bone: index, rest: {x: at.x, y: at.y, z: at.z}});
    }
    return out;
}

/** Float16 to float (the rig's bone matrices; as `rig-player.ts` halfToFloat, kept here so the two modules do not import each other). */
function half(h: number): number {
    const s = h & 0x8000 ? -1 : 1;
    const e = (h >> 10) & 0x1f;
    const f = h & 0x3ff;
    if (e === 0) return s * 2 ** -14 * (f / 1024);
    if (e === 31) return f ? NaN : s * Infinity;
    return s * 2 ** (e - 15) * (1 + f / 1024);
}

/** A loaded rig's bone matrices as the grip functions read them. */
export function boneRows(model: {bones: number; data: Uint16Array}): BoneRows {
    return {bones: model.bones, at: (row, bone, element) => half(model.data[row * model.bones * 12 + bone * 12 + element])};
}

const gripSize = new Vector3();

/**
 * Where a loaded rig's supporting grip bones' middle is (model units) between
 * two frame rows (`rig-player.ts` clipRows: the rows and how far between),
 * or null with no grip bones: what a hanger, climber or percher puts on its
 * branch (`index.ts`).
 */
export function gripPoint(model: {bones: number; data: Uint16Array; grips: Array<{bone: number; rest: Vec3}>; geometry: BufferGeometry}, rows: [number, number, number], out: Vector3): Vector3 | null {
    const [r0, r1, t] = rows;
    const bones = boneRows(model);
    const size = model.geometry.boundingBox ? model.geometry.boundingBox.getSize(gripSize) : gripSize.set(1, 1, 1);
    const tolerance = Math.max(size.x, size.y, size.z) * GRIP_TOLERANCE;
    // The feet down on the surface (a raised leg is not among them).
    const a = gripSupport(bones, r0, model.grips, tolerance)?.centre;
    const b = gripSupport(bones, r1, model.grips, tolerance)?.centre;
    if (!a || !b) return null;
    return out.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
}
