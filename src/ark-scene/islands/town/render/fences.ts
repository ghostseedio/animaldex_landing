/**
 * The town's garden boundaries, made as they are built (graphics pass 1, lane PROPS: the owner's "the house fences just
 * look so simple"). Each boundary is cut into bays between posts, each bay set on its own ground, so a slope steps the
 * fence as a builder steps it, and where a home's front path meets a boundary (`doors.ts`) a gate hangs between two
 * gate posts.
 *
 * - **Garden fences** (the sides and backs of the gardens, `fence`): by the garden, a close-board fence (feather-edge
 *   boards on the garden side, arris rails behind, a gravel board, a capping rail, capped posts), a slatted fence
 *   (stained horizontal slats with a shadow gap) or a lap panel with a trellis top.
 * - **A house's front boundary** (`wall`, low): by the house, a painted picket fence with pointed pickets, a low brick
 *   wall with piers and a stone coping, or iron railings on a low brick plinth; a front hedge (`render/nature.ts`)
 *   gets timber gate posts and a ledged gate.
 * - **Yard and garden walls** (`wall`, tall): brick with a pier every 4.5 m or so, a stone coping.
 * - **Front railings** (`railing`): iron bars with spear heads between rails on a stone plinth, a post with a ball top
 *   every 2.4 m.
 *
 * Vertex colours. Two levels, as the buildings have (`BuildingDetail`): the **far** level, merged into the scenery
 * chunk's solid as before (one draw a chunk), is the boundary's body (posts, a panel, rails, a wall and its coping);
 * the **near** level, built only for the chunks round the camera with the buildings' near detail, adds what lies on
 * that body (the boards, slats, pickets, bars and their heads, the trellis, the gates' boards), always in front of it,
 * so nothing far is ever hidden or doubled. A board, a picket or a bar is two faces, never a box.
 */

import {hashText, polylineAt, polylineLength, rng, type Poly, type Pt} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {townPlan, type Hedge, type TownPlan} from "@/ark-scene/islands/town/plan";
import {townChunkOf} from "@/ark-scene/islands/town/chunks";
import {pathOpenings} from "@/ark-scene/islands/town/doors";
import {at, Geo, NullGeo, tone, type Frame} from "@/ark-scene/islands/town/render/kit";

type RGB = [number, number, number];
type V3 = [number, number, number];

const H = (x: number, z: number) => townHeight(x, z);

/**
 * The building surfaces' kinds (`render/buildings.ts` SURFACE: the solid material's brick, stone, timber, paint and
 * metal in the shader), so a wall is brick and its coping stone close up. (Kept here: buildings.ts imports this file.)
 */
export const FENCE_SURFACE = {brick: 1, stone: 5, timber: 6, paint: 7, metal: 8} as const;

/** A gate's opening in a boundary: its middle and half its width (m). */
export type Opening = {x: number; z: number; half: number};

export type GardenFenceStyle = "closeboard" | "slatted" | "trellis";
export type FrontStyle = "picket" | "brick" | "railing";

const TIMBERS = ["#a88460", "#96744f", "#b8946a", "#8c765c", "#bca07c"].map((c) => tone(c));
const STAINS = ["#6a6058", "#7a6650", "#5e6264", "#86705a"].map((c) => tone(c));
const PAINTS = ["#f0ede4", "#e9e2cf", "#c9d4c0", "#c4d0d8", "#eae4d6", "#a9b89a"].map((c) => tone(c));
const BRICKS = ["#8c5a48", "#9a6450", "#7e4e3e", "#a06a52", "#86604c"].map((c) => tone(c));
const STONE = tone("#c9c0ac");
const IRON = tone("#24272a");
const GATE_PAINTS = ["#2f4f6f", "#2e5a3a", "#232323", "#f0ede4", "#6a4a2e"].map((c) => tone(c));

function shade(c: RGB, k: number): RGB {
    return [c[0] * k, c[1] * k, c[2] * k];
}

function pick<T>(list: readonly T[], u: number): T {
    return list[Math.min(Math.floor(u * list.length), list.length - 1)];
}

/** The style of a garden's side or back fence: by its boundary's id, so neighbours differ. */
export function gardenFenceStyle(id: string): GardenFenceStyle {
    const u = (hashText(`${id}|style`) % 1000) / 1000;
    return u < 0.5 ? "closeboard" : u < 0.78 ? "slatted" : "trellis";
}

/** The style of a house's low front boundary: by its boundary's id. */
export function frontStyle(id: string): FrontStyle {
    const u = (hashText(`${id}|front`) % 1000) / 1000;
    return u < 0.4 ? "picket" : u < 0.75 ? "brick" : "railing";
}

// MARK: - Faces

/** A flat polygon (3 or 4 points), wound to face `n` (world). */
function facet(geo: Geo, pts: V3[], n: V3, colour: RGB) {
    const [a, b, c] = pts;
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const dot = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
    const list = dot < 0 ? [...pts].reverse() : pts;
    if (list.length === 3) geo.tri(list[0], list[1], list[2], colour);
    else geo.quad(list[0], list[1], list[2], list[3], colour);
}

/** The frame's local +x in the world (a boundary's across). */
function across(f: Frame, side: 1 | -1): V3 {
    return [Math.cos(f.rot) * side, 0, Math.sin(f.rot) * side];
}

/** A vertical rectangle in the plane local x = `x`, along z0..z1, y0..y1, seen from `side`. */
function sheet(geo: Geo, f: Frame, x: number, z0: number, z1: number, y0: number, y1: number, colour: RGB, side: 1 | -1) {
    facet(geo, [at(f, x, y0, z0), at(f, x, y0, z1), at(f, x, y1, z1), at(f, x, y1, z0)], across(f, side), colour);
}

/** Both faces of a thin board (`t` thick) in the plane x, front a little lighter than back. */
function board(geo: Geo, f: Frame, x: number, z0: number, z1: number, y0: number, y1: number, t: number, colour: RGB, tip = 0) {
    for (const side of [1, -1] as const) {
        const xx = x + (side * t) / 2;
        const c = side === 1 ? colour : shade(colour, 0.9);
        sheet(geo, f, xx, z0, z1, y0, y1, c, side);
        if (tip > 0) facet(geo, [at(f, xx, y1, z0), at(f, xx, y1, z1), at(f, xx, y1 + tip, (z0 + z1) / 2)], across(f, side), c);
    }
}

/** A post: a square box, a cap (a flat cap and a little pyramid, or a ball). */
function post(geo: Geo, f: Frame, z: number, y0: number, h: number, size: number, colour: RGB, cap: "pyramid" | "flat" | "ball" | "none" = "pyramid") {
    geo.box(f, 0, y0, z, size, h, size, colour);
    if (cap === "pyramid") {
        geo.box(f, 0, y0 + h, z, size + 0.03, 0.025, size + 0.03, shade(colour, 1.05));
        geo.pyramid(f, 0, y0 + h + 0.025, z, size + 0.01, size * 0.6, shade(colour, 1.08));
    } else if (cap === "flat") geo.box(f, 0, y0 + h, z, size + 0.05, 0.05, size + 0.05, STONE);
    else if (cap === "ball") {
        geo.cylinder(f, 0, y0 + h, z, size * 0.25, size * 0.25, 0.05, colour, 6);
        geo.cylinder(f, 0, y0 + h + 0.05, z, size * 0.42, size * 0.1, size * 0.55, colour, 6);
    }
}

// MARK: - Bays

type Bay = {f: Frame; length: number; ground0: number; ground1: number};
type Run = {bays: Bay[]; gates: Array<{f: Frame; width: number}>};

/**
 * A boundary line cut into bays of at most `bay` m (each with its frame at its middle, on its own ground: local z along
 * the line), skipping each opening, where a gate's frame is given instead.
 */
function bays(line: Poly, bay: number, openings: readonly Opening[]): Run {
    const out: Run = {bays: [], gates: []};
    for (let i = 1; i < line.length; i++) {
        const a = line[i - 1];
        const b = line[i];
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        if (length < 0.2) continue;
        const dx = (b.x - a.x) / length;
        const dz = (b.z - a.z) / length;
        const rot = Math.atan2(-dx, dz);
        // The openings on this segment (within 0.4 m of it), as spans along it.
        const cuts: Array<[number, number]> = [];
        for (const o of openings) {
            const s = (o.x - a.x) * dx + (o.z - a.z) * dz;
            const off = Math.abs((o.x - a.x) * -dz + (o.z - a.z) * dx);
            if (off > 0.4 || s < -o.half || s > length + o.half) continue;
            const s0 = Math.max(s - o.half, 0);
            const s1 = Math.min(s + o.half, length);
            if (s1 - s0 < 0.3) continue;
            cuts.push([s0, s1]);
            const m = (s0 + s1) / 2;
            const p = {x: a.x + dx * m, z: a.z + dz * m};
            out.gates.push({f: {x: p.x, y: H(p.x, p.z), z: p.z, rot}, width: s1 - s0});
        }
        cuts.sort((p, q) => p[0] - q[0]);
        const spans: Array<[number, number]> = [];
        let from = 0;
        for (const [s0, s1] of cuts) {
            if (s0 > from + 0.05) spans.push([from, s0]);
            from = Math.max(from, s1);
        }
        if (length > from + 0.05) spans.push([from, length]);
        for (const [s0, s1] of spans) {
            const n = Math.max(1, Math.ceil((s1 - s0) / bay));
            const l = (s1 - s0) / n;
            for (let k = 0; k < n; k++) {
                const m = s0 + l * (k + 0.5);
                const p: Pt = {x: a.x + dx * m, z: a.z + dz * m};
                const p0 = {x: p.x - (dx * l) / 2, z: p.z - (dz * l) / 2};
                const p1 = {x: p.x + (dx * l) / 2, z: p.z + (dz * l) / 2};
                const g0 = H(p0.x, p0.z);
                const g1 = H(p1.x, p1.z);
                // (The bay stands on the lower of its ends' ground, its foot sunk into the higher.)
                out.bays.push({f: {x: p.x, y: Math.min(g0, g1, H(p.x, p.z)), z: p.z, rot}, length: l, ground0: g0, ground1: g1});
            }
        }
    }
    return out;
}

/** How far a bay's foot must reach down so neither end floats (m below its frame). */
function sink(b: Bay): number {
    return Math.max(b.f.y - Math.min(b.ground0, b.ground1), 0) + 0.08;
}

// MARK: - The two levels

/** Where a boundary draws: its far body and its near detail (either may be a `NullGeo`). */
export type FenceOut = {far: Geo; near: Geo};

/** A rail seen from one side and above (its front face and top): a rail against a panel shows no more. */
function rail(geo: Geo, f: Frame, x: number, side: 1 | -1, z0: number, z1: number, y: number, h: number, t: number, colour: RGB) {
    const xo = x + side * t;
    sheet(geo, f, xo, z0, z1, y, y + h, colour, side);
    facet(geo, [at(f, x, y + h, z0), at(f, x, y + h, z1), at(f, xo, y + h, z1), at(f, xo, y + h, z0)], [0, 1, 0], shade(colour, 1.06));
}

// MARK: - Garden fences

/** A garden's side or back fence (`height` m), by its style. */
export function gardenFence(out: FenceOut, line: Poly, height: number, id: string, openings: readonly Opening[] = []) {
    const {far, near} = out;
    const style = gardenFenceStyle(id);
    const r = rng(hashText(id));
    const wood = style === "slatted" ? pick(STAINS, r()) : pick(TIMBERS, r());
    const run = bays(line, 1.83, openings);
    const capped = style === "slatted" ? "flat" : "pyramid";
    for (const b of run.bays) {
        const {f, length} = b;
        const z0 = -length / 2 + 0.05;
        const z1 = length / 2 - 0.05;
        const foot = -sink(b);
        post(far, f, -length / 2, foot, height - foot + 0.06, 0.1, shade(wood, 0.82), "none");
        if (capped === "pyramid") near.pyramid(f, 0, height + 0.06, -length / 2, 0.12, 0.07, shade(wood, 0.9));
        else near.box(f, 0, height + 0.06, -length / 2, 0.13, 0.03, 0.13, STONE);
        if (style === "closeboard") {
            // Far: the panel (both faces), the gravel board's face, the capping rail. Near: the feather-edge boards on the
            // garden face (lapped, each a shade off its neighbour), the arris rails behind.
            for (const side of [1, -1] as const) {
                sheet(far, f, side * 0.015, z0, z1, foot + 0.1, height - 0.03, shade(wood, side === 1 ? 0.92 : 0.84), side);
                sheet(far, f, side * 0.022, z0, z1, foot, 0.15, shade(wood, 0.6), side);
                rail(far, f, side * 0.015, side, z0, z1, height - 0.04, 0.04, 0.03, shade(wood, 1.04));
            }
            const n = Math.max(3, Math.round((z1 - z0) / 0.14));
            const w = (z1 - z0) / n;
            for (let k = 0; k < n; k++) {
                const zz = z0 + k * w;
                const tint = 0.88 + 0.18 * (((k * 7 + Math.floor(r() * 3)) % 5) / 4);
                sheet(near, f, 0.028, zz, zz + w + 0.004, 0.15, height - 0.045, shade(wood, tint), 1);
            }
            for (const y of [0.4, height - 0.42]) rail(near, f, -0.015, -1, z0, z1, y, 0.08, 0.05, shade(wood, 0.9));
        } else if (style === "slatted") {
            // Far: a dark backing (the shadow between the slats) both faces, the base board. Near: the slats, both faces.
            for (const side of [1, -1] as const) {
                sheet(far, f, side * 0.006, z0, z1, foot, height, shade(wood, 0.35), side);
                sheet(far, f, side * 0.02, z0, z1, foot, 0.05, shade(wood, 0.7), side);
            }
            const slat = 0.11;
            const gap = 0.025;
            for (let y = 0.05; y + slat <= height + 0.001; y += slat + gap) {
                const c = shade(wood, 0.95 + 0.1 * r());
                for (const side of [1, -1] as const) sheet(near, f, side * 0.016, z0, z1, y, y + slat, side === 1 ? c : shade(c, 0.9), side);
            }
        } else {
            // A lap panel under a square trellis. Far: the panel and its frame rails. Near: the lap boards' lines, the trellis.
            const top = height - 0.38;
            for (const side of [1, -1] as const) {
                sheet(far, f, side * 0.015, z0, z1, foot, top, shade(wood, side === 1 ? 0.95 : 0.86), side);
                rail(far, f, side * 0.015, side, z0, z1, top - 0.02, 0.04, 0.02, shade(wood, 1.04));
                rail(far, f, side * 0.015, side, z0, z1, height - 0.03, 0.04, 0.02, shade(wood, 1.04));
            }
            const n = 7;
            for (let k = 0; k < n; k++) {
                if (k % 2) continue;
                const y0 = foot + ((top - foot) * k) / n;
                const y1 = foot + ((top - foot) * (k + 1)) / n;
                for (const side of [1, -1] as const) sheet(near, f, side * 0.022, z0, z1, Math.max(y0, 0), y1, shade(wood, side === 1 ? 0.86 : 0.78), side);
            }
            const cells = Math.max(3, Math.round(length / 0.3));
            for (let k = 1; k < cells; k++) {
                const zz = -length / 2 + (length * k) / cells;
                board(near, f, 0, zz - 0.012, zz + 0.012, top, height - 0.03, 0.02, shade(wood, 1.02));
            }
            board(near, f, 0, z0, z1, (top + height) / 2 - 0.012, (top + height) / 2 + 0.012, 0.02, shade(wood, 1.02));
        }
    }
    closingPost(line, (f) => {
        post(far, f, 0, -0.1, height + 0.16, 0.1, shade(wood, 0.82), "none");
        near.pyramid(f, 0, height + 0.06, 0, 0.12, 0.07, shade(wood, 0.9));
    });
    for (const g of run.gates) ledgedGate(out, g.f, g.width, height, wood);
}

function closingPost(line: Poly, draw: (f: Frame) => void) {
    if (line.length < 2) return;
    const a = line[line.length - 2];
    const b = line[line.length - 1];
    if (Math.hypot(line[0].x - b.x, line[0].z - b.z) < 0.05) return;
    draw({x: b.x, y: H(b.x, b.z), z: b.z, rot: Math.atan2(-(b.x - a.x), b.z - a.z)});
}

// MARK: - Gates

/** Two gate posts and a ledged-and-braced timber gate, closed. Far: the posts and the gate's face. Near: its boards, ledges, brace, latch. */
function ledgedGate(out: FenceOut, f: Frame, width: number, height: number, wood: RGB) {
    const {far, near} = out;
    const h = Math.min(height, 1.3);
    for (const z of [-width / 2, width / 2]) post(far, f, z, -0.15, h + 0.25, 0.12, shade(wood, 0.8), "none");
    for (const z of [-width / 2, width / 2]) near.pyramid(f, 0, h + 0.1, z, 0.14, 0.08, shade(wood, 0.86));
    const z0 = -width / 2 + 0.08;
    const z1 = width / 2 - 0.08;
    // (The face behind the boards dark: the gaps between them read as gaps.)
    for (const side of [1, -1] as const) sheet(far, f, side * 0.012, z0, z1, 0.06, h - 0.04, shade(wood, side === 1 ? 0.45 : 0.9), side);
    const n = Math.max(4, Math.round((z1 - z0) / 0.13));
    for (let k = 0; k < n; k++) {
        const a = z0 + ((z1 - z0) * k) / n;
        const c = shade(wood, 0.96 + 0.08 * (k % 2));
        sheet(near, f, 0.02, a + 0.006, a + (z1 - z0) / n - 0.006, 0.06, h - 0.04, c, 1);
        facet(near, [at(f, 0.02, h - 0.04, a + 0.006), at(f, 0.02, h - 0.04, a + (z1 - z0) / n - 0.006), at(f, 0.02, h + 0.01, a + (z1 - z0) / (2 * n))], across(f, 1), c);
    }
    for (const y of [0.25, h - 0.3]) rail(near, f, -0.012, -1, z0, z1, y, 0.12, 0.035, shade(wood, 0.86));
    const p = (y: number, z: number): V3 => at(f, -0.045, y, z);
    const b0 = p(0.31, z0 + 0.08);
    const b1 = p(h - 0.36, z1 - 0.12);
    facet(near, [b0, b1, [b1[0], b1[1] + 0.1, b1[2]], [b0[0], b0[1] + 0.1, b0[2]]], across(f, -1), shade(wood, 0.86));
    near.box(f, 0.035, h * 0.62, z1 - 0.1, 0.03, 0.04, 0.14, IRON);
}

/** A picket gate in its posts. Far: the posts and rails. Near: its pickets (arched over the top) and latch. */
function picketGate(out: FenceOut, f: Frame, width: number, height: number, paint: RGB) {
    const {far, near} = out;
    for (const z of [-width / 2, width / 2]) {
        post(far, f, z, -0.15, height + 0.28, 0.1, paint, "none");
        near.pyramid(f, 0, height + 0.13, z, 0.12, 0.07, paint);
    }
    const z0 = -width / 2 + 0.07;
    const z1 = width / 2 - 0.07;
    for (const y of [0.18, height - 0.25]) far.box(f, -0.03, y, 0, 0.035, 0.07, z1 - z0, shade(paint, 0.93));
    const n = Math.max(4, Math.round((z1 - z0) / 0.13));
    for (let k = 0; k < n; k++) {
        const zz = z0 + ((z1 - z0) * (k + 0.5)) / n;
        board(near, f, 0, zz - 0.035, zz + 0.035, 0.06, height + 0.02 - 0.04 * Math.sin((Math.PI * (k + 0.5)) / n), 0.02, paint, 0.06);
    }
    near.box(f, 0.025, height * 0.6, z1 - 0.07, 0.03, 0.04, 0.12, IRON);
}

/** An iron gate in its posts. Far: the posts and the frame. Near: the bars with spear heads. */
function ironGate(out: FenceOut, f: Frame, width: number, height: number) {
    const {far, near} = out;
    for (const z of [-width / 2, width / 2]) {
        post(far, f, z, -0.15, height + 0.3, 0.1, IRON, "none");
        ball(near, f, z, height + 0.15, 0.1);
    }
    const z0 = -width / 2 + 0.07;
    const z1 = width / 2 - 0.07;
    for (const y of [0.08, height - 0.12, height * 0.55]) far.box(f, 0, y, 0, 0.03, 0.035, z1 - z0, IRON);
    for (const z of [z0 + 0.02, z1 - 0.02]) far.box(f, 0, 0.05, z, 0.035, height - 0.05, 0.035, IRON);
    const n = Math.max(4, Math.round((z1 - z0) / 0.12));
    for (let k = 1; k < n; k++) {
        const zz = z0 + ((z1 - z0) * k) / n;
        board(near, f, 0, zz - 0.009, zz + 0.009, 0.08, height, 0.018, IRON, 0.07);
    }
}

/** A post's ball top (near): a neck and a ball, six-sided. */
function ball(geo: Geo, f: Frame, z: number, y: number, size: number) {
    geo.cylinder(f, 0, y, z, size * 0.25, size * 0.25, 0.05, IRON, 6, false);
    geo.cylinder(f, 0, y + 0.05, z, size * 0.42, size * 0.1, size * 0.55, IRON, 6);
}

// MARK: - Front boundaries

/** A house's low front boundary (`height` m) by its style, a gate at each opening. */
export function frontBoundary(out: FenceOut, line: Poly, height: number, id: string, openings: readonly Opening[] = []) {
    const {far, near} = out;
    const style = frontStyle(id);
    const r = rng(hashText(`${id}|fb`));
    if (style === "picket") {
        // Far: the posts and the two rails behind. Near: the pickets, pointed, the posts' caps.
        const paint = pick(PAINTS, r());
        const run = bays(line, 2.0, openings);
        for (const b of run.bays) {
            const {f, length} = b;
            const foot = -sink(b);
            post(far, f, -length / 2, foot, height - foot + 0.1, 0.09, paint, "none");
            near.pyramid(f, 0, height + 0.1, -length / 2, 0.11, 0.07, paint);
            for (const y of [0.15, height - 0.22]) far.box(f, -0.03, y, 0, 0.035, 0.07, length - 0.08, shade(paint, 0.92));
            const n = Math.max(3, Math.round((length - 0.1) / 0.13));
            for (let k = 0; k < n; k++) {
                const zz = -length / 2 + 0.05 + ((length - 0.1) * (k + 0.5)) / n;
                board(near, f, 0.002, zz - 0.035, zz + 0.035, foot + 0.04, height - 0.06, 0.02, paint, 0.07);
            }
        }
        closingPost(line, (f) => {
            post(far, f, 0, -0.1, height + 0.2, 0.09, paint, "none");
            near.pyramid(f, 0, height + 0.1, 0, 0.11, 0.07, paint);
        });
        for (const g of run.gates) picketGate(out, g.f, g.width, height, paint);
        return;
    }
    const brick = pick(BRICKS, r());
    if (style === "brick") {
        lowWall(far, line, height, brick, openings, 2.4);
        for (const g of bays(line, 2.4, openings).gates) ledgedGate(out, g.f, g.width, Math.max(height, 0.95), pick(GATE_PAINTS, r()));
        return;
    }
    // Railings on a low brick plinth.
    const plinth = 0.42;
    lowWall(far, line, plinth, brick, openings, 2.4, false);
    const run = bays(line, 2.4, openings);
    for (const b of run.bays) railingBay(out, b, plinth, Math.max(height, 0.9) + 0.1);
    for (const g of run.gates) ironGate(out, g.f, g.width, Math.max(height, 0.9));
}

/** A brick wall (`height` m) in bays: brick, piers every bay with stone caps (`piers`), a stone coping with a drip (far only). */
function lowWall(geo: Geo, line: Poly, height: number, brick: RGB, openings: readonly Opening[], bay: number, piers = true) {
    const run = bays(line, bay, openings);
    for (const b of run.bays) {
        const {f, length} = b;
        const foot = -sink(b);
        geo.as(FENCE_SURFACE.brick, () => geo.box(f, 0, foot, 0, 0.23, height - foot, length + 0.01, brick, 0, {top: shade(brick, 0.88)}));
        geo.as(FENCE_SURFACE.stone, () => geo.box(f, 0, height, 0, 0.32, 0.06, length + 0.02, STONE));
        if (piers) {
            geo.as(FENCE_SURFACE.brick, () => geo.box(f, 0, foot, -length / 2, 0.36, height - foot + 0.12, 0.36, shade(brick, 0.95)));
            geo.as(FENCE_SURFACE.stone, () => geo.box(f, 0, height + 0.12, -length / 2, 0.44, 0.07, 0.44, STONE));
        }
    }
    if (piers) closingPost(line, (f) => {
        geo.as(FENCE_SURFACE.brick, () => geo.box(f, 0, -0.1, 0, 0.36, height + 0.22, 0.36, shade(brick, 0.95)));
        geo.as(FENCE_SURFACE.stone, () => geo.box(f, 0, height + 0.12, 0, 0.44, 0.07, 0.44, STONE));
    });
    for (const g of run.gates) {
        for (const z of [-g.width / 2 - 0.12, g.width / 2 + 0.12]) {
            geo.as(FENCE_SURFACE.brick, () => geo.box(g.f, 0, -0.15, z, 0.38, height + 0.35, 0.38, shade(brick, 0.95)));
            geo.as(FENCE_SURFACE.stone, () => geo.box(g.f, 0, height + 0.2, z, 0.46, 0.08, 0.46, STONE));
        }
    }
}

/** One bay of iron railings on `base` m. Far: the post and the two rails. Near: the bars and their spear heads, the post's ball. */
function railingBay(out: FenceOut, b: Bay, base: number, height: number) {
    const {far, near} = out;
    const {f, length} = b;
    post(far, f, -length / 2, base, height - base + 0.05, 0.07, IRON, "none");
    ball(near, f, -length / 2, height + 0.05, 0.07);
    for (const y of [base + 0.08, height - 0.12]) far.box(f, 0, y, 0, 0.028, 0.035, length, IRON);
    const n = Math.max(3, Math.round(length / 0.13));
    for (let k = 1; k < n; k++) {
        const zz = -length / 2 + (length * k) / n;
        board(near, f, 0, zz - 0.009, zz + 0.009, base, height, 0.018, IRON, 0.08);
    }
}

// MARK: - Walls and railings

/** A tall yard or garden wall (`height` m): brick, a pier every 4.5 m or so with a stone cap, a stone coping (far only). */
export function yardWall(out: FenceOut, line: Poly, height: number, id: string, openings: readonly Opening[] = []) {
    const brick = pick(BRICKS, (hashText(`${id}|brick`) % 1000) / 1000);
    lowWall(out.far, line, height, brick, openings, 4.5);
}

/** Front railings (`height` m) on a stone plinth, an iron gate at each opening. */
export function frontRailings(out: FenceOut, line: Poly, height: number, openings: readonly Opening[] = []) {
    const run = bays(line, 2.4, openings);
    for (const b of run.bays) {
        const foot = -sink(b);
        out.far.as(FENCE_SURFACE.stone, () => out.far.box(b.f, 0, foot, 0, 0.26, 0.22 - foot, b.length + 0.01, STONE));
        railingBay(out, b, 0.22, height + 0.1);
    }
    closingPost(line, (f) => {
        post(out.far, f, 0, 0.1, height + 0.1, 0.07, IRON, "none");
        ball(out.near, f, 0, height + 0.2, 0.07);
    });
    for (const g of run.gates) {
        for (const z of [-g.width / 2 - 0.08, g.width / 2 + 0.08]) out.far.as(FENCE_SURFACE.stone, () => out.far.box(g.f, 0, -0.1, z, 0.28, 0.32, 0.2, STONE));
        ironGate(out, g.f, g.width, height);
    }
}

/** Timber gate posts and a ledged gate in a front hedge's opening. */
export function hedgeGates(out: FenceOut, line: Poly, height: number, id: string, openings: readonly Opening[]) {
    const wood = pick(GATE_PAINTS, (hashText(`${id}|gate`) % 1000) / 1000);
    for (const g of bays(line, 3, openings).gates) ledgedGate(out, g.f, g.width, Math.max(height, 0.95), wood);
}

// MARK: - The town's boundaries, piece by piece

/** A boundary's piece (about 12 m), the chunk it is drawn in, and the front paths' openings in it. */
export type BoundaryPiece = {hedge: Hedge; part: Poly; chunk: number; openings: Opening[]};

/** Splits a polyline into pieces of about `piece` m (as `scenery.ts` does), so each lands in its own chunk. */
function piecesOf(line: Poly, piece: number): Poly[] {
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

/** Whether this lane draws a boundary (the gardens' fences, walls, railings, and front hedges' gates). */
export function madeHere(h: Hedge): boolean {
    return (h.kind === "fence" && !h.id.endsWith("-run")) || h.kind === "wall" || h.kind === "railing" || (h.kind === "hedge" && h.id.endsWith("-front"));
}

const piecesMemo = new WeakMap<TownPlan, BoundaryPiece[]>();

/** Every boundary this lane draws, in ~12 m pieces with their chunk and openings (the plan's; remembered). */
export function boundaryPieces(plan: TownPlan = townPlan()): BoundaryPiece[] {
    const known = piecesMemo.get(plan);
    if (known) return known;
    const out: BoundaryPiece[] = [];
    for (const h of plan.hedges) {
        if (!madeHere(h)) continue;
        const openings = pathOpenings(h.line, plan);
        for (const part of piecesOf(h.line, 12)) {
            const mid = part[Math.floor(part.length / 2)];
            out.push({hedge: h, part, chunk: townChunkOf(mid.x, mid.z), openings});
        }
    }
    piecesMemo.set(plan, out);
    return out;
}

/** Draws one piece into `out` (a hedge's piece: its gates only; the hedge itself is `render/nature.ts`). */
export function drawBoundary(out: FenceOut, piece: BoundaryPiece) {
    const {hedge: h} = piece;
    // The piece's own surface (timber, paint, metal, brick); a wall's coping and a plinth set theirs.
    const surface = h.kind === "fence" ? FENCE_SURFACE.timber : h.kind === "railing" ? FENCE_SURFACE.metal : h.kind === "hedge" ? FENCE_SURFACE.paint : !h.id.endsWith("-front") ? FENCE_SURFACE.brick : frontStyle(h.id) === "picket" ? FENCE_SURFACE.paint : frontStyle(h.id) === "railing" ? FENCE_SURFACE.metal : FENCE_SURFACE.paint;
    out.far.as(surface, () => out.near.as(surface, () => drawPiece(out, piece)));
}

function drawPiece(out: FenceOut, piece: BoundaryPiece) {
    const {hedge: h, part, openings} = piece;
    if (h.kind === "fence") gardenFence(out, part, h.height, h.id, openings);
    else if (h.kind === "railing") frontRailings(out, part, h.height, openings);
    else if (h.kind === "hedge") {
        if (openings.length) hedgeGates(out, part, h.height, h.id, openings);
    } else if (h.id.endsWith("-front")) frontBoundary(out, part, h.height, h.id, openings);
    else yardWall(out, part, h.height, h.id, openings);
}

const NULL = new NullGeo();

/** The near detail of the boundaries in one chunk (for `BuildingDetail`): drawn into `near`. */
export function boundaryDetail(plan: TownPlan, chunk: number, near: Geo) {
    for (const piece of boundaryPieces(plan)) if (piece.chunk === chunk) drawBoundary({far: NULL, near}, piece);
}

/** The chunks with a boundary this lane draws. */
export function boundaryChunks(plan: TownPlan = townPlan()): Set<number> {
    return new Set(boundaryPieces(plan).map((p) => p.chunk));
}

/** The far body of every boundary piece, into its chunk's solid. */
export function boundaryBodies(plan: TownPlan, solidOf: (chunk: number, at: Pt) => Geo) {
    for (const piece of boundaryPieces(plan)) {
        const mid = piece.part[Math.floor(piece.part.length / 2)];
        drawBoundary({far: solidOf(piece.chunk, mid), near: NULL}, piece);
    }
}
