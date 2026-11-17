/**
 * p3 (solid): the town's solid scenery as drawn, for the colliders (`colliders.ts`) and the tests. The owner, 2026-11-16,
 * on the live Ark: "I just saw a horse go through a bush." Every walker (farm, zoo, garden pets, wildlife) routes and
 * stands round these, as round the buildings and fences: the zoo habitats' rockwork, logs, climbing frames' posts,
 * climbing trees, shelters, hay racks, troughs, mounds and waterholes (`render/zoo-habitat.ts` Plot.solids, with the
 * keepers' shed and hatch, an aviary's perching tree and the pools' boulders drawn by `render/scenery.ts`); the halls'
 * the same (`render/zoo-houses.ts` hall); the greens' dead wood and bramble patches (`deadwood.ts`); the flower beds;
 * the garden rooms and raised ponds (`tanks.ts`). Each comes from the source that draws it (never a copied number).
 *
 * `gap`: a body narrower than this goes under or into it (a bush, a bramble patch, a flower bed: a mouse, a lizard, a
 * beetle), as `collide/colliders.ts` bodyMeets reads a picket fence's gap; 0 for rock, wood and walls. Pure in the plan
 * and the open enclosures: the same for every viewer.
 */

import {corners, hashText, inBox, inPoly, local, rng, type Box} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {townPlan, type TownPlan} from "@/ark-scene/islands/town/plan";
import {townHouseholds, zooLayout, zooSpotsOf, type ZooEnclosure} from "@/ark-scene/islands/town/areas";
import {ZOO_TYPES} from "@/ark-scene/islands/town/zoo-types";
import {townDeadwood} from "@/ark-scene/islands/town/deadwood";
import {clearOfDoors} from "@/ark-scene/islands/town/doors";
import {homeSiteFootprints, ZOO_HOUSE_TYPES} from "@/ark-scene/islands/town/tanks";
import {Geo} from "@/ark-scene/islands/town/render/kit";
import {BUSH_GAP} from "@/ark-scene/collide/colliders";
import {dressPaddock, type Plot} from "@/ark-scene/islands/town/render/zoo-habitat";
import {hall} from "@/ark-scene/islands/town/render/zoo-houses";

export type SolidKind = "rock" | "log" | "stump" | "post" | "trunk" | "mound" | "pond" | "hay" | "trough" | "shelter" | "bush" | "bramble" | "bed" | "garden_room";

type Span = {id: string; kind: SolidKind; base: number; top: number; gap: number};
export type TownSolid =
    | (Span & {shape: "circle"; x: number; z: number; r: number})
    | (Span & {shape: "box"; x: number; z: number; hw: number; hd: number; rot: number})
    | (Span & {shape: "segment"; ax: number; az: number; bx: number; bz: number; r: number});

/** How narrow a body goes into a bush, a bramble patch or a bed (`collide/colliders.ts`). */
export {BUSH_GAP};

/** The signed distance from a point to a solid's footprint (m, negative inside). */
export function solidDistance(s: TownSolid, x: number, z: number): number {
    switch (s.shape) {
        case "circle":
            return Math.hypot(x - s.x, z - s.z) - s.r;
        case "box": {
            const c = Math.cos(s.rot);
            const n = Math.sin(s.rot);
            const dx = x - s.x;
            const dz = z - s.z;
            const lx = dx * c + dz * n;
            const lz = -dx * n + dz * c;
            const qx = Math.abs(lx) - s.hw;
            const qz = Math.abs(lz) - s.hd;
            return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
        }
        case "segment": {
            const vx = s.bx - s.ax;
            const vz = s.bz - s.az;
            const l = vx * vx + vz * vz;
            const t = l > 0 ? Math.min(Math.max(((x - s.ax) * vx + (z - s.az) * vz) / l, 0), 1) : 0;
            return Math.hypot(x - s.ax - vx * t, z - s.az - vz * t) - s.r;
        }
    }
}

/** A pool-form enclosure's scatter where the habitat does not dress it (`render/scenery.ts` enclosure): its boulders and a log. */
export function zooScatter(e: ZooEnclosure): {rocks: Array<{x: number; z: number; low: number; sx: number; sy: number; sz: number; seed: number}>; log: {x: number; z: number; rot: number}} {
    const s = e.slot.at;
    const r = rng(e.slot.seed);
    const rocks: Array<{x: number; z: number; low: number; sx: number; sy: number; sz: number; seed: number}> = [];
    for (let i = 0; i < (e.type === "bears_wolves" || e.type === "penguin_seal_pools" ? 5 : 2); i++) {
        const p = local(s, (r() - 0.5) * (s.w - 4), (r() - 0.5) * (s.d - 4));
        if (e.pool && inPoly(e.pool, p.x, p.z)) continue;
        // (Lane VEG: a fractured boulder sat into the ground, not a 20-face ball floating 0.3 m up; same size and draws.)
        const sx = 1.2 + r();
        const sy = 0.9 + r() * 0.6;
        const sz = 1.1 + r();
        const H = townHeight;
        const low = Math.min(H(p.x - sx, p.z), H(p.x + sx, p.z), H(p.x, p.z - sz), H(p.x, p.z + sz), H(p.x, p.z));
        rocks.push({x: p.x, z: p.z, low, sx, sy, sz, seed: hashText(`${e.slot.id}r${i}`)});
    }
    const log = local(s, (r() - 0.5) * (s.w - 6), s.d / 2 - 3.5);
    return {rocks, log: {x: log.x, z: log.z, rot: s.rot + r()}};
}

/** The flower beds: round beds round the park's bandstand, a bed either side of most front doors, planters at the zoo's gate. */
export function townFlowerBeds(plan: TownPlan = townPlan()): Array<{kind: "round" | "house" | "planter"; box: Box; seed: string}> {
    const out: Array<{kind: "round" | "house" | "planter"; box: Box; seed: string}> = [];
    const bandstand = {x: -36, z: -56};
    for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        out.push({kind: "round", box: {x: bandstand.x + Math.cos(a) * 7.5, z: bandstand.z + Math.sin(a) * 7.5, w: 3.2, d: 3.2, rot: 0}, seed: `park-bed-${k}`});
    }
    for (const p of plan.parcels) {
        if (p.kind !== "house" || !p.front) continue;
        const r = rng(p.seed + 11);
        if (r() > 0.7) continue;
        const b = plan.buildings.find((q) => q.id === p.building);
        if (!b) continue;
        const halfW = b.at.w / 2;
        for (const side of [-1, 1]) {
            const w = halfW - 1.0;
            if (w < 0.8) continue;
            const centre = local(b.at, side * (0.55 + w / 2), b.at.d / 2 + 0.5);
            const bed: Box = {x: centre.x, z: centre.z, w, d: 0.7, rot: b.at.rot};
            if (p.drive && corners(bed).some((q) => inBox(p.drive!, q.x, q.z, 0.2))) continue;
            if (!inBox(p.at, centre.x, centre.z, -0.2)) continue;
            // gfx (props): never on the door's step or its path (`doors.ts`); the window's side keeps its bed.
            if (!clearOfDoors(bed, 0.05, plan)) continue;
            out.push({kind: "house", box: bed, seed: `${p.id}-bed${side}`});
        }
    }
    const plaza = plan.zoo.plaza;
    for (const side of [-1, 1]) {
        const q = local(plaza, side * 5.2, -plaza.d / 2 + 2.4);
        out.push({kind: "planter", box: {x: q.x, z: q.z, w: 2.0, d: 0.9, rot: plaza.rot}, seed: `zoo-planter-${side}`});
    }
    return out;
}

/** A dressed plot's solids (Plot.solids) and its planting (the "plant" footprints: shrubs, ferns, cacti's beds). */
function plotSolids(out: TownSolid[], plot: Plot, id: string): void {
    plot.solids.forEach((s, k) => {
        const kind: SolidKind = s.kind;
        const base = {id: `${id}/${s.kind}-${k}`, kind, base: s.base - 0.2, top: s.top, gap: 0};
        if (s.shape === "circle") out.push({...base, shape: "circle", x: s.x, z: s.z, r: s.r});
        else if (s.shape === "box") out.push({...base, shape: "box", x: s.x, z: s.z, hw: s.hw, hd: s.hd, rot: s.rot});
        else out.push({...base, shape: "segment", ax: s.ax, az: s.az, bx: s.bx, bz: s.bz, r: s.r});
    });
    plot.footprints.forEach((f, k) => {
        if (f.what !== "plant") return;
        const p = plot.p(f.x, f.z, 0);
        out.push({id: `${id}/bush-${k}`, kind: "bush", shape: "circle", x: p[0], z: p[2], r: f.r, base: p[1] - 0.2, top: p[1] + 1.2, gap: BUSH_GAP});
    });
}

const memo = new Map<string, TownSolid[]>();

/** The town's solid scenery (see the top) for these open enclosures, in the town's own frame. */
export function townSolids(open: readonly string[], plan: TownPlan = townPlan()): TownSolid[] {
    const key = open.join(",");
    const hit = plan === townPlan() ? memo.get(key) : undefined;
    if (hit) return hit;
    const out: TownSolid[] = [];
    for (const e of zooLayout(open, plan).enclosures) {
        if (e.shared) continue;
        const s = e.slot.at;
        const form = ZOO_TYPES[e.type].form;
        if (form === "paddock" || form === "aviary") {
            const plot = dressPaddock(e, zooSpotsOf(e), new Geo(), new Geo(), townHeight);
            if (plot) plotSolids(out, plot, `zoo:${e.id}`);
            else if (form === "paddock") scatterSolids(out, e);
        }
        if (form === "pool") scatterSolids(out, e);
        if (form === "paddock" || form === "pool") {
            // The keepers' shed at the back (`render/scenery.ts` enclosure); p4 (safari): none in a safari area.
            if (e.type !== "penguin_seal_pools" && !e.slot.safari) {
                const c = local(s, s.w / 2 - 4, -s.d / 2 + 2.2);
                const g = townHeight(c.x, c.z);
                out.push({id: `zoo:${e.id}:shed`, kind: "shelter", shape: "box", x: c.x, z: c.z, hw: Math.min(6, s.w * 0.3) / 2, hd: 1.5, rot: s.rot, base: g - 0.2, top: g + 3.6, gap: 0});
            }
        }
        if (form !== "house" && !e.slot.safari) {
            // The feeding hatch on the back fence.
            const h = local(s, -s.w / 2 + 2, -s.d / 2 + 1.2);
            const g = townHeight(h.x, h.z);
            out.push({id: `zoo:${e.id}:hatch`, kind: "shelter", shape: "box", x: h.x, z: h.z, hw: 0.7, hd: 0.3, rot: s.rot, base: g - 0.2, top: g + 1.2, gap: 0});
        }
        if (form === "aviary") {
            // The perching tree (`render/scenery.ts` deadTree).
            const t = local(s, -s.w / 4, -s.d / 6);
            const g = townHeight(t.x, t.z);
            out.push({id: `zoo:${e.id}:perch-tree`, kind: "trunk", shape: "circle", x: t.x, z: t.z, r: 0.3, base: g - 0.2, top: g + 4.2, gap: 0});
        }
        if (form === "house" && ZOO_HOUSE_TYPES.has(e.type) && e.type !== "aquarium") {
            const plot = hall(e, {inside: new Geo(), glow: new Geo(), glass: new Geo(), water: new Geo()});
            if (plot) plotSolids(out, plot, `zoo:${e.id}`);
        }
    }
    const dead = townDeadwood(plan);
    for (const item of dead.items) {
        if (item.kind === "log") {
            const ux = (Math.cos(item.rot) * item.length) / 2;
            const uz = (Math.sin(item.rot) * item.length) / 2;
            out.push({id: `deadwood:${item.id}`, kind: "log", shape: "segment", ax: item.x - ux, az: item.z - uz, bx: item.x + ux, bz: item.z + uz, r: item.r, base: item.base - 0.2, top: item.base + item.r * 2, gap: 0});
        } else out.push({id: `deadwood:${item.id}`, kind: "stump", shape: "circle", x: item.x, z: item.z, r: item.r, base: item.base - 0.2, top: item.base + item.length, gap: 0});
    }
    for (const p of dead.patches) out.push({id: `bramble:${p.id}`, kind: "bramble", shape: "circle", x: p.x, z: p.z, r: p.r, base: p.base - 0.2, top: p.base + p.height, gap: BUSH_GAP});
    for (const bed of townFlowerBeds(plan)) {
        const b = bed.box;
        const g = townHeight(b.x, b.z);
        out.push({id: `bed:${bed.seed}`, kind: "bed", shape: "box", x: b.x, z: b.z, hw: b.w / 2, hd: b.d / 2, rot: b.rot, base: g - 0.2, top: g + (bed.kind === "planter" ? 1.0 : 0.45), gap: bed.kind === "planter" ? 0 : BUSH_GAP});
    }
    homeSiteFootprints(townHouseholds(plan), plan).forEach((b, k) => {
        const g = townHeight(b.x, b.z);
        out.push({id: `garden-room:${k}`, kind: "garden_room", shape: "box", x: b.x, z: b.z, hw: b.w / 2, hd: b.d / 2, rot: b.rot, base: g - 0.3, top: g + 2.6, gap: 0});
    });
    if (plan === townPlan()) memo.set(key, out);
    return out;
}

function scatterSolids(out: TownSolid[], e: ZooEnclosure): void {
    const sc = zooScatter(e);
    sc.rocks.forEach((q, k) => out.push({id: `zoo:${e.id}:boulder:${k}`, kind: "rock", shape: "box", x: q.x, z: q.z, hw: q.sx * 0.85 * 0.9, hd: q.sz * 0.85 * 0.9, rot: (q.seed % 628) / 100, base: q.low - 0.35, top: q.low - 0.15 + q.sy * 0.95, gap: 0}));
    const g = townHeight(sc.log.x, sc.log.z);
    out.push({id: `zoo:${e.id}:log`, kind: "log", shape: "box", x: sc.log.x, z: sc.log.z, hw: 1.7, hd: 0.28, rot: sc.log.rot, base: g - 0.2, top: g + 0.85, gap: 0});
}

