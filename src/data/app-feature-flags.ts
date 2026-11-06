import "server-only";
import {createSupabasePublicClient, createSupabaseServiceClient} from "@/lib/supabase/server";
import {isSeoSsgRemoteForbidden} from "@/lib/seo-ssg-remote-guard";
import {decodeAppFeatureFlags, devAllFlagsOn, withDevOverride, type AppFeatureFlags} from "@/lib/app-feature-flags";

/**
 * `app_feature_flags_v1()`, read on the server (lib/app-feature-flags): kept
 * in this server's memory for a minute, so a page that reads it costs a
 * round trip at most once a minute. A failed read keeps the last answer, or
 * is every switch off; never read during the static build.
 */

const TTL_MS = 60_000;
const TIMEOUT_MS = 1500;

let cached: {at: number; flags: AppFeatureFlags} | null = null;
let inFlight: Promise<AppFeatureFlags> | null = null;

async function readFlags(): Promise<AppFeatureFlags> {
    const client = createSupabasePublicClient() ?? createSupabaseServiceClient();
    if (!client) return cached?.flags ?? {};
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
    try {
        const result = await Promise.race([client.rpc("app_feature_flags_v1"), timeout]);
        if (!result || result.error) {
            if (result?.error) console.warn("[feature-flags] app_feature_flags_v1 failed", result.error.message.slice(0, 200));
            return cached?.flags ?? {};
        }
        const flags = decodeAppFeatureFlags(result.data);
        cached = {at: Date.now(), flags};
        return flags;
    } catch (error) {
        console.warn("[feature-flags] app_feature_flags_v1 failed", error instanceof Error ? error.message.slice(0, 200) : String(error));
        return cached?.flags ?? {};
    }
}

export async function loadAppFeatureFlags(): Promise<AppFeatureFlags> {
    const allOn = devAllFlagsOn(process.env);
    if (isSeoSsgRemoteForbidden()) return withDevOverride({}, allOn);
    if (cached && Date.now() - cached.at < TTL_MS) return withDevOverride(cached.flags, allOn);
    inFlight ??= readFlags().finally(() => {
        inFlight = null;
    });
    return withDevOverride(await inFlight, allOn);
}
