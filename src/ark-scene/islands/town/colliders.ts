/**
 * The town's colliders for the motion pass (L5's `collide/`: decision 141's one world, the collider sets per island),
 * from the town lane's obstacle footprints (`obstacles.ts`, the same plan as `town-obstacles.json`) in the world frame at
 * the town's origin:
 *
 * - buildings: oriented boxes, floor to roof;
 * - garden walls and hedges: solid to their height (a body above the top is clear); rail fences, paddock rails and
 *   railings from 0.4 m up (small animals walk under); picket fences with the pickets' gap (a mouse slips through);
 * - zoo fences and aviary nets: hard, from below the ground to their height, no gap (an enclosure's residents stay in);
 * - tree trunks: cylinders.
 *
 * Water is the walk grid's (depth), not a collider. Pure in the plan, the open enclosures and the origin.
 */

import type {Collider} from "@/ark-scene/collide";
import {ColliderSet, PICKET_GAP, RAIL_CLEAR} from "@/ark-scene/collide/colliders";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {townObstacles} from "@/ark-scene/islands/town/obstacles";
import {townBuildingParts} from "@/ark-scene/islands/town/building-parts";
import {zooLayout, zooSpotsOf} from "@/ark-scene/islands/town/areas";
import {ZOO_TYPES} from "@/ark-scene/islands/town/zoo-types";
import {HABITAT_ITEMS, paddockItems} from "@/ark-scene/islands/town/render/zoo-habitat";
import {BUSH_GAP, townSolids, type SolidKind, type TownSolid} from "@/ark-scene/islands/town/solids";

/** The town's collider set at its world origin for these open enclosures (`list`: worked out already, the prebuild's). */
export function townColliderSet(open: readonly string[], origin: {x: number; z: number}, list?: Collider[]): ColliderSet {
    const out = list ?? townColliderList(open, origin);
    return new ColliderSet(out, `town@${origin.x},${origin.z}:${open.join(",")}:${out.length}`);
}

/** The town's colliders (plain data: the prebuild worker makes them, decision 153). */
export function townColliderList(open: readonly string[], origin: {x: number; z: number}): Collider[] {
    const ox = origin.x;
    const oz = origin.z;
    const out: Collider[] = [];
    const plan = townPlan();
    for (const b of plan.buildings) {
        let floor = Infinity;
        let top = -Infinity;
        const c = Math.cos(b.at.rot);
        const s = Math.sin(b.at.rot);
        for (const [lx, lz] of [[-b.at.w / 2, -b.at.d / 2], [b.at.w / 2, -b.at.d / 2], [b.at.w / 2, b.at.d / 2], [-b.at.w / 2, b.at.d / 2]]) {
            const g = townHeight(b.at.x + lx * c - lz * s, b.at.z + lx * s + lz * c);
            floor = Math.min(floor, g);
            top = Math.max(top, g);
        }
        // (The town's frame turns a box by +rot; L5's box takes local x = dx cos - dz sin: the same box at -rot.)
        const rotation = -b.at.rot;
        out.push({shape: "box", kind: "building", id: `town:${b.id}`, cx: b.at.x + ox, cz: b.at.z + oz, cos: Math.cos(rotation), sin: Math.sin(rotation), hx0: -b.at.w / 2, hx1: b.at.w / 2, hz0: -b.at.d / 2, hz1: b.at.d / 2, y0: floor - 0.3, y1: top + 0.15 + b.top, reach: Math.hypot(b.at.w / 2, b.at.d / 2), gap: 0});
    }
    // SIG8: what a building draws past its footprint on the ground (a bay, a porch's cheeks, buttresses, a podium, posts:
    // `building-parts.ts`), solid as the building is (a brown tabby's bed was inside a bay).
    townBuildingParts(plan).forEach((p, i) => {
        const id = `town:${p.building}:part:${i}`;
        if (p.shape === "circle") out.push({shape: "circle", kind: "building", id, cx: p.x + ox, cz: p.z + oz, r: p.r, reach: p.r, y0: p.base, y1: p.top, gap: 0});
        else out.push({shape: "box", kind: "building", id, cx: p.x + ox, cz: p.z + oz, cos: Math.cos(-p.rot), sin: Math.sin(-p.rot), hx0: -p.hw, hx1: p.hw, hz0: -p.hd, hz1: p.hd, y0: p.base, y1: p.top, reach: Math.hypot(p.hw, p.hd), gap: 0});
    });
    for (const o of townObstacles(plan, open)) {
        if (o.kind === "tree") {
            const g = townHeight(o.x, o.z);
            // (A shrub is soft, as on the wild island: paths go round it, brushing it is not a pass-through; lane GC.)
            // (p3 (solid): a shrub is solid to anything wider than its stems' gaps, `BUSH_GAP`: the owner saw a horse walk
            // through a bush. It was soft (paths went round it, but a body pushed by its neighbours or held in its pen stood in
            // it); a mouse or a lizard still goes in under it.)
            out.push(o.soft ? {shape: "circle", kind: "shrub", id: `town:${o.id}`, cx: o.x + ox, cz: o.z + oz, r: o.r, reach: o.r, y0: g - 0.2, y1: g + 1.4, gap: BUSH_GAP} : {shape: "circle", kind: "trunk", id: `town:${o.id}`, cx: o.x + ox, cz: o.z + oz, r: o.r, reach: o.r, y0: g - 0.2, y1: g + 3, gap: 0});
            continue;
        }
        if (o.kind === "prop") {
            // A farm's bales, trough or hay shelter (lane GC, `farm.ts`): a box from its floor to its top.
            const [p0, p1, , p3] = o.poly;
            const cx = (o.poly[0].x + o.poly[2].x) / 2;
            const cz = (o.poly[0].z + o.poly[2].z) / 2;
            const hw = Math.hypot(p1.x - p0.x, p1.z - p0.z) / 2;
            const hd = Math.hypot(p3.x - p0.x, p3.z - p0.z) / 2;
            const rotation = -Math.atan2(p1.z - p0.z, p1.x - p0.x);
            out.push({shape: "box", kind: o.what === "round_bales" || o.what === "square_bales" ? "hay" : "building", id: `town:${o.id}`, cx: cx + ox, cz: cz + oz, cos: Math.cos(rotation), sin: Math.sin(rotation), hx0: -hw, hx1: hw, hz0: -hd, hz1: hd, y0: o.floor - 0.2, y1: o.top, reach: Math.hypot(hw, hd), gap: 0});
            continue;
        }
        if (o.kind !== "barrier") continue;
        const railed = o.barrier === "fence" || o.barrier === "paddock_rail" || o.barrier === "railing";
        // (A picket fence's gaps; a hedge's, through which a small animal pushes, as the town lane's `small` passer says.)
        const gap = o.barrier === "picket" ? PICKET_GAP : o.barrier === "hedge" ? 0.3 : 0;
        for (let i = 1; i < o.line.length; i++) {
            const a = o.line[i - 1];
            const b = o.line[i];
            const ga = townHeight(a.x, a.z);
            const gb = townHeight(b.x, b.z);
            const low = Math.min(ga, gb);
            const r = Math.max(o.thickness / 2, 0.04);
            const y0 = o.hard ? low - 0.5 : railed ? low + RAIL_CLEAR : low - 0.2;
            const cx = (a.x + b.x) / 2 + ox;
            const cz = (a.z + b.z) / 2 + oz;
            out.push({shape: "segment", kind: "fence", id: `town:${o.id}:${i}`, ax: a.x + ox, az: a.z + oz, bx: b.x + ox, bz: b.z + oz, r, cx, cz, reach: Math.hypot(b.x - a.x, b.z - a.z) / 2 + r, y0, y1: Math.max(ga, gb) + o.height, gap});
        }
    }
    // p3 (merge): habitat plants follow solid's bush rule (solid to a big body, a small animal's gap: BUSH_GAP).
    // p3 (zoofix): what the open enclosures' habitats put on their ground (rockwork, termite mounds, logs, hay racks,
    // shelters, climbing trees; plants and waterholes soft), where `render/zoo-habitat.ts` draws them: the residents
    // walk round them, not through them.
    for (const e of zooLayout(open, plan).enclosures) {
        if (e.shared || (ZOO_TYPES[e.type].form !== "paddock" && ZOO_TYPES[e.type].form !== "aviary")) continue;
        for (const item of paddockItems(e, zooSpotsOf(e))) {
            const spec = HABITAT_ITEMS[item.what];
            const g = townHeight(item.x, item.z);
            out.push({shape: "circle", kind: spec.kind, id: `town:habitat:${item.id}`, cx: item.x + ox, cz: item.z + oz, r: item.r, reach: item.r, y0: g - 0.2, y1: g + spec.height, ...(spec.kind === "shrub" ? {gap: BUSH_GAP} : {gap: 0, ...(spec.soft ? {soft: true} : {})})});
        }
    }
    // p3 (solid): the scenery drawn solid (rockwork, logs and stumps, posts, climbing trees, shelters, racks, troughs, mounds,
    // waterholes, bushes and brambles, flower beds, garden rooms): `solids.ts`.
    for (const s of townSolids(open)) out.push(solidCollider(s, ox, oz));
    return out;
}

const KIND: Record<SolidKind, Collider["kind"]> = {rock: "rock", mound: "rock", log: "log", stump: "log", post: "post", trunk: "trunk", pond: "pond", hay: "hay", trough: "building", shelter: "building", garden_room: "building", bush: "shrub", bramble: "shrub", bed: "shrub"};

/** A town solid as a collider at the island's origin. */
function solidCollider(s: TownSolid, ox: number, oz: number): Collider {
    const base = {kind: KIND[s.kind], id: `town:${s.id}`, y0: s.base, y1: s.top, gap: s.gap};
    if (s.shape === "circle") return {...base, shape: "circle", cx: s.x + ox, cz: s.z + oz, r: s.r, reach: s.r};
    if (s.shape === "box") return {...base, shape: "box", cx: s.x + ox, cz: s.z + oz, cos: Math.cos(-s.rot), sin: Math.sin(-s.rot), hx0: -s.hw, hx1: s.hw, hz0: -s.hd, hz1: s.hd, reach: Math.hypot(s.hw, s.hd)};
    return {...base, shape: "segment", ax: s.ax + ox, az: s.az + oz, bx: s.bx + ox, bz: s.bz + oz, r: s.r, cx: (s.ax + s.bx) / 2 + ox, cz: (s.az + s.bz) / 2 + oz, reach: Math.hypot(s.bx - s.ax, s.bz - s.az) / 2 + s.r};
}
