/**
 * The scenery's own check (scenery lane, the motion 100x pass; the brief: "check all props for intersections and
 * floating"): every solid thing standing on the island, as drawn, with its footprint, its base and its top.
 *
 * - Floating: a base whose outline is in the air anywhere (a rock's downhill edge, a trunk on a slope, a log's end, a
 *   hay bale's end, a mound's rim, a barn's corner): measured against the terrain, a centimetre or two of tolerance.
 * - Standing in each other: a trunk in a rock, a log or a building; a rock, log, bale or mound in a building or in
 *   another of those. Rocks against rocks and logs against logs are clusters and piles: allowed.
 *
 * Pure (no three.js): `src/lib/ark-scenery.test.ts` fails CI on any, `scripts/ark-scenery-metrics.mts` counts them.
 */

import {forestFill, worldDecor} from "@/ark-scene/decor";
import {floorAssetInfo, floorPlacements} from "@/ark-scene/floor-assets";
import {allMounds, moundFoot} from "@/ark-scene/mounds";
import {COTTAGE} from "@/ark-scene/micro-decor";
import {rockAssetFor, rockBase, rockBox} from "@/ark-scene/rock-assets";
import {allMountainRocks, piecePoint, pieceBox} from "@/ark-scene/rock-layout";
import {cachedRock, ROCK_DETAIL} from "@/ark-scene/rock-shapes";
import {treeBody} from "@/ark-scene/tree-spacing";
import {heightAt} from "@/ark-scene/world";

export type Solid = {
    kind: "rock" | "crag" | "boulder" | "scree" | "trunk" | "log" | "hay" | "mound" | "barn" | "cottage";
    id: string;
    x: number;
    z: number;
    /** An oriented box (its turn's cos and sin, half-extents in its own frame), or a circle of `r`. */
    cos: number;
    sin: number;
    hx0: number;
    hx1: number;
    hz0: number;
    hz1: number;
    r?: number;
    y0: number;
    y1: number;
    /** Points of its base (world), each of which must be in or on the ground. */
    base: Array<[number, number, number]>;
};

export type Problem = {what: string; a: string; b?: string; x: number; z: number; by: number};

/** Tolerances: a base point this far above the ground floats; a solid this far inside another stands in it. */
export const FLOAT_TOLERANCE = 0.025;
export const INSIDE_TOLERANCE = 0.08;

function box(kind: Solid["kind"], id: string, x: number, z: number, yaw: number, b: {min: number[]; max: number[]}, scale: number, y: number): Omit<Solid, "base"> {
    return {kind, id, x, z, cos: Math.cos(yaw), sin: Math.sin(yaw), hx0: b.min[0] * scale, hx1: b.max[0] * scale, hz0: b.min[2] * scale, hz1: b.max[2] * scale, y0: y + b.min[1] * scale, y1: y + b.max[1] * scale};
}

/** A ring of base points: an ellipse inside the footprint (`inset` of it), turned by yaw, at height y. */
function ring(x: number, z: number, yaw: number, b: {min: number[]; max: number[]}, scale: number, y: number, inset: number, count = 12): Array<[number, number, number]> {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const out: Array<[number, number, number]> = [];
    for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2;
        const lx = ((Math.cos(a) * 0.5 + 0.5) * (b.max[0] - b.min[0]) + b.min[0]) * inset * scale;
        const lz = ((Math.sin(a) * 0.5 + 0.5) * (b.max[2] - b.min[2]) + b.min[2]) * inset * scale;
        out.push([x + lx * c + lz * s, y, z - lx * s + lz * c]);
    }
    return out;
}

/** Every solid thing on the island as drawn. */
export function sceneSolids(): Solid[] {
    const solids: Solid[] = [];
    const decor = worldDecor();
    decor.forEach((item, i) => {
        const id = `decor${i}`;
        if (item.kind === "rock") {
            const placed = rockAssetFor(item);
            if (!placed) return;
            solids.push({kind: "rock", id, ...rockBox(placed), base: rockBase(placed)});
        } else if (item.kind === "hay") {
            // vegetation.ts hay(): a round bale 1.24 m across and 1.15 m long, lying along x, its middle 0.6 m up.
            const s = item.scale;
            const b = {min: [-0.575, 0, -0.62], max: [0.575, 1.22, 0.62]};
            const y = item.y - 0.08;
            const c = Math.cos(item.rotation);
            const n = Math.sin(item.rotation);
            // Its two ends' lowest edges.
            const ends: Array<[number, number, number]> = [-0.5, 0.5].map((t) => [item.x + t * s * c, y + (0.6 - 0.62) * s, item.z - t * s * n]);
            solids.push({...box("hay", id, item.x, item.z, item.rotation, b, s, y), base: ends});
        } else if (item.kind === "barn") {
            // vegetation.ts barnGeometry: a 6.4 × 4.4 m body on y = 0, sunk with the decor.
            const b = {min: [-3.2, 0, -2.2], max: [3.2, 5.05, 2.2]};
            const y = item.y - 0.08;
            solids.push({...box("barn", id, item.x, item.z, item.rotation, b, item.scale, y), base: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => {
                const c = Math.cos(item.rotation);
                const n = Math.sin(item.rotation);
                const lx = sx * 3.2;
                const lz = sz * 2.2;
                return [item.x + lx * c + lz * n, y, item.z - lx * n + lz * c] as [number, number, number];
            })});
        }
    });
    // The cottage: its plinth reaches 0.87 m under its floor (micro-scene.ts).
    {
        const halfW = COTTAGE.width / 2;
        const halfD = COTTAGE.depth / 2;
        const b = {min: [-halfW, -0.87, -halfD], max: [halfW, COTTAGE.wall + COTTAGE.ridge, halfD]};
        solids.push({...box("cottage", "cottage", COTTAGE.x, COTTAGE.z, COTTAGE.rotation, b, 1, COTTAGE.floor), base: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [COTTAGE.x + sx * halfW, COTTAGE.floor - 0.87, COTTAGE.z + sz * halfD] as [number, number, number])});
    }
    // Tree trunks, as the spacing knows them.
    [...decor.map((item, i) => ({item, id: `decor${i}`})), ...forestFill().map((item, i) => ({item, id: `fill${i}`}))].forEach(({item, id}) => {
        const body = treeBody(item);
        if (!body || body.low) return;
        const r = body.trunk;
        const base: Array<[number, number, number]> = [];
        for (let k = 0; k < 8; k++) base.push([body.x + Math.cos((k / 8) * Math.PI * 2) * r * 0.8, body.y, body.z + Math.sin((k / 8) * Math.PI * 2) * r * 0.8]);
        solids.push({kind: "trunk", id, x: body.x, z: body.z, cos: 1, sin: 0, hx0: -r, hx1: r, hz0: -r, hz1: r, r, y0: body.y, y1: body.trunkTop, base});
    });
    // The forest floor's fallen logs (floor-assets.ts): lying along their x, tilted to the ground.
    floorPlacements().forEach((placed, i) => {
        if (!placed.id.startsWith("log-")) return;
        const b = floorAssetInfo(placed.id).bounds;
        const [ux, uy, uz] = placed.up;
        // The tilt (+y to up) then the turn, by hand (as the renderer composes them).
        const k = 1 / (1 + uy);
        const c = Math.cos(placed.yaw);
        const s = Math.sin(placed.yaw);
        const at = (x: number, y: number, z: number): [number, number, number] => {
            const tx = x * c + z * s;
            const tz = -x * s + z * c;
            return [placed.x + (uy + uz * uz * k) * tx + ux * y - ux * uz * k * tz, placed.y - ux * tx + uy * y - uz * tz, placed.z - ux * uz * k * tx + uz * y + (uy + ux * ux * k) * tz];
        };
        const s0 = placed.scale;
        // Its underside at both ends and the middle.
        const base = [b.min[0] * 0.9, 0, b.max[0] * 0.9].map((x) => at(x * s0, b.min[1] * s0 + 0.02, ((b.min[2] + b.max[2]) / 2) * s0));
        solids.push({...box("log", `floor${i}`, placed.x, placed.z, placed.yaw, b, s0, placed.y), base});
    });
    // Termite mounds (mounds.ts: the savanna's and, while termites are aboard, homes.ts's).
    allMounds().forEach((mound, i) => {
        const r = moundFoot(mound);
        const base: Array<[number, number, number]> = [];
        for (let k = 0; k < 10; k++) base.push([mound.x + Math.cos((k / 10) * Math.PI * 2) * r * 0.85, mound.y, mound.z + Math.sin((k / 10) * Math.PI * 2) * r * 0.85]);
        solids.push({kind: "mound", id: `mound${i}`, x: mound.x, z: mound.z, cos: 1, sin: 0, hx0: -r, hx1: r, hz0: -r, hz1: r, r, y0: mound.y, y1: mound.y + mound.h * mound.scale, base});
    });
    // The mountain's crags, boulders and scree (rock-layout.ts).
    allMountainRocks().forEach((piece, i) => {
        const b = cachedRock(piece.style, piece.variant, ROCK_DETAIL[piece.style][0]).bounds;
        const pb = pieceBox(piece);
        const base: Array<[number, number, number]> = [];
        for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            base.push(piecePoint(piece, (Math.cos(a) * 0.5 + 0.5) * (b.max[0] - b.min[0]) * 0.92 + b.min[0] * 0.92, 0, (Math.sin(a) * 0.5 + 0.5) * (b.max[2] - b.min[2]) * 0.92 + b.min[2] * 0.92));
        }
        solids.push({kind: piece.role, id: `${piece.role}${i}`, x: piece.x, z: piece.z, cos: Math.cos(piece.yaw), sin: Math.sin(piece.yaw), ...pb, base});
    });
    return solids;
}

/** How far a point (x, z) is inside a solid's footprint, shrunk by `inset` (m): positive when inside. */
function inside(solid: Solid, x: number, z: number, inset: number): number {
    if (solid.r !== undefined) return solid.r - inset - Math.hypot(x - solid.x, z - solid.z);
    const dx = x - solid.x;
    const dz = z - solid.z;
    const lx = dx * solid.cos - dz * solid.sin;
    const lz = dx * solid.sin + dz * solid.cos;
    return Math.min(lx - (solid.hx0 + inset), solid.hx1 - inset - lx, lz - (solid.hz0 + inset), solid.hz1 - inset - lz);
}

/** Pairs allowed to overlap: rock piles and clusters, log piles, scree on scree. */
const ROCKY = new Set(["rock", "crag", "boulder", "scree"]);
function allowed(a: Solid, b: Solid): boolean {
    if (ROCKY.has(a.kind) && ROCKY.has(b.kind)) return true;
    if (a.kind === "log" && b.kind === "log") return true;
    // A small stone under a log or by a trunk is litter, not an intersection.
    if ((a.kind === "scree" || b.kind === "scree") && (a.kind === "log" || b.kind === "log")) return true;
    return a.kind === "trunk" && b.kind === "trunk";
}

/** What floats and what stands in what. */
export function sceneryProblems(solids: Solid[] = sceneSolids()): {floating: Problem[]; intersections: Problem[]; solids: number} {
    const floating: Problem[] = [];
    for (const solid of solids) {
        let worst = 0;
        let at: [number, number, number] | null = null;
        for (const p of solid.base) {
            const gap = p[1] - heightAt(p[0], p[2]);
            if (gap > worst) {
                worst = gap;
                at = p;
            }
        }
        if (worst > FLOAT_TOLERANCE && at) floating.push({what: `${solid.kind} floats`, a: solid.id, x: at[0], z: at[2], by: worst});
    }
    // Intersections: a spatial grid of footprints.
    const cell = 6;
    const grid = new Map<string, Solid[]>();
    const reach = (s: Solid) => s.r ?? Math.hypot(Math.max(-s.hx0, s.hx1), Math.max(-s.hz0, s.hz1));
    for (const s of solids) {
        const r = reach(s);
        for (let i = Math.floor((s.x - r) / cell); i <= Math.floor((s.x + r) / cell); i++) for (let j = Math.floor((s.z - r) / cell); j <= Math.floor((s.z + r) / cell); j++) {
            const key = `${i},${j}`;
            const list = grid.get(key);
            if (list) list.push(s);
            else grid.set(key, [s]);
        }
    }
    const intersections: Problem[] = [];
    const seen = new Set<string>();
    for (const a of solids) {
        // The "small" one's middle and a ring round it against the other's footprint, both of them solid there in height.
        const r = reach(a);
        const near = new Set<Solid>();
        for (let i = Math.floor((a.x - r) / cell); i <= Math.floor((a.x + r) / cell); i++) for (let j = Math.floor((a.z - r) / cell); j <= Math.floor((a.z + r) / cell); j++) for (const b of grid.get(`${i},${j}`) ?? []) near.add(b);
        near.forEach((b) => {
            if (b === a || allowed(a, b)) return;
            const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
            if (seen.has(key)) return;
            // Heights must overlap (a trunk under a high crag's overhang is not in it).
            if (Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) < INSIDE_TOLERANCE) return;
            // A trunk (a circle) stands in a box when its middle is within the box widened by most of its radius; boxes
            // against boxes when either's middle or a corner is inside the other.
            const probe = (p: Solid, q: Solid) => {
                if (p.r !== undefined) return inside(q, p.x, p.z, -p.r * 0.6 + INSIDE_TOLERANCE);
                let deepest = inside(q, p.x, p.z, INSIDE_TOLERANCE);
                for (const [sx, sz] of [[0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]]) {
                    const lx = sx > 0 ? p.hx1 * 0.6 : p.hx0 * 0.6;
                    const lz = sz > 0 ? p.hz1 * 0.6 : p.hz0 * 0.6;
                    deepest = Math.max(deepest, inside(q, p.x + lx * p.cos + lz * p.sin, p.z - lx * p.sin + lz * p.cos, INSIDE_TOLERANCE));
                }
                return deepest;
            };
            const depth = Math.max(probe(a, b), probe(b, a));
            if (depth > 0) {
                seen.add(key);
                intersections.push({what: `${a.kind} in ${b.kind}`, a: a.id, b: b.id, x: a.x, z: a.z, by: depth});
            }
        });
    }
    return {floating, intersections, solids: solids.length};
}
