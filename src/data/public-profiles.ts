import "server-only";

import {getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import {resolveCollectionArchetype} from "@/lib/collection-archetype";
import {getCaptureImageRoute} from "@/lib/capture-storage-image";
import {countCaptureSettingLabels, getCaptureContextLabel} from "@/lib/capture-setting-label";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";
import {type AnimalBattleTier, getBattleTier} from "@/lib/battle-tier";

const PUBLIC_PROFILE_REVALIDATE_SECONDS = 60;
const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,28}[a-z0-9])?$/;
/** iOS never reveals a distance built from fewer located observations than this. */
const MIN_LOCATED_OBSERVATIONS_FOR_DISTANCE = 3;
/** Battle-tier spread is a whole-collection shape, so it reads past the History page size. */
const TIER_SAMPLE_LIMIT = 1000;

type ProfileRow = {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    bio?: string | null;
    instagram_url?: string | null;
    is_pro?: boolean | null;
    created_at?: string | null;
    chrome_preset?: string | null;
    location_visibility?: string | null;
};

type PublicCaptureRow = {
    capture_id: string;
    animal_name: string | null;
    normalized_identity_key: string | null;
    species_profile_id?: string | null;
    score: number | null;
    capture_created_at: string | null;
    human_context: string | null;
    zoo_or_wild: string | null;
    location_display_label?: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
    type_tags?: string[] | null;
    game_stats?: Record<string, number> | null;
    dominance_boost?: number | null;
    speed_boost?: number | null;
    intelligence_boost?: number | null;
    identity_kind?: string | null;
};

type PublicProfileSummaryRow = {
    overall_score: number | null;
    capture_count: number | null;
    unique_species: number | null;
    indexed_species_count?: number | null;
    wild_captures: number | null;
    zoo_captures: number | null;
    domestic_captures: number | null;
    farm_captures?: number | null;
    rare_finds?: number | null;
    average_rarity?: number | null;
    average_dominance?: number | null;
    average_speed?: number | null;
    average_size?: number | null;
    average_intelligence?: number | null;
    most_common_animal_name?: string | null;
    best_find_id?: string | null;
    trades_made?: number | null;
    missions_completed?: number | null;
    collection_value_usd?: number | null;
    score_includes_power_sets?: boolean;
    challenge_wins?: number | null;
    challenge_losses?: number | null;
    discovery_distance_meters?: number | null;
    located_observation_count?: number | null;
};

type MaterializedProfileStatsRow = {
    user_id: string;
    overall_score: number | null;
    observation_count: number | null;
    unique_species_count: number | null;
    indexed_species_count: number | null;
    rare_observation_count: number | null;
    wild_observation_count: number | null;
    zoo_observation_count: number | null;
    domestic_observation_count: number | null;
    farm_observation_count: number | null;
    collection_value_cents: number | null;
    average_dominance?: number | null;
    average_speed?: number | null;
    average_size?: number | null;
    average_intelligence?: number | null;
    average_rarity?: number | null;
    completed_trade_count?: number | null;
    challenge_wins?: number | null;
    challenge_losses?: number | null;
    discovery_distance_meters?: number | null;
    located_observation_count?: number | null;
};

type ProfileInsightIdRow = {
    insight_key: string;
    capture_id: string;
};

type TierSampleRow = {
    capture_id: string;
    game_stats?: Record<string, number> | null;
    dominance_boost?: number | null;
    speed_boost?: number | null;
    intelligence_boost?: number | null;
};

type BestForTagRow = {
    tag_key: string;
    tag_label: string;
    score: number;
    capture_count: number;
};

type PowerSetRow = {
    power_key: string;
    power_label: string;
    tier: string;
    species_count: number;
    catalog_linked_count?: number | null;
    reward_points?: number | null;
    completed_at: string | null;
};

type IdentityRow = {
    user_id: string;
    origin_display_name: string | null;
    origin_species_profile_id?: string | null;
    origin_normalized_identity_key?: string | null;
    apex_display_name: string | null;
    apex_species_profile_id?: string | null;
    apex_normalized_identity_key?: string | null;
    active_display_name: string | null;
    active_species_profile_id?: string | null;
    active_normalized_identity_key?: string | null;
    public_summary?: {headline?: string | null; summary?: string | null} | null;
    show_origin_publicly?: boolean | null;
    show_apex_publicly?: boolean | null;
    show_active_publicly?: boolean | null;
};

export type PublicProfileCapture = {
    id: string;
    animalName: string;
    speciesSlug: string | null;
    score: number;
    capturedAt: string | null;
    contextLabel: string | null;
    href: string;
    imageSrc: string;
    dominance: number;
    speed: number;
    size: number;
    intelligence: number;
    rarity: number;
    isIndexed: boolean;
    identityKind: string | null;
};

export type ProfileBestForTag = {
    tagKey: string;
    tagLabel: string;
    score: number;
    captureCount: number;
};

export type ProfilePowerSetCompletion = {
    powerKey: string;
    powerLabel: string;
    tier: string;
    speciesCount: number;
    catalogLinkedCount: number | null;
    rewardPoints: number;
    completedAt: string | null;
};

export type PublicIdentityRole = {
    label: string;
    name: string;
    speciesSlug: string | null;
    hidden: boolean;
};

export type PublicWildIdentity = {
    headline: string | null;
    summary: string | null;
    origin: PublicIdentityRole;
    apex: PublicIdentityRole;
    active: PublicIdentityRole;
};

export type ProfileLocationVisit = {
    id: string;
    label: string;
    captureCount: number;
    lastSeenAt: string | null;
    latitude: number | null;
    longitude: number | null;
};

export type ProfileInsight = {
    title: string;
    capture: PublicProfileCapture | null;
};

export type ProfileInsightScope = "overall" | "wild";

export type ProfileBattleTierCounts = Record<AnimalBattleTier, number>;

export type ProfileLocationVisibility = "everyone" | "following" | "friends" | "private";

export type PublicProfileCard = {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    instagramUrl: string | null;
    isPro: boolean;
    joinedAt: string | null;
    chromePreset: "spirit" | "friend" | "professional" | "business";
    captureCount: number;
    speciesCount: number;
    indexedSpeciesCount: number;
    catalogSpeciesCount: number;
    unindexedCount: number;
    collectorScore: number;
    wildCount: number;
    zooCount: number;
    domesticCount: number;
    farmCount: number;
    rareFinds: number;
    tradesMade: number;
    missionsCompleted: number;
    collectionValueUsd: number | null;
    averageRarity: number | null;
    averageTraits: {
        dominance: number;
        speed: number;
        size: number;
        intelligence: number;
        rarity: number;
    };
    mostCommonAnimalName: string | null;
    collectionArchetype: string;
    bestForTagScores: ProfileBestForTag[];
    powerSetCompletions: ProfilePowerSetCompletion[];
    wildIdentity: PublicWildIdentity | null;
    insights: ProfileInsight[];
    wildInsights: ProfileInsight[];
    locationVisits: ProfileLocationVisit[];
    topCaptures: PublicProfileCapture[];
    recentCaptures: PublicProfileCapture[];
    battleTierCounts: ProfileBattleTierCounts;
    challengeWins: number;
    challengeLosses: number;
    locationVisibility: ProfileLocationVisibility;
    /** Raw metric — callers must gate on `locationVisibility` before showing it. */
    discoveryDistanceMeters: number | null;
};

export function normalizePublicHandle(value: string) {
    const handle = value.trim().replace(/^@+/, "").toLowerCase();
    return HANDLE_PATTERN.test(handle) ? handle : null;
}

/** Matches iOS verified overall score: capture score + completed power-set reward points. */
export function resolvePublicOverallScore(
    baseScore: number,
    powerSetRows: Array<Pick<PowerSetRow, "reward_points">>
) {
    const powerSetBonus = powerSetRows.reduce((sum, row) => sum + Number(row.reward_points ?? 0), 0);
    return baseScore + powerSetBonus;
}

export type ProfileSettingCounts = {
    wild: number;
    zoo: number;
    domestic: number;
    farm: number;
};

/** Matches iOS `resolvedMemberSettingCounts`: prefer summary, but fall back when exact totals are zero. */
export function resolveProfileSettingCounts(
    exact: ProfileSettingCounts | null | undefined,
    fallback: ProfileSettingCounts
): ProfileSettingCounts {
    const exactWild = Number(exact?.wild ?? 0);
    const exactZoo = Number(exact?.zoo ?? 0);
    const exactDomestic = Number(exact?.domestic ?? 0);
    const exactFarm = Number(exact?.farm ?? 0);
    const exactTotal = exactWild + exactZoo + exactDomestic + exactFarm;
    const fallbackTotal = fallback.wild + fallback.zoo + fallback.domestic + fallback.farm;

    if (exactTotal === 0 && fallbackTotal > 0) {
        return fallback;
    }

    if (exact) {
        return {wild: exactWild, zoo: exactZoo, domestic: exactDomestic, farm: exactFarm};
    }

    return fallback;
}

function getConfig() {
    const url = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    return url && key ? {url, key} : null;
}

async function fetchRows<T>(table: string, params: URLSearchParams) {
    const config = getConfig();
    if (!config) return [] as T[];

    try {
        const response = await fetch(`${config.url}/rest/v1/${table}?${params}`, {
            headers: getSupabaseHeaders(config.key),
            next: {revalidate: PUBLIC_PROFILE_REVALIDATE_SECONDS}
        });
        if (!response.ok) return [] as T[];
        const rows = await response.json();
        return Array.isArray(rows) ? rows as T[] : [] as T[];
    } catch {
        return [] as T[];
    }
}

function toPublicProfileSummaryFromMaterialized(row: MaterializedProfileStatsRow): PublicProfileSummaryRow {
    return {
        overall_score: row.overall_score,
        capture_count: row.observation_count,
        unique_species: row.unique_species_count,
        indexed_species_count: row.indexed_species_count,
        wild_captures: row.wild_observation_count,
        zoo_captures: row.zoo_observation_count,
        domestic_captures: row.domestic_observation_count,
        farm_captures: row.farm_observation_count,
        rare_finds: row.rare_observation_count,
        average_rarity: row.average_rarity,
        average_dominance: row.average_dominance,
        average_speed: row.average_speed,
        average_size: row.average_size,
        average_intelligence: row.average_intelligence,
        most_common_animal_name: null,
        best_find_id: null,
        trades_made: row.completed_trade_count,
        missions_completed: 0,
        collection_value_usd: row.collection_value_cents != null ? Number(row.collection_value_cents) / 100 : null,
        score_includes_power_sets: true,
        challenge_wins: row.challenge_wins,
        challenge_losses: row.challenge_losses,
        discovery_distance_meters: row.discovery_distance_meters,
        located_observation_count: row.located_observation_count
    };
}

async function fetchPublicProfileSummary(userId: string) {
    const materializedParams = new URLSearchParams({
        select: "user_id,overall_score,observation_count,unique_species_count,indexed_species_count,rare_observation_count,wild_observation_count,zoo_observation_count,domestic_observation_count,farm_observation_count,collection_value_cents,average_dominance,average_speed,average_size,average_intelligence,average_rarity,completed_trade_count,challenge_wins,challenge_losses,discovery_distance_meters,located_observation_count",
        user_id: `eq.${userId}`,
        limit: "1"
    });
    const [materialized] = await fetchRows<MaterializedProfileStatsRow>("user_profile_stats_v1", materializedParams);
    if (materialized) return toPublicProfileSummaryFromMaterialized(materialized);

    const latestParams = new URLSearchParams({
        select: "overall_score,capture_count,unique_species,indexed_species_count,wild_captures,zoo_captures,domestic_captures,rare_finds,average_rarity,most_common_animal_name,best_find_id,trades_made,missions_completed,collection_value_usd",
        user_id: `eq.${userId}`,
        limit: "1"
    });
    const [latest] = await fetchRows<PublicProfileSummaryRow>("member_profile_summaries_v1", latestParams);
    if (latest) return latest;

    const legacyParams = new URLSearchParams({
        select: "overall_score,capture_count,unique_species,wild_captures,zoo_captures,domestic_captures",
        user_id: `eq.${userId}`,
        limit: "1"
    });
    const [legacy] = await fetchRows<PublicProfileSummaryRow>("member_profile_summaries_v1", legacyParams);
    return legacy ?? null;
}

function getContextLabel(row: Pick<PublicCaptureRow, "zoo_or_wild" | "human_context">) {
    return getCaptureContextLabel(row);
}

function toSpeciesSlug(identityKey: string | null | undefined) {
    const value = identityKey?.trim().toLowerCase().replace(/_/g, "-");
    return value || null;
}

function readStat(stats: Record<string, number> | null | undefined, key: string, boost = 0) {
    return Number(stats?.[key] ?? 0) + boost;
}

function toPublicCapture(
    row: PublicCaptureRow,
    speciesSlug: string | null
): PublicProfileCapture {
    const imageSrc = getCaptureImageRoute(row.capture_id);
    const stats = row.game_stats ?? {};

    return {
        id: row.capture_id,
        animalName: row.animal_name?.trim() || "AnimalDex capture",
        speciesSlug,
        score: Number(row.score ?? 0),
        capturedAt: row.capture_created_at,
        contextLabel: getContextLabel(row),
        href: speciesSlug ? `/animals/${speciesSlug}` : `/animals?q=${encodeURIComponent(row.animal_name?.trim() || "")}`,
        imageSrc,
        dominance: readStat(stats, "dominance", row.dominance_boost ?? 0),
        speed: readStat(stats, "speed", row.speed_boost ?? 0),
        size: readStat(stats, "size"),
        intelligence: readStat(stats, "intelligence", row.intelligence_boost ?? 0),
        rarity: readStat(stats, "rarity"),
        isIndexed: Boolean(row.species_profile_id?.trim()),
        identityKind: row.identity_kind?.trim() || null
    };
}

function buildLocationVisits(captures: Array<PublicProfileCapture & {
    locationLabel?: string | null;
    latitude?: number | null;
    longitude?: number | null;
}>): ProfileLocationVisit[] {
    const grouped = new Map<string, ProfileLocationVisit>();

    for (const row of captures) {
        const label = row.locationLabel?.trim();
        if (!label) continue;

        const hasCoordinate = Number.isFinite(row.latitude) && Number.isFinite(row.longitude);
        const key = hasCoordinate
            ? `${Number(row.latitude).toFixed(3)},${Number(row.longitude).toFixed(3)}`
            : label.toLowerCase();
        const existing = grouped.get(key);

        if (existing) {
            grouped.set(key, {
                ...existing,
                captureCount: existing.captureCount + 1,
                lastSeenAt: [existing.lastSeenAt, row.capturedAt].filter(Boolean).sort().reverse()[0] ?? existing.lastSeenAt
            });
        } else {
            grouped.set(key, {
                id: key,
                label,
                captureCount: 1,
                lastSeenAt: row.capturedAt,
                latitude: hasCoordinate ? Number(Number(row.latitude).toFixed(3)) : null,
                longitude: hasCoordinate ? Number(Number(row.longitude).toFixed(3)) : null
            });
        }
    }

    return Array.from(grouped.values())
        .sort((left, right) => {
            const leftTime = left.lastSeenAt ? Date.parse(left.lastSeenAt) : 0;
            const rightTime = right.lastSeenAt ? Date.parse(right.lastSeenAt) : 0;
            if (leftTime !== rightTime) return rightTime - leftTime;
            return left.label.localeCompare(right.label);
        })
        .slice(0, 20);
}

function strongestCapture(captures: PublicProfileCapture[], metric: keyof Pick<PublicProfileCapture, "dominance" | "speed" | "size" | "intelligence" | "rarity">) {
    return captures.reduce<PublicProfileCapture | null>((best, capture) => {
        if (!best || capture[metric] > best[metric]) return capture;
        return best;
    }, null);
}

/** iOS `profileInsightItems` — same keys, same order, same titles. */
const INSIGHT_TITLES_BY_KEY: Record<string, string> = {
    overall_best: "Overall best capture",
    most_dominant: "Most dominant",
    fastest: "Fastest animal",
    biggest: "Biggest animal",
    most_intelligent: "Most intelligent",
    rarest: "Rarest animal"
};
const INSIGHT_KEY_ORDER = [
    "overall_best",
    "most_dominant",
    "fastest",
    "biggest",
    "most_intelligent",
    "rarest"
];

function buildInsights(captures: PublicProfileCapture[], bestFindId: string | null): ProfileInsight[] {
    const byId = new Map(captures.map((capture) => [capture.id, capture]));
    const bestFind = bestFindId ? byId.get(bestFindId) ?? captures[0] ?? null : captures[0] ?? null;

    return [
        {title: "Overall best capture", capture: bestFind},
        {title: "Most dominant", capture: strongestCapture(captures, "dominance")},
        {title: "Fastest animal", capture: strongestCapture(captures, "speed")},
        {title: "Biggest animal", capture: strongestCapture(captures, "size")},
        {title: "Most intelligent", capture: strongestCapture(captures, "intelligence")},
        {title: "Rarest animal", capture: strongestCapture(captures, "rarity")}
    ];
}

/**
 * Server-ranked insights, scoped exactly like iOS: overall keys are unprefixed and
 * must not absorb the `wild_` rows.
 */
function buildScopedInsights(
    rows: ProfileInsightIdRow[],
    scope: ProfileInsightScope,
    capturesById: Map<string, PublicProfileCapture>
): ProfileInsight[] {
    const prefix = scope === "wild" ? "wild_" : "";
    const captureByKey = new Map<string, PublicProfileCapture>();

    for (const row of rows) {
        const key = row.insight_key?.trim();
        if (!key || !key.startsWith(prefix)) continue;

        const unscopedKey = prefix ? key.slice(prefix.length) : key;
        if (scope === "overall" && unscopedKey.startsWith("wild_")) continue;

        const capture = capturesById.get(row.capture_id);
        if (capture) captureByKey.set(unscopedKey, capture);
    }

    return INSIGHT_KEY_ORDER.flatMap((key) => {
        const capture = captureByKey.get(key);
        return capture ? [{title: INSIGHT_TITLES_BY_KEY[key], capture}] : [];
    });
}

function emptyBattleTierCounts(): ProfileBattleTierCounts {
    return {S: 0, A: 0, B: 0, C: 0, D: 0, E: 0};
}

/** iOS `Array<AnimalCapture>.battleTierCounts` — effective stats, boosts included. */
function buildBattleTierCounts(rows: TierSampleRow[]): ProfileBattleTierCounts {
    const counts = emptyBattleTierCounts();

    for (const row of rows) {
        const stats = row.game_stats ?? {};
        const dominance = readStat(stats, "dominance", row.dominance_boost ?? 0);
        const speed = readStat(stats, "speed", row.speed_boost ?? 0);
        const size = readStat(stats, "size");
        const intelligence = readStat(stats, "intelligence", row.intelligence_boost ?? 0);
        const rarity = readStat(stats, "rarity");
        // An identity-less capture has no stats at all; it is not a ranked capture.
        if (dominance + speed + size + intelligence + rarity <= 0) continue;

        counts[getBattleTier({dominance, speed, size, intelligence, rarity})] += 1;
    }

    return counts;
}

function normalizeLocationVisibility(value: string | null | undefined): ProfileLocationVisibility {
    switch (value?.trim().toLowerCase()) {
        case "following":
            return "following";
        case "friends":
            return "friends";
        case "private":
            return "private";
        default:
            return "everyone";
    }
}

function toIdentityRole(
    label: string,
    name: string | null | undefined,
    identityKey: string | null | undefined,
    speciesProfileId: string | null | undefined,
    hidden: boolean,
    speciesByIdentity: Map<string, string>,
    speciesByProfileId: Map<string, string>
): PublicIdentityRole {
    const fromProfileId = speciesProfileId?.trim()
        ? speciesByProfileId.get(speciesProfileId.trim()) ?? null
        : null;
    const fromIdentityKey = identityKey
        ? speciesByIdentity.get(toSpeciesSlug(identityKey) ?? "") ?? null
        : null;
    const slug = fromProfileId ?? fromIdentityKey;

    return {
        label,
        name: hidden ? "Private" : name?.trim() || "—",
        speciesSlug: hidden ? null : slug,
        hidden
    };
}

function toWildIdentity(
    row: IdentityRow | undefined,
    speciesByIdentity: Map<string, string>,
    speciesByProfileId: Map<string, string>
): PublicWildIdentity | null {
    if (!row) return null;

    return {
        headline: row.public_summary?.headline?.trim() || null,
        summary: row.public_summary?.summary?.trim() || null,
        origin: toIdentityRole(
            "Origin",
            row.origin_display_name,
            row.origin_normalized_identity_key,
            row.origin_species_profile_id,
            row.show_origin_publicly === false,
            speciesByIdentity,
            speciesByProfileId
        ),
        apex: toIdentityRole(
            "Apex",
            row.apex_display_name,
            row.apex_normalized_identity_key,
            row.apex_species_profile_id,
            row.show_apex_publicly === false,
            speciesByIdentity,
            speciesByProfileId
        ),
        active: toIdentityRole(
            "Active",
            row.active_display_name,
            row.active_normalized_identity_key,
            row.active_species_profile_id,
            row.show_active_publicly === false,
            speciesByIdentity,
            speciesByProfileId
        )
    };
}

function formatInstagramDisplay(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return "@instagram";

    try {
        const url = new URL(trimmed);
        if (url.host.toLowerCase().includes("instagram.com")) {
            const path = url.pathname.replace(/^\/+|\/+$/g, "");
            if (path) return path.startsWith("@") ? path : `@${path}`;
        }
    } catch {
        // fall through
    }

    if (trimmed.startsWith("@")) return trimmed;
    if (!trimmed.includes("://") && !trimmed.includes("/")) return `@${trimmed}`;
    return trimmed;
}

export function getInstagramDisplayText(value: string | null) {
    return value ? formatInstagramDisplay(value) : null;
}

export async function getAuthenticatedPublicProfileCard(): Promise<PublicProfileCard | null> {
    const {getAuthenticatedUserProfile} = await import("@/data/user-captures");
    const viewer = await getAuthenticatedUserProfile();
    if (!viewer?.username) return null;
    return getPublicProfileCard(viewer.username);
}

export async function getPublicProfileCard(rawHandle: string): Promise<PublicProfileCard | null> {
    const handle = normalizePublicHandle(rawHandle);
    if (!handle) return null;

    const profileParams = new URLSearchParams({
        select: "id,username,display_name,avatar_url,bio,instagram_url,is_pro,created_at,chrome_preset,location_visibility",
        username: `eq.${handle}`,
        limit: "1"
    });
    const [profile] = await fetchRows<ProfileRow>("profiles", profileParams);
    if (!profile?.username?.trim()) return null;

    const captureSelect = [
        "capture_id",
        "animal_name",
        "normalized_identity_key",
        "species_profile_id",
        "score",
        "capture_created_at",
        "human_context",
        "zoo_or_wild",
        "location_display_label",
        "location_lat",
        "location_lng",
        "type_tags",
        "game_stats",
        "dominance_boost",
        "speed_boost",
        "intelligence_boost",
        "identity_kind"
    ].join(",");

    const topCaptureParams = new URLSearchParams({
        select: captureSelect,
        user_id: `eq.${profile.id}`,
        order: "score.desc,capture_created_at.desc",
        limit: "8"
    });
    const recentCaptureParams = new URLSearchParams({
        select: captureSelect,
        user_id: `eq.${profile.id}`,
        order: "capture_created_at.desc",
        limit: "48"
    });
    const bestForParams = new URLSearchParams({
        select: "tag_key,tag_label,score,capture_count",
        user_id: `eq.${profile.id}`,
        order: "score.desc,tag_label.asc",
        limit: "25"
    });
    const powerSetParams = new URLSearchParams({
        select: "power_key,power_label,tier,species_count,catalog_linked_count,reward_points,completed_at",
        user_id: `eq.${profile.id}`,
        order: "completed_at.desc",
        limit: "16"
    });
    const identityParams = new URLSearchParams({
        select: "user_id,origin_display_name,origin_species_profile_id,apex_display_name,apex_species_profile_id,active_display_name,active_species_profile_id,public_summary,show_origin_publicly,show_apex_publicly,show_active_publicly",
        user_id: `eq.${profile.id}`,
        limit: "1"
    });
    const insightParams = new URLSearchParams({
        select: "insight_key,capture_id",
        user_id: `eq.${profile.id}`,
        limit: "24"
    });
    const tierSampleParams = new URLSearchParams({
        select: "capture_id,game_stats,dominance_boost,speed_boost,intelligence_boost",
        user_id: `eq.${profile.id}`,
        order: "capture_created_at.desc",
        limit: String(TIER_SAMPLE_LIMIT)
    });

    const [
        topRows,
        recentRows,
        speciesEntries,
        summary,
        bestForRows,
        powerSetRows,
        identityRows,
        insightRows,
        tierSampleRows
    ] = await Promise.all([
        fetchRows<PublicCaptureRow>("discover_feed_v1", topCaptureParams),
        fetchRows<PublicCaptureRow>("discover_feed_v1", recentCaptureParams),
        getUnifiedSpeciesEntries(),
        fetchPublicProfileSummary(profile.id),
        fetchRows<BestForTagRow>("public_profile_best_for_tag_scores_v1", bestForParams),
        fetchRows<PowerSetRow>("public_profile_power_set_completions_v1", powerSetParams),
        fetchRows<IdentityRow>("public_identity_profiles_v1", identityParams),
        fetchRows<ProfileInsightIdRow>("profile_insight_capture_ids_v1", insightParams),
        fetchRows<TierSampleRow>("discover_feed_v1", tierSampleParams)
    ]);

    const speciesByIdentity = new Map<string, string>();
    const speciesByProfileId = new Map<string, string>();
    for (const entry of speciesEntries) {
        speciesByIdentity.set(entry.slug, entry.slug);
        if (entry.normalizedIdentityKey) {
            speciesByIdentity.set(toSpeciesSlug(entry.normalizedIdentityKey) ?? entry.slug, entry.slug);
        }
        if (entry.speciesProfileId) {
            speciesByProfileId.set(entry.speciesProfileId, entry.slug);
        }
    }

    const mapCaptureRow = (row: PublicCaptureRow) => {
        const identitySlug = toSpeciesSlug(row.normalized_identity_key);
        return toPublicCapture(row, identitySlug ? speciesByIdentity.get(identitySlug) ?? null : null);
    };

    const topCaptures = topRows.map(mapCaptureRow);
    const recentCaptures = recentRows.map(mapCaptureRow);
    const allCaptures = recentCaptures.length > 0 ? recentCaptures : topCaptures;

    // Insight leaders are ranked across the whole collection, so the winners
    // routinely sit outside the recent page and have to be fetched by id.
    const insightCapturesById = new Map(
        [...topCaptures, ...recentCaptures].map((capture) => [capture.id, capture])
    );
    const missingInsightIds = Array.from(
        new Set(insightRows.map((row) => row.capture_id).filter((id) => id && !insightCapturesById.has(id)))
    );
    if (missingInsightIds.length > 0) {
        const insightCaptureParams = new URLSearchParams({
            select: captureSelect,
            capture_id: `in.(${missingInsightIds.join(",")})`,
            limit: String(missingInsightIds.length)
        });
        for (const row of await fetchRows<PublicCaptureRow>("discover_feed_v1", insightCaptureParams)) {
            const capture = mapCaptureRow(row);
            insightCapturesById.set(capture.id, capture);
        }
    }

    const serverInsights = buildScopedInsights(insightRows, "overall", insightCapturesById);
    const wildInsights = buildScopedInsights(insightRows, "wild", insightCapturesById);

    const sampledSpeciesCount = new Set(
        allCaptures.map((capture) => capture.speciesSlug ?? capture.animalName.toLowerCase())
    ).size;
    const settingSourceRows = recentRows.length > 0 ? recentRows : topRows;
    const sampledSettingCounts = countCaptureSettingLabels(settingSourceRows);
    const unindexedCount = allCaptures.filter((capture) => !capture.isIndexed).length;

    const captureCount = Number(summary?.capture_count ?? allCaptures.length);
    const settingCounts = resolveProfileSettingCounts(
        summary
            ? {
                wild: Number(summary.wild_captures ?? 0),
                zoo: Number(summary.zoo_captures ?? 0),
                domestic: Number(summary.domestic_captures ?? 0),
                farm: Number(summary.farm_captures ?? 0)
            }
            : null,
        {
            wild: sampledSettingCounts.wild,
            zoo: sampledSettingCounts.zoo,
            domestic: sampledSettingCounts.domestic,
            farm: sampledSettingCounts.farm
        }
    );
    const indexedSpeciesCount = Number(summary?.indexed_species_count ?? summary?.unique_species ?? sampledSpeciesCount);
    const averageOf = (key: keyof Pick<PublicProfileCapture, "dominance" | "speed" | "size" | "intelligence" | "rarity">) => {
        if (!allCaptures.length) return 0;
        return Math.round(allCaptures.reduce((total, capture) => total + capture[key], 0) / allCaptures.length);
    };

    const locationVisits = buildLocationVisits(
        recentRows.map((row) => {
            const capture = mapCaptureRow(row);
            return Object.assign(capture, {
                locationLabel: row.location_display_label,
                latitude: row.location_lat,
                longitude: row.location_lng
            });
        })
    );

    const collectionArchetype = resolveCollectionArchetype(
        allCaptures.map((capture) => ({
            animalName: capture.animalName,
            contextLabel: capture.contextLabel,
            typeTags: recentRows.find((row) => row.capture_id === capture.id)?.type_tags ?? [],
            rarity: capture.rarity
        }))
    );
    const baseCollectorScore = Number(summary?.overall_score ?? allCaptures.reduce((total, capture) => total + capture.score, 0));
    const collectorScore = summary?.score_includes_power_sets
        ? baseCollectorScore
        : resolvePublicOverallScore(baseCollectorScore, powerSetRows);

    return {
        userId: profile.id,
        username: profile.username.trim(),
        displayName: profile.display_name?.trim() || profile.username.trim(),
        avatarUrl: profile.avatar_url?.trim() || null,
        bio: profile.bio?.trim() || null,
        instagramUrl: profile.instagram_url?.trim() || null,
        isPro: Boolean(profile.is_pro),
        joinedAt: profile.created_at ?? null,
        chromePreset: (
            ["spirit", "friend", "professional", "business"].includes(profile.chrome_preset?.trim().toLowerCase() ?? "")
                ? profile.chrome_preset!.trim().toLowerCase()
                : "spirit"
        ) as PublicProfileCard["chromePreset"],
        captureCount,
        speciesCount: Number(summary?.unique_species ?? sampledSpeciesCount),
        indexedSpeciesCount,
        catalogSpeciesCount: speciesEntries.length,
        unindexedCount,
        collectorScore,
        wildCount: settingCounts.wild,
        zooCount: settingCounts.zoo,
        domesticCount: settingCounts.domestic,
        farmCount: settingCounts.farm,
        rareFinds: Number(summary?.rare_finds ?? 0),
        tradesMade: Number(summary?.trades_made ?? 0),
        missionsCompleted: Number(summary?.missions_completed ?? 0),
        collectionValueUsd: summary?.collection_value_usd != null ? Number(summary.collection_value_usd) : null,
        averageRarity: summary?.average_rarity != null ? Number(summary.average_rarity) : null,
        averageTraits: {
            dominance: Number(summary?.average_dominance ?? averageOf("dominance")),
            speed: Number(summary?.average_speed ?? averageOf("speed")),
            size: Number(summary?.average_size ?? averageOf("size")),
            intelligence: Number(summary?.average_intelligence ?? averageOf("intelligence")),
            rarity: Number(summary?.average_rarity ?? averageOf("rarity"))
        },
        mostCommonAnimalName: summary?.most_common_animal_name?.trim() || null,
        collectionArchetype,
        bestForTagScores: bestForRows.map((row) => ({
            tagKey: row.tag_key,
            tagLabel: row.tag_label,
            score: row.score,
            captureCount: row.capture_count
        })),
        powerSetCompletions: powerSetRows.map((row) => ({
            powerKey: row.power_key,
            powerLabel: row.power_label,
            tier: row.tier,
            speciesCount: row.species_count,
            catalogLinkedCount: row.catalog_linked_count != null ? Number(row.catalog_linked_count) : null,
            rewardPoints: Number(row.reward_points ?? 0),
            completedAt: row.completed_at
        })),
        wildIdentity: toWildIdentity(identityRows[0], speciesByIdentity, speciesByProfileId),
        insights: serverInsights.length > 0
            ? serverInsights
            : buildInsights(allCaptures, summary?.best_find_id?.trim() ?? null),
        wildInsights,
        locationVisits,
        topCaptures,
        recentCaptures,
        battleTierCounts: buildBattleTierCounts(tierSampleRows),
        challengeWins: Number(summary?.challenge_wins ?? 0),
        challengeLosses: Number(summary?.challenge_losses ?? 0),
        locationVisibility: normalizeLocationVisibility(profile.location_visibility),
        discoveryDistanceMeters:
            Number(summary?.located_observation_count ?? 0) >= MIN_LOCATED_OBSERVATIONS_FOR_DISTANCE
            && summary?.discovery_distance_meters != null
                ? Number(summary.discovery_distance_meters)
                : null
    };
}
