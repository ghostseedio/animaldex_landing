/**
 * ARK-POSE (the owner on batch 14: "african lion is still elevated rear end above the floor"): a lying pose measured.
 * The posed lie's own gate (`lie-pose.ts` measure) reads the belly's lowest point anywhere along the body, so a chest on
 * the ground passes a rump in the air; and a rig's own lying clips (the pilots') were never measured at all: the lion's
 * holds its hips at 61% of their standing height on legs folded under it, a dachshund's at 83%, a German shepherd's and
 * a Bengal cat's hang whole in the air. This reads one bone row of any lying clip, as it is drawn:
 *
 * - the rump against the shoulder: each end's hip joints' height over their standing height. Lying, both ends come
 *   down; a rump left up (`RUMP_HEIGHT`), or up while the shoulders went down (`RUMP_OVER_SHOULDER`), is a bow or a
 *   crouch, not a lie;
 * - each half's support: the lowest point of the rear half and of the front half of the body (legs and all) above the
 *   ground (`END_GAP`). A half that rests on nothing floats;
 * - the hind paw against the hip and the ground: a folded hind leg lies under or beside the body: its knee and its paw
 *   no higher than the hip joint (`PAW_OVER_HIP`), the leg's lowest point near the ground (`LEG_AIR`: not trailing in
 *   the air behind it).
 */
import {DataUtils, Matrix4, Vector3} from "three";
import {bonePointNow, rowToWorld} from "@/ark-scene/locomotion/skeleton";
import type {LocoRig} from "@/ark-scene/locomotion/types";

export type PoseSkin = {positions: ArrayLike<number>; joints: ArrayLike<number>; weights: ArrayLike<number>};

/** The rump may stay this much higher than the shoulder came down to (each a share of its own standing height). */
export const RUMP_OVER_SHOULDER = 0.22;
/** Lying, the hind hips are at most this share of their standing height (a short-legged body's hips barely come down: a bear's 0.56, a deer's 0.32). */
export const RUMP_HEIGHT = 0.72;
/** Each half of the body rests within this of the ground (a share of the standing height). */
export const END_GAP = 0.05;
/** A hind knee or paw at most this far above its hip joint (a share of the standing height). */
export const PAW_OVER_HIP = 0.05;
/** A hind leg's lowest point at most this far off the ground (a share of the standing height). */
export const LEG_AIR = 0.13;
/** Lying on its side (`sleep_side`), each half rests within this of the ground. */
export const SIDE_GAP = 0.08;
/** A rig's own lying clip gives way to the posed lie when that lies this much lower at the rump (a share of the standing hip height). */
export const LOWER_BY = 0.08;

export type LyingMeasure = {
    /** The fore and hind hip joints' height lying over standing. */
    shoulder: number;
    rump: number;
    /** The lowest point of the front and the rear half above the ground (a share of the standing height; negative: under it). */
    frontGap: number;
    rearGap: number;
    /** The belly's (no leg, head or tail) lowest point in the front and the rear half above the ground (a share of the standing height). */
    bellyFront: number;
    bellyRear: number;
    /** The highest hind knee or paw over its hip joint (a share of the standing height; negative: below it). */
    pawOverHip: number;
    /** The hind legs' lowest points above the ground, the higher of the two (a share of the standing height). */
    legAir: number;
    ok: boolean;
    reason: string | null;
};

const V = new Vector3();

/** A row's skinned heights along the body: the lowest point of the front and the rear half, of everything and of the belly alone. */
function endLows(skin: PoseSkin, m: ArrayLike<number>, z0: number, z1: number, fwd: number, torso: ReadonlySet<number>): {front: number; rear: number; bellyFront: number; bellyRear: number} {
    const P = skin.positions;
    const n = P.length / 3;
    let front = Infinity;
    let rear = Infinity;
    let bellyFront = Infinity;
    let bellyRear = Infinity;
    const half = (z1 - z0) / 2;
    for (let v = 0; v < n; v++) {
        const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
        let oy = 0, any = 0, body = 0;
        for (let k = 0; k < 4; k++) {
            const w = skin.weights[v * 4 + k];
            if (w <= 0) continue;
            const j = skin.joints[v * 4 + k];
            const b = j * 12;
            oy += w * (m[b + 4] * x + m[b + 5] * y + m[b + 6] * z + m[b + 7]);
            any += w;
            if (torso.has(j)) body += w;
        }
        if (any < 0.5) continue;
        // (By its place along the rest body: the same skin is the rear half in every pose.)
        const along = fwd > 0 ? z - z0 : z1 - z;
        if (along < 0 || along > 2 * half) continue;
        if (along < half) rear = Math.min(rear, oy);
        else front = Math.min(front, oy);
        if (body >= 0.7 * any) {
            if (along < half) bellyRear = Math.min(bellyRear, oy);
            else bellyFront = Math.min(bellyFront, oy);
        }
    }
    return {front, rear, bellyFront, bellyRear};
}

/** One bone row (floats, 3×4 per bone) of a lying pose against the gate. `ground` is the rest pose's lowest point. */
export function measureLying(rig: LocoRig, skin: PoseSkin, row: ArrayLike<number>, ground: number): LyingMeasure {
    const world = rig.bones.map(() => new Matrix4());
    rowToWorld(rig, row, 0, world);
    const height = Math.max(rig.height, 1e-6);
    const fore = rig.legs.filter((leg) => leg.end === "fore");
    const hind = rig.legs.filter((leg) => leg.end === "hind");
    const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / Math.max(list.length, 1);
    const hipNow = (legs: typeof fore) => mean(legs.map((leg) => V.setFromMatrixPosition(world[leg.upper]).y - ground));
    const hipRest = (legs: typeof fore) => Math.max(mean(legs.map((leg) => leg.hip[1] - ground)), 1e-6);
    const shoulder = hipNow(fore) / hipRest(fore);
    const rump = hipNow(hind) / hipRest(hind);
    const fwd = mean(fore.map((leg) => leg.hip[2])) >= mean(hind.map((leg) => leg.hip[2])) ? 1 : -1;
    let z0 = Infinity;
    let z1 = -Infinity;
    // (The body's own length: the hips to the shoulders and a little past, not a long tail or a reaching head.)
    for (const leg of [...fore, ...hind]) {
        z0 = Math.min(z0, leg.hip[2]);
        z1 = Math.max(z1, leg.hip[2]);
    }
    const pad = (z1 - z0) * 0.25;
    // (The belly: the skin the body's own bones hold, not a leg, the neck and head, or the tail.)
    const off = new Set<number>();
    for (const leg of rig.legs) for (const b of [leg.upper, ...rig.below[leg.upper]]) off.add(b);
    const headRoot = rig.neck >= 0 ? rig.neck : rig.head;
    if (headRoot >= 0) for (const b of [headRoot, ...rig.below[headRoot]]) off.add(b);
    if (rig.tail.length && rig.tail[0] >= 0) for (const b of [rig.tail[0], ...rig.below[rig.tail[0]]]) off.add(b);
    const torso = new Set(rig.bones.map((_, b) => b).filter((b) => !off.has(b)));
    const ends = endLows(skin, row, z0 - pad, z1 + pad, fwd, torso);
    let pawOverHip = -Infinity;
    for (const leg of hind) {
        const hip = V.setFromMatrixPosition(world[leg.upper]).y;
        const knee = V.setFromMatrixPosition(world[leg.lower]).y;
        const ankle = V.setFromMatrixPosition(world[leg.foot]).y;
        const sole = bonePointNow(rig, world, leg.foot, leg.contact, V).y;
        pawOverHip = Math.max(pawOverHip, (Math.max(knee, ankle, sole) - hip) / height);
    }
    // Each hind leg's lowest point (the skin its bones hold by half or more).
    const legOf = new Map<number, number>();
    hind.forEach((leg, k) => [leg.upper, ...rig.below[leg.upper]].forEach((b) => legOf.set(b, k)));
    const lows = hind.map(() => Infinity);
    const P = skin.positions;
    for (let v = 0; v < P.length / 3; v++) {
        let best = 0;
        let bone = -1;
        for (let k = 0; k < 4; k++) {
            const w = skin.weights[v * 4 + k];
            if (w > best) {
                best = w;
                bone = skin.joints[v * 4 + k];
            }
        }
        const k = legOf.get(bone);
        if (k === undefined) continue;
        let oy = 0;
        for (let j = 0; j < 4; j++) {
            const w = skin.weights[v * 4 + j];
            if (w <= 0) continue;
            const b = skin.joints[v * 4 + j] * 12;
            oy += w * (row[b + 4] * P[v * 3] + row[b + 5] * P[v * 3 + 1] + row[b + 6] * P[v * 3 + 2] + row[b + 7]);
        }
        if (oy < lows[k]) lows[k] = oy;
    }
    const legAir = Math.max(...lows.filter((y) => Number.isFinite(y)).map((y) => (y - ground) / height), -1);
    const frontGap = (ends.front - ground) / height;
    const rearGap = (ends.rear - ground) / height;
    const bellyFront = (ends.bellyFront - ground) / height;
    const bellyRear = (ends.bellyRear - ground) / height;
    let reason: string | null = null;
    if (!fore.length || !hind.length) reason = "no fore or hind legs";
    else if (rump > RUMP_HEIGHT) reason = `rump at ${(rump * 100).toFixed(0)}% of its standing height`;
    else if (rump - shoulder > RUMP_OVER_SHOULDER) reason = `rump ${(rump * 100).toFixed(0)}% up, shoulder ${(shoulder * 100).toFixed(0)}%`;
    else if (rearGap > END_GAP) reason = `rear half ${(rearGap * 100).toFixed(0)}% of its height off the ground`;
    else if (frontGap > END_GAP) reason = `front half ${(frontGap * 100).toFixed(0)}% of its height off the ground`;
    else if (pawOverHip > PAW_OVER_HIP) reason = `a hind knee or paw ${(pawOverHip * 100).toFixed(0)}% of its height above its hip`;
    else if (legAir > LEG_AIR) reason = `a hind leg ${(legAir * 100).toFixed(0)}% of its height off the ground`;
    return {shoulder, rump, frontGap, rearGap, bellyFront, bellyRear, pawOverHip, legAir, ok: !reason, reason};
}

/** A row of the bone texture's half floats as floats. */
export function floatRow(data: Uint16Array, bones: number, row: number, out = new Float32Array(bones * 12)): Float32Array {
    const o = row * bones * 12;
    for (let i = 0; i < out.length; i++) out[i] = DataUtils.fromHalfFloat(data[o + i]);
    return out;
}

/** The worst of a clip's rows against the gate (every `step`th row, and its last). */
export function measureLyingClip(rig: LocoRig, skin: PoseSkin, data: Uint16Array, bones: number, clip: {row: number; rows: number}, ground: number, step = 4): LyingMeasure {
    let worst: LyingMeasure | null = null;
    const row = new Float32Array(bones * 12);
    for (let f = 0; f < clip.rows; f += step) {
        const m = measureLying(rig, skin, floatRow(data, bones, clip.row + f, row), ground);
        if (!worst || (!m.ok && worst.ok) || (m.ok === worst.ok && m.rump - m.shoulder > worst.rump - worst.shoulder)) worst = m;
    }
    return worst!;
}
