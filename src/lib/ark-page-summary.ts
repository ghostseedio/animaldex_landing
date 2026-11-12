/**
 * What /ark hands its client before the Ark is read (decision 246): the counts and the two islands' sizes, a few
 * hundred bytes, so the first paint has the population chip and the island switch at their real sizes with no shift.
 * The Ark itself (every animal, thousands of them, the visitor's own marked `mine`) is read by the client after the
 * first paint from `/api/ark/voyage`, never passed as props (that was 4 MB of inline payload on every load).
 */

import type {ArkIslandCounts, ArkSnapshot} from "@/ark-scene/types";
import {arkIslandCounts, arkTwoIslands} from "@/lib/ark-islands";

export type ArkPageSummary = {counts: ArkSnapshot["counts"]; islands: ArkIslandCounts | null};

export function arkPageSummary(snapshot: ArkSnapshot | null | undefined): ArkPageSummary | null {
    if (!snapshot) return null;
    return {counts: {...snapshot.counts}, islands: arkTwoIslands(snapshot) ? arkIslandCounts(snapshot) : null};
}
