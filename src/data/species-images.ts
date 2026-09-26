import "server-only";

import type {SpeciesEntry} from "@/data/species";
import {getSpeciesBySlug} from "@/data/species";
import {
    type FeaturedMedia,
    SPECIES_NO_IMAGE_SRC,
    type SpeciesDirectoryImageState,
    type SpeciesImageReference,
    getSpeciesImageAltText,
    getSpeciesImageAttribution,
    getSpeciesImageRoute
} from "@/lib/species-image-public";
import {
    buildSpeciesCaptureMatchCandidates,
    primarySpeciesCaptureMatchCandidate,
    captureMatchesSpeciesEntry
} from "@/lib/species-breed";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";
import {computeCaptureGradeBreakdown, resolveCaptureImageGrade, type CaptureGradeBreakdown, type CaptureGradeSource} from "@/lib/capture-grade";

export {
    SPECIES_NO_IMAGE_SRC,
    type FeaturedMedia,
    type SpeciesDirectoryImageState,
    type SpeciesImageReference,
    getSpeciesImageAltText,
    getSpeciesImageAttribution,
    getSpeciesImageRoute
};

type DiscoverFeedCandidate = CaptureGradeSource & {
    capture_id?: string;
    species_profile_id?: string | null;
    normalized_identity_key?: string | null;
    scientific_name?: string | null;
    animal_name?: string | null;
    breed_guess?: string | null;
    profile_username?: string | null;
    location_display_label?: string | null;
    human_context?: string | null;
    zoo_or_wild?: string | null;
    image_bucket?: string | null;
    image_path?: string | null;
    image_mime_type?: string | null;
    image_media_kind?: string | null;
};

type AnalysisResultCandidate = CaptureGradeSource & {
    capture_id: string;
    species_profile_id?: string | null;
    normalized_identity_key?: string | null;
    scientific_name?: string | null;
    breed_guess?: string | null;
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

const DISCOVER_FEED_IMAGE_SELECT = [
    "capture_id",
    "species_profile_id",
    "normalized_identity_key",
    "scientific_name",
    "animal_name",
    "breed_guess",
    "profile_username",
    "location_display_label",
    "human_context",
    "zoo_or_wild",
    "image_bucket",
    "image_path",
    "image_mime_type",
    "image_media_kind",
    "confidence",
    "breed_confidence",
    "signals",
    "premium_details",
    "observed_market_modifiers",
    "dominance_endorsements",
    "speed_endorsements",
    "size_endorsements",
    "intelligence_endorsements",
    "rarity_endorsements",
    "raw_json"
].join(",");

const ANALYSIS_CAPTURE_SELECT = [
    "capture_id",
    "species_profile_id",
    "normalized_identity_key",
    "scientific_name",
    "animal_name",
    "breed_guess",
    "confidence",
    "breed_confidence",
    "human_context",
    "zoo_or_wild",
    "signals",
    "premium_details",
    "observed_market_modifiers",
    "raw_json",
    "captures!inner(created_at)"
].join(",");

/**
 * The directory only needs enough of a row to match it to a species and to know
 * the capture has a usable photo. The full selects above carry `raw_json`,
 * `signals` and `premium_details`, which made a single 40-value lookup return
 * ~4 MB; a directory request issued sixteen of those.
 */
const DIRECTORY_FEED_SELECT = [
    "capture_id",
    "species_profile_id",
    "normalized_identity_key",
    "scientific_name",
    "animal_name",
    "breed_guess",
    "image_bucket",
    "image_path",
    "image_mime_type",
    "image_media_kind"
].join(",");

const DIRECTORY_ANALYSIS_SELECT = [
    "capture_id",
    "species_profile_id",
    "normalized_identity_key",
    "scientific_name",
    "animal_name",
    "breed_guess",
    "confidence",
    "captures!inner(id)"
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

/** Bounds how many PostgREST requests the directory lookups keep in flight at once. */
const DIRECTORY_LOOKUP_CONCURRENCY = 8;

/**
 * Runs `task` over `items` with bounded concurrency, returning results in input
 * order. The directory lookups fan out over match columns and value chunks; doing
 * that serially cost one round trip each and was the bulk of a directory request.
 */
async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>) {
    const results: R[] = new Array(items.length);
    let cursor = 0;

    await Promise.all(Array.from({length: Math.min(limit, items.length)}, async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await task(items[index], index);
        }
    }));

    return results;
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
        for (const candidate of buildSpeciesCaptureMatchCandidates(entry)) {
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
    stateBySlug: Map<string, SpeciesDirectoryImageState>,
    entriesBySlug: Map<string, SpeciesEntry>
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
            "animal_name",
            "breed_guess"
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
            const entry = entriesBySlug.get(slug);

            if (entry && !captureMatchesSpeciesEntry(entry, row)) {
                continue;
            }

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

    const pages = await mapWithConcurrency(chunkValues(values, 40), DIRECTORY_LOOKUP_CONCURRENCY, async (chunk) => {
        const searchParams = new URLSearchParams({
            select: DIRECTORY_FEED_SELECT,
            [column]: postgrestInFilter(chunk),
            limit: "1000"
        });

        try {
            const response = await fetch(`${config.supabaseUrl}/rest/v1/discover_feed_v1?${searchParams.toString()}`, {
                headers: getSupabaseHeaders(config.anonKey),
                next: {revalidate: 3600}
            });

            if (!response.ok) {
                return [] as DiscoverFeedCandidate[];
            }

            return await response.json() as DiscoverFeedCandidate[];
        } catch {
            return [] as DiscoverFeedCandidate[];
        }
    });

    return pages.flat();
}

async function fetchAnalysisCaptureIdsByColumn(column: string, values: string[]) {
    const config = getSupabaseConfig();

    if (!config || values.length === 0) {
        return [] as AnalysisResultCandidate[];
    }

    const pages = await mapWithConcurrency(chunkValues(values, 40), DIRECTORY_LOOKUP_CONCURRENCY, async (chunk) => {
        const searchParams = new URLSearchParams({
            select: DIRECTORY_ANALYSIS_SELECT,
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
                return [] as AnalysisResultCandidate[];
            }

            return await response.json() as AnalysisResultCandidate[];
        } catch {
            return [] as AnalysisResultCandidate[];
        }
    });

    return pages.flat();
}

const ANALYSIS_MATCH_COLUMNS: Array<keyof AnalysisResultCandidate> = [
    "species_profile_id",
    "normalized_identity_key",
    "scientific_name",
    "breed_guess"
];

function matchedSlugsForAnalysisRow(
    row: AnalysisResultCandidate,
    matchIndex: Map<string, Map<string, Set<string>>>
) {
    const matchedSlugs = new Set<string>();

    for (const column of ANALYSIS_MATCH_COLUMNS) {
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

    return matchedSlugs;
}

function applyAnalysisRowsToDirectoryState(
    rows: AnalysisResultCandidate[],
    matchIndex: Map<string, Map<string, Set<string>>>,
    stateBySlug: Map<string, SpeciesDirectoryImageState>,
    entriesBySlug: Map<string, SpeciesEntry>
) {
    for (const row of rows) {
        const captureId = row.capture_id?.trim();

        if (!captureId) {
            continue;
        }

        const matchedSlugs = matchedSlugsForAnalysisRow(row, matchIndex);

        for (const slug of Array.from(matchedSlugs)) {
            const entry = entriesBySlug.get(slug);

            if (entry && !captureMatchesSpeciesEntry(entry, row)) {
                continue;
            }

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

async function fetchDiscoverFeedImageRows(
    entry: SpeciesEntry,
    candidate: {column: string; value: string}
): Promise<DiscoverFeedCandidate[]> {
    const config = getSupabaseConfig();

    if (!config) {
        return [];
    }

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
            return [];
        }

        return (await response.json() as DiscoverFeedCandidate[])
            .filter((row) => captureMatchesSpeciesEntry(entry, row));
    } catch {
        return [];
    }
}

async function fetchDiscoverableImageCandidatesBySpecies(entry: SpeciesEntry): Promise<DiscoverFeedCandidate[]> {
    const primary = primarySpeciesCaptureMatchCandidate(entry);

    if (!primary) {
        return [];
    }

    const rows = await fetchDiscoverFeedImageRows(entry, primary);
    if (rows.length > 0) {
        return rows;
    }

    if (primary.column === "species_profile_id") {
        const identity = (entry.normalizedIdentityKey ?? entry.slug.replace(/-/g, "_")).trim();
        if (identity) {
            return fetchDiscoverFeedImageRows(entry, {column: "normalized_identity_key", value: identity});
        }
    }

    return [];
}

async function fetchAnalysisRowsByCandidate(
    entry: SpeciesEntry,
    candidate: {column: string; value: string}
): Promise<AnalysisResultCandidate[]> {
    const config = getSupabaseConfig();

    if (!config) {
        return [];
    }

    const searchParams = new URLSearchParams({
        select: ANALYSIS_CAPTURE_SELECT,
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
            return [];
        }

        return (await response.json() as AnalysisResultCandidate[])
            .filter((row) => captureMatchesSpeciesEntry(entry, row))
            .sort((a, b) => {
                const confidenceDelta = (b.confidence ?? 0) - (a.confidence ?? 0);

                if (confidenceDelta !== 0) {
                    return confidenceDelta;
                }

                return new Date(b.captures?.created_at ?? 0).getTime() - new Date(a.captures?.created_at ?? 0).getTime();
            });
    } catch {
        return [];
    }
}

async function fetchAnalysisCandidatesBySpecies(entry: SpeciesEntry): Promise<AnalysisResultCandidate[]> {
    const primary = primarySpeciesCaptureMatchCandidate(entry);

    if (!primary) {
        return [];
    }

    const rows = await fetchAnalysisRowsByCandidate(entry, primary);
    if (rows.length > 0) {
        return rows;
    }

    if (primary.column === "species_profile_id") {
        const identity = (entry.normalizedIdentityKey ?? entry.slug.replace(/-/g, "_")).trim();
        if (identity) {
            return fetchAnalysisRowsByCandidate(entry, {column: "normalized_identity_key", value: identity});
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
    imageGrade: string | null;
    gradeBreakdown?: CaptureGradeBreakdown | null;
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
        imageGrade: input.imageGrade,
        gradeBreakdown: input.gradeBreakdown ?? null,
        animalName: input.animalName,
        username: input.username,
        contextLabel: input.contextLabel,
        locationDisplayLabel: input.locationDisplayLabel
    };
}

function gradeFieldsFromSource(source: CaptureGradeSource | null | undefined) {
    const gradeBreakdown = computeCaptureGradeBreakdown(source);
    return {
        imageGrade: resolveCaptureImageGrade(source),
        gradeBreakdown
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
    const analysisCandidates = discoverFeedCaptureIds.length > 0
        ? []
        : await fetchAnalysisCandidatesBySpecies(entry);
    const fallbackCaptureIds = discoverFeedCaptureIds.length > 0
        ? discoverFeedCaptureIds
        : analysisCandidates.map((row) => row.capture_id).filter(Boolean);
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
            ...gradeFieldsFromSource(candidate),
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
            const analysisMatch = analysisCandidates.find((candidate) => candidate.capture_id === captureId);

            pushReference(createSpeciesImageReference({
                captureId,
                imageBucket: image.storage_bucket,
                imagePath: image.storage_path,
                mimeType: image.mime_type,
                mediaKind: image.media_kind,
                ...gradeFieldsFromSource(discoverFeedMatch ?? analysisMatch),
                animalName: discoverFeedMatch?.animal_name ?? entry.name,
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

export async function getPublicCaptureImageReference(
    captureId: string,
    entry?: SpeciesEntry | null,
    includeDisplayMetadata = true
): Promise<FeaturedMedia | null> {
    const normalizedCaptureId = captureId.trim();
    if (!normalizedCaptureId) return null;

    const [image] = await fetchCaptureImages([normalizedCaptureId]);
    if (image) {
        const discoverFeedMatch = includeDisplayMetadata
            ? await fetchDiscoverFeedCapture(normalizedCaptureId)
            : null;
        return createSpeciesImageReference({
            captureId: normalizedCaptureId,
            imageBucket: image.storage_bucket,
            imagePath: image.storage_path,
            mimeType: image.mime_type,
            mediaKind: image.media_kind,
            ...gradeFieldsFromSource(discoverFeedMatch),
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
            ...gradeFieldsFromSource(candidate),
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
        select: "capture_id,animal_name,profile_username,location_display_label,human_context,zoo_or_wild,image_bucket,image_path,image_mime_type,image_media_kind,confidence,breed_confidence,signals,premium_details,observed_market_modifiers,dominance_endorsements,speed_endorsements,size_endorsements,intelligence_endorsements,rarity_endorsements,raw_json",
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

/**
 * Which public capture represents a species is the same for every visitor, and the
 * directory asks for the same slugs over and over as people re-sort and page. Ten
 * minutes keeps a freshly published capture from being invisible for long while
 * taking the repeat lookups off the request path entirely.
 */
const DIRECTORY_IMAGE_STATE_TTL_MS = 10 * 60 * 1000;
const DIRECTORY_IMAGE_STATE_MAX_ENTRIES = 5000;

type GlobalDirectoryImageStateCache = typeof globalThis & {
    __adexDirectoryImageState?: Map<string, {state: SpeciesDirectoryImageState; expiresAt: number}>;
};

function directoryImageStateCache() {
    const globalScope = globalThis as GlobalDirectoryImageStateCache;
    globalScope.__adexDirectoryImageState ??= new Map();
    return globalScope.__adexDirectoryImageState;
}

function readCachedDirectoryImageState(slug: string) {
    const hit = directoryImageStateCache().get(slug);
    if (!hit || hit.expiresAt <= Date.now()) return null;
    return hit.state;
}

function writeCachedDirectoryImageState(slug: string, state: SpeciesDirectoryImageState) {
    const cache = directoryImageStateCache();
    // Cheapest bound that keeps the map from growing without limit: Map iterates in
    // insertion order, so the oldest writes go first.
    if (cache.size >= DIRECTORY_IMAGE_STATE_MAX_ENTRIES) {
        for (const key of Array.from(cache.keys())) {
            cache.delete(key);
            if (cache.size < DIRECTORY_IMAGE_STATE_MAX_ENTRIES) break;
        }
    }
    cache.set(slug, {state, expiresAt: Date.now() + DIRECTORY_IMAGE_STATE_TTL_MS});
}

export function invalidateSpeciesDirectoryImageState() {
    directoryImageStateCache().clear();
}

/**
 * Every public capture that can represent a species, held in memory.
 *
 * Narrowed to the matching columns these datasets are small — a couple of
 * thousand rows and roughly 2 MB of JSON — so one scan every ten minutes serves
 * every directory page and sort from memory, instead of each request issuing
 * sixteen filtered lookups and waiting a full Supabase round trip for them.
 */
type DirectoryCaptureIndex = {
    feedRows: DiscoverFeedCandidate[];
    analysisRows: AnalysisResultCandidate[];
    captureIdsWithPhotos: Set<string>;
};

/** `index: null` records that the scan is unavailable, so the decision to use the
 *  filtered path is cached too rather than re-scanning on every request. */
type DirectoryCaptureIndexSlot = {
    index: DirectoryCaptureIndex | null;
    expiresAt: number;
};

const DIRECTORY_CAPTURE_INDEX_TTL_MS = 10 * 60 * 1000;
const DIRECTORY_CAPTURE_INDEX_RETRY_MS = 30 * 1000;
/**
 * These tables grow with user captures. Past this many rows the scan stops being
 * cheaper than filtered lookups, so the per-request path takes over again.
 */
const DIRECTORY_CAPTURE_INDEX_MAX_ROWS = 40000;
const DIRECTORY_SCAN_PAGE_SIZE = 1000;

type GlobalDirectoryCaptureIndex = typeof globalThis & {
    __adexDirectoryCaptureIndex?: DirectoryCaptureIndexSlot;
};

let directoryCaptureIndexPromise: Promise<DirectoryCaptureIndex | null> | null = null;

/** Pages a whole table, or gives up if it is larger than the cap. */
async function scanAll<T>(table: string, select: string, extra: Record<string, string> = {}) {
    const config = getSupabaseConfig();
    if (!config) return null;

    const params = new URLSearchParams({select, limit: String(DIRECTORY_SCAN_PAGE_SIZE), ...extra});
    params.set("offset", "0");

    const first = await fetch(`${config.supabaseUrl}/rest/v1/${table}?${params.toString()}`, {
        headers: getSupabaseHeaders(config.anonKey, {Prefer: "count=exact"}),
        next: {revalidate: 600}
    });
    if (!first.ok) return null;

    const firstRows = await first.json() as T[];
    const total = Number((first.headers.get("content-range") ?? "").split("/")[1]);

    if (!Number.isFinite(total) || total > DIRECTORY_CAPTURE_INDEX_MAX_ROWS) return null;
    if (firstRows.length >= total) return firstRows;

    const offsets: number[] = [];
    for (let offset = DIRECTORY_SCAN_PAGE_SIZE; offset < total; offset += DIRECTORY_SCAN_PAGE_SIZE) {
        offsets.push(offset);
    }

    const pages = await mapWithConcurrency(offsets, DIRECTORY_LOOKUP_CONCURRENCY, async (offset) => {
        const pageParams = new URLSearchParams(params);
        pageParams.set("offset", String(offset));
        const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}?${pageParams.toString()}`, {
            headers: getSupabaseHeaders(config.anonKey),
            next: {revalidate: 600}
        });
        if (!response.ok) throw new Error(`${table} scan failed at offset ${offset}: ${response.status}`);
        return await response.json() as T[];
    });

    return [...firstRows, ...pages.flat()];
}

async function loadDirectoryCaptureIndex(): Promise<DirectoryCaptureIndex | null> {
    try {
        const [feedRows, analysisRows, photoRows] = await Promise.all([
            scanAll<DiscoverFeedCandidate>("discover_feed_v1", DIRECTORY_FEED_SELECT, {
                // Newest capture represents the species, so the grid reflects recent
                // activity. capture_id breaks ties to keep offset paging stable.
                order: "capture_created_at.desc,capture_id.asc"
            }),
            scanAll<AnalysisResultCandidate>("analysis_results", DIRECTORY_ANALYSIS_SELECT, {
                completed_at: "not.is.null",
                "captures.is_discoverable": "eq.true",
                "captures.status": "eq.ready",
                // capture_id breaks confidence ties so page boundaries stay stable.
                order: "confidence.desc,capture_id.asc"
            }),
            scanAll<{capture_id: string}>("capture_images", "capture_id", {
                media_kind: "eq.photo",
                mime_type: "like.image/*",
                order: "capture_id.asc"
            })
        ]);

        if (!feedRows || !analysisRows || !photoRows) return null;

        return {
            feedRows,
            analysisRows,
            captureIdsWithPhotos: new Set(photoRows.map((row) => row.capture_id))
        };
    } catch {
        return null;
    }
}

async function ensureDirectoryCaptureIndex() {
    const globalScope = globalThis as GlobalDirectoryCaptureIndex;
    const cached = globalScope.__adexDirectoryCaptureIndex;
    if (cached && cached.expiresAt > Date.now()) return cached.index;

    directoryCaptureIndexPromise ??= loadDirectoryCaptureIndex()
        .then((index) => {
            globalScope.__adexDirectoryCaptureIndex = {
                index,
                // A failed or oversized scan is remembered for a shorter window, so
                // a transient outage does not pin the slow path for ten minutes.
                expiresAt: Date.now() + (index ? DIRECTORY_CAPTURE_INDEX_TTL_MS : DIRECTORY_CAPTURE_INDEX_RETRY_MS)
            };
            return index;
        })
        .finally(() => {
            directoryCaptureIndexPromise = null;
        });

    return directoryCaptureIndexPromise;
}

export function invalidateDirectoryCaptureIndex() {
    delete (globalThis as GlobalDirectoryCaptureIndex).__adexDirectoryCaptureIndex;
}

/**
 * Reproduces one of the old per-column lookups against the in-memory index.
 *
 * The lookups were issued one per match column and applied in that order, so a
 * capture matched on `species_profile_id` beat one matched only on `animal_name`.
 * Applying the whole index in a single pass would silently drop that precedence
 * and change which photo represents a species, so the grouping is kept.
 */
function rowsMatchingColumn<T>(rows: T[], column: string, values: Map<string, Set<string>>) {
    return rows.filter((row) => {
        const value = (row as Record<string, unknown>)[column];
        return typeof value === "string" && values.has(value.trim());
    });
}

export async function buildSpeciesDirectoryImageState(entries: SpeciesEntry[]) {
    const stateBySlug = new Map<string, SpeciesDirectoryImageState>(
        entries.map((entry) => [entry.slug, {hasPublicCapture: false, captureId: null}])
    );

    if (entries.length === 0) {
        return stateBySlug;
    }

    const pending: SpeciesEntry[] = [];
    for (const entry of entries) {
        const cached = readCachedDirectoryImageState(entry.slug);
        if (cached) {
            stateBySlug.set(entry.slug, {...cached});
        } else {
            pending.push(entry);
        }
    }

    if (pending.length === 0) {
        return stateBySlug;
    }

    const entriesBySlug = new Map(pending.map((entry) => [entry.slug, entry]));
    const matchIndex = buildSpeciesDirectoryMatchIndex(pending);
    const columns = Array.from(matchIndex.entries());

    // Whole-dataset index when it is small enough to hold, which costs no queries
    // at all; otherwise the filtered lookups, issued concurrently. Either way the
    // feed rows are applied before the analysis fallback, so the same capture wins.
    const captureIndex = await ensureDirectoryCaptureIndex();

    let feedRowGroups: DiscoverFeedCandidate[][];
    let analysisRows: AnalysisResultCandidate[];
    let captureIdsWithPhotos: Set<string> | null;

    if (captureIndex) {
        feedRowGroups = columns.map(([column, valueMap]) => rowsMatchingColumn(captureIndex.feedRows, column, valueMap));
        analysisRows = columns.flatMap(([column, valueMap]) => rowsMatchingColumn(captureIndex.analysisRows, column, valueMap));
        captureIdsWithPhotos = captureIndex.captureIdsWithPhotos;
    } else {
        [feedRowGroups, analysisRows] = await Promise.all([
            mapWithConcurrency(
                columns,
                DIRECTORY_LOOKUP_CONCURRENCY,
                ([column, valueMap]) => fetchDiscoverFeedRowsByColumn(column, Array.from(valueMap.keys()))
            ),
            mapWithConcurrency(
                columns,
                DIRECTORY_LOOKUP_CONCURRENCY,
                ([column, valueMap]) => fetchAnalysisCaptureIdsByColumn(column, Array.from(valueMap.keys()))
            ).then((pages) => pages.flat())
        ]);
        captureIdsWithPhotos = null;
    }

    for (const rows of feedRowGroups) {
        applyDiscoverFeedRowsToDirectoryState(rows, matchIndex, stateBySlug, entriesBySlug);
    }

    const unresolvedSlugs = new Set(
        pending
            .filter((entry) => !stateBySlug.get(entry.slug)?.hasPublicCapture)
            .map((entry) => entry.slug)
    );

    if (unresolvedSlugs.size > 0) {
        // Keep only rows that can still change something. On the fallback path this
        // also decides which captures are worth spending the photo lookup on.
        const relevantRows = analysisRows.filter((row) => {
            for (const slug of Array.from(matchedSlugsForAnalysisRow(row, matchIndex))) {
                if (unresolvedSlugs.has(slug)) return true;
            }
            return false;
        });

        if (relevantRows.length > 0) {
            let photoIds = captureIdsWithPhotos;

            if (!photoIds) {
                const captureIds = Array.from(new Set(
                    relevantRows
                        .map((row) => row.capture_id?.trim())
                        .filter((captureId): captureId is string => Boolean(captureId))
                ));
                const images = await fetchCaptureImages(captureIds.slice(0, 120));
                photoIds = new Set(images.map((image) => image.capture_id));
            }

            for (const row of relevantRows) {
                const captureId = row.capture_id?.trim();

                if (!captureId || !photoIds.has(captureId)) {
                    continue;
                }

                applyAnalysisRowsToDirectoryState([row], matchIndex, stateBySlug, entriesBySlug);
            }
        }
    }

    for (const entry of pending) {
        const state = stateBySlug.get(entry.slug);
        if (state) writeCachedDirectoryImageState(entry.slug, state);
    }

    return stateBySlug;
}

export async function getSpeciesRepresentativeImageReference(slug: string, entryOverride?: SpeciesEntry | null): Promise<FeaturedMedia | null> {
    const references = await getSpeciesImageReferences(slug, 1, entryOverride);

    return references[0] ?? null;
}
