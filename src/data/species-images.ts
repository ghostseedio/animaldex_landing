import type {SpeciesEntry} from "@/data/species";
import {getSpeciesBySlug} from "@/data/species";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

export const SPECIES_NO_IMAGE_SRC = "/images/placeholders/species-no-image.svg";

type DiscoverFeedCandidate = {
    capture_id?: string;
    species_profile_id?: string | null;
    normalized_identity_key?: string | null;
    scientific_name?: string | null;
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
    species_profile_id?: string | null;
    normalized_identity_key?: string | null;
    scientific_name?: string | null;
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

export type SpeciesDirectoryImageState = {
    hasPublicCapture: boolean;
    captureId: string | null;
};

type SpeciesImageAltVariant = "featured" | "thumbnail" | "metadata";

const DISCOVER_FEED_IMAGE_SELECT = [
    "capture_id",
    "species_profile_id",
    "normalized_identity_key",
    "scientific_name",
    "animal_name",
    "profile_username",
    "location_display_label",
    "human_context",
    "zoo_or_wild",
    "image_bucket",
    "image_path",
    "image_mime_type",
    "image_media_kind"
].join(",");

function postgrestInFilter(values: string[]) {
    const uniqueValues = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

    return `in.(${uniqueValues.map((value) => `"${value.replaceAll("\"", "\\\"")}"`).join(",")})`;
}

function chunkValues<T>(items: T[], size: number) {
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }

    return chunks;
}

function registerSpeciesDirectoryMatch(
    index: Map<string, Map<string, Set<string>>>,
    column: string,
    value: string | null | undefined,
    slug: string
) {
    const trimmed = value?.trim();

    if (!trimmed) {
        return;
    }

    if (!index.has(column)) {
        index.set(column, new Map());
    }

    const valueMap = index.get(column)!;

    if (!valueMap.has(trimmed)) {
        valueMap.set(trimmed, new Set());
    }

    valueMap.get(trimmed)!.add(slug);
}

function registerNormalizedIdentityKeyVariants(
    index: Map<string, Map<string, Set<string>>>,
    value: string | null | undefined,
    slug: string
) {
    const trimmed = value?.trim();

    if (!trimmed) {
        return;
    }

    registerSpeciesDirectoryMatch(index, "normalized_identity_key", trimmed, slug);

    const withUnderscores = trimmed.replaceAll("-", "_");

    if (withUnderscores !== trimmed) {
        registerSpeciesDirectoryMatch(index, "normalized_identity_key", withUnderscores, slug);
    }

    const withHyphens = trimmed.replaceAll("_", "-");

    if (withHyphens !== trimmed) {
        registerSpeciesDirectoryMatch(index, "normalized_identity_key", withHyphens, slug);
    }
}

function buildSpeciesDirectoryMatchIndex(entries: SpeciesEntry[]) {
    const index = new Map<string, Map<string, Set<string>>>();

    for (const entry of entries) {
        for (const candidate of buildDiscoverFeedCandidates(entry)) {
            if (candidate.column === "normalized_identity_key") {
                registerNormalizedIdentityKeyVariants(index, candidate.value, entry.slug);
            } else {
                registerSpeciesDirectoryMatch(index, candidate.column, candidate.value, entry.slug);
            }
        }

        registerNormalizedIdentityKeyVariants(index, entry.slug, entry.slug);
        registerNormalizedIdentityKeyVariants(index, entry.normalizedIdentityKey ?? entry.slug, entry.slug);
    }

    return index;
}

function applyDiscoverFeedRowsToDirectoryState(
    rows: DiscoverFeedCandidate[],
    matchIndex: Map<string, Map<string, Set<string>>>,
    stateBySlug: Map<string, SpeciesDirectoryImageState>
) {
    for (const row of rows) {
        if (!isUsableDiscoverFeedImage(row) || !row.capture_id) {
            continue;
        }

        const matchedSlugs = new Set<string>();
        const columns: Array<keyof DiscoverFeedCandidate> = [
            "species_profile_id",
            "normalized_identity_key",
            "scientific_name",
            "animal_name"
        ];

        for (const column of columns) {
            const value = row[column];

            if (typeof value !== "string") {
                continue;
            }

            const slugs = matchIndex.get(column)?.get(value.trim());

            if (slugs) {
                for (const slug of Array.from(slugs)) {
                    matchedSlugs.add(slug);
                }
            }
        }

        for (const slug of Array.from(matchedSlugs)) {
            const current = stateBySlug.get(slug);

            if (!current || current.hasPublicCapture) {
                continue;
            }

            stateBySlug.set(slug, {
                hasPublicCapture: true,
                captureId: row.capture_id
            });
        }
    }
}

async function fetchDiscoverFeedRowsByColumn(column: string, values: string[]) {
    const config = getSupabaseConfig();

    if (!config || values.length === 0) {
        return [] as DiscoverFeedCandidate[];
    }

    const rows: DiscoverFeedCandidate[] = [];

    for (const chunk of chunkValues(values, 40)) {
        const searchParams = new URLSearchParams({
            select: DISCOVER_FEED_IMAGE_SELECT,
            [column]: postgrestInFilter(chunk),
            limit: "1000"
        });

        try {
            const response = await fetch(`${config.supabaseUrl}/rest/v1/discover_feed_v1?${searchParams.toString()}`, {
                headers: getSupabaseHeaders(config.anonKey),
                next: {revalidate: 3600}
            });

            if (!response.ok) {
                continue;
            }

            rows.push(...await response.json() as DiscoverFeedCandidate[]);
        } catch {
            continue;
        }
    }

    return rows;
}

async function fetchAnalysisCaptureIdsByColumn(column: string, values: string[]) {
    const config = getSupabaseConfig();

    if (!config || values.length === 0) {
        return [] as AnalysisResultCandidate[];
    }

    const rows: AnalysisResultCandidate[] = [];

    for (const chunk of chunkValues(values, 40)) {
        const searchParams = new URLSearchParams({
            select: "capture_id,species_profile_id,normalized_identity_key,scientific_name,confidence,captures!inner(created_at)",
            completed_at: "not.is.null",
            [column]: postgrestInFilter(chunk),
            "captures.is_discoverable": "eq.true",
            "captures.status": "eq.ready",
            limit: "1000",
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

            rows.push(...await response.json() as AnalysisResultCandidate[]);
        } catch {
            continue;
        }
    }

    return rows;
}

function applyAnalysisRowsToDirectoryState(
    rows: AnalysisResultCandidate[],
    matchIndex: Map<string, Map<string, Set<string>>>,
    stateBySlug: Map<string, SpeciesDirectoryImageState>
) {
    for (const row of rows) {
        const captureId = row.capture_id?.trim();

        if (!captureId) {
            continue;
        }

        const matchedSlugs = new Set<string>();
        const columns: Array<keyof AnalysisResultCandidate> = [
            "species_profile_id",
            "normalized_identity_key",
            "scientific_name"
        ];

        for (const column of columns) {
            const value = row[column];

            if (typeof value !== "string") {
                continue;
            }

            const slugs = matchIndex.get(column)?.get(value.trim());

            if (slugs) {
                for (const slug of Array.from(slugs)) {
                    matchedSlugs.add(slug);
                }
            }
        }

        for (const slug of Array.from(matchedSlugs)) {
            const current = stateBySlug.get(slug);

            if (!current || current.hasPublicCapture) {
                continue;
            }

            stateBySlug.set(slug, {
                hasPublicCapture: true,
                captureId
            });
        }
    }
}

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
            select: DISCOVER_FEED_IMAGE_SELECT,
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
            select: "capture_id,species_profile_id,normalized_identity_key,scientific_name,confidence,captures!inner(created_at)",
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

export async function getSpeciesImageReferences(slug: string, limit = 8, entryOverride?: SpeciesEntry | null): Promise<FeaturedMedia[]> {
    const entry = entryOverride ?? getSpeciesBySlug(slug);

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

export async function getPublicCaptureImageReference(captureId: string, entry?: SpeciesEntry | null): Promise<FeaturedMedia | null> {
    const normalizedCaptureId = captureId.trim();
    if (!normalizedCaptureId) return null;

    const [image] = await fetchCaptureImages([normalizedCaptureId]);
    if (image) {
        const discoverFeedMatch = await fetchDiscoverFeedCapture(normalizedCaptureId);
        return createSpeciesImageReference({
            captureId: normalizedCaptureId,
            imageBucket: image.storage_bucket,
            imagePath: image.storage_path,
            mimeType: image.mime_type,
            mediaKind: image.media_kind,
            animalName: discoverFeedMatch?.animal_name ?? entry?.name ?? "AnimalDex capture",
            username: discoverFeedMatch?.profile_username?.trim() || null,
            contextLabel: discoverFeedMatch ? getContextLabel(discoverFeedMatch) : null,
            locationDisplayLabel: getLocationDisplayLabel(discoverFeedMatch?.location_display_label)
        });
    }

    const candidate = await fetchDiscoverFeedCapture(normalizedCaptureId);
    if (!candidate?.capture_id) return null;

    if (isUsableDiscoverFeedImage(candidate) && candidate.image_bucket && candidate.image_path) {
        return createSpeciesImageReference({
            captureId: candidate.capture_id,
            imageBucket: candidate.image_bucket,
            imagePath: candidate.image_path,
            mimeType: candidate.image_mime_type ?? null,
            mediaKind: candidate.image_media_kind ?? null,
            animalName: candidate.animal_name ?? entry?.name ?? "AnimalDex capture",
            username: candidate.profile_username?.trim() || null,
            contextLabel: getContextLabel(candidate),
            locationDisplayLabel: getLocationDisplayLabel(candidate.location_display_label)
        });
    }

    return null;
}

async function fetchDiscoverFeedCapture(captureId: string): Promise<DiscoverFeedCandidate | null> {
    const config = getSupabaseConfig();
    if (!config) return null;

    const searchParams = new URLSearchParams({
        select: "capture_id,animal_name,profile_username,location_display_label,human_context,zoo_or_wild,image_bucket,image_path,image_mime_type,image_media_kind",
        capture_id: `eq.${captureId}`,
        limit: "1"
    });

    try {
        const response = await fetch(`${config.supabaseUrl}/rest/v1/discover_feed_v1?${searchParams}`, {
            headers: getSupabaseHeaders(config.anonKey),
            next: {revalidate: 3600}
        });
        if (!response.ok) return null;
        const [candidate] = await response.json() as DiscoverFeedCandidate[];
        return candidate ?? null;
    } catch {
        return null;
    }
}

export async function buildSpeciesDirectoryImageState(entries: SpeciesEntry[]) {
    const stateBySlug = new Map<string, SpeciesDirectoryImageState>(
        entries.map((entry) => [entry.slug, {hasPublicCapture: false, captureId: null}])
    );

    if (entries.length === 0) {
        return stateBySlug;
    }

    const matchIndex = buildSpeciesDirectoryMatchIndex(entries);

    for (const [column, valueMap] of Array.from(matchIndex.entries())) {
        const rows = await fetchDiscoverFeedRowsByColumn(column, Array.from(valueMap.keys()));
        applyDiscoverFeedRowsToDirectoryState(rows, matchIndex, stateBySlug);
    }

    const unresolvedEntries = entries.filter((entry) => !stateBySlug.get(entry.slug)?.hasPublicCapture);

    if (unresolvedEntries.length > 0) {
        const unresolvedMatchIndex = buildSpeciesDirectoryMatchIndex(unresolvedEntries);
        const analysisRows: AnalysisResultCandidate[] = [];

        for (const [column, valueMap] of Array.from(unresolvedMatchIndex.entries())) {
            analysisRows.push(...await fetchAnalysisCaptureIdsByColumn(column, Array.from(valueMap.keys())));
        }

        const captureIds = Array.from(new Set(
            analysisRows
                .map((row) => row.capture_id?.trim())
                .filter((captureId): captureId is string => Boolean(captureId))
        ));
        const images = await fetchCaptureImages(captureIds.slice(0, 120));
        const captureIdsWithPhotos = new Set(images.map((image) => image.capture_id));

        for (const row of analysisRows) {
            const captureId = row.capture_id?.trim();

            if (!captureId || !captureIdsWithPhotos.has(captureId)) {
                continue;
            }

            applyAnalysisRowsToDirectoryState([row], unresolvedMatchIndex, stateBySlug);
        }
    }

    return stateBySlug;
}

export async function getSpeciesRepresentativeImageReference(slug: string, entryOverride?: SpeciesEntry | null): Promise<FeaturedMedia | null> {
    const references = await getSpeciesImageReferences(slug, 1, entryOverride);

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
