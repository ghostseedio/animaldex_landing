/**
 * ARK-SEAT: the points of a drawn body that can touch something, cheaply.
 *
 * A body rests on the outermost of its own mesh: its soles standing, its belly and the side of its legs lying, its
 * toes on a branch. Those are vertices of its hull. Per mesh, once, the outermost vertex in each of 66 directions
 * (more of them downward, so every foot is in) is kept: some 40 to 60 vertices. For a still mesh those are points;
 * for a rig they are vertex numbers with their bones and weights, skinned each time by the pose drawn now (the baked
 * clip rows, or the locomotion layer's live row), which costs a few hundred multiplications, not a mesh.
 */

import type {BufferAttribute, BufferGeometry} from "three";

/** 42 directions of an icosphere, and 24 more in the lower half (the feet). */
const DIRECTIONS: Float32Array = (() => {
    const out: number[] = [];
    const add = (x: number, y: number, z: number) => {
        const l = Math.hypot(x, y, z);
        out.push(x / l, y / l, z / l);
    };
    const t = (1 + Math.sqrt(5)) / 2;
    const base: Array<[number, number, number]> = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    const faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (const p of base) add(p[0], p[1], p[2]);
    const seen = new Set<string>();
    for (const f of faces)
        for (let k = 0; k < 3; k++) {
            const a = f[k];
            const b = f[(k + 1) % 3];
            const key = a < b ? `${a},${b}` : `${b},${a}`;
            if (seen.has(key)) continue;
            seen.add(key);
            add(base[a][0] + base[b][0], base[a][1] + base[b][1], base[a][2] + base[b][2]);
        }
    for (let ring = 0; ring < 2; ring++)
        for (let k = 0; k < 12; k++) {
            const angle = (k / 12) * Math.PI * 2 + ring * 0.26;
            const spread = ring ? 0.9 : 0.45;
            add(Math.cos(angle) * spread, -1, Math.sin(angle) * spread);
        }
    return new Float32Array(out);
})();

export type Hull = {
    /** The hull vertices' numbers in the mesh. */
    vertices: Uint32Array;
    /** Their rest positions (x y z each, model space). */
    rest: Float32Array;
    /** A rig's: four bones and four weights a vertex; null for a still mesh. */
    joints: Uint16Array | null;
    weights: Float32Array | null;
};

const hulls = new WeakMap<BufferGeometry, Hull>();

/** Whether a geometry's hull is worked out already (the pass makes one new one a frame). */
export function hullKnown(geometry: BufferGeometry): boolean {
    return hulls.has(geometry);
}

/** A geometry's hull vertices (kept). A big mesh is read every other vertex or so: a hull vertex has near neighbours. */
export function hullOf(geometry: BufferGeometry): Hull {
    const known = hulls.get(geometry);
    if (known) return known;
    const position = geometry.getAttribute("position") as BufferAttribute;
    const n = position.count;
    const stride = Math.max(1, Math.floor(n / 6000));
    const dirs = DIRECTIONS.length / 3;
    const best = new Float32Array(dirs).fill(-Infinity);
    const at = new Int32Array(dirs).fill(-1);
    // (And the next one out in each downward direction: a pose moves which of a foot's vertices is lowest.)
    const next = new Float32Array(dirs).fill(-Infinity);
    const nextAt = new Int32Array(dirs).fill(-1);
    for (let v = 0; v < n; v += stride) {
        const x = position.getX(v);
        const y = position.getY(v);
        const z = position.getZ(v);
        for (let d = 0; d < dirs; d++) {
            const s = x * DIRECTIONS[d * 3] + y * DIRECTIONS[d * 3 + 1] + z * DIRECTIONS[d * 3 + 2];
            if (s > best[d]) {
                next[d] = best[d];
                nextAt[d] = at[d];
                best[d] = s;
                at[d] = v;
            } else if (s > next[d]) {
                next[d] = s;
                nextAt[d] = v;
            }
        }
    }
    // Along its length and across it, the lowest vertex of each slice: its belly's line and each pair of feet (a long
    // body on uneven ground rests on more than its ends).
    const picked = new Set<number>(Array.from(at).filter((v) => v >= 0));
    for (let d = 0; d < dirs; d++) if (DIRECTIONS[d * 3 + 1] < -0.3 && nextAt[d] >= 0) picked.add(nextAt[d]);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let v = 0; v < n; v += stride) {
        const x = position.getX(v);
        const z = position.getZ(v);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
    }
    const ALONG = 14;
    const ACROSS = 6;
    const lowY = new Float32Array(ALONG + ACROSS).fill(Infinity);
    const lowAt = new Int32Array(ALONG + ACROSS).fill(-1);
    for (let v = 0; v < n; v += stride) {
        const y = position.getY(v);
        const a = Math.min(Math.floor(((position.getZ(v) - minZ) / Math.max(maxZ - minZ, 1e-9)) * ALONG), ALONG - 1);
        const c = ALONG + Math.min(Math.floor(((position.getX(v) - minX) / Math.max(maxX - minX, 1e-9)) * ACROSS), ACROSS - 1);
        if (y < lowY[a]) {
            lowY[a] = y;
            lowAt[a] = v;
        }
        if (y < lowY[c]) {
            lowY[c] = y;
            lowAt[c] = v;
        }
    }
    for (let k = 0; k < lowAt.length; k++) if (lowAt[k] >= 0) picked.add(lowAt[k]);
    const vertices = Uint32Array.from(picked);
    const rest = new Float32Array(vertices.length * 3);
    const j = geometry.getAttribute("arkJoints") as BufferAttribute | undefined;
    const w = geometry.getAttribute("arkWeights") as BufferAttribute | undefined;
    const joints = j && w ? new Uint16Array(vertices.length * 4) : null;
    const weights = j && w ? new Float32Array(vertices.length * 4) : null;
    vertices.forEach((v, i) => {
        rest[i * 3] = position.getX(v);
        rest[i * 3 + 1] = position.getY(v);
        rest[i * 3 + 2] = position.getZ(v);
        if (joints && weights && j && w)
            for (let k = 0; k < 4; k++) {
                joints[i * 4 + k] = j.getComponent(v, k);
                weights[i * 4 + k] = w.getComponent(v, k);
            }
    });
    const hull = {vertices, rest, joints, weights};
    hulls.set(geometry, hull);
    return hull;
}

const halfTable = (() => {
    const table = new Float32Array(65536);
    for (let h = 0; h < 65536; h++) {
        const s = h & 0x8000 ? -1 : 1;
        const e = (h >> 10) & 0x1f;
        const f = h & 0x3ff;
        table[h] = e === 0 ? s * 2 ** -14 * (f / 1024) : e === 31 ? (f ? NaN : s * Infinity) : s * 2 ** (e - 15) * (1 + f / 1024);
    }
    return table;
})();

/**
 * The pose a rig is drawn in, as its shader has it: a live row (floats) or the baked rows (half floats) of the clip
 * now (`row0` to `row1` by `t`), another clip fading out (`from*`, by `fromWeight`), and the rest pose for what is
 * left of `weight`.
 */
export type RigPose = {
    bones: number;
    live: Float32Array | null;
    liveRow: number;
    baked: Uint16Array | null;
    row0: number;
    row1: number;
    t: number;
    from0: number;
    from1: number;
    fromT: number;
    fromWeight: number;
    weight: number;
    /**
     * A still animal wholly in one clip of its own (no gait under it, nothing fading): the clip's rows (its first, how
     * many). Its seat is then taken at the clip's own usual frame (`clipSeat`), not the frame drawn now.
     */
    clip?: {row: number; rows: number} | null;
};

/** A clip's own frame to seat a still animal by, and the vertices lowest in it. */
export type ClipSeat = {
    /** The row at which the posed body's lowest point is at its usual height over the clip (the median of the rows'). */
    row: number;
    /** The vertices lowest at that row (their numbers' rest positions, bones and weights): what the pose rests on. */
    low: Hull;
};

const seats = new WeakMap<BufferGeometry, Map<number, ClipSeat>>();

/** Whether a clip's seat is worked out already (the pass makes one new one a frame). */
export function clipSeatKnown(geometry: BufferGeometry, first: number): boolean {
    return seats.get(geometry)?.has(first) ?? false;
}

/**
 * The frame of a clip (its first row, how many) a still animal is seated by: the one where its lowest point is at
 * its usual height, the median over the clip. Not the lowest (a bird pecking has its bill under its feet for a
 * moment: seated by that, it would stand in the air) nor the highest (a hop's top). And the mesh's lowest vertices
 * at that frame, sixteen of them apart: a lying pose rests on its flank and the side of its legs, which the rest
 * pose's hull does not know. Kept per mesh and clip; one whole skin of the mesh, once.
 */
export function clipSeat(geometry: BufferGeometry, hull: Hull, baked: Uint16Array, bones: number, first: number, rows: number): ClipSeat {
    let known = seats.get(geometry);
    if (!known) seats.set(geometry, (known = new Map()));
    const kept = known.get(first);
    if (kept) return kept;
    const pose: RigPose = {bones, live: null, liveRow: -1, baked, row0: 0, row1: 0, t: 0, from0: 0, from1: 0, fromT: 0, fromWeight: 0, weight: 1};
    const out = new Float32Array(hull.vertices.length * 3);
    // (Every row of a short clip, every few of a long one.)
    const step = Math.max(1, Math.floor(rows / 24));
    const lows: Array<[number, number]> = [];
    for (let r = 0; r < Math.max(rows, 1); r += step) {
        pose.row0 = pose.row1 = first + r;
        const n = posedHull(hull, pose, out);
        let low = Infinity;
        for (let i = 0; i < n; i++) if (out[i * 3 + 1] < low) low = out[i * 3 + 1];
        lows.push([low, first + r]);
    }
    lows.sort((a, b) => a[0] - b[0]);
    const row = lows[Math.floor((lows.length - 1) / 2)][1];
    // The whole mesh at that row: its lowest vertices.
    const position = geometry.getAttribute("position") as BufferAttribute;
    const j = geometry.getAttribute("arkJoints") as BufferAttribute | undefined;
    const w = geometry.getAttribute("arkWeights") as BufferAttribute | undefined;
    const picked: number[] = [];
    if (j && w) {
        const stride = Math.max(1, Math.floor(position.count / 6000));
        const count = Math.ceil(position.count / stride);
        const ys = new Float32Array(count);
        const xyz = new Float32Array(count * 3);
        let top = -Infinity;
        let bottom = Infinity;
        for (let k = 0; k < count; k++) {
            const v = k * stride;
            const x = position.getX(v);
            const y = position.getY(v);
            const z = position.getZ(v);
            let sx = 0;
            let sy = 0;
            let sz = 0;
            for (let c = 0; c < 4; c++) {
                const weight = w.getComponent(v, c);
                if (weight <= 0) continue;
                const o = (row * bones + j.getComponent(v, c)) * 12;
                sx += weight * (halfTable[baked[o]] * x + halfTable[baked[o + 1]] * y + halfTable[baked[o + 2]] * z + halfTable[baked[o + 3]]);
                sy += weight * (halfTable[baked[o + 4]] * x + halfTable[baked[o + 5]] * y + halfTable[baked[o + 6]] * z + halfTable[baked[o + 7]]);
                sz += weight * (halfTable[baked[o + 8]] * x + halfTable[baked[o + 9]] * y + halfTable[baked[o + 10]] * z + halfTable[baked[o + 11]]);
            }
            xyz[k * 3] = sx;
            xyz[k * 3 + 1] = sy;
            xyz[k * 3 + 2] = sz;
            ys[k] = sy;
            if (sy > top) top = sy;
            if (sy < bottom) bottom = sy;
        }
        const order = Array.from({length: count}, (_, k) => k).sort((a, b) => ys[a] - ys[b]);
        const apart = (top - bottom) * 0.06;
        for (const k of order) {
            if (picked.length >= 16 || ys[k] > bottom + (top - bottom) * 0.25) break;
            let clear = true;
            for (const q of picked) if (Math.hypot(xyz[q * 3] - xyz[k * 3], xyz[q * 3 + 1] - xyz[k * 3 + 1], xyz[q * 3 + 2] - xyz[k * 3 + 2]) <= apart) clear = false;
            if (clear) picked.push(k);
        }
        for (let i = 0; i < picked.length; i++) picked[i] *= stride;
    }
    const vertices = Uint32Array.from(picked);
    const rest = new Float32Array(vertices.length * 3);
    const joints = new Uint16Array(vertices.length * 4);
    const weights = new Float32Array(vertices.length * 4);
    for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        rest[i * 3] = position.getX(v);
        rest[i * 3 + 1] = position.getY(v);
        rest[i * 3 + 2] = position.getZ(v);
        if (j && w)
            for (let c = 0; c < 4; c++) {
                joints[i * 4 + c] = j.getComponent(v, c);
                weights[i * 4 + c] = w.getComponent(v, c);
            }
    }
    const seat = {row, low: {vertices, rest, joints, weights}};
    known.set(first, seat);
    return seat;
}

/**
 * The hull's points as posed (model space) into `out` (x y z each); a still mesh's are its rest points. Returns how
 * many.
 */
export function posedHull(hull: Hull, pose: RigPose | null, out: Float32Array): number {
    const n = hull.vertices.length;
    if (!pose || !hull.joints || !hull.weights || pose.weight <= 0) {
        out.set(hull.rest.subarray(0, n * 3));
        return n;
    }
    const live = pose.live;
    const baked = pose.baked;
    const fw = live ? 0 : pose.fromWeight;
    for (let i = 0; i < n; i++) {
        const x = hull.rest[i * 3];
        const y = hull.rest[i * 3 + 1];
        const z = hull.rest[i * 3 + 2];
        let sx = 0;
        let sy = 0;
        let sz = 0;
        for (let k = 0; k < 4; k++) {
            const w = hull.weights[i * 4 + k];
            if (w <= 0) continue;
            const bone = hull.joints[i * 4 + k];
            if (live) {
                const o = (pose.liveRow * pose.bones + bone) * 12;
                sx += w * (live[o] * x + live[o + 1] * y + live[o + 2] * z + live[o + 3]);
                sy += w * (live[o + 4] * x + live[o + 5] * y + live[o + 6] * z + live[o + 7]);
                sz += w * (live[o + 8] * x + live[o + 9] * y + live[o + 10] * z + live[o + 11]);
            } else if (baked) {
                for (let part = 0; part < 2; part++) {
                    const share = part ? fw : 1 - fw;
                    if (share <= 0) continue;
                    const a = ((part ? pose.from0 : pose.row0) * pose.bones + bone) * 12;
                    const b = ((part ? pose.from1 : pose.row1) * pose.bones + bone) * 12;
                    const t = part ? pose.fromT : pose.t;
                    const u = 1 - t;
                    const k = share * w;
                    sx += k * ((halfTable[baked[a]] * u + halfTable[baked[b]] * t) * x + (halfTable[baked[a + 1]] * u + halfTable[baked[b + 1]] * t) * y + (halfTable[baked[a + 2]] * u + halfTable[baked[b + 2]] * t) * z + halfTable[baked[a + 3]] * u + halfTable[baked[b + 3]] * t);
                    sy += k * ((halfTable[baked[a + 4]] * u + halfTable[baked[b + 4]] * t) * x + (halfTable[baked[a + 5]] * u + halfTable[baked[b + 5]] * t) * y + (halfTable[baked[a + 6]] * u + halfTable[baked[b + 6]] * t) * z + halfTable[baked[a + 7]] * u + halfTable[baked[b + 7]] * t);
                    sz += k * ((halfTable[baked[a + 8]] * u + halfTable[baked[b + 8]] * t) * x + (halfTable[baked[a + 9]] * u + halfTable[baked[b + 9]] * t) * y + (halfTable[baked[a + 10]] * u + halfTable[baked[b + 10]] * t) * z + halfTable[baked[a + 11]] * u + halfTable[baked[b + 11]] * t);
                }
            }
        }
        const rest = 1 - Math.min(pose.weight, 1);
        out[i * 3] = sx * (1 - rest) + x * rest;
        out[i * 3 + 1] = sy * (1 - rest) + y * rest;
        out[i * 3 + 2] = sz * (1 - rest) + z * rest;
    }
    return n;
}
