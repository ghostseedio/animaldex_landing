import "server-only";
import {isHumanSpecies} from "@/lib/people-are-never-public";

import {getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import {resolvePublicOverallScore} from "@/data/public-profiles";
import {getCaptureImageRoute} from "@/lib/capture-storage-image";
import {getCollectorScoreBand} from "@/lib/collector-score";
import {readArkScore} from "@/lib/ark-world";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";
import {rowIsHomoSapiens} from "@/lib/people-never-public";

type QueryRow = Record<string, unknown>;

export type DiscoverCollectorItem = {
    userId: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
    bio: string | null;
    isPro: boolean;
    /** Matches public profile / iOS collector score (summary score + power-set bonus). */
    collectorScore: number;
    /**
     * Life Sim (docs/life-sim/CONTRACT.md, section 9): Ark Score, shown in
     * place of Overall, with Steps and Powers. Null on a server without them.
     * Ark 3.3: the world score, 0–100 (the list keeps its collection order).
     */
    arkScore: number | null;
    stepsTotal: number | null;
    powersEarned: number | null;
    scoreTierLabel: string;
    captureCount: number;
    indexedSpeciesCount: number;
    catalogSpeciesCount: number;
    rareFinds: number;
    bestFindAnimalName: string | null;
    bestFindImageSrc: string | null;
    href: string | null;
};

const SUMMARY_SELECT = [
    "user_id",
    "overall_score",
    "capture_count",
    "unique_species",
    "indexed_species_count",
    "rare_finds",
    "best_find_id"
].join(",");

const PROFILE_SELECT = "id,username,display_name,avatar_url,bio,is_pro";
const BEST_FIND_SELECT = "capture_id,animal_name,normalized_identity_key,scientific_name,image_bucket,image_path,image_mime_type,image_media_kind";
const POWER_SET_SELECT = "user_id,reward_points";

function readString(row: QueryRow, key: string) {
    const value = row[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(row: QueryRow, key: string) {
    const value = Number(row[key] ?? 0);
    return Number.isFinite(value) ? value : 0;
}

function getConfig() {
    const url = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    return url && key ? {url, key} : null;
}

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

async function fetchRows<T>(table: string, params: URLSearchParams) {
    const config = getConfig();
    if (!config) return [] as T[];

    try {
        const response = await fetch(`${config.url}/rest/v1/${table}?${params}`, {
            headers: getSupabaseHeaders(config.key),
            next: {revalidate: 3600}
        });
        if (!response.ok) return [] as T[];
        const rows = await response.json();
        return Array.isArray(rows) ? rows as T[] : [] as T[];
    } catch {
        return [] as T[];
    }
}

async function fetchRowsByIds<T>(table: string, select: string, column: string, ids: string[]) {
    const rows: T[] = [];
    for (const chunk of chunkValues(ids, 40)) {
        if (!chunk.length) continue;
        const params = new URLSearchParams({
            select,
            [column]: postgrestInFilter(chunk),
            limit: String(Math.max(chunk.length, 100))
        });
        rows.push(...await fetchRows<T>(table, params));
    }
    return rows;
}

function resolveBestFindImage(captureId: string | null, row: QueryRow | null | undefined) {
    if (!captureId) return null;
    const bucket = readString(row ?? {}, "image_bucket");
    const path = readString(row ?? {}, "image_path");
    const mediaKind = readString(row ?? {}, "image_media_kind")?.toLowerCase();
    const mimeType = readString(row ?? {}, "image_mime_type");

    if (!bucket || !path) return null;
    if (mediaKind && mediaKind !== "photo") return null;
    if (mimeType && !mimeType.startsWith("image/")) return null;

    return getCaptureImageRoute(captureId);
}

/**
 * The summary's Ark columns for one page of collectors, read on their own so
 * an old server (no columns) changes nothing. Never for the whole list, and
 * never sorted by: the view works Ark Score out per row.
 */
async function loadArkSummaries(userIds: string[]) {
    // Captures + thrive: v3's points (`ark_points`), beside v2's world score; a server without a column refuses the whole select,
    // so v2 alone, then the old key, is asked then.
    const read = (select: string) => fetchRowsByIds<QueryRow>("member_profile_summaries_v1", select, "user_id", userIds);
    const withPoints = await read("user_id,ark_points,ark_world_score,steps_total,powers_earned");
    const withWorld = withPoints.length || !userIds.length ? withPoints : await read("user_id,ark_world_score,steps_total,powers_earned");
    const rows = withWorld.length || !userIds.length
        ? withWorld
        : await read("user_id,ark_score,steps_total,powers_earned");
    const nullable = (row: QueryRow, key: string) => (row[key] == null ? null : readNumber(row, key));
    return new Map(rows.flatMap((row) => {
        const userId = readString(row, "user_id");
        const score = readArkScore(row);
        return userId && score
            ? [[userId, {arkScore: score.value, stepsTotal: nullable(row, "steps_total"), powersEarned: nullable(row, "powers_earned")}] as const]
            : [];
    }));
}

async function loadDiscoverCollectorRows() {
    const params = new URLSearchParams({
        select: SUMMARY_SELECT,
        capture_count: "gt.0",
        order: "overall_score.desc,user_id.asc",
        limit: "500"
    });
    return fetchRows<QueryRow>("member_profile_summaries_v1", params);
}

let collectorListCache: {items: DiscoverCollectorItem[]; expiresAt: number} | null = null;
const COLLECTOR_LIST_CACHE_TTL_MS = 60_000;

async function loadAllDiscoverCollectors() {
    if (collectorListCache && collectorListCache.expiresAt > Date.now()) {
        return collectorListCache.items;
    }

    const summaryRows = await loadDiscoverCollectorRows();
    if (!summaryRows.length) {
        collectorListCache = {items: [], expiresAt: Date.now() + COLLECTOR_LIST_CACHE_TTL_MS};
        return [];
    }

    const userIds = summaryRows.map((row) => readString(row, "user_id")).filter(Boolean) as string[];
    const bestFindIds = summaryRows.map((row) => readString(row, "best_find_id")).filter(Boolean) as string[];

    const [profileRows, powerSetRows, bestFindRows, unifiedSpeciesEntries] = await Promise.all([
        fetchRowsByIds<QueryRow>("profiles", PROFILE_SELECT, "id", userIds),
        fetchRowsByIds<QueryRow>("public_profile_power_set_completions_v1", POWER_SET_SELECT, "user_id", userIds),
        fetchRowsByIds<QueryRow>("discover_feed_v1", BEST_FIND_SELECT, "capture_id", bestFindIds),
        getUnifiedSpeciesEntries()
    ]);
    const catalogSpeciesCount = unifiedSpeciesEntries.length;

    const profilesById = new Map(profileRows.map((row) => [readString(row, "id") ?? "", row]));
    // People are never public (DECISIONS §11): a person is never anyone's best find.
    const bestFindsById = new Map(bestFindRows
        .filter((row) => !isHumanSpecies({identityKey: readString(row, "normalized_identity_key"), scientificName: readString(row, "scientific_name")}))
        .map((row) => [readString(row, "capture_id") ?? "", row]));
    const powerSetsByUser = new Map<string, Array<{reward_points: number | null}>>();

    for (const row of powerSetRows) {
        const userId = readString(row, "user_id");
        if (!userId) continue;
        const group = powerSetsByUser.get(userId) ?? [];
        group.push({reward_points: readNumber(row, "reward_points")});
        powerSetsByUser.set(userId, group);
    }

    const collectors = summaryRows
    .map<DiscoverCollectorItem | null>((summary) => {
        const userId = readString(summary, "user_id") ?? "";
        const profile = profilesById.get(userId);
        const username = readString(profile ?? {}, "username");
        if (!username) return null;

        const baseScore = readNumber(summary, "overall_score");
        const collectorScore = resolvePublicOverallScore(
            baseScore,
            powerSetsByUser.get(userId) ?? []
        );
        const bestFindId = readString(summary, "best_find_id");
        const found = bestFindId ? bestFindsById.get(bestFindId) : null;
        // People are never public (DECISIONS section 11): a person is nobody's best find.
        const bestFind = found && !rowIsHomoSapiens(found) ? found : null;
        const indexedSpeciesCount = readNumber(summary, "indexed_species_count")
            || readNumber(summary, "unique_species");

        return {
            userId,
            displayName: readString(profile ?? {}, "display_name") ?? username,
            username,
            avatarUrl: readString(profile ?? {}, "avatar_url"),
            bio: readString(profile ?? {}, "bio"),
            isPro: profile?.is_pro === true,
            collectorScore,
            // Read for the page shown only (`getDiscoverCollectorsPage`): Ark Score is worked out per row.
            arkScore: null,
            stepsTotal: null,
            powersEarned: null,
            scoreTierLabel: getCollectorScoreBand(collectorScore).tierLabel,
            captureCount: readNumber(summary, "capture_count"),
            indexedSpeciesCount,
            catalogSpeciesCount,
            rareFinds: readNumber(summary, "rare_finds"),
            bestFindAnimalName: readString(bestFind ?? {}, "animal_name"),
            bestFindImageSrc: bestFind ? resolveBestFindImage(bestFindId, bestFind) : null,
            href: `/u/${encodeURIComponent(username)}`
        };
    })
    .filter((item): item is DiscoverCollectorItem => item !== null)
    .sort((left, right) => {
        const scoreDelta = right.collectorScore - left.collectorScore;
        if (scoreDelta !== 0) return scoreDelta;
        return (left.username ?? "").localeCompare(right.username ?? "");
    });

    collectorListCache = {items: collectors, expiresAt: Date.now() + COLLECTOR_LIST_CACHE_TTL_MS};
    return collectors;
}

export async function getDiscoverCollectors(limit = 24, offset = 0): Promise<DiscoverCollectorItem[]> {
    const {collectors} = await getDiscoverCollectorsPage(limit, offset);
    return collectors;
}

export async function getDiscoverCollectorsPage(limit = 24, offset = 0) {
    const collectors = await loadAllDiscoverCollectors();
    const listed = collectors.slice(offset, offset + limit);
    const arkByUser = await loadArkSummaries(listed.map((item) => item.userId));
    const page = listed.map((item) => ({...item, ...(arkByUser.get(item.userId) ?? {})}));

    return {
        collectors: page,
        total: collectors.length,
        hasMore: offset + page.length < collectors.length
    };
}
