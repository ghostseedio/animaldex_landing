import "server-only";

import {getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import {resolveCollectionArchetype} from "@/lib/collection-archetype";
import {getCaptureImageRoute} from "@/lib/capture-storage-image";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

const PUBLIC_PROFILE_REVALIDATE_SECONDS = 60;
const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,28}[a-z0-9])?$/;

type ProfileRow = {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    bio?: string | null;
    instagram_url?: string | null;
    is_pro?: boolean | null;
    created_at?: string | null;
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
    type_tags?: string[] | null;
    game_stats?: Record<string, number> | null;
    dominance_boost?: number | null;
    speed_boost?: number | null;
    intelligence_boost?: number | null;
};

type PublicProfileSummaryRow = {
    overall_score: number | null;
    capture_count: number | null;
    unique_species: number | null;
    indexed_species_count?: number | null;
    wild_captures: number | null;
    zoo_captures: number | null;
    domestic_captures: number | null;
    rare_finds?: number | null;
    average_rarity?: number | null;
    most_common_animal_name?: string | null;
    best_find_id?: string | null;
    trades_made?: number | null;
    missions_completed?: number | null;
    collection_value_usd?: number | null;
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
    origin_normalized_identity_key?: string | null;
    apex_display_name: string | null;
    apex_normalized_identity_key?: string | null;
    active_display_name: string | null;
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
};

export type ProfileInsight = {
    title: string;
    capture: PublicProfileCapture | null;
};

export type PublicProfileCard = {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    instagramUrl: string | null;
    isPro: boolean;
    joinedAt: string | null;
    captureCount: number;
    speciesCount: number;
    indexedSpeciesCount: number;
    catalogSpeciesCount: number;
    unindexedCount: number;
    collectorScore: number;
    wildCount: number;
    zooCount: number;
    domesticCount: number;
    rareFinds: number;
    tradesMade: number;
    missionsCompleted: number;
    collectionValueUsd: number | null;
    averageRarity: number | null;
    mostCommonAnimalName: string | null;
    collectionArchetype: string;
    bestForTagScores: ProfileBestForTag[];
    powerSetCompletions: ProfilePowerSetCompletion[];
    wildIdentity: PublicWildIdentity | null;
    insights: ProfileInsight[];
    locationVisits: ProfileLocationVisit[];
    topCaptures: PublicProfileCapture[];
    recentCaptures: PublicProfileCapture[];
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

async function fetchPublicProfileSummary(userId: string) {
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
    const setting = row.zoo_or_wild?.trim();
    if (setting && setting !== "Unknown") return setting;

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
        isIndexed: Boolean(row.species_profile_id?.trim())
    };
}

function buildLocationVisits(captures: Array<PublicProfileCapture & {locationLabel?: string | null}>): ProfileLocationVisit[] {
    const grouped = new Map<string, ProfileLocationVisit>();

    for (const row of captures) {
        const label = row.locationLabel?.trim();
        if (!label) continue;

        const key = label.toLowerCase();
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
                lastSeenAt: row.capturedAt
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

function toIdentityRole(
    label: string,
    name: string | null | undefined,
    identityKey: string | null | undefined,
    hidden: boolean,
    speciesByIdentity: Map<string, string>
): PublicIdentityRole {
    const slug = identityKey ? speciesByIdentity.get(toSpeciesSlug(identityKey) ?? "") ?? null : null;

    return {
        label,
        name: hidden ? "Private" : name?.trim() || "—",
        speciesSlug: hidden ? null : slug,
        hidden
    };
}

function toWildIdentity(row: IdentityRow | undefined, speciesByIdentity: Map<string, string>): PublicWildIdentity | null {
    if (!row) return null;

    return {
        headline: row.public_summary?.headline?.trim() || null,
        summary: row.public_summary?.summary?.trim() || null,
        origin: toIdentityRole(
            "Origin",
            row.origin_display_name,
            row.origin_normalized_identity_key,
            row.show_origin_publicly === false,
            speciesByIdentity
        ),
        apex: toIdentityRole(
            "Apex",
            row.apex_display_name,
            row.apex_normalized_identity_key,
            row.show_apex_publicly === false,
            speciesByIdentity
        ),
        active: toIdentityRole(
            "Active",
            row.active_display_name,
            row.active_normalized_identity_key,
            row.show_active_publicly === false,
            speciesByIdentity
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
        select: "id,username,display_name,avatar_url,bio,instagram_url,is_pro,created_at",
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
        "type_tags",
        "game_stats",
        "dominance_boost",
        "speed_boost",
        "intelligence_boost"
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
        select: "user_id,origin_display_name,origin_normalized_identity_key,apex_display_name,apex_normalized_identity_key,active_display_name,active_normalized_identity_key,public_summary,show_origin_publicly,show_apex_publicly,show_active_publicly",
        user_id: `eq.${profile.id}`,
        limit: "1"
    });

    const [
        topRows,
        recentRows,
        speciesEntries,
        summary,
        bestForRows,
        powerSetRows,
        identityRows
    ] = await Promise.all([
        fetchRows<PublicCaptureRow>("discover_feed_v1", topCaptureParams),
        fetchRows<PublicCaptureRow>("discover_feed_v1", recentCaptureParams),
        getUnifiedSpeciesEntries(),
        fetchPublicProfileSummary(profile.id),
        fetchRows<BestForTagRow>("public_profile_best_for_tag_scores_v1", bestForParams),
        fetchRows<PowerSetRow>("public_profile_power_set_completions_v1", powerSetParams),
        fetchRows<IdentityRow>("public_identity_profiles_v1", identityParams)
    ]);

    const speciesByIdentity = new Map<string, string>();
    for (const entry of speciesEntries) {
        speciesByIdentity.set(entry.slug, entry.slug);
        if (entry.normalizedIdentityKey) {
            speciesByIdentity.set(toSpeciesSlug(entry.normalizedIdentityKey) ?? entry.slug, entry.slug);
        }
    }

    const mapCaptureRow = (row: PublicCaptureRow) => {
        const identitySlug = toSpeciesSlug(row.normalized_identity_key);
        return toPublicCapture(row, identitySlug ? speciesByIdentity.get(identitySlug) ?? null : null);
    };

    const topCaptures = topRows.map(mapCaptureRow);
    const recentCaptures = recentRows.map(mapCaptureRow);
    const allCaptures = recentCaptures.length > 0 ? recentCaptures : topCaptures;

    const sampledSpeciesCount = new Set(
        allCaptures.map((capture) => capture.speciesSlug ?? capture.animalName.toLowerCase())
    ).size;
    const sampledWildCount = allCaptures.filter((capture) => capture.contextLabel === "Wild").length;
    const sampledZooCount = allCaptures.filter((capture) => capture.contextLabel === "Zoo").length;
    const sampledDomesticCount = allCaptures.filter((capture) =>
        capture.contextLabel === "Domestic" || capture.contextLabel === "Farm"
    ).length;
    const unindexedCount = allCaptures.filter((capture) => !capture.isIndexed).length;

    const captureCount = Number(summary?.capture_count ?? allCaptures.length);
    const wildCount = Number(summary?.wild_captures ?? sampledWildCount);
    const zooCount = Number(summary?.zoo_captures ?? sampledZooCount);
    const domesticCount = Number(summary?.domestic_captures ?? sampledDomesticCount);
    const indexedSpeciesCount = Number(summary?.indexed_species_count ?? summary?.unique_species ?? sampledSpeciesCount);

    const locationVisits = buildLocationVisits(
        recentRows.map((row) => {
            const capture = mapCaptureRow(row);
            return Object.assign(capture, {locationLabel: row.location_display_label});
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

    return {
        userId: profile.id,
        username: profile.username.trim(),
        displayName: profile.display_name?.trim() || profile.username.trim(),
        avatarUrl: profile.avatar_url?.trim() || null,
        bio: profile.bio?.trim() || null,
        instagramUrl: profile.instagram_url?.trim() || null,
        isPro: Boolean(profile.is_pro),
        joinedAt: profile.created_at ?? null,
        captureCount,
        speciesCount: Number(summary?.unique_species ?? sampledSpeciesCount),
        indexedSpeciesCount,
        catalogSpeciesCount: speciesEntries.length,
        unindexedCount,
        collectorScore: resolvePublicOverallScore(baseCollectorScore, powerSetRows),
        wildCount,
        zooCount,
        domesticCount,
        rareFinds: Number(summary?.rare_finds ?? 0),
        tradesMade: Number(summary?.trades_made ?? 0),
        missionsCompleted: Number(summary?.missions_completed ?? 0),
        collectionValueUsd: summary?.collection_value_usd != null ? Number(summary.collection_value_usd) : null,
        averageRarity: summary?.average_rarity != null ? Number(summary.average_rarity) : null,
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
        wildIdentity: toWildIdentity(identityRows[0], speciesByIdentity),
        insights: buildInsights(allCaptures, summary?.best_find_id?.trim() ?? null),
        locationVisits,
        topCaptures,
        recentCaptures
    };
}
