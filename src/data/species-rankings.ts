import type {SpeciesEntry} from "@/data/species";
import {getDatabaseSpeciesBySlug} from "@/data/database-species-pages";
import {
    primarySpeciesCaptureMatchCandidate,
    captureMatchesSpeciesEntry
} from "@/lib/species-breed";
import type {CaptureGradeSource} from "@/lib/capture-grade";
import {storedCaptureGrade} from "@/lib/stored-capture-grade";
import {SPECIES_RANKING_ORDER, compareSpeciesRankingRows} from "@/lib/species-ranking-order";
import {fetchServerSpeciesRankingRows, isLikelyNonLiveRankingRow} from "@/lib/species-server-rankings";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

export type SpeciesRankingItem = {
    captureId: string;
    rank: number;
    score: number;
    animalName: string;
    username: string | null;
    displayName: string | null;
    contextLabel: string | null;
    locationDisplayLabel: string | null;
    imageBucket: string | null;
    imagePath: string | null;
    battleTier: string | null;
    endorsementCount: number;
    captureGrade: number | null;
    /**
     * Ranked collectors in the whole cohort, from the server (discover_ranking_page_v1, GRADING-5).
     * Absent on the fallback path, where only the loaded list is known.
     */
    totalCount?: number;
};

const RANKING_SELECT =
    "capture_id,animal_name,breed_guess,normalized_identity_key,species_profile_id,profile_username,profile_display_name,location_display_label,human_context,zoo_or_wild,image_bucket,image_path,image_mime_type,image_media_kind,score,endorsement_count,total_progression_xp,stat_total,capture_grade,capture_created_at,confidence,breed_confidence,signals,premium_details,observed_market_modifiers,dominance_endorsements,speed_endorsements,size_endorsements,intelligence_endorsements,rarity_endorsements,raw_json";


type DiscoverFeedRankingRow = CaptureGradeSource & {
    capture_id?: string;
    animal_name?: string | null;
    breed_guess?: string | null;
    normalized_identity_key?: string | null;
    species_profile_id?: string | null;
    profile_username?: string | null;
    profile_display_name?: string | null;
    location_display_label?: string | null;
    human_context?: string | null;
    zoo_or_wild?: string | null;
    image_bucket?: string | null;
    image_path?: string | null;
    image_mime_type?: string | null;
    image_media_kind?: string | null;
    score?: number | null;
    endorsement_count?: number | null;
    /** Ranking keys (migration 20261011130000). */
    total_progression_xp?: number | null;
    stat_total?: number | null;
    capture_created_at?: string | null;
};

function getBattleTier(rawJson: unknown) {
    if (!rawJson || typeof rawJson !== "object" || Array.isArray(rawJson)) {
        return null;
    }

    const value = (rawJson as Record<string, unknown>).battle_tier;
    return typeof value === "string" ? value.trim() || null : null;
}

function getSupabaseConfig() {
    const supabaseUrl = getSupabaseUrl();
    const readKey = getSupabaseServerReadKey();

    if (!supabaseUrl || !readKey) {
        return null;
    }

    return {supabaseUrl, readKey};
}

function filterRankingRowsForEntry(entry: SpeciesEntry, rows: DiscoverFeedRankingRow[]) {
    return rows.filter((row) => captureMatchesSpeciesEntry(entry, row));
}

function isRankableRow(row: DiscoverFeedRankingRow) {
    return Boolean(row.capture_id?.trim()) && !isLikelyNonLiveRankingRow(row);
}

function prepareRankingRows(rows: DiscoverFeedRankingRow[]) {
    return dedupeRows(rows)
        .filter(isRankableRow)
        .sort(compareSpeciesRankingRows);
}

async function resolveSpeciesEntryForRankings(entry: SpeciesEntry): Promise<SpeciesEntry> {
    if (entry.speciesProfileId && entry.normalizedIdentityKey) {
        return entry;
    }

    const databaseEntry = await getDatabaseSpeciesBySlug(entry.slug);

    if (!databaseEntry) {
        return entry;
    }

    return {
        ...entry,
        speciesProfileId: databaseEntry.speciesProfileId ?? entry.speciesProfileId,
        normalizedIdentityKey: databaseEntry.normalizedIdentityKey ?? entry.normalizedIdentityKey
    };
}

function getContextLabel(row: Pick<DiscoverFeedRankingRow, "zoo_or_wild" | "human_context">) {
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

function normalizeAnimalName(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function dedupeRows(rows: DiscoverFeedRankingRow[]) {
    const seen = new Set<string>();
    const deduped: DiscoverFeedRankingRow[] = [];

    for (const row of rows) {
        const captureId = row.capture_id?.trim();

        if (!captureId || seen.has(captureId)) {
            continue;
        }

        seen.add(captureId);
        deduped.push(row);
    }

    return deduped;
}

function toRankingItem(row: DiscoverFeedRankingRow, rank: number): SpeciesRankingItem {
    return {
        captureId: row.capture_id ?? "",
        rank,
        score: row.score ?? 0,
        animalName: row.animal_name?.trim() ?? "Animal",
        username: row.profile_username?.trim() ?? null,
        displayName: row.profile_display_name?.trim() ?? null,
        contextLabel: getContextLabel(row),
        locationDisplayLabel: row.location_display_label?.trim() ?? null,
        imageBucket: row.image_bucket ?? null,
        imagePath: row.image_path ?? null,
        battleTier: getBattleTier(row.raw_json),
        endorsementCount: row.endorsement_count ?? 0,
        // The stored grade, the same value the rows were just ranked by.
        captureGrade: storedCaptureGrade(row.capture_grade)
    };
}

function toRankingItems(rows: DiscoverFeedRankingRow[]): SpeciesRankingItem[] {
    // XP, then stats, then grade, then newest, then capture id — the order iOS ranks by.
    const sorted = [...rows].sort(compareSpeciesRankingRows);

    return sorted.map((row, index) => toRankingItem(row, index + 1)).filter((item) => item.captureId);
}

/** Server ranks (GRADING-5) as ranking items; null when the RPC is not deployed or fails. */
async function fetchServerRankingItems(entry: SpeciesEntry, limit: number): Promise<SpeciesRankingItem[] | null> {
    const config = getSupabaseConfig();
    if (!config) return null;
    const ranked = await fetchServerSpeciesRankingRows<DiscoverFeedRankingRow>(config, entry, limit, RANKING_SELECT);
    return ranked?.map(({row, rank, totalCount}) => ({...toRankingItem(row, rank), totalCount})) ?? null;
}

async function fetchDiscoverFeedRankings(searchParams: URLSearchParams): Promise<DiscoverFeedRankingRow[]> {
    const config = getSupabaseConfig();

    if (!config) {
        return [];
    }

    searchParams.set("select", RANKING_SELECT);
    searchParams.set("order", SPECIES_RANKING_ORDER);

    try {
        const response = await fetch(`${config.supabaseUrl}/rest/v1/discover_feed_v1?${searchParams.toString()}`, {
            headers: getSupabaseHeaders(config.readKey),
            next: {revalidate: 3600}
        });

        if (!response.ok) {
            return [];
        }

        return await response.json() as DiscoverFeedRankingRow[];
    } catch {
        return [];
    }
}

export async function getSpeciesRankings(entry: SpeciesEntry, limit = 24): Promise<SpeciesRankingItem[]> {
    const resolvedEntry = await resolveSpeciesEntryForRankings(entry);
    const serverItems = await fetchServerRankingItems(resolvedEntry, limit);

    if (serverItems) {
        return serverItems.slice(0, limit);
    }

    const primary = primarySpeciesCaptureMatchCandidate(resolvedEntry);

    if (primary) {
        const searchParams = new URLSearchParams({
            [primary.column]: `eq.${primary.value}`,
            limit: String(limit)
        });
        const rows = prepareRankingRows(filterRankingRowsForEntry(resolvedEntry, await fetchDiscoverFeedRankings(searchParams)));

        if (rows.length > 0) {
            return toRankingItems(rows).slice(0, limit);
        }
    }

    const normalizedName = normalizeAnimalName(resolvedEntry.name);
    const searchParams = new URLSearchParams({
        animal_name: `ilike.${normalizedName}`,
        limit: String(Math.max(limit * 2, 48))
    });
    const rows = prepareRankingRows(filterRankingRowsForEntry(
        resolvedEntry,
        await fetchDiscoverFeedRankings(searchParams)
    ))
        .filter((row) => normalizeAnimalName(row.animal_name ?? "") === normalizedName);

    return toRankingItems(rows).slice(0, limit);
}
