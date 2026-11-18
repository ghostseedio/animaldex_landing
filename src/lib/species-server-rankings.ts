import {getSupabaseHeaders} from "@/lib/supabase-http";

/**
 * Species ranks from the server (GRADING-5, discover_ranking_page_v1): one card per collector,
 * capture_id as the final tiebreak, non-live captures excluded, numbers that hold across the whole
 * cohort. Returns the discover_feed_v1 rows in rank order with their server rank and the cohort
 * size, or null when the RPC is not deployed yet (or fails), so the caller ranks the rows itself.
 */
export type ServerRankedRow<Row> = {row: Row; rank: number; totalCount: number | undefined};

type RankRow = {capture_id?: unknown; rank?: unknown; total_count?: unknown};

export async function fetchServerSpeciesRankingRows<Row extends {capture_id?: string | null}>(
    config: {supabaseUrl: string; readKey: string},
    entry: {speciesProfileId?: string | null; normalizedIdentityKey?: string | null},
    limit: number,
    select: string,
    fetchImpl: typeof fetch = fetch
): Promise<Array<ServerRankedRow<Row>> | null> {
    const speciesProfileId = entry.speciesProfileId?.trim();
    const identityKey = entry.normalizedIdentityKey?.trim().toLowerCase();

    if (!speciesProfileId && !identityKey) {
        return null;
    }

    try {
        const rankResponse = await fetchImpl(`${config.supabaseUrl}/rest/v1/rpc/discover_ranking_page_v1`, {
            method: "POST",
            headers: getSupabaseHeaders(config.readKey, {"Content-Type": "application/json"}),
            body: JSON.stringify({
                p_species_profile_ids: speciesProfileId ? [speciesProfileId] : null,
                p_normalized_identity_keys: identityKey ? [identityKey] : null,
                p_offset: 0,
                p_limit: Math.max(1, Math.min(limit, 50))
            }),
            cache: "no-store"
        });

        if (!rankResponse.ok) {
            return null;
        }

        const ranks = (await rankResponse.json() as RankRow[]).flatMap((row) =>
            typeof row.capture_id === "string" && typeof row.rank === "number"
                ? [{captureId: row.capture_id, rank: row.rank, totalCount: typeof row.total_count === "number" ? row.total_count : undefined}]
                : []);

        if (ranks.length === 0) {
            return [];
        }

        const searchParams = new URLSearchParams({
            select,
            capture_id: `in.(${ranks.map((row) => row.captureId).join(",")})`
        });
        const rowsResponse = await fetchImpl(`${config.supabaseUrl}/rest/v1/discover_feed_v1?${searchParams.toString()}`, {
            headers: getSupabaseHeaders(config.readKey),
            cache: "no-store"
        });

        if (!rowsResponse.ok) {
            return null;
        }

        const rowsById = new Map((await rowsResponse.json() as Row[]).map((row) => [row.capture_id ?? "", row]));

        // A ranked capture the feed no longer returns (made private a moment ago) is left out.
        return ranks.flatMap(({captureId, rank, totalCount}) => {
            const row = rowsById.get(captureId);
            return row ? [{row, rank, totalCount}] : [];
        });
    } catch {
        return null;
    }
}

/** A likely non-live source (a screen, print or toy) is never ranked: the server's capture_ranking_is_live. */
export function isLikelyNonLiveRankingRow(row: {raw_json?: unknown}) {
    const model = row.raw_json && typeof row.raw_json === "object" && !Array.isArray(row.raw_json)
        ? (row.raw_json as Record<string, unknown>).model
        : null;
    if (!model || typeof model !== "object" || Array.isArray(model)) return false;
    const fields = model as Record<string, unknown>;
    return fields.authenticity_status === "likely_non_live_source" || fields.capture_validity === "likely_non_live_source";
}
