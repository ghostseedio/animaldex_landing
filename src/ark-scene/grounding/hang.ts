/**
 * ARK-ANIM (decision 447, the coordinator's round 4): a roosting bat hangs under its limb by its feet, head down, its
 * body below the limb. Its sleeping act turns it nose down a quarter turn (`behaviour-recipes.ts` postureOf, pitch
 * pi/2), but the scene turned it about its middle at the roost point, and on a limb held it on the limb's surface frame
 * (its back to the point's normal), so it lay along the limb, half through it. Here the pivot is its feet: the
 * underside of the limb (a `canopy_hang` point is there already; a limb's or a branch's top is a diameter above it),
 * and the body hangs a body length below it, swinging slowly fore and aft about the feet and turning a little about
 * its own length.
 *
 * Pure: the scene hands in the point, the time and the animal's seed; the model's turn is the scene's Euler "YXZ"
 * (yaw, then pitch about its own side axis, then roll about its own length).
 */

/** How far it swings fore and aft about its feet (rad), and turns about its own length (rad). */
export const HANG_SWING = 0.06;
export const HANG_TWIST = 0.08;
/** One slow swing (s); each animal's own length of it, from its seed, so a colony does not swing in step. */
export const HANG_PERIOD = 6;
/** Turning over to hang, and back (s). */
export const HANG_EASE = 1.2;

export type HangPoint = {x: number; y: number; z: number; tag: string; radius?: number};

/** Where its feet grip: under the limb (a hang point is under it already; a top point is a diameter above it). */
export function hangPivot(point: HangPoint): {x: number; y: number; z: number} {
    const under = point.tag === "canopy_hang" || point.tag === "cave_mouth" || point.tag === "house_eave" || point.tag === "roof_edge";
    return {x: point.x, y: under ? point.y : point.y - 2 * Math.max(point.radius ?? 0, 0), z: point.z};
}

/**
 * Its drawn pose hanging from `pivot`: k 0 (not yet turned) … 1 (hanging). Its feet (the rear of its body, `length`
 * long, the model's origin at its middle) stay on the pivot all the way through the swing.
 */
export function hangPose(pivot: {x: number; y: number; z: number}, yaw: number, length: number, k: number, time: number, seed: number): {x: number; z: number; base: number; pitch: number; roll: number} {
    const kk = Math.min(Math.max(k, 0), 1);
    const period = HANG_PERIOD * (0.85 + 0.3 * frac(seed * 0.618));
    const phase = 2 * Math.PI * (time / period + frac(seed * 0.377));
    const pitch = kk * (Math.PI / 2 + HANG_SWING * Math.sin(phase));
    const roll = kk * HANG_TWIST * Math.sin(phase * 0.5 + 1.3);
    // Its feet in its own frame: (0, 0, -length / 2); turned (YXZ): up by length/2 sin(pitch), back along its heading by
    // length/2 cos(pitch). Its middle is set so the feet land on the pivot.
    const half = length / 2;
    const back = half * Math.cos(pitch);
    return {x: pivot.x + back * Math.sin(yaw), z: pivot.z + back * Math.cos(yaw), base: pivot.y - half * Math.sin(pitch), pitch, roll};
}

/** Its feet's world point for a hang pose (the tests: they stay on the pivot). */
export function hangFeet(pose: {x: number; z: number; base: number; pitch: number}, yaw: number, length: number): {x: number; y: number; z: number} {
    const half = length / 2;
    const back = half * Math.cos(pose.pitch);
    return {x: pose.x - back * Math.sin(yaw), y: pose.base + half * Math.sin(pose.pitch), z: pose.z - back * Math.cos(yaw)};
}

function frac(v: number): number {
    return v - Math.floor(v);
}
