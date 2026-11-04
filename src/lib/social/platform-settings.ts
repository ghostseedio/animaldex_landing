import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {SHARE_CONTENT_KINDS, type ShareContentKind} from "@/lib/social/auto-share-plan";
import {fatalPauseReason, type PlatformPauses, type PlatformSettingRow, resolvePauses} from "@/lib/social/platform-pauses";
import type {SocialPlatform} from "@/lib/social/types";

// Service-role REST access to admin_social_platform_settings
// (supabase/migrations/20261104193000_admin_social_platform_settings.sql): the
// admin's per-platform, per-kind auto-share switches. What a missing row or a
// failed read means lives in platform-pauses.ts.

const TABLE = "admin_social_platform_settings";

export const PLATFORM_SETTINGS_MIGRATION = "20261104193000_admin_social_platform_settings.sql";

function rest(path: string, init: RequestInit & {prefer?: string} = {}) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase service role is not configured");
    const headers: Record<string, string> = getSupabaseHeaders(key, {"Content-Type": "application/json"});
    if (init.prefer) headers.Prefer = init.prefer;
    return fetch(`${url}/rest/v1/${path}`, {...init, headers, cache: "no-store"});
}

/** PostgREST's answer for a table that is not there (the migration is not applied yet). */
function isMissingTable(status: number, body: string) {
    return (status === 404 || status === 400) && (body.includes("PGRST205") || body.includes("42P01")) && body.includes(TABLE);
}

/**
 * The pauses in force now. Before the migration is applied there is no row
 * to read, so the defaults hold; any other failure pauses every platform.
 */
export async function loadPlatformPauses(): Promise<PlatformPauses> {
    try {
        const response = await rest(`${TABLE}?select=platform,kind,paused,reason,updated_at`);
        if (!response.ok) {
            const body = await response.text().catch(() => "");
            if (isMissingTable(response.status, body)) return resolvePauses([], "defaults");
            console.error(`[social-platform-settings] read failed (${response.status}): ${body.slice(0, 200)}`);
            return resolvePauses(null);
        }
        return resolvePauses(await response.json() as PlatformSettingRow[], "saved");
    } catch (error) {
        console.error("[social-platform-settings] read failed", error);
        return resolvePauses(null);
    }
}

/** Saves the admin's choice for one platform and kind (or every kind). */
export async function savePlatformPause(platform: SocialPlatform, kinds: readonly ShareContentKind[], paused: boolean, reason: string | null) {
    const now = new Date().toISOString();
    const response = await rest(`${TABLE}?on_conflict=platform,kind`, {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: JSON.stringify(kinds.map((kind) => ({platform, kind, paused, reason: paused ? reason : null, updated_at: now})))
    });
    if (response.ok) return;
    const body = await response.text().catch(() => "");
    if (isMissingTable(response.status, body)) throw new Error(`The switches can't be saved until the migration ${PLATFORM_SETTINGS_MIGRATION} is applied; until then the defaults hold.`);
    throw new Error(`Saving the platform setting failed (${response.status}): ${body.slice(0, 300)}`);
}

/**
 * After a failed post: an error that will repeat on every post (X's 402
 * "credits depleted") pauses the platform for every kind, so the auto-share
 * stops spending attempts on it until the admin turns it back on.
 */
export async function pauseOnFatalError(platform: SocialPlatform, error: unknown) {
    const reason = fatalPauseReason(platform, error instanceof Error ? error.message : String(error));
    if (!reason) return;
    await savePlatformPause(platform, SHARE_CONTENT_KINDS, true, reason)
        .then(() => console.warn(`[social-platform-settings] paused ${platform}: ${reason}`))
        .catch((saveError) => console.error(`[social-platform-settings] could not pause ${platform}`, saveError));
}
