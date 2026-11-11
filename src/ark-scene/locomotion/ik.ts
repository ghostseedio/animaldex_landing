/**
 * Two-bone leg IK (the upper and lower bones; the foot rides on the lower and is turned to the ground after), in
 * mesh space on world matrices. Analytic (law of cosines), so it is exact and deterministic: the knee bends in the
 * plane its pole gives (the way the leg bends at rest, carried with the body), never flipping.
 */

import {Matrix4, Quaternion, Vector3} from "three";
import type {LocoLeg, LocoRig} from "@/ark-scene/locomotion/types";
import {rotateAbout} from "@/ark-scene/locomotion/skeleton";

const A = new Vector3();
const B = new Vector3();
const C = new Vector3();
const AC = new Vector3();
const AB = new Vector3();
const BA = new Vector3();
const BC = new Vector3();
const n = new Vector3();
const u = new Vector3();
const w = new Vector3();
const q = new Quaternion();
const clamp = (x: number, a: number, b: number) => Math.min(Math.max(x, a), b);

/**
 * A leg's pole at rest (mesh space, unit): which way its knee bends away from the hip-to-ankle line. A leg nearly
 * straight at rest bends the way its kind does: hind knees forward, elbows back, a sprawled or insect leg up and out.
 */
export function restPole(rig: LocoRig, leg: LocoLeg): [number, number, number] {
    const a = new Vector3(...leg.hip);
    const b = new Vector3(...leg.knee);
    const c = new Vector3(...leg.ankle);
    const ac = c.clone().sub(a);
    const ab = b.clone().sub(a);
    const l2 = ac.lengthSq();
    const off = ab.clone().addScaledVector(ac, l2 > 1e-12 ? -ab.dot(ac) / l2 : 0);
    const sprawl = rig.plan === "insect" || rig.plan === "arachnid" || rig.plan === "crustacean" || rig.plan === "lizard" || rig.plan === "amphibian" || rig.plan === "turtle";
    if (off.length() > 0.06 * (leg.upperLength + leg.lowerLength)) {
        off.normalize();
        return [off.x, off.y, off.z];
    }
    const kind = sprawl ? new Vector3(leg.side * 0.7, 0.7, 0) : leg.end === "fore" && rig.legs.length >= 4 ? new Vector3(0, 0, -1) : new Vector3(0, 0, 1);
    kind.normalize();
    return [kind.x, kind.y, kind.z];
}

export type LegSolve = {
    /** How far the ankle ends from where it was asked to go (mesh units): 0 when reached. */
    miss: number;
    /** The knee's angle after (radians between the two bones; π is straight). */
    knee: number;
};

/**
 * Put the leg's ankle at `target` (mesh space): bend the knee to the length needed, point the chain at the target
 * from the hip, then roll it about that line so the knee faces its pole. Changes `world` for upper, lower and foot.
 * `softness`: the share of full stretch kept back (a leg never snaps straight).
 */
export function solveLeg(leg: LocoLeg, world: Matrix4[], target: Vector3, pole: Vector3, softness = 0.015): LegSolve {
    A.setFromMatrixPosition(world[leg.upper]);
    B.setFromMatrixPosition(world[leg.lower]);
    C.setFromMatrixPosition(world[leg.foot]);
    const lab = A.distanceTo(B);
    const lcb = B.distanceTo(C);
    const reach = lab + lcb;
    const lat = clamp(A.distanceTo(target), Math.abs(lab - lcb) + reach * 0.05, reach * (1 - softness));
    // 1. The knee: from its angle now to the one that spans hip to target.
    BA.subVectors(A, B).normalize();
    BC.subVectors(C, B).normalize();
    const now = Math.acos(clamp(BA.dot(BC), -1, 1));
    const want = Math.acos(clamp((lab * lab + lcb * lcb - lat * lat) / (2 * lab * lcb), -1, 1));
    // Closing the knee turns BC toward BA (about BC × BA); a straight knee closes away from its pole (the knee goes
    // toward the pole, so the shin swings to the other side).
    n.crossVectors(BC, BA);
    if (n.lengthSq() < 1e-6 || now > Math.PI - 0.08) n.crossVectors(BC, w.copy(pole).negate());
    if (n.lengthSq() > 1e-12) {
        n.normalize();
        q.setFromAxisAngle(n, now - want);
        rotateAbout(world[leg.lower], q, B);
        rotateAbout(world[leg.foot], q, B);
    }
    // 2. The whole chain about the hip, so the ankle points at the target.
    C.setFromMatrixPosition(world[leg.foot]);
    AC.subVectors(C, A).normalize();
    w.subVectors(target, A).normalize();
    q.setFromUnitVectors(AC, w);
    rotateAbout(world[leg.upper], q, A);
    rotateAbout(world[leg.lower], q, A);
    rotateAbout(world[leg.foot], q, A);
    // 3. Roll about the hip-to-target line so the knee faces its pole.
    B.setFromMatrixPosition(world[leg.lower]);
    AB.subVectors(B, A);
    u.copy(AB).addScaledVector(w, -AB.dot(w));
    const p = n.copy(pole).addScaledVector(w, -pole.dot(w));
    if (u.lengthSq() > 1e-10 && p.lengthSq() > 1e-10) {
        u.normalize();
        p.normalize();
        const angle = Math.atan2(AB.crossVectors(u, p).dot(w), clamp(u.dot(p), -1, 1));
        q.setFromAxisAngle(w, angle);
        rotateAbout(world[leg.upper], q, A);
        rotateAbout(world[leg.lower], q, A);
        rotateAbout(world[leg.foot], q, A);
    }
    C.setFromMatrixPosition(world[leg.foot]);
    return {miss: C.distanceTo(target), knee: want};
}
