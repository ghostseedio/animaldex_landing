/**
 * The live HUD's bars (owner, 2026-11-11: "instead of showing only counts, can we show them as bars in relation
 * to other animals so we can see them increasing / decreasing in size in real time"). Pure: the /ark panel's
 * React bars (`ark-live-bars.tsx`) and the apps' embed (`src/ark-scene/live/bars-view.ts`) both draw from it.
 *
 * - A species' bar is its count against the biggest in its region; a region's bar is its total against the
 *   biggest region. Both on a log scale, so one animal and three hundred are both readable.
 * - The scale's top is a round ceiling at or above the biggest count (5, 10, 20, 50, ...), so one more animal
 *   does not rescale every bar; when it does move, the bars glide to their new lengths.
 * - The pair line (two of each is the aim) is marked on every species bar.
 */

import type {ArkPopulation} from "@/lib/ark-population";

/** The scale's round tops. Below 5 every bar would read as nearly full. */
const CEILINGS = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];

/** One animal is never a hairline. */
export const ARK_BAR_MIN_SHARE = 0.06;

/** A round ceiling at or above the biggest count. */
export function arkBarCeiling(max: number): number {
    const top = Math.max(Number.isFinite(max) ? max : 0, 0);
    for (const ceiling of CEILINGS) if (top <= ceiling) return ceiling;
    return 10 ** Math.ceil(Math.log10(top));
}

/** How long a bar is (0–1) for a count against a ceiling: log scale, never under a sliver for one animal, 0 for none. */
export function arkBarShare(count: number, ceiling: number): number {
    if (!(count > 0)) return 0;
    const share = Math.log1p(count) / Math.log1p(Math.max(ceiling, 1));
    return Math.min(Math.max(share, ARK_BAR_MIN_SHARE), 1);
}

export type ArkBarRow = {key: string; count: number; share: number};
export type ArkBarRegion = {region: string; animals: number; share: number; ceiling: number; pairShare: number; rows: ArkBarRow[]};
export type ArkBars = {ceiling: number; regions: ArkBarRegion[]};

/**
 * Every bar of a population: each species against its region's biggest, each region against the biggest region.
 * `pairShare` is where two animals sit on that region's scale (the pair line).
 */
export function arkBars(population: Pick<ArkPopulation, "regions">): ArkBars {
    const ceiling = arkBarCeiling(Math.max(0, ...population.regions.map((group) => group.animals)));
    return {
        ceiling,
        regions: population.regions.map((group) => {
            const top = arkBarCeiling(Math.max(0, ...group.species.map((row) => row.count)));
            return {
                region: group.region,
                animals: group.animals,
                share: arkBarShare(group.animals, ceiling),
                ceiling: top,
                pairShare: arkBarShare(2, top),
                rows: group.species.map((row) => ({key: row.key, count: row.count, share: arkBarShare(row.count, top)}))
            };
        })
    };
}

/** A count that went up or down, and by how much, for the arrow beside it. */
export type ArkTrend = {delta: number; at: number};

/** How long the arrow and the bar's flash stay after a change (ms). */
export const ARK_TREND_MS = 3500;

/**
 * The counts that changed between two readings (key → delta). A key that is new counts from 0; one that is
 * gone counts down to 0. Unchanged keys are left out.
 */
export function arkCountChanges(before: ReadonlyMap<string, number>, after: ReadonlyMap<string, number>): Map<string, number> {
    const changes = new Map<string, number>();
    after.forEach((count, key) => {
        const delta = count - (before.get(key) ?? 0);
        if (delta) changes.set(key, delta);
    });
    before.forEach((count, key) => {
        if (!after.has(key) && count) changes.set(key, -count);
    });
    return changes;
}

/** The counts of a population by species key and by region (`region:<name>`), for `arkCountChanges`. */
export function arkPopulationCounts(population: Pick<ArkPopulation, "regions">): Map<string, number> {
    const counts = new Map<string, number>();
    for (const group of population.regions) {
        counts.set(`region:${group.region}`, group.animals);
        for (const row of group.species) counts.set(row.key, row.count);
    }
    return counts;
}

/** "+2", "−1": a change as the arrow's label says it (a true minus sign). */
export function arkDeltaText(delta: number, locale?: string): string {
    const amount = Math.abs(delta).toLocaleString(locale);
    return delta > 0 ? `+${amount}` : `−${amount}`;
}
