import {getBattleTier, resolveSpeciesStats} from "@/data/species-stats";
import type {SourceSpecies, StatCard} from "@/lib/content-video/plan";

/**
 * A species' stat card from its real game stats (the catalog or its species
 * profile). Generated placeholder stats are never shown: null instead.
 */
export async function statCardFor(slug: string, name: string): Promise<StatCard | null> {
    try {
        const resolved = await resolveSpeciesStats(slug);
        if (!resolved.stats || resolved.statsSource === "generated" || resolved.statsSource === "none") return null;
        const stats = resolved.stats;
        return {name, tier: getBattleTier(stats), stats: {dominance: stats.dominance, speed: stats.speed, size: stats.size, intelligence: stats.intelligence, rarity: stats.rarity}};
    } catch {
        return null;
    }
}

/** The species of a source that have real stats, each tied to its image (if any). */
export async function sourceSpecies(entries: Array<{slug: string; name: string; image: number | null}>): Promise<SourceSpecies[]> {
    const unique = Array.from(new Map(entries.map((entry) => [entry.slug, entry])).values());
    const cards = await Promise.all(unique.map((entry) => statCardFor(entry.slug, entry.name)));
    return unique.flatMap((entry, index) => (cards[index] ? [{...entry, card: cards[index]!}] : []));
}
