/**
 * ARK-CONTACT round 4 (the sleeping cat 4 to 14 cm over the lawn): a rigged pose seated by its own lowest points.
 *
 * A sleeper or a lying body is put down by its rest model's torso box (`lieOnGround`); the clip then poses the legs,
 * tail and head as it was made, which is not always where that box said: the town's cat asleep had every leg tip
 * 4 to 14 cm over the ground. Here the clip's frame is skinned on the CPU (once per frame row, kept), its lowest
 * vertices taken, and the drop that puts the lowest of them on the ground worked out where it is drawn.
 */

/** What of a rig this needs: its rest mesh (positions, four bones and weights a vertex) and its bone rows (half floats). */
export type SkinnedRig = {
    geometry: {getAttribute(name: string): {count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number; getComponent(i: number, k: number): number}};
    data: Uint16Array;
    bones: number;
};

const cache = new WeakMap<object, Map<number, Float32Array>>();

/** A half float to a number. */
function half(h: number): number {
    const s = h & 0x8000 ? -1 : 1;
    const e = (h >> 10) & 0x1f;
    const f = h & 0x3ff;
    if (e === 0) return s * 2 ** -14 * (f / 1024);
    if (e === 31) return f ? NaN : s * Infinity;
    return s * 2 ** (e - 15) * (1 + f / 1024);
}

/**
 * The `count` lowest vertices (model space, by y) of the rig posed at bone row `row`, a few apart: the points a pose
 * rests on. Kept per rig and row.
 */
export function lowestPoints(rig: SkinnedRig, row: number, count = 24): Float32Array {
    let rows = cache.get(rig);
    if (!rows) cache.set(rig, (rows = new Map()));
    const known = rows.get(row);
    if (known) return known;
    const {xyz, n} = skinRow(rig, row);
    const out = spreadLowest(xyz, n, [0, -1, 0], count);
    rows.set(row, out);
    return out;
}

/** The rig's rest mesh skinned at bone row `row` (model space): every vertex's x, y, z. */
function skinRow(rig: SkinnedRig, row: number): {xyz: Float32Array; n: number} {
    const position = rig.geometry.getAttribute("position");
    const joints = rig.geometry.getAttribute("arkJoints");
    const weights = rig.geometry.getAttribute("arkWeights");
    const d = rig.data;
    const n = position.count;
    const xyz = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
        const x = position.getX(v);
        const y = position.getY(v);
        const z = position.getZ(v);
        let sx = 0;
        let sy = 0;
        let sz = 0;
        for (let k = 0; k < 4; k++) {
            const w = weights.getComponent(v, k);
            if (w <= 0) continue;
            const o = row * rig.bones * 12 + joints.getComponent(v, k) * 12;
            sx += w * (half(d[o]) * x + half(d[o + 1]) * y + half(d[o + 2]) * z + half(d[o + 3]));
            sy += w * (half(d[o + 4]) * x + half(d[o + 5]) * y + half(d[o + 6]) * z + half(d[o + 7]));
            sz += w * (half(d[o + 8]) * x + half(d[o + 9]) * y + half(d[o + 10]) * z + half(d[o + 11]));
        }
        xyz[v * 3] = sx;
        xyz[v * 3 + 1] = sy;
        xyz[v * 3 + 2] = sz;
    }
    return {xyz, n};
}

/** The `count` vertices furthest along `down` (a unit vector, model space), a few apart (a fraction of the body's depth along it). */
function spreadLowest(xyz: Float32Array, n: number, down: readonly number[], count: number): Float32Array {
    const hs = new Float32Array(n);
    let top = -Infinity;
    let bottom = Infinity;
    for (let v = 0; v < n; v++) {
        const h = -(xyz[v * 3] * down[0] + xyz[v * 3 + 1] * down[1] + xyz[v * 3 + 2] * down[2]);
        hs[v] = h;
        top = Math.max(top, h);
        bottom = Math.min(bottom, h);
    }
    const order = Array.from({length: n}, (_, i) => i).sort((a, b) => hs[a] - hs[b]);
    // A few apart (a fraction of the body's height), so one paw's vertices do not fill the list.
    const spread = (top - bottom) * 0.04;
    const picked: number[] = [];
    for (const v of order) {
        if (picked.length >= count) break;
        if (picked.every((q) => Math.hypot(xyz[q * 3] - xyz[v * 3], xyz[q * 3 + 1] - xyz[v * 3 + 1], xyz[q * 3 + 2] - xyz[v * 3 + 2]) > spread)) picked.push(v);
    }
    const out = new Float32Array(picked.length * 3);
    picked.forEach((v, i) => {
        out[i * 3] = xyz[v * 3];
        out[i * 3 + 1] = xyz[v * 3 + 1];
        out[i * 3 + 2] = xyz[v * 3 + 2];
    });
    return out;
}

/** Directions a turned-over body may rest on (unit vectors, model space): the six axes and a spiral of 58 more. */
const TURNED_DIRS: readonly (readonly number[])[] = (() => {
    const dirs: number[][] = [[0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    const n = 58;
    for (let i = 0; i < n; i++) {
        const y = 1 - (2 * (i + 0.5)) / n;
        const r = Math.sqrt(1 - y * y);
        const a = i * Math.PI * (3 - Math.sqrt(5));
        dirs.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    return dirs;
})();

const turnedCache = new WeakMap<object, Map<number, Float32Array>>();

/**
 * Lane SIG6 (the dog on its back a hand over its shadow): the points a pose may rest on however it is turned, the
 * furthest few along each of `TURNED_DIRS`. `lowestPoints` takes the lowest in the model's own frame, a lying body's
 * belly and folded legs; a body the block turns over (a roll, a dust bathe) rests on its back or its side. Kept per rig
 * and row.
 */
export function turnedLowestPoints(rig: SkinnedRig, row: number, per = 2): Float32Array {
    let rows = turnedCache.get(rig);
    if (!rows) turnedCache.set(rig, (rows = new Map()));
    const known = rows.get(row);
    if (known) return known;
    const {xyz, n} = skinRow(rig, row);
    const parts = TURNED_DIRS.map((down) => spreadLowest(xyz, n, down, per));
    const out = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0));
    let at = 0;
    for (const part of parts) {
        out.set(part, at);
        at += part.length;
    }
    rows.set(row, out);
    return out;
}

/**
 * Lane SIG6: how far to move a turned-over body down (+) or up (−) so the lowest of `points` (model space, drawn by `m`)
 * rests on the ground, within `most` metres either way: a roll on the ground rests on its back as drawn, neither over
 * its shadow nor into the ground.
 */
export function restDrop(points: Float32Array, m: ArrayLike<number>, ground: (x: number, z: number) => number, most: number): number {
    let least = Infinity;
    for (let i = 0; i < points.length; i += 3) {
        const x = points[i];
        const y = points[i + 1];
        const z = points[i + 2];
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        least = Math.min(least, wy - ground(wx, wz));
    }
    if (!Number.isFinite(least)) return 0;
    return Math.max(Math.min(least, most), -most);
}

/** The most a seated pose is lowered (m): past it, something else is wrong, and it is left as it was. */
export const SEAT_MOST = 0.15;

/**
 * How far to lower a posed body (world metres, 0 to `SEAT_MOST`) so its lowest point meets the ground: `points` in
 * model space, `m` the instance matrix (three's column-major elements), `ground` the drawn ground at a spot. Never
 * raises it (a point already in the ground is the clip's own: a paw tucked under).
 */
export function seatDrop(points: Float32Array, m: ArrayLike<number>, ground: (x: number, z: number) => number): number {
    let least = Infinity;
    for (let i = 0; i < points.length; i += 3) {
        const x = points[i];
        const y = points[i + 1];
        const z = points[i + 2];
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        least = Math.min(least, wy - ground(wx, wz));
    }
    if (!Number.isFinite(least) || least <= 0) return 0;
    return Math.min(least, SEAT_MOST);
}
