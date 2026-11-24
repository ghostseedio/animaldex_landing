/**
 * An open-ocean swimmer up at the very top of the water (SEA-SURFACE, 2026-11-24; the coordinator: "Manta surface
 * cruising at 0.3–1 m for part of its loop, with wingtips breaking the water"). Only the kinds whose own stored text
 * says they spend time near the surface (`surface-cruise.json`, the quote and its field).
 *
 * On its loop (`open-ocean.ts`) it spends its row's share of the time up there, in spells of a few minutes on the shared
 * clock: it rises over `CRUISE_EASE` s, cruises with its highest point `depth` m under (wandering slowly within its row's
 * range: all of it under, since a tip poking through the opaque sea read from above as a white speck on its own
 * silhouette; its wake still forms above it, `CRUISE_SHALLOW`) and goes down again. The rest of the time it swims in its band as
 * before. Pure in (id, slug, epoch seconds): every viewer sees the same. Visual only.
 */

import {hash32} from "@/lib/ark-clock";
import table from "@/ark-scene/surface-cruise.json";

type Row = {share: number; depth: [number, number]; quote: [string, string]};
const ROWS = (table as unknown as {species: Record<string, Row>}).species;

/** One spell up and down again (s): its share of this is spent at the top. */
export const CRUISE_CYCLE = 420;
/** Rising to the top and going down again (s). */
export const CRUISE_EASE = 25;
/** How far under the surface a cruiser's top still counts as at it for its wake (m; past the row's deepest). */
export const CRUISE_SHALLOW = 0.35;

export type CruiseSpec = {share: number; depth: [number, number]; quote: string};

export function surfaceCruiseSpec(slug: string | null | undefined): CruiseSpec | null {
    const row = slug ? ROWS[slug] : undefined;
    return row ? {share: row.share, depth: row.depth, quote: row.quote[0]} : null;
}

export function surfaceCruiseKinds(): string[] {
    return Object.keys(ROWS);
}

const smooth = (t: number) => {
    const u = Math.min(Math.max(t, 0), 1);
    return u * u * (3 - 2 * u);
};

/**
 * At `seconds` (epoch): how far up into its cruise it is (`k`, 0 in its band … 1 at the top) and how deep its highest point rides
 * there (m under the surface). `k` 0 for a kind without a row.
 */
export function surfaceCruiseAt(id: string, slug: string, seconds: number): {k: number; depth: number} {
    const spec = surfaceCruiseSpec(slug);
    if (!spec) return {k: 0, depth: 0};
    const offset = (hash32(`cruise#${id}`) / 4294967296) * CRUISE_CYCLE;
    const into = ((((seconds - offset) % CRUISE_CYCLE) + CRUISE_CYCLE) % CRUISE_CYCLE);
    const up = spec.share * CRUISE_CYCLE;
    const k = into < up ? Math.min(smooth(into / CRUISE_EASE), smooth((up - into) / CRUISE_EASE)) : 0;
    // Its back wanders between the row's depths (a 50 s swell of its own).
    const w = 0.5 + 0.5 * Math.sin((seconds / 50) * Math.PI * 2 + (hash32(`cruise-depth#${id}`) % 1000) / 159);
    return {k, depth: spec.depth[0] + (spec.depth[1] - spec.depth[0]) * w};
}
