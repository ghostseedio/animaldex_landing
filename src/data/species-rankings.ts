import type {SpeciesEntry} from "@/data/species";
import {getDatabaseSpeciesBySlug} from "@/data/database-species-pages";
import {
    buildSpeciesCaptureMatchCandidates,
    captureMatchesSpeciesEntry
} from "@/lib/species-breed";
import {computeCaptureGrade, type CaptureGradeSource} from "@/lib/capture-grade";
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
};

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

function buildSpeciesKeyCandidates(entry: SpeciesEntry) {
    return buildSpeciesCaptureMatchCandidates(entry);
}

function filterRankingRowsForEntry(entry: SpeciesEntry, rows: DiscoverFeedRankingRow[]) {
    return rows.filter((row) => captureMatchesSpeciesEntry(entry, row));
}

function isRankableRow(row: DiscoverFeedRankingRow) {
    return Boolean(row.capture_id?.trim());
}

function prepareRankingRows(rows: DiscoverFeedRankingRow[]) {
    return dedupeRows(rows)
        .filter(isRankableRow)
        .sort((left, right) => {
            const imageDelta = Number(isUsableRankingImage(right)) - Number(isUsableRankingImage(left));

            if (imageDelta !== 0) {
                return imageDelta;
            }

            return (right.score ?? 0) - (left.score ?? 0);
        });
}

async function resolveSpeciesEntryForRankings(entry: SpeciesEntry): Promise<SpeciesEntry> {
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

function isUsableRankingImage(row: DiscoverFeedRankingRow) {
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

function toRankingItems(rows: DiscoverFeedRankingRow[]): SpeciesRankingItem[] {
    const sorted = [...rows].sort((left, right) => {
        const scoreDelta = (right.score ?? 0) - (left.score ?? 0);

        if (scoreDelta !== 0) {
            return scoreDelta;
        }

        return (left.capture_id ?? "").localeCompare(right.capture_id ?? "");
    });

    return sorted.map((row, index) => ({
        captureId: row.capture_id ?? "",
        rank: index + 1,
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
        captureGrade: computeCaptureGrade(row)
    })).filter((item) => item.captureId);
}

async function fetchDiscoverFeedRankings(searchParams: URLSearchParams): Promise<DiscoverFeedRankingRow[]> {
    const config = getSupabaseConfig();

    if (!config) {
        return [];
    }

    searchParams.set(
        "select",
        "capture_id,animal_name,breed_guess,normalized_identity_key,species_profile_id,profile_username,profile_display_name,location_display_label,human_context,zoo_or_wild,image_bucket,image_path,image_mime_type,image_media_kind,score,endorsement_count,confidence,breed_confidence,signals,premium_details,observed_market_modifiers,dominance_endorsements,speed_endorsements,size_endorsements,intelligence_endorsements,rarity_endorsements,raw_json"
    );
    searchParams.set("order", "score.desc,capture_created_at.desc");

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

    for (const candidate of buildSpeciesKeyCandidates(resolvedEntry)) {
        const searchParams = new URLSearchParams({
            [candidate.column]: `eq.${candidate.value}`,
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
