/**
 * On the wing, the body faces the way it flies and banks into its turns (ARK-ANIM, decision 447: the owner's swallow
 * circled "flying backwards at points"; every flyer was drawn banked 0.35 rad to the left whenever it flew, straight or
 * turning right).
 *
 * The heading the schedule or a recipe gives is kept while it is within `SLIP` of the way the animal actually moves
 * (its drawn position frame to frame), and held at that much off it otherwise: a recipe leg's heading turned at the
 * walking turn rate lagged behind a fast swallow's curve by up to half a turn. The bank is a coordinated turn's,
 * tan φ = v ω / g (v its speed, ω the turn rate of its track), eased, within ±`BANK_MAX`; negative roll is left wing down
 * (the scene's Euler YXZ, as `locomotion/flight.ts` rolls a frame: `roll = -bank`).
 *
 * Per animal, per viewer; visual only. Pure apart from the state it is handed.
 */

export type FlightHeadingState = {x: number; z: number; t: number; track: number | null; bank: number; yaw: number; roll: number};

/** Most the body may face off its track on the wing (radians): a crab into the wind, never sideways or backwards. */
export const SLIP = 0.4;
/** Steepest bank (radians). */
export const BANK_MAX = 1.0;
/** Below this ground speed (m/s) the track is too short to read a heading from (a hover, a take-off's first lift). */
const MIN_SPEED = 0.35;

export function newFlightHeading(): FlightHeadingState {
    return {x: 0, z: 0, t: -1, track: null, bank: 0, yaw: 0, roll: 0};
}

const wrap = (a: number) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
};

/**
 * This frame's yaw and bank roll for a flyer at (x, z) at time t (s) whose schedule heading is `yaw`. `aloft` false
 * resets the state and returns the heading unchanged with no bank.
 */
export function flightHeading(state: FlightHeadingState, x: number, z: number, t: number, yaw: number, aloft: boolean): {yaw: number; roll: number} {
    const dt = t - state.t;
    if (!aloft || state.t < 0 || dt > 0.5 || dt < 0) {
        Object.assign(state, {x, z, t, track: null, bank: 0, yaw, roll: 0});
        return {yaw, roll: 0};
    }
    // The same frame again (a second read): the same answer.
    if (dt < 1e-4) return {yaw: state.yaw, roll: state.roll};
    const dx = x - state.x;
    const dz = z - state.z;
    const speed = Math.hypot(dx, dz) / dt;
    let out = yaw;
    let bankTarget = 0;
    if (speed > MIN_SPEED) {
        const raw = Math.atan2(dx, dz);
        // The track eased a little (frame jitter), never lagging a real turn.
        const track = state.track === null ? raw : state.track + wrap(raw - state.track) * Math.min(dt / 0.08, 1);
        const omega = state.track === null ? 0 : wrap(track - state.track) / dt;
        bankTarget = Math.max(Math.min(Math.atan((speed * omega) / 9.81), BANK_MAX), -BANK_MAX);
        state.track = track;
        // (The heading against this frame's own track: the eased one is only for the turn rate.)
        const off = wrap(yaw - raw);
        if (Math.abs(off) > SLIP) out = raw + Math.sign(off) * SLIP;
    } else {
        state.track = null;
    }
    state.bank += (bankTarget - state.bank) * Math.min(dt / 0.3, 1);
    Object.assign(state, {x, z, t, yaw: out, roll: -state.bank});
    return {yaw: out, roll: -state.bank};
}
