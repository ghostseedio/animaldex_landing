/**
 * The homes' doors and the ways to them (graphics pass 1, lane PROPS: the owner's "fishtanks outside houses are in
 * front of the door blocking it"). Pure, in the town's local frame, from the plan alone, so the buildings that draw the
 * doors, the gardens that keep clear of them and the tests that check it all read the same doors.
 *
 * - A house's front door stands near one end of its front (`houseDoorU`); a terrace home's front door at the end of
 *   its own share (the homes alternate, so two doors pair up), its back door to the yard 1.2 m off its share's middle;
 *   a block of flats has one front door, in the middle.
 * - Each door keeps an **apron** clear: its width and 0.4 m either side, 1.6 m out from the wall (the step, and room
 *   to step off it). A front door also keeps its **path** clear: 1.1 m wide, straight from the step to the front
 *   garden's edge on the street (where a gate stands in a front boundary).
 * - Nothing of a garden (a garden room with its tanks, a pond, a flower bed, a shrub, a bin, a bicycle) stands in an
 *   apron or on a path: the rule `clearOfDoors`, and `src/lib/ark-town-doors.test.ts` over every home on the island.
 */

import {corners, hashText, inBox, local, segmentDistance, sub, toLocal, type Box, type Pt} from "@/ark-scene/islands/town/geom";
import {townPlan, type Building, type Parcel, type TownPlan} from "@/ark-scene/islands/town/plan";

export type HomeDoor = {
    building: string;
    /** The home it opens (a terrace's 0-3; a house's and a block's 0). */
    home: number;
    side: "front" | "back";
    /** Along the building's front (its local x, m), and the door's width (m). */
    u: number;
    w: number;
};

/** A house's front door: 1.4 m in from one end of its front, the end by the house's own hash (`render/buildings.ts`). */
export function houseDoorU(b: Pick<Building, "id" | "at">): number {
    return (hashText(`${b.id}|door`) % 2 ? -1 : 1) * (b.at.w / 2 - 1.4);
}

/** A terrace home's front door: at the end of its share, alternating, so the doors of two homes pair up. */
export function terraceDoorU(b: Pick<Building, "at" | "households">, k: number): number {
    const homeW = b.at.w / b.households;
    const mid = -b.at.w / 2 + homeW * k + homeW / 2;
    return mid + (k % 2 ? 1 : -1) * (homeW / 2 - 0.9);
}

/** A terrace home's back door to its yard (building local x): 1.2 m off its share's middle. */
export function terraceBackDoorU(b: Pick<Building, "at" | "households">, k: number): number {
    const homeW = b.at.w / b.households;
    const mid = -b.at.w / 2 + homeW * k + homeW / 2;
    return mid - 1.2;
}

/** The doors of a home building (houses, terraces, flats); none for anything else. */
export function homeDoors(b: Building): HomeDoor[] {
    if (b.kind === "house") return [{building: b.id, home: 0, side: "front", u: houseDoorU(b), w: 1.0}];
    if (b.kind === "flats") return [{building: b.id, home: 0, side: "front", u: 0, w: 1.6}];
    if (b.kind !== "terrace") return [];
    const out: HomeDoor[] = [];
    for (let k = 0; k < b.households; k++) {
        out.push({building: b.id, home: k, side: "front", u: terraceDoorU(b, k), w: b.shopfront ? 0.95 : 1.0});
        out.push({building: b.id, home: k, side: "back", u: terraceBackDoorU(b, k), w: 0.9});
    }
    return out;
}

/** How far each side of a door its apron reaches (m), and how far out from the wall. */
export const APRON = {side: 0.4, out: 1.6};
/** A front path's width (m). */
export const PATH_WIDTH = 1.1;

/** A door's apron: its width plus `APRON.side` each side, `APRON.out` m out from its wall. */
export function doorApron(b: Building, door: HomeDoor): Box {
    const s = door.side === "front" ? 1 : -1;
    return sub(b.at, door.u, s * (b.at.d / 2 + APRON.out / 2), door.w + APRON.side * 2, APRON.out);
}

/**
 * A front door's path: from its wall straight out to the front garden's street edge (its parcel's `front`, or the
 * parcel's own front edge), `PATH_WIDTH` wide; null for a back door or a home with no front garden in front of it.
 */
export function frontPath(b: Building, door: HomeDoor, parcel: Parcel | null): Box | null {
    if (door.side !== "front" || !parcel) return null;
    const area = parcel.front ?? parcel.at;
    // The garden's street edge in the building's frame (the parcels face their street as the buildings do).
    let edge = -Infinity;
    for (const c of corners(area)) edge = Math.max(edge, toLocal(b.at, c.x, c.z).z);
    const from = b.at.d / 2;
    if (edge - from < 0.3) return null;
    // (A block of flats round a courtyard with its door on the court (no front garden): the court's own paving, no path.)
    if (!parcel.front && edge - from > 6) return null;
    return sub(b.at, door.u, (from + edge) / 2, PATH_WIDTH, edge - from);
}

/** Where a front path meets the street edge: its gate's middle (for a boundary's opening). */
export function pathGate(b: Building, path: Box): Pt {
    const l = toLocal(b.at, path.x, path.z);
    return local(b.at, l.x, l.z + path.d / 2);
}

export type DoorWay = {building: string; door: HomeDoor; apron: Box; path: Box | null; gate: Pt | null};

let ways: DoorWay[] | null = null;

/** Every home door on the island with its apron and its path (the plan's). */
export function townDoorWays(plan: TownPlan = townPlan()): DoorWay[] {
    if (ways && plan === townPlan()) return ways;
    const parcels = new Map<string, Parcel>();
    for (const p of plan.parcels) parcels.set(p.building, p);
    const out: DoorWay[] = [];
    for (const b of plan.buildings) {
        for (const door of homeDoors(b)) {
            const path = frontPath(b, door, parcels.get(b.id) ?? null);
            out.push({building: b.id, door, apron: doorApron(b, door), path, gate: path ? pathGate(b, path) : null});
        }
    }
    if (plan === townPlan()) ways = out;
    return out;
}

/** A box's four corners (`corners`' order and sums: geom.ts `local`), x then z, into `out` (load-alloc: no objects). */
function cornersInto(q: Box, out: Float64Array): void {
    const hw = q.w / 2;
    const hd = q.d / 2;
    const c = Math.cos(q.rot);
    const s = Math.sin(q.rot);
    out[0] = q.x + -hw * c - -hd * s;
    out[1] = q.z + -hw * s + -hd * c;
    out[2] = q.x + hw * c - -hd * s;
    out[3] = q.z + hw * s + -hd * c;
    out[4] = q.x + hw * c - hd * s;
    out[5] = q.z + hw * s + hd * c;
    out[6] = q.x + -hw * c - hd * s;
    out[7] = q.z + -hw * s + hd * c;
}
const cornersA = new Float64Array(8);
const cornersB = new Float64Array(8);
/** The least and most of four corners along (ax, az), into `spanOut`. */
const spanOut = new Float64Array(2);
function spanOf(q: Float64Array, ax: number, az: number): void {
    let lo = Infinity;
    let hi = -Infinity;
    for (let k = 0; k < 8; k += 2) {
        const v = q[k] * ax + q[k + 1] * az;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
    }
    spanOut[0] = lo;
    spanOut[1] = hi;
}

/** Two turned boxes overlap (separating axes), each grown by `margin` m. */
export function boxesOverlap(a: Box, b: Box, margin = 0): boolean {
    // (Load-alloc: each box's corners once, not twice an axis, and no array of axes, spans or corners: the placement of
    // the town's things asks this some millions of times.)
    cornersInto(a, cornersA);
    cornersInto(b, cornersB);
    for (let k = 0; k < 4; k++) {
        const axis = k === 0 ? a.rot : k === 1 ? a.rot + Math.PI / 2 : k === 2 ? b.rot : b.rot + Math.PI / 2;
        const ax = Math.cos(axis);
        const az = Math.sin(axis);
        spanOf(cornersA, ax, az);
        const a0 = spanOut[0];
        const a1 = spanOut[1];
        spanOf(cornersB, ax, az);
        const b0 = spanOut[0];
        const b1 = spanOut[1];
        if (a1 + margin < b0 || b1 + margin < a0) return false;
    }
    return true;
}

/** A box (or, with `w = d = 0`, a point with a radius) that keeps clear of every door's apron and path near it. */
export function clearOfDoors(item: Box, margin = 0, plan: TownPlan = townPlan()): boolean {
    const r = Math.hypot(item.w, item.d) / 2 + 12;
    for (const way of townDoorWays(plan)) {
        if (Math.abs(way.apron.x - item.x) > r + 20 || Math.abs(way.apron.z - item.z) > r + 20) continue;
        if (boxesOverlap(item, way.apron, margin)) return false;
        if (way.path && boxesOverlap(item, way.path, margin)) return false;
    }
    return true;
}

/** A point's footprint as a box (a shrub's, a bin's, a bike's): `size` m square. */
export function spotBox(p: Pt, size: number, rot = 0): Box {
    return {x: p.x, z: p.z, w: size, d: size, rot};
}

/** Whether a point lies on a door's apron or path (with `margin`). */
export function onDoorWay(x: number, z: number, margin = 0, plan: TownPlan = townPlan()): boolean {
    for (const way of townDoorWays(plan)) {
        if (inBox(way.apron, x, z, margin)) return true;
        if (way.path && inBox(way.path, x, z, margin)) return true;
    }
    return false;
}

/**
 * Where front paths cross a boundary line (a front wall, hedge or railings): each crossing's point, with half a gate's
 * width (the path's and a little), for the boundary's gate (`render/fences.ts`).
 */
export function pathOpenings(line: readonly Pt[], plan: TownPlan = townPlan()): Array<{x: number; z: number; half: number}> {
    const out: Array<{x: number; z: number; half: number}> = [];
    for (const way of townDoorWays(plan)) {
        if (!way.path) continue;
        const p = way.path;
        // The path's middle line, a little past both its ends.
        const a = local(p, 0, -p.d / 2 - 0.2);
        const b = local(p, 0, p.d / 2 + 0.6);
        for (let i = 1; i < line.length; i++) {
            const c = line[i - 1];
            const d = line[i];
            const r = {x: b.x - a.x, z: b.z - a.z};
            const s = {x: d.x - c.x, z: d.z - c.z};
            const den = r.x * s.z - r.z * s.x;
            if (Math.abs(den) < 1e-9) continue;
            const t = ((c.x - a.x) * s.z - (c.z - a.z) * s.x) / den;
            const u = ((c.x - a.x) * r.z - (c.z - a.z) * r.x) / den;
            if (t < 0 || t > 1 || u < 0 || u > 1) continue;
            out.push({x: a.x + r.x * t, z: a.z + r.z * t, half: PATH_WIDTH / 2 + 0.08});
        }
    }
    return out;
}

/**
 * p2 (town2): a thing left by a home (a bin, a bicycle) stands clear of every building's walls (the owner: "some of
 * the bins are rendering into the house walls": a semi's bin was put on the side its neighbour is joined on, a
 * terrace's into its own front wall), of the garden boundaries (walls, hedges, fences: `margin` from their line), of
 * the doors' aprons and paths, and of the others already placed (`taken`).
 */
export function clearForItem(item: Box, taken: readonly Box[], plan: TownPlan = townPlan(), margin = 0.12): boolean {
    const reach = Math.hypot(item.w, item.d) / 2 + margin;
    for (const b of plan.buildings) {
        if (Math.abs(b.at.x - item.x) > reach + Math.max(b.at.w, b.at.d)) continue;
        if (Math.abs(b.at.z - item.z) > reach + Math.max(b.at.w, b.at.d)) continue;
        if (boxesOverlap(item, b.at, margin)) return false;
    }
    for (const h of plan.hedges) {
        for (let i = 1; i < h.line.length; i++) {
            const a = h.line[i - 1];
            const c = h.line[i];
            if (segmentDistance(item.x, item.z, a.x, a.z, c.x, c.z) < reach + 0.1) {
                // The line's distance to the box itself, not its middle: sample the box's edges.
                for (const q of [...corners(item), {x: item.x, z: item.z}]) if (segmentDistance(q.x, q.z, a.x, a.z, c.x, c.z) < margin + 0.15) return false;
                if (segmentCrossesBox(a, c, item)) return false;
            }
        }
    }
    if (!clearOfDoors(item, 0, plan)) return false;
    for (const t of taken) if (boxesOverlap(item, t, 0.08)) return false;
    return true;
}

function segmentCrossesBox(a: Pt, c: Pt, b: Box): boolean {
    const p = toLocal(b, a.x, a.z);
    const q = toLocal(b, c.x, c.z);
    for (let k = 0; k <= 8; k++) {
        const x = p.x + ((q.x - p.x) * k) / 8;
        const z = p.z + ((q.z - p.z) * k) / 8;
        if (Math.abs(x) <= b.w / 2 && Math.abs(z) <= b.d / 2) return true;
    }
    return false;
}

/**
 * A model's heading in three.js (`Object3D.rotation.y`, the instanced sets' `turn`: the model's +z goes to
 * (sin t, cos t)) for a direction in a box's own frame (+lx along the front, +lz out of it): the plan's `rot` turns the
 * other way (`geom.ts` local), so a box at `rot` has its +lz at three's `-rot`.
 */
export function headingAlong(b: Pick<Box, "rot">, axis: "front" | "out"): number {
    return axis === "out" ? -b.rot : Math.PI / 2 - b.rot;
}

/** The footprint (a plan box) of a thing whose three.js heading is `turn`: `length` along its heading, `width` across. */
export function headingBox(p: Pt, turn: number, length: number, width: number): Box {
    return {x: p.x, z: p.z, w: width, d: length, rot: -turn};
}
