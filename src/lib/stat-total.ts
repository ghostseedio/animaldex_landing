/**
 * The card's stat Total is dominance + speed + size + intelligence.
 *
 * Rarity is a fact about the species, not a skill: it is drawn on the chart and listed in the legend,
 * but it is never part of the Total and is never shown with a "%" (owner decision 388).
 */
export const TOTAL_STAT_KEYS = ["dominance", "speed", "size", "intelligence"] as const;

export function countsTowardStatTotal(key: string): boolean {
    return key !== "rarity";
}

export function statTotal(stats: {dominance: number; speed: number; size: number; intelligence: number; rarity?: number}): number {
    return TOTAL_STAT_KEYS.reduce((sum, key) => sum + stats[key], 0);
}
