/**
 * Heads that turn to look (visual only): a head and neck look-at with limits
 * per body plan, so a deer turns its head to a sound, an owl turns far, a
 * snake a little and a fish not at all, and no head ever twists unnaturally.
 *
 * The limits are the rigging lane's when its manifest gives them (`head`:
 * the head and neck chain, the axes, yaw and pitch limits per plan); until
 * then the v1 rigs' `neck` and `head` bones are read, and these per-plan
 * limits apply. The look is drawn in the animal material: rigged animals
 * turn the head and neck bones' vertices about the neck's joint, the others
 * the front of the body about the neck (`animal-material.ts`).
 *
 * Pure: angles in, angles out.
 */

export type HeadLimits = {
    /** Most it turns its head left or right (radians, either way). */
    yaw: number;
    /** Most it lifts (up) and lowers (down) its head (radians). */
    up: number;
    down: number;
    /** How fast its head turns (radians a second, at most). */
    rate: number;
    /** Past this much yaw the body turns too (an animal turns round to face a threat behind it). */
    bodyAfter: number;
};

const L = (yaw: number, up: number, down: number, rate: number, bodyAfter = yaw * 0.85): HeadLimits => ({yaw, up, down, rate, bodyAfter});

/** Per body plan (the rig manifest's plans). A plan with no neck to speak of turns very little or not at all. */
export const HEAD_LIMITS: Record<string, HeadLimits> = {
    quadruped: L(1.0, 0.35, 0.55, 3.2),
    primate: L(1.3, 0.45, 0.6, 3.6),
    flying_bird: L(1.6, 0.45, 0.7, 5.5),
    walking_bird: L(1.5, 0.45, 0.8, 5),
    flightless_bird: L(1.4, 0.4, 0.8, 4.5),
    bat: L(0.6, 0.3, 0.4, 3),
    lizard: L(0.55, 0.3, 0.25, 3.5),
    legless: L(0.7, 0.35, 0.2, 2.5),
    turtle: L(0.65, 0.35, 0.35, 1.6),
    amphibian: L(0.25, 0.2, 0.15, 2),
    fish: L(0.12, 0.08, 0.08, 1.5, 0.05),
    cephalopod_jelly: L(0, 0, 0, 0, 0),
    crustacean: L(0, 0, 0, 0, 0),
    insect: L(0.3, 0.15, 0.15, 4),
    flying_insect: L(0.25, 0.15, 0.15, 4),
    arachnid: L(0, 0, 0, 0, 0),
    other: L(0, 0, 0, 0, 0)
};

/** Owls turn their heads further than any other bird (a family rule; the limit is still kept short of the real 270°: the mesh would tear). */
const OWLS = /owl/;

export function headLimits(plan: string | null | undefined, slug?: string, rig?: Partial<HeadLimits> | null): HeadLimits {
    const base = HEAD_LIMITS[plan ?? ""] ?? HEAD_LIMITS.other;
    const owl = plan === "flying_bird" && slug && OWLS.test(slug) ? {yaw: 2.0, bodyAfter: 1.9} : null;
    return {...base, ...owl, ...(rig ?? {})};
}

export function wrapAngle(a: number): number {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

/** Yaw and pitch from an animal's head (its body yaw, the head's height) to a point: yaw relative to its body. */
export function lookAngles(head: {x: number; y: number; z: number}, bodyYaw: number, target: {x: number; y: number; z: number}): {yaw: number; pitch: number} {
    const dx = target.x - head.x;
    const dz = target.z - head.z;
    const flat = Math.hypot(dx, dz);
    // Model heads face +z: yaw 0 is straight ahead, atan2(dx, dz) is the world heading.
    const yaw = flat < 1e-6 ? 0 : wrapAngle(Math.atan2(dx, dz) - bodyYaw);
    const pitch = Math.atan2(target.y - head.y, Math.max(flat, 1e-6));
    return {yaw, pitch};
}

/** Within its limits: the head's share and the body's (the body takes what the head cannot, past `bodyAfter`). */
export function clampLook(want: {yaw: number; pitch: number}, limits: HeadLimits): {yaw: number; pitch: number; body: number} {
    const yaw = Math.min(Math.max(want.yaw, -limits.yaw), limits.yaw);
    const body = Math.abs(want.yaw) > limits.bodyAfter && limits.bodyAfter > 0 ? want.yaw - yaw : 0;
    const pitch = Math.min(Math.max(want.pitch, -limits.down), limits.up);
    return {yaw, pitch, body};
}

export type HeadState = {yaw: number; pitch: number};

/** One step of the head towards a look, at most its turn rate, eased at the end (no snap). */
export function stepHead(state: HeadState, want: {yaw: number; pitch: number}, dt: number, limits: HeadLimits): HeadState {
    const clamped = clampLook(want, limits);
    const most = limits.rate * dt;
    const ease = (from: number, to: number) => {
        const d = to - from;
        const step = Math.sign(d) * Math.min(Math.abs(d), most, Math.abs(d) * Math.min(dt * 9, 1) + most * 0.15);
        return from + step;
    };
    return {yaw: ease(state.yaw, clamped.yaw), pitch: ease(state.pitch, clamped.pitch)};
}
