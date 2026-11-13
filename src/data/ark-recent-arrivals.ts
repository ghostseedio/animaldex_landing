import "server-only";
import {arkRecentArrivals, recentArrivalSpeciesIds, type ArkArrivalEventRow, type ArkRecentArrival, type ArkSpeciesNameRow} from "@/lib/ark-recent-arrivals";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

export type {ArkRecentArrival};

/** Arrival rows read, so twenty distinct species are found even when a backfill brought many of one kind at once. */
const EVENT_ROWS = 160;

/**
 * The species that most recently came aboard, for /ark's words under its
 * heading: `voyage_events` (kind `arrival`, newest first) with the service
 * role (the log is closed to anon; decision 244's pattern), then the species'
 * names and page slugs from `species_profiles`. Read only, species and time
 * columns only: no animal id, bringer or payload reaches the page. Cached by
 * Next's fetch cache for `revalidate` seconds; null when it cannot be read.
 */
export async function readArkRecentArrivals(limit = 20, revalidate = 300): Promise<ArkRecentArrival[] | null> {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) return null;
    const headers = getSupabaseHeaders(key);
    try {
        const events = await fetch(
            `${url}/rest/v1/voyage_events?select=at,species_profile_id&kind=eq.arrival&species_profile_id=not.is.null&order=at.desc,id.desc&limit=${EVENT_ROWS}`,
            {headers, next: {revalidate, tags: ["ark-recent-arrivals"]}}
        );
        if (!events.ok) return null;
        const rows = (await events.json()) as ArkArrivalEventRow[];
        const ids = recentArrivalSpeciesIds(rows, limit);
        if (!ids.length) return [];
        const named = await fetch(`${url}/rest/v1/species_profiles?select=id,display_name,landing_page_slug&id=in.(${ids.join(",")})`, {
            headers,
            next: {revalidate, tags: ["ark-recent-arrivals"]}
        });
        if (!named.ok) return null;
        return arkRecentArrivals(rows, (await named.json()) as ArkSpeciesNameRow[], limit);
    } catch {
        return null;
    }
}
