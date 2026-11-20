import "server-only";
import {ARK_SEEDS_ABSENT, shapeArkSeeds, type ArkSeeds} from "@/lib/ark-seeds";
import {isMissingArkFunction} from "@/lib/ark-story";
import {getSupabaseHeaders, getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";

/**
 * The Ark's published year seeds (`voyage_year_seeds_public_v1`, AnimalDex migration 20261204200000, P1-6): each Ark
 * year's commitment, and its seed once the year is over. Anonymous, with the public key, cached by Next's fetch cache for
 * `revalidate` seconds. Not there (the migration not applied, or no year committed yet: the flag is off): `available:
 * false`, and the "How the Ark works" page then shows nothing about seeds. A read that fails now is null.
 */
export async function readArkSeeds(revalidate = 600): Promise<ArkSeeds | null> {
    const url = getSupabaseUrl();
    const key = getSupabasePublicKey();
    if (!url || !key) return {...ARK_SEEDS_ABSENT};
    try {
        const response = await fetch(`${url}/rest/v1/rpc/voyage_year_seeds_public_v1`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            body: JSON.stringify({p_voyage: "first"}),
            next: {revalidate, tags: ["ark-seeds"]}
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) return isMissingArkFunction(body as {code?: string; message?: string} | null) ? {...ARK_SEEDS_ABSENT} : null;
        return shapeArkSeeds(body);
    } catch {
        return null;
    }
}
