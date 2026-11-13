import "server-only";
import {ARK_HOME_COUNTS_FALLBACK, arkHomeCountsFrom, type ArkHomeCounts} from "@/lib/ark-home-counts";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

export type {ArkHomeCounts};

/**
 * The home page's Ark counts, from `voyage_public_cache` with the service
 * role (the table has no public policy; decision 244's pattern): the cached
 * public read's `counts` and when it was computed, a few bytes, cached by
 * Next's fetch cache for `revalidate` seconds (the page is daily ISR). Counts
 * only: nobody's name or animal reaches the page. The fallback numbers when
 * the table cannot be read.
 */
export async function readArkHomeCounts(revalidate = 3600): Promise<ArkHomeCounts> {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) return ARK_HOME_COUNTS_FALLBACK;
    try {
        const response = await fetch(`${url}/rest/v1/voyage_public_cache?select=counts:body->counts,computed_at&order=computed_at.desc&limit=1`, {
            headers: getSupabaseHeaders(key),
            next: {revalidate, tags: ["ark-home-counts"]}
        });
        if (!response.ok) return ARK_HOME_COUNTS_FALLBACK;
        return arkHomeCountsFrom(await response.json());
    } catch {
        return ARK_HOME_COUNTS_FALLBACK;
    }
}
