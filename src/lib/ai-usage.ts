import {aiProviderForUrl, featureFromStack, hasBillableUsage, newUsage, parseUsageFromBody, requestCharacters, requestModel, webFeature, type AiSource, type ParsedUsage} from "@/lib/ai-usage-core";
import {getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

// Logs every paid AI call this server (or a local script) makes into
// public.ai_usage_events, the table the apps' edge functions already write:
// it wraps globalThis.fetch once, so the Anthropic SDK and the raw fetch
// callers are all covered without touching them. The feature is read off the
// call's stack (src/lib/ai-usage-core.ts featureFromStack) and prefixed
// web:prod: or web:local:, so /admin/ai-spend can separate production from
// local runs (dev server, scripts, tests).
//
// Installed by src/instrumentation.ts for the server, and by importing this
// module from the AI clients so tsx scripts are logged too. Never stores
// prompts, replies or keys; never fails or delays the call it watches.
// AI_USAGE_LOG=off turns it off.

type Fetch = typeof fetch;
type GlobalWithUsage = typeof globalThis & {__aiUsageOriginalFetch?: Fetch};

const NEWER_COLUMNS = ["cache_creation_input_tokens", "usage_units", "usage_unit"] as const;
// Set once the database turns out not to have migration 20261029161300's columns.
let legacyShape = false;

export function aiUsageSource(): Exclude<AiSource, "app"> {
    const configured = process.env.AI_USAGE_SOURCE?.trim();
    if (configured === "prod" || configured === "local") return configured;
    // Production runs on the Linux VM; a Mac is a developer's machine.
    return process.platform === "darwin" ? "local" : "prod";
}

function requestUrl(input: Parameters<Fetch>[0]) {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    return (input as Request).url;
}

function requestJson(init: Parameters<Fetch>[1]): unknown {
    if (typeof init?.body !== "string") return null;
    try {
        return JSON.parse(init.body);
    } catch {
        return null;
    }
}

function usageRow(usage: ParsedUsage, feature: string, latencyMs: number, ok: boolean): Record<string, unknown> {
    const voice = usage.provider === "elevenlabs" || usage.provider === "google_tts";
    const total = (usage.inputTokens ?? 0) + (usage.cachedInputTokens ?? 0) + (usage.cacheWriteTokens ?? 0) + (usage.outputTokens ?? 0);
    return {
        provider: usage.provider,
        feature,
        model: usage.model.slice(0, 120) || "unknown",
        input_tokens: voice ? null : usage.inputTokens,
        cached_input_tokens: voice ? null : usage.cachedInputTokens,
        cache_creation_input_tokens: voice ? null : usage.cacheWriteTokens,
        output_tokens: voice ? null : usage.outputTokens,
        reasoning_tokens: voice ? null : usage.reasoningTokens,
        total_tokens: voice ? null : total,
        image_count: usage.imageCount,
        attempt: 1,
        latency_ms: Math.max(0, Math.round(latencyMs)),
        status: ok ? "success" : "error",
        ...(voice ? {usage_units: usage.characters ?? 0, usage_unit: "characters"} : {})
    };
}

/**
 * The row for a database without the newer columns: voice rows wait for the
 * migration, and Claude's cache writes fold into input at their 1.25x rate
 * so the cost estimate stays right (the token count is then input-equivalent).
 */
export function legacyRow(row: Record<string, unknown>): Record<string, unknown> | null {
    if (row.usage_unit) return null;
    const legacy = {...row};
    const cacheWrite = typeof row.cache_creation_input_tokens === "number" ? row.cache_creation_input_tokens : 0;
    if (cacheWrite && typeof legacy.input_tokens === "number") legacy.input_tokens = legacy.input_tokens + Math.round(cacheWrite * 1.25);
    for (const column of NEWER_COLUMNS) delete legacy[column];
    return legacy;
}

async function persist(original: Fetch, row: Record<string, unknown>) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) return;
    const post = (body: Record<string, unknown>) => original(`${url}/rest/v1/ai_usage_events`, {
        method: "POST",
        headers: {apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal"},
        body: JSON.stringify(body),
        cache: "no-store"
    });
    if (!legacyShape) {
        const response = await post(row);
        if (response.ok) return;
        const detail = await response.text().catch(() => "");
        // PGRST204: a column the table does not have yet; 23514: the provider check.
        if (response.status !== 400 || !/PGRST204|column|23514|check constraint/i.test(detail)) {
            console.error(`[ai-usage] logging failed (${response.status}): ${detail.slice(0, 200)}`);
            return;
        }
        legacyShape = true;
    }
    const legacy = legacyRow(row);
    if (!legacy) return;
    const response = await post(legacy);
    if (!response.ok) console.error(`[ai-usage] logging failed (${response.status}): ${(await response.text().catch(() => "")).slice(0, 200)}`);
}

async function observe(original: Fetch, response: Response, usage: ParsedUsage, feature: string, started: number) {
    let parsed = usage;
    const type = response.headers.get("content-type") ?? "";
    // Audio replies carry no usage; the voice providers bill the request's characters.
    if (!/audio|octet-stream/.test(type) && response.body) parsed = parseUsageFromBody(usage, await response.text());
    if (!hasBillableUsage(parsed)) return;
    await persist(original, usageRow(parsed, feature, Date.now() - started, response.ok));
}

/** Wraps globalThis.fetch once per process; later calls are no-ops. */
export function installAiUsageLogging() {
    const scope = globalThis as GlobalWithUsage;
    if (scope.__aiUsageOriginalFetch || typeof scope.fetch !== "function") return;
    if (process.env.AI_USAGE_LOG === "off" || process.env.NODE_TEST_CONTEXT) return;
    const original = scope.fetch.bind(scope);
    scope.__aiUsageOriginalFetch = original;
    const source = aiUsageSource();
    const wrapped: Fetch = async (input, init) => {
        let provider = null;
        try {
            provider = aiProviderForUrl(requestUrl(input));
        } catch {
            // Never let the logger break a request.
        }
        if (!provider) return original(input, init);
        // Read before the first await: the stack names the caller. The SDK
        // and Next's own fetch wrapper add frames, so look deeper than 10.
        const limit = Error.stackTraceLimit;
        Error.stackTraceLimit = 60;
        const stack = new Error().stack;
        Error.stackTraceLimit = limit;
        const feature = webFeature(source, featureFromStack(stack));
        const body = requestJson(init);
        const usage = newUsage(provider, requestModel(provider, requestUrl(input), body), requestCharacters(provider, body));
        const started = Date.now();
        const response = await original(input, init);
        try {
            const copy = response.clone();
            void observe(original, copy, usage, feature, started).catch((error) => console.error("[ai-usage] could not read usage", error));
        } catch (error) {
            console.error("[ai-usage] could not read usage", error);
        }
        return response;
    };
    scope.fetch = wrapped;
}

installAiUsageLogging();
