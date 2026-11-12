import "server-only";
import {readArkEventsWindow} from "@/data/ark-events-window";
import type {ArkFoodChainAboard} from "@/lib/ark-food-chain";
import {arkSpeciesTrends, type ArkSpeciesTrend, type ArkTrendWindow} from "@/lib/ark-species-trend";

/**
 * Every species' changes over the last week, from the shared event-log read
 * (`readArkEventsWindow`), worked out once per read and per snapshot, so each
 * species page only looks its own row up.
 */

const memo = new WeakMap<ArkTrendWindow, WeakMap<ArkFoodChainAboard, Map<string, ArkSpeciesTrend>>>();

export type ArkTrendsRead = {since: string; trends: Map<string, ArkSpeciesTrend>};

export async function readArkSpeciesTrends(aboard: ArkFoodChainAboard, days = 7, revalidate = 86_400): Promise<ArkTrendsRead | null> {
    const window = await readArkEventsWindow(days, revalidate);
    if (!window || !window.complete) return null;
    let byAboard = memo.get(window);
    if (!byAboard) {
        byAboard = new WeakMap();
        memo.set(window, byAboard);
    }
    let trends = byAboard.get(aboard);
    if (!trends) {
        trends = arkSpeciesTrends(window.events, (look) => aboard.kindOf.get(look.toLowerCase()) ?? null);
        byAboard.set(aboard, trends);
    }
    return {since: window.since, trends};
}
