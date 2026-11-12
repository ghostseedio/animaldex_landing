/**
 * Locomotion quality metrics (the owner's brief, section 1): measured from where the feet really are (the posed
 * bones through the instance), never from the targets the driver asked for.
 *
 * - **Foot sliding:** how far a foot drifts along the ground while it is down (from touch-down to lift-off), in mm
 *   per step, and as a share of the hip height.
 * - **Stride/speed mismatch:** the stride the feet actually take (between one foot's touch-downs) over the time it
 *   takes, against the speed the body moves: |measured − speed| / speed.
 * - **Foot height error:** a planted sole's height over (or under) the ground, in mm: floating or sinking feet.
 * - **Joint limits:** frames with a knee folded past its limit, straightened past straight, or bent the wrong way
 *   (against its rest bend), or a leg swung more than 80 degrees from its rest direction.
 */

import {Matrix4, Vector3} from "three";
import {restPole} from "@/ark-scene/locomotion/ik";
import {restInverses} from "@/ark-scene/locomotion/skeleton";
import type {GroundQuery, LocoRig} from "@/ark-scene/locomotion/types";

export type FrameFeet = {
    t: number;
    /** The body's speed (m/s) and position (world). */
    speed: number;
    x: number;
    z: number;
    /** Per leg: the sole (world), the ground under it, whether the driver (or the height rule) says it is down. */
    feet: Array<{x: number; y: number; z: number; ground: number; down: boolean}>;
    /** Per leg: knee angle (radians), whether bent against its rest pole, the leg's swing from rest (radians). */
    joints: Array<{knee: number; wrongWay: boolean; swing: number}>;
};

const tmp = new Vector3();
const tmp2 = new Vector3();
const tmp3 = new Vector3();

/** Measure one frame: the soles through the posed bones and the instance, the knees and the legs' swing. */
export function measureFrame(rig: LocoRig, world: readonly Matrix4[], instance: Matrix4, ground: GroundQuery, t: number, speed: number, down: readonly boolean[] | null, contactTolerance: number): FrameFeet {
    const inv = restInverses(rig);
    const pos = tmp3.setFromMatrixPosition(instance);
    const feet: FrameFeet["feet"] = [];
    const joints: FrameFeet["joints"] = [];
    rig.legs.forEach((leg, i) => {
        const sole = tmp.set(leg.contact[0], leg.contact[1], leg.contact[2]).applyMatrix4(inv[leg.foot]).applyMatrix4(world[leg.foot]).applyMatrix4(instance);
        const g = ground(sole.x, sole.z).height;
        feet.push({x: sole.x, y: sole.y, z: sole.z, ground: g, down: down ? down[i] : sole.y - g < contactTolerance});
        const A = new Vector3().setFromMatrixPosition(world[leg.upper]);
        const B = new Vector3().setFromMatrixPosition(world[leg.lower]);
        const C = new Vector3().setFromMatrixPosition(world[leg.foot]);
        const ba = A.clone().sub(B).normalize();
        const bc = C.clone().sub(B).normalize();
        const knee = Math.acos(Math.min(Math.max(ba.dot(bc), -1), 1));
        // Which side of the hip-ankle line the knee is on, against the rest pole (carried by the hips' turn).
        const ac = C.clone().sub(A);
        const off = B.clone().sub(A).addScaledVector(ac, -B.clone().sub(A).dot(ac) / Math.max(ac.lengthSq(), 1e-12));
        const pole = tmp2.set(...restPole(rig, leg));
        const hips = rig.hips >= 0 ? rig.hips : 0;
        const turn = new Matrix4().extractRotation(world[hips]).multiply(new Matrix4().extractRotation(rig.bones[hips].restWorld).invert());
        pole.applyMatrix4(turn);
        const wrongWay = off.length() > 0.08 * (leg.upperLength + leg.lowerLength) && off.normalize().dot(pole) < -0.2;
        const restDir = new Vector3(leg.ankle[0] - leg.hip[0], leg.ankle[1] - leg.hip[1], leg.ankle[2] - leg.hip[2]).normalize().applyMatrix4(turn);
        const swing = Math.acos(Math.min(Math.max(ac.normalize().dot(restDir), -1), 1));
        joints.push({knee, wrongWay, swing});
    });
    return {t, speed, x: pos.x, z: pos.z, feet, joints};
}

export type LocoMetrics = {
    steps: number;
    /** Planted-foot drift per step (mm): mean, 95th percentile, worst; and the mean as a share of hip height. */
    slideMeanMm: number;
    slideP95Mm: number;
    slideMaxMm: number;
    slideShare: number;
    /** |measured stride speed − body speed| / speed, over steps while moving steadily: mean and worst. */
    strideMismatch: number;
    strideMismatchMax: number;
    /** Planted sole height over the ground (mm): mean of |error|, and worst. */
    footHeightMm: number;
    footHeightMaxMm: number;
    /** Share of leg-frames past a joint limit. */
    jointViolations: number;
};

const quantile = (list: number[], q: number) => {
    if (!list.length) return 0;
    const sorted = list.slice().sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

/** The metrics over a run of frames (world units in metres; reported in mm). `hip`: the hip height (m). */
export function summarise(frames: readonly FrameFeet[], hip: number, kneeMin = 0.35): LocoMetrics {
    const legs = frames[0]?.feet.length ?? 0;
    const slides: number[] = [];
    const heights: number[] = [];
    const mismatches: number[] = [];
    let violations = 0;
    let legFrames = 0;
    for (let i = 0; i < legs; i++) {
        let start: {x: number; z: number} | null = null;
        let drift = 0;
        const touchdowns: Array<{t: number; x: number; z: number}> = [];
        for (let f = 0; f < frames.length; f++) {
            const foot = frames[f].feet[i];
            if (foot.down) {
                if (!start) {
                    start = {x: foot.x, z: foot.z};
                    drift = 0;
                    touchdowns.push({t: frames[f].t, x: foot.x, z: foot.z});
                }
                drift = Math.max(drift, Math.hypot(foot.x - start.x, foot.z - start.z));
                heights.push(Math.abs(foot.y - foot.ground));
            } else if (start) {
                slides.push(drift);
                start = null;
            }
            const j = frames[f].joints[i];
            legFrames++;
            if (j.knee < kneeMin || j.knee > Math.PI - 0.005 || j.wrongWay || j.swing > (80 * Math.PI) / 180) violations++;
        }
        if (start) slides.push(drift);
        // Stride against speed: between successive touch-downs of this foot, while the body moves steadily.
        for (let k = 1; k < touchdowns.length; k++) {
            const a = touchdowns[k - 1];
            const b = touchdowns[k];
            const dt = b.t - a.t;
            if (dt <= 0) continue;
            const inSpan = frames.filter((fr) => fr.t >= a.t && fr.t <= b.t);
            const v = inSpan.reduce((s, fr) => s + fr.speed, 0) / Math.max(inSpan.length, 1);
            const steady = inSpan.every((fr) => Math.abs(fr.speed - v) < 0.15 * v + 1e-3);
            if (v < 0.05 * hip || !steady) continue;
            const measured = Math.hypot(b.x - a.x, b.z - a.z) / dt;
            mismatches.push(Math.abs(measured - v) / v);
        }
    }
    const mm = (m: number) => Math.round(m * 1000 * 100) / 100;
    const slideMean = slides.length ? slides.reduce((s, x) => s + x, 0) / slides.length : 0;
    return {
        steps: slides.length,
        slideMeanMm: mm(slideMean),
        slideP95Mm: mm(quantile(slides, 0.95)),
        slideMaxMm: mm(slides.length ? Math.max(...slides) : 0),
        slideShare: Math.round((slideMean / Math.max(hip, 1e-6)) * 10000) / 10000,
        strideMismatch: Math.round((mismatches.length ? mismatches.reduce((s, x) => s + x, 0) / mismatches.length : 0) * 1000) / 1000,
        strideMismatchMax: Math.round((mismatches.length ? Math.max(...mismatches) : 0) * 1000) / 1000,
        footHeightMm: mm(heights.length ? heights.reduce((s, x) => s + x, 0) / heights.length : 0),
        footHeightMaxMm: mm(heights.length ? Math.max(...heights) : 0),
        jointViolations: Math.round((violations / Math.max(legFrames, 1)) * 10000) / 10000
    };
}
