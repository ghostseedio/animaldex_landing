/**
 * Tiny animals seen (owner, 2026-11-20): a beetle, a fly or an ant (under 5 cm) is drawn at its true size, so once the card is
 * open or it is followed and the reader pulls back a little it was a speck nobody could find. While it is the one chosen (its
 * card open) or followed, and the camera is near (`TINY_LIFT_WITHIN`), it is drawn at least `TINY_MIN_PIXELS` long on screen,
 * at most `TINY_MAX_LIFT` times its size. Never in the wide view, never for any other animal: everywhere else, true scale.
 * Visual only: its place, its path, its collisions and its card keep its real size.
 */

/** Under this true length (m) an animal counts as tiny. */
export const TINY_BELOW = 0.05;
/** The least it is drawn on screen while chosen or followed (px, its length). */
export const TINY_MIN_PIXELS = 40;
/** At most this many times its size. */
export const TINY_MAX_LIFT = 8;
/** Only while the camera is this near it (m); it eases back to true size over the last quarter of the way out. */
export const TINY_LIFT_WITHIN = 6;

/**
 * How much bigger to draw it now (1: as it is). `drawnLength` is the length it is drawn at (m), `distance` the camera's (m),
 * `viewHeight` the view's height (px), `fov` the vertical field of view (degrees).
 */
export function tinyLift(watched: boolean, trueLength: number, drawnLength: number, distance: number, viewHeight: number, fov: number): number {
    if (!watched || !(trueLength > 0) || trueLength >= TINY_BELOW || !(distance > 0) || distance >= TINY_LIFT_WITHIN || !(viewHeight > 0)) return 1;
    const pixels = (drawnLength * viewHeight) / (2 * Math.tan((fov * Math.PI) / 360) * distance);
    if (pixels >= TINY_MIN_PIXELS) return 1;
    const lift = Math.min(TINY_MIN_PIXELS / Math.max(pixels, 1e-6), TINY_MAX_LIFT);
    const fade = Math.min(Math.max((TINY_LIFT_WITHIN - distance) / (TINY_LIFT_WITHIN * 0.25), 0), 1);
    return 1 + (lift - 1) * fade;
}

/** Eases a lift towards where it is going (no jump when the card opens or closes): about a third of a second. */
export function easeLift(from: number, to: number, dt: number): number {
    if (!(dt > 0)) return to;
    return to + (from - to) * Math.exp(-dt / 0.12);
}
