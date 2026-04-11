import type {SpeciesEntry} from "@/data/species";
import {getSpeciesBySlug} from "@/data/species";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

export const SPECIES_NO_IMAGE_SRC = "/images/placeholders/species-no-image.svg";

type DiscoverFeedCandidate = {
    capture_id?: string;
    animal_name?: string | null;
    profile_username?: string | null;
    location_display_label?: string | null;
    human_context?: string | null;
    zoo_or_wild?: string | null;
    image_bucket?: string | null;
    image_path?: string | null;
    image_mime_type?: string | null;
    image_media_kind?: string | null;
};

type AnalysisResultCandidate = {
    capture_id: string;
    confidence?: number | null;
    captures?: {
        created_at?: string | null;
    } | null;
};

type CaptureImageRow = {
    capture_id: string;
    storage_bucket: string;
    storage_path: string;
    mime_type: string | null;
    media_kind: string | null;
    sort_order: number | null;
};

export type FeaturedMedia = {
    captureId: string | null;
    imageBucket: string | null;
    imagePath: string | null;
    mimeType: string | null;
    mediaKind: string | null;
    animalName: string | null;
    username: string | null;
    contextLabel: string | null;
    locationDisplayLabel: string | null;
};

export type SpeciesImageReference = FeaturedMedia;

type SpeciesImageAltVariant = "featured" | "thumbnail" | "metadata";

function getSupabaseConfig() {
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getSupabaseServerReadKey();

    if (!supabaseUrl || !anonKey) {
        return null;
    }

    return {supabaseUrl, anonKey};
}

function buildSpeciesKeyCandidates(entry: SpeciesEntry) {
    return [
        entry.speciesProfileId
            ? {column: "species_profile_id", value: entry.speciesProfileId}
            : null,
        (entry.normalizedIdentityKey ?? entry.slug)
            ? {column: "normalized_identity_key", value: entry.normalizedIdentityKey ?? entry.slug}
            : null,
        entry.analysis.scientificName
            ? {column: "scientific_name", value: entry.analysis.scientificName}
            : null
    ].filter((item): item is {column: string; value: string} => Boolean(item?.value));
}

function buildDiscoverFeedCandidates(entry: SpeciesEntry) {
    return [
        ...buildSpeciesKeyCandidates(entry),
        entry.name
            ? {column: "animal_name", value: entry.name}
            : null
    ].filter((item): item is {column: string; value: string} => Boolean(item?.value));
}

function isUsableDiscoverFeedImage(row: DiscoverFeedCandidate) {
    if (!row.image_bucket || !row.image_path) {
        return false;
    }

    if (row.image_media_kind && row.image_media_kind !== "photo") {
        return false;
    }

    if (row.image_mime_type && !row.image_mime_type.startsWith("image/")) {
        return false;
    }

    return true;
}

function getContextLabel(row: Pick<DiscoverFeedCandidate, "zoo_or_wild" | "human_context">) {
    const zooOrWild = row.zoo_or_wild?.trim();

    if (zooOrWild && zooOrWild !== "Unknown") {
        return zooOrWild;
    }

    switch (row.human_context?.trim()) {
        case "Pet":
            return "Domestic";
        case "Livestock":
            return "Farm";
        case "Captive":
            return "Zoo";
        case "Free-ranging":
            return "Wild";
        default:
            return null;
    }
}

function getLocationDisplayLabel(label: string | null | undefined) {
    const normalizedLabel = label?.trim();

    if (!normalizedLabel) {
        return null;
    }

    const genericLabels = new Set([
        "unknown",
        "zoo",
        "garden",
        "indoor",
        "urban area"
    ]);

    return genericLabels.has(normalizedLabel.toLowerCase()) ? null : normalizedLabel;
}

async function fetchDiscoverableImageCandidatesBySpecies(entry: SpeciesEntry): Promise<DiscoverFeedCandidate[]> {
    const config = getSupabaseConfig();

    if (!config) {
        return [];
    }

    for (const candidate of buildDiscoverFeedCandidates(entry)) {
        const searchParams = new URLSearchParams({
            select: "capture_id,animal_name,profile_username,location_display_label,human_context,zoo_or_wild,image_bucket,image_path,image_mime_type,image_media_kind",
            [candidate.column]: `eq.${candidate.value}`,
            limit: "12"
        });

        try {
            const response = await fetch(`${config.supabaseUrl}/rest/v1/discover_feed_v1?${searchParams.toString()}`, {
                headers: getSupabaseHeaders(config.anonKey),
                next: {revalidate: 3600}
            });

            if (!response.ok) {
                continue;
            }

            const rows = await response.json() as DiscoverFeedCandidate[];

            if (rows.length > 0) {
                return rows;
            }
        } catch {
            continue;
        }
    }

    return [];
}

async function fetchAnalysisCaptureIdsBySpecies(entry: SpeciesEntry): Promise<string[]> {
    const config = getSupabaseConfig();

    if (!config) {
        return [];
    }

    for (const candidate of buildSpeciesKeyCandidates(entry)) {
        const searchParams = new URLSearchParams({
            select: "capture_id,confidence,captures!inner(created_at)",
            completed_at: "not.is.null",
            [candidate.column]: `eq.${candidate.value}`,
            "captures.is_discoverable": "eq.true",
            "captures.status": "eq.ready",
            limit: "16",
            order: "confidence.desc"
        });

        try {
            const response = await fetch(`${config.supabaseUrl}/rest/v1/analysis_results?${searchParams.toString()}`, {
                headers: getSupabaseHeaders(config.anonKey),
                next: {revalidate: 3600}
            });

            if (!response.ok) {
                continue;
            }

            const rows = await response.json() as AnalysisResultCandidate[];
            const sortedRows = rows.sort((a, b) => {
                const confidenceDelta = (b.confidence ?? 0) - (a.confidence ?? 0);

                if (confidenceDelta !== 0) {
                    return confidenceDelta;
                }

                return new Date(b.captures?.created_at ?? 0).getTime() - new Date(a.captures?.created_at ?? 0).getTime();
            });
            const captureIds = sortedRows.map((row) => row.capture_id).filter(Boolean);

            if (captureIds.length > 0) {
                return captureIds;
            }
        } catch {
            continue;
        }
    }

    return [];
}

async function fetchCaptureImages(captureIds: string[]): Promise<CaptureImageRow[]> {
    const config = getSupabaseConfig();

    if (!config || captureIds.length === 0) {
        return [];
    }

    const searchParams = new URLSearchParams({
        select: "capture_id,storage_bucket,storage_path,mime_type,media_kind,sort_order",
        capture_id: `in.(${captureIds.join(",")})`,
        media_kind: "eq.photo",
        mime_type: "like.image/%",
        order: "sort_order.asc"
    });

    try {
        const response = await fetch(`${config.supabaseUrl}/rest/v1/capture_images?${searchParams.toString()}`, {
            headers: getSupabaseHeaders(config.anonKey),
            next: {revalidate: 3600}
        });

        if (!response.ok) {
            return [];
        }

        return await response.json() as CaptureImageRow[];
    } catch {
        return [];
    }
}

function createSpeciesImageReference(input: {
    captureId: string | null;
    imageBucket: string | null;
    imagePath: string | null;
    mimeType: string | null;
    mediaKind: string | null;
    animalName: string | null;
    username: string | null;
    contextLabel: string | null;
    locationDisplayLabel: string | null;
}): FeaturedMedia {
    return {
        captureId: input.captureId,
        imageBucket: input.imageBucket,
        imagePath: input.imagePath,
        mimeType: input.mimeType,
        mediaKind: input.mediaKind,
        animalName: input.animalName,
        username: input.username,
        contextLabel: input.contextLabel,
        locationDisplayLabel: input.locationDisplayLabel
    };
}

function getReferenceKey(reference: Pick<FeaturedMedia, "captureId" | "imageBucket" | "imagePath">) {
    return reference.captureId ?? `${reference.imageBucket}:${reference.imagePath}`;
}

export async function getSpeciesImageReferences(slug: string, limit = 8): Promise<FeaturedMedia[]> {
    const entry = getSpeciesBySlug(slug);

    if (!entry) {
        return [];
    }

    const references: FeaturedMedia[] = [];
    const seen = new Set<string>();
    const pushReference = (reference: FeaturedMedia | null) => {
        if (!reference) {
            return;
        }

        const key = getReferenceKey(reference);

        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        references.push(reference);
    };
    const discoverFeedCandidates = await fetchDiscoverableImageCandidatesBySpecies(entry);
    const discoverFeedCaptureIds = discoverFeedCandidates
        .map((candidate) => candidate.capture_id)
        .filter((captureId): captureId is string => Boolean(captureId));
    const fallbackCaptureIds = discoverFeedCaptureIds.length > 0 ? discoverFeedCaptureIds : await fetchAnalysisCaptureIdsBySpecies(entry);
    const directDiscoverFeedImages = discoverFeedCandidates.filter((candidate) => isUsableDiscoverFeedImage(candidate));

    for (const candidate of directDiscoverFeedImages) {
        if (!candidate.image_bucket || !candidate.image_path) {
            continue;
        }

        pushReference(createSpeciesImageReference({
            captureId: candidate.capture_id ?? null,
            imageBucket: candidate.image_bucket,
            imagePath: candidate.image_path,
            mimeType: candidate.image_mime_type ?? null,
            mediaKind: candidate.image_media_kind ?? null,
            animalName: candidate.animal_name ?? null,
            username: candidate.profile_username?.trim() || null,
            contextLabel: getContextLabel(candidate),
            locationDisplayLabel: candidate.capture_id ? getLocationDisplayLabel(candidate.location_display_label) : null
        }));

        if (references.length >= limit) {
            return references.slice(0, limit);
        }
    }
    const candidateCaptureIds = fallbackCaptureIds;

    if (candidateCaptureIds.length === 0) {
        return references;
    }

    const images = await fetchCaptureImages(candidateCaptureIds);

    for (const captureId of candidateCaptureIds) {
        const image = images.find((item) => item.capture_id === captureId);

        if (image) {
            const discoverFeedMatch = discoverFeedCandidates.find((candidate) => candidate.capture_id === captureId);

            pushReference(createSpeciesImageReference({
                captureId,
                imageBucket: image.storage_bucket,
                imagePath: image.storage_path,
                mimeType: image.mime_type,
                mediaKind: image.media_kind,
                animalName: entry.name,
                username: discoverFeedMatch?.profile_username?.trim() || null,
                contextLabel: discoverFeedMatch ? getContextLabel(discoverFeedMatch) : null,
                locationDisplayLabel: getLocationDisplayLabel(discoverFeedMatch?.location_display_label)
            }));

            if (references.length >= limit) {
                return references.slice(0, limit);
            }
        }
    }

    return references.slice(0, limit);
}

export async function getSpeciesRepresentativeImageReference(slug: string): Promise<FeaturedMedia | null> {
    const references = await getSpeciesImageReferences(slug, 1);

    return references[0] ?? null;
}

export function getSpeciesImageRoute(slug: string, captureId?: string | null) {
    if (!captureId) {
        return `/api/species-images/${slug}`;
    }

    const searchParams = new URLSearchParams({captureId});
    return `/api/species-images/${slug}?${searchParams.toString()}`;
}

export function getSpeciesImageAltText(entry: SpeciesEntry, variant: SpeciesImageAltVariant = "featured") {
    const scientificName = entry.analysis.scientificName ? ` (${entry.analysis.scientificName})` : "";

    switch (variant) {
        case "thumbnail":
            return `${entry.name}${scientificName} thumbnail image on AnimalDex`;
        case "metadata":
            return `${entry.name}${scientificName} animal image and species guide on AnimalDex`;
        default:
            return `${entry.name}${scientificName} featured animal image on AnimalDex`;
    }
}

export function getSpeciesImageAttribution(reference: SpeciesImageReference | null) {
    if (!reference?.imagePath) {
        return null;
    }

    return reference.username
        ? `Captured by @${reference.username}`
        : "Captured by AnimalDex member";
}
