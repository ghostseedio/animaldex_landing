import type {SpeciesEntry} from "@/data/species";
import {collectionIdentityMatchKeys} from "@/lib/collection-identity-aliases";

const BREED_CATEGORY_MARKERS = ["domestic breed", "domestic dog", "domestic cat"];

const GENERIC_DOMESTIC_SLUGS = new Set([
    "cat",
    "dog",
    "domestic-cat",
    "domestic-dog"
]);

const SHARED_DOMESTIC_SCIENTIFIC_PREFIXES = [
    "canis lupus familiaris",
    "felis catus"
];

export type SpeciesCaptureMatchRow = {
    species_profile_id?: string | null;
    normalized_identity_key?: string | null;
    breed_guess?: string | null;
    animal_name?: string | null;
};

function normalizeIdentityToken(value: string) {
    return value.trim().toLowerCase().replace(/-/g, "_");
}

export function isBreedSpeciesEntry(
    entry: Pick<SpeciesEntry, "slug" | "name" | "analysis" | "databaseSource">
) {
    const identityKind = entry.databaseSource?.identityKind?.toLowerCase();

    if (identityKind === "breed") {
        return true;
    }

    const category = entry.analysis.category.trim().toLowerCase();

    if (BREED_CATEGORY_MARKERS.includes(category) || category.includes("breed")) {
        return true;
    }

    if (GENERIC_DOMESTIC_SLUGS.has(entry.slug)) {
        return false;
    }

    const scientificName = entry.analysis.scientificName.trim().toLowerCase();

    return SHARED_DOMESTIC_SCIENTIFIC_PREFIXES.some((prefix) =>
        scientificName === prefix || scientificName.startsWith(`${prefix} (`)
    );
}

export function buildSpeciesCaptureMatchCandidates(entry: SpeciesEntry) {
    const seen = new Set<string>();
    const candidates: {column: string; value: string}[] = [];
    const isBreed = isBreedSpeciesEntry(entry);

    const push = (column: string, value: string | null | undefined) => {
        const trimmed = value?.trim();

        if (!trimmed) {
            return;
        }

        const key = `${column}:${trimmed}`;

        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        candidates.push({column, value: trimmed});
    };

    push("species_profile_id", entry.speciesProfileId);
    push("normalized_identity_key", entry.normalizedIdentityKey ?? entry.slug);

    for (const aliasKey of collectionIdentityMatchKeys(entry.normalizedIdentityKey ?? entry.slug.replace(/-/g, "_"))) {
        push("normalized_identity_key", aliasKey);
    }

    if (entry.slug.includes("-")) {
        push("normalized_identity_key", entry.slug.replaceAll("-", "_"));
    }

    if (isBreed) {
        push("breed_guess", entry.name);
    } else {
        push("scientific_name", entry.analysis.scientificName);
    }

    push("animal_name", entry.name);

    return candidates;
}

export function captureMatchesSpeciesEntry(entry: SpeciesEntry, row: SpeciesCaptureMatchRow) {
    if (!isBreedSpeciesEntry(entry)) {
        return true;
    }

    if (entry.speciesProfileId && row.species_profile_id === entry.speciesProfileId) {
        return true;
    }

    const entryKeys = new Set([
        normalizeIdentityToken(entry.slug),
        normalizeIdentityToken(entry.normalizedIdentityKey ?? entry.slug)
    ]);
    const rowIdentity = row.normalized_identity_key?.trim();

    if (rowIdentity && entryKeys.has(normalizeIdentityToken(rowIdentity))) {
        return true;
    }

    const entryName = entry.name.trim().toLowerCase();
    const breedGuess = row.breed_guess?.trim().toLowerCase();
    const animalName = row.animal_name?.trim().toLowerCase();

    return breedGuess === entryName || animalName === entryName;
}

export function speciesDisplayCategory(entry: SpeciesEntry) {
    if (isBreedSpeciesEntry(entry)) {
        const category = entry.analysis.category.trim();

        if (category && !category.toLowerCase().includes("breed")) {
            return `${category} · Breed`;
        }

        return "Breed";
    }

    return entry.analysis.category;
}
