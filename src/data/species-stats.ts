import type {SpeciesEntry} from "@/data/species";
import {getSpeciesBySlug} from "@/data/species";
import {getResolvedSpeciesBySlug} from "@/data/database-species-pages";
import type {AnimalBattleTier, SpeciesStats} from "@/lib/battle-tier";
import {getBattlePower, getBattleTier} from "@/lib/battle-tier";
import {buildDeterministicCanonicalStats} from "@/data/species-stats-deterministic";

export type {AnimalBattleTier, SpeciesStats};
export {getBattlePower, getBattleTier, buildDeterministicCanonicalStats};
import {
    getSupabaseHeaders,
    getSupabaseServerReadKey,
    getSupabaseUrl
} from "@/lib/supabase-http";

const SPECIES_STATS_KEYS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;
const PLACEHOLDER_SCIENTIFIC_NAME = "Scientific classification under review";
const SPECIES_STATS_REVALIDATE_SECONDS = 86400;

type SpeciesStatsKey = (typeof SPECIES_STATS_KEYS)[number];

export type SpeciesStatsSource =
    | "species_profile"
    | "analysis_base"
    | "analysis_effective"
    | "raw_json"
    | "generated"
    | "none";

type SpeciesKeyCandidate = {
    analysisColumn: "species_profile_id" | "normalized_identity_key" | "scientific_name" | "animal_name";
    profileColumn: "id" | "normalized_identity_key" | "scientific_name" | "display_name" | "refined_identity" | "animal_name";
    value: string;
};

type SpeciesProfileRow = {
    id: string;
    display_name?: string | null;
    animal_name?: string | null;
    refined_identity?: string | null;
    normalized_identity_key?: string | null;
    scientific_name?: string | null;
    canonical_game_stats?: unknown;
};

type AnalysisResultCandidate = {
    id: string;
    capture_id: string;
    animal_name?: string | null;
    species_profile_id?: string | null;
    normalized_identity_key?: string | null;
    scientific_name?: string | null;
    confidence?: number | null;
    game_stats?: unknown;
    raw_json?: unknown;
    error_message?: string | null;
    captures?: {
        created_at?: string | null;
    } | null;
};

type AnalysisStatsResolution = {
    row: AnalysisResultCandidate;
    stats: SpeciesStats;
    source: Exclude<SpeciesStatsSource, "species_profile" | "generated" | "none">;
    rows: AnalysisResultCandidate[];
};

type SpeciesStatsIdentity = {
    species_profile_id: string | null;
    normalized_identity_key: string | null;
    scientific_name: string | null;
};

export type SpeciesStatsResolution = SpeciesStatsIdentity & {
    stats: SpeciesStats | null;
    statsSource: SpeciesStatsSource;
};

function getReadSupabaseConfig() {
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getSupabaseServerReadKey();

    if (!supabaseUrl || !anonKey) {
        return null;
    }

    return {supabaseUrl, key: anonKey};
}

function clampStatValue(value: number) {
    return Math.max(1, Math.min(100, Math.round(value)));
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function parseSpeciesStats(value: unknown): SpeciesStats | null {
    const record = asRecord(value);

    if (!record) {
        return null;
    }

    const parsed = {} as SpeciesStats;

    for (const key of SPECIES_STATS_KEYS) {
        const rawValue = record[key];
        const numericValue = typeof rawValue === "number"
            ? rawValue
            : typeof rawValue === "string" && rawValue.trim()
                ? Number(rawValue)
                : Number.NaN;

        if (!Number.isFinite(numericValue)) {
            return null;
        }

        parsed[key] = clampStatValue(numericValue);
    }

    return parsed;
}

function extractRawJsonStats(rawJson: unknown) {
    const record = asRecord(rawJson);

    if (!record) {
        return null;
    }

    const modelStats = parseSpeciesStats(asRecord(record.model)?.game_stats);

    if (modelStats) {
        return modelStats;
    }

    return parseSpeciesStats(asRecord(record.raw_openai)?.game_stats);
}

function buildSpeciesKeyCandidates(entry: SpeciesEntry): SpeciesKeyCandidate[] {
    return [
        entry.speciesProfileId
            ? {
                analysisColumn: "species_profile_id",
                profileColumn: "id",
                value: entry.speciesProfileId
            }
            : null,
        (entry.normalizedIdentityKey ?? entry.slug)
            ? {
                analysisColumn: "normalized_identity_key",
                profileColumn: "normalized_identity_key",
                value: entry.normalizedIdentityKey ?? entry.slug
            }
            : null,
        entry.slug.includes("-")
            ? {
                analysisColumn: "normalized_identity_key",
                profileColumn: "normalized_identity_key",
                value: entry.slug.replaceAll("-", "_")
            }
            : null,
        entry.analysis.scientificName && entry.analysis.scientificName !== PLACEHOLDER_SCIENTIFIC_NAME
            ? {
                analysisColumn: "scientific_name",
                profileColumn: "scientific_name",
                value: entry.analysis.scientificName
            }
            : null,
        entry.name
            ? {
                analysisColumn: "animal_name",
                profileColumn: "display_name",
                value: entry.name
            }
            : null,
        entry.name
            ? {
                analysisColumn: "animal_name",
                profileColumn: "refined_identity",
                value: entry.name
            }
            : null,
        entry.name
            ? {
                analysisColumn: "animal_name",
                profileColumn: "animal_name",
                value: entry.name
            }
            : null
    ].filter((candidate): candidate is SpeciesKeyCandidate => Boolean(candidate?.value));
}

function getResolvedIdentity(
    entry: SpeciesEntry,
    speciesProfile: SpeciesProfileRow | null,
    analysisRow?: AnalysisResultCandidate | null
): SpeciesStatsIdentity {
    return {
        species_profile_id: speciesProfile?.id ?? analysisRow?.species_profile_id ?? entry.speciesProfileId ?? null,
        normalized_identity_key: speciesProfile?.normalized_identity_key
            ?? analysisRow?.normalized_identity_key
            ?? entry.normalizedIdentityKey
            ?? entry.slug
            ?? null,
        scientific_name: speciesProfile?.scientific_name ?? analysisRow?.scientific_name ?? entry.analysis.scientificName ?? null
    };
}

function normalizeAnalysisError(value: string | null | undefined) {
    if (typeof value !== "string") {
        return "";
    }

    return value.trim();
}

async function fetchSpeciesProfile(entry: SpeciesEntry) {
    const config = getReadSupabaseConfig();

    if (!config) {
        return null;
    }

    for (const candidate of buildSpeciesKeyCandidates(entry).slice(0, 2)) {
        const searchParams = new URLSearchParams({
            select: "id,display_name,animal_name,refined_identity,normalized_identity_key,scientific_name,canonical_game_stats",
            [candidate.profileColumn]: `eq.${candidate.value}`,
            limit: "1"
        });

        try {
            const response = await fetch(`${config.supabaseUrl}/rest/v1/species_profiles?${searchParams.toString()}`, {
                headers: getSupabaseHeaders(config.key),
                next: {revalidate: SPECIES_STATS_REVALIDATE_SECONDS}
            });

            if (!response.ok) {
                continue;
            }

            const rows = await response.json() as SpeciesProfileRow[];

            if (rows.length > 0) {
                return rows[0];
            }
        } catch {
            continue;
        }
    }

    return null;
}

function resolveAnalysisStats(rows: AnalysisResultCandidate[]): AnalysisStatsResolution | null {
    const filteredRows = rows.filter((row) => normalizeAnalysisError(row.error_message).length === 0);
    const sortedRows = filteredRows.sort((left, right) => {
        const leftEffective = parseSpeciesStats(left.game_stats) ? 1 : 0;
        const rightEffective = parseSpeciesStats(right.game_stats) ? 1 : 0;

        if (leftEffective !== rightEffective) {
            return rightEffective - leftEffective;
        }

        const leftConfidence = left.confidence ?? 0;
        const rightConfidence = right.confidence ?? 0;

        if (leftConfidence !== rightConfidence) {
            return rightConfidence - leftConfidence;
        }

        return new Date(right.captures?.created_at ?? 0).getTime() - new Date(left.captures?.created_at ?? 0).getTime();
    });

    for (const row of sortedRows) {
        const effectiveStats = parseSpeciesStats(row.game_stats);

        if (effectiveStats) {
            return {
                row,
                stats: effectiveStats,
                source: "analysis_effective",
                rows: sortedRows
            };
        }

        const rawJsonStats = extractRawJsonStats(row.raw_json);

        if (rawJsonStats) {
            return {
                row,
                stats: rawJsonStats,
                source: "raw_json",
                rows: sortedRows
            };
        }
    }

    return null;
}

async function fetchAnalysisStats(entry: SpeciesEntry) {
    const config = getReadSupabaseConfig();

    if (!config) {
        return null;
    }

    for (const candidate of buildSpeciesKeyCandidates(entry).slice(0, 2)) {
        const searchParams = new URLSearchParams({
            select: "id,capture_id,animal_name,species_profile_id,normalized_identity_key,scientific_name,confidence,game_stats,raw_json,error_message,captures!inner(created_at)",
            completed_at: "not.is.null",
            "captures.is_discoverable": "eq.true",
            "captures.status": "eq.ready",
            [candidate.analysisColumn]: `eq.${candidate.value}`,
            or: "(error_message.is.null,error_message.eq.)",
            limit: "24",
            order: "confidence.desc"
        });

        try {
            const response = await fetch(`${config.supabaseUrl}/rest/v1/analysis_results?${searchParams.toString()}`, {
                headers: getSupabaseHeaders(config.key),
                next: {revalidate: SPECIES_STATS_REVALIDATE_SECONDS}
            });

            if (!response.ok) {
                continue;
            }

            const rows = await response.json() as AnalysisResultCandidate[];
            const resolution = resolveAnalysisStats(rows);

            if (resolution) {
                return resolution;
            }
        } catch {
            continue;
        }
    }

    return null;
}

function getCatalogCanonicalStats(entry: SpeciesEntry) {
    return parseSpeciesStats(entry.databaseSource?.canonicalGameStats);
}

export function resolveLocalSpeciesStats(entry: SpeciesEntry): SpeciesStatsResolution {
    const catalogStats = getCatalogCanonicalStats(entry);

    if (catalogStats) {
        return {
            stats: catalogStats,
            statsSource: "species_profile",
            ...getResolvedIdentity(entry, null)
        };
    }

    return {
        stats: buildDeterministicCanonicalStats(entry),
        statsSource: "generated",
        ...getResolvedIdentity(entry, null)
    };
}

export async function resolveSpeciesStats(slug: string, entryOverride?: SpeciesEntry | null): Promise<SpeciesStatsResolution> {
    const entry = entryOverride ?? getSpeciesBySlug(slug) ?? await getResolvedSpeciesBySlug(slug);

    if (!entry) {
        return {
            stats: null,
            statsSource: "none",
            species_profile_id: null,
            normalized_identity_key: null,
            scientific_name: null
        };
    }

    const catalogStats = getCatalogCanonicalStats(entry);

    if (catalogStats) {
        return {
            stats: catalogStats,
            statsSource: "species_profile",
            ...getResolvedIdentity(entry, null)
        };
    }

    const speciesProfile = await fetchSpeciesProfile(entry);
    const profileStats = parseSpeciesStats(speciesProfile?.canonical_game_stats);

    if (profileStats) {
        return {
            stats: profileStats,
            statsSource: "species_profile",
            ...getResolvedIdentity(entry, speciesProfile)
        };
    }

    const analysisResolution = await fetchAnalysisStats(entry);

    if (analysisResolution) {
        return {
            stats: analysisResolution.stats,
            statsSource: analysisResolution.source,
            ...getResolvedIdentity(entry, speciesProfile, analysisResolution.row)
        };
    }

    // Read-only fallback: never upsert species_profiles / analysis_results from page render.
    return {
        stats: buildDeterministicCanonicalStats(entry),
        statsSource: "generated",
        ...getResolvedIdentity(entry, speciesProfile)
    };
}
