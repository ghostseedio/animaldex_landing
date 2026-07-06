import {getSpeciesBySlug} from "@/data/species";

const GENERIC_ANIMAL_LABELS = new Set([
    "animal",
    "bird",
    "cat",
    "dog",
    "fish",
    "horse",
    "insect",
    "mammal",
    "reptile",
    "snake",
    "spider",
    "rabbit",
    "rodent",
    "lizard",
    "turtle",
    "tortoise",
    "frog",
    "toad",
    "duck",
    "chicken",
    "cow",
    "pig",
    "sheep",
    "goat",
    "deer",
    "bear",
    "wolf",
    "fox",
    "lion",
    "tiger",
    "eagle",
    "hawk",
    "owl",
    "parrot",
    "pigeon",
    "crow",
    "rat",
    "mouse",
    "pet",
    "puppy",
    "kitten"
]);

export type CaptureDisplayNameInput = {
    animalName?: string | null;
    breedGuess?: string | null;
    captureTitle?: string | null;
    normalizedIdentityKey?: string | null;
    speciesSlug?: string | null;
    scientificName?: string | null;
};

function clean(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function toSpeciesSlug(identity: string | null | undefined) {
    const cleaned = clean(identity);
    if (!cleaned) return null;
    return cleaned.replace(/_/g, "-").toLowerCase();
}

function wordCount(value: string) {
    return value.split(/\s+/).filter(Boolean).length;
}

export function isGenericAnimalLabel(name: string | null | undefined) {
    const cleaned = clean(name);
    if (!cleaned) return true;

    const normalized = cleaned.toLowerCase();
    if (GENERIC_ANIMAL_LABELS.has(normalized)) return true;

    // Truncated breed fragments like "paint" for American Paint Horse.
    if (!normalized.includes(" ") && normalized.length <= 6) {
        return true;
    }

    return false;
}

function isMoreSpecific(candidate: string, baseline: string | null) {
    if (!baseline) return true;
    if (candidate.length > baseline.length + 2) return true;
    return wordCount(candidate) > wordCount(baseline);
}

export function resolveCaptureDisplayName(input: CaptureDisplayNameInput) {
    const animalName = clean(input.animalName);
    const breedGuess = clean(input.breedGuess);
    const captureTitle = clean(input.captureTitle);
    const slug = clean(input.speciesSlug) ?? toSpeciesSlug(input.normalizedIdentityKey);
    const species = slug ? getSpeciesBySlug(slug) : null;
    const speciesName = species?.name ?? null;
    const identityKind = species?.databaseSource?.identityKind?.toLowerCase() ?? null;

    if (captureTitle && captureTitle.toLowerCase() !== animalName?.toLowerCase()) {
        return captureTitle;
    }

    if (breedGuess) {
        if (isGenericAnimalLabel(animalName)) return breedGuess;
        if (identityKind === "breed") return breedGuess;
        if (isMoreSpecific(breedGuess, animalName)) return breedGuess;
    }

    if (speciesName) {
        if (isGenericAnimalLabel(animalName)) return speciesName;
        if (isMoreSpecific(speciesName, animalName)) return speciesName;
    }

    if (animalName && !isGenericAnimalLabel(animalName)) {
        return animalName;
    }

    return breedGuess ?? speciesName ?? animalName ?? clean(input.scientificName) ?? "Animal";
}
