/**
 * The home page's food chain as a picture (owner, 2026-11-16: "too complex and too much text for a landing page, not
 * visual at all"): a few short chains of three animals aboard, biggest eater first, "eats" between them. Pure: picked
 * from the food chain's own entries (`lib/ark-food-chain`, stored food links between the animals aboard), so every
 * arrow is a real link. The whole explorer (diet phrases, every predator and prey) stays on /ark/food-chain.
 */

import type {ArkFoodChainEntry, ArkFoodChainSpecies} from "@/lib/ark-food-chain";

const byNumbers = (list: readonly ArkFoodChainSpecies[]) => [...list].sort((a, b) => b.aboard - a.aboard || a.name.localeCompare(b.name));

/** The animals the chains may show: each entry's species and its `each` most numerous prey and predators (their slugs). */
export function homeFoodChainCandidates(entries: readonly ArkFoodChainEntry[], each = 4): string[] {
    const slugs = new Set<string>();
    for (const entry of entries) {
        slugs.add(entry.species.slug);
        for (const s of byNumbers(entry.eats.flatMap((rule) => rule.prey)).slice(0, each)) slugs.add(s.slug);
        for (const s of byNumbers(entry.eatenBy.map((link) => link.predator)).slice(0, each)) slugs.add(s.slug);
    }
    return Array.from(slugs);
}

/** One chain, eater first: each animal eats the next. Two long when its middle has no predator aboard. */
export type HomeFoodChain = ArkFoodChainSpecies[];

/**
 * Up to `limit` chains from the entries, in their order: the species' most numerous predator aboard, the species, its
 * most numerous prey aboard. No animal is shown twice across the chains while there is a choice; three-long chains
 * come before two-long ones. `shown`: only animals the picture can draw (the page passes those whose icon art exists).
 */
export function homeFoodChains(entries: readonly ArkFoodChainEntry[], limit = 3, shown: (species: ArkFoodChainSpecies) => boolean = () => true): HomeFoodChain[] {
    const used = new Set<string>();
    const fresh = (list: ArkFoodChainSpecies[]) => byNumbers(list).find((s) => !used.has(s.id) && shown(s)) ?? null;
    const chains: Array<{chain: HomeFoodChain; long: boolean}> = [];
    for (const entry of entries) {
        if (used.has(entry.species.id) || !shown(entry.species)) continue;
        const prey = fresh(entry.eats.flatMap((rule) => rule.prey).filter((s) => s.id !== entry.species.id));
        if (!prey) continue;
        const predator = fresh(entry.eatenBy.map((link) => link.predator).filter((s) => s.id !== entry.species.id && s.id !== prey.id));
        const chain = predator ? [predator, entry.species, prey] : [entry.species, prey];
        for (const s of chain) used.add(s.id);
        chains.push({chain, long: Boolean(predator)});
    }
    return chains.sort((a, b) => Number(b.long) - Number(a.long)).slice(0, limit).map((c) => c.chain);
}
