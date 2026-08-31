import "server-only";

import {getCatalogBehaviorPrincipleIndex, getUnifiedSpeciesEntries, resolveCatalogBehaviorPrinciple} from "@/data/database-species-pages";
import {getLegendaryEarthBeast} from "@/data/legendary-earth-beasts";
import {getSpeciesBySlug} from "@/data/species";
import {getBehavioralPrincipleProfile} from "@/data/species-behavioral-principles";
import {speciesSystemsIntelligence} from "@/data/species-systems-intelligence";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {getCaptureImageRoute} from "@/lib/capture-storage-image";
import {resolveCaptureHeadlineDisplay, resolveChallengeAnalysisHeadlineDisplay} from "@/lib/capture-headline-display";
import {computeCaptureGradeBreakdown, shouldSuppressGradeOneUncertainty, type CaptureGradeBreakdown, type CaptureGradeSource} from "@/lib/capture-grade";
import {parseDiscoverPostId, type ParsedDiscoverPostId} from "@/lib/discover-post";
import {identityKindShortLabel} from "@/lib/identity-kind";
import {getBattlePower, getBattleTier, toEffectiveStats} from "@/lib/matchup-stats";
import {resolveCanonicalSlugFromIdentity} from "@/lib/species-life-stage-policy";
import {formatScenarioFamilyLabel, normalizeScenarioFamily} from "@/lib/matchup-result-copy";
import {logDevPerfEvent, timeDevAsync, timeDevStep} from "@/lib/dev-request-timing";
import {devCacheTtlMs, withServerMemoryCache} from "@/lib/server-memory-cache";
import {createSupabasePublicClient, createSupabaseServerClient} from "@/lib/supabase/server";

type DiscoverSupabaseClient = NonNullable<
    ReturnType<typeof createSupabaseServerClient> | ReturnType<typeof createSupabasePublicClient>
>;

type QueryRow = Record<string, unknown>;

export type DiscoverCollectorRef = {
    userId: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
    href: string | null;
};

export type DiscoverMediaAsset = {
    id: string;
    kind: "photo" | "loop" | "video";
    url: string;
    posterUrl: string | null;
    mimeType: string | null;
    durationMs: number | null;
    sortOrder: number;
};

export type DiscoverCaptureItem = {
    kind: "capture";
    id: string;
    captureId: string;
    date: string;
    capturedAt: string;
    sortRank: 2;
    activityBadge: string;
    activityLine: string | null;
    title: string | null;
    notes: string | null;
    cardStyle: string | null;
    animalName: string;
    headlineSupportingName: string | null;
    lifeStageChip: string | null;
    sameSpeciesHelper: string | null;
    speciesSlug: string | null;
    speciesProfileId: string | null;
    normalizedIdentityKey: string | null;
    identityKind: string | null;
    identityKindLabel: string | null;
    identityExplanation: string | null;
    identityEvidenceGuidance: string | null;
    battleTier: "E" | "D" | "C" | "B" | "A" | "S";
    isEligibleCapture: boolean;
    hasUncertaintyFallback: boolean;
    isZooComparisonBanned: boolean;
    isChallengeAnalysisEligible: boolean;
    hasChallengeGameStats: boolean;
    score: number;
    captureGrade: number;
    gradeBreakdown: CaptureGradeBreakdown | null;
    isUncertain: boolean;
    endorsementCount: number;
    viewerEndorsementStat: string | null;
    rarity: number;
    contextLabel: string | null;
    settingTag: string | null;
    humanContext: string | null;
    locationLabel: string | null;
    locationLat: number | null;
    locationLng: number | null;
    lifeStage: string | null;
    genderGuess: string | null;
    confidence: number | null;
    typeTags: string[];
    collector: DiscoverCollectorRef;
    imageSrc: string;
    mediaAssets: DiscoverMediaAsset[];
    href: string;
    scientificName: string | null;
    breedGuess: string | null;
    conservationTier: string | null;
    totalProgressionXP: number;
    level: number;
    recentProgressionSource: string | null;
    animalDexNumber: number | null;
    mediaCount: number;
    hasVideoMedia: boolean;
    isMediaRefreshActivity: boolean;
    isChallengeReady: boolean;
    isChallengeAvailable: boolean;
    challengeHealth: number;
    challengeStake: number;
    learnedPrinciple: string | null;
    coreLesson: string | null;
    learnedExpression: string | null;
    bestForTags: string[];
    statBoosts: Record<string, number>;
    comparisonBoosts: Record<string, number>;
    endorsementBonuses: Record<string, number>;
    gameStats: Record<string, number>;
    effectiveGameStats: Record<string, number>;
    statDeltas: Record<string, number>;
};

export type DiscoverAlignmentItem = {
    kind: "alignment";
    id: string;
    proofId: string;
    date: string;
    sortRank: 0;
    summary: string | null;
    moveTodayText: string | null;
    statBoostStat: string | null;
    rewardedCaptureId: string;
    rewardedAnimalName: string;
    collector: DiscoverCollectorRef;
    imageSrc: string;
    href: string;
};

export type DiscoverFusionItem = {
    kind: "fusion";
    id: string;
    fusionId: string;
    date: string;
    sortRank: 1;
    receiverAnimalName: string;
    donorAnimalName: string;
    receiverCaptureId: string;
    donorCaptureId: string | null;
    learnedPrinciple: string | null;
    learnedExpression: string | null;
    collector: DiscoverCollectorRef;
    receiverImageSrc: string;
    donorImageSrc: string | null;
    href: string;
};

export type DiscoverChallengeParticipant = {
    userId: string;
    captureId: string;
    animalName: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
    imageSrc: string;
    battleTier: string | null;
    battlePower: number | null;
    href: string | null;
};

export type DiscoverChallengeItem = {
    kind: "challenge";
    id: string;
    date: string;
    sortRank: 3;
    scenarioTitle: string | null;
    scenarioDomain: string | null;
    scenarioFamily: string | null;
    scenarioDescription: string | null;
    chosenStat: string | null;
    decidingEdgeLabel: string | null;
    winnerUserId: string | null;
    winnerCaptureId: string | null;
    payoutAmount: number;
    attackerContextScore: number | null;
    defenderContextScore: number | null;
    challengeFormat: string | null;
    battleStatus: string | null;
    requiredVotes: number;
    votesCount: number;
    round1WinnerCaptureId: string | null;
    round2WinnerCaptureId: string | null;
    round3WinnerCaptureId: string | null;
    overallWinnerCaptureId: string | null;
    roundsWonAttacker: number;
    roundsWonDefender: number;
    speciesComparisonSlug: string | null;
    outcomeLine: string;
    winningsLine: string | null;
    activitySummary: string;
    attacker: DiscoverChallengeParticipant;
    defender: DiscoverChallengeParticipant;
};

export type DiscoverTradeItem = {
    kind: "trade";
    id: string;
    date: string;
    sortRank: 4;
    offerer: {userId: string; name: string; username: string | null; animalName: string; imageSrc: string; href: string | null};
    receiver: {userId: string; name: string; username: string | null; animalName: string; imageSrc: string; href: string | null};
};

export type DiscoverTimelineItem =
    | DiscoverCaptureItem
    | DiscoverAlignmentItem
    | DiscoverFusionItem
    | DiscoverChallengeItem
    | DiscoverTradeItem;

export type DiscoverFeaturedItem = {
    captureId: string;
    animalName: string;
    imageSrc: string;
    href: string;
    kind: "endorsed" | "rare";
    endorsementCount: number;
    rarity: number;
};

export type DiscoverTimelineCursor = {
    date: string;
    sortRank: number;
    id: string;
};

const PLACEHOLDER_IMAGE = "/images/placeholders/species-no-image.svg";
const DUPLICATE_CAPTURE_WINDOW_MS = 120_000;

function readString(row: QueryRow, key: string) {
    const value = row[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(row: QueryRow, key: string) {
    const value = Number(row[key] ?? 0);
    return Number.isFinite(value) ? value : 0;
}

function readNullableNumber(row: QueryRow, key: string) {
    if (row[key] == null) return null;
    const value = Number(row[key]);
    return Number.isFinite(value) ? value : null;
}

function readBoolean(row: QueryRow, key: string) {
    return row[key] === true;
}

function readStats(row: QueryRow) {
    const stats = row.game_stats;
    return stats && typeof stats === "object" && !Array.isArray(stats) ? stats as Record<string, number> : {};
}

function readStringArray(row: QueryRow, key: string) {
    const value = row[key];
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => typeof item === "string" ? item.trim() : "")
        .filter(Boolean);
}

function readObjectArray(row: QueryRow, key: string) {
    const value = row[key];
    if (!Array.isArray(value)) return [] as QueryRow[];
    return value.filter((item): item is QueryRow => Boolean(item) && typeof item === "object" && !Array.isArray(item)) as QueryRow[];
}

function asQueryRow(value: unknown): QueryRow | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as QueryRow : null;
}

function normalizedToken(value: unknown) {
    if (typeof value !== "string" || !value.trim()) return null;
    return value.trim()
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function analysisToken(row: QueryRow, snakeKey: "capture_validity" | "authenticity_status", camelKey: "captureValidity" | "authenticityStatus") {
    const raw = asQueryRow(row.raw_json);
    const model = asQueryRow(raw?.model);
    const legacy = asQueryRow(raw?.raw_openai);
    return normalizedToken(row[snakeKey] ?? row[camelKey]
        ?? model?.[snakeKey] ?? model?.[camelKey]
        ?? raw?.[snakeKey] ?? raw?.[camelKey]
        ?? legacy?.[snakeKey] ?? legacy?.[camelKey]);
}

function hasStoredGameStats(stats: QueryRow) {
    return ["dominance", "speed", "size", "intelligence", "rarity"]
        .every((key) => stats[key] !== null && stats[key] !== "" && Number.isFinite(Number(stats[key])));
}

function formatLabel(value: string | null) {
    if (!value) return null;
    return value
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toSpeciesSlug(identityKey: string | null) {
    if (!identityKey) return null;
    const slug = identityKey.trim().toLowerCase().replace(/_/g, "-");
    return slug || null;
}

function getContextLabel(row: QueryRow) {
    const setting = readString(row, "zoo_or_wild");
    if (setting && setting !== "Unknown") return setting;

    switch (readString(row, "human_context")) {
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

function collectorFromRow(row: QueryRow, prefix = "profile"): DiscoverCollectorRef {
    const userId = readString(row, prefix === "profile" ? "user_id" : `${prefix}_user_id`) ?? "";
    const username = readString(row, `${prefix}_username`) ?? readString(row, "profile_username");
    const displayName = readString(row, `${prefix}_display_name`) ?? readString(row, "profile_display_name");
    const avatarUrl = readString(row, `${prefix}_avatar_url`) ?? readString(row, "profile_avatar_url");

    return {
        userId,
        name: displayName || (username ? `@${username}` : "AnimalDex collector"),
        username,
        avatarUrl,
        href: username ? `/u/${encodeURIComponent(username)}` : null
    };
}

function resolveImageSrc(
    captureId: string,
    image?: {
        bucket?: string | null;
        path?: string | null;
        mimeType?: string | null;
        mediaKind?: string | null;
    }
) {
    if (captureId) {
        const params = new URLSearchParams();
        if (image?.bucket) params.set("bucket", image.bucket);
        if (image?.path) params.set("path", image.path);
        if (image?.mimeType) params.set("mime", image.mimeType);
        if (image?.mediaKind) params.set("kind", image.mediaKind);
        const query = params.toString();
        return query ? `${getCaptureImageRoute(captureId)}?${query}` : getCaptureImageRoute(captureId);
    }

    return PLACEHOLDER_IMAGE;
}

function getCaptureMediaRoute(captureId: string, asset: Pick<DiscoverMediaAsset, "kind" | "mimeType"> & {bucket?: string | null; path?: string | null}) {
    const params = new URLSearchParams();
    if (asset.bucket) params.set("bucket", asset.bucket);
    if (asset.path) params.set("path", asset.path);
    if (asset.mimeType) params.set("mime", asset.mimeType);
    params.set("kind", asset.kind);
    const query = params.toString();
    return `/api/capture-media/${encodeURIComponent(captureId)}${query ? `?${query}` : ""}`;
}

function resolveHref(slug: string | null, identityKey: string | null = null) {
    const canonicalSlug = resolveCanonicalSlugFromIdentity(identityKey) ?? slug;
    if (!canonicalSlug) return "/animals";
    const species = getSpeciesBySlug(canonicalSlug);
    return species ? `/animals/${species.slug}` : `/animals/${canonicalSlug}`;
}

function endorsementCount(row: QueryRow) {
    const aggregate = readNullableNumber(row, "endorsement_count");
    if (aggregate != null) return aggregate;

    return readNumber(row, "dominance_endorsements")
        + readNumber(row, "speed_endorsements")
        + readNumber(row, "size_endorsements")
        + readNumber(row, "intelligence_endorsements")
        + readNumber(row, "rarity_endorsements");
}

function parseDate(value: string | null) {
    if (!value) return 0;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
}

function animalLevel(totalProgressionXP: number) {
    return Math.min(100, Math.floor(Math.sqrt(Math.max(0, totalProgressionXP))) + 1);
}

function isBroadCollectionIdentityToken(token: string) {
    const normalized = token.toLowerCase();
    return normalized === "animal"
        || normalized === "unknown_animal"
        || normalized === "unknown"
        || normalized.endsWith("_animal");
}

function shouldShowUncertaintyFallback(row: QueryRow) {
    const animalName = readString(row, "animal_name")?.toLowerCase();
    if (animalName === "unknown animal") return true;
    return Number(readNullableNumber(row, "confidence") ?? 0) < 0.4;
}

function scientificNameLooksBinomial(value: string | null) {
    const parts = value?.trim().split(/\s+/) ?? [];
    if (parts.length < 2) return false;
    return /^[A-Z][a-z-]+$/.test(parts[0]) && /^[a-z][a-z-]+$/.test(parts[1]);
}

function isBroadIdentity(row: QueryRow) {
    const kind = readString(row, "identity_kind")?.toLowerCase();
    if (kind === "group" || kind === "broad_fallback" || kind === "generic_parent") return true;

    // A proper binomial is species-level evidence, so a broad animal-name token
    // (e.g. "Fish") must not downgrade a stored species/subspecies ID.
    if (
        (kind === "species" || kind === "subspecies")
        && scientificNameLooksBinomial(readString(row, "scientific_name"))
    ) {
        return false;
    }

    const tokens = [readString(row, "normalized_identity_key"), readString(row, "animal_name")]
        .map((value) => value?.trim().toLowerCase().replace(/[\s-]+/g, "_"))
        .filter((value): value is string => Boolean(value));

    return tokens.some(isBroadCollectionIdentityToken);
}

function showsBroadIdentityAtModerateConfidence(row: QueryRow) {
    return Number(readNullableNumber(row, "confidence") ?? 0) < 0.75
        && isBroadIdentity(row)
        && !shouldShowUncertaintyFallback(row);
}

function captureGradeSourceFromRow(row: QueryRow): CaptureGradeSource {
    const signals = row.signals && typeof row.signals === "object" && !Array.isArray(row.signals)
        ? row.signals as CaptureGradeSource["signals"]
        : null;
    const premiumDetails = row.premium_details && typeof row.premium_details === "object" && !Array.isArray(row.premium_details)
        ? row.premium_details as CaptureGradeSource["premium_details"]
        : null;
    const market = row.observed_market_modifiers && typeof row.observed_market_modifiers === "object" && !Array.isArray(row.observed_market_modifiers)
        ? row.observed_market_modifiers as CaptureGradeSource["observed_market_modifiers"]
        : null;

    return {
        image_grade: readString(row, "image_grade"),
        raw_json: row.raw_json,
        animal_name: readString(row, "animal_name"),
        scientific_name: readString(row, "scientific_name"),
        breed_guess: readString(row, "breed_guess"),
        human_context: readString(row, "human_context"),
        zoo_or_wild: readString(row, "zoo_or_wild"),
        confidence: readNullableNumber(row, "confidence"),
        breed_confidence: readNullableNumber(row, "breed_confidence"),
        signals,
        premium_details: premiumDetails,
        observed_market_modifiers: market,
        dominance_endorsements: readNumber(row, "dominance_endorsements"),
        speed_endorsements: readNumber(row, "speed_endorsements"),
        size_endorsements: readNumber(row, "size_endorsements"),
        intelligence_endorsements: readNumber(row, "intelligence_endorsements"),
        rarity_endorsements: readNumber(row, "rarity_endorsements")
    };
}

function captureGradeBreakdownForRow(row: QueryRow) {
    return computeCaptureGradeBreakdown(captureGradeSourceFromRow(row));
}

function shouldShowUncertaintyVisualWarning(row: QueryRow) {
    if (shouldShowUncertaintyFallback(row)) return true;
    if (showsBroadIdentityAtModerateConfidence(row)) return true;
    if (captureGradeBreakdownForRow(row)?.grade !== 1) return false;

    return !shouldSuppressGradeOneUncertainty({
        confidence: readNullableNumber(row, "confidence"),
        identityKind: readString(row, "identity_kind") ?? readString(row, "refined_identity_kind"),
        signals: captureGradeSourceFromRow(row).signals
    });
}

function mediaKind(value: unknown) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizedMediaKind(value: unknown): DiscoverMediaAsset["kind"] {
    const kind = mediaKind(value);
    return kind === "video" || kind === "loop" ? kind : "photo";
}

function mediaAssets(row: QueryRow) {
    return readObjectArray(row, "media_assets");
}

function mediaPriority(kind: DiscoverMediaAsset["kind"]) {
    if (kind === "video") return 0;
    if (kind === "loop") return 1;
    return 2;
}

function mediaField(row: QueryRow, snakeKey: string, camelKey: string) {
    return row[snakeKey] ?? row[camelKey];
}

function rawMediaAssetRows(row: QueryRow): QueryRow[] {
    const assets = mediaAssets(row);
    if (assets.length) return assets;

    const bucket = readString(row, "image_bucket");
    const path = readString(row, "image_path");
    if (!bucket || !path) return [];

    return [{
        id: readString(row, "capture_id") ?? `${bucket}:${path}`,
        storage_bucket: bucket,
        storage_path: path,
        mime_type: readString(row, "image_mime_type"),
        media_kind: readString(row, "image_media_kind") ?? "photo",
        duration_ms: readNullableNumber(row, "image_duration_ms"),
        sort_order: 0,
        created_at: readString(row, "capture_created_at")
    }];
}

function mediaAssetKey(row: QueryRow) {
    const id = mediaField(row, "id", "id");
    if (typeof id === "string" && id.trim()) return id.trim();
    const bucket = mediaField(row, "storage_bucket", "bucket");
    const path = mediaField(row, "storage_path", "path");
    return `${typeof bucket === "string" ? bucket : ""}:${typeof path === "string" ? path : ""}`;
}

function sortMediaAssetRows(rows: QueryRow[]) {
    return [...rows].sort((left, right) => {
        const leftKind = normalizedMediaKind(mediaField(left, "media_kind", "mediaKind"));
        const rightKind = normalizedMediaKind(mediaField(right, "media_kind", "mediaKind"));
        const priorityDelta = mediaPriority(leftKind) - mediaPriority(rightKind);
        if (priorityDelta !== 0) return priorityDelta;

        const sortDelta = Number(mediaField(left, "sort_order", "sortOrder") ?? 0) - Number(mediaField(right, "sort_order", "sortOrder") ?? 0);
        if (sortDelta !== 0) return sortDelta;

        const leftCreated = parseDate(typeof mediaField(left, "created_at", "createdAt") === "string" ? mediaField(left, "created_at", "createdAt") as string : null);
        const rightCreated = parseDate(typeof mediaField(right, "created_at", "createdAt") === "string" ? mediaField(right, "created_at", "createdAt") as string : null);
        if (leftCreated !== rightCreated) return leftCreated - rightCreated;

        return mediaAssetKey(left).localeCompare(mediaAssetKey(right));
    });
}

function toMediaAsset(captureId: string, row: QueryRow, analysisPhoto: QueryRow | null): DiscoverMediaAsset | null {
    const bucket = mediaField(row, "storage_bucket", "bucket");
    const path = mediaField(row, "storage_path", "path");
    if (typeof bucket !== "string" || !bucket.trim() || typeof path !== "string" || !path.trim()) return null;

    const kind = normalizedMediaKind(mediaField(row, "media_kind", "mediaKind"));
    const mimeType = typeof mediaField(row, "mime_type", "mimeType") === "string"
        ? mediaField(row, "mime_type", "mimeType") as string
        : null;
    const duration = Number(mediaField(row, "duration_ms", "durationMs") ?? 0);
    const sortOrder = Number(mediaField(row, "sort_order", "sortOrder") ?? 0);
    const posterBucket = mediaField(row, "poster_storage_bucket", "posterBucket");
    const posterPath = mediaField(row, "poster_storage_path", "posterPath");
    const fallbackPosterBucket = analysisPhoto ? mediaField(analysisPhoto, "storage_bucket", "bucket") : null;
    const fallbackPosterPath = analysisPhoto ? mediaField(analysisPhoto, "storage_path", "path") : null;
    const resolvedPosterBucket = kind === "photo" ? null : typeof posterBucket === "string" && posterBucket.trim() ? posterBucket : fallbackPosterBucket;
    const resolvedPosterPath = kind === "photo" ? null : typeof posterPath === "string" && posterPath.trim() ? posterPath : fallbackPosterPath;

    return {
        id: mediaAssetKey(row),
        kind,
        url: kind === "photo"
            ? resolveImageSrc(captureId, {bucket, path, mimeType, mediaKind: kind})
            : getCaptureMediaRoute(captureId, {bucket, path, mimeType, kind}),
        posterUrl: typeof resolvedPosterBucket === "string" && typeof resolvedPosterPath === "string"
            ? resolveImageSrc(captureId, {bucket: resolvedPosterBucket, path: resolvedPosterPath, mimeType: "image/jpeg", mediaKind: "photo"})
            : null,
        mimeType,
        durationMs: Number.isFinite(duration) && duration > 0 ? duration : null,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0
    };
}

function discoverMediaAssets(row: QueryRow, captureId: string): DiscoverMediaAsset[] {
    const rows = sortMediaAssetRows(rawMediaAssetRows(row));
    const analysisPhoto = rows.find((asset) => {
        const kind = normalizedMediaKind(mediaField(asset, "media_kind", "mediaKind"));
        const sortOrder = Number(mediaField(asset, "sort_order", "sortOrder") ?? 0);
        return kind === "photo" && sortOrder === 0;
    }) ?? rows.find((asset) => normalizedMediaKind(mediaField(asset, "media_kind", "mediaKind")) === "photo") ?? null;

    const mapped = rows
        .map((asset) => toMediaAsset(captureId, asset, analysisPhoto))
        .filter((asset): asset is DiscoverMediaAsset => Boolean(asset));

    return mapped.length ? mapped : [{
        id: `${captureId}:fallback`,
        kind: "photo",
        url: resolveImageSrc(captureId),
        posterUrl: null,
        mimeType: null,
        durationMs: null,
        sortOrder: 0
    }];
}

function hasVideoMedia(row: QueryRow) {
    return rawMediaAssetRows(row).some((asset) => {
        const kind = normalizedMediaKind(mediaField(asset, "media_kind", "mediaKind"));
        return kind === "loop" || kind === "video";
    });
}

function mediaCount(row: QueryRow) {
    const assets = rawMediaAssetRows(row);
    return Math.max(1, assets.length);
}

function isMediaRefreshActivity(row: QueryRow) {
    const count = mediaCount(row);
    const feedActivityAt = parseDate(readString(row, "feed_activity_at"));
    const captureCreatedAt = parseDate(readString(row, "capture_created_at"));
    return count > 1 && feedActivityAt > 0 && captureCreatedAt > 0 && feedActivityAt - captureCreatedAt > 120_000;
}

function timelineActivityBadge(row: QueryRow) {
    const count = mediaCount(row);
    const video = hasVideoMedia(row);
    if (isMediaRefreshActivity(row)) return video ? "Added media" : "Added photos";
    if (count > 1) return video ? `${count} media` : `${count} photos`;
    return "Capture";
}

function learnedPrinciples(row: QueryRow) {
    return readObjectArray(row, "learned_sub_principles");
}

function primaryLearnedPrincipleName(row: QueryRow) {
    const principles = learnedPrinciples(row);
    const equipped = principles.find((item) => item.is_equipped === true) ?? principles[0];
    return readString(equipped ?? {}, "receiver_principle_name");
}

function formatDecidingStatLabel(value: string | null) {
    if (!value) return null;
    return value
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function challengeWinnerXpAmount(attackerWon: boolean, item: {
    attackerContextScore: number | null;
    defenderContextScore: number | null;
}) {
    const winnerScore = attackerWon ? item.attackerContextScore : item.defenderContextScore;
    if (winnerScore == null) return 10;
    return winnerScore >= 85 ? 15 : 10;
}

function challengeActivitySummary(input: {
    winnerAnimalName: string;
    loserAnimalName: string;
    scenarioFamily: string | null;
    winnerXpAmount: number;
}) {
    const scenarioText = input.scenarioFamily
        ? ` in a ${formatScenarioFamilyLabel(input.scenarioFamily) ?? input.scenarioFamily} scenario`
        : "";
    return `${input.winnerAnimalName} proved the best fit${scenarioText}. +${input.winnerXpAmount} XP. ${input.loserAnimalName} still gained +3 XP.`;
}

function challengeOutcomeLine(input: {
    scenarioTitle: string | null;
    chosenStat: string | null;
    winnerDisplayName: string;
}) {
    if (input.scenarioTitle) {
        return `${input.scenarioTitle} favored ${input.winnerDisplayName}`;
    }

    const statLabel = formatDecidingStatLabel(input.chosenStat);
    if (statLabel) {
        return `${input.winnerDisplayName} had the edge on ${statLabel}`;
    }

    return `${input.winnerDisplayName} had the edge`;
}

function challengeWinningsLine(winnerDisplayName: string, payoutAmount: number) {
    if (payoutAmount <= 0) return null;
    return `${winnerDisplayName} won ${payoutAmount} credit${payoutAmount === 1 ? "" : "s"}`;
}

function mapChallengeParticipant(
    row: QueryRow,
    side: "attacker" | "defender"
): DiscoverChallengeParticipant {
    const captureId = readString(row, `${side}_capture_id`) ?? "";
    const userId = readString(row, `${side}_user_id`) ?? "";
    const username = readString(row, `${side}_profile_username`);
    const displayName = readString(row, `${side}_profile_display_name`)
        ?? (username ? `@${username}` : "Collector");
    const avatarUrl = readString(row, `${side}_profile_avatar_url`);
    const headline = resolveChallengeAnalysisHeadlineDisplay(row, side);

    return {
        userId,
        captureId,
        animalName: headline.animalName,
        displayName,
        username,
        avatarUrl,
        imageSrc: resolveImageSrc(captureId, {
            bucket: readString(row, `${side}_image_bucket`),
            path: readString(row, `${side}_image_path`),
            mimeType: readString(row, `${side}_image_mime_type`),
            mediaKind: readString(row, `${side}_image_media_kind`)
        }),
        battleTier: readString(row, `${side}_tier`),
        battlePower: readNullableNumber(row, `${side}_battle_power`),
        href: username ? `/u/${encodeURIComponent(username)}` : null
    };
}

function learnedBestForTags(row: QueryRow) {
    const principles = learnedPrinciples(row);
    const prioritized = principles.find((item) => item.is_equipped === true) ? principles.filter((item) => item.is_equipped === true) : principles;
    const seen = new Set<string>();
    const tags: string[] = [];

    for (const principle of prioritized) {
        const scenarioTags = Array.isArray(principle.scenario_tags) ? principle.scenario_tags : [];
        for (const tag of scenarioTags) {
            const label = typeof tag === "string" ? tag.trim() : "";
            const key = label.toLowerCase();
            if (!label || seen.has(key)) continue;
            seen.add(key);
            tags.push(label);
            if (tags.length >= 4) return tags;
        }
    }

    return tags;
}

function statBoosts(row: QueryRow) {
    return {
        dominance: readNumber(row, "dominance_boost"),
        speed: readNumber(row, "speed_boost"),
        intelligence: readNumber(row, "intelligence_boost")
    };
}

function comparisonBoosts(row: QueryRow) {
    return {
        dominance: readNumber(row, "comparison_dominance_boost"),
        speed: readNumber(row, "comparison_speed_boost"),
        size: readNumber(row, "comparison_size_boost"),
        intelligence: readNumber(row, "comparison_intelligence_boost"),
        rarity: readNumber(row, "comparison_rarity_boost")
    };
}

function endorsementBonuses(row: QueryRow) {
    return {
        dominance: readNumber(row, "dominance_endorsements"),
        speed: readNumber(row, "speed_endorsements"),
        size: readNumber(row, "size_endorsements"),
        intelligence: readNumber(row, "intelligence_endorsements"),
        rarity: readNumber(row, "rarity_endorsements")
    };
}

async function buildAnimalDexNumberIndex() {
    const entries = await getUnifiedSpeciesEntries();
    const index = new Map<string, number>();

    for (const entry of entries) {
        const number = getAnimalDexNumberFromEntry(entry);
        if (!number) continue;

        index.set(entry.slug.toLowerCase(), number);

        if (entry.normalizedIdentityKey) {
            index.set(entry.normalizedIdentityKey.toLowerCase(), number);
            index.set(entry.normalizedIdentityKey.toLowerCase().replace(/_/g, "-"), number);
        }

        if (entry.speciesProfileId) {
            index.set(entry.speciesProfileId.toLowerCase(), number);
        }
    }

    return index;
}

function resolveAnimalDexNumber(
    row: QueryRow,
    slug: string | null,
    species: ReturnType<typeof getSpeciesBySlug> | null,
    animalDexNumbers: Map<string, number>
) {
    const staticNumber = species ? getAnimalDexNumberFromEntry(species) : null;
    if (staticNumber) return staticNumber;

    const speciesProfileId = readString(row, "species_profile_id")?.toLowerCase();
    if (speciesProfileId && animalDexNumbers.has(speciesProfileId)) {
        return animalDexNumbers.get(speciesProfileId) ?? null;
    }

    const identityKey = readString(row, "normalized_identity_key")?.toLowerCase();
    if (identityKey) {
        return animalDexNumbers.get(identityKey)
            ?? animalDexNumbers.get(identityKey.replace(/_/g, "-"))
            ?? null;
    }

    return slug ? animalDexNumbers.get(slug) ?? null : null;
}

function readPremiumCoreLesson(premiumDetails: Record<string, unknown> | null | undefined) {
    if (!premiumDetails) {
        return null;
    }

    for (const key of ["core_lesson", "coreLesson", "lesson"]) {
        const value = premiumDetails[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return null;
}

function resolveCaptureCoreLesson(
    catalogPrinciple: ReturnType<typeof resolveCatalogBehaviorPrinciple>,
    species: ReturnType<typeof getSpeciesBySlug> | null,
    premiumDetails: Record<string, unknown> | null | undefined
) {
    const catalogLesson = catalogPrinciple?.coreLesson?.trim();
    if (catalogLesson) {
        return catalogLesson;
    }

    if (species) {
        const staticLesson = getBehavioralPrincipleProfile(
            species.slug,
            speciesSystemsIntelligence[species.slug],
            speciesSystemsIntelligence
        )?.coreLesson?.trim();
        if (staticLesson) {
            return staticLesson;
        }

        const legendaryLesson = getLegendaryEarthBeast(species.slug)?.lesson?.trim();
        if (legendaryLesson) {
            return legendaryLesson;
        }
    }

    return readPremiumCoreLesson(premiumDetails);
}

function mapCaptureRow(
    row: QueryRow,
    animalDexNumbers: Map<string, number>,
    behaviorPrinciples: Awaited<ReturnType<typeof getCatalogBehaviorPrincipleIndex>>
): DiscoverCaptureItem {
    const captureId = readString(row, "capture_id") ?? "";
    const identityKey = readString(row, "normalized_identity_key");
    const slug = toSpeciesSlug(identityKey);
    const canonicalSlug = resolveCanonicalSlugFromIdentity(identityKey) ?? slug;
    const species = canonicalSlug ? getSpeciesBySlug(canonicalSlug) : null;
    const stats = readStats(row);
    const catalogPrinciple = resolveCatalogBehaviorPrinciple(
        behaviorPrinciples,
        readString(row, "species_profile_id"),
        identityKey,
        readString(row, "scientific_name")
    );
    const progressionXP = readNumber(row, "total_progression_xp");
    const collector = collectorFromRow(row);
    const refreshedMedia = isMediaRefreshActivity(row);
    const learnedPrincipleName = primaryLearnedPrincipleName(row);
    const media = discoverMediaAssets(row, captureId);
    const premiumDetails = row.premium_details && typeof row.premium_details === "object" && !Array.isArray(row.premium_details)
        ? row.premium_details as Record<string, unknown>
        : null;
    const headline = resolveCaptureHeadlineDisplay({
        animalName: readString(row, "animal_name"),
        scientificName: readString(row, "scientific_name"),
        breedGuess: readString(row, "breed_guess"),
        refinedIdentity: readString(row, "refined_identity"),
        breedConfidence: readNullableNumber(row, "breed_confidence"),
        confidence: readNullableNumber(row, "confidence"),
        normalizedIdentityKey: identityKey,
        lifeStage: readString(row, "life_stage"),
        canonicalDisplayName: species?.name ?? null,
        humanContext: readString(row, "human_context"),
        zooOrWild: readString(row, "zoo_or_wild"),
        premiumDetails
    });
    const animalName = headline.animalName;
    const catalogBestFor = catalogPrinciple?.bestUseCases ?? [];
    const learnedTags = learnedBestForTags(row);
    const gradeBreakdown = captureGradeBreakdownForRow(row);
    const grade = gradeBreakdown?.grade ?? 1;
    const boosts = statBoosts(row);
    const comparison = comparisonBoosts(row);
    const endorsements = endorsementBonuses(row);
    const effectiveStats = toEffectiveStats(stats, {
        dominance: boosts.dominance + comparison.dominance + endorsements.dominance,
        speed: boosts.speed + comparison.speed + endorsements.speed,
        size: comparison.size + endorsements.size,
        intelligence: boosts.intelligence + comparison.intelligence + endorsements.intelligence,
        rarity: comparison.rarity + endorsements.rarity
    });
    const statDeltas = Object.fromEntries(
        ["dominance", "speed", "size", "intelligence", "rarity"].map((key) => [
            key,
            Math.max(0, Number(effectiveStats[key as keyof typeof effectiveStats] ?? 0) - Number(stats[key] ?? 0))
        ])
    );
    const identityKind = readString(row, "identity_kind") ?? readString(row, "refined_identity_kind");
    const isUncertain = shouldShowUncertaintyVisualWarning(row);
    const hasUncertaintyFallback = shouldShowUncertaintyFallback(row);
    const captureValidity = analysisToken(row, "capture_validity", "captureValidity")
        ?? (readString(row, "animal_name")?.toLowerCase() === "unknown animal" ? "no_animal_detected" : "unclear_capture");
    const authenticityStatus = analysisToken(row, "authenticity_status", "authenticityStatus");
    const signals = asQueryRow(row.signals);
    const isZooComparisonBanned = readString(row, "zoo_or_wild")?.toLowerCase() === "zoo"
        || signals?.zoo_context_likely === true
        || signals?.zooContextLikely === true
        || signals?.likely_near_zoo === true;
    const isValidLiveCapture = captureValidity === "valid_live_capture" || captureValidity === "valid_live" || captureValidity === "live_capture";
    const isEligibleCapture = isValidLiveCapture || captureValidity === "unclear_capture";
    const hasChallengeGameStats = hasStoredGameStats(stats);
    const isChallengeAnalysisEligible = isValidLiveCapture
        && authenticityStatus !== "likely_non_live_source"
        && !hasUncertaintyFallback
        && !isZooComparisonBanned;

    return {
        kind: "capture",
        id: `capture-${captureId}`,
        captureId,
        date: readString(row, "feed_activity_at") ?? readString(row, "capture_created_at") ?? new Date(0).toISOString(),
        capturedAt: readString(row, "capture_created_at") ?? new Date(0).toISOString(),
        sortRank: 2,
        activityBadge: timelineActivityBadge(row),
        activityLine: refreshedMedia ? `${collector.name} added ${hasVideoMedia(row) ? "media" : "photos"} to ${animalName}` : null,
        title: readString(row, "capture_title"),
        notes: readString(row, "capture_notes"),
        cardStyle: formatLabel(readString(row, "card_style")),
        animalName,
        headlineSupportingName: headline.headlineSupportingName,
        lifeStageChip: headline.lifeStageChip,
        sameSpeciesHelper: headline.sameSpeciesHelper,
        speciesSlug: canonicalSlug,
        speciesProfileId: readString(row, "species_profile_id"),
        normalizedIdentityKey: identityKey,
        identityKind,
        identityKindLabel: isUncertain ? null : identityKindShortLabel(identityKind),
        identityExplanation: isUncertain ? null : readString(row, "identity_explanation"),
        identityEvidenceGuidance: isUncertain ? null : readString(row, "identity_evidence_guidance"),
        battleTier: getBattleTier(getBattlePower(effectiveStats)),
        isEligibleCapture,
        hasUncertaintyFallback,
        isZooComparisonBanned,
        isChallengeAnalysisEligible,
        hasChallengeGameStats,
        score: readNumber(row, "score"),
        captureGrade: grade,
        gradeBreakdown,
        isUncertain,
        endorsementCount: endorsementCount(row),
        viewerEndorsementStat: formatLabel(readString(row, "viewer_endorsement_stat")),
        rarity: readNumber(stats, "rarity"),
        contextLabel: getContextLabel(row),
        settingTag: readString(row, "zoo_or_wild"),
        humanContext: readString(row, "human_context"),
        locationLabel: readString(row, "location_display_label"),
        locationLat: readNullableNumber(row, "location_lat"),
        locationLng: readNullableNumber(row, "location_lng"),
        lifeStage: formatLabel(readString(row, "life_stage")),
        genderGuess: formatLabel(readString(row, "gender_guess")),
        confidence: readNullableNumber(row, "confidence"),
        typeTags: readStringArray(row, "type_tags").map((tag) => formatLabel(tag) ?? tag).slice(0, 5),
        collector,
        imageSrc: media[0]?.posterUrl ?? media[0]?.url ?? resolveImageSrc(captureId),
        mediaAssets: media,
        href: resolveHref(slug, identityKey),
        scientificName: readString(row, "scientific_name"),
        breedGuess: readString(row, "breed_guess"),
        conservationTier: readString(row, "conservation_tier"),
        totalProgressionXP: progressionXP,
        level: animalLevel(progressionXP),
        recentProgressionSource: readString(row, "recent_progression_source"),
        animalDexNumber: resolveAnimalDexNumber(row, slug, species, animalDexNumbers),
        mediaCount: mediaCount(row),
        hasVideoMedia: media.some((asset) => asset.kind === "loop" || asset.kind === "video"),
        isMediaRefreshActivity: refreshedMedia,
        isChallengeReady: readBoolean(row, "is_challenge_ready"),
        isChallengeAvailable: readBoolean(row, "challenge_available"),
        challengeHealth: readNumber(row, "challenge_health") || 3,
        challengeStake: readNumber(row, "challenge_stake") || 1,
        learnedPrinciple: catalogPrinciple?.principleName ?? learnedPrincipleName,
        coreLesson: resolveCaptureCoreLesson(catalogPrinciple, species, premiumDetails),
        learnedExpression: null,
        bestForTags: catalogBestFor.length ? catalogBestFor.slice(0, 4) : learnedTags,
        statBoosts: boosts,
        comparisonBoosts: comparison,
        endorsementBonuses: endorsements,
        gameStats: stats,
        effectiveGameStats: effectiveStats,
        statDeltas
    };
}

function mapAlignmentRow(row: QueryRow): DiscoverAlignmentItem {
    const proofId = readString(row, "proof_id") ?? "";
    const rewardedCaptureId = readString(row, "rewarded_capture_id") ?? "";
    const identityKey = readString(row, "normalized_identity_key");
    const slug = toSpeciesSlug(identityKey);

    return {
        kind: "alignment",
        id: `alignment-${proofId}`,
        proofId,
        date: readString(row, "completed_at") ?? new Date(0).toISOString(),
        sortRank: 0,
        summary: readString(row, "timeline_summary"),
        moveTodayText: readString(row, "move_today_text"),
        statBoostStat: readString(row, "stat_boost_stat"),
        rewardedCaptureId,
        rewardedAnimalName: readString(row, "rewarded_animal_name") ?? "Animal",
        collector: collectorFromRow(row),
        imageSrc: resolveImageSrc(rewardedCaptureId),
        href: resolveHref(slug, identityKey)
    };
}

function mapFusionRow(row: QueryRow): DiscoverFusionItem {
    const fusionId = readString(row, "fusion_id") ?? "";
    const receiverCaptureId = readString(row, "receiver_capture_id") ?? "";
    const donorCaptureId = readString(row, "public_donor_capture_id");

    return {
        kind: "fusion",
        id: `fusion-${fusionId}`,
        fusionId,
        date: readString(row, "created_at") ?? new Date(0).toISOString(),
        sortRank: 1,
        receiverAnimalName: readString(row, "receiver_animal_name") ?? "Animal",
        donorAnimalName: readString(row, "donor_animal_name") ?? "teacher",
        receiverCaptureId,
        donorCaptureId,
        learnedPrinciple: readString(row, "learned_sub_principle_name"),
        learnedExpression: readString(row, "learned_sub_principle_expression"),
        collector: collectorFromRow(row),
        receiverImageSrc: resolveImageSrc(receiverCaptureId),
        donorImageSrc: donorCaptureId ? resolveImageSrc(donorCaptureId) : null,
        href: resolveHref(null)
    };
}

function mapChallengeRow(row: QueryRow): DiscoverChallengeItem {
    const id = readString(row, "id") ?? "";
    const attacker = mapChallengeParticipant(row, "attacker");
    const defender = mapChallengeParticipant(row, "defender");
    const winnerCaptureId = readString(row, "winner_capture_id");
    const winnerUserId = readString(row, "winner_user_id");
    const attackerWon = winnerCaptureId === attacker.captureId;
    const winner = attackerWon ? attacker : defender;
    const loser = attackerWon ? defender : attacker;
    const scenarioTitle = readString(row, "scenario_title");
    const chosenStat = readString(row, "chosen_stat");
    const scenarioFamily = normalizeScenarioFamily(readString(row, "scenario_family"));
    const payoutAmount = readNumber(row, "payout_amount");
    const attackerContextScore = readNullableNumber(row, "attacker_context_score");
    const defenderContextScore = readNullableNumber(row, "defender_context_score");
    const winnerXpAmount = challengeWinnerXpAmount(attackerWon, {attackerContextScore, defenderContextScore});

    return {
        kind: "challenge",
        id: `challenge-${id}`,
        date: readString(row, "created_at") ?? new Date(0).toISOString(),
        sortRank: 3,
        scenarioTitle,
        scenarioDomain: readString(row, "scenario_domain"),
        scenarioFamily,
        scenarioDescription: readString(row, "scenario_description"),
        chosenStat,
        decidingEdgeLabel: readString(row, "deciding_edge_label"),
        winnerUserId,
        winnerCaptureId,
        payoutAmount,
        attackerContextScore,
        defenderContextScore,
        challengeFormat: readString(row, "challenge_format"),
        battleStatus: readString(row, "battle_status"),
        requiredVotes: readNumber(row, "required_votes"),
        votesCount: readNumber(row, "votes_count"),
        round1WinnerCaptureId: readString(row, "round1_winner_capture_id"),
        round2WinnerCaptureId: readString(row, "round2_winner_capture_id"),
        round3WinnerCaptureId: readString(row, "round3_winner_capture_id"),
        overallWinnerCaptureId: readString(row, "overall_winner_capture_id"),
        roundsWonAttacker: readNumber(row, "rounds_won_attacker"),
        roundsWonDefender: readNumber(row, "rounds_won_defender"),
        speciesComparisonSlug: readString(row, "round3_species_comparison_slug"),
        outcomeLine: challengeOutcomeLine({
            scenarioTitle,
            chosenStat,
            winnerDisplayName: winner.displayName
        }),
        winningsLine: challengeWinningsLine(winner.displayName, payoutAmount),
        activitySummary: challengeActivitySummary({
            winnerAnimalName: winner.animalName,
            loserAnimalName: loser.animalName,
            scenarioFamily,
            winnerXpAmount
        }),
        attacker,
        defender
    };
}

function mapTradeRow(row: QueryRow): DiscoverTradeItem {
    const id = readString(row, "id") ?? "";
    const offererCaptureId = readString(row, "offerer_capture_id") ?? "";
    const receiverCaptureId = readString(row, "receiver_capture_id") ?? "";
    const offererUsername = readString(row, "offerer_profile_username");
    const receiverUsername = readString(row, "receiver_profile_username");

    return {
        kind: "trade",
        id: `trade-${id}`,
        date: readString(row, "completed_at") ?? readString(row, "created_at") ?? new Date(0).toISOString(),
        sortRank: 4,
        offerer: {
            userId: readString(row, "offerer_user_id") ?? "",
            name: readString(row, "offerer_profile_display_name") ?? (offererUsername ? `@${offererUsername}` : "Collector"),
            username: offererUsername,
            animalName: readString(row, "offerer_animal_name") ?? "Animal",
            imageSrc: resolveImageSrc(offererCaptureId, {
                bucket: readString(row, "offerer_image_bucket"),
                path: readString(row, "offerer_image_path"),
                mimeType: readString(row, "offerer_image_mime_type"),
                mediaKind: readString(row, "offerer_image_media_kind")
            }),
            href: offererUsername ? `/u/${encodeURIComponent(offererUsername)}` : null
        },
        receiver: {
            userId: readString(row, "receiver_user_id") ?? "",
            name: readString(row, "receiver_profile_display_name") ?? (receiverUsername ? `@${receiverUsername}` : "Collector"),
            username: receiverUsername,
            animalName: readString(row, "receiver_animal_name") ?? "Animal",
            imageSrc: resolveImageSrc(receiverCaptureId, {
                bucket: readString(row, "receiver_image_bucket"),
                path: readString(row, "receiver_image_path"),
                mimeType: readString(row, "receiver_image_mime_type"),
                mediaKind: readString(row, "receiver_image_media_kind")
            }),
            href: receiverUsername ? `/u/${encodeURIComponent(receiverUsername)}` : null
        }
    };
}

function excludedCaptureIds(
    captures: DiscoverCaptureItem[],
    alignments: DiscoverAlignmentItem[],
    fusions: DiscoverFusionItem[]
) {
    const captureById = new Map(captures.map((item) => [item.captureId, item]));
    const excluded = new Set<string>();

    for (const proof of alignments) {
        const capture = captureById.get(proof.rewardedCaptureId);
        if (!capture) continue;
        if (Math.abs(parseDate(capture.date) - parseDate(proof.date)) < DUPLICATE_CAPTURE_WINDOW_MS) {
            excluded.add(proof.rewardedCaptureId);
        }
    }

    for (const fusion of fusions) {
        const capture = captureById.get(fusion.receiverCaptureId);
        if (!capture) continue;
        if (Math.abs(parseDate(capture.date) - parseDate(fusion.date)) < DUPLICATE_CAPTURE_WINDOW_MS) {
            excluded.add(fusion.receiverCaptureId);
        }
    }

    return excluded;
}

export function buildDiscoverTimeline(
    captures: DiscoverCaptureItem[],
    alignments: DiscoverAlignmentItem[],
    fusions: DiscoverFusionItem[],
    challenges: DiscoverChallengeItem[],
    trades: DiscoverTradeItem[],
    limit = 60
): DiscoverTimelineItem[] {
    const excluded = excludedCaptureIds(captures, alignments, fusions);
    const captureItems = captures
        .filter((item) => !excluded.has(item.captureId))
        .map((item) => item as DiscoverTimelineItem);

    const items: DiscoverTimelineItem[] = [
        ...captureItems,
        ...alignments,
        ...fusions,
        ...challenges,
        ...trades
    ];

    return items
        .sort((left, right) => {
            const leftDate = parseDate(left.date);
            const rightDate = parseDate(right.date);
            if (leftDate === rightDate) {
                if (left.sortRank !== right.sortRank) return left.sortRank - right.sortRank;
                return left.id.localeCompare(right.id);
            }
            return rightDate - leftDate;
        })
        .slice(0, limit);
}

function timelineCursorForItem(item: DiscoverTimelineItem): DiscoverTimelineCursor {
    return {date: item.date, sortRank: item.sortRank, id: item.id};
}

function itemIsAfterTimelineCursor(item: DiscoverTimelineItem, cursor: DiscoverTimelineCursor) {
    const itemDate = parseDate(item.date);
    const cursorDate = parseDate(cursor.date);
    if (itemDate !== cursorDate) return itemDate < cursorDate;
    if (item.sortRank !== cursor.sortRank) return item.sortRank > cursor.sortRank;
    return item.id.localeCompare(cursor.id) > 0;
}

export function buildDiscoverFeatured(captures: DiscoverCaptureItem[]): DiscoverFeaturedItem[] {
    const topEndorsed = [...captures]
        .filter((item) => item.endorsementCount > 0)
        .sort((left, right) => {
            if (left.endorsementCount !== right.endorsementCount) return right.endorsementCount - left.endorsementCount;
            if (left.rarity !== right.rarity) return right.rarity - left.rarity;
            return parseDate(left.date) - parseDate(right.date);
        })
        .map((item) => ({
            captureId: item.captureId,
            animalName: item.animalName,
            imageSrc: item.imageSrc,
            href: item.href,
            kind: "endorsed" as const,
            endorsementCount: item.endorsementCount,
            rarity: item.rarity
        }));

    const rareFinds = [...captures]
        .sort((left, right) => {
            if (left.rarity !== right.rarity) return right.rarity - left.rarity;
            if (left.endorsementCount !== right.endorsementCount) return right.endorsementCount - left.endorsementCount;
            return parseDate(left.date) - parseDate(right.date);
        })
        .map((item) => ({
            captureId: item.captureId,
            animalName: item.animalName,
            imageSrc: item.imageSrc,
            href: item.href,
            kind: "rare" as const,
            endorsementCount: item.endorsementCount,
            rarity: item.rarity
        }));

    const seen = new Set<string>();
    const result: DiscoverFeaturedItem[] = [];

    for (const item of topEndorsed.slice(0, 6)) {
        if (seen.has(item.captureId)) continue;
        seen.add(item.captureId);
        result.push(item);
    }

    const rareLimit = result.length === 0 ? 10 : 8;
    for (const item of rareFinds.slice(0, rareLimit)) {
        if (seen.has(item.captureId)) continue;
        seen.add(item.captureId);
        result.push(item);
        if (result.length >= 12) break;
    }

    return result;
}

const discoverChallengeSelect = [
    "id", "created_at", "attacker_user_id", "attacker_capture_id", "defender_user_id", "defender_capture_id",
    "attacker_battle_power", "defender_battle_power", "attacker_tier", "defender_tier",
    "winner_user_id", "winner_capture_id", "chosen_stat", "attacker_stat_value", "defender_stat_value",
    "resolution_rule", "points_awarded", "rewarded", "stake_amount", "escrow_amount", "payout_amount", "burn_amount",
    "scenario_key", "scenario_family", "scenario_domain", "scenario_title", "scenario_description",
    "deciding_edge_label", "attacker_context_score", "defender_context_score",
    "winner_explanation", "strategic_insight", "scenario_version",
    "challenge_format", "battle_status", "required_votes", "votes_count",
    "round1_winner_capture_id", "round2_winner_capture_id", "round3_winner_capture_id",
    "overall_winner_capture_id", "rounds_won_attacker", "rounds_won_defender",
    "round3_species_comparison_slug",
    "attacker_profile_display_name", "attacker_profile_username", "attacker_profile_avatar_url", "attacker_profile_instagram_url",
    "defender_profile_display_name", "defender_profile_username", "defender_profile_avatar_url", "defender_profile_instagram_url",
    "attacker_animal_name", "attacker_scientific_name", "attacker_breed_guess", "attacker_breed_confidence",
    "attacker_human_context", "attacker_life_stage", "attacker_gender_guess", "attacker_gender_confidence",
    "attacker_zoo_or_wild", "attacker_conservation_tier", "attacker_confidence", "attacker_type_tags",
    "attacker_signals", "attacker_raw_json", "attacker_game_stats", "attacker_premium_details", "attacker_place_or_habitat_label",
    "attacker_image_bucket", "attacker_image_path", "attacker_image_mime_type", "attacker_image_media_kind", "attacker_image_duration_ms",
    "defender_animal_name", "defender_scientific_name", "defender_breed_guess", "defender_breed_confidence",
    "defender_human_context", "defender_life_stage", "defender_gender_guess", "defender_gender_confidence",
    "defender_zoo_or_wild", "defender_conservation_tier", "defender_confidence", "defender_type_tags",
    "defender_signals", "defender_raw_json", "defender_game_stats", "defender_premium_details", "defender_place_or_habitat_label",
    "defender_image_bucket", "defender_image_path", "defender_image_mime_type", "defender_image_media_kind", "defender_image_duration_ms"
].join(",");

const richFeedSelect = [
    "capture_id",
    "user_id",
    "feed_activity_at",
    "capture_created_at",
    "capture_title",
    "capture_notes",
    "card_style",
    "card_auto_style",
    "image_filter",
    "image_rotation_degrees",
    "image_zoom_scale",
    "image_offset_x",
    "image_offset_y",
    "is_challenge_ready",
    "challenge_health",
    "challenge_health_updated_at",
    "challenge_stake",
    "challenge_available",
    "dominance_boost",
    "speed_boost",
    "intelligence_boost",
    "comparison_dominance_boost",
    "comparison_speed_boost",
    "comparison_size_boost",
    "comparison_intelligence_boost",
    "comparison_rarity_boost",
    "learned_sub_principles",
    "total_progression_xp",
    "recent_progression_source",
    "dominance_endorsements",
    "speed_endorsements",
    "size_endorsements",
    "intelligence_endorsements",
    "rarity_endorsements",
    "endorsement_count",
    "viewer_endorsement_stat",
    "last_stat_boost_at",
    "location_lat",
    "location_lng",
    "location_display_label",
    "image_bucket",
    "image_path",
    "image_mime_type",
    "image_media_kind",
    "image_duration_ms",
    "media_assets",
    "animal_name",
    "scientific_name",
    "breed_guess",
    "breed_confidence",
    "human_context",
    "life_stage",
    "gender_guess",
    "gender_confidence",
    "zoo_or_wild",
    "conservation_tier",
    "confidence",
    "type_tags",
    "signals",
    "raw_json",
    "game_stats",
    "species_profile_id",
    "normalized_identity_key",
    "refined_identity",
    "refined_identity_kind",
    "refined_scientific_name",
    "identity_kind",
    "identity_resolution_mode",
    "identity_explanation",
    "identity_evidence_guidance",
    "observed_market_modifiers",
    "price_estimate",
    "premium_details",
    "place_or_habitat_label",
    "completed_at",
    "profile_display_name",
    "profile_username",
    "profile_avatar_url",
    "profile_instagram_url",
    "score"
].join(",");

const compatibilityFeedSelect = [
    "capture_id",
    "user_id",
    "feed_activity_at",
    "capture_created_at",
    "animal_name",
    "scientific_name",
    "breed_guess",
    "conservation_tier",
    "normalized_identity_key",
    "score",
    "human_context",
    "zoo_or_wild",
    "location_display_label",
    "profile_display_name",
    "profile_username",
    "profile_avatar_url",
    "dominance_endorsements",
    "speed_endorsements",
    "size_endorsements",
    "intelligence_endorsements",
    "rarity_endorsements",
    "endorsement_count",
    "viewer_endorsement_stat",
    "game_stats",
    "type_tags",
    "confidence",
    "life_stage",
    "gender_guess",
    "gender_confidence",
    "breed_confidence",
    "premium_details",
    "place_or_habitat_label",
    "species_profile_id",
    "total_progression_xp",
    "recent_progression_source",
    "media_assets"
].join(",");

async function hydrateDiscoverFeedMediaRows(supabase: DiscoverSupabaseClient, rows: QueryRow[]) {
    const captureIdsNeedingMedia = rows
        .filter((row) => mediaAssets(row).length <= 1)
        .map((row) => readString(row, "capture_id"))
        .filter((id): id is string => Boolean(id));

    if (!captureIdsNeedingMedia.length) return rows;

    const {data, error} = await supabase
        .from("capture_images")
        .select("capture_id,id,storage_bucket,storage_path,mime_type,media_kind,duration_ms,sort_order,created_at,poster_storage_bucket,poster_storage_path")
        .in("capture_id", Array.from(new Set(captureIdsNeedingMedia)));

    if (error || !data?.length) return rows;

    const mediaByCapture = new Map<string, QueryRow[]>();
    for (const mediaRow of data as unknown as QueryRow[]) {
        const captureId = readString(mediaRow, "capture_id");
        if (!captureId) continue;
        const list = mediaByCapture.get(captureId) ?? [];
        list.push(mediaRow);
        mediaByCapture.set(captureId, list);
    }

    if (!mediaByCapture.size) return rows;

    return rows.map((row) => {
        const captureId = readString(row, "capture_id");
        const hydrated = captureId ? mediaByCapture.get(captureId) : null;
        if (!hydrated || hydrated.length <= rawMediaAssetRows(row).length) return row;
        return {...row, media_assets: sortMediaAssetRows(hydrated)};
    });
}

async function fetchDiscoverFeedRows(supabase: DiscoverSupabaseClient, limit: number) {
    const requestedLimit = Math.max(limit, 24);
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const richResult = await supabase
        .from("discover_feed_v1")
        .select(richFeedSelect)
        .order("feed_activity_at", {ascending: false})
        .limit(requestedLimit);

    if (!richResult.error) {
        const rows = await hydrateDiscoverFeedMediaRows(supabase, (richResult.data ?? []) as unknown as QueryRow[]);
        if (process.env.NODE_ENV !== "production") {
            const totalMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt;
            logDevPerfEvent("discover.feed", "rich select", {requestedLimit, rowCount: rows.length, totalMs: Math.round(totalMs)});
        }
        return rows;
    }

    const fallbackResult = await supabase
        .from("discover_feed_v1")
        .select(compatibilityFeedSelect)
        .order("feed_activity_at", {ascending: false})
        .limit(requestedLimit);

    const rows = await hydrateDiscoverFeedMediaRows(supabase, (fallbackResult.data ?? []) as unknown as QueryRow[]);
    if (process.env.NODE_ENV !== "production") {
        const totalMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt;
        logDevPerfEvent("discover.feed", "fallback select", {
            requestedLimit,
            rowCount: rows.length,
            totalMs: Math.round(totalMs),
            error: richResult.error.message
        });
    }
    return rows;
}

export async function getDiscoverTimelineBundle(limit = 60, cursor: DiscoverTimelineCursor | null = null) {
    const supabase = createSupabaseServerClient();
    if (!supabase) {
        return {timeline: [] as DiscoverTimelineItem[], featured: [] as DiscoverFeaturedItem[], nextCursor: null as DiscoverTimelineCursor | null};
    }

    const candidateLimit = cursor ? Math.max(120, limit * 8) : Math.max(limit + 1, 24);
    const activityLimit = Math.max(12, Math.min(48, Math.ceil(candidateLimit / 2)));

    const [
        feedRows,
        alignmentResult,
        fusionResult,
        challengeResult,
        tradeResult,
        animalDexNumbers,
        behaviorPrinciples
    ] = await Promise.all([
        fetchDiscoverFeedRows(supabase, candidateLimit),
        supabase.from("discover_alignment_timeline_v1").select("*").order("completed_at", {ascending: false}).limit(activityLimit),
        supabase.from("discover_principle_fusion_timeline_v1").select("*").order("created_at", {ascending: false}).limit(activityLimit),
        supabase.from("discover_challenge_history_v2").select(discoverChallengeSelect).order("created_at", {ascending: false}).limit(activityLimit),
        supabase.from("discover_trade_history_v1").select("id,completed_at,created_at,offerer_user_id,receiver_user_id,offerer_capture_id,receiver_capture_id,offerer_profile_display_name,offerer_profile_username,receiver_profile_display_name,receiver_profile_username,offerer_animal_name,receiver_animal_name,offerer_image_bucket,offerer_image_path,offerer_image_mime_type,offerer_image_media_kind,receiver_image_bucket,receiver_image_path,receiver_image_mime_type,receiver_image_media_kind").order("completed_at", {ascending: false}).limit(activityLimit),
        buildAnimalDexNumberIndex(),
        getCatalogBehaviorPrincipleIndex()
    ]);

    const captures = feedRows.map((row) => mapCaptureRow(row, animalDexNumbers, behaviorPrinciples));
    const alignments = ((alignmentResult.data ?? []) as unknown as QueryRow[]).map(mapAlignmentRow);
    const fusions = ((fusionResult.data ?? []) as unknown as QueryRow[]).map(mapFusionRow);
    const challenges = ((challengeResult.data ?? []) as unknown as QueryRow[]).map(mapChallengeRow);
    const trades = ((tradeResult.data ?? []) as unknown as QueryRow[]).map(mapTradeRow);
    const timeline = buildDiscoverTimeline(captures, alignments, fusions, challenges, trades, candidateLimit);
    const filteredTimeline = cursor ? timeline.filter((item) => itemIsAfterTimelineCursor(item, cursor)) : timeline;
    const page = filteredTimeline.slice(0, limit);

    return {
        timeline: page,
        featured: buildDiscoverFeatured(captures),
        nextCursor: filteredTimeline.length > limit && page.length
            ? timelineCursorForItem(page[page.length - 1])
            : null
    };
}

export async function getChallengeArenaCaptures(excludeUserId: string | null, limit = 48): Promise<DiscoverCaptureItem[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];

    let query = supabase
        .from("challenge_feed_v1")
        .select(richFeedSelect)
        .order("capture_created_at", {ascending: false})
        .limit(limit);

    if (excludeUserId) {
        query = query.neq("user_id", excludeUserId);
    }

    const {data, error} = await query;
    if (error) return [];

    const [animalDexNumbers, behaviorPrinciples] = await Promise.all([
        buildAnimalDexNumberIndex(),
        getCatalogBehaviorPrincipleIndex()
    ]);
    return ((data ?? []) as unknown as QueryRow[])
        .map((row) => mapCaptureRow(row, animalDexNumbers, behaviorPrinciples))
        .filter((item) => item.isChallengeAvailable && item.challengeHealth > 0);
}

export async function getChallengeArenaCaptureById(captureId: string, excludeUserId: string | null): Promise<DiscoverCaptureItem | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;

    let query = supabase
        .from("challenge_feed_v1")
        .select(richFeedSelect)
        .eq("capture_id", captureId)
        .limit(1);

    if (excludeUserId) {
        query = query.neq("user_id", excludeUserId);
    }

    const {data, error} = await query;
    if (error || !data?.length) return null;

    const [animalDexNumbers, behaviorPrinciples] = await Promise.all([
        buildAnimalDexNumberIndex(),
        getCatalogBehaviorPrincipleIndex()
    ]);
    const item = mapCaptureRow(data[0] as unknown as QueryRow, animalDexNumbers, behaviorPrinciples);
    return item.isChallengeAvailable && item.challengeHealth > 0 ? item : null;
}

async function fetchDiscoverFeedRowByCaptureId(
    supabase: DiscoverSupabaseClient,
    captureId: string
) {
    const richResult = await supabase
        .from("discover_feed_v1")
        .select(richFeedSelect)
        .eq("capture_id", captureId)
        .limit(1);

    if (!richResult.error && richResult.data?.length) {
        const hydrated = await hydrateDiscoverFeedMediaRows(supabase, richResult.data as unknown as QueryRow[]);
        return hydrated[0] ?? null;
    }

    const fallbackResult = await supabase
        .from("discover_feed_v1")
        .select(compatibilityFeedSelect)
        .eq("capture_id", captureId)
        .limit(1);

    if (fallbackResult.error || !fallbackResult.data?.length) return null;
    const hydrated = await hydrateDiscoverFeedMediaRows(supabase, fallbackResult.data as unknown as QueryRow[]);
    return hydrated[0] ?? null;
}

export async function getDiscoverCaptureById(captureId: string): Promise<DiscoverCaptureItem | null> {
    const normalizedCaptureId = captureId.trim();
    if (!normalizedCaptureId) return null;

    const supabase = createSupabasePublicClient() ?? createSupabaseServerClient();
    if (!supabase) return null;

    const row = await fetchDiscoverFeedRowByCaptureId(supabase, normalizedCaptureId);
    if (!row) return null;

    const [animalDexNumbers, behaviorPrinciples] = await Promise.all([
        buildAnimalDexNumberIndex(),
        getCatalogBehaviorPrincipleIndex()
    ]);

    return mapCaptureRow(row, animalDexNumbers, behaviorPrinciples);
}

export async function getDiscoverPostById(rawPostId: string): Promise<DiscoverTimelineItem | null> {
    const parsed = parseDiscoverPostId(rawPostId);
    if (!parsed) return null;

    const supabase = createSupabaseServerClient();
    if (!supabase) return null;

    if (parsed.kind === "capture") {
        return getDiscoverCaptureById(parsed.entityId);
    }

    if (parsed.kind === "alignment") {
        const {data, error} = await supabase
            .from("discover_alignment_timeline_v1")
            .select("*")
            .eq("id", parsed.entityId)
            .limit(1);
        if (error || !data?.length) {
            const fallback = await supabase
                .from("discover_alignment_timeline_v1")
                .select("*")
                .eq("proof_id", parsed.entityId)
                .limit(1);
            if (fallback.error || !fallback.data?.length) return null;
            return mapAlignmentRow(fallback.data[0] as unknown as QueryRow);
        }
        return mapAlignmentRow(data[0] as unknown as QueryRow);
    }

    if (parsed.kind === "fusion") {
        const {data, error} = await supabase
            .from("discover_principle_fusion_timeline_v1")
            .select("*")
            .eq("fusion_id", parsed.entityId)
            .limit(1);
        if (error || !data?.length) {
            const fallback = await supabase
                .from("discover_principle_fusion_timeline_v1")
                .select("*")
                .eq("id", parsed.entityId)
                .limit(1);
            if (fallback.error || !fallback.data?.length) return null;
            return mapFusionRow(fallback.data[0] as unknown as QueryRow);
        }
        return mapFusionRow(data[0] as unknown as QueryRow);
    }

    if (parsed.kind === "challenge") {
        const {data, error} = await supabase
            .from("discover_challenge_history_v2")
            .select(discoverChallengeSelect)
            .eq("id", parsed.entityId)
            .limit(1);
        if (error || !data?.length) return null;
        return mapChallengeRow(data[0] as unknown as QueryRow);
    }

    const {data, error} = await supabase
        .from("discover_trade_history_v1")
        .select("id,completed_at,created_at,offerer_user_id,receiver_user_id,offerer_capture_id,receiver_capture_id,offerer_profile_display_name,offerer_profile_username,receiver_profile_display_name,receiver_profile_username,offerer_animal_name,receiver_animal_name,offerer_image_bucket,offerer_image_path,offerer_image_mime_type,offerer_image_media_kind,receiver_image_bucket,receiver_image_path,receiver_image_mime_type,receiver_image_media_kind")
        .eq("id", parsed.entityId)
        .limit(1);
    if (error || !data?.length) return null;
    return mapTradeRow(data[0] as unknown as QueryRow);
}

export function seedTimelineWithFocusPost(
    timeline: DiscoverTimelineItem[],
    focusPost: DiscoverTimelineItem | null
) {
    if (!focusPost) return timeline;
    if (timeline.some((item) => item.id === focusPost.id)) return timeline;
    return [focusPost, ...timeline];
}

const RANKING_SIBLING_PAGE_SIZE = 10;

export async function getDiscoverRankingSiblings(options: {
    captureId: string;
    speciesProfileId?: string | null;
    normalizedIdentityKey?: string | null;
    offset?: number;
    limit?: number;
}): Promise<{items: DiscoverCaptureItem[]; hasMore: boolean; nextOffset: number | null}> {
    const supabase = createSupabaseServerClient();
    const captureId = options.captureId.trim();
    const speciesProfileId = options.speciesProfileId?.trim() || null;
    const identityKey = options.normalizedIdentityKey?.trim().toLowerCase() || null;
    const offset = Math.max(0, options.offset ?? 0);
    const limit = Math.min(24, Math.max(1, options.limit ?? RANKING_SIBLING_PAGE_SIZE));

    if (!supabase || !captureId || (!speciesProfileId && !identityKey)) {
        return {items: [], hasMore: false, nextOffset: null};
    }

    let query = supabase
        .from("discover_feed_v1")
        .select(richFeedSelect)
        .order("score", {ascending: false})
        .order("capture_created_at", {ascending: false})
        .range(offset, offset + limit);

    if (speciesProfileId) {
        query = query.eq("species_profile_id", speciesProfileId);
    } else if (identityKey) {
        query = query.eq("normalized_identity_key", identityKey);
    }

    const {data, error} = await query;
    if (error || !data?.length) {
        return {items: [], hasMore: false, nextOffset: null};
    }

    const hydrated = await hydrateDiscoverFeedMediaRows(supabase, data as unknown as QueryRow[]);
    const [animalDexNumbers, behaviorPrinciples] = await Promise.all([
        buildAnimalDexNumberIndex(),
        getCatalogBehaviorPrincipleIndex()
    ]);

    const mapped = hydrated
        .map((row) => mapCaptureRow(row, animalDexNumbers, behaviorPrinciples))
        .filter((item) => Boolean(item.captureId));

    // Keep cohort identity tight when filtering by profile id alone.
    const cohort = identityKey
        ? mapped.filter((item) => {
            if (item.captureId === captureId) return true;
            const key = item.normalizedIdentityKey?.toLowerCase() ?? null;
            if (key && key === identityKey) return true;
            if (speciesProfileId && item.speciesProfileId === speciesProfileId) return true;
            return !speciesProfileId;
        })
        : mapped;

    const deduped: DiscoverCaptureItem[] = [];
    const seen = new Set<string>();
    for (const item of cohort) {
        if (seen.has(item.captureId)) continue;
        seen.add(item.captureId);
        deduped.push(item);
    }

    const hasMore = (data as unknown as QueryRow[]).length > limit;
    const page = deduped.slice(0, limit);

    // Pin the seed capture to the front on the first page so horizontal swipe starts on the focused post.
    if (offset === 0) {
        const seedIndex = page.findIndex((item) => item.captureId === captureId);
        if (seedIndex > 0) {
            const [seed] = page.splice(seedIndex, 1);
            page.unshift(seed);
        }
    }

    return {
        items: page,
        hasMore,
        nextOffset: hasMore ? offset + limit : null
    };
}

export type DiscoverSitemapPost = {
    postId: string;
    date: string;
    animalName: string;
    hasVideoMedia: boolean;
    contextLabel: string | null;
};

function recentCaptureFeedLimit(limit: number) {
    return Math.min(Math.max(limit * 8, 24), 48);
}

async function loadRecentPublicCaptures(limit: number): Promise<DiscoverCaptureItem[]> {
    const supabase = createSupabasePublicClient() ?? createSupabaseServerClient();
    if (!supabase) return [];

    const feedLimit = recentCaptureFeedLimit(limit);
    const rows = await timeDevAsync("discover.recent", "fetch-feed", () => fetchDiscoverFeedRows(supabase, feedLimit), {feedLimit});
    const [animalDexNumbers, behaviorPrinciples] = await Promise.all([
        timeDevAsync("discover.recent", "animaldex-index", () => buildAnimalDexNumberIndex()),
        timeDevAsync("discover.recent", "behavior-principles", () => getCatalogBehaviorPrincipleIndex())
    ]);

    return timeDevAsync("discover.recent", "map-rows", () =>
        rows
            .map((row) => mapCaptureRow(row, animalDexNumbers, behaviorPrinciples))
            .filter((item) =>
                item.imageSrc
                && !item.isUncertain
                && item.mediaAssets.length > 0
                && Boolean(item.coreLesson?.trim())
                && item.animalDexNumber != null
                && item.animalDexNumber >= 1
            )
            .slice(0, limit),
        {rowCount: rows.length, limit}
    );
}

export async function getRecentPublicCaptures(limit = 4): Promise<DiscoverCaptureItem[]> {
    return withServerMemoryCache(
        `recent-public-captures:${limit}`,
        devCacheTtlMs(5 * 60 * 1000),
        () => loadRecentPublicCaptures(limit)
    );
}

export async function getDiscoverCapturePostsForSitemap(limit = 500): Promise<DiscoverSitemapPost[]> {
    const supabase = createSupabasePublicClient() ?? createSupabaseServerClient();
    if (!supabase) return [];

    const rows = await fetchDiscoverFeedRows(supabase, Math.max(24, Math.min(limit, 500)));
    const [animalDexNumbers, behaviorPrinciples] = await Promise.all([
        buildAnimalDexNumberIndex(),
        getCatalogBehaviorPrincipleIndex()
    ]);

    return rows
        .map((row) => mapCaptureRow(row, animalDexNumbers, behaviorPrinciples))
        .slice(0, limit)
        .map((item) => ({
            postId: item.id,
            date: item.date,
            animalName: item.animalName,
            hasVideoMedia: item.hasVideoMedia,
            contextLabel: item.contextLabel
        }));
}

export type {ParsedDiscoverPostId};
