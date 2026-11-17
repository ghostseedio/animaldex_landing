/**
 * The giant waterfall on the wild island (p4 WATERFALL; the owner, 2026-11-17: "can you add a giant waterfall in the
 * wild island somewhere, you can add more land to it if needed"). Its shape, as pure numbers; `render/falls.ts` draws it.
 *
 * Where, and why there: the south face of the spine between the west and the high summits, straight above the upper
 * river's spring (`fields.ts` RIVER_UPPER[0], −100, −76). The ground there already rises 30 m in 12 m (27 m at z −86 to
 * 57 m at z −98), the steepest face on the island that faces the opening camera, and the crest behind it stands higher
 * than the lip on both sides, so the water has a notch to come out of. The falls drop from that notch into a plunge
 * pool on the flat at the cliff's foot, and the pool spills down to the spring: the river now begins at the falls.
 * Second pass (the coordinator: "GIANT; from the default view it's a small streak"): a sheet 21–24 m across (three times
 * the first) from the snow line (52.4 m, the highest lip the crest holds across that width) down a wide horseshoe face,
 * its ends breaking on the lower ledges; a pool 21 m across; a plume that climbs over the trees.
 *
 * Nothing here changes the island's ground (`ground.ts`), its scenery list (`scenery.ts`) or anything the map, the
 * server's positions atlas or the walk grid read: the cliff is drawn OVER the existing slope (a skin from the slope out to
 * a vertical face, never below the ground), the pool's water over ground that is already there, so every zone, tag cell,
 * spot and home is where it was. The face stands where no animal of today's record lives (its nearest homes are a
 * dipper's, a kingfisher's and the mayflies' at the spring, all fliers; checked on the 2026-11-16 snapshot).
 * The cliff's mass is solid to walkers (`fallsColliders`, in `collide/colliders.ts`) and the pool is drawn water
 * walkers drink at, never walk in (a "pond" collider, as the hamlet's garden pond was).
 *
 * x east, z south, y up, metres, the island's own frame. Pure.
 */

import {fbm, smoothstep} from "@/ark-scene/world";
import {wildHeight as exactHeight} from "@/ark-scene/islands/wild/ground";
import {WILD_HALF, WILD_SEGMENT} from "@/ark-scene/islands/wild/frame";

/** The falls' axis (x), and the cliff's width either side of it (m): the rock face, its sides sinking into the slope. */
export const FALLS_X = -101;
const HALF_WIDTH = 27;
/** The vertical face's line at the axis (z): the foot of the steep slope, so the drop is the slope's whole height. */
const FACE_Z = -85.3;
/** How far the face leans back as it rises (m a metre). */
const LEAN = 0.1;
/** The lip: where the water leaves the notch (m above the sea). */
export const FALLS_LIP = 52.4;
/** The water's width at the lip and where it meets the pool (m): it spreads as it falls. */
export const CURTAIN_TOP = 21;
export const CURTAIN_BOTTOM = 24;
/** How far the water is thrown clear of the lip (m/s across), and gravity. */
const THROW = 2.5;
const G = 9.81;

/** The plunge pool at the cliff's foot: an ellipse on the flat, its water a hand above the ground's highest there. */
export const POOL = {x: -99.6, z: -81.3, rx: 10.5, rz: 4.0, level: 24.9};
/** Where the pool spills (its south-east rim) and the spring it feeds (the upper river's first point). */
export const OUTFLOW: ReadonlyArray<{x: number; z: number}> = [
    {x: -100.2, z: -77.4},
    {x: -100.1, z: -76.7},
    {x: -100, z: -76}
];

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

/**
 * The ground as it is DRAWN round the falls: the island's own vertices (every 1.1 m, `render/ground.ts`) sampled once
 * and read back bilinearly, so the cliff's skin meets the drawn slope (not the finer field between its vertices) and the
 * whole falls is laid out in a few milliseconds. Outside its box, the field itself.
 */
const BOX = {x0: -128, x1: -74, z0: -120, z1: -70};
let drawn: {i0: number; j0: number; ni: number; nj: number; h: Float32Array} | null = null;
export function fallsGround(x: number, z: number): number {
    if (!drawn) {
        const i0 = Math.floor((BOX.x0 + WILD_HALF) / WILD_SEGMENT);
        const j0 = Math.floor((BOX.z0 + WILD_HALF) / WILD_SEGMENT);
        const ni = Math.ceil((BOX.x1 - BOX.x0) / WILD_SEGMENT) + 2;
        const nj = Math.ceil((BOX.z1 - BOX.z0) / WILD_SEGMENT) + 2;
        const h = new Float32Array(ni * nj);
        for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) h[j * ni + i] = exactHeight((i0 + i) * WILD_SEGMENT - WILD_HALF, (j0 + j) * WILD_SEGMENT - WILD_HALF);
        drawn = {i0, j0, ni, nj, h};
    }
    const fi = (x + WILD_HALF) / WILD_SEGMENT - drawn.i0;
    const fj = (z + WILD_HALF) / WILD_SEGMENT - drawn.j0;
    if (fi < 0 || fj < 0 || fi >= drawn.ni - 1 || fj >= drawn.nj - 1) return exactHeight(x, z);
    const i = Math.floor(fi);
    const j = Math.floor(fj);
    const tx = fi - i;
    const tz = fj - j;
    const h = drawn.h;
    const a = h[j * drawn.ni + i];
    const b = h[j * drawn.ni + i + 1];
    const d = h[(j + 1) * drawn.ni + i];
    const e = h[(j + 1) * drawn.ni + i + 1];
    return a + (b - a) * tx + (d - a) * tz + (a - b - d + e) * tx * tz;
}
const wildHeight = fallsGround;
const bell = (t: number) => Math.exp(-t * t);
function hash1(n: number): number {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
}

/** How much of the face stands out at `u` metres across from the axis (1 in the middle, 0 where it sinks into the slope). */
export function faceTaper(u: number): number {
    return smoothstep(HALF_WIDTH, HALF_WIDTH - 12, Math.abs(u));
}

/** The vertical face's line at `u` (z): a shallow horseshoe, the sides further back, an alcove behind the water. */
export function faceLine(u: number): number {
    const x = FALLS_X + u;
    // (A plunge pool's amphitheatre: the face wraps round the pool and runs back into the slope either side, with bays
    // and buttresses of its own.)
    // (A wide horseshoe behind the broad sheet, curving back harder past its ends.)
    const past = Math.max(Math.abs(u) - CURTAIN_TOP * 0.5, 0);
    return FACE_Z - 0.01 * u * u - Math.min(0.05 * past * past, 7) - 1.2 * bell(u / (CURTAIN_TOP * 0.55 + 1.2)) + 2.4 * (fbm(x * 0.11 + 3.7, 2.1) - 0.5) * smoothstep(CURTAIN_TOP * 0.5, CURTAIN_TOP * 0.5 + 4, Math.abs(u));
}

/** The face's top at `u` (m): the notch at the axis, buttresses either side rising to just under the crest behind them. */
export function shoulderAt(u: number): number {
    const x = FALLS_X + u;
    return FALLS_LIP + 0.25 + 4.6 * smoothstep(CURTAIN_TOP * 0.5 + 0.2, CURTAIN_TOP * 0.5 + 3.4, Math.abs(u)) * (u < 0 ? 1.1 : 0.62) + 2.6 * (fbm(x * 0.17, 7.3) - 0.5) * smoothstep(CURTAIN_TOP * 0.5, CURTAIN_TOP * 0.5 + 2, Math.abs(u));
}

/** Where the slope reaches height `y` in the column at x, searching north from the flat (z), or null above its crest. */
export function slopeZ(x: number, y: number): number | null {
    let z = -78;
    if (wildHeight(x, z) >= y) return z;
    for (; z > -116; z -= 0.5) {
        if (wildHeight(x, z - 0.5) >= y) {
            let a = z;
            let b = z - 0.5;
            for (let k = 0; k < 10; k++) {
                const m = (a + b) / 2;
                if (wildHeight(x, m) >= y) b = m;
                else a = m;
            }
            return (a + b) / 2;
        }
    }
    return null;
}

/** The column's highest ground on the face (m), between the flat and the crest. */
function crestOf(x: number): number {
    let top = -Infinity;
    for (let z = -78; z > -116; z -= 0.5) top = Math.max(top, wildHeight(x, z));
    return top;
}

/** The rock's relief at a point of the face (m, out from the skin): layered beds, rounded, split by joints, lumpy. */
export function relief(x: number, y: number, z = 0, up = 0): {d: number; bed: number; open: number} {
    // (The beds dip gently east and undulate; their thickness changes as they go.)
    const s = y + 0.09 * x + 1.4 * Math.sin(x * 0.11 + 0.6) + 3.4 * (fbm(x * 0.05 + 5, y * 0.03 + 1) - 0.5);
    const T = 2.1 + 0.9 * fbm(x * 0.03 + 2, y * 0.05);
    const layer = Math.floor(s / T);
    const f = s / T - layer;
    const h = hash1(layer);
    // A bed: rounded out in its middle, in at its partings (the ledges and their shadows).
    const round = Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2));
    // Joints: vertical partings every 3–6 m, staggered from bed to bed.
    const span = 3.2 + 2.6 * h;
    const g = (x + 7.3 * h) / span - Math.floor((x + 7.3 * h) / span);
    const joint = smoothstep(0, 0.14, g) * smoothstep(1, 0.86, g);
    const open = round * (0.35 + 0.65 * joint);
    // Lumps in three dimensions (a cap's top is not smeared along its depth), and big buttresses and bays on the face.
    const lumps = 1.4 * (fbm(x * 0.21 + z * 0.17 + 11, y * 0.21 - z * 0.13 - 4) - 0.5) + 0.5 * (fbm(x * 0.9 + z * 0.7, y * 0.9 - z * 0.5 + 9) - 0.5);
    // Buttresses and gullies down the face: ridged noise, sharp-crested, stretched along the fall line, and the joints'
    // deeper clefts every few metres.
    const ridge = 1 - Math.abs(2 * fbm(x * 0.16 + z * 0.12 + 21, y * 0.045) - 1);
    const cleft = Math.pow(Math.abs(Math.sin(x * 0.55 + z * 0.4 + 3 * fbm(x * 0.05, y * 0.04 + 3))), 6);
    const buttress = (2.6 * (ridge - 0.55) - 0.9 * cleft) * (1 - up);
    // Over the tops: a broken, bouldery skyline rather than a table.
    const blocks = up * 1.6 * Math.max(fbm(x * 0.32 + z * 0.29 + 4, z * 0.31 - x * 0.12) - 0.42, 0);
    return {d: (0.15 + 0.35 * h) * open * (1 - 0.6 * up) + lumps + buttress + blocks - 0.1, bed: h, open};
}

export type CliffSkin = {
    cols: number;
    rows: number;
    /** xyz per vertex, column-major by row: index = row * cols + col. */
    positions: Float32Array;
    /** Each vertex's height on the face (0 foot … 1 top) and its relief's bed and openness, for the colours. */
    beds: Float32Array;
    opens: Float32Array;
    /** Metres across from the axis. */
    across: Float32Array;
};

/**
 * The cliff's skin: a grid over the face, each column a profile from its foot on the flat, up the vertical face (where
 * the face stands in front of the slope), over its rounded top and back onto the slope behind; resampled by length, then
 * pushed out along its normal by the rock's relief. Its edges and its foot sink a little into the ground, so it grows out
 * of the island rather than sitting on it. Never below the ground: the skin is the slope's own surface or in front of it.
 */
export function cliffSkin(step = 0.5, rowStep = 0.45): CliffSkin {
    const cols = Math.round((HALF_WIDTH * 2) / step) + 1;
    const profiles: Array<Array<[number, number]>> = [];
    let rows = 0;
    for (let c = 0; c < cols; c++) {
        const u = -HALF_WIDTH + c * step;
        const x = FALLS_X + u;
        const taper = faceTaper(u);
        const line = faceLine(u);
        // The column's ground every 0.25 m north from the flat, and its running highest (the slope met going up).
        const STEP = 0.25;
        const heights: number[] = [];
        for (let z = -78; z > -116; z -= STEP) heights.push(Math.max(wildHeight(x, z), heights.length ? heights[heights.length - 1] : -Infinity));
        const crest = heights[heights.length - 1] - 0.3;
        // (Its brow a little under the slope's crest behind it, so its top always rounds back onto the slope.)
        const shoulder = Math.min(shoulderAt(u), crest - 2.5);
        const foot = wildHeight(x, line + 1.6) - 0.5;
        const raw: Array<[number, number]> = [];
        let at = 0;
        for (let y = foot; y <= crest; y += 0.2) {
            while (at < heights.length - 1 && heights[at + 1] < y) at++;
            const h0 = heights[at];
            const h1 = heights[Math.min(at + 1, heights.length - 1)];
            const s = h0 >= y ? -78 - at * STEP : -78 - (at + clamp01((y - h0) / Math.max(h1 - h0, 1e-6))) * STEP;
            // The face's plane recedes over its top (a rounded shoulder back to the slope).
            // (It leans back as it rises, a tenth of a metre a metre, so its top is a narrow brow, not a table.)
            const plane = line - LEAN * Math.max(y - POOL.level, 0) - Math.max(y - shoulder, 0) * 5.5 - Math.max(y - shoulder + 0.8, 0) ** 2 * 0.6;
            raw.push([s + taper * Math.max(plane - s, 0), y]);
        }
        // (A column whose foot is over its crest: a point, sunk.)
        while (raw.length < 2) raw.push([-78, foot - 1 + raw.length * 0.1]);
        // Resampled by length along the profile.
        const length: number[] = [0];
        for (let i = 1; i < raw.length; i++) length.push(length[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
        const total = length[length.length - 1] || 1;
        const n = Math.max(2, Math.round(total / rowStep) + 1);
        const out: Array<[number, number]> = [];
        let j = 0;
        for (let k = 0; k < n; k++) {
            const at = (k / (n - 1)) * total;
            while (j < length.length - 2 && length[j + 1] < at) j++;
            const t = clamp01((at - length[j]) / Math.max(length[j + 1] - length[j], 1e-6));
            out.push([raw[j][0] + (raw[j + 1][0] - raw[j][0]) * t, raw[j][1] + (raw[j + 1][1] - raw[j][1]) * t]);
        }
        profiles.push(out);
        rows = Math.max(rows, n);
    }
    // Every column to the same number of rows (by length again), so the grid is regular.
    const positions = new Float32Array(cols * rows * 3);
    const beds = new Float32Array(cols * rows);
    const opens = new Float32Array(cols * rows);
    const across = new Float32Array(cols * rows);
    for (let c = 0; c < cols; c++) {
        const u = -HALF_WIDTH + c * step;
        const x = FALLS_X + u;
        const p = profiles[c];
        const taper = faceTaper(u);
        for (let r = 0; r < rows; r++) {
            const f = (r / (rows - 1)) * (p.length - 1);
            const i = Math.min(Math.floor(f), p.length - 2);
            const t = f - i;
            const z = p[i][0] + (p[i + 1][0] - p[i][0]) * t;
            const y = p[i][1] + (p[i + 1][1] - p[i][1]) * t;
            // The profile's outward normal (in the z–y plane).
            const a = p[Math.max(i - 1, 0)];
            const b = p[Math.min(i + 2, p.length - 1)];
            const tz = b[0] - a[0];
            const ty = b[1] - a[1];
            const tl = Math.hypot(tz, ty) || 1;
            const nz = ty / tl;
            const ny = -tz / tl;
            const rel = relief(x, y, z, Math.max(ny, 0));
            // Out by the relief where the face stands; sinking into the ground at its foot, its top and its sides.
            const edge = Math.min(r / 3, (rows - 1 - r) / 3, c / 3, (cols - 1 - c) / 3, 1);
            // (Behind the water the rock is worn smooth and set back, so the sheet never touches it.)
            const fallen = clamp01((FALLS_LIP - y) / (FALLS_LIP - POOL.level));
            const halfSheet = (CURTAIN_TOP + (CURTAIN_BOTTOM - CURTAIN_TOP) * Math.sqrt(0.08 + 0.92 * Math.sqrt(fallen))) / 2;
            const band = smoothstep(halfSheet + 1.8, halfSheet + 0.5, Math.abs(u)) * smoothstep(POOL.level + 3, POOL.level + 6, y);
            const out = rel.d * (0.35 + 0.65 * taper) + 0.25;
            const d = (out * (1 - band) + band * (Math.min(out, 0.3) * 0.4 - 0.2)) * edge - 0.45 * (1 - edge) - 0.35 * (1 - smoothstep(0, 0.35, taper));
            const k = (r * cols + c) * 3;
            positions[k] = x;
            positions[k + 1] = y + ny * d;
            positions[k + 2] = z + nz * d;
            beds[r * cols + c] = rel.bed;
            opens[r * cols + c] = rel.open;
            across[r * cols + c] = u;
        }
    }
    return {cols, rows, positions, beds, opens, across};
}

/** The face's front at `u` and height `y` (z), the relief left out: where the water must stay in front of. */
export function faceFront(u: number, y: number): number {
    const x = FALLS_X + u;
    const s = slopeZ(x, y);
    const line = faceLine(u);
    const plane = line - LEAN * Math.max(y - POOL.level, 0);
    if (s === null) return plane;
    return s + faceTaper(u) * Math.max(plane - s, 0);
}

/** The water's path at `v` (0 the lip … 1 the pool) and `u01` across it (0 west … 1 east): a sheet thrown clear, spreading. */
export function curtainPoint(u01: number, v: number): {x: number; y: number; z: number} {
    const drop = FALLS_LIP - POOL.level;
    const fall = Math.sqrt((2 * drop) / G);
    const width = CURTAIN_TOP + (CURTAIN_BOTTOM - CURTAIN_TOP) * Math.sqrt(v);
    const across = (u01 - 0.5) * width;
    // The first tenth: over the lip's edge, from a metre and a half back in the notch; the lip follows the horseshoe.
    const lipZ = faceLine((u01 - 0.5) * CURTAIN_TOP) - LEAN * (FALLS_LIP - POOL.level) + 0.15;
    // A gentle concave sheet (its middle thrown a little further).
    const belly = 0.5 * (1 - (2 * u01 - 1) ** 2);
    if (v < 0.08) {
        const t = v / 0.08;
        return {x: FALLS_X + across, y: FALLS_LIP + 0.32 * (1 - t * t), z: lipZ - 1.6 * (1 - t) + belly * t * 0.2};
    }
    const t = ((v - 0.08) / 0.92) * fall;
    return {x: FALLS_X + across, y: FALLS_LIP - 0.5 * G * t * t, z: lipZ + (THROW + belly * 0.5) * t + belly * 0.2};
}

/**
 * Where the sheet's column at `u01` ends (its `v`, 0 … 1): in the pool for the middle, and on the slope where the ground at
 * its foot stands over the pool (the broad sheet's ends break on the lower ledges, west most).
 */
export function curtainFoot(u01: number): number {
    let last = 1;
    for (let k = 40; k >= 8; k--) {
        const v = k / 40;
        const p = curtainPoint(u01, v);
        if (p.y < wildHeight(p.x, p.z) + 0.15) last = v;
        else break;
    }
    if (last >= 1) return 1;
    // (Refined between the last clear step and the first under the ground.)
    let a = last - 1 / 40;
    let b = last;
    for (let k = 0; k < 12; k++) {
        const m = (a + b) / 2;
        const p = curtainPoint(u01, m);
        if (p.y < wildHeight(p.x, p.z) + 0.15) b = m;
        else a = m;
    }
    return b;
}

/** Where the water strikes the pool (its middle) and how far along the curtain's foot (m). */
export function impact(): {x: number; z: number; y: number} {
    const p = curtainPoint(0.5, 1);
    return {x: p.x, z: p.z, y: POOL.level};
}

/**
 * Does something at (x, y, z) of reach r stand behind or through the sheet (between the face and the water's front, the
 * pool to the lip)? The scenery drawn there (a rock, a crag) would poke through the water: it is left undrawn
 * (`asset-rocks.ts`, `props/areas.ts`; the lists, attach points and colliders keep it).
 */
export function behindSheet(x: number, y: number, z: number, r: number): boolean {
    const u = x - FALLS_X;
    if (Math.abs(u) > CURTAIN_BOTTOM * 0.5 + r || y < POOL.level - 1 - r || y > FALLS_LIP + 1 + r) return false;
    const t = Math.sqrt((2 * Math.max(FALLS_LIP - y, 0)) / G);
    const lipZ = faceLine(Math.max(Math.min(u, CURTAIN_TOP * 0.5), -CURTAIN_TOP * 0.5)) - LEAN * (FALLS_LIP - POOL.level) + 0.15;
    return z < lipZ + THROW * t + r + 0.6 && z > faceLine(u) - 16;
}

/** Is a point inside the pool's water (its ellipse)? */
export function inPool(x: number, z: number, margin = 0): boolean {
    return Math.hypot((x - POOL.x) / (POOL.rx + margin), (z - POOL.z) / (POOL.rz + margin)) < 1;
}

/** The pool's rim: points round its ellipse where its water would stand over lower ground, with the stone's size to hold it. */
export function rimStones(): Array<{x: number; z: number; y: number; r: number; yaw: number; squash: number}> {
    const out: Array<{x: number; z: number; y: number; r: number; yaw: number; squash: number}> = [];
    // Two rings: big boulders holding the water, and smaller ones awash just inside them.
    for (const [ring, n, reach, size] of [[0, 30, 0.45, 1], [1, 22, -0.25, 0.55]] as const) {
        for (let k = 0; k < n; k++) {
            const seed = k + ring * 100;
            const a = (k / n) * Math.PI * 2 + 0.11 + ring * 0.07;
            const jitter = 0.3 * (hash1(seed + 40) - 0.5);
            const x = POOL.x + Math.cos(a) * (POOL.rx + reach + jitter);
            const z = POOL.z + Math.sin(a) * (POOL.rz + reach + jitter);
            // The cliff's apron holds the north side.
            if (z < POOL.z - POOL.rz * 0.55) continue;
            // The spill's gap.
            if (Math.hypot(x - OUTFLOW[0].x, z - OUTFLOW[0].z) < 0.8) continue;
            const ground = wildHeight(x, z);
            const low = Math.max(POOL.level - ground, 0);
            const r = size * (0.45 + 0.4 * hash1(seed + 7)) + (ring === 0 ? low * 0.9 : 0);
            const squash = 0.6 + 0.25 * hash1(seed + 9);
            // (Where the ground is under the water, the outer stones stand a hand over it: they hold it, its edge never shows.)
            const y = ring === 0 && low > 0 ? POOL.level + 0.25 - r * squash : Math.min(ground, POOL.level) - r * 0.3;
            out.push({x, z, y, r, yaw: hash1(seed + 3) * 6.28, squash});
        }
    }
    // Wet boulders fallen at the curtain's foot, either side of where it strikes.
    for (let k = 0; k < 7; k++) {
        const side = k % 2 === 0 ? -1 : 1;
        const x = FALLS_X + side * (CURTAIN_BOTTOM * 0.5 + 0.4 + 1.6 * hash1(k + 300));
        const z = POOL.z - POOL.rz * (0.2 + 0.7 * hash1(k + 310));
        const r = 0.6 + 0.7 * hash1(k + 320);
        out.push({x, z, y: Math.min(wildHeight(x, z), POOL.level) - r * 0.25, r, yaw: hash1(k + 330) * 6.28, squash: 0.65 + 0.2 * hash1(k + 340)});
    }
    return out;
}

/** The spill from the pool to the spring: points down the ground, a hand over it, and its width. */
export function outflowPath(): Array<{x: number; y: number; z: number; width: number}> {
    const out: Array<{x: number; y: number; z: number; width: number}> = [];
    for (let i = 0; i < OUTFLOW.length - 1; i++) {
        const a = OUTFLOW[i];
        const b = OUTFLOW[i + 1];
        const steps = 6;
        for (let k = 0; k < steps; k++) {
            const t = k / steps;
            const x = a.x + (b.x - a.x) * t;
            const z = a.z + (b.z - a.z) * t;
            out.push({x, z, y: Math.min(POOL.level, wildHeight(x, z) + 0.07), width: 0.9 + 0.15 * i});
        }
    }
    const last = OUTFLOW[OUTFLOW.length - 1];
    out.push({x: last.x, z: last.z, y: wildHeight(last.x, last.z) + 0.07, width: 1.5});
    // Its first point at the pool's own level (the water leaves the pool flat, then falls).
    out[0].y = POOL.level;
    return out;
}

/** Where the falls are heard from (`liveliness-scene.ts` waterNear): the foot of the curtain. */
export function fallsSoundAt(): {x: number; z: number} {
    const p = impact();
    return {x: p.x, z: p.z};
}

/**
 * The cliff's mass as boxes for the colliders (`collide/colliders.ts`): 2 m slices across the face, each from its front
 * (the face, the relief's reach out included) back to the slope at the lip's height, standing from the ground at its
 * front to the shoulder. A walker on the flat goes round it; one on the crest behind is clear of it (behind its back).
 */
export function fallsBlocks(): Array<{x0: number; x1: number; z0: number; z1: number; y0: number; y1: number}> {
    const out: Array<{x0: number; x1: number; z0: number; z1: number; y0: number; y1: number}> = [];
    for (let u = -HALF_WIDTH + 4; u < HALF_WIDTH - 4; u += 2) {
        const mid = u + 1;
        if (faceTaper(mid) < 0.25) continue;
        const x = FALLS_X + mid;
        const front = Math.max(faceFront(u, wildHeight(x, faceLine(u) + 0.5) + 1), faceFront(u + 2, wildHeight(x, faceLine(u + 2) + 0.5) + 1)) + 0.5;
        const back = slopeZ(x, Math.min(shoulderAt(mid), crestOf(x)) - 0.5) ?? front - 6;
        if (front - back < 0.8) continue;
        out.push({x0: FALLS_X + u, x1: FALLS_X + u + 2, z0: back, z1: front, y0: wildHeight(x, front) - 0.3, y1: shoulderAt(mid)});
    }
    return out;
}
