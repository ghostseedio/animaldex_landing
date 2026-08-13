import "server-only";

import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

/**
 * Web client for the shared `catalog-universal-search` edge function — the same
 * backend the iOS Collection tab searches against, so intent parsing, AI query
 * understanding and ranking stay identical across platforms.
 *
 * The function personalises `captures` from the caller's JWT. Public web
 * visitors are anonymous, so we call it with the service role and that section
 * simply comes back empty.
 */

export type UniversalSearchStatPreset =
    | "fastest" | "slowest" | "rarest" | "strongest" | "smartest"
    | "biggest" | "smallest" | "longestLived" | "shortestLived" | "mostCaptures";

export type UniversalSearchIntent = {
    kind: string;
    raw_query: string;
    normalized_query: string;
    subject: string | null;
    secondary_subject: string | null;
    facet: string | null;
    stat_preset: UniversalSearchStatPreset | null;
    stat_presets?: UniversalSearchStatPreset[];
    wants_near_me: boolean;
    wants_endangered: boolean;
    battle_tier: string | null;
};

export type UniversalSearchBrief = {
    title: string;
    summary: string;
    bullets: string[];
};

export type UniversalSearchSpeciesHit = {
    display_name: string;
    scientific_name: string | null;
    species_profile_id: string | null;
    normalized_identity_key: string | null;
    landing_page_slug: string | null;
    animaldex_number: number | null;
    identity_kind: string | null;
    principle_name: string | null;
    principle_expression: string | null;
    core_lesson: string | null;
    species_subtitle: string | null;
    species_subtitle_story: string | null;
    speed?: number | null;
    rarity?: number | null;
    dominance?: number | null;
    size?: number | null;
    intelligence?: number | null;
    lifespan_estimate?: string | null;
    public_capture_count?: number | null;
    match_reasons?: string[];
};

export type UniversalSearchLocationHit = {
    name: string;
    kind: string;
    notes: string | null;
    best_time_of_day?: string | null;
    best_months?: string | null;
    best_weather?: string | null;
    latitude: number | null;
    longitude: number | null;
    notable_animal_names: string[];
    matched_animal_names: string[];
    approx_distance_label: string | null;
    google_maps_uri?: string | null;
};

export type UniversalSearchComparisonHit = {
    animal_a_name: string;
    animal_b_name: string;
    animal_a_slug: string;
    animal_b_slug: string;
    comparison_type: string;
    quick_verdict: string | null;
    short_answer: string | null;
    article_ready?: boolean;
};

export type UniversalSearchLearnHit = {
    title: string;
    subtitle: string | null;
    display_name: string;
    normalized_identity_key: string | null;
    principle_expression: string | null;
    biological_basis: string | null;
    application_example: string | null;
    short_motto: string | null;
    best_use_cases: string[];
    match_reasons: string[];
};

export type UniversalSearchFactHit = {
    display_name: string;
    scientific_name: string | null;
    typical_habitat: string | null;
    diet_summary: string | null;
    predators_summary: string | null;
    sleep_pattern: string | null;
    lifespan_estimate: string | null;
    where_to_look: string | null;
    interesting_facts: string[];
    signature_traits: string[];
    species_spotlight: string | null;
};

export type UniversalSearchHelpHit = {
    id: string;
    icon: string;
    title: string;
    summary: string;
};

export type UniversalSearchResponse = {
    query: string;
    intent: UniversalSearchIntent | null;
    brief: UniversalSearchBrief | null;
    species: UniversalSearchSpeciesHit[];
    locations: UniversalSearchLocationHit[];
    comparisons: UniversalSearchComparisonHit[];
    learn: UniversalSearchLearnHit[];
    facts: UniversalSearchFactHit[];
    help: UniversalSearchHelpHit[];
    cached: boolean;
    used_ai: boolean;
};

export type UniversalSearchSuggestion = {
    query: string;
    subtitle: string;
};

export type TrendingSearch = {
    query: string;
    searchCount: number;
    isPopular: boolean;
};

const SEARCH_FUNCTION = "catalog-universal-search";
export const SEARCH_QUERY_MAX_LENGTH = 200;

function getConfig() {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceKey();
    if (!supabaseUrl || !serviceKey) return null;
    return {supabaseUrl, serviceKey};
}

export function normalizeSearchQuery(raw: string) {
    return raw.trim().replace(/\s+/g, " ").slice(0, SEARCH_QUERY_MAX_LENGTH);
}

async function callSearchFunction(body: Record<string, unknown>, timeoutMs: number) {
    const config = getConfig();
    if (!config) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${config.supabaseUrl}/functions/v1/${SEARCH_FUNCTION}`, {
            method: "POST",
            headers: {
                ...getSupabaseHeaders(config.serviceKey),
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
            cache: "no-store",
            signal: controller.signal
        });

        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

export async function runUniversalSearch(params: {
    query: string;
    locale?: string;
    latitude?: number | null;
    longitude?: number | null;
}): Promise<UniversalSearchResponse | null> {
    const query = normalizeSearchQuery(params.query);
    if (!query) return null;

    const payload = await callSearchFunction(
        {
            query,
            locale: params.locale ?? "en",
            latitude: params.latitude ?? null,
            longitude: params.longitude ?? null,
            force_refresh: false,
            mode: "search"
        },
        60_000
    );

    if (!payload || typeof payload !== "object") return null;
    const raw = payload as Partial<UniversalSearchResponse>;

    return {
        query: typeof raw.query === "string" ? raw.query : query,
        intent: raw.intent ?? null,
        brief: raw.brief ?? null,
        species: Array.isArray(raw.species) ? raw.species : [],
        locations: Array.isArray(raw.locations) ? raw.locations : [],
        comparisons: Array.isArray(raw.comparisons) ? raw.comparisons : [],
        learn: Array.isArray(raw.learn) ? raw.learn : [],
        facts: Array.isArray(raw.facts) ? raw.facts : [],
        help: Array.isArray(raw.help) ? raw.help : [],
        cached: raw.cached === true,
        used_ai: raw.used_ai === true
    };
}

export async function fetchSearchSuggestions(
    query: string,
    locale = "en"
): Promise<UniversalSearchSuggestion[]> {
    const normalized = normalizeSearchQuery(query);
    if (!normalized) return [];

    const payload = await callSearchFunction(
        {query: normalized, locale, mode: "suggest"},
        12_000
    );

    const suggestions = (payload as {suggestions?: unknown})?.suggestions;
    if (!Array.isArray(suggestions)) return [];

    return suggestions.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const suggestionQuery = String(row.query ?? "").trim();
        if (!suggestionQuery) return [];
        return [{query: suggestionQuery, subtitle: String(row.subtitle ?? "").trim()}];
    });
}

/**
 * Trending mirrors the app's `get_trending_catalog_searches`. The RPC is absent
 * on some environments, so a miss degrades to no trending rail rather than an error.
 */
export async function fetchTrendingSearches(limit = 8): Promise<TrendingSearch[]> {
    const config = getConfig();
    if (!config) return [];

    try {
        const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/get_trending_catalog_searches`, {
            method: "POST",
            headers: {
                ...getSupabaseHeaders(config.serviceKey),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({p_limit: Math.max(1, Math.min(20, limit)), p_days: 30}),
            next: {revalidate: 600}
        });

        if (!response.ok) return [];
        const rows = (await response.json()) as Array<{query?: string; search_count?: number}>;
        if (!Array.isArray(rows)) return [];

        const cleaned = rows
            .map((row) => ({
                query: String(row.query ?? "").trim(),
                searchCount: Math.max(0, Number(row.search_count) || 0)
            }))
            .filter((row) => row.query.length > 0);

        const maxCount = cleaned.reduce((max, row) => Math.max(max, row.searchCount), 0);

        // Same "popular" threshold the app applies.
        return cleaned.map((row) => ({
            ...row,
            isPopular: maxCount >= 3 && row.searchCount >= Math.max(3, Math.floor(maxCount * 0.65))
        }));
    } catch {
        return [];
    }
}

/** Feeds the trending rail. Best-effort: never blocks or fails a search. */
export async function recordCatalogSearch(query: string) {
    const config = getConfig();
    const normalized = normalizeSearchQuery(query);
    if (!config || normalized.length < 2) return;

    try {
        await fetch(`${config.supabaseUrl}/rest/v1/rpc/record_catalog_search`, {
            method: "POST",
            headers: {
                ...getSupabaseHeaders(config.serviceKey),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({p_query: normalized}),
            cache: "no-store"
        });
    } catch {
        // Analytics only.
    }
}
