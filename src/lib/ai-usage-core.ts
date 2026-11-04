// What the site's own AI calls cost, logged and priced (pure; the fetch
// interceptor is src/lib/ai-usage.ts, the admin page /admin/ai-spend).
//
// The apps' edge functions already write one row per paid call to
// public.ai_usage_events (AnimalDex supabase/functions/_shared/ai-usage.ts).
// The web server writes to the same table, with the feature prefixed
// "web:<source>:" so the page can tell the apps, the production server and
// local runs (dev server, scripts, tests) apart.

export type AiProvider = "anthropic" | "openai" | "gemini" | "elevenlabs" | "google_tts";
export type AiSource = "app" | "prod" | "local";

export type ParsedUsage = {
    provider: AiProvider;
    model: string;
    inputTokens: number | null;
    cachedInputTokens: number | null;
    cacheWriteTokens: number | null;
    outputTokens: number | null;
    reasoningTokens: number | null;
    imageCount: number;
    /** Characters for the voice providers, which bill by text length. */
    characters: number | null;
};

const HOSTS: Array<[RegExp, AiProvider]> = [
    [/(^|\.)api\.anthropic\.com$/, "anthropic"],
    [/(^|\.)api\.openai\.com$/, "openai"],
    [/(^|\.)generativelanguage\.googleapis\.com$/, "gemini"],
    [/(^|\.)api\.elevenlabs\.io$/, "elevenlabs"],
    [/(^|\.)texttospeech\.googleapis\.com$/, "google_tts"]
];

/** The provider a request goes to, or null for anything that is not a paid AI call. */
export function aiProviderForUrl(url: string): AiProvider | null {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    const match = HOSTS.find(([host]) => host.test(parsed.hostname));
    if (!match) return null;
    // The admin usage/cost reports and model listings are free reads.
    if (match[1] === "anthropic" && !parsed.pathname.startsWith("/v1/messages")) return null;
    if (match[1] === "anthropic" && parsed.pathname.includes("/count_tokens")) return null;
    if (match[1] === "anthropic" && parsed.pathname.includes("/batches")) return null;
    if (match[1] === "openai" && /^\/v1\/(organization|models|files)/.test(parsed.pathname)) return null;
    if (match[1] === "gemini" && !/:(generateContent|streamGenerateContent|predict|embedContent)/.test(parsed.pathname)) return null;
    if (match[1] === "elevenlabs" && !parsed.pathname.startsWith("/v1/text-to-speech")) return null;
    if (match[1] === "google_tts" && !parsed.pathname.includes("text:synthesize")) return null;
    return match[1];
}

function int(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : null;
}

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function emptyUsage(provider: AiProvider, model: string): ParsedUsage {
    return {provider, model, inputTokens: null, cachedInputTokens: null, cacheWriteTokens: null, outputTokens: null, reasoningTokens: null, imageCount: 0, characters: null};
}

/** The model a request names: the JSON body's `model`, or Gemini's URL path. */
export function requestModel(provider: AiProvider, url: string, body: unknown): string {
    const json = record(body);
    if (typeof json?.model === "string" && json.model.trim()) return json.model.trim();
    if (provider === "gemini") return decodeURIComponent(url.match(/models\/([^:/?]+)/)?.[1] ?? "") || "unknown";
    if (provider === "elevenlabs" && typeof json?.model_id === "string") return json.model_id;
    if (provider === "google_tts") return String(record(json?.voice)?.name ?? "unknown");
    return "unknown";
}

/** Characters a voice request bills for (ElevenLabs `text`, Google `input.text`/`input.ssml`). */
export function requestCharacters(provider: AiProvider, body: unknown): number | null {
    const json = record(body);
    if (provider === "elevenlabs") return typeof json?.text === "string" ? json.text.length : null;
    if (provider === "google_tts") {
        const input = record(json?.input);
        const text = input?.text ?? input?.ssml;
        return typeof text === "string" ? text.length : null;
    }
    return null;
}

/**
 * Folds one response object (a whole JSON reply, or one server-sent event's
 * data) into the usage so far. Streams repeat or grow their counts, so later
 * values replace earlier ones rather than adding to them.
 */
export function mergeUsage(usage: ParsedUsage, payload: unknown): ParsedUsage {
    const json = record(payload);
    if (!json) return usage;
    const next = {...usage};
    if (usage.provider === "anthropic") {
        // Whole replies and message_start carry the usage on the message;
        // message_delta carries the final output count at the top level.
        const message = record(json.message) ?? (json.type === "message" ? json : null);
        if (message && typeof message.model === "string") next.model = message.model;
        const u = record(message?.usage) ?? record(json.usage);
        if (u) {
            next.inputTokens = int(u.input_tokens) ?? next.inputTokens;
            next.cachedInputTokens = int(u.cache_read_input_tokens) ?? next.cachedInputTokens;
            next.cacheWriteTokens = int(u.cache_creation_input_tokens) ?? next.cacheWriteTokens;
            next.outputTokens = int(u.output_tokens) ?? next.outputTokens;
        }
        return next;
    }
    if (usage.provider === "openai") {
        // Responses API streams end with response.completed { response: { usage } }.
        const body = record(json.response) ?? json;
        if (typeof body.model === "string") next.model = body.model;
        const u = record(body.usage);
        if (u) {
            next.inputTokens = int(u.prompt_tokens ?? u.input_tokens) ?? next.inputTokens;
            next.cachedInputTokens = int(record(u.prompt_tokens_details ?? u.input_tokens_details)?.cached_tokens) ?? next.cachedInputTokens;
            next.outputTokens = int(u.completion_tokens ?? u.output_tokens) ?? next.outputTokens;
            next.reasoningTokens = int(record(u.completion_tokens_details ?? u.output_tokens_details)?.reasoning_tokens) ?? next.reasoningTokens;
        }
        if (Array.isArray(body.data) && body.data.some((item) => record(item)?.b64_json || record(item)?.url)) next.imageCount = body.data.length;
        return next;
    }
    if (usage.provider === "gemini") {
        if (typeof json.modelVersion === "string") next.model = json.modelVersion;
        const u = record(json.usageMetadata);
        if (u) {
            next.inputTokens = int(u.promptTokenCount) ?? next.inputTokens;
            next.cachedInputTokens = int(u.cachedContentTokenCount) ?? next.cachedInputTokens;
            next.outputTokens = int(u.candidatesTokenCount) ?? next.outputTokens;
            next.reasoningTokens = int(u.thoughtsTokenCount) ?? next.reasoningTokens;
        }
        return next;
    }
    return next;
}

/** Usage from a reply body: one JSON document, or a server-sent event stream. */
export function parseUsageFromBody(usage: ParsedUsage, text: string): ParsedUsage {
    const trimmed = text.trim();
    if (!trimmed) return usage;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            const json = JSON.parse(trimmed);
            // Gemini's non-SSE stream is a JSON array of chunks.
            return Array.isArray(json) ? json.reduce(mergeUsage, usage) : mergeUsage(usage, json);
        } catch {
            return usage;
        }
    }
    let result = usage;
    for (const line of trimmed.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
            result = mergeUsage(result, JSON.parse(data));
        } catch {
            // A partial or non-JSON event carries no usage.
        }
    }
    return result;
}

export function newUsage(provider: AiProvider, model: string, characters: number | null = null): ParsedUsage {
    return {...emptyUsage(provider, model), characters};
}

export function hasBillableUsage(usage: ParsedUsage) {
    return Boolean(usage.inputTokens || usage.outputTokens || usage.cachedInputTokens || usage.cacheWriteTokens || usage.imageCount || usage.characters);
}

/**
 * Which part of the site made a call, from the stack of the fetch: a
 * src/lib or src/app file in the dev server and scripts, the compiled route
 * (app/api/ask/stream/route.js) in a production build.
 */
export function featureFromStack(stack: string | undefined): string {
    const lines = (stack ?? "").split("\n").slice(1);
    const own = /ai-usage(-core)?\.[jt]s|node_modules|node:internal|next[\\/]dist/;
    for (const line of lines) {
        if (own.test(line)) continue;
        const source = line.match(/[\\/]src[\\/](lib|app|components)[\\/]([^:()]+?)\.(?:mts|tsx?|jsx?)/);
        if (source) return `${source[1] === "lib" ? "" : `${source[1]}/`}${source[2].replace(/\\/g, "/")}`;
        const script = line.match(/[\\/](scripts[\\/][^:()]+?)\.(?:mts|mjs|tsx?|jsx?)/);
        if (script) return script[1].replace(/\\/g, "/");
    }
    for (const line of lines) {
        const compiled = line.match(/[\\/]server[\\/]app[\\/]([^:()]+?)[\\/](route|page)\.js/);
        if (compiled) return `${compiled[2] === "route" ? "" : "page:"}${compiled[1].replace(/\\/g, "/")}`;
    }
    return "unattributed";
}

const WEB_FEATURE = /^web:(prod|local):(.*)$/;

export function webFeature(source: Exclude<AiSource, "app">, feature: string) {
    return `web:${source}:${feature}`.slice(0, 160);
}

/** Where a logged row came from, and its feature without the source prefix. */
export function splitFeature(feature: string | null | undefined): {source: AiSource; feature: string} {
    const value = feature ?? "unknown";
    const match = value.match(WEB_FEATURE);
    return match ? {source: match[1] as AiSource, feature: match[2]} : {source: "app", feature: value};
}

// ---------------------------------------------------------------------------
// Prices (USD per million tokens; per character for voices). The same list
// prices as AnimalDex migration 20261029161300 (ai_usage_prices), used while
// that migration is not applied: rows then carry no estimated_cost_usd.
// ---------------------------------------------------------------------------

type Price = {input: number; cached: number; cacheWrite?: number; output: number} | {perCharacter: number};

const PRICES: Array<[AiProvider, string, Price]> = [
    ["anthropic", "claude-opus-5-5", {input: 4, cached: 0.2, cacheWrite: 5, output: 20}],
    ["anthropic", "claude-opus", {input: 5, cached: 0.5, cacheWrite: 6.25, output: 25}],
    ["anthropic", "claude-sonnet", {input: 2, cached: 0.2, cacheWrite: 2.5, output: 10}],
    ["anthropic", "claude-haiku-5", {input: 0.1, cached: 0.01, cacheWrite: 0.125, output: 0.5}],
    ["anthropic", "claude-haiku-4", {input: 1, cached: 0.1, cacheWrite: 1.25, output: 5}],
    ["anthropic", "claude-fable", {input: 10, cached: 1, cacheWrite: 12.5, output: 50}],
    ["openai", "gpt-4o-mini", {input: 0.15, cached: 0.075, output: 0.6}],
    ["openai", "gpt-4o", {input: 2.5, cached: 1.25, output: 10}],
    ["openai", "gpt-4.1-mini", {input: 0.4, cached: 0.1, output: 1.6}],
    ["openai", "gpt-4.1", {input: 2, cached: 0.5, output: 8}],
    ["openai", "gpt-5", {input: 1.25, cached: 0.125, output: 10}],
    ["openai", "gpt-5.4-mini", {input: 0.25, cached: 0.025, output: 2}],
    ["openai", "gpt-image", {input: 5, cached: 1.25, output: 40}],
    ["openai", "whisper", {input: 0, cached: 0, output: 0}],
    ["openai", "gpt-4o-mini-transcribe", {input: 1.25, cached: 1.25, output: 5}],
    ["openai", "gpt-4o-mini-tts", {input: 0.6, cached: 0.6, output: 12}],
    ["gemini", "gemini-2.5-flash", {input: 0.3, cached: 0.03, output: 2.5}],
    ["gemini", "gemini-2.5-flash-lite", {input: 0.1, cached: 0.01, output: 0.4}],
    ["gemini", "gemini-2.5-pro", {input: 1.25, cached: 0.125, output: 10}],
    ["gemini", "gemini-3.1-flash-image", {input: 0.5, cached: 0.5, output: 60}],
    ["gemini", "gemini", {input: 0.3, cached: 0.03, output: 2.5}],
    ["elevenlabs", "eleven_flash", {perCharacter: 0.00008}],
    ["elevenlabs", "eleven_turbo", {perCharacter: 0.00008}],
    ["elevenlabs", "", {perCharacter: 0.00016}],
    ["google_tts", "", {perCharacter: 0.00003}]
];

export type UsageRow = {
    id?: number;
    created_at: string;
    provider: string;
    feature: string | null;
    model: string | null;
    input_tokens: number | null;
    cached_input_tokens: number | null;
    cache_creation_input_tokens?: number | null;
    output_tokens: number | null;
    reasoning_tokens: number | null;
    image_count?: number | null;
    usage_units?: number | string | null;
    usage_unit?: string | null;
    estimated_cost_usd?: number | string | null;
};

function priceFor(provider: string, model: string | null): Price | null {
    const name = (model ?? "").toLowerCase();
    let best: [AiProvider, string, Price] | null = null;
    for (const entry of PRICES) {
        if (entry[0] !== provider || !name.startsWith(entry[1])) continue;
        if (!best || entry[1].length > best[1].length) best = entry;
    }
    return best?.[2] ?? null;
}

/**
 * A row's list-price estimate. Token semantics follow the providers: Claude's
 * input excludes cache reads and writes; OpenAI's and Gemini's prompt counts
 * include cached tokens; Gemini bills thinking as output.
 */
export function estimateRowUsd(row: UsageRow): number {
    const stored = row.estimated_cost_usd == null ? NaN : Number(row.estimated_cost_usd);
    if (Number.isFinite(stored)) return stored;
    const price = priceFor(row.provider, row.model);
    if (!price) return 0;
    if ("perCharacter" in price) return Number(row.usage_units ?? 0) * price.perCharacter;
    const input = row.input_tokens ?? 0;
    const cached = row.cached_input_tokens ?? 0;
    const cacheWrite = row.cache_creation_input_tokens ?? 0;
    const output = (row.output_tokens ?? 0) + (row.provider === "gemini" ? row.reasoning_tokens ?? 0 : 0);
    const uncached = row.provider === "anthropic" ? input : Math.max(0, input - cached);
    return (uncached * price.input + cached * price.cached + cacheWrite * (price.cacheWrite ?? price.input) + output * price.output) / 1_000_000;
}

// ---------------------------------------------------------------------------
// What the admin page groups by
// ---------------------------------------------------------------------------

const AREAS: Array<[RegExp, string]> = [
    [/comparison|api\/comparisons/, "Comparisons"],
    [/^capture|analyze_capture|capture_|identity-review|identity_review/, "Capture analysis"],
    [/catalog|enrollment|species_content|ensure-species|system_dynamics|recalibrate|index/, "Catalog & indexing"],
    [/blog|trend-radar|trend_radar/, "Blog & trends"],
    [/social|content-video|story-video|uploaded-videos|hook|carousel|growth/, "Social & video"],
    [/ask|chat|debate|applied_insight|call-|call_|voice|speech|transcribe|narration|tts|kind-verdict/, "Ask & chat"],
    [/fusion|fused|principle/, "Fusions"],
    [/guide|nearby|location/, "Guides & places"],
    [/search/, "Search"],
    [/power|trial|alignment|identity|journal|apex/, "Powers & profile"],
    [/api-status/, "API status checks"]
];

/** A human-sized bucket for a feature name from either the apps or the web. */
export function featureArea(feature: string): string {
    const name = feature.toLowerCase();
    return AREAS.find(([pattern]) => pattern.test(name))?.[1] ?? "Other";
}

export function utcDay(iso: string) {
    return iso.slice(0, 10);
}

export function utcHour(iso: string) {
    return `${iso.slice(0, 13)}:00`;
}

export type FeatureTotal = {source: AiSource; feature: string; area: string; provider: string; model: string; calls: number; inputTokens: number; outputTokens: number; usd: number; lastAt: string};
export type SeriesPoint = {key: string; app: number; prod: number; local: number};

export type LedgerSummary = {
    rows: number;
    totalUsd: number;
    bySource: Record<AiSource, {calls: number; usd: number}>;
    byProvider: Record<string, {calls: number; usd: number}>;
    byArea: Array<{area: string; calls: number; usd: number}>;
    features: FeatureTotal[];
    daily: SeriesPoint[];
    hourly: SeriesPoint[];
    /** Per day and provider, to set against what the provider billed. */
    dailyByProvider: Record<string, Record<string, number>>;
};

function emptyPoint(key: string): SeriesPoint {
    return {key, app: 0, prod: 0, local: 0};
}

/** Keys from start to end inclusive, so a quiet day or hour still shows. */
export function dayKeys(start: Date, end: Date) {
    const keys: string[] = [];
    for (let t = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()); t <= end.getTime(); t += 86_400_000) keys.push(new Date(t).toISOString().slice(0, 10));
    return keys;
}

export function hourKeys(end: Date, hours: number) {
    const top = Math.floor(end.getTime() / 3_600_000) * 3_600_000;
    return Array.from({length: hours}, (_, i) => utcHour(new Date(top - (hours - 1 - i) * 3_600_000).toISOString()));
}

export function summarizeLedger(rows: UsageRow[], range: {start: Date; end: Date; hours?: number}): LedgerSummary {
    const bySource: LedgerSummary["bySource"] = {app: {calls: 0, usd: 0}, prod: {calls: 0, usd: 0}, local: {calls: 0, usd: 0}};
    const byProvider: LedgerSummary["byProvider"] = {};
    const areas = new Map<string, {calls: number; usd: number}>();
    const features = new Map<string, FeatureTotal>();
    const daily = new Map(dayKeys(range.start, range.end).map((key) => [key, emptyPoint(key)]));
    const hourly = new Map(hourKeys(range.end, range.hours ?? 48).map((key) => [key, emptyPoint(key)]));
    const dailyByProvider: LedgerSummary["dailyByProvider"] = {};
    let totalUsd = 0;
    for (const row of rows) {
        const usd = estimateRowUsd(row);
        const {source, feature: rawFeature} = splitFeature(row.feature);
        // Edge functions number their video frames (capture_video_frame_2_gemini).
        const feature = rawFeature.replace(/_\d+_/g, "_N_");
        const area = featureArea(feature);
        totalUsd += usd;
        bySource[source].calls += 1;
        bySource[source].usd += usd;
        const provider = (byProvider[row.provider] ??= {calls: 0, usd: 0});
        provider.calls += 1;
        provider.usd += usd;
        const areaTotal = areas.get(area) ?? {calls: 0, usd: 0};
        areaTotal.calls += 1;
        areaTotal.usd += usd;
        areas.set(area, areaTotal);
        const key = `${source}|${row.provider}|${feature}`;
        const total = features.get(key) ?? {source, feature, area, provider: row.provider, model: row.model ?? "", calls: 0, inputTokens: 0, outputTokens: 0, usd: 0, lastAt: row.created_at};
        total.calls += 1;
        total.inputTokens += (row.input_tokens ?? 0) + (row.cached_input_tokens && row.provider === "anthropic" ? row.cached_input_tokens : 0) + (row.cache_creation_input_tokens ?? 0);
        total.outputTokens += row.output_tokens ?? 0;
        total.usd += usd;
        if (row.created_at > total.lastAt) {
            total.lastAt = row.created_at;
            total.model = row.model ?? total.model;
        }
        features.set(key, total);
        const day = daily.get(utcDay(row.created_at));
        if (day) day[source] += usd;
        const hour = hourly.get(utcHour(row.created_at));
        if (hour) hour[source] += usd;
        const providerDay = (dailyByProvider[utcDay(row.created_at)] ??= {});
        providerDay[row.provider] = (providerDay[row.provider] ?? 0) + usd;
    }
    return {
        rows: rows.length,
        totalUsd,
        bySource,
        byProvider,
        byArea: Array.from(areas, ([area, total]) => ({area, ...total})).sort((a, b) => b.usd - a.usd),
        features: Array.from(features.values()).sort((a, b) => b.usd - a.usd),
        daily: Array.from(daily.values()),
        hourly: Array.from(hourly.values()),
        dailyByProvider
    };
}

/** Anthropic cost_report (group_by description): USD per day, batch and web search split out. */
export function anthropicDailyCost(report: unknown): Record<string, {usd: number; batchUsd: number}> {
    const days: Record<string, {usd: number; batchUsd: number}> = {};
    const buckets = record(report)?.data;
    if (!Array.isArray(buckets)) return days;
    for (const bucket of buckets) {
        const b = record(bucket);
        const day = typeof b?.starting_at === "string" ? utcDay(b.starting_at) : null;
        if (!b || !day || !Array.isArray(b.results)) continue;
        const entry = (days[day] ??= {usd: 0, batchUsd: 0});
        for (const result of b.results) {
            const r = record(result);
            // amount is a decimal string in cents.
            const usd = Number(r?.amount ?? 0) / 100;
            if (!Number.isFinite(usd)) continue;
            entry.usd += usd;
            if (/batch/i.test(String(r?.description ?? "")) || r?.service_tier === "batch") entry.batchUsd += usd;
        }
    }
    return days;
}

/** OpenAI organization/costs: USD per day. */
export function openaiDailyCost(report: unknown): Record<string, number> {
    const days: Record<string, number> = {};
    const buckets = record(report)?.data;
    if (!Array.isArray(buckets)) return days;
    for (const bucket of buckets) {
        const b = record(bucket);
        if (typeof b?.start_time !== "number" || !Array.isArray(b.results)) continue;
        const day = new Date(b.start_time * 1000).toISOString().slice(0, 10);
        for (const result of b.results) days[day] = (days[day] ?? 0) + Number(record(record(result)?.amount)?.value ?? 0);
    }
    return days;
}

/**
 * A feature spending well above its own recent pace: today (UTC, so far)
 * against its daily average over the earlier days of the range.
 */
export function spendSpikes(rows: UsageRow[], now: Date, minUsd = 1, factor = 3) {
    const today = utcDay(now.toISOString());
    const todayByFeature = new Map<string, number>();
    const earlierByFeature = new Map<string, number>();
    const earlierDays = new Set<string>();
    for (const row of rows) {
        const feature = row.feature ?? "unknown";
        const day = utcDay(row.created_at);
        const usd = estimateRowUsd(row);
        if (day === today) todayByFeature.set(feature, (todayByFeature.get(feature) ?? 0) + usd);
        else {
            earlierDays.add(day);
            earlierByFeature.set(feature, (earlierByFeature.get(feature) ?? 0) + usd);
        }
    }
    const span = Math.max(1, earlierDays.size);
    return Array.from(todayByFeature, ([feature, usd]) => ({feature, todayUsd: usd, dailyAverageUsd: (earlierByFeature.get(feature) ?? 0) / span}))
        .filter((spike) => spike.todayUsd >= minUsd && spike.todayUsd >= spike.dailyAverageUsd * factor)
        .sort((a, b) => b.todayUsd - a.todayUsd);
}
