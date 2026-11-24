/**
 * Problem 6 near the camera (pass C): how the prey at each camera stop answer a hunter, made one figure.
 *
 * Each stop counts equally: its own share of prey that reacted (and fled), then the mean over the stops that had any
 * prey with a hunter near. Pooling every stop's rows let one big flock decide the figure (SPECIES-ANIM-B2, 2026-11-24,
 * coordinator: a komodo dragon among a blue-crane flock, 216 rows of 344, took near-camera flee from 56.5% to 36.9%
 * with no hunt code changed). The pooled shares are kept beside it, for the record.
 */

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
