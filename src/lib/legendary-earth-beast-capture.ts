import {
    getLegendaryCatalogSeedByBeastSlug,
    getLegendaryCatalogSeedByIdentityKey,
    legendaryEarthBeastCatalogSeeds
} from "@/data/legendary-earth-beasts-catalog-seed";
import {legendaryEarthBeastSpeciesSlugs} from "@/data/legendary-earth-beasts-species";

const LOCATION_STOP_WORDS = new Set([
    "a", "an", "and", "at", "by", "for", "from", "in", "including", "near", "of", "on", "or", "sites", "the", "to", "with"
]);

export type LegendaryCaptureLocationInput = {
    locationDisplayLabel?: string | null;
    latitude?: number | null;
    longitude?: number | null;
};

function normalizeLocationText(value: string | null | undefined) {
    return (value ?? "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function locationTokens(value: string) {
    return normalizeLocationText(value)
        .split(/\s+/)
        .filter((token) => token.length > 2 && !LOCATION_STOP_WORDS.has(token));
}

function splitCaptureSites(captureSite: string) {
    const segments = captureSite
        .split(/\s+(?:and|including)\s+/i)
        .map((segment) => segment.trim())
        .filter(Boolean);

    if (segments.length === 0) {
        return [captureSite.trim()];
    }

    return segments.flatMap((segment) => {
        if (segment.includes(",")) {
            const [primary] = segment.split(",");
            return primary?.trim() ? [primary.trim(), segment.trim()] : [segment.trim()];
        }

        return [segment];
    });
}

function tokenOverlapScore(left: string, right: string) {
    const leftTokens = new Set(locationTokens(left));
    const rightTokens = locationTokens(right);

    if (leftTokens.size === 0 || rightTokens.length === 0) {
        return 0;
    }

    let overlap = 0;

    for (const token of rightTokens) {
        if (leftTokens.has(token)) {
            overlap += 1;
        }
    }

    return overlap / Math.max(3, Math.min(leftTokens.size, rightTokens.length));
}

export function isLegendaryEarthBeastSlug(slug: string | null | undefined) {
    const normalized = slug?.trim().toLowerCase();
    return normalized ? legendaryEarthBeastSpeciesSlugs.has(normalized) : false;
}

export function isLegendaryEarthBeastIdentityKey(identityKey: string | null | undefined) {
    const normalized = identityKey?.trim().toLowerCase().replace(/-/g, "_");
    if (!normalized) return false;

    if (legendaryEarthBeastCatalogSeeds.some((seed) => seed.normalizedIdentityKey === normalized)) {
        return true;
    }

    return Boolean(getLegendaryCatalogSeedByIdentityKey(normalized));
}

export function getLegendaryCaptureSite(slug: string) {
    return getLegendaryCatalogSeedByBeastSlug(slug)?.captureSite ?? null;
}

export function getLegendaryCaptureSites(slug: string) {
    const captureSite = getLegendaryCaptureSite(slug);
    return captureSite ? splitCaptureSites(captureSite) : [];
}

export function isCaptureAtLegendarySite(slug: string, location: LegendaryCaptureLocationInput) {
    const seed = getLegendaryCatalogSeedByBeastSlug(slug);
    if (!seed) return true;

    const label = normalizeLocationText(location.locationDisplayLabel);
    if (!label) {
        return false;
    }

    const sites = splitCaptureSites(seed.captureSite);
    const bestScore = Math.max(...sites.map((site) => tokenOverlapScore(label, site)));

    return bestScore >= 0.34;
}

export function validateLegendaryCaptureForIdentityKey(
    identityKey: string,
    location: Pick<LegendaryCaptureLocationInput, "locationDisplayLabel">
) {
    const seed = getLegendaryCatalogSeedByIdentityKey(identityKey.replace(/-/g, "_"));
    if (!seed) return true;

    return isCaptureAtLegendarySite(seed.beastSlug, location);
}

export function getLegendaryCaptureRequirementMessage(slug: string) {
    const captureSite = getLegendaryCaptureSite(slug);
    if (!captureSite) return null;

    return `Legendary Earth Beasts can only be captured at ${captureSite}.`;
}
