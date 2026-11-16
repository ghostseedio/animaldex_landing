/**
 * The town's benches (graphics pass 1, lane PROPS: the owner's "benches look bad too"). One bench, made as a park bench
 * is: two cast ends (a front leg, a raked back leg running up into the back post, the seat bearer, an armrest on its
 * curved support), five seat slats, three back slats raked to the back, a little sag in the seat. A bench was a board,
 * a back board and two blocks in the square and the park; the high streets' had boxes for ends.
 *
 * About 190 triangles a bench (struts and planks are four-sided, no hidden caps), vertex colours, merged into the
 * scenery chunk's solid as before: the town has a few dozen (the square, the park round the millpond, the high streets,
 * the zoo's plaza and closed plots), about 10k triangles in all, so it needs no lighter far version.
 */

import {at, Geo, type Frame} from "@/ark-scene/islands/town/render/kit";

type RGB = [number, number, number];
type V3 = [number, number, number];

function shade(c: RGB, k: number): RGB {
    return [c[0] * k, c[1] * k, c[2] * k];
}

/** A four-sided prism of `w` × `t` (m) from a to b (frame-local x, y, z), its width along local x. */
function strut(geo: Geo, f: Frame, a: V3, b: V3, w: number, t: number, colour: RGB) {
    const A = at(f, a[0], a[1], a[2]);
    const B = at(f, b[0], b[1], b[2]);
    const d: V3 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const len = Math.hypot(d[0], d[1], d[2]) || 1;
    // Across: the frame's x; the other way: across × along.
    const ux: V3 = [Math.cos(f.rot), 0, Math.sin(f.rot)];
    const vx: V3 = [(ux[1] * d[2] - ux[2] * d[1]) / len, (ux[2] * d[0] - ux[0] * d[2]) / len, (ux[0] * d[1] - ux[1] * d[0]) / len];
    const corner = (p: V3, su: number, sv: number): V3 => [p[0] + ux[0] * su * w / 2 + vx[0] * sv * t / 2, p[1] + ux[1] * su * w / 2 + vx[1] * sv * t / 2, p[2] + ux[2] * su * w / 2 + vx[2] * sv * t / 2];
    const ring: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let i = 0; i < 4; i++) {
        const [s0, t0] = ring[i];
        const [s1, t1] = ring[(i + 1) % 4];
        const k = [0.86, 0.95, 1.05, 0.92][i];
        const c = shade(colour, k);
        const a0 = corner(A, s0, t0);
        const a1 = corner(A, s1, t1);
        const b1 = corner(B, s1, t1);
        const b0 = corner(B, s0, t0);
        // (Outward: the face's normal along the ring's own outward direction.)
        const out: V3 = [ux[0] * (s0 + s1) + vx[0] * (t0 + t1), ux[1] * (s0 + s1) + vx[1] * (t0 + t1), ux[2] * (s0 + s1) + vx[2] * (t0 + t1)];
        face(geo, [a0, a1, b1, b0], out, c);
    }
}

/** A plank along local x (x0…x1) whose cross-section runs from p0 to p1 (z, y) and is `t` thick: four faces, two ends. */
function plank(geo: Geo, f: Frame, x0: number, x1: number, p0: [number, number], p1: [number, number], t: number, colour: RGB) {
    const dz = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const len = Math.hypot(dz, dy) || 1;
    // The section's normal (its top for a seat slat, its front for a back slat).
    const nz = (-dy / len) * t;
    const ny = (dz / len) * t;
    const q: Array<[number, number]> = [p0, p1, [p1[0] + nz, p1[1] + ny], [p0[0] + nz, p0[1] + ny]];
    const P = (x: number, k: number): V3 => at(f, x, q[k][1], q[k][0]);
    for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const mz = (q[i][0] + q[j][0]) / 2 - (q[0][0] + q[2][0]) / 2;
        const my = (q[i][1] + q[j][1]) / 2 - (q[0][1] + q[2][1]) / 2;
        const o = at(f, 0, my, mz);
        const c0 = at(f, 0, 0, 0);
        face(geo, [P(x0, i), P(x1, i), P(x1, j), P(x0, j)], [o[0] - c0[0], o[1] - c0[1], o[2] - c0[2]], shade(colour, i === 2 ? 1.06 : i === 0 ? 0.8 : 0.93));
    }
    const ex: V3 = [Math.cos(f.rot), 0, Math.sin(f.rot)];
    face(geo, [P(x1, 0), P(x1, 1), P(x1, 2), P(x1, 3)], ex, shade(colour, 0.85));
    face(geo, [P(x0, 0), P(x0, 1), P(x0, 2), P(x0, 3)], [-ex[0], -ex[1], -ex[2]], shade(colour, 0.85));
}

/** A quad wound to face `n`. */
function face(geo: Geo, p: V3[], n: V3, colour: RGB) {
    const ux = p[1][0] - p[0][0];
    const uy = p[1][1] - p[0][1];
    const uz = p[1][2] - p[0][2];
    const vx = p[2][0] - p[0][0];
    const vy = p[2][1] - p[0][1];
    const vz = p[2][2] - p[0][2];
    const dot = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
    if (dot < 0) geo.quad(p[3], p[2], p[1], p[0], colour);
    else geo.quad(p[0], p[1], p[2], p[3], colour);
}

/**
 * A park bench on a frame (its floor at the frame's y; local x along the seat, +z its front: a sitter faces +z),
 * `ends` its cast ends' colour, `wood` its slats', `length` its seat's length (m).
 */
export function parkBench(geo: Geo, f: Frame, ends: RGB, wood: RGB, length = 1.8) {
    const half = length / 2;
    const seat = 0.44;
    for (const x of [-half + 0.07, half - 0.07]) {
        // The front leg, the raked back leg rising into the back post, the seat bearer, the armrest on its support.
        strut(geo, f, [x, 0, 0.2], [x, seat, 0.19], 0.05, 0.05, ends);
        strut(geo, f, [x, 0, -0.26], [x, seat - 0.02, -0.17], 0.05, 0.05, ends);
        strut(geo, f, [x, seat - 0.02, -0.17], [x, 0.86, -0.3], 0.05, 0.05, ends);
        strut(geo, f, [x, seat - 0.04, 0.22], [x, seat - 0.04, -0.2], 0.05, 0.045, ends);
        strut(geo, f, [x, 0.66, -0.24], [x, 0.66, 0.27], 0.06, 0.04, shade(ends, 1.1));
        strut(geo, f, [x, seat - 0.02, 0.19], [x, 0.66, 0.25], 0.04, 0.04, ends);
    }
    // Five seat slats front to back (the middle ones a touch lower: the seat's sag), three back slats raked back.
    const slats = 5;
    for (let k = 0; k < slats; k++) {
        const z0 = 0.2 - k * 0.083;
        const sag = 0.008 * Math.sin((Math.PI * k) / (slats - 1));
        plank(geo, f, -half, half, [z0, seat - sag], [z0 - 0.07, seat - sag], 0.03, shade(wood, 0.94 + 0.03 * (k % 3)));
    }
    for (let k = 0; k < 3; k++) {
        const y0 = seat + 0.1 + k * 0.13;
        const z0 = -0.19 - (y0 - seat) * 0.3;
        plank(geo, f, -half + 0.02, half - 0.02, [z0, y0], [z0 - 0.09 * 0.3, y0 + 0.09], 0.025, shade(wood, 0.96 + 0.03 * k));
    }
}

/** The bench's triangles (for the budget's test). */
export function benchTriangles(): number {
    const g = new Geo();
    parkBench(g, {x: 0, y: 0, z: 0, rot: 0}, [0.1, 0.1, 0.1], [0.5, 0.4, 0.3]);
    return g.triangles;
}
