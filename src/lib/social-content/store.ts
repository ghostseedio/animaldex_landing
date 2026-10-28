import "server-only";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import type {SourceType} from "@/lib/content-video/plan";
import type {SocialContentKind, SocialContentRow} from "@/lib/social-content/types";

// Service-role REST access to admin_social_content
// (supabase/migrations/20261028120000_social_growth_engine.sql).

function rest(path: string, init: RequestInit & {prefer?: string} = {}) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase service role is not configured");
    const headers: Record<string, string> = getSupabaseHeaders(key, {"Content-Type": "application/json"});
    if (init.prefer) headers.Prefer = init.prefer;
    return fetch(`${url}/rest/v1/${path}`, {...init, headers, cache: "no-store"});
}

async function expectOk(response: Response, what: string) {
    if (response.ok) return response;
    const text = await response.text().catch(() => "");
    throw new Error(`${what} failed (${response.status}): ${text.slice(0, 300)}`);
}

export async function listSocialContent(kind?: SocialContentKind, limit = 200): Promise<SocialContentRow[]> {
    const filter = kind ? `&kind=eq.${kind}` : "";
    const response = await expectOk(await rest(`admin_social_content?select=*${filter}&order=created_at.desc&limit=${limit}`), "Loading carousels and text posts");
    return await response.json() as SocialContentRow[];
}

export async function getSocialContent(id: string): Promise<SocialContentRow | null> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const response = await expectOk(await rest(`admin_social_content?id=eq.${id}&select=*`), "Loading a carousel or text post");
    const [row] = await response.json() as SocialContentRow[];
    return row ?? null;
}

export type NewSocialContent = Pick<SocialContentRow, "kind" | "source_type" | "source_slug" | "source_title" | "spec" | "share" | "experiment"> & Partial<Pick<SocialContentRow, "id" | "images" | "estimated_usd" | "status" | "error">>;

export async function insertSocialContent(row: NewSocialContent): Promise<SocialContentRow> {
    const response = await expectOk(await rest("admin_social_content", {method: "POST", prefer: "return=representation", body: JSON.stringify(row)}), "Saving a carousel or text post");
    const [created] = await response.json() as SocialContentRow[];
    return created;
}

export async function updateSocialContent(id: string, patch: Partial<Pick<SocialContentRow, "images" | "status" | "error" | "archived_at" | "share">>) {
    await expectOk(await rest(`admin_social_content?id=eq.${id}`, {method: "PATCH", prefer: "return=minimal", body: JSON.stringify({...patch, updated_at: new Date().toISOString()})}), "Updating a carousel or text post");
}

/** Pages that already have a carousel: the generator picks another. */
export async function carouselSourceSlugs(): Promise<Set<string>> {
    const response = await expectOk(await rest("admin_social_content?kind=eq.carousel&select=source_type,source_slug&limit=5000"), "Loading carousel pages");
    return new Set((await response.json() as Array<{source_type: SourceType; source_slug: string}>).map((row) => `${row.source_type}:${row.source_slug}`));
}

/** What the content generation spent today (UTC). */
export async function socialContentSpentToday(): Promise<number> {
    const since = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
    const response = await expectOk(await rest(`admin_social_content?created_at=gte.${since}&select=estimated_usd`), "Loading today's content spend");
    return (await response.json() as Array<{estimated_usd: number | string}>).reduce((sum, row) => sum + Number(row.estimated_usd || 0), 0);
}
