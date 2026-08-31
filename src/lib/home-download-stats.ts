import "server-only";

import {timeDevAsync} from "@/lib/dev-request-timing";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";
import {devCacheTtlMs, withServerMemoryCache} from "@/lib/server-memory-cache";

const statRevalidateSeconds = 60 * 30;

export type HomeDownloadStatCounts = {
    captures: number | null;
    users: number | null;
    indexes: number | null;
};

function parseContentRangeCount(contentRange: string | null) {
    if (!contentRange) return null;
    const rangeParts = contentRange.split("/");
    const countValue = rangeParts[rangeParts.length - 1];
    if (!countValue || countValue === "*") return null;
    const count = Number.parseInt(countValue, 10);
    return Number.isFinite(count) ? count : null;
}

async function fetchTableCount(table: string, selectColumn: string, filters?: Record<string, string>) {
    const supabaseUrl = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    if (!supabaseUrl || !key) return null;

    const searchParams = new URLSearchParams({select: selectColumn, ...filters});
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${searchParams.toString()}`, {
            headers: getSupabaseHeaders(key, {
                Prefer: "count=exact",
                Range: "0-0",
                "Range-Unit": "items"
            }),
            next: {revalidate: statRevalidateSeconds}
        });
        const ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt;
        if (process.env.NODE_ENV !== "production" && ms >= 250) {
            console.warn(`[adex-perf] ${new Date().toISOString()} QUERY home.stats.${table} ${ms.toFixed(1)}ms`, {
                status: response.status,
                filters: filters ?? {}
            });
        }
        if (!response.ok) return null;
        return parseContentRangeCount(response.headers.get("content-range"));
    } catch {
        return null;
    }
}

async function loadHomeDownloadStatCounts(): Promise<HomeDownloadStatCounts> {
    const [captures, users, indexes] = await Promise.all([
        fetchTableCount("animal_observations", "id", {status: "eq.active"}),
        fetchTableCount("profiles", "id"),
        fetchTableCount("species_profiles", "id", {animaldex_number: "gte.1"})
    ]);

    return {captures, users, indexes};
}

export function getHomeDownloadStatCounts() {
    return timeDevAsync("home.stats", "download-counts", () =>
        withServerMemoryCache(
            "home-download-stat-counts",
            devCacheTtlMs(statRevalidateSeconds * 1000),
            loadHomeDownloadStatCounts
        )
    );
}
