import {getSupabaseHeaders, getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";
import {ARK_FIELD_GUIDE_COLUMNS, type ArkFieldGuide} from "@/lib/ark-clips/facts";

/**
 * One species' stored field guide, read-only: a single GET with the public
 * key (`species_field_guide` is readable by anon, migration
 * 20260704100000). Null when there is none or the read fails.
 */
export async function readArkFieldGuide(speciesProfileId: string): Promise<ArkFieldGuide | null> {
    if (!/^[0-9a-f-]{36}$/i.test(speciesProfileId)) return null;
    const url = getSupabaseUrl();
    const key = getSupabasePublicKey();
    if (!url || !key) throw new Error("Supabase URL or public key is not configured (.env.local)");
    const response = await fetch(`${url}/rest/v1/species_field_guide?species_profile_id=eq.${speciesProfileId}&select=${ARK_FIELD_GUIDE_COLUMNS.join(",")}&limit=1`, {
        method: "GET",
        headers: getSupabaseHeaders(key, {Accept: "application/json"}),
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`Reading the field guide failed (${response.status})`);
    const [row] = await response.json() as ArkFieldGuide[];
    return row ?? null;
}
