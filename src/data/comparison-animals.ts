import "server-only";

import {getResolvedSpeciesBySlug} from "@/data/database-species-pages";
import {getSpeciesBySlug, speciesEntries, type SpeciesEntry} from "@/data/species";
import {buildSpeciesArtworkSrc} from "@/data/species-artwork-index";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";

/** Lightweight species shape used by the public comparison builder. */
export type ComparableAnimal = {
    slug: string;
    name: string;
    category: string;
    scientificName: string;
    animalDexNumber: number | null;
    artworkUrl: string;
};

type ComparisonAnimalIndex = {
    animals: ComparableAnimal[];
    bySlug: Map<string, ComparableAnimal>;
    expiresAt: number;
};

const INDEX_TTL_MS = 10 * 60 * 1000;
const MAX_SEARCH_RESULTS = 24;

/**
 * Recognisable openers so the picker (and the crawlable markup behind it) starts
 * on animals people actually search for. Missing slugs are skipped silently.
 */
const STARTER_SLUGS = [
    "lion",
    "tiger",
    "grizzly-bear",
    "gorilla",
    "great-white-shark",
    "saltwater-crocodile",
    "african-elephant",
    "gray-wolf",
    "hippopotamus",
    "polar-bear",
    "king-cobra",
    "komodo-dragon",
    "cheetah",
    "jaguar",
    "leopard",
    "bald-eagle",
    "orca",
    "rhinoceros",
    "hyena",
    "anaconda"
];

let indexCache: ComparisonAnimalIndex | null = null;

function toComparableAnimal(
    entry: SpeciesEntry,
    artworkFile: string | null
): ComparableAnimal {
    return {
        slug: entry.slug,
        name: entry.name,
        category: entry.analysis.category,
        scientificName: entry.analysis.scientificName,
        animalDexNumber: getAnimalDexNumberFromEntry(entry),
        artworkUrl: buildSpeciesArtworkSrc(entry.slug, artworkFile)
    };
}

function getIndex(): ComparisonAnimalIndex {
    if (indexCache && indexCache.expiresAt > Date.now()) return indexCache;

    const animals = speciesEntries
        .filter((entry) => Boolean(entry.slug && entry.name))
        .map((entry) => toComparableAnimal(entry, null));

    indexCache = {
        animals,
        bySlug: new Map(animals.map((animal) => [animal.slug, animal])),
        expiresAt: Date.now() + INDEX_TTL_MS
    };

    return indexCache;
}

export async function countComparableAnimals() {
    return getIndex().animals.length;
}

export async function findComparableAnimal(slug: string): Promise<ComparableAnimal | null> {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) return null;

    const localEntry = getSpeciesBySlug(normalized);
    if (localEntry?.slug && localEntry.name) {
        return toComparableAnimal(localEntry, null);
    }

    const entry = await getResolvedSpeciesBySlug(normalized);
    if (!entry?.slug || !entry.name) return null;

    return toComparableAnimal(entry, null);
}

export async function isComparableAnimalSlug(slug: string) {
    return Boolean(await findComparableAnimal(slug));
}

function scoreAnimal(animal: ComparableAnimal, query: string) {
    const name = animal.name.toLowerCase();
    const scientificName = animal.scientificName.toLowerCase();
    const slug = animal.slug.replace(/-/g, " ");

    if (name === query) return 100;
    if (name.startsWith(query)) return 90;
    if (slug.startsWith(query)) return 80;
    if (name.includes(query)) return 70;
    if (slug.includes(query)) return 55;
    if (scientificName.startsWith(query)) return 45;
    if (scientificName.includes(query)) return 30;
    if (animal.category.toLowerCase().includes(query)) return 15;
    return 0;
}

export async function searchComparableAnimals(query: string, limit = 10): Promise<ComparableAnimal[]> {
    const normalized = query.trim().toLowerCase();
    const capped = Math.max(1, Math.min(MAX_SEARCH_RESULTS, limit));
    if (!normalized) return getStarterComparableAnimals(capped);

    const {animals} = getIndex();
    const scored: Array<{animal: ComparableAnimal; score: number}> = [];

    for (const animal of animals) {
        const score = scoreAnimal(animal, normalized);
        if (score > 0) scored.push({animal, score});
    }

    return scored
        .sort((left, right) => right.score - left.score || left.animal.name.localeCompare(right.animal.name))
        .slice(0, capped)
        .map((item) => item.animal);
}

export async function getStarterComparableAnimals(limit = 12): Promise<ComparableAnimal[]> {
    const {animals, bySlug} = getIndex();
    const picked: ComparableAnimal[] = [];
    const seen = new Set<string>();

    for (const slug of STARTER_SLUGS) {
        const animal = bySlug.get(slug);
        if (!animal || seen.has(animal.slug)) continue;
        picked.push(animal);
        seen.add(animal.slug);
        if (picked.length >= limit) return picked;
    }

    // Top up with the lowest AnimalDex numbers so the picker is never empty.
    const numbered = animals
        .filter((animal) => animal.animalDexNumber != null && !seen.has(animal.slug))
        .sort((left, right) => (left.animalDexNumber ?? 0) - (right.animalDexNumber ?? 0));

    for (const animal of numbered) {
        picked.push(animal);
        if (picked.length >= limit) break;
    }

    return picked;
}
