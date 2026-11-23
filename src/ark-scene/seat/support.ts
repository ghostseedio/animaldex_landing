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
    /**
     * Its feet (`feetOf`): what a body on its feet rests on whatever its clip does with its head (a grazing muzzle or a
     * pecking bill at the ground is not what it stands on). Null: it has none to speak of (a snake, a fish): it rests
     * on whatever of it is lowest.
     */
    feet?: Hull | null;
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
    // (And along its length the highest of each slice: a slab or a stone through the middle of a tail or a neck is in
    // none of the outermost points, but it is between a slice's top and its bottom.)
    const highY = new Float32Array(ALONG).fill(-Infinity);
    const highAt = new Int32Array(ALONG).fill(-1);
    // (And its underside more closely, the lowest of each slice's left, middle and right: a stone under a lying body
    // is between its belly's line and its flanks.)
    const underY = new Float32Array(ALONG * 3).fill(Infinity);
    const underAt = new Int32Array(ALONG * 3).fill(-1);
    for (let v = 0; v < n; v += stride) {
        const y = position.getY(v);
        const a = Math.min(Math.floor(((position.getZ(v) - minZ) / Math.max(maxZ - minZ, 1e-9)) * ALONG), ALONG - 1);
        const c = ALONG + Math.min(Math.floor(((position.getX(v) - minX) / Math.max(maxX - minX, 1e-9)) * ACROSS), ACROSS - 1);
        if (y < lowY[a]) {
            lowY[a] = y;
            lowAt[a] = v;
        }
        if (y > highY[a]) {
            highY[a] = y;
            highAt[a] = v;
        }
        const u = a * 3 + Math.min(Math.floor(((position.getX(v) - minX) / Math.max(maxX - minX, 1e-9)) * 3), 2);
        if (y < underY[u]) {
            underY[u] = y;
            underAt[u] = v;
        }
        if (y < lowY[c]) {
            lowY[c] = y;
            lowAt[c] = v;
        }
    }
    for (let k = 0; k < lowAt.length; k++) if (lowAt[k] >= 0) picked.add(lowAt[k]);
    for (let k = 0; k < highAt.length; k++) if (highAt[k] >= 0) picked.add(highAt[k]);
    for (let k = 0; k < underAt.length; k++) if (underAt[k] >= 0) picked.add(underAt[k]);
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
    const hull: Hull = {vertices, rest, joints, weights};
    hulls.set(geometry, hull);
    return hull;
}

/**
 * A mesh's feet (kept on its hull). A rig's: the vertices its grip bones carry (`grips`: its feet, hands, paws, claws,
 * toes, `map/grip.ts`), the lowest few of each in the rest pose; none for a rig with no such bones. Not the lowest of
 * the rest pose: a bird's rig rests with its wings out and down, lower than its feet, and seated by those it stood
 * 30 cm in the ground. A still mesh's (no bones: it is drawn as it was made): the lowest of it, within a sixteenth of
 * its height.
 */
export function feetOf(geometry: BufferGeometry, grips: ArrayLike<{bone: number}> | null | undefined): Hull | null {
    const hull = hullOf(geometry);
    if (hull.feet !== undefined) return hull.feet;
    const position = geometry.getAttribute("position") as BufferAttribute;
    const j = geometry.getAttribute("arkJoints") as BufferAttribute | undefined;
    const w = geometry.getAttribute("arkWeights") as BufferAttribute | undefined;
    const n = position.count;
    const stride = Math.max(1, Math.floor(n / 6000));
    let bottom = Infinity;
    let top = -Infinity;
    for (let v = 0; v < n; v += stride) {
        const y = position.getY(v);
        if (y < bottom) bottom = y;
        if (y > top) top = y;
    }
    const chosen: number[] = [];
    const apart = (top - bottom) * 0.02;
    const take = (list: number[], most: number) => {
        list.sort((a, b) => position.getY(a) - position.getY(b));
        let taken = 0;
        for (const v of list) {
            if (taken >= most) break;
            let clear = true;
            for (const q of chosen) if (Math.hypot(position.getX(q) - position.getX(v), position.getY(q) - position.getY(v), position.getZ(q) - position.getZ(v)) <= apart) clear = false;
            if (clear) {
                chosen.push(v);
                taken++;
            }
        }
    };
    if (j && w) {
        if (grips && grips.length) {
            const byBone = new Map<number, number[]>();
            for (let g = 0; g < grips.length; g++) byBone.set(grips[g].bone, []);
            for (let v = 0; v < n; v += stride) {
                let held = 0;
                let most = 0;
                let bone = -1;
                for (let k = 0; k < 4; k++) {
                    const weight = w.getComponent(v, k);
                    if (weight <= 0 || !byBone.has(j.getComponent(v, k))) continue;
                    held += weight;
                    if (weight > most) {
                        most = weight;
                        bone = j.getComponent(v, k);
                    }
                }
                if (held >= 0.5 && bone >= 0) byBone.get(bone)!.push(v);
            }
            const each = Math.max(2, Math.floor(48 / byBone.size));
            byBone.forEach((list) => take(list, each));
        }
    } else {
        const low: number[] = [];
        for (let v = 0; v < n; v += stride) if (position.getY(v) <= bottom + (top - bottom) / 16) low.push(v);
        take(low, 40);
    }
    if (!chosen.length) return (hull.feet = null);
    const verts = Uint32Array.from(chosen);
    const at = new Float32Array(verts.length * 3);
    const jj = j && w ? new Uint16Array(verts.length * 4) : null;
    const ww = j && w ? new Float32Array(verts.length * 4) : null;
    verts.forEach((v, i) => {
        at[i * 3] = position.getX(v);
        at[i * 3 + 1] = position.getY(v);
        at[i * 3 + 2] = position.getZ(v);
        if (jj && ww && j && w)
            for (let k = 0; k < 4; k++) {
                jj[i * 4 + k] = j.getComponent(v, k);
                ww[i * 4 + k] = w.getComponent(v, k);
            }
    });
    return (hull.feet = {vertices: verts, rest: at, joints: jj, weights: ww});
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
     * many). Its feet's own bob in the clip is then its motion, not a gap to close at once.
     */
    clip?: {row: number; rows: number} | null;
};

const levels = new WeakMap<Hull, Map<number, number>>();
const levelOut = new Float32Array(3 * 64);
const levelPose: RigPose = {bones: 0, live: null, liveRow: -1, baked: null, row0: 0, row1: 0, t: 0, from0: 0, from1: 0, fromT: 0, fromWeight: 0, weight: 1};

/**
 * How high a rig's lowest sole is at one baked row (model units, its own up): what a clip does to its feet's level
 * from frame to frame, so a body in a clip of its own can be kept on its feet through it (`SeatPass.clipLift`). Kept
 * per feet and row.
 */
export function soleLevel(soles: Hull, baked: Uint16Array, bones: number, row: number): number {
    let known = levels.get(soles);
    if (!known) levels.set(soles, (known = new Map()));
    const kept = known.get(row);
    if (kept !== undefined) return kept;
    levelPose.bones = bones;
    levelPose.baked = baked;
    levelPose.row0 = levelPose.row1 = row;
    const n = Math.min(soles.vertices.length, 64);
    const some: Hull = n === soles.vertices.length ? soles : {vertices: soles.vertices.subarray(0, n), rest: soles.rest, joints: soles.joints, weights: soles.weights};
    posedHull(some, levelPose, levelOut);
    let low = Infinity;
    for (let i = 0; i < n; i++) if (levelOut[i * 3 + 1] < low) low = levelOut[i * 3 + 1];
    if (known.size > 4096) known.clear();
    known.set(row, low);
    return low;
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

// MARK: Lying

/** How many of a mesh's vertices a full look at its posed body skins (every one of most: a thin tip is often lowest). */
const LIE_SCAN = 6000;
/** How many vertices a mesh keeps as ever lowest in a slice (the ones skinned at every seat after). */
const LIE_KEEP = 512;
const LIE_ALONG = 12;
const lieScan: Hull = {vertices: new Uint32Array(LIE_SCAN), rest: new Float32Array(3 * LIE_SCAN), joints: new Uint16Array(4 * LIE_SCAN), weights: new Float32Array(4 * LIE_SCAN)};
const lieOut = new Float32Array(3 * LIE_SCAN);
const lieLowY = new Float32Array(LIE_ALONG * 3);
const lieLowAt = new Int32Array(LIE_ALONG * 3);
const lies = new WeakMap<BufferGeometry, {solves: number; keep: Set<number>; hull: Hull | null}>();

/** The lowest of each slice of `n` posed points in `lieOut` (along the body; left, middle and right) into `lieLowAt`. */
function lowestPerSlice(n: number): void {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
        minX = Math.min(minX, lieOut[i * 3]);
        maxX = Math.max(maxX, lieOut[i * 3]);
        minZ = Math.min(minZ, lieOut[i * 3 + 2]);
        maxZ = Math.max(maxZ, lieOut[i * 3 + 2]);
    }
    lieLowY.fill(Infinity);
    lieLowAt.fill(-1);
    for (let i = 0; i < n; i++) {
        const a = Math.min(Math.floor(((lieOut[i * 3 + 2] - minZ) / Math.max(maxZ - minZ, 1e-9)) * LIE_ALONG), LIE_ALONG - 1);
        const c = a * 3 + Math.min(Math.floor(((lieOut[i * 3] - minX) / Math.max(maxX - minX, 1e-9)) * 3), 2);
        if (lieOut[i * 3 + 1] < lieLowY[c]) {
            lieLowY[c] = lieOut[i * 3 + 1];
            lieLowAt[c] = i;
        }
    }
}

/**
 * Sleeper lane (2026-11-24): a rig lying down (a cow's, an alpaca's, a duck's sleep, posed live) rests on vertices no
 * rest-pose hull holds: its folded knees and hocks, its belly as the pose lays it, a tucked foot's tip. Seated by the
 * rest hull's points alone, the lowest of those sat 4 to 7 cm over the posed body's real lowest, and the body was
 * lowered that much into the ground. The lowest of each slice of the posed body (along it; left, middle and right)
 * written into `out` (model space, x y z each); returns how many, 0 for a still mesh.
 *
 * Which vertices: on a mesh's first 8 seats lying, and every 64th after, up to 6000 of them skinned as posed then (a
 * shared scratch, nothing kept), and each slice's lowest added to the mesh's kept few (at most 512); at every seat,
 * those few skinned as posed now. A sparser sample missed a duck's tucked foot (4 cm in the ground).
 */
export function lyingPoints(geometry: BufferGeometry, pose: RigPose | null, out: Float32Array): number {
    if (!pose || pose.weight < 0.5 || (!pose.live && !pose.baked)) return 0;
    let lie = lies.get(geometry);
    if (!lie) {
        const position = geometry.getAttribute("position") as BufferAttribute | undefined;
        if (!position || !geometry.getAttribute("arkJoints") || !geometry.getAttribute("arkWeights") || position.count < 3) return 0;
        lies.set(geometry, (lie = {solves: 0, keep: new Set(), hull: null}));
    }
    lie.solves++;
    if (lie.solves <= 8 || lie.solves % 64 === 0) {
        const position = geometry.getAttribute("position") as BufferAttribute;
        const j = geometry.getAttribute("arkJoints") as BufferAttribute;
        const w = geometry.getAttribute("arkWeights") as BufferAttribute;
        const stride = Math.max(1, Math.ceil(position.count / LIE_SCAN));
        let c = 0;
        for (let v = 0; v < position.count && c < LIE_SCAN; v += stride, c++) {
            lieScan.vertices[c] = v;
            lieScan.rest[c * 3] = position.getX(v);
            lieScan.rest[c * 3 + 1] = position.getY(v);
            lieScan.rest[c * 3 + 2] = position.getZ(v);
            for (let k = 0; k < 4; k++) {
                lieScan.joints![c * 4 + k] = j.getComponent(v, k);
                lieScan.weights![c * 4 + k] = w.getComponent(v, k);
            }
        }
        lowestPerSlice(posedHull({vertices: lieScan.vertices.subarray(0, c), rest: lieScan.rest, joints: lieScan.joints, weights: lieScan.weights}, pose, lieOut));
        const size = lie.keep.size;
        const picked = Array.from(lieLowAt).filter((i) => i >= 0).map((i) => lieScan.vertices[i]);
        for (const v of picked) lie.keep.add(v);
        const full = lie.keep.size > LIE_KEEP;
        if (full) lie.keep = new Set(picked);
        if (full || lie.keep.size !== size || !lie.hull) lie.hull = hullFrom(geometry, Array.from(lie.keep));
    }
    if (!lie.hull) return 0;
    lowestPerSlice(posedHull(lie.hull, pose, lieOut));
    let m = 0;
    for (let c = 0; c < LIE_ALONG * 3 && (m + 1) * 3 <= out.length; c++) {
        const i = lieLowAt[c];
        if (i < 0) continue;
        out[m * 3] = lieOut[i * 3];
        out[m * 3 + 1] = lieOut[i * 3 + 1];
        out[m * 3 + 2] = lieOut[i * 3 + 2];
        m++;
    }
    return m;
}

/** A hull of the given vertices (their rest positions, a rig's bones and weights). */
function hullFrom(geometry: BufferGeometry, list: readonly number[]): Hull {
    const position = geometry.getAttribute("position") as BufferAttribute;
    const j = geometry.getAttribute("arkJoints") as BufferAttribute | undefined;
    const w = geometry.getAttribute("arkWeights") as BufferAttribute | undefined;
    const vertices = Uint32Array.from(list);
    const rest = new Float32Array(vertices.length * 3);
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
    return {vertices, rest, joints, weights};
}
