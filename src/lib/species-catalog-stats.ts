import "server-only";

import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

/**
 * Game stats for catalog rows.
 *
 * `species_catalog_v1` has never exposed `canonical_game_stats` or
 * `size_scale_score` — they belong to the underlying `species_profiles` row and
 * the view does not carry them forward. Naming either one in a select makes
 * PostgREST reject the whole query with a 400, which is how several admin
 * surfaces came to fail entirely rather than merely lose a column.
 *
 * So every caller that wants catalog rows *and* stats asks the view for what it
 * has, then merges the stats on here in one batched read keyed by the same id.
 */

export const PROFILE_OWNED_STAT_COLUMNS = ["canonical_game_stats", "size_scale_score"] as const;

export type ProfileStats = {
    canonical_game_stats: Record<string, number> | null;
    size_scale_score: number | null;
};

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    return url && key ? {url, key} : null;
}

/** Stats for the given profile ids, keyed by id. Missing ids are simply absent. */
export async function fetchProfileStats(speciesProfileIds: Array<string | null | undefined>) {
    const stats = new Map<string, ProfileStats>();
    const ids = Array.from(new Set(speciesProfileIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean)));

    const settings = config();
    if (!ids.length || !settings) return stats;

    const params = new URLSearchParams({
        select: `id,${PROFILE_OWNED_STAT_COLUMNS.join(",")}`,
        id: `in.(${ids.join(",")})`,
        limit: String(ids.length)
    });

    const response = await fetch(`${settings.url}/rest/v1/species_profiles?${params}`, {
        headers: getSupabaseHeaders(settings.key, {Accept: "application/json"}),
        cache: "no-store"
    });

    // Stats decorate a row; losing them must not take the whole surface down.
    if (!response.ok) return stats;

    for (const row of await response.json() as Array<Record<string, unknown>>) {
        const id = typeof row.id === "string" ? row.id : null;
        if (!id) continue;
        stats.set(id, {
            canonical_game_stats: (row.canonical_game_stats ?? null) as Record<string, number> | null,
            size_scale_score: typeof row.size_scale_score === "number" ? row.size_scale_score : null
        });
    }

    return stats;
}

/**
 * Merges the profile-owned stat columns onto catalog rows, so a row read from
 * the view carries the same shape callers expect from `species_profiles`.
 */
export async function attachProfileStats<T extends Record<string, unknown>>(
    rows: T[],
    idKey: string = "species_profile_id"
): Promise<Array<T & ProfileStats>> {
    const stats = await fetchProfileStats(rows.map((row) => row[idKey] as string | null | undefined));

    return rows.map((row) => {
        const id = typeof row[idKey] === "string" ? row[idKey] as string : "";
        const found = stats.get(id);
        return {
            ...row,
            canonical_game_stats: found?.canonical_game_stats ?? null,
            size_scale_score: found?.size_scale_score ?? null
        };
    });
}
