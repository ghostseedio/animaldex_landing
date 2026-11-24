/**
 * Problem 6 near the camera (pass C): how the prey at each camera stop answer a hunter, made one figure.
 *
 * Each stop counts equally: its own share of prey that reacted (and fled), then the mean over the stops that had any
 * prey with a hunter near. Pooling every stop's rows let one big flock decide the figure (SPECIES-ANIM-B2, 2026-11-24,
 * coordinator: a komodo dragon among a blue-crane flock, 216 rows of 344, took near-camera flee from 56.5% to 36.9%
 * with no hunt code changed). The pooled shares are kept beside it, for the record.
 */

/**
 * Which hunter near a prey makes a row (SPECIES-ANIM-B2, 2026-11-24, coordinator): fixed values of the audit's own, never
 * the reactive layer's alarm distances, or the audit would grade the layer against itself. Before, any hunter within the
 * 25 m sight radius made a row: 289 of the 344 rows at #112's stops were a hunter standing still at a median 18.5 m (a
 * Boelen's python 18-25 m from eight prey), rows a prey is right to ignore.
 *
 * Moving: faster than `HUNT_MOVING_MPS` over the last second, anywhere within the sight radius. 0.1 m/s is under the
 * slowest drawn walk of a hunter (a komodo dragon's 0.32 m/s, a python's slither about 0.2 m/s: behaviours.json walk
 * paces times their lengths) and well over a standing body's drift (a breath's or a turn's few cm/s), so it separates an
 * approach from standing still.
 *
 * Still: within `HUNT_STILL_WITHIN_M` for the prey's size, from flight initiation distances in the field (the distance an
 * animal lets a threat come before it moves away): small birds and lizards, under 0.3 m, about 5-10 m (Blumstein 2006,
 * Anim. Behav. 71:389; Fernandez-Juricic et al. 2001), 8 m; mid-sized birds and mammals, 0.3-1.5 m, about 10-20 m
 * (Blumstein 2006), 15 m; large ones over 1.5 m, deer, cranes standing, 20-50 m and more (Stankowich 2008, Biol. Conserv.
 * 141:2159), capped at the 25 m sight radius.
 */
export const HUNT_SIGHT_M = 25;
export const HUNT_MOVING_MPS = 0.1;
export const HUNT_STILL_WITHIN_M: ReadonlyArray<{under: number; within: number}> = [
    {under: 0.3, within: 8},
    {under: 1.5, within: 15},
    {under: Infinity, within: 25}
];

export function huntCounts(distance: number, hunterSpeed: number, preyLength: number): boolean {
    if (distance > HUNT_SIGHT_M) return false;
    if (hunterSpeed > HUNT_MOVING_MPS) return true;
    return distance <= HUNT_STILL_WITHIN_M.find((c) => preyLength < c.under)!.within;
}

export type StopHunts = {hunter: string; prey: string; encounters: number; reacted: number; fled: number};

const pct = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : null);

export function cameraHuntShares(stops: readonly StopHunts[]): {reactPct: number | null; fleePct: number | null; pooledReactPct: number | null; pooledFleePct: number | null; stopsWithHunts: number} {
    const counted = stops.filter((s) => s.encounters > 0);
    const mean = (share: (s: StopHunts) => number) => (counted.length ? Math.round((1000 * counted.reduce((sum, s) => sum + share(s), 0)) / counted.length) / 10 : null);
    const rows = counted.reduce((n, s) => n + s.encounters, 0);
    return {
        reactPct: mean((s) => s.reacted / s.encounters),
        fleePct: mean((s) => s.fled / s.encounters),
        pooledReactPct: pct(counted.reduce((n, s) => n + s.reacted, 0), rows),
        pooledFleePct: pct(counted.reduce((n, s) => n + s.fled, 0), rows),
        stopsWithHunts: counted.length
    };
}
