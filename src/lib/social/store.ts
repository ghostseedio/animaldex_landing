import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {decryptToken, encryptToken} from "@/lib/social/token-crypto";
import type {SocialConnection, SocialPlatform, SocialPostRow, SocialPostStatus} from "@/lib/social/types";

// Service-role REST access to admin_social_connections / admin_social_posts
// (supabase/migrations/20261009180000_admin_social_posts.sql).

function rest(path: string, init: RequestInit & {prefer?: string} = {}) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase service role is not configured");
    const headers: Record<string, string> = getSupabaseHeaders(key, {"Content-Type": "application/json"});
    if (init.prefer) headers.Prefer = init.prefer;
    return fetch(`${url}/rest/v1/${path}`, {...init, headers: {...headers, ...(init.headers as Record<string, string> | undefined)}, cache: "no-store"});
}

async function expectOk(response: Response, what: string) {
    if (response.ok) return response;
    const text = await response.text().catch(() => "");
    throw new Error(`${what} failed (${response.status}): ${text.slice(0, 300)}`);
}

type ConnectionRow = {
    platform: SocialPlatform;
    account_id: string | null;
    account_name: string | null;
    access_token_enc: string;
    refresh_token_enc: string | null;
    expires_at: string | null;
    scopes: string | null;
};

export async function listConnectionRows() {
    const response = await expectOk(await rest("admin_social_connections?select=platform,account_name,expires_at"), "Loading social connections");
    return await response.json() as Array<Pick<ConnectionRow, "platform" | "account_name" | "expires_at">>;
}

export async function getConnection(platform: SocialPlatform): Promise<SocialConnection | null> {
    const response = await expectOk(await rest(`admin_social_connections?platform=eq.${platform}&select=*`), "Loading social connection");
    const [row] = await response.json() as ConnectionRow[];
    if (!row) return null;
    return {
        platform: row.platform,
        accountId: row.account_id,
        accountName: row.account_name,
        accessToken: decryptToken(row.access_token_enc),
        refreshToken: row.refresh_token_enc ? decryptToken(row.refresh_token_enc) : null,
        expiresAt: row.expires_at ? new Date(row.expires_at) : null,
        scopes: row.scopes
    };
}

export async function saveConnection(connection: SocialConnection) {
    await expectOk(await rest("admin_social_connections?on_conflict=platform", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: JSON.stringify({
            platform: connection.platform,
            account_id: connection.accountId,
            account_name: connection.accountName,
            access_token_enc: encryptToken(connection.accessToken),
            refresh_token_enc: connection.refreshToken ? encryptToken(connection.refreshToken) : null,
            expires_at: connection.expiresAt?.toISOString() ?? null,
            scopes: connection.scopes,
            updated_at: new Date().toISOString()
        })
    }), "Saving social connection");
}

export async function deleteConnection(platform: SocialPlatform) {
    await expectOk(await rest(`admin_social_connections?platform=eq.${platform}`, {method: "DELETE"}), "Disconnecting");
}

export async function listPosts(limit = 200) {
    const response = await expectOk(await rest(`admin_social_posts?select=*&order=created_at.desc&limit=${limit}`), "Loading share log");
    return await response.json() as SocialPostRow[];
}

export type NewSocialPost = Pick<SocialPostRow, "platform" | "media_path" | "media_kind" | "species_profile_id" | "species_name" | "page_slug" | "capture_id" | "caption" | "title" | "mode" | "options">;

/** Inserts one queued row; returns null when that video is already live or posted on that platform. */
export async function insertPost(post: NewSocialPost): Promise<SocialPostRow | null> {
    const response = await rest("admin_social_posts", {method: "POST", prefer: "return=representation", body: JSON.stringify(post)});
    if (response.status === 409) return null;
    await expectOk(response, "Queuing share");
    const [row] = await response.json() as SocialPostRow[];
    return row ?? null;
}

export async function updatePost(id: string, patch: Partial<Pick<SocialPostRow, "external_id" | "external_url" | "error">> & {status: SocialPostStatus}) {
    await expectOk(await rest(`admin_social_posts?id=eq.${id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({...patch, updated_at: new Date().toISOString()})
    }), "Updating share");
}
