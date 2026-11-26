/**
 * SIG8: the parts of a town building drawn past its footprint that stand on the ground: a house's bay window (0.9 m out)
 * and its open porch's two cheeks (to 1.45 m out), a terrace's bays, the church's buttresses and porch, a tower's
 * podium, shopfront pilasters, a lodge's or a kiosk's posts. The colliders (`colliders.ts`) had each building as its
 * footprint's box only, so a body could be placed inside a bay: a brown tabby asleep in a front garden lay 8 of its 41
 * points inside the bay's sill and wall (the seat audit, PR #131), its bed picked clear of the footprint's box.
 *
 * From the source that draws them (never a copied number): each building is drawn (`render/buildings.ts`
 * buildBuilding) into a recorder that keeps the boxes and cylinders, not their triangles. Kept: a part whose foot is on
 * the ground (within `FOOT` of it), that rises at least `RISE` (a doorstep or a plinth is stepped onto, not walked round:
 * the seat pass sets a body on it), and that reaches more than `PAST` beyond the footprint (a downpipe, a door case or a pilaster against the wall is the wall's). Pure in the plan.
 */

import {townHeight} from "@/ark-scene/islands/town/ground";
import {townPlan, type Building, type TownPlan} from "@/ark-scene/islands/town/plan";
import {buildBuilding} from "@/ark-scene/islands/town/render/buildings";
import {at, NullGeo, type Frame} from "@/ark-scene/islands/town/render/kit";

/** A part's foot is this near the ground at its middle (m). */
const FOOT = 0.5;
/** A part at least this tall above the ground is walked round (m). */
const RISE = 0.3;
/** A part this far past the footprint, or less, is the footprint's (m): no body fits between it and the wall. */
const PAST = 0.25;

/** A part in the town's frame: a box (middle, half sizes along its own turned axes) or a post. */
export type BuildingPart =
    | {building: string; shape: "box"; x: number; z: number; rot: number; hw: number; hd: number; base: number; top: number}
    | {building: string; shape: "circle"; x: number; z: number; r: number; base: number; top: number};

type Drawn = {shape: "box"; x: number; y: number; z: number; rot: number; w: number; h: number; d: number} | {shape: "circle"; x: number; y: number; z: number; r: number; h: number};

/** Keeps the boxes and cylinders drawn on it (their places only: nothing is drawn). */
class PartRecorder extends NullGeo {
    readonly drawn: Drawn[] = [];

    override box(frame: Frame, lx: number, ly0: number, lz: number, w: number, h: number, d: number, _colour: [number, number, number], turn = 0) {
        const p = at(frame, lx, ly0, lz);
        this.drawn.push({shape: "box", x: p[0], y: p[1], z: p[2], rot: frame.rot + turn, w, h, d});
    }

    override cylinder(frame: Frame, lx: number, y: number, lz: number, r0: number, r1: number, h: number) {
        const p = at(frame, lx, y, lz);
        this.drawn.push({shape: "circle", x: p[0], y: p[1], z: p[2], r: Math.max(r0, r1), h});
    }
}

/** How far a point is past a building's footprint (m; negative inside). */
function pastFootprint(b: Building, x: number, z: number): number {
    const c = Math.cos(b.at.rot);
    const s = Math.sin(b.at.rot);
    const dx = x - b.at.x;
    const dz = z - b.at.z;
    // (The town's frame turns a box by +rot: `geom.ts` local.)
    const lx = dx * c + dz * s;
    const lz = -dx * s + dz * c;
    return Math.max(Math.abs(lx) - b.at.w / 2, Math.abs(lz) - b.at.d / 2);
}

/** One building's parts past its footprint, on the ground. */
export function partsOf(b: Building): BuildingPart[] {
    const recorder = new PartRecorder();
    const sink = new NullGeo();
    buildBuilding({solid: recorder, glass: sink, windows: [], panes: sink, detail: sink}, b);
    const out: BuildingPart[] = [];
    for (const p of recorder.drawn) {
        const ground = townHeight(p.x, p.z);
        if (p.y > ground + FOOT || p.y + p.h < ground + RISE) continue;
        if (p.shape === "circle") {
            if (pastFootprint(b, p.x, p.z) + p.r <= PAST) continue;
            out.push({building: b.id, shape: "circle", x: p.x, z: p.z, r: p.r, base: Math.min(p.y, ground) - 0.2, top: p.y + p.h});
            continue;
        }
        const c = Math.cos(p.rot);
        const s = Math.sin(p.rot);
        let past = -Infinity;
        for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) past = Math.max(past, pastFootprint(b, p.x + ((u * p.w) / 2) * c - ((v * p.d) / 2) * s, p.z + ((u * p.w) / 2) * s + ((v * p.d) / 2) * c));
        if (past <= PAST) continue;
        out.push({building: b.id, shape: "box", x: p.x, z: p.z, rot: p.rot, hw: p.w / 2, hd: p.d / 2, base: Math.min(p.y, ground) - 0.2, top: p.y + p.h});
    }
    return out;
}

const memo = new WeakMap<TownPlan, BuildingPart[]>();

/** Every building's parts past its footprint, on the ground (worked out once per plan). */
export function townBuildingParts(plan: TownPlan = townPlan()): BuildingPart[] {
    const hit = memo.get(plan);
    if (hit) return hit;
    const out = plan.buildings.flatMap(partsOf);
    memo.set(plan, out);
    return out;
}
