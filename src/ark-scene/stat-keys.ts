/**
 * The five Ark stats' names and shape: the light half of `stats.ts` (no species table), so the snapshot's decoder can
 * read an animal's stats without the 175 KB catalogue reaching the page's first JavaScript (decision 246).
 */

export type ArkStats = {size: number; speed: number; dominance: number; rarity: number; intelligence: number};
export const ARK_STAT_KEYS = ["size", "speed", "dominance", "rarity", "intelligence"] as const;
