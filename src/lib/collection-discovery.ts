import type {UserCaptureSummary} from "@/data/user-captures";
import {
    getLegendaryCatalogSeedByBiologyIdentityKey
} from "@/data/legendary-earth-beasts-catalog-seed";
import {collectionIdentityMatchKeys, resolveCollectionIdentityToken} from "@/lib/collection-identity-aliases";
import {
    isCaptureAtLegendarySite,
    isLegendaryEarthBeastIdentityKey,
    validateLegendaryCaptureForIdentityKey
} from "@/lib/legendary-earth-beast-capture";

export type CollectionDiscoveryIndex = {
    discoveredProfileIds: Set<string>;
    discoveredIdentityKeys: Set<string>;
    capturesWithoutIdentityKeyProfileIds: Set<string>;
    latestCaptureByProfileId: Map<string, UserCaptureSummary>;
    latestCaptureByIdentityKey: Map<string, UserCaptureSummary>;
};

export type CollectionDiscoveryStats = {
    found: number;
    indexed: number;
    breeds: number;
    remaining: number;
};

function clean(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

export function catalogLookupToken(raw: string | null | undefined) {
    const trimmed = clean(raw)?.toLowerCase();
    if (!trimmed) return null;

    const normalized = trimmed
        .replace(/'/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    if (!normalized || normalized === "unknown" || normalized === "unknown_animal") {
        return null;
    }

    return normalized;
}

const BROAD_COLLECTION_IDENTITY_TOKENS = new Set([
    "animal",
    "amphibian",
    "arachnid",
    "bird",
    "bug",
    "crab",
    "crustacean",
    "eel",
    "fish",
    "frog",
    "gecko",
    "insect",
    "invertebrate",
    "lizard",
    "mollusk",
    "owl",
    "ray",
    "reptile",
    "shark",
    "snake",
    "spider",
    "toad",
    "tortoise",
    "turtle",
    "unknown",
    "unknown_animal"
]);

/** Matches iOS AnalysisResult.isBroadCollectionIdentityToken */
export function isBroadCollectionIdentityToken(raw: string | null | undefined) {
    const token = catalogLookupToken(raw);
    return !token || BROAD_COLLECTION_IDENTITY_TOKENS.has(token);
}

function meaningfulScientificName(value: string | null | undefined) {
    const scientificName = clean(value);
    if (!scientificName) return null;

    const normalized = scientificName.toLowerCase();
    if (normalized === "unknown" || normalized === "unknown species") {
        return null;
    }

    return scientificName;
}

/** Matches iOS AnalysisResult.hasSpecificCollectionIdentity (without breed-guess fields). */
export function hasSpecificCollectionIdentity(
    capture: Pick<UserCaptureSummary, "animalName" | "scientificName" | "speciesSlug">
) {
    if (meaningfulScientificName(capture.scientificName)) {
        return true;
    }

    if (clean(capture.speciesSlug) && !isBroadCollectionIdentityToken(capture.speciesSlug)) {
        return true;
    }

    return !isBroadCollectionIdentityToken(capture.animalName);
}

/** Matches iOS AnalysisResult.collectionIdentityKey */
export function collectionIdentityKey(
    capture: Pick<UserCaptureSummary, "animalName" | "scientificName" | "speciesSlug" | "speciesProfileId">
) {
    if (!hasSpecificCollectionIdentity(capture)) {
        return null;
    }

    const canonicalIdentityToken = clean(capture.speciesSlug)?.toLowerCase() ?? null;
    const profileId = clean(capture.speciesProfileId)?.toLowerCase();

    if (profileId && !isBroadCollectionIdentityToken(canonicalIdentityToken ?? capture.animalName)) {
        return `spid:${profileId}`;
    }

    if (canonicalIdentityToken && !isBroadCollectionIdentityToken(canonicalIdentityToken)) {
        return `nik:${resolveCollectionIdentityToken(canonicalIdentityToken)}`;
    }

    const scientificKey = catalogLookupToken(capture.scientificName);
    if (scientificKey && !isBroadCollectionIdentityToken(scientificKey)) {
        return `sci:${resolveCollectionIdentityToken(scientificKey)}`;
    }

    const animalKey = catalogLookupToken(capture.animalName);
    if (animalKey && !isBroadCollectionIdentityToken(animalKey)) {
        return `name:${resolveCollectionIdentityToken(animalKey)}`;
    }

    return null;
}

export function isUncertainCapture(capture: Pick<UserCaptureSummary, "animalName" | "confidence">) {
    const animalName = clean(capture.animalName)?.toLowerCase();
    if (animalName === "unknown animal") return true;

    const confidence = capture.confidence ?? 0;
    return confidence < 0.4;
}

function normalizeDiscoveryKey(value: string | null | undefined) {
    return clean(value)?.toLowerCase() ?? "";
}

/** Matches iOS AnalysisResult.speciesCatalogLookupKey */
export function resolveSpeciesCatalogLookupKey(capture: Pick<UserCaptureSummary, "speciesSlug" | "scientificName" | "animalName">) {
    const canonical = normalizeDiscoveryKey(capture.speciesSlug);

    if (canonical) {
        return resolveCollectionIdentityToken(canonical);
    }

    const scientific = catalogLookupToken(capture.scientificName);

    if (scientific) {
        return resolveCollectionIdentityToken(scientific);
    }

    const animal = catalogLookupToken(capture.animalName);

    return animal ? resolveCollectionIdentityToken(animal) : null;
}

/** Matches iOS AnimalDexCatalogView.normalizedDiscoveryKeys(for:) */
function normalizedDiscoveryKeys(capture: UserCaptureSummary) {
    const keys: string[] = [];
    const seen = new Set<string>();

    for (const rawValue of [resolveSpeciesCatalogLookupKey(capture), normalizeDiscoveryKey(capture.speciesSlug)]) {
        if (!rawValue) continue;
        const normalized = resolveCollectionIdentityToken(rawValue.trim().toLowerCase());
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        keys.push(normalized);
    }

    const remapped: string[] = [];

    for (const key of keys) {
        const biologySeed = getLegendaryCatalogSeedByBiologyIdentityKey(key);

        if (biologySeed) {
            if (isCaptureAtLegendarySite(biologySeed.beastSlug, {locationDisplayLabel: capture.locationDisplayLabel})) {
                remapped.push(biologySeed.normalizedIdentityKey);
            }
            continue;
        }

        remapped.push(key);
    }

    return remapped;
}

function isEligibleLegendaryDiscoveryCapture(capture: UserCaptureSummary, identityKey: string) {
    if (!isLegendaryEarthBeastIdentityKey(identityKey)) {
        return true;
    }

    return validateLegendaryCaptureForIdentityKey(identityKey, {
        locationDisplayLabel: capture.locationDisplayLabel
    });
}

export function buildCollectionDiscoveryIndex(captures: UserCaptureSummary[]): CollectionDiscoveryIndex {
    const sorted = [...captures].sort((left, right) => {
        const dateCompare = (right.capturedAt ?? "").localeCompare(left.capturedAt ?? "");
        if (dateCompare !== 0) return dateCompare;
        return right.captureId.localeCompare(left.captureId);
    });

    const index: CollectionDiscoveryIndex = {
        discoveredProfileIds: new Set(),
        discoveredIdentityKeys: new Set(),
        capturesWithoutIdentityKeyProfileIds: new Set(),
        latestCaptureByProfileId: new Map(),
        latestCaptureByIdentityKey: new Map()
    };

    for (const capture of sorted) {
        if (isUncertainCapture(capture)) continue;

        const profileId = clean(capture.speciesProfileId)?.toLowerCase();
        const canonicalIdentity = normalizeDiscoveryKey(capture.speciesSlug);

        if (profileId) {
            index.discoveredProfileIds.add(profileId);
            if (!index.latestCaptureByProfileId.has(profileId)) {
                index.latestCaptureByProfileId.set(profileId, capture);
            }
            if (!canonicalIdentity) {
                index.capturesWithoutIdentityKeyProfileIds.add(profileId);
            }
        }

        for (const key of normalizedDiscoveryKeys(capture)) {
            if (!isEligibleLegendaryDiscoveryCapture(capture, key)) {
                continue;
            }

            index.discoveredIdentityKeys.add(key);
            if (!index.latestCaptureByIdentityKey.has(key)) {
                index.latestCaptureByIdentityKey.set(key, capture);
            }
        }
    }

    return index;
}

export function countDiscoveredEntries(index: CollectionDiscoveryIndex) {
    return index.discoveredIdentityKeys.size + index.capturesWithoutIdentityKeyProfileIds.size;
}

/** Matches iOS AnimalDexCatalogView.isDiscovered(_:) */
export function isCatalogEntryDiscovered(
    entry: {
        speciesProfileId?: string | null;
        normalizedIdentityKey?: string | null;
    },
    index: CollectionDiscoveryIndex
) {
    const profileId = clean(entry.speciesProfileId)?.toLowerCase();
    if (profileId && index.discoveredProfileIds.has(profileId)) {
        return true;
    }

    const identityKey = normalizeDiscoveryKey(entry.normalizedIdentityKey);

    if (identityKey) {
        for (const key of collectionIdentityMatchKeys(identityKey)) {
            if (index.discoveredIdentityKeys.has(key)) {
                return true;
            }
        }
    }

    return false;
}

/** Matches iOS AnimalDexCatalogView.latestCapture(for:) */
export function latestCaptureForCatalogEntry(
    entry: {
        speciesProfileId?: string | null;
        normalizedIdentityKey?: string | null;
    },
    index: CollectionDiscoveryIndex
): UserCaptureSummary | null {
    const profileId = clean(entry.speciesProfileId)?.toLowerCase();
    if (profileId) {
        const byProfile = index.latestCaptureByProfileId.get(profileId);
        if (byProfile) return byProfile;
    }

    const identityKey = normalizeDiscoveryKey(entry.normalizedIdentityKey);

    if (identityKey) {
        for (const key of collectionIdentityMatchKeys(identityKey)) {
            const byIdentity = index.latestCaptureByIdentityKey.get(key);

            if (byIdentity) {
                return byIdentity;
            }
        }
    }

    return null;
}

export function buildCollectionDiscoveryStats(
    index: CollectionDiscoveryIndex,
    species: Array<{hasIndexNumber?: boolean; isBreed?: boolean}>
): CollectionDiscoveryStats {
    const indexed = species.filter((item) => item.hasIndexNumber).length;
    const breeds = species.filter((item) => item.isBreed).length;
    const found = countDiscoveredEntries(index);
    const remaining = Math.max(0, indexed - found);

    return {found, indexed, breeds, remaining};
}
