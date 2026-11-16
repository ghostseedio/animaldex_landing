/**
 * Which animal a tap means (the owner, 2026-11-16: "sometimes clicking on another animal doesn't do anything").
 *
 * The town's kept animals the live budget rests (lane TB, decision 255: most of the pets, farm animals and zoo residents
 * on a large Ark, e.g. 266 of 267 dogs on the low tier) are drawn as static figures through the herd path, and that path
 * had nothing to tap: a tap on a dog in its garden fell through to "nothing chosen". A drawn figure is now picked like an
 * animal drawn one by one, by the same on-screen circle (its size on screen, at least `TAP_MIN_RADIUS` px), and the
 * nearer of the two (by distance over radius) wins, so a figure under the finger is not lost to a live animal whose
 * circle only reaches it. Pure: the scene hands in the projection.
 */

/** The smallest on-screen circle a tap is caught in (px), as for the animals drawn one by one. */
export const TAP_MIN_RADIUS = 20;

/** A tap's score on a candidate's circle: distance over radius (under 1 inside), Infinity outside. */
export function tapScore(x: number, y: number, sx: number, sy: number, radius: number): number {
    const d = Math.hypot(x - sx, y - sy);
    return d < radius ? d / radius : Number.POSITIVE_INFINITY;
}

/** A point projected to the screen: px, and whether it is in front of the camera; null when it is not. */
export type Projector = (x: number, y: number, z: number) => {sx: number; sy: number; distance: number} | null;

/** A resting kind as the tap sees it: its members' ids, their drawn middles (NaN: not drawn this frame), its size. */
export type TapFigureGroup = {members: ReadonlyArray<{id: string}>; middles: ArrayLike<number>; length: number; height: number};

/**
 * The drawn figure a tap at (x, y) lands on, with its score: each drawn member's circle is its body on screen
 * (`perPixelAt` m per px at 1 m), at least `TAP_MIN_RADIUS`.
 */
export function pickFigure(x: number, y: number, groups: ReadonlyArray<TapFigureGroup>, project: Projector, perPixelAt: number): {id: string; score: number} | null {
    let best: {id: string; score: number} | null = null;
    for (const group of groups) {
        for (let i = 0; i < group.members.length; i++) {
            const mx = group.middles[i * 3];
            if (Number.isNaN(mx)) continue;
            const at = project(mx, group.middles[i * 3 + 1], group.middles[i * 3 + 2]);
            if (!at) continue;
            const radius = Math.max(Math.max(group.length, group.height) / (perPixelAt * Math.max(at.distance, 1e-3)) / 2, TAP_MIN_RADIUS);
            const score = tapScore(x, y, at.sx, at.sy, radius);
            if (score < (best?.score ?? Number.POSITIVE_INFINITY)) best = {id: group.members[i].id, score};
        }
    }
    return best;
}

/** Of the animal drawn one by one and the figure a tap lands on, the one it is nearer (a tie: the live animal). */
export function preferTap<A>(live: {hit: A; score: number} | null, figure: {id: string; score: number} | null): {live: A} | {figure: string} | null {
    if (figure && (!live || figure.score < live.score)) return {figure: figure.id};
    return live ? {live: live.hit} : null;
}
