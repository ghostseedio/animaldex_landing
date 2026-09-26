import "server-only";

import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

/**
 * View totals for editable content, stored one row per (content_type, slug) in
 * `content_page_views` and incremented through `record_content_page_view`.
 *
 * Every read here degrades to "no counts" rather than throwing. The admin
 * content list must keep working on an environment where the migration has not
 * been applied yet — the same tolerance `admin-content` already has for a
 * missing `admin_content_entries`.
 */

export type ContentViewCounts = Map<string, number>;

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    return url && key ? {url, key} : null;
}

/** Increments one item's total and returns it, or null when it could not be recorded. */
export async function recordContentPageView(type: "blog" | "page", slug: string) {
    const settings = config();
    if (!settings) return null;

    try {
        const response = await fetch(`${settings.url}/rest/v1/rpc/record_content_page_view`, {
            method: "POST",
            headers: getSupabaseHeaders(settings.key, {
                "Content-Type": "application/json",
                Accept: "application/json"
            }),
            body: JSON.stringify({p_content_type: type, p_slug: slug}),
            cache: "no-store"
        });

        if (!response.ok) return null;

        const views = Number(await response.json());
        return Number.isFinite(views) ? views : null;
    } catch {
        return null;
    }
}

/** Totals for one content type, keyed by slug. Missing slugs simply have no entry. */
export async function getContentViewCounts(type: "blog" | "page"): Promise<ContentViewCounts> {
    const counts: ContentViewCounts = new Map();
    const settings = config();
    if (!settings) return counts;

    try {
        const params = new URLSearchParams({
            select: "slug,view_count",
            content_type: `eq.${type}`
        });
        const response = await fetch(`${settings.url}/rest/v1/content_page_views?${params}`, {
            headers: getSupabaseHeaders(settings.key, {Accept: "application/json"}),
            cache: "no-store"
        });

        if (!response.ok) return counts;

        for (const row of await response.json() as Array<{slug?: string; view_count?: number}>) {
            if (typeof row.slug === "string") counts.set(row.slug, Number(row.view_count ?? 0));
        }
    } catch {
        // Counts are a decoration on the list; losing them must not empty it.
    }

    return counts;
}
