import "server-only";
import {decodeArkFounderPage, decodeArkFounderSettings, type ArkFounderPage, type ArkFounderSettings} from "@/lib/ark-founders";
import {isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient, createSupabaseServerClient} from "@/lib/supabase/server";

/**
 * A founder's page (`voyage_founder_v1(p_handle)`, founders contract section
 * 2): their arrivals on which they are named, newest first, each with its
 * story when shared. Public, read anonymously.
 *
 * null when the server's `founder_names` switch is off, the handle is
 * unknown, the function is not applied yet, or the read failed: the person's
 * Ark page then shows exactly what it did before.
 */
export async function readArkFounder(handle: string): Promise<ArkFounderPage | null> {
    const supabase = createSupabasePublicClient();
    if (!supabase) return null;
    try {
        const {data, error} = await supabase.rpc("voyage_founder_v1", {p_handle: handle, p_voyage: "first"});
        if (error) {
            if (!isMissingArkFunction(error)) console.warn("[ark] voyage_founder_v1 failed", error.message.slice(0, 200));
            return null;
        }
        return decodeArkFounderPage(data);
    } catch {
        return null;
    }
}

/**
 * The signed-in person's "Show my name on my Ark animals"
 * (`voyage_founder_settings_v1()`, founders contract section 3), or null when
 * signed out, before the migration, or when the read fails. The setting is
 * shown only when it answers `enabled: true`.
 */
export async function readArkFounderSettings(): Promise<ArkFounderSettings | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    try {
        const {data, error} = await supabase.rpc("voyage_founder_settings_v1");
        if (error) {
            if (!isMissingArkFunction(error) && !/not_authenticated/.test(error.message ?? "")) console.warn("[ark] voyage_founder_settings_v1 failed", error.message.slice(0, 200));
            return null;
        }
        return decodeArkFounderSettings(data);
    } catch {
        return null;
    }
}
