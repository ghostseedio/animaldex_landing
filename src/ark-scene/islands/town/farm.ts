/**
 * The farms' yard things that stand in the way (lane GC): stacks of round and square bales, water troughs at the
 * paddocks, a Dutch barn (an open-sided hay shelter) at each farmstead, and the five-bar gates in the paddocks' rails
 * and the fields' hedges. Pure in the plan: the renderer draws them (`render/nature.ts`) and the nav footprints and
 * colliders read the same boxes (`obstacles.ts` `prop`, `colliders.ts`: bales are hay, the rest solid).
 *
 * Every box keeps clear of the farm's buildings, paddock, yard, run and crop patch (the farm animals' spots are there,
 * `areas.ts`), so nobody's place is inside a bale.
 */

import {boxesOverlap, corners, hashText, local, polylineNearest, toLocal, type Box, type Pt} from "@/ark-scene/islands/town/geom";
import {townPlan, type TownPlan} from "@/ark-scene/islands/town/plan";

export type FarmPropKind = "round_bales" | "square_bales" | "trough" | "hay_shelter";
/** A farm prop's footprint (its box, `w` along its own x), its height (m), and the farm it is on. */
export type FarmProp = {id: string; kind: FarmPropKind; at: Box; top: number; farm: string; seed: number};
/** A gate: its middle and turn along the line it sits in, its width (m). */
export type FarmGate = {id: string; x: number; z: number; rot: number; width: number; kind: "paddock" | "field"};

const memo = new WeakMap<TownPlan, {props: FarmProp[]; gates: FarmGate[]}>();

function build(plan: TownPlan): {props: FarmProp[]; gates: FarmGate[]} {
    const props: FarmProp[] = [];
    const gates: FarmGate[] = [];
    for (const farm of plan.farms) {
        const keep: Box[] = [farm.paddock, farm.yard, ...(farm.run ? [farm.run] : [])];
        for (const id of farm.buildings) {
            const b = plan.buildings.find((x) => x.id === id);
            if (b) keep.push(b.at);
        }
        const crops = plan.greens.find((g) => g.id === `${farm.id}-crops`);
        if (crops) {
            const c = crops.poly;
            keep.push({x: (c[0].x + c[2].x) / 2, z: (c[0].z + c[2].z) / 2, w: Math.hypot(c[1].x - c[0].x, c[1].z - c[0].z), d: Math.hypot(c[3].x - c[0].x, c[3].z - c[0].z), rot: Math.atan2(c[1].z - c[0].z, c[1].x - c[0].x)});
        }
        const inside = (b: Box) => corners(b).every((p) => {
            const l = toLocal(farm.at, p.x, p.z);
            return Math.abs(l.x) < farm.at.w / 2 - 1.2 && Math.abs(l.z) < farm.at.d / 2 - 1.2;
        });
        // (A hay shelter's roof keeps clear of the buildings' eaves, where birds roost.)
        // (`boxesOverlap`'s slack is an allowed overlap: a clearance is the box grown by it.)
        const grown = (b: Box, m: number): Box => ({...b, w: b.w + 2 * m, d: b.d + 2 * m});
        const fits = (b: Box, margin = 0.6) => inside(b) && !keep.some((k) => boxesOverlap(k, grown(b, margin))) && !props.some((p) => boxesOverlap(p.at, grown(b, 0.6)));
        // Try spots on a grid over the plot (in the farm's own frame), nearest the barn first.
        const barn = plan.buildings.find((x) => x.id === `${farm.id}-barn`)?.at ?? farm.at;
        const candidates: Pt[] = [];
        for (let gx = -farm.at.w / 2 + 2; gx <= farm.at.w / 2 - 2; gx += 1) for (let gz = -farm.at.d / 2 + 2; gz <= farm.at.d / 2 - 2; gz += 1) candidates.push(local(farm.at, gx, gz));
        candidates.sort((a, b) => Math.hypot(a.x - barn.x, a.z - barn.z) - Math.hypot(b.x - barn.x, b.z - barn.z));
        const place = (kind: FarmPropKind, w: number, d: number, top: number, turn = 0) => {
            for (const p of candidates) {
                const b: Box = {x: p.x, z: p.z, w, d, rot: farm.at.rot + turn};
                if (fits(b, kind === "hay_shelter" ? 1.0 : 0.6)) {
                    props.push({id: `${farm.id}:${kind}:${props.filter((q) => q.farm === farm.id && q.kind === kind).length}`, kind, at: b, top, farm: farm.id, seed: hashText(`${farm.id}:${kind}:${p.x.toFixed(1)}`)});
                    return true;
                }
            }
            return false;
        };
        if (farm.kind === "farmstead") place("hay_shelter", 8, 5, 5.2);
        // Round bales lie in a row of 3 (1.2 m across, 1.25 m wide each), a second row on top at a farmstead.
        place("round_bales", 3.9, 1.3, farm.kind === "farmstead" ? 2.3 : 1.2);
        place("square_bales", 2.4, 1.2, farm.kind === "farmstead" ? 1.4 : 0.9, Math.PI / 2);
        // The trough: just outside the paddock's rails, along the side facing the yard.
        const toward = Math.sign(toLocal(farm.paddock, farm.yard.x, farm.yard.z).z) || 1;
        const yardSide = local(farm.paddock, 0, toward * (farm.paddock.d / 2 + 0.75));
        const trough: Box = {x: yardSide.x, z: yardSide.z, w: 2.2, d: 0.65, rot: farm.at.rot};
        if (fits(trough)) props.push({id: `${farm.id}:trough:0`, kind: "trough", at: trough, top: 0.6, farm: farm.id, seed: hashText(`${farm.id}:trough`)});
        else place("trough", 2.2, 0.65, 0.6);
        // A five-bar gate in the paddock's rails on its yard side.
        const g = local(farm.paddock, farm.paddock.w * 0.25, toward * (farm.paddock.d / 2));
        gates.push({id: `${farm.id}:gate`, x: g.x, z: g.z, rot: farm.at.rot, width: 3.6, kind: "paddock"});
    }
    // A gate in each field's hedge, on the side nearest a lane or track.
    const ways = plan.streets.filter((s) => s.kind === "lane" || s.kind === "track" || s.kind === "road");
    for (const h of plan.hedges) {
        if (!/^field-\d+-hedge$/.test(h.id)) continue;
        let best: {x: number; z: number; rot: number; d: number} | null = null;
        for (let i = 1; i < h.line.length; i++) {
            const a = h.line[i - 1];
            const b = h.line[i];
            const m = {x: (a.x + b.x) / 2, z: (a.z + b.z) / 2};
            const d = Math.min(...ways.map((s) => polylineNearest(s.line, m.x, m.z).distance));
            if (!best || d < best.d) best = {...m, rot: Math.atan2(b.z - a.z, b.x - a.x), d};
        }
        if (best) gates.push({id: `${h.id}:gate`, x: best.x, z: best.z, rot: best.rot, width: 3.6, kind: "field"});
    }
    return {props, gates};
}

/** The farms' bales, troughs and hay shelters (see the top). */
export function townFarmProps(plan: TownPlan = townPlan()): FarmProp[] {
    let m = memo.get(plan);
    if (!m) memo.set(plan, (m = build(plan)));
    return m.props;
}

/** The five-bar gates: in each paddock's rails and each field's hedge (drawn in place of that stretch). */
export function townFarmGates(plan: TownPlan = townPlan()): FarmGate[] {
    let m = memo.get(plan);
    if (!m) memo.set(plan, (m = build(plan)));
    return m.gates;
}
