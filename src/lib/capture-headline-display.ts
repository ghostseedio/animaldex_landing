import {getSpeciesBySlug} from "@/data/species";
import {
    identityKeyToSlug,
    resolveCanonicalIdentityKey,
    resolveCaptureVariantDisplay
} from "@/lib/species-life-stage-policy";
import {sanitizedIdentityDisplayLabel} from "@/lib/taxonomic-identity-labels";

type CaptureHeadlineInput = {
    animalName?: string | null;
    scientificName?: string | null;
    breedGuess?: string | null;
    refinedIdentity?: string | null;
    breedConfidence?: number | null;
    confidence?: number | null;
    normalizedIdentityKey?: string | null;
    lifeStage?: string | null;
    humanContext?: string | null;
    zooOrWild?: string | null;
    premiumDetails?: Record<string, unknown> | null;
    canonicalDisplayName?: string | null;
};

export type CaptureHeadlineDisplay = {
    animalName: string;
    headlineSupportingName: string | null;
    lifeStageChip: string | null;
    sameSpeciesHelper: string | null;
};

const WEAK_REFINED_WORDS = new Set([
    "animal", "species", "type", "unknown", "domestic", "wild", "pet", "farm", "zoo"
]);

function clean(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

/** Identity-bearing names additionally get taxon-prose sanitization. */
function cleanIdentityName(value: string | null | undefined) {
    return sanitizedIdentityDisplayLabel(value);
}

function clampConfidence(value: number | null | undefined) {
    if (value == null || !Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

function normalizedTokens(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .filter(Boolean);
}

function isMeaningfullyMoreSpecific(candidate: string, animalName: string) {
    const candidateTokens = normalizedTokens(candidate);
    const animalTokens = normalizedTokens(animalName);
    if (!candidateTokens.length || !animalTokens.length) return true;
    if (candidateTokens.join(" ") === animalTokens.join(" ")) return false;

    const reducedCandidate = candidateTokens.filter((token) => !WEAK_REFINED_WORDS.has(token));
    const reducedAnimal = animalTokens.filter((token) => !WEAK_REFINED_WORDS.has(token));
    if (!reducedCandidate.length || !reducedAnimal.length) return true;
    return reducedCandidate.join(" ") !== reducedAnimal.join(" ");
}

function isSameIdentity(candidate: string, other: string | null | undefined) {
    if (!other) return false;
    const left = normalizedTokens(candidate);
    const right = normalizedTokens(other);
    return left.length > 0 && left.join(" ") === right.join(" ");
}

function isDomesticBreedContext(input: CaptureHeadlineInput) {
    const humanContext = clean(input.humanContext)?.toLowerCase();
    const zooOrWild = clean(input.zooOrWild)?.toLowerCase();
    return humanContext === "pet"
        || humanContext === "livestock"
        || zooOrWild === "domestic"
        || zooOrWild === "farm";
}

function refinedIdentityDisplayThreshold(input: CaptureHeadlineInput) {
    return isDomesticBreedContext(input) ? 0.42 : 0.58;
}

function refinedIdentityDisplayConfidence(input: CaptureHeadlineInput) {
    const breedConfidence = input.breedConfidence;
    if (breedConfidence != null && Number.isFinite(breedConfidence)) {
        return clampConfidence(breedConfidence);
    }
    return clampConfidence(input.confidence);
}

const NON_SCIENTIFIC_BINOMIAL_LEADING_TOKENS = new Set([
    "african", "american", "asian", "australian", "black", "blue", "british", "brown",
    "calico", "common", "crested", "dark", "domestic", "eastern", "european", "giant",
    "golden", "gray", "grey", "green", "hooded", "indian", "japanese", "juvenile",
    "lesser", "light", "little", "long", "masked", "mottled", "northern", "orange",
    "oriental", "pied", "pink", "purple", "red", "rough", "rusty", "short", "siamese",
    "silver", "smooth", "southern", "spotted", "striped", "western", "white", "yellow"
]);

const SPECIES_COMMON_NAME_HEAD_TOKENS = new Set([
    "fantail", "finch", "sparrow", "swallow", "martin", "thrush", "warbler", "robin",
    "pigeon", "dove", "crow", "raven", "magpie", "starling", "owl", "hawk", "eagle",
    "heron", "parrot", "duck", "goose", "swan", "bird"
]);

function displayNameFromCatalogToken(token: string) {
    return token
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
}

function isScientificCatalogToken(token: string) {
    const parts = token.toLowerCase().split("_").filter(Boolean);
    // Binomial or trinomial scientific keys (e.g. panthera_leo, columba_livia_domestica).
    if (parts.length !== 2 && parts.length !== 3) return false;
    if (!parts.every((part) => part.length >= 3 && /^[a-z]+$/.test(part))) return false;
    if (NON_SCIENTIFIC_BINOMIAL_LEADING_TOKENS.has(parts[0])) return false;
    if (parts.some((part) => SPECIES_COMMON_NAME_HEAD_TOKENS.has(part))) return false;
    return true;
}

function isBroadCollectionIdentityToken(token: string) {
    const normalized = token.toLowerCase();
    return normalized === "animal"
        || normalized === "unknown_animal"
        || normalized === "unknown"
        || normalized.endsWith("_animal");
}

function premiumReviewedIdentityGuess(input: CaptureHeadlineInput) {
    const premium = input.premiumDetails;
    if (!premium || typeof premium !== "object") return null;

    const reviewedIdentity = clean(
        typeof premium.reviewed_identity === "string"
            ? premium.reviewed_identity
            : typeof premium.reviewedIdentity === "string"
                ? premium.reviewedIdentity
                : null
    );
    if (!reviewedIdentity) return null;

    const reviewedScientificName = clean(
        typeof premium.reviewed_scientific_name === "string"
            ? premium.reviewed_scientific_name
            : typeof premium.reviewedScientificName === "string"
                ? premium.reviewedScientificName
                : input.scientificName
    );
    if (isSameIdentity(reviewedIdentity, reviewedScientificName)) return null;

    const reviewedConfidence = Number(
        premium.reviewed_identity_confidence
        ?? premium.reviewedIdentityConfidence
        ?? input.confidence
    );
    const threshold = refinedIdentityDisplayThreshold(input);
    if (!Number.isFinite(reviewedConfidence) || reviewedConfidence < threshold) return null;

    const animalName = clean(input.animalName) ?? "";
    if (!isMeaningfullyMoreSpecific(reviewedIdentity, animalName)) return null;
    return reviewedIdentity;
}

function refinedIdentityGuess(input: CaptureHeadlineInput) {
    const breed = cleanIdentityName(input.refinedIdentity) ?? cleanIdentityName(input.breedGuess);
    if (!breed) return null;
    if (isSameIdentity(breed, input.scientificName)) return null;
    if (refinedIdentityDisplayConfidence(input) < refinedIdentityDisplayThreshold(input)) return null;

    const animalName = clean(input.animalName) ?? "";
    // Match iOS: same common name as animal_name is still a valid refined headline.
    if (isSameIdentity(breed, animalName)) return breed;
    if (!isMeaningfullyMoreSpecific(breed, animalName)) return null;
    return breed;
}

function canonicalIdentityGuess(input: CaptureHeadlineInput) {
    const token = clean(input.normalizedIdentityKey)?.toLowerCase();
    if (!token || isBroadCollectionIdentityToken(token) || isScientificCatalogToken(token)) return null;

    const displayName = displayNameFromCatalogToken(token);
    const animalName = clean(input.animalName) ?? "";
    if (!isMeaningfullyMoreSpecific(displayName, animalName)) return null;
    return displayName;
}

function preferredDisplayIdentityGuess(input: CaptureHeadlineInput) {
    return premiumReviewedIdentityGuess(input)
        ?? refinedIdentityGuess(input)
        ?? canonicalIdentityGuess(input);
}

function shouldShowUncertaintyFallback(input: CaptureHeadlineInput) {
    const animalName = clean(input.animalName)?.toLowerCase();
    if (animalName === "unknown animal") return true;
    return clampConfidence(input.confidence) < 0.4;
}

function withConfidencePrefix(name: string, confidence: number | null | undefined) {
    void confidence;
    return name;
}

function displayBroadAnimalName(input: CaptureHeadlineInput) {
    const animalName = cleanIdentityName(input.animalName) ?? "Animal";
    return withConfidencePrefix(animalName, input.confidence);
}

function displayHeadlineTitle(input: CaptureHeadlineInput) {
    if (shouldShowUncertaintyFallback(input)) {
        return "Uncertain animal";
    }

    const baseName = cleanIdentityName(preferredDisplayIdentityGuess(input))
        ?? cleanIdentityName(input.animalName)
        ?? "Animal";
    return withConfidencePrefix(baseName, input.confidence);
}

function resolveCanonicalDisplayName(input: CaptureHeadlineInput) {
    if (clean(input.canonicalDisplayName)) {
        return clean(input.canonicalDisplayName);
    }

    const canonicalKey = resolveCanonicalIdentityKey(input.normalizedIdentityKey);
    if (!canonicalKey) return null;

    const slug = identityKeyToSlug(canonicalKey);
    return getSpeciesBySlug(slug)?.name ?? displayNameFromCatalogToken(canonicalKey);
}

export function resolveCaptureHeadlineDisplay(input: CaptureHeadlineInput): CaptureHeadlineDisplay {
    const canonicalName = resolveCanonicalDisplayName(input);
    const variant = resolveCaptureVariantDisplay({
        animalName: clean(input.animalName) ?? "Animal",
        lifeStage: input.lifeStage,
        normalizedIdentityKey: input.normalizedIdentityKey,
        canonicalSpecies: canonicalName
            ? {
                name: canonicalName,
                slug: identityKeyToSlug(resolveCanonicalIdentityKey(input.normalizedIdentityKey) ?? "")
            }
            : null
    });

    if (variant.isStageVariant) {
        return {
            animalName: withConfidencePrefix(variant.title, input.confidence),
            headlineSupportingName: variant.countsAsLine,
            lifeStageChip: variant.lifeStageChip,
            sameSpeciesHelper: variant.sameSpeciesHelper
        };
    }

    const animalName = displayHeadlineTitle(input);
    const preferred = preferredDisplayIdentityGuess(input);
    // Match iOS showsSpeciesUnderHeadline: only show broad name when preferred differs.
    const headlineSupportingName = preferred && !isSameIdentity(preferred, input.animalName)
        ? displayBroadAnimalName(input)
        : null;

    return {
        animalName,
        headlineSupportingName,
        lifeStageChip: variant.lifeStageChip,
        sameSpeciesHelper: null
    };
}

export function resolveChallengeAnalysisHeadlineDisplay(row: Record<string, unknown>, prefix: "attacker" | "defender"): CaptureHeadlineDisplay {
    const readField = (key: string) => {
        const value = row[key];
        return typeof value === "string" ? value : null;
    };
    const premiumDetails = row[`${prefix}_premium_details`];

    return resolveCaptureHeadlineDisplay({
        animalName: readField(`${prefix}_animal_name`),
        scientificName: readField(`${prefix}_scientific_name`),
        breedGuess: readField(`${prefix}_breed_guess`),
        breedConfidence: Number(row[`${prefix}_breed_confidence`]),
        confidence: Number(row[`${prefix}_confidence`]),
        humanContext: readField(`${prefix}_human_context`),
        zooOrWild: readField(`${prefix}_zoo_or_wild`),
        premiumDetails: premiumDetails && typeof premiumDetails === "object" && !Array.isArray(premiumDetails)
            ? premiumDetails as Record<string, unknown>
            : null
    });
}
