/**
 * The town's static scenery as geometry, chunk by chunk (docs/ark/town-island.md): the streets (carriageway,
 * pavements and kerbs, markings), paths, the square's setts, drives, the canal's walls and towpaths, the bridges, the
 * harbour's quays and breakwaters, the boundaries (hedges, walls, fences, railings, paddock rails, the zoo's fences
 * and aviary nets), the fields and allotments, the zoo's enclosures, the farms' yards, the street furniture.
 */

import {centroid, corners, hashText, inBox, local, toLocal, polylineAt, polylineLength, polylineNearest, polylineWithin, rng, sub, type Box, type Poly, type Pt} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {CANAL, CANAL_LEVEL, CANAL_WIDTH, HARBOUR_BASIN, MILLPOND, TOWN_LEVEL, TOWPATH, townPlan, type Hedge, type Street, type TownPlan} from "@/ark-scene/islands/town/plan";
import {type ZooEnclosure, type ZooLayout} from "@/ark-scene/islands/town/areas";
import {ZOO_TYPES} from "@/ark-scene/islands/town/zoo-types";
import {at, Geo, tone, type Frame} from "@/ark-scene/islands/town/render/kit";
import {buildingFrame} from "@/ark-scene/islands/town/render/buildings";
import {streetSurfaces} from "@/ark-scene/islands/town/render/streets";
import {streetFurniture, type FurnitureOut} from "@/ark-scene/islands/town/render/furniture";
import {alongZ, SURF, tagged} from "@/ark-scene/islands/town/render/surface-tags";
import {townChunkOf} from "@/ark-scene/islands/town/chunks";
import {cropRows, farmProp, fiveBarGate, flowerBed, hedgeAlong} from "@/ark-scene/islands/town/render/nature";
import {surfaceTag} from "@/ark-scene/islands/town/render/surface-tags";
import {townFarmGates, townFarmProps, type FarmGate} from "@/ark-scene/islands/town/farm";
import {zooBarrier} from "@/ark-scene/islands/town/render/zoo-barriers";

/** A chunk's merged geometry by material; `foliage`: hedges, flower beds and crops (lane GC, `render/nature.ts`). */
export type SceneryChunk = {decal: Geo; solid: Geo; glass: Geo; net: Geo; foliage: Geo};
export type SceneryOut = {chunks: Map<number, SceneryChunk>; fresh: Geo; trees: Array<{x: number; z: number; kind: string; scale: number; seed: number}>; lamps: Array<{x: number; y: number; z: number}>; bridges: Array<{street: string; at: Box}>; /** The street furniture and lamps (`furniture.ts`, lane GA): its lights, lamp heads and lamp map. */ furniture?: FurnitureOut};

const H = (x: number, z: number) => townHeight(x, z);

const PATH = tone("#c4b48f");
const STONE = tone("#a59c8a");
const COPING = tone("#c9c0ac");
const BRICK = tone("#8c5a48");
const FENCE = tone("#86684a");
const IRON = tone("#2b2e31");
const RAIL = tone("#e8e4da");
const ZOO_GREEN = tone("#2f4a38");

function chunkFor(out: SceneryOut, x: number, z: number): SceneryChunk {
    const key = townChunkOf(x, z);
    let c = out.chunks.get(key);
    if (!c) {
        c = {decal: new Geo(), solid: new Geo(), glass: new Geo(), net: new Geo(), foliage: new Geo()};
        out.chunks.set(key, c);
    }
    return c;
}

/** Splits a polyline into pieces of about `piece` m so each lands in its own chunk. */
function pieces(line: Poly, piece = 24): Poly[] {
    const length = polylineLength(line);
    const n = Math.max(1, Math.ceil(length / piece));
    const out: Poly[] = [];
    for (let k = 0; k < n; k++) {
        const a = (length * k) / n;
        const b = (length * (k + 1)) / n;
        const part: Poly = [polylineAt(line, a).point];
        let walked = 0;
        for (let i = 1; i < line.length; i++) {
            walked += Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z);
            if (walked > a + 0.01 && walked < b - 0.01) part.push(line[i]);
        }
        part.push(polylineAt(line, b).point);
        out.push(part);
    }
    return out;
}

/** Whether a point is over the canal's water (bridges carry the street there at the bank's level). */
function overCanal(x: number, z: number): boolean {
    return polylineWithin(CANAL, x, z, CANAL_WIDTH / 2 + 0.6);
}

/** The street's surface height: the ground's, but held at the bank's level over the canal (a bridge deck). */
function streetHeight(x: number, z: number): number {
    if (overCanal(x, z)) return TOWN_LEVEL;
    if (inBox(HARBOUR_BASIN, x, z, -0.2)) return TOWN_LEVEL;
    return H(x, z);
}

// MARK: - Streets

function streets(out: SceneryOut, plan: TownPlan) {
    // Carriageways, pavements, kerbs, markings, crossings and the iron in the road: `streets.ts` (lane GA).
    streetSurfaces(plan, {chunkAt: (x, z) => chunkFor(out, x, z), heightAt: streetHeight});
    // The towpaths either side of the canal (gravel), its walls and coping.
    for (const part of pieces(CANAL, 20)) {
        const mid = part[Math.floor(part.length / 2)];
        const c = chunkFor(out, mid.x, mid.z);
        for (const side of [-1, 1]) {
            tagged(c.decal, SURF.gravel, Math.abs(part[part.length - 1].z - part[0].z) > Math.abs(part[part.length - 1].x - part[0].x), () => c.decal.ribbon(part, TOWPATH, (x, z) => (overCanal(x, z) ? TOWN_LEVEL : H(x, z)), 0.07, PATH, 2, side * (CANAL_WIDTH / 2 + 0.35 + TOWPATH / 2)));
            // (Lane GC: the face 0.15 m inside the channel's edge, the coping 0.55 m wide to the towpath: the bank's ground,
            // sloping down into the bed between the 1.1 m grid's vertices, poked up through the water along the walls.)
            wallAlong(c.solid, part, side * (CANAL_WIDTH / 2 - 0.15), CANAL_LEVEL - 1.8, TOWN_LEVEL + 0.18, 0.55, STONE, COPING);
        }
    }
    // The fresh water: the canal, the millpond, the farm pond, the fountain.
    out.fresh.ribbon(CANAL, CANAL_WIDTH + 0.2, () => CANAL_LEVEL, 0, tone("#000000"), 2);
    for (const w of plan.waters) {
        if (w.kind === "harbour") continue;
        const centre = centroid(w.poly);
        const level = w.kind === "farm_pond" ? Math.min(...w.poly.map((p) => H(p.x, p.z))) - 0.25 : w.level;
        fan(out.fresh, w.poly, centre, level);
    }
}

/** A vertical wall along a polyline at `offset` from it, from y0 to y1, with coping. */
function wallAlong(geo: Geo, line: Poly, offset: number, y0: number, y1: number, thick: number, colour: [number, number, number], coping: [number, number, number]) {
    const step = 2;
    const pts: Pt[] = [];
    for (let i = 1; i < line.length; i++) {
        const a = line[i - 1];
        const b = line[i];
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
        for (let k = 0; k < n; k++) pts.push({x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n});
    }
    pts.push(line[line.length - 1]);
    const side = Math.sign(offset) || 1;
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const l = Math.hypot(dx, dz) || 1;
        const nx = -dz / l;
        const nz = dx / l;
        const inner = (p: Pt, extra: number) => [p.x + nx * (offset - side * extra), p.z + nz * (offset - side * extra)] as [number, number];
        const [ax, az] = inner(a, 0);
        const [bx, bz] = inner(b, 0);
        // The face towards the water (inward of the offset), then the coping on top.
        if (side > 0) geo.quad([bx, y0, bz], [ax, y0, az], [ax, y1, az], [bx, y1, bz], colour);
        else geo.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], colour);
        const [cx, cz] = inner(a, -thick);
        const [ex, ez] = inner(b, -thick);
        if (side > 0) geo.quad([ax, y1, az], [cx, y1, cz], [ex, y1, ez], [bx, y1, bz], coping);
        else geo.quad([bx, y1, bz], [ex, y1, ez], [cx, y1, cz], [ax, y1, az], coping);
    }
}

function fan(geo: Geo, poly: Poly, centre: Pt, y: number) {
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        geo.tri([centre.x, y, centre.z], [b.x, y, b.z], [a.x, y, a.z], tone("#000000"));
    }
}

// MARK: - Bridges, the harbour, the square

function bridges(out: SceneryOut, plan: TownPlan) {
    for (const s of plan.streets) {
        if (s.kind === "zoo_path" || s.kind === "track" || s.kind === "lane" || s.kind === "quay") continue;
        const length = polylineLength(s.line);
        for (let a = 0; a < length; a += 0.5) {
            const {point, dir} = polylineAt(s.line, a);
            const near = polylineNearest(CANAL, point.x, point.z);
            if (near.distance > 0.4) continue;
            const across = s.width + s.pavement * 2 + 0.8;
            const span = CANAL_WIDTH + 2.4;
            const turn = Math.atan2(-dir.z, dir.x);
            const deck = {x: point.x, y: TOWN_LEVEL, z: point.z, rot: Math.atan2(-dir.x, dir.z)};
            void turn;
            const c = chunkFor(out, point.x, point.z);
            // The deck's edge stones, parapets and the arch faces on either side.
            for (const side of [-1, 1]) {
                c.solid.box(deck, side * (across / 2 + 0.2), 0, 0, 0.45, 1.05, span + 1.6, STONE);
                c.solid.box(deck, side * (across / 2 + 0.2), 1.05, 0, 0.6, 0.14, span + 1.8, COPING);
                archFace(c.solid, deck, side * (across / 2 - 0.05), span, CANAL_LEVEL - 0.4, TOWN_LEVEL);
            }
            out.bridges.push({street: s.id, at: {x: point.x, z: point.z, w: across, d: span, rot: deck.rot}});
            a += span;
        }
    }
}

/** The arch's face: a stone wall with a semicircular opening over the water. */
function archFace(geo: Geo, deck: Frame, lx: number, span: number, waterY: number, top: number) {
    const r = Math.min(span / 2 - 0.3, top - waterY - 0.3);
    const n = 10;
    const face: Frame = {...deck, rot: deck.rot + (lx > 0 ? -Math.PI / 2 : Math.PI / 2)};
    const off = lx > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI;
        const a1 = ((i + 1) / n) * Math.PI;
        const p = (a: number, rr: number, y: number) => at(face, -off * Math.cos(a) * rr, y - deck.y, Math.abs(lx) * 0 + 0);
        void p;
        const q0 = at(deck, lx, -0.0, -Math.cos(a0) * r);
        const q1 = at(deck, lx, -0.0, -Math.cos(a1) * r);
        const y0 = waterY + Math.sin(a0) * r + 0.6;
        const y1 = waterY + Math.sin(a1) * r + 0.6;
        const t0: [number, number, number] = [q0[0], top - 0.02, q0[2]];
        const t1: [number, number, number] = [q1[0], top - 0.02, q1[2]];
        const b0: [number, number, number] = [q0[0], y0, q0[2]];
        const b1: [number, number, number] = [q1[0], y1, q1[2]];
        if (off > 0) geo.quad(b0, b1, t1, t0, STONE);
        else geo.quad(b1, b0, t0, t1, STONE);
    }
    // The piers down to the water at each end.
    for (const end of [-1, 1]) {
        const e = at(deck, lx, 0, end * (r + 0.6));
        const e2 = at(deck, lx, 0, end * (span / 2 + 0.8));
        const lo = waterY - 0.6;
        const a: [number, number, number] = [e[0], lo, e[2]];
        const b: [number, number, number] = [e2[0], lo, e2[2]];
        const c: [number, number, number] = [e2[0], top, e2[2]];
        const d: [number, number, number] = [e[0], top, e[2]];
        if ((off > 0) === (end > 0)) geo.quad(a, b, c, d, STONE);
        else geo.quad(b, a, d, c, STONE);
    }
}

/**
 * The lock where the canal meets the harbour (lane GC): a pair of timber mitre gates at each end of the chamber, their
 * balance beams out over the towpath, a walkway on each gate.
 */
function lock(out: SceneryOut, plan: TownPlan) {
    const box = plan.lock;
    const near = polylineNearest(CANAL, box.x, box.z);
    const dir = near.dir;
    const nx = -dir.z;
    const nz = dir.x;
    const timber = tone("#5a4632");
    const beam = tone("#e8e4da");
    for (const end of [-1, 1]) {
        const cx = box.x + dir.x * end * 3;
        const cz = box.z + dir.z * end * 3;
        const c = chunkFor(out, cx, cz);
        for (const side of [-1, 1]) {
            // A leaf from the wall to the middle, angled a little upstream (the mitre).
            const hx = cx + nx * side * (CANAL_WIDTH / 2 - 0.15);
            const hz = cz + nz * side * (CANAL_WIDTH / 2 - 0.15);
            const mx = cx - dir.x * end * 0.6;
            const mz = cz - dir.z * end * 0.6;
            const len = Math.hypot(mx - hx, mz - hz);
            const f: Frame = {x: (hx + mx) / 2, y: CANAL_LEVEL - 1.4, z: (hz + mz) / 2, rot: Math.atan2(-(mx - hx), mz - hz)};
            c.solid.box(f, 0, 0, 0, 0.32, TOWN_LEVEL - CANAL_LEVEL + 1.55, len, timber);
            c.solid.box(f, 0, TOWN_LEVEL - CANAL_LEVEL + 1.55, 0, 0.5, 0.08, len, tone("#7a6248"));
            // The balance beam out over the towpath, white-tipped.
            const bf: Frame = {x: hx + nx * side * 2.3, y: TOWN_LEVEL + 0.55, z: hz + nz * side * 2.3, rot: Math.atan2(-nx, nz)};
            c.solid.box(bf, 0, 0, 0, 0.3, 0.3, 4.6, timber);
            c.solid.box({...bf, x: hx + nx * side * 4.4, z: hz + nz * side * 4.4}, 0, 0, 0, 0.32, 0.32, 0.5, beam);
        }
    }
}

function harbour(out: SceneryOut) {
    const b = HARBOUR_BASIN;
    // Quay walls on the basin's west, north and east sides (the south is open to the sea).
    const edges: Array<[Pt, Pt, number]> = [
        [local(b, -b.w / 2, b.d / 2), local(b, -b.w / 2, -b.d / 2), -1],
        [local(b, -b.w / 2, -b.d / 2), local(b, b.w / 2, -b.d / 2), -1],
        [local(b, b.w / 2, -b.d / 2), local(b, b.w / 2, b.d / 2), -1]
    ];
    for (const [a, e, side] of edges) {
        for (const part of pieces([a, e], 20)) {
            const mid = part[0];
            const c = chunkFor(out, mid.x, mid.z);
            wallAlong(c.solid, part, side * 0.0 - 0.15, -4.2, TOWN_LEVEL + 0.2, 0.5, tone("#8f897e"), tone("#b9b2a2"));
        }
    }
    // Breakwaters: two stone arms out from the basin's mouth, the lighthouse on the east one's end.
    const arms: Array<[Pt, Pt]> = [[local(b, -b.w / 2, b.d / 2), {x: 6, z: 168}], [local(b, b.w / 2, b.d / 2), {x: 36, z: 166}]];
    for (const [a, e] of arms) {
        const length = Math.hypot(e.x - a.x, e.z - a.z);
        const n = Math.ceil(length / 6);
        for (let k = 0; k < n; k++) {
            const t0 = k / n;
            const t1 = (k + 1) / n;
            const p = {x: a.x + (e.x - a.x) * (t0 + t1) / 2, z: a.z + (e.z - a.z) * (t0 + t1) / 2};
            const c = chunkFor(out, p.x, p.z);
            const f: Frame = {x: p.x, y: -6, z: p.z, rot: Math.atan2(-(e.x - a.x), e.z - a.z)};
            c.solid.box(f, 0, 0, 0, 6.5, 6 + TOWN_LEVEL, length / n + 0.1, tone("#8a847a"));
            c.solid.box(f, 0, 6 + TOWN_LEVEL, 0, 4.2, 0.3, length / n + 0.1, tone("#a8a194"));
            // Armour stones on the sea side.
            const r = rng(hashText(`${p.x}|${p.z}`));
            for (let s = 0; s < 3; s++) c.solid.blob(at(f, 3.6, 0, 0)[0] + (r() - 0.5) * 3, -0.2 + r() * 1.5, at(f, 3.6, 0, 0)[2] + (r() - 0.5) * 3, 1.4, 1.0, 1.3, tone("#7d786e"), hashText(`${p.x}|${s}`), 0);
        }
    }
    // Bollards along the quays, a slipway.
    for (let z = b.z - b.d / 2 + 4; z < b.z + b.d / 2 - 2; z += 7) {
        for (const x of [b.x - b.w / 2 - 0.9, b.x + b.w / 2 + 0.9]) {
            const c = chunkFor(out, x, z);
            c.solid.cylinder({x, y: TOWN_LEVEL + 0.1, z, rot: 0}, 0, 0, 0, 0.22, 0.22, 0.6, IRON, 8);
        }
    }
}

function square(out: SceneryOut, plan: TownPlan) {
    const s = plan.square;
    const c = chunkFor(out, s.x, s.z);
    const f: Frame = {x: s.x, y: 0, z: s.z, rot: s.rot};
    // Setts: a draped patch, the granite setts' texture laid at true size (lane GA; flat-coloured cells drew giant pixels).
    tagged(c.decal, SURF.setts, alongZ(s.rot), () => c.decal.drape(f, s.w, s.d, H, 0.12, () => tone("#a39a8b"), 1.6));
    // The fountain: a stone basin with a column.
    const ff: Frame = {x: s.x, y: H(s.x, s.z) + 0.12, z: s.z, rot: 0};
    c.solid.cylinder(ff, 0, 0, 0, 3.0, 3.0, 0.55, STONE, 16, false);
    c.solid.cylinder(ff, 0, 0, 0, 2.7, 2.7, 0.56, tone("#7d766a"), 16);
    c.solid.cylinder(ff, 0, 0.5, 0, 0.45, 0.35, 1.8, COPING, 8);
    c.solid.cylinder(ff, 0, 2.3, 0, 1.0, 0.2, 0.3, COPING, 10);
    // A war memorial at the square's east end, benches, a red phone box and a post box.
    const memorial = local(s, s.w / 2 - 4, -2);
    const m: Frame = {x: memorial.x, y: H(memorial.x, memorial.z) + 0.12, z: memorial.z, rot: s.rot};
    c.solid.box(m, 0, 0, 0, 2.6, 0.4, 2.6, STONE);
    c.solid.box(m, 0, 0.4, 0, 1.2, 3.6, 1.2, COPING);
    c.solid.pyramid(m, 0, 4.0, 0, 1.2, 0.6, COPING);
    for (const [lx, lz, turn] of [[-8, -s.d / 2 + 2, 0], [8, -s.d / 2 + 2, 0], [-s.w / 2 + 2, 4, Math.PI / 2]] as const) bench(c.solid, local(s, lx, lz), s.rot + turn);
    const phone = local(s, -s.w / 2 + 1.5, s.d / 2 - 2);
    const pf: Frame = {x: phone.x, y: H(phone.x, phone.z) + 0.12, z: phone.z, rot: s.rot};
    c.solid.box(pf, 0, 0, 0, 0.95, 2.5, 0.95, tone("#b3201f"));
    c.solid.box(pf, 0, 2.5, 0, 1.05, 0.2, 1.05, tone("#b3201f"));
    const post = local(s, -s.w / 2 + 3.2, s.d / 2 - 1.6);
    c.solid.cylinder({x: post.x, y: H(post.x, post.z) + 0.12, z: post.z, rot: 0}, 0, 0, 0, 0.3, 0.3, 1.5, tone("#b3201f"), 10);
}

function bench(geo: Geo, p: Pt, rot: number) {
    const f: Frame = {x: p.x, y: H(p.x, p.z) + 0.1, z: p.z, rot};
    geo.box(f, 0, 0.42, 0, 1.8, 0.07, 0.45, FENCE);
    geo.box(f, 0, 0.5, -0.24, 1.8, 0.4, 0.06, FENCE);
    for (const lx of [-0.75, 0.75]) geo.box(f, lx, 0, 0, 0.08, 0.45, 0.4, IRON);
}

// MARK: - Boundaries

function boundaries(out: SceneryOut, plan: TownPlan) {
    // The farms' gates stand in their hedges and rails (lane GC, `farm.ts`).
    const gates = townFarmGates(plan);
    for (const h of plan.hedges) boundary(out, h, gates);
    for (const g of gates) fiveBarGate(chunkFor(out, g.x, g.z).solid, g);
}

/** Whether a point is in a gate's opening (with `margin` m either side). */
function inGate(gates: readonly FarmGate[], x: number, z: number, margin = 0): boolean {
    return gates.some((g) => Math.hypot(x - g.x, z - g.z) < g.width / 2 + margin);
}

function boundary(out: SceneryOut, h: Hedge, gates: readonly FarmGate[] = []) {
    const r = rng(hashText(h.id));
    if (h.kind === "hedge") {
        // Leafy hedges (lane GC, `render/nature.ts`): a field's or a farm's boundary a shaggy hedgerow, a garden's
        // clipped; each ~24 m piece into the chunk it lies in; open where a gate stands.
        const hedgerow = h.id.startsWith("field") || h.id.includes("smallholding") || h.id.includes("farmstead");
        const open = gates.map((g) => ({x: g.x, z: g.z, half: g.width / 2}));
        for (const part of pieces(h.line, 24)) {
            const mid = part[Math.floor(part.length / 2)];
            hedgeAlong(chunkFor(out, mid.x, mid.z).foliage, part, h.height, hashText(h.id), hedgerow, open);
        }
        return;
    }
    for (let i = 1; i < h.line.length; i++) {
        const a = h.line[i - 1];
        const b = h.line[i];
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        if (length < 0.2) continue;
        const rot = Math.atan2(-(b.x - a.x), b.z - a.z);
        const n = Math.max(1, Math.ceil(length / 6));
        for (let k = 0; k < n; k++) {
            const t = (k + 0.5) / n;
            const x = a.x + (b.x - a.x) * t;
            const z = a.z + (b.z - a.z) * t;
            const seg = length / n;
            const c = chunkFor(out, x, z);
            const f: Frame = {x, y: H(x, z), z, rot};
            switch (h.kind) {
                case "wall":
                    c.solid.box(f, 0, -0.3, 0, 0.3, h.height + 0.3, seg + 0.02, BRICK);
                    c.solid.box(f, 0, h.height, 0, 0.38, 0.1, seg + 0.04, COPING);
                    break;
                case "fence":
                    c.solid.box(f, 0, 0, 0, 0.05, h.height, seg, FENCE);
                    c.solid.box(f, 0, 0, -seg / 2, 0.12, h.height + 0.08, 0.12, FENCE.map((v) => v * 0.8) as [number, number, number]);
                    break;
                case "railing":
                    c.solid.box(f, 0, 0.1, 0, 0.05, 0.05, seg, IRON);
                    c.solid.box(f, 0, h.height - 0.05, 0, 0.05, 0.05, seg, IRON);
                    for (let q = 0; q < Math.floor(seg / 0.6); q++) c.solid.box(f, 0, 0, -seg / 2 + 0.3 + q * 0.6, 0.03, h.height, 0.03, IRON);
                    break;
                case "paddock_rail":
                    // (A gate hangs in its own opening: no rails there, lane GC.)
                    if (inGate(gates, x, z, seg / 2 - 0.2)) {
                        if (!inGate(gates, at(f, 0, 0, -seg / 2)[0], at(f, 0, 0, -seg / 2)[2])) c.solid.box(f, 0, 0, -seg / 2, 0.14, h.height + 0.1, 0.14, FENCE);
                        break;
                    }
                    c.solid.box(f, 0, 0, -seg / 2, 0.14, h.height + 0.1, 0.14, FENCE);
                    for (const yy of [0.45, 0.95]) c.solid.box(f, 0, yy, 0, 0.06, 0.12, seg, RAIL);
                    break;
                case "picket":
                    for (let q = 0; q < Math.floor(seg / 0.25); q++) c.solid.box(f, 0, 0, -seg / 2 + 0.12 + q * 0.25, 0.03, h.height, 0.08, RAIL);
                    c.solid.box(f, 0, h.height * 0.6, 0, 0.04, 0.08, seg, RAIL);
                    break;
                case "zoo_fence":
                    c.solid.box(f, 0, -0.2, 0, 0.35, 0.8, seg + 0.02, STONE);
                    c.solid.box(f, 0, 0, -seg / 2, 0.12, h.height, 0.12, ZOO_GREEN);
                    for (const yy of [1.1, h.height - 0.1]) c.solid.box(f, 0, yy, 0, 0.06, 0.08, seg, ZOO_GREEN);
                    break;
                case "net":
                    c.net.quad(at(f, 0, 0, -seg / 2), at(f, 0, 0, seg / 2), at(f, 0, h.height, seg / 2), at(f, 0, h.height, -seg / 2), IRON);
                    c.solid.box(f, 0, 0, -seg / 2, 0.14, h.height, 0.14, ZOO_GREEN);
                    break;
            }
        }
    }
}

// MARK: - Fields, gardens, allotments, the farms

const CROP: Record<string, [string, string, number]> = {
    cereal: ["#c9b36a", "#b7a056", 0.35],
    pasture: ["#86a957", "#7da150", 3],
    maize: ["#5f8a38", "#5a4630", 0.75],
    cabbage: ["#7fa158", "#5d4834", 0.6],
    tilled: ["#6c5438", "#5c4630", 0.5],
    sprouts: ["#8fb05e", "#5d4834", 0.55],
    orchard: ["#7aa04e", "#86a957", 3]
};

function fields(out: SceneryOut, plan: TownPlan) {
    for (const g of plan.greens) {
        if (g.kind !== "field" && g.kind !== "orchard" && g.kind !== "allotments") continue;
        const c4 = g.poly;
        const w = Math.hypot(c4[1].x - c4[0].x, c4[1].z - c4[0].z);
        const d = Math.hypot(c4[3].x - c4[0].x, c4[3].z - c4[0].z);
        const centre = centroid(c4);
        const rot = Math.atan2(c4[1].z - c4[0].z, c4[1].x - c4[0].x);
        const f: Frame = {x: centre.x, y: 0, z: centre.z, rot};
        const c = chunkFor(out, centre.x, centre.z);
        if (g.kind === "allotments") {
            tagged(c.decal, SURF.crop, alongZ(rot), () => c.decal.drape(f, w, d, H, 0.08, (lx) => (Math.floor((lx + w) / 1.4) % 3 === 0 ? tone("#6f9a4a") : Math.floor((lx + w) / 1.4) % 3 === 1 ? tone("#6a5238") : tone("#8fb25e")), 0.7));
            const r = rng(hashText(g.id));
            for (let k = 0; k < 3; k++) {
                const p = local({x: centre.x, z: centre.z, w, d, rot}, -w / 2 + 2 + k * (w / 3), -d / 2 + 1.4);
                const sf: Frame = {x: p.x, y: H(p.x, p.z), z: p.z, rot: rot + (r() - 0.5) * 0.2};
                c.solid.box(sf, 0, 0, 0, 2.0, 1.9, 1.6, tone(["#5a7a5a", "#7a5a3a", "#3a5a6a"][k]));
                c.solid.gable(sf, 0, 1.9, 0, 2.0, 1.6, 0.5, 0.12, tone("#3a3a3a"), tone(["#5a7a5a", "#7a5a3a", "#3a5a6a"][k]));
                c.solid.cylinder(sf, 1.4, 0, 0.3, 0.35, 0.35, 0.9, tone("#2f4a38"), 8);
            }
            continue;
        }
        const crop = CROP[g.crop ?? "pasture"] ?? CROP.pasture;
        const [on, off, spacing] = crop;
        // (Lane GA: no per-cell shade; the crop and soil textures carry the variety.)
        tagged(c.decal, SURF.crop, alongZ(rot), () => c.decal.drape(f, w, d, H, 0.05, (_lx, lz) => tone(Math.floor((lz + d) / spacing) % 2 === 0 ? on : off), Math.min(spacing, 1.2)));
        // Standing crops in their rows (lane GC, `render/nature.ts`): cereal, maize, cabbages, sprouts.
        cropRows(c.foliage, {x: centre.x, z: centre.z, w, d, rot}, g.crop ?? "pasture", hashText(g.id));
    }
    // The farms' bales, troughs and hay shelters (lane GC, `farm.ts`: they are colliders too); a tractor at each farmstead.
    for (const p of townFarmProps(plan)) farmProp(chunkFor(out, p.at.x, p.at.z).solid, p);
    for (const farm of plan.farms) {
        const c = chunkFor(out, farm.at.x, farm.at.z);
        if (farm.kind === "farmstead") tractor(c.solid, local(farm.yard, -farm.yard.w / 2 + 2.5, 0), farm.at.rot + 0.4);
    }
}

function tractor(geo: Geo, p: Pt, rot: number) {
    const f: Frame = {x: p.x, y: H(p.x, p.z), z: p.z, rot};
    const red = tone("#b7372c");
    geo.box(f, 0, 0.7, 0.4, 1.2, 0.9, 2.2, red);
    geo.box(f, 0, 1.2, -0.5, 1.3, 1.6, 1.2, red.map((v) => v * 0.9) as [number, number, number]);
    geo.box(f, 0, 2.8, -0.5, 1.5, 0.08, 1.4, tone("#2a2a2a"));
    for (const [lx, lz, r] of [[-0.75, -0.6, 0.75], [0.75, -0.6, 0.75], [-0.65, 1.1, 0.45], [0.65, 1.1, 0.45]] as const) {
        const w: Frame = {...f, ...{x: at(f, lx, 0, lz)[0], z: at(f, lx, 0, lz)[2]}, y: f.y + r, rot: rot};
        geo.box(w, 0, -r, 0, 0.35, r * 2, r * 2, tone("#232323"));
    }
}

// MARK: - The zoo

/**
 * The zoo's enclosures as their own chunked geometry (rebuilt when enclosures open: `render/index.ts`
 * `setZooOpen`): each open enclosure built, every plot with nothing open on it landscaped (plan §3.5: "lawn and trees
 * until an enclosure opens there"). Enclosure trees (acacias, pines, a birch in an aviary) are drawn into it.
 */
export function buildZooScenery(layout: ZooLayout): SceneryOut {
    const out: SceneryOut = {chunks: new Map(), fresh: new Geo(), trees: [], lamps: [], bridges: []};
    for (const e of layout.enclosures) if (!e.shared) enclosure(out, e);
    for (const plot of layout.closed) {
        const c = chunkFor(out, plot.at.x, plot.at.z);
        // (Its lawn trees are the asset library's: `trees.ts` townZooTrees.)
        const r = rng(hashText(`${plot.id}:shrubs`));
        for (let k = 0; k < 3; k++) {
            const p = local(plot.at, (r() - 0.5) * (plot.at.w - 2), (r() - 0.5) * (plot.at.d - 2));
            c.solid.blob(p.x, H(p.x, p.z) + 0.5, p.z, 1.2, 0.8, 1.2, tone("#4f7a3a"), hashText(`${plot.id}s${k}`), 0);
        }
        bench(c.solid, local(plot.at, 0, plot.at.d / 2 - 1.2), plot.at.rot + Math.PI);
    }
    return out;
}

function zooPlaza(out: SceneryOut, plan: TownPlan) {
    // The entrance plaza: an arch gate, a ticket kiosk, a sign.
    const p = plan.zoo.plaza;
    const c = chunkFor(out, p.x, p.z);
    const f: Frame = {x: p.x, y: H(p.x, p.z) + 0.1, z: p.z, rot: p.rot};
    tagged(c.decal, SURF.blocks, alongZ(p.rot), () => c.decal.drape({x: p.x, y: 0, z: p.z, rot: p.rot}, p.w, p.d, H, 0.1, () => tone("#c9b48a"), 1));
    for (const lx of [-3.2, 3.2]) c.solid.box(f, lx, 0, -p.d / 2 + 1, 0.9, 5.2, 0.9, tone("#6a5a46"));
    c.solid.box(f, 0, 5.2, -p.d / 2 + 1, 8.0, 1.2, 1.1, tone("#2f4a38"));
    c.solid.box(f, 0, 5.4, -p.d / 2 + 0.42, 5.4, 0.8, 0.05, tone("#e2c86a"));
    c.solid.box(f, 4.2, 0, 2, 3.2, 2.6, 2.4, tone("#d9cdb0"));
    c.solid.gable(f, 4.2, 2.6, 2, 3.2, 2.4, 0.9, 0.3, tone("#2f4a38"), tone("#d9cdb0"));
    for (const [lx, lz] of [[-4, 4], [4, 6]] as const) bench(c.solid, local(p, lx, lz), p.rot);
}

function enclosure(out: SceneryOut, e: ZooEnclosure) {
    const s = e.slot.at;
    const c = chunkFor(out, s.x, s.z);
    const spec = ZOO_TYPES[e.type];
    const r = rng(e.slot.seed);
    const ground = e.type === "savanna_paddocks" ? "#cdb07a" : e.type === "hoofstock_paddocks" || e.type === "childrens_farm" ? "#a99268" : e.type === "big_cats" ? "#b7a374" : e.type === "bears_wolves" ? "#7d7a52" : e.type === "small_mammals" ? "#9a8a62" : null;
    // (Lane GA: the 2 m cells' own shades were the "giant pixels"; the earth and sand textures carry the variety now.)
    if (ground) tagged(c.decal, e.type === "savanna_paddocks" || e.type === "big_cats" ? SURF.sand : SURF.earth, alongZ(s.rot), () => c.decal.drape({x: s.x, y: 0, z: s.z, rot: s.rot}, s.w - 0.4, s.d - 0.4, H, 0.06, () => tone(ground), 2));
    // The barrier on the plot's boundary, each type as a real zoo builds it (lane GC, `render/zoo-barriers.ts`): the
    // boundary stays the hard collider; houses are their own bounds (lane TB's).
    if (spec.form !== "house") zooBarrier(c, e);
    if (spec.form === "aviary") {
        // A dead tree for perches and a bathing pool.
        const t = local(s, -s.w / 4, -s.d / 6);
        deadTree(c.solid, t, e.slot.seed);
    }
    if (spec.form === "house") zooHouse(out, e);
    if (e.pool) {
        const centre = centroid(e.pool);
        // A raised pool: its rim of rockwork stands on the ground, the water just under the rim.
        let ground = -Infinity;
        for (const q of e.pool) ground = Math.max(ground, H(q.x, q.z));
        const level = ground + 0.45;
        fan(out.fresh, e.pool, centre, level);
        const f: Frame = {x: centre.x, y: ground, z: centre.z, rot: s.rot};
        const pw = Math.hypot(e.pool[1].x - e.pool[0].x, e.pool[1].z - e.pool[0].z);
        const pd = Math.hypot(e.pool[3].x - e.pool[0].x, e.pool[3].z - e.pool[0].z);
        for (const [lx, lz, w, d] of [[0, pd / 2, pw + 0.7, 0.35], [0, -pd / 2, pw + 0.7, 0.35], [pw / 2, 0, 0.35, pd], [-pw / 2, 0, 0.35, pd]] as const) c.solid.box(f, lx, -0.6, lz, w, 1.2, d, tone("#9d968a"));
        c.solid.box(f, 0, -0.2, 0, pw, 0.3, pd, tone("#3f6f7a"));
        if (e.type === "penguin_seal_pools") for (let i = 0; i < 4; i++) c.solid.blob(...at(f, (i - 1.5) * pw * 0.25, 0.4, -pd / 2 - 1.2), 1.2, 0.8, 1.0, tone("#d8d4cc"), hashText(`${e.slot.id}ice${i}`), 0);
    }
    // Rocks, logs, a shelter at the back, the keepers' hatch; per type, a few things for enrichment.
    const back = (lx: number) => local(s, lx, -s.d / 2 + 2.2);
    if (spec.form === "paddock" || spec.form === "pool") {
        for (let i = 0; i < (e.type === "bears_wolves" || e.type === "penguin_seal_pools" ? 5 : 2); i++) {
            const p = local(s, (r() - 0.5) * (s.w - 4), (r() - 0.5) * (s.d - 4));
            if (e.pool && pointIn(e.pool, p)) continue;
            c.solid.blob(p.x, H(p.x, p.z) + 0.3, p.z, 1.2 + r(), 0.9 + r() * 0.6, 1.1 + r(), tone("#8f877a"), hashText(`${e.slot.id}r${i}`), 0);
        }
        const log = local(s, (r() - 0.5) * (s.w - 6), s.d / 2 - 3.5);
        const lf: Frame = {x: log.x, y: H(log.x, log.z) + 0.3, z: log.z, rot: s.rot + r()};
        c.solid.box(lf, 0, 0, 0, 3.4, 0.55, 0.55, tone("#6a5038"));
        if (e.type !== "penguin_seal_pools") {
            const shelter = back(s.w / 2 - 4);
            const sf: Frame = {x: shelter.x, y: H(shelter.x, shelter.z), z: shelter.z, rot: s.rot};
            const sw = Math.min(6, s.w * 0.3);
            c.solid.box(sf, 0, 0, 0, sw, 2.6, 3.0, tone(e.type === "childrens_farm" ? "#9b4b36" : "#7a6a52"));
            c.solid.gable(sf, 0, 2.6, 0, sw, 3.0, 1.0, 0.3, tone("#4a4440"), tone("#7a6a52"));
        }
        if (e.type === "savanna_paddocks") {
            const m = local(s, -s.w / 4, s.d / 6);
            c.solid.cylinder({x: m.x, y: H(m.x, m.z), z: m.z, rot: 0}, 0, 0, 0, 1.1, 0.3, 2.4, tone("#a9763e"), 7);
        }
        if (e.type === "big_cats") {
            const d = local(s, s.w / 5, 0);
            const df: Frame = {x: d.x, y: H(d.x, d.z), z: d.z, rot: s.rot};
            for (const [lx, lz] of [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]] as const) df && c.solid.box(df, lx, 0, lz, 0.25, 2.4, 0.25, tone("#6a5038"));
            c.solid.box(df, 0, 2.4, 0, 3.6, 0.2, 3.6, tone("#8a6a48"));
        }
    }
    // The feeding hatch on the back fence.
    const hatch = back(-s.w / 2 + 2);
    c.solid.box({x: hatch.x, y: H(hatch.x, hatch.z), z: hatch.z, rot: s.rot}, 0, 0, -1, 1.4, 1.2, 0.6, tone("#5a5a52"));
}

function pointIn(poly: Poly, p: Pt): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i];
        const b = poly[j];
        if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
}

function deadTree(geo: Geo, p: Pt, seed: number) {
    const f: Frame = {x: p.x, y: H(p.x, p.z), z: p.z, rot: (seed % 100) / 16};
    const bark = tone("#6b5a48");
    geo.cylinder(f, 0, 0, 0, 0.25, 0.14, 4.2, bark, 6);
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + (seed % 7);
        const bf: Frame = {x: f.x + Math.cos(a) * 0.6, y: f.y + 1.6 + i * 0.6, z: f.z + Math.sin(a) * 0.6, rot: a};
        geo.box(bf, 0, 0, 0, 0.12, 0.12, 1.6, bark);
    }
}

/** Lane TB: the zoo houses are `render/zoo-houses.ts`'s (the aquarium's tanks seen through the glass, walls cut away close by). */
const ZOO_HOUSES_ELSEWHERE = true;

/** A zoo house: walls, a glass front onto the path the visitors see into, a flat or curved roof, tanks inside. */
function zooHouse(out: SceneryOut, e: ZooEnclosure) {
    // (Lane TB: the zoo houses, their walls, glass and roofs cut away close by, their tanks and halls, are drawn with
    // the zoo's day, `render/zoo-houses.ts`: so their residents are seen inside. Nothing of them is drawn here.)
    if (ZOO_HOUSES_ELSEWHERE) return;
    const s = e.slot.at;
    const c = chunkFor(out, s.x, s.z);
    const f = buildingFrame(s);
    const look: Record<string, [string, string]> = {aquarium: ["#e9eef0", "#2f7f8f"], reptile_house: ["#e6d8b8", "#a8543a"], insect_house: ["#e8e4cc", "#6f8f3a"], nocturnal_house: ["#d8d2c4", "#2f3a5a"], primate_house: ["#e6dcc4", "#4f7a3a"]};
    const [wallHex, roofHex] = look[e.type] ?? ["#e6dcc4", "#5a6a5a"];
    const wall = tone(wallHex);
    const roof = tone(roofHex);
    const h = e.type === "primate_house" ? 7 : 5.2;
    const w = s.w - 0.4;
    const d = s.d - 0.4;
    c.solid.box(f, 0, -1.4, 0, w + 0.1, 1.5, d + 0.1, tone("#8e877a"));
    c.solid.box(f, 0, 0, -0.6, w, h, d - 1.2, wall);
    // A coloured base band and a cornice in the house's colour, a roof in it (barrel-glazed halls get a frame).
    c.solid.box(f, 0, 0, -0.6, w + 0.06, 0.9, d - 1.14, roof.map((v) => v * 0.8) as [number, number, number]);
    if (e.type === "primate_house" || e.type === "insect_house") c.solid.box(f, 0, h, -0.6, w + 0.6, 0.4, d - 0.6, roof);
    else c.solid.hip(f, 0, h, -0.6, w, d - 1.2, Math.min(w, d) * 0.22, 0.45, roof);
    // Climbing plants on the walls.
    const q = rng(e.slot.seed + 3);
    for (let k = 0; k < 3; k++) {
        const p = at(f, -w / 2 + 0.6 + q() * (w - 1.2), 0, -d / 2 + 0.2);
        c.solid.blob(p[0], f.y + 1.2 + q() * 1.5, p[2], 1.0, 1.6, 0.5, tone("#4f7a3a"), hashText(`${e.slot.id}c${k}`), 0);
    }
    if (e.type === "primate_house" || e.type === "insect_house") {
        // A glazed barrel roof (the tropical hall).
        const n = 6;
        for (let i = 0; i < n; i++) {
            const a0 = (i / n) * Math.PI;
            const a1 = ((i + 1) / n) * Math.PI;
            const rr = (d - 1.2) / 2;
            const y0 = h + 0.4 + Math.sin(a0) * rr * 0.5;
            const y1 = h + 0.4 + Math.sin(a1) * rr * 0.5;
            c.glass.quad(at(f, -w / 2, y0, -0.6 + Math.cos(a0) * rr), at(f, w / 2, y0, -0.6 + Math.cos(a0) * rr), at(f, w / 2, y1, -0.6 + Math.cos(a1) * rr), at(f, -w / 2, y1, -0.6 + Math.cos(a1) * rr), tone("#9ab8b0"));
        }
    }
    // The glass front, mullions, a canopy, the sign over the door.
    const front = d / 2 - 0.6;
    c.glass.quad(at(f, -w / 2 + 0.3, 0.3, front), at(f, w / 2 - 0.3, 0.3, front), at(f, w / 2 - 0.3, h - 0.5, front), at(f, -w / 2 + 0.3, h - 0.5, front), tone(e.type === "nocturnal_house" ? "#1a1c2a" : "#3a5058"));
    for (let u = -w / 2 + 0.3; u <= w / 2 - 0.2; u += 2.4) c.solid.box(f, u, 0, front + 0.05, 0.12, h - 0.2, 0.12, tone("#2a2e30"));
    c.solid.box(f, 0, h - 0.5, front + 0.6, w, 0.15, 1.6, roof);
    c.solid.box(f, 0, h - 0.35, front + 0.1, Math.min(6, w * 0.5), 0.7, 0.08, tone("#e2c86a"));
    // Inside: tanks or terraria glowing behind the glass, rockwork and plants.
    const r = rng(e.slot.seed);
    const tanks = Math.max(2, Math.floor(w / 3));
    for (let k = 0; k < tanks; k++) {
        const u = -w / 2 + (w * (k + 0.5)) / tanks;
        const glow = e.type === "aquarium" ? "#3f8fb8" : e.type === "nocturnal_house" ? "#2a2c48" : e.type === "reptile_house" ? "#8a9a4a" : e.type === "insect_house" ? "#7aa04a" : "#6a8a4a";
        c.solid.box(f, u, 0.8, -d / 2 + 2.2, w / tanks - 0.6, 2.2, 1.6, tone(glow));
        if (e.type === "primate_house") {
            for (const lx of [-1, 1]) c.solid.box(f, u + lx, 0, -0.5, 0.18, h - 0.4, 0.18, tone("#6a5038"));
            c.solid.box(f, u, h * 0.55, -0.5, 2.2, 0.12, 0.12, tone("#8a7050"));
        }
        if (r() < 0.6) c.solid.blob(...at(f, u, 0.6, 0.8), 0.7, 0.6, 0.7, tone("#4f7a3a"), hashText(`${e.slot.id}p${k}`), 0);
    }
    if (e.type === "primate_house") {
        // The outdoor island: a climbing frame of poles and ropes behind the house (inside the fence line).
        const back = local(s, 0, -s.d / 2 + 2);
        const bf: Frame = {x: back.x, y: H(back.x, back.z), z: back.z, rot: s.rot};
        for (const lx of [-3, 0, 3]) c.solid.cylinder(bf, lx, 0, 0, 0.16, 0.14, 5.5, tone("#7a5a3e"), 6);
        c.solid.box(bf, 0, 5.2, 0, 6.4, 0.14, 0.14, tone("#7a5a3e"));
        c.solid.box(bf, 0, 3.4, 0, 6.2, 0.06, 0.06, tone("#c9b28a"));
    }
    const lamp = at(f, w / 2 - 0.6, 0, front + 1.3);
    out.lamps.push({x: lamp[0], y: lamp[1], z: lamp[2]});
}

// MARK: - Plan trees, lamps

function lamps(out: SceneryOut, plan: TownPlan) {
    for (const s of plan.streets) {
        if (s.kind !== "high" && s.kind !== "road" && s.kind !== "quay" && s.kind !== "path") continue;
        const length = polylineLength(s.line);
        const step = s.kind === "high" ? 22 : 30;
        for (let a = 8; a < length - 4; a += step) {
            const {point, dir} = polylineAt(s.line, a);
            const side = Math.floor(a / step) % 2 ? 1 : -1;
            const off = side * (s.width / 2 + s.pavement - 0.4);
            const x = point.x - dir.z * off;
            const z = point.z + dir.x * off;
            out.lamps.push({x, y: streetHeight(x, z) + 0.16, z});
        }
    }
    // Lamps along the canal's towpaths and round the park's pond.
    const canal = polylineLength(CANAL);
    for (let a = 10; a < canal; a += 26) {
        const {point, dir} = polylineAt(CANAL, a);
        const off = (Math.floor(a / 26) % 2 ? 1 : -1) * (CANAL_WIDTH / 2 + TOWPATH + 0.2);
        out.lamps.push({x: point.x - dir.z * off, y: TOWN_LEVEL + 0.1, z: point.z + dir.x * off});
    }
    for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        const x = MILLPOND.x + Math.cos(a) * (MILLPOND.rx + 5);
        const z = MILLPOND.z + Math.sin(a) * (MILLPOND.rz + 5);
        out.lamps.push({x, y: H(x, z), z});
    }
    // (The street trees are the plan's own, `plan.ts` plant(): drawn by the asset library with their colliders, lane GC;
    // a second row drawn here had none.)
    // A bandstand in the park.
    const bs = {x: -36, z: -56};
    const c = chunkFor(out, bs.x, bs.z);
    const f: Frame = {x: bs.x, y: H(bs.x, bs.z), z: bs.z, rot: 0};
    c.solid.cylinder(f, 0, 0, 0, 4, 4, 0.7, STONE, 8);
    for (let k = 0; k < 8; k++) c.solid.cylinder(f, Math.cos((k / 8) * Math.PI * 2) * 3.6, 0.7, Math.sin((k / 8) * Math.PI * 2) * 3.6, 0.1, 0.1, 2.8, IRON, 6, false);
    c.solid.cylinder(f, 0, 3.5, 0, 4.4, 0.4, 1.8, tone("#2f5a48"), 8);
    for (const p of [{x: -30, z: -64}, {x: -6, z: -54}, {x: -40, z: -82}, {x: 2, z: -88}]) bench(chunkFor(out, p.x, p.z).solid, p, Math.atan2(MILLPOND.x - p.x, MILLPOND.z - p.z));
}

// MARK: - Flower beds (lane GC)

/** Round beds round the park's bandstand, a bed either side of each front door's path (most houses), planters at the zoo's gate. */
function beds(out: SceneryOut, plan: TownPlan) {
    const soil = surfaceTag(SURF.earth);
    const bandstand = {x: -36, z: -56};
    for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        const x = bandstand.x + Math.cos(a) * 7.5;
        const z = bandstand.z + Math.sin(a) * 7.5;
        const c = chunkFor(out, x, z);
        flowerBed(c.foliage, c.decal, {x, y: 0, z, rot: 0}, 3.2, 3.2, hashText(`park-bed-${k}`), true, soil);
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
            const c = chunkFor(out, centre.x, centre.z);
            flowerBed(c.foliage, c.decal, {x: centre.x, y: 0, z: centre.z, rot: b.at.rot}, w, 0.7, hashText(`${p.id}-bed${side}`), false, soil);
        }
    }
    // Two raised planters either side of the zoo's gate.
    const plaza = plan.zoo.plaza;
    for (const side of [-1, 1]) {
        const q = local(plaza, side * 5.2, -plaza.d / 2 + 2.4);
        const c = chunkFor(out, q.x, q.z);
        const f: Frame = {x: q.x, y: H(q.x, q.z) + 0.1, z: q.z, rot: plaza.rot};
        c.solid.box(f, 0, 0, 0, 2.2, 0.5, 1.1, BRICK);
        flowerBed(c.foliage, c.decal, {x: q.x, y: 0.5, z: q.z, rot: plaza.rot}, 2.0, 0.9, hashText(`zoo-planter-${side}`), false, soil);
    }
}

// MARK: - All of it

export function buildScenery(plan: TownPlan = townPlan()): SceneryOut {
    // (`trees`: the plan's candidates; what is drawn is `trees.ts` townTrees, lane GC.)
    const out: SceneryOut = {chunks: new Map(), fresh: new Geo(), trees: [...plan.trees], lamps: [], bridges: []};
    streets(out, plan);
    bridges(out, plan);
    harbour(out);
    lock(out, plan);
    square(out, plan);
    boundaries(out, plan);
    fields(out, plan);
    zooPlaza(out, plan);
    lamps(out, plan);
    beds(out, plan);
    // The lamps' and the street furniture's bodies into the chunks; their lights and the lamp map (lane GA).
    out.furniture = streetFurniture(plan, out.lamps, {chunkAt: (x, z) => chunkFor(out, x, z), heightAt: streetHeight});
    // Drives: gravel or paving from the street to the house.
    for (const p of plan.parcels) {
        if (!p.drive) continue;
        const c = chunkFor(out, p.drive.x, p.drive.z);
        const drive = p.drive;
        tagged(c.decal, p.seed % 2 ? SURF.blocks : SURF.gravel, alongZ(drive.rot), () => c.decal.drape({x: drive.x, y: 0, z: drive.z, rot: drive.rot}, drive.w, drive.d, H, 0.1, () => tone(p.seed % 2 ? "#a49e94" : "#b5ab96"), 2));
        // A path from the pavement to the front door.
        const b = plan.buildings.find((q) => q.id === p.building);
        if (b) {
            const door = local(b.at, 0, b.at.d / 2 + 0.5);
            const gate = local(p.at, toLocal(p.at, door.x, door.z).x, p.at.d / 2);
            tagged(c.decal, SURF.slabs, Math.abs(door.z - gate.z) > Math.abs(door.x - gate.x), () => c.decal.ribbon([gate, door], 1.1, H, 0.09, tone("#b9b2a4"), 2));
        }
    }
    void sub;
    return out;
}
