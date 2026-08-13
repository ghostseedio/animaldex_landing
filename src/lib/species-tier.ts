import type {SpeciesEntry} from "@/data/species";
import {buildDeterministicCanonicalStats} from "@/data/species-stats";
import {getBattleTier, type AnimalBattleTier, type SpeciesStats} from "@/lib/battle-tier";

const STAT_KEYS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;

function readCanonicalStats(entry: SpeciesEntry): SpeciesStats | null {
    const rawStats = entry.databaseSource?.canonicalGameStats;

    if (!rawStats) {
        return null;
    }

    const stats = {} as SpeciesStats;

    for (const key of STAT_KEYS) {
        const value = Number(rawStats[key]);

        if (!Number.isFinite(value)) {
            return null;
        }

        stats[key] = value;
    }

    return stats;
}

/**
 * Battle tier for a resolved species entry.
 *
 * Prefers the catalog's canonical stats so the tier matches what the species page and
 * the arena show. Entries resolved from the local species file alone have no canonical
 * stats, so those fall back to the same deterministic stats the species page uses.
 */
export function getSpeciesTier(entry: SpeciesEntry): AnimalBattleTier {
    return getBattleTier(readCanonicalStats(entry) ?? buildDeterministicCanonicalStats(entry));
}
