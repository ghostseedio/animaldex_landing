import "server-only";
import {decodeArkHeartsRules, type ArkHeartsRules} from "@/lib/ark-hearts-rules";
import {getSupabaseHeaders, getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";

/**
 * Which hearts rule the server runs (`voyage_hearts_rules_v1`, AnimalDex migration 20270103110000; docs/ark/hearts-escape.md,
 * "Public read"): `{hearts, escape, oldAge}`. Anonymous, with the public key, cached by Next's fetch cache for `revalidate`
 * seconds. Null when it can't be read (the migration not applied, a read that failed): every caller then says a heart as
 * it is said today, so nothing changes until the server says it does.
 */
export async function readArkHeartsRules(revalidate = 60): Promise<ArkHeartsRules | null> {
    const url = getSupabaseUrl();
    const key = getSupabasePublicKey();
    if (!url || !key) return null;
    try {
        const response = await fetch(`${url}/rest/v1/rpc/voyage_hearts_rules_v1`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            body: "{}",
            next: {revalidate, tags: ["ark-hearts-rules"]}
        });
        // (Not there, or failed: null either way; a missing function is the normal case until the migration is applied.)
        if (!response.ok) return null;
        return decodeArkHeartsRules(await response.json().catch(() => null));
    } catch {
        return null;
    }
}
