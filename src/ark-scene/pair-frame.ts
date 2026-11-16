/**
 * Two animals in one picture (owner 2026-11-16, on the live Ark: "when i click a mating log, i don't see 2 of its kind
 * next to each other"). A mating line's tap framed only the record's first animal, at that one animal's close-up
 * distance (an insect's is under a metre), so its partner was out of the picture while they walked to each other or
 * lay side by side. Here: the point between the two and the least distance from which both bodies are in the view.
 * Pure: the scene gives the two drawn middles and lengths, the view's angle and shape, and the distance it would take
 * for the one alone.
 */

export type PairBody = {x: number; y: number; z: number; length: number};

/** Farther apart than this (m) the two are not framed together: from that far back neither could be made out. */
export const PAIR_FRAME_MAX_APART = 40;

/**
 * The view's middle between the two and its distance: at least `single` (the one alone's close-up), and far enough back
 * that the line between them, with half a body to spare at each end, fits in 70% of the view's narrower side (seen
 * square on, the worst case). Null when they are farther apart than `PAIR_FRAME_MAX_APART`.
 */
export function framePair(a: PairBody, b: PairBody, view: {fovDeg: number; aspect: number; single: number; max: number}): {x: number; y: number; z: number; distance: number; apart: number} | null {
    const apart = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (!Number.isFinite(apart) || apart > PAIR_FRAME_MAX_APART) return null;
    const half = Math.tan((view.fovDeg * Math.PI) / 360);
    const narrow = half * Math.min(Math.max(view.aspect, 0.3), 1);
    const span = apart / 2 + Math.max(a.length, b.length) * 0.6;
    const fit = span / (0.7 * narrow);
    const distance = Math.min(Math.max(view.single, fit), Math.max(view.max, view.single));
    return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, distance, apart};
}

/** One frame's step of the view toward the pair's: eased by the frame's time, the same at 30, 60 or 120 fps. */
export function easeToward(from: number, to: number, dt: number, rate = 3): number {
    return from + (to - from) * (1 - Math.exp(-Math.max(dt, 0) * rate));
}
