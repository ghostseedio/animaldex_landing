/**
 * The farms' machines and bales, made as they are (graphics pass 2, lane town2; the owner: "the tractor looks awful" and
 * "the hay bales look bad quality too"). The tractor was five boxes (a red block, a taller block, a roof slab and four
 * square "wheels"); the round bales were ten-sided tubes wound inward, so the solid material culled their near sides
 * and a viewer saw into them (each read as a hollow half-pipe).
 *
 * - `spinX`: a solid of revolution about a frame's local x (a tyre, a bale), from a profile of (x, radius) rings, wound
 *   outward and closed; colour per ring band and side (the straw's streaks, the ends' wound rings, the tyre's shoulder).
 * - `hull`: a convex eight-cornered block (a tapered bonnet, a cab roof), each face turned outward from its middle.
 * - The tractor: a red bonnet tapering to a grille with lamps, the engine block and front weights under it, a cab on
 *   four posts with glass all round and a roof, a seat and wheel inside, mudguards over big rear wheels with chevron
 *   treads, smaller treaded front wheels, an upright exhaust with its cap, steps, the rear linkage. ~3,900 triangles.
 * - Round bales: 16 sides with rounded shoulders, straw streaked along the side and wound in rings on the ends, or
 *   wrapped in dark green film with its creases. Small square bales: two twine bands, a lighter cut top.
 *
 * Everything is merged into the chunk's solid (and the cab's panes into its glass), as the farms' other things are.
 */

import {at, Geo, tone, type Frame, type V3} from "@/ark-scene/islands/town/render/kit";

type RGB = [number, number, number];

function shade(c: RGB, k: number): RGB {
    return [c[0] * k, c[1] * k, c[2] * k];
}

/** A cheap hash in 0..1 of two integers (for per-face colour variety that is the same every build). */
function grain(a: number, b: number, seed: number): number {
    let h = (Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ Math.imul(seed + 1, 83492791)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** A point of a solid spun about the frame's local x through (lx, ly, lz): along x, at angle `a`, radius `r`. */
function spun(f: Frame, lx: number, ly: number, lz: number, x: number, a: number, r: number): V3 {
    return at(f, lx + x, ly + Math.sin(a) * r, lz + Math.cos(a) * r);
}

/**
 * A solid of revolution about the frame's local x: rings `profile` [x, r] in order of x (a ring at r = 0 closes an end),
 * `sides` round. Faces wind outward. `colour(band, side)`: band k is between ring k and k + 1.
 */
export function spinX(geo: Geo, f: Frame, lx: number, ly: number, lz: number, profile: ReadonlyArray<readonly [number, number]>, sides: number, colour: (band: number, side: number) => RGB, turn = 0) {
    for (let k = 0; k + 1 < profile.length; k++) {
        const [x0, r0] = profile[k];
        const [x1, r1] = profile[k + 1];
        for (let i = 0; i < sides; i++) {
            const a0 = turn + (i / sides) * Math.PI * 2;
            const a1 = turn + ((i + 1) / sides) * Math.PI * 2;
            const c = colour(k, i);
            const A = spun(f, lx, ly, lz, x0, a0, r0);
            const B = spun(f, lx, ly, lz, x1, a0, r1);
            const C = spun(f, lx, ly, lz, x1, a1, r1);
            const D = spun(f, lx, ly, lz, x0, a1, r0);
            // (A ring at r = 0 makes its quad a triangle: draw only the face with area.)
            if (r1 > 1e-6) geo.tri(A, B, C, c);
            if (r0 > 1e-6) geo.tri(A, C, D, c);
        }
    }
}

/** A face (3 or 4 points) wound so its normal points away from `inside`. */
function face(geo: Geo, pts: V3[], inside: V3, colour: RGB) {
    const [a, b, c] = pts;
    const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
    const m = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length], [0, 0, 0]);
    const out = n[0] * (m[0] - inside[0]) + n[1] * (m[1] - inside[1]) + n[2] * (m[2] - inside[2]) >= 0;
    const p = out ? pts : [...pts].reverse();
    if (p.length === 3) geo.tri(p[0], p[1], p[2], colour);
    else geo.quad(p[0], p[1], p[2], p[3], colour);
}

/**
 * A convex block from its eight corners: `b` the four of its bottom and `t` the four of its top, in the same order round.
 * Faces turned outward; the top a little lighter, the sides shaded by which way they face.
 */
export function hull(geo: Geo, b: V3[], t: V3[], colour: RGB, top?: RGB) {
    const inside: V3 = [0, 0, 0];
    for (const p of [...b, ...t]) for (let k = 0; k < 3; k++) inside[k] += p[k] / 8;
    face(geo, t, inside, top ?? shade(colour, 1.06));
    face(geo, b, inside, shade(colour, 0.6));
    for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        face(geo, [b[i], b[j], t[j], t[i]], inside, shade(colour, [1, 0.88, 0.94, 0.9][i]));
    }
}

/** A box in the frame from its low corner to its high corner (local x, y, z), optionally narrowed at the top. */
function block(geo: Geo, f: Frame, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, colour: RGB, topInset: {x?: number; z0?: number; z1?: number; y1b?: number} = {}) {
    const ix = topInset.x ?? 0;
    const yb = topInset.y1b ?? y1;
    const b = [at(f, x0, y0, z0), at(f, x1, y0, z0), at(f, x1, y0, z1), at(f, x0, y0, z1)];
    const t = [at(f, x0 + ix, y1, z0 + (topInset.z0 ?? 0)), at(f, x1 - ix, y1, z0 + (topInset.z0 ?? 0)), at(f, x1 - ix, yb, z1 - (topInset.z1 ?? 0)), at(f, x0 + ix, yb, z1 - (topInset.z1 ?? 0))];
    hull(geo, b, t, colour);
}

// MARK: - The tractor

const RED = tone("#b3352a");
const DARK = tone("#2b2c2e");
const TYRE = tone("#1e1e1f");
const HUB = tone("#d9b531");
const STEEL = tone("#6d7174");
const SEAT = tone("#3a3a3a");
const LAMP = tone("#f2ecd2");
const PANE = tone("#5f7a88");

/** A treaded tyre on its hub, spun about the frame's x at (lx, ly, lz): radius `R`, width `w`, `lugs` chevrons a side. */
function wheel(geo: Geo, f: Frame, lx: number, ly: number, lz: number, R: number, w: number, lugs: number, side: 1 | -1) {
    const hubR = R * 0.55;
    const sh = Math.min(0.09, R * 0.12);
    const half = w / 2;
    // The tyre: its inner wall, the shoulder, the crown, the outer shoulder, the outer wall.
    const tyre: Array<[number, number]> = [[-half, hubR], [-half, R - sh], [-half + sh * 0.6, R - sh * 0.15], [-half + sh, R], [half - sh, R], [half - sh * 0.6, R - sh * 0.15], [half, R - sh], [half, hubR]];
    spinX(geo, f, lx, ly, lz, tyre, 24, (band) => shade(TYRE, band === 0 || band === 6 ? 1.15 : band === 3 ? 0.9 : 1));
    // The hub, set in from the outer wall, and its centre cap.
    const out = side * (half - 0.04);
    const hub: Array<[number, number]> = side > 0 ? [[out - 0.06, hubR], [out - 0.04, hubR * 0.4], [out + 0.02, hubR * 0.3], [out + 0.02, 0]] : [[out - 0.02, 0], [out - 0.02, hubR * 0.3], [out + 0.04, hubR * 0.4], [out + 0.06, hubR]];
    spinX(geo, f, lx, ly, lz, hub, 12, (band) => (band === 2 || (side < 0 && band === 0) ? shade(DARK, 1.1) : HUB));
    const back: Array<[number, number]> = side > 0 ? [[-half + 0.03, 0], [-half + 0.03, hubR]] : [[half - 0.03, hubR], [half - 0.03, 0]];
    spinX(geo, f, lx, ly, lz, back, 12, () => shade(HUB, 0.7));
    // The treads: chevrons, each arm from the crown's middle out to a shoulder, swept back by `sweep`.
    const h = R * 0.07;
    const arm = 0.2 * (Math.PI * 2) / lugs;
    const sweep = (0.55 * (Math.PI * 2)) / lugs;
    for (let k = 0; k < lugs; k++) {
        const a = (k / lugs) * Math.PI * 2;
        for (const dir of [-1, 1]) {
            // Alternate arms start either side of the middle, as a tractor's do.
            const x0 = dir * 0.02;
            const x1 = dir * (half - 0.01);
            const a0 = a + (dir > 0 ? 0 : sweep / 2);
            const a1 = a0 + sweep * (dir > 0 ? 1 : 1);
            const inside = spun(f, lx, ly, lz, (x0 + x1) / 2, (a0 + a1) / 2 + arm / 2, R - 0.05);
            const p = (x: number, ang: number, r: number) => spun(f, lx, ly, lz, x, ang, r);
            const bIn = [p(x0, a0, R - 0.01), p(x1, a1, R - 0.01), p(x1, a1 + arm, R - 0.01), p(x0, a0 + arm, R - 0.01)];
            const tOut = [p(x0, a0, R + h), p(x1, a1, R + h), p(x1, a1 + arm, R + h), p(x0, a0 + arm, R + h)];
            face(geo, tOut, inside, shade(TYRE, 1.12));
            for (let i = 0; i < 4; i++) {
                const j = (i + 1) % 4;
                face(geo, [bIn[i], bIn[j], tOut[j], tOut[i]], inside, shade(TYRE, 0.95));
            }
        }
    }
}

/** A mudguard: a curved strip over a wheel (both faces), from angle a0 to a1 (0 = forward, π/2 = up). */
function mudguard(geo: Geo, f: Frame, x0: number, x1: number, cy: number, cz: number, r: number, colour: RGB) {
    const n = 8;
    for (let i = 0; i < n; i++) {
        const a0 = 0.15 + (Math.PI * 0.85 * i) / n;
        const a1 = 0.15 + (Math.PI * 0.85 * (i + 1)) / n;
        const P = (x: number, a: number, rr: number) => at(f, x, cy + Math.sin(a) * rr, cz + Math.cos(a) * rr);
        const inside = at(f, (x0 + x1) / 2, cy, cz);
        face(geo, [P(x0, a0, r), P(x1, a0, r), P(x1, a1, r), P(x0, a1, r)], inside, shade(colour, 0.9 + 0.15 * Math.sin((a0 + a1) / 2)));
        const outer = at(f, (x0 + x1) / 2, cy + Math.sin((a0 + a1) / 2) * (r + 1), cz + Math.cos((a0 + a1) / 2) * (r + 1));
        face(geo, [P(x0, a0, r - 0.02), P(x1, a0, r - 0.02), P(x1, a1, r - 0.02), P(x0, a1, r - 0.02)], outer, shade(colour, 0.55));
    }
    // Its edges' rims.
    for (const x of [x0, x1]) for (let i = 0; i < n; i++) {
        const a0 = 0.15 + (Math.PI * 0.85 * i) / n;
        const a1 = 0.15 + (Math.PI * 0.85 * (i + 1)) / n;
        const P = (a: number, rr: number) => at(f, x, cy + Math.sin(a) * rr, cz + Math.cos(a) * rr);
        const away = at(f, x + (x > (x0 + x1) / 2 ? -1 : 1), cy, cz);
        face(geo, [P(a0, r - 0.02), P(a0, r), P(a1, r), P(a1, r - 0.02)], away, shade(colour, 0.8));
    }
}

/**
 * The farmstead's tractor, standing at `p` (ground height `y`), facing `rot` (its +z forward, the frame's convention).
 * Its panes go to `glass` (when given), the rest to `geo`.
 */
export function tractor(geo: Geo, glass: Geo | null, x: number, y: number, z: number, rot: number) {
    const f: Frame = {x, y, z, rot};
    // Wheels: big rear (1.6 m) under the cab, small front (0.9 m) under the bonnet's nose.
    for (const side of [-1, 1] as const) {
        wheel(geo, f, side * 0.86, 0.8, -0.55, 0.8, 0.46, 18, side);
        wheel(geo, f, side * 0.74, 0.46, 1.6, 0.46, 0.3, 14, side);
        mudguard(geo, f, side * 0.6, side * 1.14, 0.8, -0.55, 0.92, RED);
    }
    // The axles and the frame between them.
    block(geo, f, -0.65, 0.72, -0.62, 0.65, 0.88, -0.48, DARK);
    block(geo, f, -0.62, 0.4, 1.53, 0.62, 0.52, 1.67, DARK);
    block(geo, f, -0.34, 0.5, -1.0, 0.34, 1.02, 2.15, DARK);
    // The front weights, in a stack under the nose.
    for (let i = 0; i < 4; i++) block(geo, f, -0.42, 0.55 + i * 0.12, 2.15, 0.42, 0.65 + i * 0.12, 2.42, shade(DARK, 0.85 + (i % 2) * 0.1));
    // The bonnet: high at the cab, falling to the grille, narrower at its top; its side panels darker.
    block(geo, f, -0.46, 1.0, 0.15, 0.46, 1.68, 2.1, RED, {x: 0.08, y1b: 1.5});
    block(geo, f, -0.47, 1.0, 0.25, 0.47, 1.28, 1.95, shade(DARK, 1.2));
    // The grille, its slats, the lamps either side.
    block(geo, f, -0.36, 1.06, 2.1, 0.36, 1.44, 2.14, shade(DARK, 0.8));
    for (let i = 0; i < 5; i++) block(geo, f, -0.33, 1.1 + i * 0.07, 2.13, 0.33, 1.12 + i * 0.07, 2.16, shade(STEEL, 1.1));
    for (const side of [-1, 1]) block(geo, f, side * 0.42 - 0.07, 1.36, 2.02, side * 0.42 + 0.07, 1.46, 2.13, LAMP);
    // An air pre-cleaner and the exhaust, upright before the cab, its cap.
    geo.cylinder(f, -0.28, 1.6, 0.55, 0.07, 0.07, 0.45, DARK, 8);
    geo.cylinder(f, 0.3, 1.55, 0.3, 0.055, 0.055, 1.35, shade(DARK, 0.7), 8);
    geo.cylinder(f, 0.3, 2.9, 0.3, 0.075, 0.065, 0.08, shade(DARK, 0.8), 8);
    // The cab: a floor, four posts, a roof wider than its walls, the glass all round.
    block(geo, f, -0.62, 1.0, -1.25, 0.62, 1.12, 0.12, DARK);
    for (const [px, pz] of [[-0.6, -1.22], [0.6, -1.22], [-0.6, 0.08], [0.6, 0.08]] as const) block(geo, f, px - 0.04, 1.12, pz - 0.04, px + 0.04, 2.62, pz + 0.04, DARK);
    block(geo, f, -0.72, 2.62, -1.38, 0.72, 2.74, 0.24, shade(RED, 1.05));
    block(geo, f, -0.66, 2.74, -1.3, 0.66, 2.8, 0.16, shade(tone("#e8e4dc"), 0.95));
    // The rear window's frame and the lower body panels behind the doors.
    block(geo, f, -0.6, 1.12, -1.24, 0.6, 1.5, -1.18, RED);
    // A beacon on the roof.
    geo.cylinder(f, 0.45, 2.8, -0.2, 0.06, 0.05, 0.12, tone("#e89a2a"), 8);
    // The seat, the steering column and wheel.
    block(geo, f, -0.24, 1.12, -0.95, 0.24, 1.55, -0.55, SEAT);
    block(geo, f, -0.24, 1.55, -1.0, 0.24, 2.0, -0.88, SEAT);
    geo.cylinder(f, 0, 1.12, -0.05, 0.04, 0.04, 0.85, DARK, 6);
    geo.cylinder(f, 0, 1.97, -0.12, 0.22, 0.22, 0.04, shade(DARK, 1.2), 12);
    // Steps up to the cab on the left.
    for (let i = 0; i < 2; i++) block(geo, f, -0.78, 0.45 + i * 0.32, -0.15, -0.6, 0.49 + i * 0.32, 0.12, STEEL);
    // The rear linkage: two lower arms and the top link.
    for (const side of [-1, 1]) block(geo, f, side * 0.3 - 0.04, 0.55, -1.75, side * 0.3 + 0.04, 0.63, -1.0, STEEL);
    block(geo, f, -0.04, 0.95, -1.6, 0.04, 1.02, -1.05, STEEL);
    // The panes: both faces, so the cab reads as glass from inside and out.
    const pane = (a: V3, b: V3, c: V3, d: V3) => {
        const g = glass ?? geo;
        g.quad(a, b, c, d, PANE);
        g.quad(d, c, b, a, PANE);
    };
    const P = (lx: number, ly: number, lz: number) => at(f, lx, ly, lz);
    pane(P(-0.56, 1.5, 0.08), P(0.56, 1.5, 0.08), P(0.56, 2.58, 0.08), P(-0.56, 2.58, 0.08));
    pane(P(0.56, 1.5, -1.22), P(-0.56, 1.5, -1.22), P(-0.56, 2.58, -1.22), P(0.56, 2.58, -1.22));
    for (const side of [-1, 1]) pane(P(side * 0.6, 1.2, -1.18), P(side * 0.6, 1.2, 0.04), P(side * 0.6, 2.58, 0.04), P(side * 0.6, 2.58, -1.18));
}

// MARK: - Bales

const STRAW = tone("#d2b464");
const WRAP = tone("#2e3d2c");

/**
 * A round bale lying on its side, its axis along the frame's local x at (lx, ly, lz): `r` across, `len` long, the
 * shoulders rounded. Straw streaked along its side and wound in rings on its ends; or wrapped in dark film.
 */
export function roundBale(geo: Geo, f: Frame, lx: number, ly: number, lz: number, r: number, len: number, wrapped: boolean, seed: number) {
    const h = len / 2;
    const s = r * 0.14;
    const profile: Array<[number, number]> = [[-h, 0], [-h, r * 0.3], [-h, r * 0.55], [-h, r * 0.78], [-h + s * 0.25, r - s * 0.6], [-h + s, r], [h - s, r], [h - s * 0.25, r - s * 0.6], [h, r * 0.78], [h, r * 0.55], [h, r * 0.3], [h, 0]];
    const turn = grain(seed, 7, 3) * Math.PI;
    if (wrapped) {
        spinX(geo, f, lx, ly, lz, profile, 16, (band, side) => {
            // The film's sheen on the shoulders; its overlapping turns as faint bands along the side.
            const k = band === 4 || band === 6 ? 1.25 : band === 5 ? 0.95 + 0.12 * grain(side, band, seed) : 0.9 + 0.08 * grain(side, band, seed);
            return shade(WRAP, k);
        }, turn);
        return;
    }
    spinX(geo, f, lx, ly, lz, profile, 16, (band, side) => {
        if (band === 5) return shade(STRAW, 0.82 + 0.3 * grain(side, band, seed));
        if (band === 4 || band === 6) return shade(STRAW, 0.92 + 0.1 * grain(side, band, seed));
        // The ends: rings of wound straw, alternately lighter and darker, the core darkest.
        const ring = band < 5 ? band : 10 - band;
        return shade(STRAW, [0.72, 1.0, 0.86, 1.06][Math.min(ring, 3)] * (0.95 + 0.08 * grain(side, band, seed)));
    }, turn);
}

/**
 * A small square bale (w × h × d in the frame at (lx, ly0, lz), its length along the frame's z): two twine bands round
 * it across its length, a little proud of its faces; its cut top lighter.
 */
export function squareBale(geo: Geo, f: Frame, lx: number, ly0: number, lz: number, w: number, h: number, d: number, seed: number) {
    const k = 0.9 + 0.15 * grain(seed, 1, 5);
    geo.box(f, lx, ly0, lz, w, h, d, shade(STRAW, k), 0, {top: shade(STRAW, k * 1.1)});
    const twine = tone("#7a5a30");
    for (const u of [-0.25, 0.25]) geo.box(f, lx, ly0 - 0.005, lz + u * d, w + 0.014, h + 0.012, 0.035, twine);
}
