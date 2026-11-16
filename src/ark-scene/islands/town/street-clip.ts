/**
 * Where two streets meet, each surface is drawn once (graphics pass 1, lane WATER; owner 2026-11-16: "roads overlap",
 * "there's a random glitch patch in the road on the town island").
 *
 * Every street used to be drawn whole, end to end: at a junction the side road's asphalt ran on to the main road's
 * middle at the same lift (two asphalts of different colours and tiling directions in one plane: they fought), its
 * pavements, kerbs and yellow lines ran out over the main road, the main road's pavement ran straight across the side
 * road's mouth, and the canal's towpaths ran across the high street's bridge as a pale band of gravel. Here, per layer:
 *
 * - carriageway: a street's asphalt stops where it enters another street's carriageway that it gives way to (a street
 *   that ends on another gives way to it; at a crossroads where both run through, the one listed first in the plan
 *   keeps the junction);
 * - pavement and kerb: never over any carriageway, and never over another street's pavement that it gives way to (so
 *   a corner's slabs are laid once);
 * - paint: never inside another street's carriageway (no centre line or yellow line through a junction);
 * - a towpath (or any path drawn beside the streets): never on a street (its carriageway or its pavements).
 *
 * A layer is cut along its line at the exact edge (sampled, then bisected to a centimetre), so the pieces meet with no
 * gap and no overlap. Pure: no three.js.
 */

import {polylineAt, polylineLength, type Poly, type Pt} from "@/ark-scene/islands/town/geom";
import type {Street} from "@/ark-scene/islands/town/plan";

type Box = {x0: number; z0: number; x1: number; z1: number};

/** A street with what the cutting asks of it, worked out once. */
export type ClipStreet = {street: Street; index: number; box: Box; ends: [Pt, Pt]; half: number; band: number};

export type StreetLayer = "carriageway" | "pavement" | "kerb" | "paint";

/**
 * The distance from a point to a street's line across it, with flat ends: past either end of the line nothing is near
 * it (a street ending at another's middle reaches only its own end, not a half-disc beyond it).
 */
export function acrossDistance(line: Poly, x: number, z: number): number {
    let best = Infinity;
    for (let i = 1; i < line.length; i++) {
        const a = line[i - 1];
        const b = line[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const l2 = dx * dx + dz * dz;
        if (l2 <= 0) continue;
        const t = ((x - a.x) * dx + (z - a.z) * dz) / l2;
        if (t < 0 || t > 1) continue;
        best = Math.min(best, Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)));
    }
    // (The outside of a gentle bend: near its vertex, though past the end of the segment before it and before the one
    // after. A sharp corner (the quay's) is drawn with a cut corner, so its outside is not counted as on it.)
    for (let i = 1; i < line.length - 1; i++) {
        const a = line[i - 1];
        const b = line[i];
        const c = line[i + 1];
        const turn = Math.abs(Math.atan2((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x), (b.x - a.x) * (c.x - b.x) + (b.z - a.z) * (c.z - b.z)));
        if (turn > Math.PI / 6) continue;
        const pastIn = (x - b.x) * (b.x - a.x) + (z - b.z) * (b.z - a.z) > 0;
        const beforeOut = (x - b.x) * (c.x - b.x) + (z - b.z) * (c.z - b.z) < 0;
        if (pastIn && beforeOut) best = Math.min(best, Math.hypot(x - b.x, z - b.z));
    }
    return best;
}

export function clipStreets(streets: Street[]): ClipStreet[] {
    return streets.map((street, index) => {
        const band = street.width / 2 + street.pavement;
        let x0 = Infinity;
        let z0 = Infinity;
        let x1 = -Infinity;
        let z1 = -Infinity;
        for (const p of street.line) {
            x0 = Math.min(x0, p.x - band);
            z0 = Math.min(z0, p.z - band);
            x1 = Math.max(x1, p.x + band);
            z1 = Math.max(z1, p.z + band);
        }
        return {street, index, box: {x0, z0, x1, z1}, ends: [street.line[0], street.line[street.line.length - 1]], half: street.width / 2, band};
    });
}

function within(c: ClipStreet, x: number, z: number, reach: number): boolean {
    if (x < c.box.x0 || x > c.box.x1 || z < c.box.z0 || z > c.box.z1) return false;
    return acrossDistance(c.street.line, x, z) < reach;
}

/** Whether street `s` ends on street `t` near (x, z): one of its ends lies on `t`'s carriageway, close by. */
function endsOn(s: ClipStreet, t: ClipStreet, x: number, z: number): boolean {
    const near = t.band + s.band + 1;
    return s.ends.some((e) => Math.hypot(e.x - x, e.z - z) < near && acrossDistance(t.street.line, e.x, e.z) < t.half + 0.5);
}

/**
 * Whether street `s` gives way to street `t` at (x, z): it ends on `t` (and `t` runs on); otherwise (both running
 * through, or a corner where both end) `t` comes first in the plan.
 */
export function givesWay(s: ClipStreet, t: ClipStreet, x: number, z: number): boolean {
    const sEnds = endsOn(s, t, x, z);
    const tEnds = endsOn(t, s, x, z);
    if (sEnds !== tEnds) return sEnds;
    return t.index < s.index;
}

/** Whether street `own`'s `layer` is left out at (x, z) (another street's surface is drawn there). */
export function cutAt(all: ClipStreet[], own: ClipStreet | null, layer: StreetLayer, x: number, z: number): boolean {
    for (const t of all) {
        if (t === own) continue;
        const onRoad = within(t, x, z, t.half);
        switch (layer) {
            case "carriageway":
                if (onRoad && own && givesWay(own, t, x, z)) return true;
                break;
            case "pavement":
            case "kerb":
                if (onRoad) return true;
                if (t.street.pavement > 0 && own && within(t, x, z, t.band) && givesWay(own, t, x, z)) return true;
                break;
            case "paint":
                if (onRoad) return true;
                break;
        }
    }
    return false;
}

/** Whether (x, z) is on any street (its carriageway or its pavements): a towpath beside the canal stops there. */
export function onAnyStreet(all: ClipStreet[], x: number, z: number): boolean {
    return all.some((t) => within(t, x, z, Math.max(t.band, t.half)));
}

/** The point `along` metres down a line, moved `offset` m to its left (as `streets.ts` strips lay their edges). */
function offsetAt(line: Poly, along: number, offset: number): Pt {
    const {point, dir} = polylineAt(line, along);
    return {x: point.x - dir.z * offset, z: point.z + dir.x * offset};
}

/**
 * The stretches of a line (metres along it, [from, to]) kept at the points `offsets` m to its left (a strip's edges):
 * with `keep` "all" a stretch is kept only where no edge is cut (a pavement stops where either edge would reach into a
 * road: at a slant a sliver of ground shows rather than slabs on asphalt); with "any" while one edge is still uncut (a
 * carriageway runs on until its last edge meets the other road: no gap, the sliver under the other road's asphalt,
 * `GIVE_WAY_DROP`). Sampled every `step` m, each edge then bisected to a centimetre.
 */
export function keptRanges(line: Poly, offsets: number | number[], cut: (x: number, z: number) => boolean, keep: "all" | "any" = "all", step = 0.25): Array<[number, number]> {
    const length = polylineLength(line);
    if (length <= 0) return [];
    const list = typeof offsets === "number" ? [offsets] : offsets;
    const cutOne = (a: number, offset: number) => {
        const p = offsetAt(line, a, offset);
        return cut(p.x, p.z);
    };
    const isCut = (a: number) => (keep === "all" ? list.some((offset) => cutOne(a, offset)) : list.every((offset) => cutOne(a, offset)));
    const edge = (kept: number, gone: number) => {
        let a = kept;
        let b = gone;
        for (let i = 0; i < 20 && Math.abs(b - a) > 0.01; i++) {
            const m = (a + b) / 2;
            if (isCut(m)) b = m;
            else a = m;
        }
        return a;
    };
    const out: Array<[number, number]> = [];
    const n = Math.max(1, Math.ceil(length / step));
    let start: number | null = isCut(0) ? null : 0;
    let previous = 0;
    for (let k = 1; k <= n; k++) {
        const a = (length * k) / n;
        const gone = isCut(a);
        if (start === null && !gone) start = edge(a, previous);
        else if (start !== null && gone) {
            const end = edge(previous, a);
            if (end - start > 0.05) out.push([start, end]);
            start = null;
        }
        previous = a;
    }
    if (start !== null && length - start > 0.05) out.push([start, length]);
    return out;
}

/**
 * The part of a line from `a` to `b` metres along it (its own vertices kept between, but none within 0.3 m of a cut: a
 * strip's last few centimetres turned at a bend would fold its edge back over itself).
 */
export function subLine(line: Poly, a: number, b: number): Poly {
    const part: Poly = [polylineAt(line, a).point];
    let walked = 0;
    for (let i = 1; i < line.length; i++) {
        walked += Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z);
        if (walked > a + 0.3 && walked < b - 0.3) part.push(line[i]);
    }
    part.push(polylineAt(line, b).point);
    return part;
}

/** A line's pieces kept for a layer whose edges are `offsets` m to its left. */
export function keptPieces(line: Poly, offsets: number | number[], cut: (x: number, z: number) => boolean, keep: "all" | "any" = "all"): Poly[] {
    return keptRanges(line, offsets, cut, keep).map(([a, b]) => subLine(line, a, b));
}
