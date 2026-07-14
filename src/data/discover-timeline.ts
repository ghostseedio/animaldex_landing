import "server-only";

import {getCatalogBehaviorPrincipleIndex, getUnifiedSpeciesEntries, resolveCatalogBehaviorPrinciple} from "@/data/database-species-pages";
import {getSpeciesBySlug} from "@/data/species";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {getCaptureImageRoute} from "@/lib/capture-storage-image";
import {resolveCaptureHeadlineDisplay, resolveChallengeAnalysisHeadlineDisplay} from "@/lib/capture-headline-display";
import {resolveCanonicalSlugFromIdentity} from "@/lib/species-life-stage-policy";
import {formatScenarioFamilyLabel, normalizeScenarioFamily} from "@/lib/matchup-result-copy";
import {createSupabaseServerClient} from "@/lib/supabase/server";

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
    score: number;
    endorsementCount: number;
    viewerEndorsementStat: string | null;
    rarity: number;
    contextLabel: string | null;
    locationLabel: string | null;
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
    learnedExpression: string | null;
    bestForTags: string[];
    statBoosts: Record<string, number>;
    comparisonBoosts: Record<string, number>;
    gameStats: Record<string, number>;
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

function readNestedString(row: QueryRow, keys: string[]) {
    let value: unknown = row;
    for (const key of keys) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return null;
        value = (value as QueryRow)[key];
    }
    return typeof value === "string" && value.trim() ? value.trim() : null;
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
        identityKey
    );
    const progressionXP = readNumber(row, "total_progression_xp");
    const collector = collectorFromRow(row);
    const refreshedMedia = isMediaRefreshActivity(row);
    const learnedPrincipleName = primaryLearnedPrincipleName(row);
    const media = discoverMediaAssets(row, captureId);
    const headline = resolveCaptureHeadlineDisplay({
        animalName: readString(row, "animal_name"),
        scientificName: readString(row, "scientific_name"),
        breedGuess: readString(row, "breed_guess"),
        breedConfidence: readNullableNumber(row, "breed_confidence"),
        confidence: readNullableNumber(row, "confidence"),
        normalizedIdentityKey: identityKey,
        lifeStage: readString(row, "life_stage"),
        canonicalDisplayName: species?.name ?? null,
        humanContext: readString(row, "human_context"),
        zooOrWild: readString(row, "zoo_or_wild"),
        premiumDetails: row.premium_details && typeof row.premium_details === "object" && !Array.isArray(row.premium_details)
            ? row.premium_details as Record<string, unknown>
            : null
    });
    const animalName = headline.animalName;
    const catalogBestFor = catalogPrinciple?.bestUseCases ?? [];
    const learnedTags = learnedBestForTags(row);

    return {
        kind: "capture",
        id: `capture-${captureId}`,
        captureId,
        date: readString(row, "feed_activity_at") ?? readString(row, "capture_created_at") ?? new Date(0).toISOString(),
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
        score: readNumber(row, "score"),
        endorsementCount: endorsementCount(row),
        viewerEndorsementStat: formatLabel(readString(row, "viewer_endorsement_stat")),
        rarity: readNumber(stats, "rarity"),
        contextLabel: getContextLabel(row),
        locationLabel: readString(row, "location_display_label"),
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
        recentProgressionSource: formatLabel(readString(row, "recent_progression_source")),
        animalDexNumber: resolveAnimalDexNumber(row, slug, species, animalDexNumbers),
        mediaCount: mediaCount(row),
        hasVideoMedia: media.some((asset) => asset.kind === "loop" || asset.kind === "video"),
        isMediaRefreshActivity: refreshedMedia,
        isChallengeReady: readBoolean(row, "is_challenge_ready"),
        isChallengeAvailable: readBoolean(row, "challenge_available"),
        challengeHealth: readNumber(row, "challenge_health") || 3,
        challengeStake: readNumber(row, "challenge_stake") || 1,
        learnedPrinciple: catalogPrinciple?.principleName ?? learnedPrincipleName,
        learnedExpression: null,
        bestForTags: catalogBestFor.length ? catalogBestFor.slice(0, 4) : learnedTags,
        statBoosts: statBoosts(row),
        comparisonBoosts: comparisonBoosts(row),
        gameStats: stats
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

async function hydrateDiscoverFeedMediaRows(supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>, rows: QueryRow[]) {
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

async function fetchDiscoverFeedRows(supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>, limit: number) {
    const requestedLimit = Math.max(limit, 24);
    const richResult = await supabase
        .from("discover_feed_v1")
        .select(richFeedSelect)
        .order("feed_activity_at", {ascending: false})
        .limit(requestedLimit);

    if (!richResult.error) {
        return hydrateDiscoverFeedMediaRows(supabase, (richResult.data ?? []) as unknown as QueryRow[]);
    }

    const fallbackResult = await supabase
        .from("discover_feed_v1")
        .select(compatibilityFeedSelect)
        .order("feed_activity_at", {ascending: false})
        .limit(requestedLimit);

    return hydrateDiscoverFeedMediaRows(supabase, (fallbackResult.data ?? []) as unknown as QueryRow[]);
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
        supabase.from("discover_challenge_history_v1").select(discoverChallengeSelect).order("created_at", {ascending: false}).limit(activityLimit),
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
