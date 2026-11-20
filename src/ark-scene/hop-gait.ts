/**
 * A hop for a rig with no moving clip of its own (ARK-ANIM, decision 447: the owner's siamang "sliding along the
 * floor"). 60 live rigs have only a sitting or upright rest pose (`pose`: wallabies, kangaroos, hares, rabbits,
 * jerboas, kangaroo rats, squirrels, sifakas, gibbons, the siamang...), so the rig player holds every walk and the body
 * slid along its path at its full speed on its idle.
 *
 * Here the body keeps its pose and travels in hops, as most of them do: it stays put on the ground, then springs along
 * an arc to where its path has got to (a little ahead), nose up as it leaves and down as it lands. The drawn spot lags
 * the path by at most about a hop and catches up when it stops, so the feet never slide: between hops it stands still.
 *
 * Per animal, per viewer; visual only. Pure apart from the state it is handed.
 */

export type HopState = {s: number; d: number; from: number; to: number; t: number; T: number; hopping: boolean};

export function newHopState(): HopState {
    return {s: 0, d: 0, from: 0, to: 0, t: 0, T: 0, hopping: false};
}

/** A hop's reach (body lengths) and its height (a share of the hop's length). */
export const HOP_LENGTH = 0.8;
export const HOP_HEIGHT = 0.22;

/** How long a hop takes for a body this long (s): a quarter second for a jerboa, half a second for a kangaroo. */
export function hopSeconds(lengthM: number): number {
    return Math.min(Math.max(0.22 + 0.2 * Math.sqrt(Math.max(lengthM, 0.01)), 0.22), 0.6);
}

/**
 * This frame: `moved` metres along its path since the last (≥ 0), its body length (m). Returns how far the drawn body
 * is behind its path's point (m, along its heading; a little negative after a hop past a stop), how high it is off the
 * ground (m), its pitch (radians, + nose down, the scene's) and whether it is in a hop this frame.
 */
export function stepHop(state: HopState, moved: number, dt: number, lengthM: number): {back: number; lift: number; pitch: number; air: boolean} {
    const H = Math.max(HOP_LENGTH * lengthM, 0.02);
    const T = hopSeconds(lengthM);
    const speed = dt > 0 ? moved / dt : 0;
    state.s += Math.max(moved, 0);
    if (!state.hopping) {
        const lag = state.s - state.d;
        // A new hop once the path is a good part of a hop ahead, or to finish up when it has stopped.
        if (lag > 0.45 * H || (lag > 0.01 * H && speed < 1e-3)) {
            state.hopping = true;
            state.from = state.d;
            // Where the path will be as it lands (it keeps going), never more than a long hop.
            state.to = state.d + Math.min(lag + speed * T, 1.35 * H);
            state.t = 0;
            state.T = T * Math.min(Math.max((state.to - state.from) / H, 0.6), 1.2);
        }
    }
    let lift = 0;
    let pitch = 0;
    const air = state.hopping;
    if (state.hopping) {
        state.t += dt;
        const w = Math.min(state.t / Math.max(state.T, 1e-3), 1);
        state.d = state.from + (state.to - state.from) * w;
        const reach = state.to - state.from;
        lift = 4 * HOP_HEIGHT * reach * w * (1 - w);
        pitch = -0.28 * Math.cos(Math.PI * w) * Math.min(reach / H, 1);
        if (w >= 1) state.hopping = false;
    }
    // Never more than two hops behind (a jump to a new spot); a hop that lands a little past a stop stays there (its
    // overshoot is at most its speed times a hop's time: it never slides back).
    if (state.s - state.d > 2 * H) state.d = state.s - 2 * H;
    return {back: state.s - state.d, lift, pitch, air};
}
