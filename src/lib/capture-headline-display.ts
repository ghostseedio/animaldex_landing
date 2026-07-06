type CaptureHeadlineInput = {
    animalName?: string | null;
    scientificName?: string | null;
    breedGuess?: string | null;
    breedConfidence?: number | null;
    confidence?: number | null;
    normalizedIdentityKey?: string | null;
    humanContext?: string | null;
    zooOrWild?: string | null;
    premiumDetails?: Record<string, unknown> | null;
};

export type CaptureHeadlineDisplay = {
    animalName: string;
    headlineSupportingName: string | null;
};

const WEAK_REFINED_WORDS = new Set([
    "animal", "species", "type", "unknown", "domestic", "wild", "pet", "farm", "zoo"
]);

function clean(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function clampConfidence(value: number | null | undefined) {
    if (value == null || !Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

function confidenceTier(confidence: number | null | undefined) {
    const value = clampConfidence(confidence);
    if (value >= 0.75) return "high" as const;
    if (value >= 0.5) return "medium" as const;
    return "low" as const;
}

function titlePrefix(confidence: number | null | undefined) {
    switch (confidenceTier(confidence)) {
        case "medium":
            return "Likely";
        case "low":
            return "Possibly";
        default:
            return null;
    }
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

function displayNameFromCatalogToken(token: string) {
    return token
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
}

function isScientificCatalogToken(token: string) {
    const parts = token.toLowerCase().split("_").filter(Boolean);
    if (parts.length !== 2) return false;
    return parts.every((part) => /^[a-z]+$/.test(part));
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
    const breed = clean(input.breedGuess);
    if (!breed) return null;
    if (isSameIdentity(breed, input.scientificName)) return null;
    if (refinedIdentityDisplayConfidence(input) < refinedIdentityDisplayThreshold(input)) return null;

    const animalName = clean(input.animalName) ?? "";
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
    const prefix = titlePrefix(confidence);
    return prefix ? `${prefix} ${name}` : name;
}

function displayBroadAnimalName(input: CaptureHeadlineInput) {
    const animalName = clean(input.animalName) ?? "Animal";
    return withConfidencePrefix(animalName, input.confidence);
}

function displayHeadlineTitle(input: CaptureHeadlineInput) {
    if (shouldShowUncertaintyFallback(input)) {
        return "Uncertain animal";
    }

    const baseName = preferredDisplayIdentityGuess(input) ?? clean(input.animalName) ?? "Animal";
    return withConfidencePrefix(baseName, input.confidence);
}

export function resolveCaptureHeadlineDisplay(input: CaptureHeadlineInput): CaptureHeadlineDisplay {
    const animalName = displayHeadlineTitle(input);
    const headlineSupportingName = preferredDisplayIdentityGuess(input)
        ? displayBroadAnimalName(input)
        : null;

    return {animalName, headlineSupportingName};
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
