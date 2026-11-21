/**
 * ARK-ANIM round 3 (decision 447, the owner's "it should lie down properly"): a lying rest posed from the skeleton, for
 * the four-legged rigs whose own lying clips are held (`rig-clips.ts` QUADRUPED_LYING_HELD: they bend the mid-stride
 * rest pose into a low creep). A held pose, not a motion: nothing in it can creep.
 *
 * Each leg folds in its own plane along the body (`LIE_FOLD`): the upper limb swung forward, the lower limb folded back
 * under it, the foot forward along the ground. The body comes down until the lowest of the torso or
 * the folded legs meets the rest pose's ground (the feet's level), and the head drops a little (less, or none, when that
 * would put the muzzle in the ground). `t` 0…1 is how far down: the way down and back up are the same poses, eased.
 *
 * Gated per species (`check`): the belly within `BELLY_GAP` of the height off the ground (the legs folded short enough
 * to lie on), no folded leg above its own hip or across the body's middle, nothing under the ground.
 */

import {Matrix4, Quaternion, Vector3} from "three";
import {bonePointNow, restInverses, rotateSubtree, skinRow} from "@/ark-scene/locomotion/skeleton";
import type {LocoRig} from "@/ark-scene/locomotion/types";

/**
 * Each limb segment's angle lying down (degrees from straight down, + toward the head): the upper limb, the lower, the
 * foot. The upper limb swung forward (the owner's brief: 70-90 degrees), the lower folded back under it, the foot
 * forward again along the ground under the body (a cow's or a deer's fold; the forelegs out in front, a sphinx, and the
 * feet left pointing back both left a paw standing up off the ground behind the bear, 2026-11-21).
 */
export const LIE_FOLD: Record<"fore" | "hind", readonly [number, number, number]> = {
    fore: [75, -80, 85],
    hind: [75, -80, 85]
};
/**
 * The second try, for a rig whose forelegs fold out past its nose (the bighorn sheep's, long-legged under a short body):
 * the forearm tucked back under the chest, the hooves under it, a kneeling fold. The hind legs as before.
 */
export const LIE_FOLD_TUCKED: Record<"fore" | "hind", readonly [number, number, number]> = {
    fore: [20, -150, 120],
    hind: LIE_FOLD.hind
};
/** The folds a rig tries, in order: the first its gate passes is its lie. */
export const LIE_FOLDS = [LIE_FOLD, LIE_FOLD_TUCKED] as const;
/** The folded legs turned out from under the body (degrees, fore and hind), about the body's long axis at the hip. */
export const LIE_SPLAY: [number, number] = [25, 25];
/**
 * ARK-POSE (the owner on batch 14: a lying lion's "rear end above the floor", its "hind legs folded high"): each folded
 * leg's own turn out from under the body (`solveSplay`), from `SPLAY_MIN` to `SPLAY_MAX` degrees in `SPLAY_STEP`s: the
 * least that takes it out from under the belly, so the body lies on its belly with the leg along the ground beside
 * it. At the one fixed angle (`LIE_SPLAY`) a long folded leg stayed under the body and held it up (the bears' bellies 6%
 * of their height off the ground, a rump at 58% of its standing height), and a short one hung in the air beside it.
 */
export const SPLAY_MIN = 0;
export const SPLAY_MAX = 80;
export const SPLAY_STEP = 10;
/** A folded leg may sit this far lower than the belly (a share of the standing height) and still not hold it up. */
export const LEG_UNDER = 0.004;
/** The head's drop (degrees, nose down) when the ground allows it. */
export const HEAD_DEG = 12;
/** The most the belly may stay off the ground (a share of the standing height). */
export const BELLY_GAP = 0.12;
/** The most a folded leg may reach out past the body's head-to-tail length (a share of it). */
export const PAST_BODY = 0.1;
/** The way down and back up (seconds), and its rows. */
export const LIE_SECONDS = 0.6;
export const LIE_FRAMES = 8;

export type LieMesh = {positions: ArrayLike<number>; joints: ArrayLike<number>; weights: ArrayLike<number>};
export type LieCheck = {ok: boolean; reason: string | null; belly: number; sink: number};

type Part = "torso" | "head" | "tail" | number;

/** Whether a rig can take the posed lie at all: four legs, a fore and a hind pair, standing (not a sitting rest pose). */
export function lieShaped(rig: LocoRig): boolean {
    if (rig.plan !== "quadruped" || rig.sitting) return false;
    const fore = rig.legs.filter((leg) => leg.end === "fore").length;
    const hind = rig.legs.filter((leg) => leg.end === "hind").length;
    return rig.legs.length === 4 && fore === 2 && hind === 2;
}

const at = (m: Matrix4, out: Vector3) => out.set(m.elements[12], m.elements[13], m.elements[14]);
const DOWN = new Vector3();
const TARGET = new Vector3();
const A = new Vector3();
const B = new Vector3();
const C = new Vector3();
const Q = new Quaternion();
const ID = new Quaternion();
const AXIS = new Vector3();

/** The posed lie: a pose (bone world matrices, mesh space) at any `t`, its texture rows, and its check. */
export class LiePose {
    private readonly parts: Part[];
    private readonly ground: number;
    private readonly height: number;
    private readonly fwd: number;
    private readonly cx: number;
    private readonly skin: Matrix4[];
    /** Each leg's turn out from under the body lying down (degrees; `solveSplay`). */
    readonly splay: number[];
    readonly check: LieCheck;

    constructor(readonly rig: LocoRig, private readonly mesh: LieMesh, private readonly fold_: Record<"fore" | "hind", readonly [number, number, number]> = LIE_FOLD, solved = true) {
        const n = mesh.positions.length / 3;
        let minY = Infinity;
        let maxY = -Infinity;
        let minX = Infinity;
        let maxX = -Infinity;
        for (let i = 0; i < n; i++) {
            minY = Math.min(minY, mesh.positions[i * 3 + 1]);
            maxY = Math.max(maxY, mesh.positions[i * 3 + 1]);
            minX = Math.min(minX, mesh.positions[i * 3]);
            maxX = Math.max(maxX, mesh.positions[i * 3]);
        }
        this.ground = minY;
        this.height = Math.max(maxY - minY, 1e-6);
        this.cx = (minX + maxX) / 2;
        const z = (end: string) => {
            const legs = rig.legs.filter((leg) => leg.end === end);
            return legs.reduce((sum, leg) => sum + leg.hip[2], 0) / Math.max(legs.length, 1);
        };
        this.fwd = z("fore") >= z("hind") ? 1 : -1;
        // Each vertex's part, by its heaviest bone: a leg (its index), the head (the neck and all it carries), the torso.
        const owner = new Map<number, Part>();
        const headRoot = rig.neck >= 0 ? rig.neck : rig.head;
        if (headRoot >= 0) for (const b of [headRoot, ...rig.below[headRoot]]) owner.set(b, "head");
        if (rig.tail.length && rig.tail[0] >= 0) for (const b of [rig.tail[0], ...rig.below[rig.tail[0]]]) owner.set(b, "tail");
        rig.legs.forEach((leg, li) => {
            for (const b of [leg.upper, ...rig.below[leg.upper]]) owner.set(b, li);
        });
        this.parts = [];
        for (let i = 0; i < n; i++) {
            let best = 0;
            let bone = 0;
            for (let k = 0; k < 4; k++) {
                const w = mesh.weights[i * 4 + k];
                if (w > best) {
                    best = w;
                    bone = mesh.joints[i * 4 + k];
                }
            }
            this.parts.push(owner.get(bone) ?? "torso");
        }
        this.skin = rig.bones.map(() => new Matrix4());
        this.splay = rig.legs.map((leg) => LIE_SPLAY[leg.end === "fore" ? 0 : 1]);
        const shaped = lieShaped(rig);
        // (`solved` false: every leg at `LIE_SPLAY`, as before ARK-POSE; a rig the solved turn fails may pass with it.)
        if (shaped && solved && (globalThis as {__arkPoseGate?: boolean}).__arkPoseGate !== false) this.solveSplay();
        this.check = shaped ? this.measure() : {ok: false, reason: "not four standing legs", belly: 1, sink: 0};
    }

    /** The legs folded and turned out at `t`, the body where it stood (no drop yet), into `world`. */
    private fold(t: number, world: Matrix4[]): Matrix4[] {
        const rig = this.rig;
        rig.bones.forEach((bone, i) => world[i].copy(bone.restWorld));
        if (t <= 0) return world;
        rig.legs.forEach((leg, li) => {
            const fold = this.fold_[leg.end === "fore" ? "fore" : "hind"];
            // The upper limb, the lower and the foot each to its angle, in the leg's own plane along the body (its splay kept).
            at(world[leg.upper], A);
            at(world[leg.lower], B);
            this.turn(world, leg.upper, A, DOWN.subVectors(B, A), this.sagittal(fold[0]), t);
            at(world[leg.lower], B);
            at(world[leg.foot], C);
            this.turn(world, leg.lower, B, DOWN.subVectors(C, B), this.sagittal(fold[1]), t);
            at(world[leg.foot], C);
            bonePointNow(rig, world, leg.foot, leg.contact, A);
            if (A.distanceToSquared(C) > 1e-12) this.turn(world, leg.foot, C, DOWN.subVectors(A, C), this.sagittal(fold[2]), t * t);
            // Out to its side, so the folded leg lies along the flank and the belly comes down onto the ground.
            const splay = this.splay[li];
            if (splay) {
                at(world[leg.upper], A);
                rotateSubtree(rig, world, leg.upper, Q.setFromAxisAngle(AXIS.set(0, 0, 1), leg.side * splay * t * (Math.PI / 180)), A.clone());
            }
        });
        return world;
    }

    /** The pose `t` (0 standing at rest … 1 lying), bone world matrices in mesh space, into `world`. */
    pose(t: number, world: Matrix4[]): Matrix4[] {
        const rig = this.rig;
        this.fold(t, world);
        if (t <= 0) return world;
        // Down until the torso or a folded leg meets the ground.
        // (On the way down never up first: a foot turning under lifts the body only as it settles, not in a hop.)
        const lift = this.lowest(world, false) - this.ground;
        const drop = lift >= 0 ? lift : lift * t ** 4;
        for (const m of world) m.elements[13] -= drop;
        // The head a little down, as far as the ground lets it.
        const headRoot = rig.neck >= 0 ? rig.neck : rig.head;
        if (headRoot >= 0) {
            const pivot = at(world[headRoot], new Vector3());
            const saved = [headRoot, ...rig.below[headRoot]].map((b) => world[b].clone());
            for (const deg of [HEAD_DEG, HEAD_DEG / 2, 0, -HEAD_DEG / 2, -HEAD_DEG]) {
                [headRoot, ...rig.below[headRoot]].forEach((b, k) => world[b].copy(saved[k]));
                if (deg) rotateSubtree(rig, world, headRoot, Q.setFromAxisAngle(AXIS.set(this.fwd, 0, 0), deg * t * (Math.PI / 180)), pivot);
                if (this.lowestOf(world, "head") >= this.ground - this.height * 0.005) break;
            }
        }
        // The tail laid back along the ground behind it (a long one, a horse's, hung to the ground and held the body up).
        const tail = rig.tail.filter((b) => b >= 0);
        if (tail.length > 1) {
            const saved = [tail[0], ...rig.below[tail[0]]].map((b) => world[b].clone());
            for (const up of [0, 15, 30, 45, 60]) {
                [tail[0], ...rig.below[tail[0]]].forEach((b, k) => world[b].copy(saved[k]));
                for (let k = 0; k + 1 < tail.length; k++) {
                    at(world[tail[k]], A);
                    at(world[tail[k + 1]], B);
                    this.turn(world, tail[k], A, DOWN.subVectors(B, A), this.sagittal((k === 0 ? -50 : -95) - up), t);
                }
                if (this.lowestOf(world, "tail") >= this.ground - this.height * 0.005) break;
            }
        }
        return world;
    }

    /**
     * Each pair of legs' turn out, lying: the least (from `SPLAY_MIN`) at which the folded legs' lowest point is no
     * lower than the belly's (the lowest of the torso), so the belly meets the ground and the legs lie on it beside the
     * body; where no turn takes them out from under it (a bear's thick thighs), the turn that leaves them highest, so
     * the body rests as low as its legs let it. Read before the body's drop: the legs' and the belly's own heights.
     */
    private solveSplay(): void {
        const rig = this.rig;
        const world = rig.bones.map(() => new Matrix4());
        const under = this.height * LEG_UNDER;
        const belly = this.lowestOf(this.fold(1, world), "torso");
        if (!Number.isFinite(belly)) return;
        for (const end of ["fore", "hind"]) {
            const pair = rig.legs.map((leg, li) => (leg.end === end ? li : -1)).filter((li) => li >= 0);
            // (The one fixed turn first: what it keeps unless another leaves its legs higher.)
            let pick = this.splay[pair[0]];
            this.fold(1, world);
            let highest = Math.min(...pair.map((li) => this.lowestOf(world, li)));
            for (let deg = SPLAY_MIN; deg <= SPLAY_MAX; deg += SPLAY_STEP) {
                for (const li of pair) this.splay[li] = deg;
                this.fold(1, world);
                // (Never a turn that lifts a knee, an ankle or a sole over its hip: the gate's own rule, `measure`.)
                if (pair.some((li) => this.overHip(world, rig.legs[li]))) continue;
                const low = Math.min(...pair.map((li) => this.lowestOf(world, li)));
                if (low >= belly - under) {
                    pick = deg;
                    break;
                }
                if (low > highest + this.height * 0.002) {
                    highest = low;
                    pick = deg;
                }
            }
            for (const li of pair) this.splay[li] = pick;
        }
    }

    /** Whether a folded leg's knee, ankle or sole stands over its hip (by more than 5% of the height). */
    private overHip(world: Matrix4[], leg: LocoRig["legs"][number]): boolean {
        const hip = at(world[leg.upper], A).y + this.height * 0.05;
        const sole = bonePointNow(this.rig, world, leg.foot, leg.contact, B).y;
        return Math.max(at(world[leg.lower], C).y, at(world[leg.foot], C).y, sole) > hip;
    }

    /** The pose `t` as the bone texture's row (`skinRow`: per bone 3×4 of world · rest⁻¹). */
    row(t: number, out: Float32Array, offset = 0): Float32Array {
        skinRow(this.rig, this.pose(t, this.rig.bones.map(() => new Matrix4())), out, offset);
        return out;
    }

    /** A direction in the body's long plane, `deg` from straight down (+ toward the head). */
    private sagittal(deg: number): Vector3 {
        const r = deg * (Math.PI / 180);
        return TARGET.set(0, -Math.cos(r), this.fwd * Math.sin(r));
    }

    /** Turn a bone (with all it carries) about `pivot` so its direction `now` goes toward `target`, `t` of the way. */
    private turn(world: Matrix4[], bone: number, pivot: Vector3, now: Vector3, target: Vector3, t: number) {
        if (now.lengthSq() < 1e-12) return;
        now.normalize();
        // (Its splay across the body kept: the turn is in the leg's own plane.)
        target.x = now.x;
        target.normalize();
        Q.setFromUnitVectors(now, target);
        if (t < 1) Q.copy(ID.identity().slerp(Q, t));
        rotateSubtree(this.rig, world, bone, Q.clone(), pivot.clone());
    }

    private skinned(world: Matrix4[]) {
        const inverses = restInverses(this.rig);
        world.forEach((m, b) => this.skin[b].multiplyMatrices(m, inverses[b]));
    }

    private vertex(i: number, out: Vector3): Vector3 {
        const p = this.mesh.positions;
        const x = p[i * 3];
        const y = p[i * 3 + 1];
        const z = p[i * 3 + 2];
        out.set(0, 0, 0);
        for (let k = 0; k < 4; k++) {
            const w = this.mesh.weights[i * 4 + k];
            if (w <= 0) continue;
            const e = this.skin[this.mesh.joints[i * 4 + k]].elements;
            out.x += w * (e[0] * x + e[4] * y + e[8] * z + e[12]);
            out.y += w * (e[1] * x + e[5] * y + e[9] * z + e[13]);
            out.z += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
        }
        return out;
    }

    /** The lowest point of the body and legs (the head and the tail left out: they settle after), or of everything. */
    private lowest(world: Matrix4[], head: boolean): number {
        this.skinned(world);
        let low = Infinity;
        for (let i = 0; i < this.parts.length; i++) if (head || (this.parts[i] !== "head" && this.parts[i] !== "tail")) low = Math.min(low, this.vertex(i, A).y);
        return low;
    }

    private readonly partList = new Map<Part, number[]>();
    private lowestOf(world: Matrix4[], part: Part): number {
        this.skinned(world);
        let list = this.partList.get(part);
        if (!list) {
            list = [];
            for (let i = 0; i < this.parts.length; i++) if (this.parts[i] === part) list.push(i);
            this.partList.set(part, list);
        }
        let low = Infinity;
        for (const i of list) low = Math.min(low, this.vertex(i, A).y);
        return low;
    }

    /** The lying pose against the gate. */
    private measure(): LieCheck {
        const world = this.pose(1, this.rig.bones.map(() => new Matrix4()));
        this.skinned(world);
        let torso = Infinity;
        let low = Infinity;
        let reason: string | null = null;
        const width = Math.max(this.rig.width, 1e-6);
        let top = -Infinity;
        let back = Infinity;
        let front = -Infinity;
        // (Its back's top; and its length, head to tail, which no folded leg reaches out past.)
        for (let i = 0; i < this.parts.length; i++) {
            if (typeof this.parts[i] === "number") continue;
            const v = this.vertex(i, B);
            if (this.parts[i] === "torso") top = Math.max(top, v.y);
            back = Math.min(back, v.z);
            front = Math.max(front, v.z);
        }
        let over = 0;
        let overLeg = "";
        // (Its joints: a folded knee, ankle or sole no higher than its hip.)
        for (const leg of this.rig.legs) {
            const hip = at(world[leg.upper], new Vector3()).y + this.height * 0.05;
            const sole = bonePointNow(this.rig, world, leg.foot, leg.contact, new Vector3()).y;
            if (!reason && Math.max(at(world[leg.lower], C).y, at(world[leg.foot], C).y, sole) > hip) reason = `leg ${leg.key} folded above its hip`;
        }
        for (let i = 0; i < this.parts.length; i++) {
            const v = this.vertex(i, B);
            const part = this.parts[i];
            low = Math.min(low, v.y);
            if (part === "torso") torso = Math.min(torso, v.y);
            if (typeof part === "number" && !reason) {
                const leg = this.rig.legs[part];
                if (v.y > top) reason = `leg ${leg.key} through the back`;
                else if ((v.x - this.cx) * leg.side < -width * 0.4) reason = `leg ${leg.key} across the body`;
                else {
                    const out = Math.max((back - v.z) / (front - back), (v.z - front) / (front - back));
                    if (out > over) {
                        over = out;
                        overLeg = `${leg.key} ${(back - v.z) > (v.z - front) ? (this.fwd > 0 ? "behind" : "ahead") : this.fwd > 0 ? "ahead" : "behind"}`;
                    }
                }
            }
        }
        const belly = Number.isFinite(torso) ? (torso - this.ground) / this.height : 1;
        const sink = Math.max(this.ground - low, 0) / this.height;
        if (!reason && over > PAST_BODY) reason = `a leg out past the body by ${(over * 100).toFixed(0)}% of its length (${overLeg})`;
        if (!reason && belly > BELLY_GAP) reason = `belly ${(belly * 100).toFixed(0)}% of the height off the ground`;
        if (!reason && sink > 0.01) reason = `${(sink * 100).toFixed(1)}% of the height under the ground`;
        return {ok: !reason, reason, belly, sink};
    }
}
