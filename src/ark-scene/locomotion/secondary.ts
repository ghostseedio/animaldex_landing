/**
 * Secondary motion: damped springs that make tails, necks (and ears, manes and trunks where a rig has the bones)
 * follow the body with lag and overshoot.
 *
 * Deterministic: fixed 1/120 s substeps, so the same inputs give the same motion at any frame rate (it converges
 * the same for every viewer; nothing it does moves an animal).
 */

export type Spring = {x: number; v: number};

export const newSpring = (): Spring => ({x: 0, v: 0});

const STEP = 1 / 120;

/**
 * Advance a spring toward `target` over `dt`: natural frequency `hz`, damping ratio `zeta` (under 1 overshoots).
 * Semi-implicit Euler on fixed substeps; a long gap (a tab in the background) is capped and settles.
 */
export function stepSpring(s: Spring, target: number, dt: number, hz: number, zeta: number): number {
    const w = 2 * Math.PI * hz;
    let left = Math.min(Math.max(dt, 0), 0.25);
    while (left > 1e-9) {
        const h = Math.min(STEP, left);
        const a = w * w * (target - s.x) - 2 * zeta * w * s.v;
        s.v += a * h;
        s.x += s.v * h;
        left -= h;
    }
    if (!Number.isFinite(s.x) || !Number.isFinite(s.v)) {
        s.x = target;
        s.v = 0;
    }
    return s.x;
}

/** A chain of springs (a tail): each link follows the one before it, so a swing travels down to the tip. */
export type SpringChain = {yaw: Spring[]; pitch: Spring[]};
export const newChain = (n: number): SpringChain => ({yaw: Array.from({length: n}, newSpring), pitch: Array.from({length: n}, newSpring)});

/**
 * Step a chain: the chain as a whole bends toward `yaw`/`pitch` (radians in total: what the body's motion asks of
 * it), each link carrying its share on top of where the link before it is now, slower toward the tip, so a swing
 * travels down to the tip and overshoots there last. Returns the links' local angles (each relative to its parent).
 */
export function stepChain(chain: SpringChain, yaw: number, pitch: number, dt: number, hz: number, zeta: number, out: {yaw: number[]; pitch: number[]}): void {
    const n = chain.yaw.length;
    let prevYaw = 0;
    let prevPitch = 0;
    for (let i = 0; i < n; i++) {
        const f = hz / (1 + 0.35 * i);
        const y = stepSpring(chain.yaw[i], prevYaw + yaw / n, dt, f, zeta);
        const p = stepSpring(chain.pitch[i], prevPitch + pitch / n, dt, f, zeta);
        out.yaw[i] = y - prevYaw;
        out.pitch[i] = p - prevPitch;
        prevYaw = y;
        prevPitch = p;
    }
}
