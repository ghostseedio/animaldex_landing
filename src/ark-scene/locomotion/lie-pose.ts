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
/** The folded legs turned out from under the body (degrees, fore and hind), about the body's long axis at the hip. */
export const LIE_SPLAY: [number, number] = [25, 25];
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

type Part = "torso" | "head" | number;

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
    readonly check: LieCheck;

    constructor(readonly rig: LocoRig, private readonly mesh: LieMesh) {
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
        this.check = lieShaped(rig) ? this.measure() : {ok: false, reason: "not four standing legs", belly: 1, sink: 0};
    }

    /** The pose `t` (0 standing at rest … 1 lying), bone world matrices in mesh space, into `world`. */
    pose(t: number, world: Matrix4[]): Matrix4[] {
        const rig = this.rig;
        rig.bones.forEach((bone, i) => world[i].copy(bone.restWorld));
        if (t <= 0) return world;
        for (const leg of rig.legs) {
            const fold = LIE_FOLD[leg.end === "fore" ? "fore" : "hind"];
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
            if (LIE_SPLAY[leg.end === "fore" ? 0 : 1]) {
                at(world[leg.upper], A);
                rotateSubtree(rig, world, leg.upper, Q.setFromAxisAngle(AXIS.set(0, 0, 1), leg.side * LIE_SPLAY[leg.end === "fore" ? 0 : 1] * t * (Math.PI / 180)), A.clone());
            }
        }
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
        return world;
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

    /** The lowest point of the body and legs (the head left out: it drops after), or of everything. */
    private lowest(world: Matrix4[], head: boolean): number {
        this.skinned(world);
        let low = Infinity;
        for (let i = 0; i < this.parts.length; i++) if (head || this.parts[i] !== "head") low = Math.min(low, this.vertex(i, A).y);
        return low;
    }

    private lowestOf(world: Matrix4[], part: Part): number {
        this.skinned(world);
        let low = Infinity;
        for (let i = 0; i < this.parts.length; i++) if (this.parts[i] === part) low = Math.min(low, this.vertex(i, A).y);
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
                else over = Math.max(over, (back - v.z) / (front - back), (v.z - front) / (front - back));
            }
        }
        const belly = Number.isFinite(torso) ? (torso - this.ground) / this.height : 1;
        const sink = Math.max(this.ground - low, 0) / this.height;
        if (!reason && over > PAST_BODY) reason = `a leg out past the body by ${(over * 100).toFixed(0)}% of its length`;
        if (!reason && belly > BELLY_GAP) reason = `belly ${(belly * 100).toFixed(0)}% of the height off the ground`;
        if (!reason && sink > 0.01) reason = `${(sink * 100).toFixed(1)}% of the height under the ground`;
        return {ok: !reason, reason, belly, sink};
    }
}
