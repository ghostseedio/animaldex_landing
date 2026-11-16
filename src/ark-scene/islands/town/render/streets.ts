/**
 * The town's street surfaces (lane GA, docs/ark/town-island.md §11), chunk by chunk into the scenery's decal meshes:
 * the carriageway in asphalt (its wheel tracks, crown and gutters known to the shader through `across`), the
 * pavements in slabs, granite kerbs with a real face down to the road, the markings in worn paint, zebra crossings,
 * the towpaths and tracks, and the iron in the road (manhole covers along the crown, gully gratings in the gutters).
 *
 * Every vertex is tagged (`surface-tags.ts`), so the paving shader (`render/surfaces.ts`) draws each in its own
 * tiled PBR material at true scale. Pure: built in the town's prebuild worker with the rest of the scenery.
 */

import {polylineAt, polylineLength, type Poly, type Pt} from "@/ark-scene/islands/town/geom";
import {type Street, type TownPlan} from "@/ark-scene/islands/town/plan";
import {tone, type Geo} from "@/ark-scene/islands/town/render/kit";
import {SURF, surfaceTag, type SurfaceId} from "@/ark-scene/islands/town/render/surface-tags";
import {clipStreets, cutAt, keptPieces, keptRanges, subLine, type ClipStreet} from "@/ark-scene/islands/town/street-clip";

type Colour = [number, number, number];

const ROAD = tone("#55585c");
const HIGH = tone("#5f5d5b");
const LANE = tone("#6f6a63");
const TRACK = tone("#9a8462");
const PATH = tone("#b9ad96");
const ZOO_PATH = tone("#d2c098");
const QUAY = tone("#97918a");
const PAVEMENT = tone("#b6b1a7");
const KERB = tone("#bdb8af");
const WHITE = tone("#e9e7df");
const YELLOW = tone("#d8b84a");
const IRON = tone("#3a3936");

/** The carriageway's lift over the ground, the pavement's and the kerb's top (m). */
export const ROAD_LIFT = 0.06;
export const PAVEMENT_LIFT = 0.16;
export const KERB_TOP = 0.17;
const PAINT_LIFT = 0.072;
/**
 * A carriageway that gives way at a junction is laid this much lower (graphics pass 1): it runs on until its last edge
 * meets the other road (no gap), so where the two meet at a slant a sliver of it lies under the other road's asphalt,
 * and there the other road is drawn over it, never in one plane with it.
 */
export const GIVE_WAY_DROP = 0.008;
/** How far into its clear stretch a lowered run reaches (m): past the cuts' centimetre. */
const GIVE_WAY_MARGIN = 0.3;

/**
 * A carriageway piece's runs ([from, to, lowered]): kept while one of its edges (or its middle) is clear of the roads it
 * gives way to; lowered where any of them reaches into one (the sliver under the other road), and a little beyond.
 */
export function carriagewayRuns(part: Poly, width: number, cut: (x: number, z: number) => boolean): Array<[number, number, boolean]> {
    const offsets = [-width / 2, 0, width / 2];
    const clear = keptRanges(part, offsets, cut, "all");
    const length = polylineLength(part);
    const out: Array<[number, number, boolean]> = [];
    for (const [a, b] of keptRanges(part, offsets, cut, "any")) {
        let at = a;
        for (const [c0, c1] of clear) {
            const from = Math.max(c0 > 0.01 ? c0 + GIVE_WAY_MARGIN : c0, a);
            const to = Math.min(c1 < length - 0.01 ? c1 - GIVE_WAY_MARGIN : c1, b);
            if (to <= from) continue;
            if (from > at + 0.01) out.push([at, from, true]);
            out.push([from, to, false]);
            at = to;
        }
        if (b > at + 0.01) out.push([at, b, true]);
    }
    return out;
}

/** What each kind of street is surfaced with, and its colour. */
export function streetSurface(s: Pick<Street, "kind">): {surface: SurfaceId; colour: Colour} {
    switch (s.kind) {
        case "high":
            return {surface: SURF.asphalt, colour: HIGH};
        case "road":
            return {surface: SURF.asphalt, colour: ROAD};
        case "lane":
            return {surface: SURF.asphalt, colour: LANE};
        case "track":
            return {surface: SURF.earth, colour: TRACK};
        case "zoo_path":
            return {surface: SURF.gravel, colour: ZOO_PATH};
        case "quay":
            return {surface: SURF.flags, colour: QUAY};
        default:
            return {surface: SURF.flags, colour: PATH};
    }
}

/** Splits a polyline into pieces of about `piece` m so each lands in its own chunk. */
export function streetPieces(line: Poly, piece = 24): Poly[] {
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

/**
 * A line split at its sharp corners (over 60°: the quay's) into runs that meet square (graphics pass 1): one strip turned
 * round a right angle folds its inside edge back over itself, two layers of flags in one plane. The run before a
 * corner goes on half the width past it, the run after starts half the width after it, so the corner is laid once.
 */
export function cornerRuns(line: Poly, width: number): Poly[] {
    const out: Poly[] = [];
    let run: Poly = [line[0]];
    for (let i = 1; i < line.length - 1; i++) {
        const a = line[i - 1];
        const b = line[i];
        const c = line[i + 1];
        const turn = Math.abs(Math.atan2((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x), (b.x - a.x) * (c.x - b.x) + (b.z - a.z) * (c.z - b.z)));
        if (turn <= Math.PI / 3) {
            run.push(b);
            continue;
        }
        const lin = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const lout = Math.hypot(c.x - b.x, c.z - b.z) || 1;
        run.push({x: b.x + ((b.x - a.x) / lin) * (width / 2), z: b.z + ((b.z - a.z) / lin) * (width / 2)});
        out.push(run);
        run = [{x: b.x + ((c.x - b.x) / lout) * (width / 2), z: b.z + ((c.z - b.z) / lout) * (width / 2)}];
    }
    run.push(line[line.length - 1]);
    out.push(run);
    return out;
}

/** Whether a piece runs mostly along z (its rows, kerbs and slabs then run along z). */
function runsAlongZ(part: Poly): boolean {
    const a = part[0];
    const b = part[part.length - 1];
    return Math.abs(b.z - a.z) > Math.abs(b.x - a.x);
}

type V = {x: number; y: number; z: number};

/** Pushes a triangle with a tag per vertex (the street's `across` interpolates kerb to kerb). */
function tri(geo: Geo, a: V, b: V, c: V, ta: number, tb: number, tc: number, colour: Colour) {
    const ux = b.x - a.x;
    const uy = b.y - a.y;
    const uz = b.z - a.z;
    const vx = c.x - a.x;
    const vy = c.y - a.y;
    const vz = c.z - a.z;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    for (const [p, t] of [[a, ta], [b, tb], [c, tc]] as const) {
        geo.pos.push(p.x, p.y, p.z);
        geo.nor.push(nx, ny, nz);
        geo.col.push(colour[0], colour[1], colour[2]);
        geo.extra.push(t);
    }
}

/** The points along a line every `step` m, each with its unit normal (left of the direction of travel). */
function stations(line: Poly, step: number): Array<{x: number; z: number; nx: number; nz: number}> {
    const pts: Pt[] = [];
    for (let i = 1; i < line.length; i++) {
        const a = line[i - 1];
        const b = line[i];
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
        for (let k = 0; k < n; k++) pts.push({x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n});
    }
    pts.push(line[line.length - 1]);
    return pts.map((p, i) => {
        const a = pts[Math.max(i - 1, 0)];
        const b = pts[Math.min(i + 1, pts.length - 1)];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const l = Math.hypot(dx, dz) || 1;
        return {x: p.x, z: p.z, nx: -dz / l, nz: dx / l};
    });
}

/**
 * A flat strip along a line, `width` wide at `offset`, tagged per vertex: `across` runs from −1 on one edge to 1 on the
 * other (`acrossFrom`/`acrossTo` to give a strip a share of a wider one, as a paint line keeps the road's).
 */
export function strip(geo: Geo, line: Poly, width: number, heightAt: (x: number, z: number) => number, lift: number, colour: Colour, surface: SurfaceId, options: {step?: number; offset?: number; alongZ?: boolean; acrossFrom?: number; acrossTo?: number} = {}) {
    const step = options.step ?? 2;
    const offset = options.offset ?? 0;
    const z = options.alongZ ?? runsAlongZ(line);
    const t0 = surfaceTag(surface, z, options.acrossFrom ?? -1);
    const t1 = surfaceTag(surface, z, options.acrossTo ?? 1);
    let st = stations(line, step);
    // Across the strip in `columns` (graphics pass 1): one where the ground under it is straight across, four (and its
    // stations twice as close) where it bends (a shore's brow under a street's far half: one face edge to edge cut under
    // the drawn ground by 20 cm there, and the grass showed through the road).
    const at = (s: (typeof st)[number], f: number): V => {
        const o = offset + width * (f - 0.5);
        const x = s.x + s.nx * o;
        const z = s.z + s.nz * o;
        return {x, y: heightAt(x, z) + lift, z};
    };
    const bends = width > 1.5 && st.some((s) => {
        const a = at(s, 0);
        const b = at(s, 1);
        return Math.abs(at(s, 0.5).y - (a.y + b.y) / 2) > 0.015;
    });
    const columns = bends ? 4 : 1;
    if (bends) st = stations(line, step / 2);
    const rows = st.map((s) => Array.from({length: columns + 1}, (_, k) => at(s, k / columns)));
    const tag = (k: number) => (columns === 1 ? (k === 0 ? t0 : t1) : surfaceTag(surface, z, (options.acrossFrom ?? -1) + ((options.acrossTo ?? 1) - (options.acrossFrom ?? -1)) * (k / columns)));
    // (Column 0 is the right (−across) edge, the last the left (+across); wound to face up, as Geo.ribbon.)
    for (let i = 1; i < st.length; i++) {
        for (let k = 1; k <= columns; k++) {
            const l0 = rows[i - 1][k];
            const l1 = rows[i][k];
            const r0 = rows[i - 1][k - 1];
            const r1 = rows[i][k - 1];
            tri(geo, l0, l1, r1, tag(k), tag(k), tag(k - 1), colour);
            tri(geo, l0, r1, r0, tag(k), tag(k - 1), tag(k - 1), colour);
        }
    }
}

/** A kerb: its granite top and its face down to the road, at `offset` (the face on the road's side). */
function kerb(geo: Geo, line: Poly, offset: number, heightAt: (x: number, z: number) => number) {
    const z = runsAlongZ(line);
    const tag = surfaceTag(SURF.kerb, z, 0);
    const side = Math.sign(offset) || 1;
    const st = stations(line, 2);
    const at = (s: (typeof st)[number], extra: number, lift: number): V => {
        const x = s.x + s.nx * (offset + side * extra);
        const zz = s.z + s.nz * (offset + side * extra);
        return {x, y: heightAt(x, zz) + lift, z: zz};
    };
    for (let i = 1; i < st.length; i++) {
        const a = st[i - 1];
        const b = st[i];
        // The top: 0.16 m of granite from the face back toward the pavement.
        const a0 = at(a, 0, KERB_TOP);
        const b0 = at(b, 0, KERB_TOP);
        const a1 = at(a, 0.16, KERB_TOP);
        const b1 = at(b, 0.16, KERB_TOP);
        // The face, from the road up to the top, turned toward the road.
        const af = at(a, 0, ROAD_LIFT - 0.02);
        const bf = at(b, 0, ROAD_LIFT - 0.02);
        if (side > 0) {
            tri(geo, a1, b1, b0, tag, tag, tag, KERB);
            tri(geo, a1, b0, a0, tag, tag, tag, KERB);
            tri(geo, af, a0, b0, tag, tag, tag, KERB);
            tri(geo, af, b0, bf, tag, tag, tag, KERB);
        } else {
            tri(geo, a0, b0, b1, tag, tag, tag, KERB);
            tri(geo, a0, b1, a1, tag, tag, tag, KERB);
            tri(geo, b0, a0, af, tag, tag, tag, KERB);
            tri(geo, b0, af, bf, tag, tag, tag, KERB);
        }
    }
}

/** A flat quad (a cover, a crossing's stripe) centred at (x, z), `along` × `across` m, turned to the street. */
function patch(geo: Geo, x: number, z: number, dir: {x: number; z: number}, along: number, across: number, heightAt: (x: number, z: number) => number, lift: number, colour: Colour, surface: SurfaceId, rowsAlongZ: boolean) {
    const ax = dir.x * (along / 2);
    const az = dir.z * (along / 2);
    const cx = -dir.z * (across / 2);
    const cz = dir.x * (across / 2);
    // (Each corner on the road under it: a cover laid level at its middle's height sank into a sloping road at one edge.)
    const p = (s: number, t: number): V => {
        const px = x + ax * s + cx * t;
        const pz = z + az * s + cz * t;
        return {x: px, y: heightAt(px, pz) + lift, z: pz};
    };
    const lo = surfaceTag(surface, rowsAlongZ, -1);
    const hi = surfaceTag(surface, rowsAlongZ, 1);
    tri(geo, p(-1, 1), p(1, 1), p(1, -1), hi, hi, lo, colour);
    tri(geo, p(-1, 1), p(1, -1), p(-1, -1), hi, lo, lo, colour);
}

/** Where the zebra crossings are (by street id, metres along it): by the square, the high street's shops, the school run. */
export const CROSSINGS: Array<{street: string; at: number}> = [
    {street: "high_street", at: 152},
    {street: "high_street", at: 96},
    {street: "high_street_east", at: 40},
    {street: "harbour_road", at: 150},
    {street: "park_road", at: 60},
    {street: "mill_lane", at: 70}
];

/** The covers' snap (m): a manhole's middle sits on a multiple of it along the street, so the shader finds its edges. */
export const MANHOLE = 0.7;
export const GRATE = {along: 0.5, across: 0.36};

export type StreetSurfacesOut = {chunkAt: (x: number, z: number) => {decal: Geo}; heightAt: (x: number, z: number) => number};

/** Every street's surfaces into the chunks' decal meshes. */
export function streetSurfaces(plan: TownPlan, out: StreetSurfacesOut) {
    const {chunkAt, heightAt} = out;
    // Where streets meet, each surface is laid once (`street-clip.ts`): the cuts below.
    const clip = clipStreets(plan.streets);
    for (let index = 0; index < plan.streets.length; index++) {
        const s = plan.streets[index];
        const own: ClipStreet = clip[index];
        const cut = (layer: "carriageway" | "pavement" | "kerb" | "paint") => (x: number, z: number) => cutAt(clip, own, layer, x, z);
        const {surface, colour} = streetSurface(s);
        for (const part of cornerRuns(s.line, s.width).flatMap((run) => streetPieces(run))) {
            const mid = part[Math.floor(part.length / 2)];
            const geo = chunkAt(mid.x, mid.z).decal;
            const z = runsAlongZ(part);
            for (const [a, b, lowered] of carriagewayRuns(part, s.width, cut("carriageway"))) strip(geo, subLine(part, a, b), s.width, heightAt, ROAD_LIFT - (lowered ? GIVE_WAY_DROP : 0), colour, surface, {alongZ: z});
            if (s.pavement > 0) {
                for (const side of [-1, 1]) {
                    for (const piece of keptPieces(part, [side * (s.width / 2 + 0.16), side * (s.width / 2 + s.pavement)], cut("pavement"))) {
                        strip(geo, piece, s.pavement - 0.16, heightAt, PAVEMENT_LIFT, PAVEMENT, SURF.slabs, {offset: side * (s.width / 2 + 0.16 + (s.pavement - 0.16) / 2), alongZ: z, acrossFrom: side < 0 ? 1 : -1, acrossTo: side < 0 ? -1 : 1});
                    }
                    for (const piece of keptPieces(part, [side * (s.width / 2), side * (s.width / 2 + 0.16)], cut("kerb"))) kerb(geo, piece, side * (s.width / 2), heightAt);
                }
            }
            // Markings: a dashed centre line on roads; double yellow lines along the high street's edges.
            if (s.kind === "road" || s.kind === "high") {
                const length = polylineLength(part);
                for (let a = 1; a < length - 3; a += 6) {
                    const p0 = polylineAt(part, a).point;
                    const p1 = polylineAt(part, a + 3).point;
                    for (const dash of keptPieces([p0, p1], [-0.06, 0.06], cut("paint"))) strip(geo, dash, 0.12, heightAt, PAINT_LIFT, WHITE, SURF.paint, {step: 1, alongZ: z, acrossFrom: -0.02, acrossTo: 0.02});
                }
                if (s.kind === "high") {
                    for (const side of [-1, 1]) {
                        for (const k of [0, 1]) {
                            const off = side * (s.width / 2 - 0.25 - k * 0.2);
                            const across = off / (s.width / 2);
                            for (const line of keptPieces(part, [off - 0.05, off + 0.05], cut("paint"))) strip(geo, line, 0.1, heightAt, PAINT_LIFT, YELLOW, SURF.paint, {offset: off, alongZ: z, acrossFrom: across - 0.01, acrossTo: across + 0.01});
                        }
                    }
                }
            }
        }
        if (s.kind !== "road" && s.kind !== "high") continue;
        const length = polylineLength(s.line);
        // Zebra crossings: white stripes across the road, with the give-way studs' broken lines either side.
        for (const c of CROSSINGS) {
            if (c.street !== s.id || c.at > length - 4) continue;
            const {point, dir} = polylineAt(s.line, c.at);
            const geo = chunkAt(point.x, point.z).decal;
            const z = Math.abs(dir.z) > Math.abs(dir.x);
            for (let t = -s.width / 2 + 0.5; t <= s.width / 2 - 0.5; t += 1.0) {
                const x = point.x - dir.z * t;
                const zz = point.z + dir.x * t;
                patch(geo, x, zz, dir, 2.4, 0.5, heightAt, PAINT_LIFT + 0.002, WHITE, SURF.paint, z);
            }
            for (const end of [-1, 1]) {
                for (let t = -s.width / 2 + 0.3; t <= s.width / 2 - 0.3; t += 0.6) {
                    const x = point.x + dir.x * end * 2.2 - dir.z * t;
                    const zz = point.z + dir.z * end * 2.2 + dir.x * t;
                    patch(geo, x, zz, dir, 0.1, 0.3, heightAt, PAINT_LIFT, WHITE, SURF.paint, z);
                }
            }
        }
        // Manhole covers on the crown every ~45 m; a gully grating in each gutter every 24 m (the plan's storm drains).
        for (let a = 12; a < length - 6; a += 45) {
            const {point, dir} = polylineAt(s.line, a);
            const z = Math.abs(dir.z) > Math.abs(dir.x);
            const along = z ? point.z : point.x;
            const snapped = (Math.round(along / MANHOLE - 0.5) + 0.5) * MANHOLE;
            const x = z ? point.x - dir.z * 0.9 : snapped;
            const zz = z ? snapped : point.z + dir.x * 0.9;
            if (cutAt(clip, own, "paint", x, zz)) continue;
            patch(chunkAt(x, zz).decal, x, zz, z ? {x: 0, z: 1} : {x: 1, z: 0}, MANHOLE, MANHOLE, heightAt, ROAD_LIFT + 0.004, IRON, SURF.manhole, z);
        }
        for (let a = 6; a < length - 3; a += 24) {
            const {point, dir} = polylineAt(s.line, a);
            const z = Math.abs(dir.z) > Math.abs(dir.x);
            for (const side of [-1, 1]) {
                const off = side * (s.width / 2 - GRATE.across / 2 - 0.02);
                const along = z ? point.z : point.x;
                const snapped = (Math.round(along / GRATE.along - 0.5) + 0.5) * GRATE.along;
                const x = z ? point.x - dir.z * off : snapped;
                const zz = z ? snapped : point.z + dir.x * off;
                if (cutAt(clip, own, "paint", x, zz)) continue;
                patch(chunkAt(x, zz).decal, x, zz, z ? {x: 0, z: 1} : {x: 1, z: 0}, GRATE.along, GRATE.across, heightAt, ROAD_LIFT + 0.004, IRON, SURF.grate, z);
            }
        }
    }
}
