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
    const position = rig.geometry.getAttribute("position");
    const joints = rig.geometry.getAttribute("arkJoints");
    const weights = rig.geometry.getAttribute("arkWeights");
    const d = rig.data;
    const n = position.count;
    const ys = new Float32Array(n);
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
        ys[v] = sy;
    }
    const order = Array.from({length: n}, (_, i) => i).sort((a, b) => ys[a] - ys[b]);
    // A few apart (a fraction of the body's height), so one paw's vertices do not fill the list.
    let top = -Infinity;
    let bottom = Infinity;
    for (let v = 0; v < n; v++) {
        top = Math.max(top, ys[v]);
        bottom = Math.min(bottom, ys[v]);
    }
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
    rows.set(row, out);
    return out;
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
