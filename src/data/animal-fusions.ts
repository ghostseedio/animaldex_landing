import snapshot from "@/data/published-animal-fusions.json";
import {buildAnimalFusionSlug} from "@/lib/animal-fusion-slug";

export {buildAnimalFusionSlug, parseAnimalFusionSlug} from "@/lib/animal-fusion-slug";

/**
 * AnimalDex Principle Fusion at species level: the receiver animal keeps its
 * own power and learns one narrow sub-principle from the donor animal. It is
 * the app's fusion recipe (species_principle_fusion_recipes) without captures,
 * cost or stat changes. Pairs are asymmetric: a + b and b + a differ.
 *
 * Fusions are part of the Animal Hybrid Lab and share its URL space
 * (`/animal-hybrids/<receiver>-learns-from-<donor>`). Published pairs and the
 * fusable species list come from the build-time snapshot
 * (`npm run refresh:animal-fusions`); pairs fused since then are read from the
 * DB at request time and stay noindex until the next refresh.
 */

export const FUSION_STATS = ["speed", "intelligence", "rarity", "dominance", "size"] as const;
export type FusionStat = typeof FUSION_STATS[number];

export type FusableSpecies = {
    slug: string;
    name: string;
    speciesProfileId: string;
    principle: string;
};

export type AnimalFusionEntry = {
    slug: string;
    receiverSlug: string;
    donorSlug: string;
    receiverPrinciple: string;
    donorPrinciple: string;
    /** The learned sub-principle, max 3 words. */
    name: string;
    expression: string;
    scenarioTags: string[];
    primaryStat: FusionStat | null;
    secondaryStat: FusionStat | null;
    boostPrimary: number;
    boostSecondary: number;
    updatedAt: string;
};

type FusionSnapshot = {
    generatedAt: string;
    species: Record<string, {id: string; name: string; principle: string}>;
    fusions: AnimalFusionEntry[];
};

const fusionSnapshot = snapshot as unknown as FusionSnapshot;

export const publishedAnimalFusions: AnimalFusionEntry[] = fusionSnapshot.fusions;
const publishedFusionsBySlug = new Map(publishedAnimalFusions.map((entry) => [entry.slug, entry]));

export function getFusableSpecies(slug: string): FusableSpecies | null {
    const row = fusionSnapshot.species[slug];
    return row ? {slug, name: row.name, speciesProfileId: row.id, principle: row.principle} : null;
}

export function getPublishedAnimalFusion(slug: string) {
    return publishedFusionsBySlug.get(slug) ?? null;
}

/** Other published fusions sharing an animal, receiver matches first. */
/** Published fusions between two animals, either direction. */
export function getAnimalFusionsForPair(firstSlug: string, secondSlug: string) {
    return publishedAnimalFusions.filter((entry) => (entry.receiverSlug === firstSlug && entry.donorSlug === secondSlug)
        || (entry.receiverSlug === secondSlug && entry.donorSlug === firstSlug));
}

export function getRelatedAnimalFusions(entry: AnimalFusionEntry, limit = 6) {
    const sameReceiver = publishedAnimalFusions.filter((item) => item.slug !== entry.slug && item.receiverSlug === entry.receiverSlug);
    const sharesAnimal = publishedAnimalFusions.filter((item) => item.slug !== entry.slug
        && item.receiverSlug !== entry.receiverSlug
        && [item.receiverSlug, item.donorSlug].some((slug) => slug === entry.receiverSlug || slug === entry.donorSlug));
    return [...sameReceiver, ...sharesAnimal].slice(0, limit);
}

function normalizeQuery(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Name search over fusable species: whole-name prefix, then word prefix, then substring. */
export function searchFusableSpecies(query: string, limit = 8): FusableSpecies[] {
    const needle = normalizeQuery(query);
    if (!needle) {
        return [];
    }

    const ranked: Array<{species: FusableSpecies; rank: number}> = [];
    for (const [slug, row] of Object.entries(fusionSnapshot.species)) {
        const name = normalizeQuery(row.name);
        const rank = name.startsWith(needle) ? 0
            : ` ${name}`.includes(` ${needle}`) ? 1
                : name.includes(needle) ? 2
                    : -1;
        if (rank >= 0) {
            ranked.push({species: {slug, name: row.name, speciesProfileId: row.id, principle: row.principle}, rank});
        }
    }

    return ranked
        .sort((left, right) => left.rank - right.rank || left.species.name.length - right.species.name.length || left.species.name.localeCompare(right.species.name))
        .slice(0, limit)
        .map((item) => item.species);
}

export function formatFusionStat(stat: FusionStat) {
    return stat.charAt(0).toUpperCase() + stat.slice(1);
}
