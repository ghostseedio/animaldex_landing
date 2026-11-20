/**
 * Arm over arm (ARK-CANOPY, the owner 2026-11-21: "ensure we do the monkeys swinging in trees"): a driver for the
 * locomotion layer (`layer.ts`) that gives a brachiator's arms their grip while it swings through the crowns on its
 * canopy route (`canopy-travel.ts`).
 *
 * The rigs of the gibbons and the siamang have no moving clip at all (a sitting rest pose, the rig contract's `pose`:
 * only `idle`), so on its route the body swung as a pendulum under its hold with its arms still in its lap, the hand
 * nowhere near the branch. Here, on the idle's frame:
 * - the holding arm (they alternate: one hold to the next is the other hand, as a gibbon's hand-over-hand ricochet) goes
 *   up to the hold by two-bone IK, its fingers round the wood, and if the arm cannot reach it the whole body is drawn
 *   up under the hand (it hangs from it: the hand is where the wood is, always);
 * - the free arm reaches out ahead through the swing, toward the next hold (Bertram et al. 1999, Usherwood and
 *   Bertram 2003: the trailing hand releases near the top of the swing and the other is already reaching);
 * - in the flight between holds (the lar gibbon's "lets go with both hands, flying briefly across gaps") the catching
 *   arm stretches to the next hold and the released one trails back and down;
 * - the legs draw up a little under the body (gibbons swing with hips and knees flexed).
 * - on the ground (a gap with no way through the crowns), a gibbon walks upright on its hind legs with its long arms held
 *   up and out for balance (Vereecke et al. 2006 on bipedal gibbons), not its arms in its lap: `walk`, on its hops.
 * An orangutan holds as well, slowly (its route is the slow kind's). Leapers and runners keep their own clips.
 *
 * Visual only: the route (`canopy-scene.ts`) sets where the body is; this sets its arms, per viewer, in mesh space.
 */

import {Matrix4, Quaternion, Vector3} from "three";
import {solveLeg} from "@/ark-scene/locomotion/ik";
import {rotateSubtree, translateSubtree} from "@/ark-scene/locomotion/skeleton";
import type {GaitState, LocoDriver, LocoInput, LocoLeg, LocoRig} from "@/ark-scene/locomotion/types";

/** What the canopy route says this frame (`canopy-travel.ts` CanopyPose), in world space. */
export type LocoCanopy = {
    phase: "swing" | "flight" | "hold" | "leap" | "run" | "walk";
    /** The hold its hand is on now (world), or null in the air. */
    hand: {x: number; y: number; z: number} | null;
    /** The hold it swings or flies to next (world), or null. */
    next: {x: number; y: number; z: number} | null;
    /** Which hand holds: +1 its left, -1 its right (alternating hold by hold). */
    lead: 1 | -1;
    /** How far through the swing or the flight (0 → 1). */
    u: number;
    brachiate: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const smooth = (v: number) => {
    const c = clamp(v, 0, 1);
    return c * c * (3 - 2 * c);
};

const inv = new Matrix4();
const vHold = new Vector3();
const vNext = new Vector3();
const vShoulder = new Vector3();
const vWrist = new Vector3();
const vTip = new Vector3();
const vDir = new Vector3();
const vAim = new Vector3();
const vPole = new Vector3();
const vA = new Vector3();
const vB = new Vector3();
const qA = new Quaternion();
const mA = new Matrix4();

/** The arms (the fore pair) by side, or null without two. */
function arms(rig: LocoRig): {left: LocoLeg; right: LocoLeg} | null {
    const fore = rig.legs.filter((leg) => leg.end === "fore");
    const left = fore.find((leg) => leg.side === 1);
    const right = fore.find((leg) => leg.side === -1);
    return left && right ? {left, right} : null;
}

/**
 * Whether the rig's fore chains are arms to move: not a sitting rest pose (the rig contract's `pose`: the gibbons' and
 * the siamang's rigs have their "fore legs" laid down their legs and their head bone at the hips, so raising them tears
 * the mesh). A rig that fails keeps its clip (the orangutan, crouched at rest with its shoulders under its hips, passes).
 */
const fits = new WeakMap<LocoRig, boolean>();
export function armsFit(rig: LocoRig): boolean {
    let ok = fits.get(rig);
    if (ok === undefined) {
        const both = arms(rig);
        ok = Boolean(both && !rig.sitting);
        fits.set(rig, ok);
    }
    return ok;
}

/** The hand's length (wrist to fingertips at rest, mesh units). */
function handLength(leg: LocoLeg): number {
    return Math.hypot(leg.contact[0] - leg.ankle[0], leg.contact[1] - leg.ankle[1], leg.contact[2] - leg.ankle[2]);
}

/** The fingertips now (mesh), through the hand's bone. */
function tipNow(rig: LocoRig, world: readonly Matrix4[], leg: LocoLeg, out: Vector3): Vector3 {
    return out.set(leg.contact[0], leg.contact[1], leg.contact[2]).applyMatrix4(mA.copy(rig.bones[leg.foot].restWorld).invert()).applyMatrix4(world[leg.foot]);
}

/**
 * An arm to a point (mesh): its wrist a hand's length short of it on the line from the shoulder, the elbow out to its
 * side and back. Returns how far the fingertips end from the point.
 */
function reachArm(rig: LocoRig, world: Matrix4[], leg: LocoLeg, point: Vector3): number {
    vShoulder.setFromMatrixPosition(world[leg.upper]);
    vDir.subVectors(point, vShoulder);
    const d = vDir.length();
    if (d < 1e-6) return 0;
    vDir.divideScalar(d);
    vWrist.copy(point).addScaledVector(vDir, -Math.min(handLength(leg), d * 0.3));
    vPole.set(leg.side * 0.75, 0, -0.65).normalize();
    solveLeg(leg, world, vWrist, vPole, 0.01);
    // The hand on along the arm's line (its fingers to the wood), not as the sitting pose holds it.
    vA.subVectors(tipNow(rig, world, leg, vTip), vB.setFromMatrixPosition(world[leg.foot]));
    if (vA.lengthSq() > 1e-12) {
        vAim.subVectors(point, vB);
        if (vAim.lengthSq() > 1e-12) {
            qA.setFromUnitVectors(vA.normalize(), vAim.normalize());
            rotateSubtree(rig, world, leg.foot, qA, vB);
        }
    }
    return tipNow(rig, world, leg, vTip).distanceTo(point);
}

/** The free arm out from its shoulder toward a point (mesh), at `share` of its full reach along the way. */
function reachToward(rig: LocoRig, world: Matrix4[], leg: LocoLeg, point: Vector3, share: number): void {
    vShoulder.setFromMatrixPosition(world[leg.upper]);
    const span = (leg.upperLength + leg.lowerLength + handLength(leg)) * share;
    vA.subVectors(point, vShoulder);
    if (vA.lengthSq() < 1e-12) return;
    vA.normalize().multiplyScalar(span).add(vShoulder);
    reachArm(rig, world, leg, vA);
}

/** Its legs drawn up a little under it (hips and knees flexed), as a swinging gibbon holds them. */
function tuckLegs(rig: LocoRig, world: Matrix4[], amount: number): void {
    for (const leg of rig.legs) {
        if (leg.end !== "hind") continue;
        vA.setFromMatrixPosition(world[leg.upper]);
        qA.setFromAxisAngle(vB.set(1, 0, 0), -0.35 * amount);
        rotateSubtree(rig, world, leg.upper, qA, vA);
        vA.setFromMatrixPosition(world[leg.lower]);
        qA.setFromAxisAngle(vB.set(1, 0, 0), 0.45 * amount);
        rotateSubtree(rig, world, leg.lower, qA, vA);
    }
}

export const brachiateDriver: LocoDriver = {
    name: "brachiate",
    takes(rig, input) {
        const c = input.canopy;
        return Boolean(c && c.brachiate && rig.plan === "primate" && (c.hand || c.next || c.phase === "walk") && armsFit(rig));
    },
    init(): {last: LocoCanopy | null} {
        return {last: null};
    },
    pose(rig, input, world, raw): GaitState | null {
        // (Fading out to the clip after its route, the layer still asks it: its last holds, as it lets go.)
        const memory = raw as {last: LocoCanopy | null};
        const c = input.canopy && input.canopy.brachiate ? input.canopy : memory.last;
        if (!c) return null;
        memory.last = c;
        const both = arms(rig)!;
        inv.copy(input.instance).invert();
        const holding = c.lead === 1 ? both.left : both.right;
        const free = c.lead === 1 ? both.right : both.left;
        if (c.next) vNext.set(c.next.x, c.next.y, c.next.z).applyMatrix4(inv);
        if (c.hand) {
            vHold.set(c.hand.x, c.hand.y, c.hand.z).applyMatrix4(inv);
            // The holding hand on the wood; out of reach, the whole body up under the hand (it hangs from it).
            for (let k = 0; k < 2; k++) {
                const miss = reachArm(rig, world, holding, vHold);
                if (miss < 1e-3) break;
                vA.subVectors(vHold, tipNow(rig, world, holding, vTip));
                const most = 0.6 * rig.height;
                if (vA.length() > most) vA.setLength(most);
                if (rig.hips >= 0) translateSubtree(rig, world, rig.hips, vA.x, vA.y, vA.z);
            }
            // The free arm: out ahead toward the next hold as it swings (hanging at a hold, half up beside the other).
            if (c.next && c.phase === "swing") reachToward(rig, world, free, vNext, 0.55 + 0.4 * smooth(c.u));
            else if (c.phase === "hold") {
                vA.copy(vHold).add(vB.set(free.side * rig.width * 0.6, 0, 0));
                reachToward(rig, world, free, vA, 0.7);
            }
        } else if (c.next) {
            // In the air: the catching arm (the free one) out to the next hold, the released one trailing back and down.
            reachToward(rig, world, free, vNext, 0.85 + 0.15 * smooth(c.u));
            vShoulder.setFromMatrixPosition(world[holding.upper]);
            vA.subVectors(vShoulder, vNext).setY(0);
            if (vA.lengthSq() < 1e-9) vA.set(0, 0, -1);
            vA.normalize().multiplyScalar(0.6).add(vB.set(0, 0.8 - 1.4 * smooth(c.u), 0)).normalize();
            reachToward(rig, world, holding, vA.multiplyScalar(rig.height).add(vShoulder), 0.8);
        }
        else if (c.phase === "walk") {
            // Upright on the ground: both arms up and out to the sides, a little forward, swaying with its steps.
            for (const arm of [both.left, both.right]) {
                vShoulder.setFromMatrixPosition(world[arm.upper]);
                const sway = 0.12 * Math.sin((c.u + (arm.side > 0 ? 0 : 0.5)) * Math.PI * 2);
                vA.set(arm.side * 0.75, 0.62 + sway, 0.2).normalize().multiplyScalar(rig.height).add(vShoulder);
                reachToward(rig, world, arm, vA, 0.92);
            }
            return null;
        }
        tuckLegs(rig, world, c.phase === "hold" ? 0.4 : 1);
        return null;
    }
};
