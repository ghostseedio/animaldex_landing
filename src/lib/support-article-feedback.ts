import "server-only";

import {cookies} from "next/headers";
import {createHash, randomUUID} from "node:crypto";
import {getCurrentUserId} from "@/data/direct-messages";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

const SESSION_COOKIE = "adex_support_article_session";

export type SupportArticleFeedbackStats = {
    articleId: string;
    helpfulCount: number;
    unhelpfulCount: number;
    helpfulnessPercent: number | null;
};

function getWriteConfig() {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getSupabaseServiceKey();
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Supabase write env vars are not configured");
    }
    return {supabaseUrl, serviceRoleKey};
}

function hashSessionKey(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

function buildStats(articleId: string, helpful: number, unhelpful: number): SupportArticleFeedbackStats {
    const total = helpful + unhelpful;
    return {
        articleId,
        helpfulCount: helpful,
        unhelpfulCount: unhelpful,
        helpfulnessPercent: total > 0 ? Math.round((helpful / total) * 100) : null
    };
}

export async function resolveSupportArticleSessionKey() {
    const cookieStore = cookies();
    const existing = cookieStore.get(SESSION_COOKIE)?.value?.trim();
    if (existing) return hashSessionKey(existing);

    const generated = randomUUID();
    cookieStore.set(SESSION_COOKIE, generated, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
        path: "/"
    });

    return hashSessionKey(generated);
}

export async function recordSupportArticleFeedback(options: {
    articleId: string;
    helpful: boolean;
    source?: string;
}) {
    const userId = await getCurrentUserId();
    const sessionKey = userId ? null : await resolveSupportArticleSessionKey();
    const {supabaseUrl, serviceRoleKey} = getWriteConfig();

    const payload = {
        article_id: options.articleId,
        helpful: options.helpful,
        user_id: userId,
        session_key: sessionKey,
        source: options.source ?? "article-page"
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/support_article_feedback`, {
        method: "POST",
        headers: getSupabaseHeaders(serviceRoleKey, {
            Accept: "application/json",
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal"
        }),
        body: JSON.stringify(payload),
        cache: "no-store"
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Support article feedback failed (${response.status}): ${errorText.slice(0, 300)}`);
    }

    const stats = await getSupportArticleFeedbackStatsForArticle(options.articleId);
    return {ok: true as const, stats};
}

export async function listSupportArticleFeedbackStats(articleId?: string): Promise<SupportArticleFeedbackStats[]> {
    const {supabaseUrl, serviceRoleKey} = getWriteConfig();
    const params = new URLSearchParams({select: "article_id,helpful"});

    if (articleId) params.set("article_id", `eq.${articleId}`);

    const response = await fetch(`${supabaseUrl}/rest/v1/support_article_feedback?${params.toString()}`, {
        headers: getSupabaseHeaders(serviceRoleKey, {Accept: "application/json"}),
        cache: "no-store"
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Support article feedback stats failed (${response.status}): ${errorText.slice(0, 300)}`);
    }

    const rows = await response.json() as Array<{article_id?: string; helpful?: boolean}>;
    const grouped = new Map<string, {helpful: number; unhelpful: number}>();

    for (const row of rows) {
        const id = row.article_id?.trim();
        if (!id) continue;
        const bucket = grouped.get(id) ?? {helpful: 0, unhelpful: 0};
        if (row.helpful) bucket.helpful += 1;
        else bucket.unhelpful += 1;
        grouped.set(id, bucket);
    }

    return Array.from(grouped.entries()).map(([id, counts]) => buildStats(id, counts.helpful, counts.unhelpful));
}

export async function getSupportArticleFeedbackStatsForArticle(articleId: string): Promise<SupportArticleFeedbackStats> {
    const empty = buildStats(articleId, 0, 0);

    try {
        const stats = await listSupportArticleFeedbackStats(articleId);
        return stats[0] ?? empty;
    } catch {
        return empty;
    }
}
