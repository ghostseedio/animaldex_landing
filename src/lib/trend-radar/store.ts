import "server-only";
import type {TopicIdea} from "@/lib/blog-generator/pipeline";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import type {ScoredIdea} from "@/lib/trend-radar/score";

// Service-role REST access to admin_trend_topics
// (supabase/migrations/20261028180000_trend_radar.sql).

export type TrendTopicStatus = "new" | "writing" | "used" | "skipped" | "expired";

export type TrendTopicRow = {
    id: string;
    kind: "news" | "evergreen";
    title: string;
    primary_keyword: string;
    idea: TopicIdea;
    score: number;
    signals: {origins?: string[]} | null;
    status: TrendTopicStatus;
    used_ref: string | null;
    created_at: string;
    updated_at: string;
};

/** A news idea older than this is no longer news; evergreen ideas keep a month. */
export const NEWS_TTL_MS = 72 * 3_600_000;
export const EVERGREEN_TTL_MS = 30 * 86_400_000;

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
    throw new Error(`${what} failed (${response.status}): ${(await response.text().catch(() => "")).slice(0, 300)}`);
}

export async function listTrendTopics(limit = 100): Promise<TrendTopicRow[]> {
    const response = await expectOk(await rest(`admin_trend_topics?select=*&order=created_at.desc&limit=${limit}`), "Loading trend topics");
    return (await response.json() as TrendTopicRow[]).map((row) => ({...row, score: Number(row.score)}));
}

export async function insertTrendTopics(ideas: ScoredIdea[]) {
    if (!ideas.length) return;
    await expectOk(await rest("admin_trend_topics", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify(ideas.map((entry) => ({
            kind: entry.kind,
            title: entry.idea.title,
            primary_keyword: entry.idea.primaryKeyword,
            idea: entry.idea,
            score: entry.score,
            signals: {origins: entry.signals}
        })))
    }), "Saving trend topics");
}

export async function updateTrendTopic(id: string, patch: {status: TrendTopicStatus; used_ref?: string | null}) {
    await expectOk(await rest(`admin_trend_topics?id=eq.${id}`, {method: "PATCH", prefer: "return=minimal", body: JSON.stringify({...patch, updated_at: new Date().toISOString()})}), "Updating a trend topic");
}

/** Open ideas past their shelf life become "expired"; the rest are returned, best first. */
export async function openTrendTopics(now = Date.now()): Promise<TrendTopicRow[]> {
    const rows = (await listTrendTopics(200)).filter((row) => row.status === "new");
    const stale = rows.filter((row) => now - Date.parse(row.created_at) > (row.kind === "news" ? NEWS_TTL_MS : EVERGREEN_TTL_MS));
    await Promise.all(stale.map((row) => updateTrendTopic(row.id, {status: "expired"}).catch(() => undefined)));
    const staleIds = new Set(stale.map((row) => row.id));
    return rows.filter((row) => !staleIds.has(row.id)).sort((a, b) => b.score - a.score);
}

export async function lastRadarRun(): Promise<string | null> {
    const response = await expectOk(await rest("admin_trend_topics?select=created_at&order=created_at.desc&limit=1"), "Loading the last radar run");
    const [row] = await response.json() as Array<{created_at: string}>;
    return row?.created_at ?? null;
}
