/**
 * Lane ark-sleep (the owner, 2026-11-21: "some animals like monkeys are sleeping weird"): a primate's sleep posed from
 * its skeleton, sitting hunched. The rigs' own `sleep` clip for a primate lowered it a little where it stood, on all
 * fours, the head down (rig_v6 make_sleep "hunched where it is"): asleep on a limb it looked like a monkey crouched to
 * pounce. Monkeys and apes sleep sitting: the rump on the branch (or the ground), the knees drawn up, the arms in on
 * the knees, the back rounded and the head sunk onto the chest (a great ape's nest the same, lower).
 *
 * The pose (all in the rest mesh's space, each bone's world matrix set on its own, as `ark-anim`'s posed lie does):
 * - the torso, head, arms and tail turn up about the hips' middle until the back (hips to shoulders) stands
 *   `BACK_DEG` above level, leaning forward: a hunch, not upright;
 * - the hind legs fold up in their own plane: the knees drawn up in front (the thigh forward and up), the shin down
 *   and back under them, the foot forward flat, so the rump comes down to sit;
 * - the arms hang down from the shoulders and back, the hands in on the knees;
 * - the neck bows forward and down (`NECK_DEG`), the head in front of the chest, the face down at it (`FACE_DEG`);
 * - the tail laid back behind it (left out of the drop: a long one would hold it up);
 * - the whole comes down until the lowest of the rump and the feet meets the rest pose's ground (its feet's level): on
 *   the limb where its feet were.
 *
 * `t` 0…1 eases it in and out (the way down and up are the same poses). Gated (`check`): two arms and two legs found, and
 * nothing more than 2% of its height under the ground. A rig that fails keeps its own clip.
 */

import {Matrix4, Quaternion, Vector3} from "three";
import {bonePointNow, rotateSubtree, skinRow, restInverses} from "@/ark-scene/locomotion/skeleton";
import type {LocoRig} from "@/ark-scene/locomotion/types";
import {neckRegion, neckStretch, overLimit} from "@/ark-scene/locomotion/neck-gate";

/** The back's lean above level when it sits (degrees): a hunch, leaning forward over the knees. */
export const BACK_DEG = 58;
/** The head's own heading below level asleep (degrees): sunk onto the chest. */
export const HEAD_DEG = 38;
/** The neck's heading asleep (degrees from straight down, + toward the head): forward and down, the head in front of the chest. */
export const NECK_DEG = 55;
/** The face's heading asleep (degrees below level), with a neck: looking down at the chest. */
export const FACE_DEG = 70;
/** The legs' angles sitting (degrees from straight down, + toward the head): thigh, shin, foot. */
export const SIT_LEGS: readonly [number, number, number] = [135, -15, 85];
/** The arms' (upper arm, forearm, hand). */
export const SIT_ARMS: readonly [number, number, number] = [-18, -32, 10];
/** The way down and back up (seconds) and its rows. */
export const SIT_SECONDS = 0.8;
export const SIT_FRAMES = 8;

export type SitMesh = {positions: ArrayLike<number>; joints: ArrayLike<number>; weights: ArrayLike<number>};
/**
 * How it sits. `level` (ARK-POSE's shapes): the head ends level, its face `face` degrees below the horizon, by turning
 * the neck and the head nose down by what the back's lean turned them up, `neck` of it on the neck's joint and the
 * rest on the head's. Not `level` (ARK-SLEEP's first shape): the neck aimed `neck` of its way to `NECK_DEG` and the
 * face dropped to `face` below level (null: the head rides the neck, no turn of its own).
 */
export type SitShape = {back: number; neck: number; face: number | null; /** ARK-POSE's shapes: how much of the back's lean the head turns back (1: level; 0.85 leaves the chin at the horizon). */ level?: number};
export type SitCheck = {
    ok: boolean;
    reason: string | null;
    sink: number;
    /** The shoulders over the hips sitting, a share of the back's length (the sine of its lean). */
    up?: number;
    /** The rump (the lowest skin the hips or a thigh holds) over the ground, a share of the standing height. */
    rump?: number;
    /** ARK-POSE: the head's pitch (+ nose up) and yaw (+ to its left) in the world sitting, degrees: the rest pose's forward as the head bone carries it. */
    headPitch?: number;
    headYaw?: number;
    /** ARK-POSE: the shape it keeps, the neck's stretch under it, and under ARK-SLEEP's first shape. */
    shape?: SitShape;
    stretch?: number;
    stretchFull?: number;
};
/** A sitting primate's face: this far below the horizon (degrees; chin a little down), and the gate either side of level. */
export const SIT_FACE_DEG = 6;
export const SIT_HEAD_LEVEL_DEG = 15;
/**
 * ARK-POSE (the owner on batch 14, a toque macaque asleep on a limb, its neck drawn out long and thin; then the
 * coordinator on the first fix: its head tipped back, face to the sky, throat stretched): the shapes a rig tries, in
 * order. ARK-SLEEP's sit leans the back 58 degrees and drops the face 70 below level: 110 to 130 degrees between the
 * chest and the face, all on the neck's one joint; across the 78 primate rigs the neck's skin stretched 2.3 times at
 * the median, 6.7 at the worst tenth. Now the head ends level, the face `SIT_FACE_DEG` below the horizon: the back's
 * lean turns the neck and the head up with it, and they turn back down by exactly that, dealt between the neck's joint
 * and the head's (half and half first, then more on one or the other; then 0.85 of the turn, the chin at the
 * horizon). The first that keeps the neck within
 * `NECK_STRETCH_MAX` and the head's own skin within `HEAD_STRETCH_MAX` (or within `SIT_BOW_OVER` of what the sit does
 * with no turn of the head at all: the arms' swing pulls the neck's base too) is its sit; none: the one nearest.
 * (The first cut of these shapes read the neck's turn with an angle that wrapped past straight up, and turned the
 * head the wrong way round by what was left of a full circle: the head tipped back.)
 */
export const SIT_SHAPES: readonly SitShape[] = [
    ...[0.5, 0.35, 0.65, 0.2, 0.8, 0].map((neck) => ({back: BACK_DEG, neck, face: SIT_FACE_DEG, level: 1})),
    // (Then a little short of level, where no split of the whole turn is within the limits: the chin at the horizon,
    // a degree or two over it at most. Less than that was tried, 0.7 of the turn: 13 of the 78 sat with the chin 7 to
    // 14 degrees up.)
    ...[0.5, 0.2, 0].map((neck) => ({back: BACK_DEG, neck, face: SIT_FACE_DEG, level: 0.85}))
];
/** ARK-SLEEP's sit: the neck aimed down, the face dropped onto the chest (the pose with the gate off). */
export const SIT_FULL_BOW: SitShape = {back: BACK_DEG, neck: 1, face: FACE_DEG};
/** A bow may stretch the neck this much more than the sit with no bow does (a factor), when that is past `NECK_STRETCH_MAX` already. */
export const SIT_BOW_OVER = 1.15;
/** The sit with no bow: what the arms and the back alone do to the neck's skin. */
const SIT_NO_BOW: SitShape = {back: BACK_DEG, neck: 0, face: null};

const at = (m: Matrix4, out: Vector3) => out.set(m.elements[12], m.elements[13], m.elements[14]);
const A = new Vector3();
const B = new Vector3();
const C = new Vector3();
const DIR = new Vector3();
const TARGET = new Vector3();
const Q = new Quaternion();
const ID = new Quaternion();
const AXIS = new Vector3();

/** Whether a rig can take the posed sit: a primate with two arms and two legs. */
export function sitShaped(rig: LocoRig): boolean {
    if (rig.plan !== "primate") return false;
    return rig.legs.filter((leg) => leg.end === "fore").length === 2 && rig.legs.filter((leg) => leg.end === "hind").length === 2;
}

export class SitSleepPose {
    private readonly ground: number;
    private readonly height: number;
    private readonly fwd: number;
    private readonly hindBones: Set<number>;
    private readonly tailBones: Set<number>;
    private readonly skin: Matrix4[];
    private readonly owner: Int32Array;
    readonly check: SitCheck;

    constructor(readonly rig: LocoRig, private readonly mesh: SitMesh, readonly shape: SitShape = SIT_FULL_BOW) {
        const n = mesh.positions.length / 3;
        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < n; i++) {
            minY = Math.min(minY, mesh.positions[i * 3 + 1]);
            maxY = Math.max(maxY, mesh.positions[i * 3 + 1]);
        }
        this.ground = minY;
        this.height = Math.max(maxY - minY, 1e-6);
        const z = (end: string) => {
            const legs = rig.legs.filter((leg) => leg.end === end);
            return legs.reduce((sum, leg) => sum + leg.hip[2], 0) / Math.max(legs.length, 1);
        };
        this.fwd = z("fore") >= z("hind") ? 1 : -1;
        this.hindBones = new Set<number>();
        for (const leg of rig.legs) if (leg.end === "hind") for (const b of [leg.upper, ...rig.below[leg.upper]]) this.hindBones.add(b);
        this.tailBones = new Set<number>(rig.tail.length && rig.tail[0] >= 0 ? [rig.tail[0], ...rig.below[rig.tail[0]]] : []);
        // (Each vertex's heaviest bone, for the lowest point.)
        this.owner = new Int32Array(n);
        for (let i = 0; i < n; i++) {
            let best = 0;
            for (let k = 0; k < 4; k++) {
                const w = mesh.weights[i * 4 + k];
                if (w > best) {
                    best = w;
                    this.owner[i] = mesh.joints[i * 4 + k];
                }
            }
        }
        this.skin = rig.bones.map(() => new Matrix4());
        this.check = sitShaped(rig) ? this.measure() : {ok: false, reason: "not a primate with two arms and two legs", sink: 0};
    }

    /** The pose `t` (0 at rest … 1 sitting asleep), bone world matrices in mesh space, into `world`. */
    pose(t: number, world: Matrix4[]): Matrix4[] {
        const rig = this.rig;
        rig.bones.forEach((bone, i) => world[i].copy(bone.restWorld));
        if (t <= 0) return world;
        const fore = rig.legs.filter((leg) => leg.end === "fore");
        const hind = rig.legs.filter((leg) => leg.end === "hind");
        const hips = new Vector3();
        for (const leg of hind) hips.add(A.fromArray(leg.hip));
        hips.multiplyScalar(1 / hind.length);
        const shoulders = new Vector3();
        for (const leg of fore) shoulders.add(A.fromArray(leg.hip));
        shoulders.multiplyScalar(1 / fore.length);
        // The back up to its lean: everything but the hind legs turns about the hips' middle (an upright rig turns little).
        const lean = Math.atan2(shoulders.y - hips.y, (shoulders.z - hips.z) * this.fwd);
        const turn = (this.shape.back * (Math.PI / 180) - lean) * t;
        Q.setFromAxisAngle(AXIS.set(-this.fwd, 0, 0), turn);
        for (let b = 0; b < rig.bones.length; b++) if (!this.hindBones.has(b)) rotateAboutPivot(world[b], Q, hips);
        // The legs folded under: the thigh forward, the shin down, the foot forward.
        for (const leg of hind) this.limb(world, leg, SIT_LEGS, t);
        // The arms down from the shoulders, the forearms forward onto the knees.
        for (const leg of fore) this.limb(world, leg, SIT_ARMS, t);
        // The head sunk onto the chest: its heading (neck to head, or the head's own forward) to HEAD_DEG below level.
        const headRoot = rig.neck >= 0 ? rig.neck : rig.head;
        if (headRoot >= 0 && rig.head >= 0 && this.shape.level) {
            // ARK-POSE: level, facing ahead. The back's turn took the neck and the head up with it: they turn back down
            // by that (`level` of it) and `face` more, the neck's joint its share, the head's the rest. (An upright rig's
            // back turns down: then up.)
            const share = headRoot === rig.head ? 0 : this.shape.neck;
            const down = turn * this.shape.level + (this.shape.face ?? 0) * t * (Math.PI / 180);
            if (share) rotateSubtree(rig, world, headRoot, Q.setFromAxisAngle(AXIS.set(this.fwd, 0, 0), down * share).clone(), at(world[headRoot], new Vector3()));
            rotateSubtree(rig, world, rig.head, Q.setFromAxisAngle(AXIS.set(this.fwd, 0, 0), down * (1 - share)).clone(), at(world[rig.head], new Vector3()));
        } else if (headRoot >= 0 && rig.head >= 0) {
            const deg = Math.PI / 180;
            if (headRoot === rig.head) {
                // (No neck: the head alone, the back's turn taken back and HEAD_DEG down.)
                rotateSubtree(rig, world, rig.head, Q.setFromAxisAngle(AXIS.set(this.fwd, 0, 0), this.shape.face === null ? 0 : turn + HEAD_DEG * (this.shape.face / FACE_DEG) * deg * t).clone(), at(world[rig.head], new Vector3()));
            } else {
                // The neck aimed forward and down (NECK_DEG), then the head turned back up so the face looks down at the
                // chest (FACE_DEG below level), not back between its knees: by how far the neck turned from its rest.
                const rest = at(rig.bones[rig.head].restWorld, new Vector3()).sub(at(rig.bones[headRoot].restWorld, new Vector3()));
                const theta = (v: Vector3) => Math.atan2(v.z * this.fwd, -v.y);
                const pivot = at(world[headRoot], new Vector3());
                at(world[rig.head], B);
                this.aim(world, headRoot, pivot, DIR.subVectors(B, pivot), this.sagittal(NECK_DEG), t * this.shape.neck);
                const now = at(world[rig.head], new Vector3()).sub(at(world[headRoot], new Vector3()));
                // (Its forward turn from rest, nose down +; the face was level at rest.)
                const turned = theta(rest) - theta(now);
                const back = this.shape.face === null ? 0 : turned - this.shape.face * deg * t;
                rotateSubtree(rig, world, rig.head, Q.setFromAxisAngle(AXIS.set(-this.fwd, 0, 0), back).clone(), at(world[rig.head], new Vector3()));
            }
        }
        // The tail back and down, then along behind it.
        const tail = rig.tail.filter((b) => b >= 0);
        for (let k = 0; k + 1 < tail.length; k++) {
            at(world[tail[k]], A);
            at(world[tail[k + 1]], B);
            this.aim(world, tail[k], A, DIR.subVectors(B, A), this.sagittal(k === 0 ? -60 : -92), t);
        }
        // Down until the rump or the feet meet the ground.
        const drop = this.lowest(world) - this.ground;
        for (const m of world) m.elements[13] -= drop;
        return world;
    }

    /** The pose `t` as the bone texture's row (`skinRow`). */
    row(t: number, out: Float32Array, offset = 0): Float32Array {
        skinRow(this.rig, this.pose(t, this.rig.bones.map(() => new Matrix4())), out, offset);
        return out;
    }

    private limb(world: Matrix4[], leg: LocoRig["legs"][number], angles: readonly [number, number, number], t: number) {
        at(world[leg.upper], A);
        at(world[leg.lower], B);
        this.aim(world, leg.upper, A, DIR.subVectors(B, A), this.sagittal(angles[0]), t);
        at(world[leg.lower], B);
        at(world[leg.foot], C);
        this.aim(world, leg.lower, B, DIR.subVectors(C, B), this.sagittal(angles[1]), t);
        at(world[leg.foot], C);
        bonePointNow(this.rig, world, leg.foot, leg.contact, A);
        if (A.distanceToSquared(C) > 1e-12) this.aim(world, leg.foot, C, DIR.subVectors(A, C), this.sagittal(angles[2]), t);
    }

    /** A direction in the body's long plane, `deg` from straight down (+ toward the head). */
    private sagittal(deg: number): Vector3 {
        const r = deg * (Math.PI / 180);
        return TARGET.set(0, -Math.cos(r), this.fwd * Math.sin(r));
    }

    /** Turn a bone (with all it carries) about `pivot` so its direction `now` goes toward `target`, `t` of the way (its splay kept). */
    private aim(world: Matrix4[], bone: number, pivot: Vector3, now: Vector3, target: Vector3, t: number) {
        if (now.lengthSq() < 1e-12) return;
        now.normalize();
        target.x = now.x;
        target.normalize();
        Q.setFromUnitVectors(now, target);
        if (t < 1) Q.copy(ID.identity().slerp(Q, t));
        rotateSubtree(this.rig, world, bone, Q.clone(), pivot.clone());
    }

    /** The lowest skinned point (mesh units). */
    private lowest(world: Matrix4[]): number {
        const inverses = restInverses(this.rig);
        world.forEach((m, b) => this.skin[b].multiplyMatrices(m, inverses[b]));
        const p = this.mesh.positions;
        let low = Infinity;
        for (let i = 0; i < this.owner.length; i++) {
            if (this.tailBones.has(this.owner[i])) continue;
            const x = p[i * 3];
            const y = p[i * 3 + 1];
            const z = p[i * 3 + 2];
            let vy = 0;
            for (let k = 0; k < 4; k++) {
                const w = this.mesh.weights[i * 4 + k];
                if (w <= 0) continue;
                const e = this.skin[this.mesh.joints[i * 4 + k]].elements;
                vy += w * (e[1] * x + e[5] * y + e[9] * z + e[13]);
            }
            low = Math.min(low, vy);
        }
        return low;
    }

    private measure(): SitCheck {
        const world = this.pose(1, this.rig.bones.map(() => new Matrix4()));
        // (After the drop the lowest point is on the ground: a pose is wrong only when it cannot be: NaN.)
        const ok = world.every((m) => m.elements.every(Number.isFinite));
        const sink = ok ? Math.max(this.ground - this.lowest(world), 0) / this.height : 1;
        // (ARK-POSE: how far up the back stands, the shoulders' joints over the hips'.)
        const mid = (end: string) => {
            const legs = this.rig.legs.filter((leg) => leg.end === end);
            const sum = new Vector3();
            for (const leg of legs) sum.add(at(world[leg.upper], A));
            return sum.multiplyScalar(1 / Math.max(legs.length, 1));
        };
        const hips = mid("hind");
        const shoulders = mid("fore");
        const up = ok ? (shoulders.y - hips.y) / Math.max(shoulders.distanceTo(hips), 1e-6) : 0;
        // (And its rump: `lowest` left the skin matrices of this pose in `this.skin`.)
        const seat = new Set<number>([this.rig.hips]);
        for (const leg of this.rig.legs) if (leg.end === "hind") seat.add(leg.upper);
        let low = Infinity;
        const p = this.mesh.positions;
        for (let i = 0; ok && i < this.owner.length; i++) {
            if (!seat.has(this.owner[i])) continue;
            let vy = 0;
            for (let k = 0; k < 4; k++) {
                const w = this.mesh.weights[i * 4 + k];
                if (w <= 0) continue;
                const e = this.skin[this.mesh.joints[i * 4 + k]].elements;
                vy += w * (e[1] * p[i * 3] + e[5] * p[i * 3 + 1] + e[9] * p[i * 3 + 2] + e[13]);
            }
            low = Math.min(low, vy);
        }
        const rump = Number.isFinite(low) ? (low - this.ground) / this.height : 0;
        // Its head's heading in the world: the rest pose's forward as the head bone carries it now.
        let headPitch = 0;
        let headYaw = 0;
        if (ok && this.rig.head >= 0) {
            const e = this.skin[this.rig.head].elements;
            const now = A.set(e[8] * this.fwd, e[9] * this.fwd, e[10] * this.fwd).normalize();
            headPitch = Math.asin(Math.min(Math.max(now.y, -1), 1)) * (180 / Math.PI);
            headYaw = Math.atan2(now.x, now.z * this.fwd) * (180 / Math.PI);
        }
        return {ok: ok && sink <= 0.02, reason: !ok ? "not finite" : sink > 0.02 ? `${(sink * 100).toFixed(1)}% under the ground` : null, sink, up, rump, headPitch, headYaw};
    }
}

/** A rotation about a pivot, premultiplied onto a world (mesh space) matrix. */
const ROT = new Matrix4();
function rotateAboutPivot(m: Matrix4, q: Quaternion, pivot: Vector3): void {
    ROT.makeRotationFromQuaternion(q);
    const e = m.elements;
    e[12] -= pivot.x;
    e[13] -= pivot.y;
    e[14] -= pivot.z;
    m.premultiply(ROT);
    e[12] += pivot.x;
    e[13] += pivot.y;
    e[14] += pivot.z;
}

/**
 * The posed sit's rows appended to a rig's bone rows (half floats, `skinRow`'s layout): the way down (`sit_down`), the
 * way up (`sit_up`) and the pose held, as `sleep` (it replaces the rig's own crouch). Null when the rig fails the check.
 */
export function posedSitRows(rig: LocoRig, mesh: SitMesh, data: Uint16Array, bones: number, toHalf: (value: number) => number, index: ArrayLike<number> | null = null): {data: Uint16Array; clips: Array<{name: string; row: number; rows: number; frames: number; loop: boolean; seconds: number; pass: true}>; check: SitCheck} | {data: null; clips: []; check: SitCheck} {
    let sit = new SitSleepPose(rig, mesh);
    if (!sit.check.ok) return {data: null, clips: [], check: sit.check};
    const per = bones * 12;
    // ARK-POSE: with the mesh's triangles to measure by, the head level (`SIT_SHAPES`): the split of its turn between
    // the neck and the head that the neck's skin and the face take. (Without them: ARK-SLEEP's sit, as before.)
    const region = index ? neckRegion(rig, mesh, index) : null;
    if (region) {
        const probe = new Float32Array(per);
        const stretchOf = (pose: SitSleepPose) => neckStretch(region, mesh, pose.row(1, probe));
        const full = stretchOf(sit);
        const none = new SitSleepPose(rig, mesh, SIT_NO_BOW);
        const limit = Math.max(1, (none.check.ok ? overLimit(stretchOf(none)) : 1) * SIT_BOW_OVER);
        let best: {sit: SitSleepPose; stretch: typeof full} | null = null;
        for (const shape of SIT_SHAPES) {
            const next = new SitSleepPose(rig, mesh, shape);
            if (!next.check.ok) continue;
            const stretch = stretchOf(next);
            if (!best || overLimit(stretch) < overLimit(best.stretch) - 1e-4) best = {sit: next, stretch};
            if (overLimit(stretch) <= limit) {
                best = {sit: next, stretch};
                break;
            }
        }
        if (best) {
            sit = best.sit;
            sit.check.shape = sit.shape;
            sit.check.stretch = best.stretch.p99;
            sit.check.stretchFull = full.p99;
        }
    }
    const own = data.length / per;
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    const down = Array.from({length: SIT_FRAMES + 1}, (_, k) => ease(k / SIT_FRAMES));
    const ts = [...down, ...down.slice().reverse(), 1, 1];
    const out = new Uint16Array(data.length + ts.length * per);
    out.set(data, 0);
    const row = new Float32Array(per);
    ts.forEach((t, k) => {
        sit.row(t, row);
        const o = data.length + k * per;
        for (let i = 0; i < per; i++) out[o + i] = toHalf(row[i]);
    });
    const n = SIT_FRAMES + 1;
    const clip = (name: string, at: number, rows: number, loop: boolean, seconds: number) => ({name, row: own + at, rows, frames: rows - 1, loop, seconds, pass: true as const});
    return {data: out, clips: [clip("sit_down", 0, n, false, SIT_SECONDS), clip("sit_up", n, n, false, SIT_SECONDS), clip("sleep", 2 * n, 2, true, 4)], check: sit.check};
}
