import {
    getMergedIdentityAliases,
    resolveCollectionIdentityToken
} from "@/lib/collection-identity-aliases";

/** Life-stage / form tokens that must not be separate catalog species when used as a suffix. */
export const LIFE_STAGE_FORM_TOKENS = new Set([
    "caterpillar",
    "larva",
    "nymph",
    "pupa",
    "hatchling",
    "juvenile",
    "chick",
    "tadpole",
    "puppy",
    "kitten",
    "calf",
    "foal",
    "cub",
    "fry",
    "fingerling",
    "eft"
]);

/**
 * Species whose normalized identity keys contain a stage word as part of the true species name
 * (not a life-stage alias). Example: tadpole_shrimp is canonical; tadpole alone is not.
 */
export const STAGE_WORD_SPECIES_ALLOWLIST = new Set([
    "tadpole_shrimp"
]);

export type CanonicalSpeciesRef = {
    name: string;
    slug: string;
    normalizedIdentityKey?: string | null;
    speciesProfileId?: string | null;
    animalDexNumber?: number | null;
};

export type CaptureVariantDisplay = {
    title: string;
    lifeStageChip: string | null;
    countsAsLine: string | null;
    capturedAsLine: string | null;
    sameSpeciesHelper: string | null;
    canonicalName: string | null;
    canonicalSlug: string | null;
    isStageVariant: boolean;
};


export function resolveSpeciesIdentityToken(token: string) {
    const normalized = normalizeIdentityToken(token);
    return resolveCollectionIdentityToken(normalized);
}

export function normalizeIdentityToken(value: string) {
    return value.trim().toLowerCase().replace(/-/g, "_");
}

export function identityKeyToSlug(identityKey: string) {
    return identityKey.replace(/_/g, "-");
}

export function slugToIdentityKey(slug: string) {
    return normalizeIdentityToken(slug);
}

function titleCaseWords(value: string) {
    return value
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

export function formatLifeStageChipLabel(value: string | null | undefined) {
    const cleaned = value?.trim();
    if (!cleaned) return null;
    return titleCaseWords(cleaned.replace(/_/g, " "));
}

function parseLifeStageSuffix(identityKey: string) {
    const parts = identityKey.split("_").filter(Boolean);
    if (parts.length < 2) return null;

    const stage = parts[parts.length - 1];
    if (!LIFE_STAGE_FORM_TOKENS.has(stage)) return null;

    return {
        stage,
        baseKey: parts.slice(0, -1).join("_")
    };
}

export function isStageWordSpeciesAllowlist(identityKey: string) {
    return STAGE_WORD_SPECIES_ALLOWLIST.has(normalizeIdentityToken(identityKey));
}

/** True when an indexed catalog row is a non-canonical life-stage duplicate profile. */
export function isNonCanonicalLifeStageCatalogIdentity(identityKey: string | null | undefined) {
    const normalized = cleanIdentityKey(identityKey);
    if (!normalized) return false;
    if (isStageWordSpeciesAllowlist(normalized)) return false;

    const resolved = resolveSpeciesIdentityToken(normalized);
    if (resolved !== normalized) return true;

    return parseLifeStageSuffix(normalized) !== null;
}

export function isCanonicalCatalogIdentity(identityKey: string | null | undefined) {
    return !isNonCanonicalLifeStageCatalogIdentity(identityKey);
}

export function resolveCanonicalIdentityKey(identityKey: string | null | undefined) {
    const normalized = cleanIdentityKey(identityKey);
    if (!normalized) return null;
    return resolveSpeciesIdentityToken(normalized);
}

export function resolveCanonicalSlugFromIdentity(identityKey: string | null | undefined) {
    const canonical = resolveCanonicalIdentityKey(identityKey);
    return canonical ? identityKeyToSlug(canonical) : null;
}

function cleanIdentityKey(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? normalizeIdentityToken(trimmed) : null;
}

function normalizeComparableName(value: string | null | undefined) {
    return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ") ?? "";
}

function inferLifeStageFromIdentityKey(identityKey: string | null | undefined) {
    const normalized = cleanIdentityKey(identityKey);
    if (!normalized) return null;
    return parseLifeStageSuffix(normalized)?.stage ?? null;
}

function inferLifeStageFromAnimalName(animalName: string | null | undefined, canonicalName: string | null) {
    const tokens = normalizeComparableName(animalName).split(/\s+/).filter(Boolean);
    if (!tokens.length) return null;

    const last = tokens[tokens.length - 1];
    if (!LIFE_STAGE_FORM_TOKENS.has(last)) return null;

    const canonicalTokens = normalizeComparableName(canonicalName).split(/\s+/).filter(Boolean);
    if (canonicalTokens.length && tokens.join(" ") === canonicalTokens.join(" ")) {
        return null;
    }

    return last;
}

export function isStageVariantCapture(input: {
    animalName?: string | null;
    lifeStage?: string | null;
    normalizedIdentityKey?: string | null;
    canonicalName?: string | null;
}) {
    const identityKey = cleanIdentityKey(input.normalizedIdentityKey);
    const canonicalName = input.canonicalName?.trim() ?? null;
    const animalName = input.animalName?.trim() ?? null;

    if (identityKey && isNonCanonicalLifeStageCatalogIdentity(identityKey)) {
        return true;
    }

    if (input.lifeStage?.trim()) {
        if (!canonicalName || normalizeComparableName(animalName) !== normalizeComparableName(canonicalName)) {
            return true;
        }
    }

    if (animalName && canonicalName) {
        const scanned = normalizeComparableName(animalName);
        const canonical = normalizeComparableName(canonicalName);
        if (scanned !== canonical && scanned.length > 0) {
            const stageFromName = inferLifeStageFromAnimalName(animalName, canonicalName);
            const stageFromIdentity = inferLifeStageFromIdentityKey(identityKey);
            if (stageFromName || stageFromIdentity) {
                return true;
            }

            if (identityKey && resolveSpeciesIdentityToken(identityKey) !== identityKey) {
                return true;
            }
        }
    }

    return false;
}

export function resolveCaptureVariantDisplay(input: {
    animalName?: string | null;
    lifeStage?: string | null;
    normalizedIdentityKey?: string | null;
    canonicalSpecies?: CanonicalSpeciesRef | null;
}): CaptureVariantDisplay {
    const animalName = input.animalName?.trim() || "Animal";
    const canonicalName = input.canonicalSpecies?.name?.trim() ?? null;
    const canonicalSlug = input.canonicalSpecies?.slug ?? null;
    const isStageVariant = isStageVariantCapture({
        animalName,
        lifeStage: input.lifeStage,
        normalizedIdentityKey: input.normalizedIdentityKey,
        canonicalName
    });

    const lifeStageToken = input.lifeStage?.trim()
        ?? inferLifeStageFromIdentityKey(input.normalizedIdentityKey)
        ?? inferLifeStageFromAnimalName(animalName, canonicalName);
    const lifeStageChip = formatLifeStageChipLabel(lifeStageToken);

    if (!isStageVariant || !canonicalName) {
        return {
            title: animalName,
            lifeStageChip,
            countsAsLine: null,
            capturedAsLine: null,
            sameSpeciesHelper: null,
            canonicalName,
            canonicalSlug,
            isStageVariant: false
        };
    }

    const stageArticle = lifeStageChip ? lifeStageChip.toLowerCase() : "life stage";

    return {
        title: animalName,
        lifeStageChip,
        countsAsLine: `Counts as ${canonicalName}`,
        capturedAsLine: `Captured as a ${stageArticle}`,
        sameSpeciesHelper: "Same species, different life stage",
        canonicalName,
        canonicalSlug,
        isStageVariant: true
    };
}

export type SpeciesDirectorySearchMatch = {
    entrySlug: string;
    mainLabel: string;
    aliasMatchLabel: string | null;
    helperText: string | null;
    matchedQuery: string;
};

function entrySearchHaystack(entry: {name: string; analysis: {scientificName: string; category: string; summary: string; habitat: string; nativeRange: string}; normalizedIdentityKey?: string | null; slug: string}) {
    const aliasKeys = collectionAliasLabelsForCanonical(entry.normalizedIdentityKey ?? entry.slug);
    return [
        entry.name,
        entry.analysis.scientificName,
        entry.analysis.category,
        entry.analysis.summary,
        entry.analysis.habitat,
        entry.analysis.nativeRange,
        entry.slug.replace(/-/g, " "),
        ...aliasKeys.map((key) => key.replace(/_/g, " "))
    ]
        .join(" ")
        .toLowerCase();
}

function collectionAliasLabelsForCanonical(canonicalToken: string) {
    const normalized = normalizeIdentityToken(canonicalToken);
    const resolved = resolveSpeciesIdentityToken(normalized);
    const merged = getMergedIdentityAliases();
    const aliases: string[] = [];

    for (const [alias, canonical] of Object.entries(merged)) {
        if (canonical === resolved) {
            aliases.push(alias);
        }
    }

    return aliases;
}

export function speciesDirectorySearchMatch(
    entry: {
        name: string;
        slug: string;
        normalizedIdentityKey?: string | null;
        analysis: {scientificName: string; category: string; summary: string; habitat: string; nativeRange: string};
    },
    query: string
): SpeciesDirectorySearchMatch | null {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return {
            entrySlug: entry.slug,
            mainLabel: entry.name,
            aliasMatchLabel: null,
            helperText: null,
            matchedQuery: normalizedQuery
        };
    }

    const haystack = entrySearchHaystack(entry);
    const directMatch = haystack.includes(normalizedQuery);
    const canonicalKey = resolveSpeciesIdentityToken(entry.normalizedIdentityKey ?? entry.slug);
    const merged = getMergedIdentityAliases();
    let aliasKey: string | null = null;

    for (const [alias, canonical] of Object.entries(merged)) {
        if (canonical !== canonicalKey) continue;
        const aliasHaystack = alias.replace(/_/g, " ");
        if (aliasHaystack.includes(normalizedQuery) || normalizedQuery.includes(aliasHaystack)) {
            aliasKey = alias;
            break;
        }
    }

    if (!directMatch && !aliasKey) {
        return null;
    }

    const aliasLabel = aliasKey
        ? titleCaseWords(aliasKey.replace(/_/g, " "))
        : null;
    const stage = aliasKey ? inferLifeStageFromIdentityKey(aliasKey) : null;
    const helperText = aliasLabel && stage
        ? `${formatLifeStageChipLabel(stage)} captures count here`
        : aliasLabel
            ? "Alias match"
            : null;

    return {
        entrySlug: entry.slug,
        mainLabel: entry.name,
        aliasMatchLabel: aliasLabel ? `Alias match: ${aliasLabel}` : null,
        helperText,
        matchedQuery: normalizedQuery
    };
}

export function speciesDirectoryMatchesQuery(
    entry: Parameters<typeof speciesDirectorySearchMatch>[0],
    query: string
) {
    return speciesDirectorySearchMatch(entry, query) != null;
}

export function shouldNoindexLifeStageAliasSlug(requestedSlug: string, resolvedSlug: string) {
    const requested = slugToIdentityKey(requestedSlug);
    const resolved = slugToIdentityKey(resolvedSlug);
    if (requested === resolved) return false;
    return isNonCanonicalLifeStageCatalogIdentity(requested);
}
