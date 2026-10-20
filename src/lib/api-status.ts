import {API_PROVIDERS, classifyProviderReply, monthStartUTC, sumAnthropicCostReport, sumOpenAICosts, type ApiHealth, type ApiProvider} from "@/lib/api-status-core";
import {higgsfieldAuthorization, keyframePayload, textToImagePath} from "@/lib/content-video/higgsfield";
import {listContentVideos, spentTodayUSD} from "@/lib/content-video/store";

// /admin/api-status: a one-token probe per AI provider (a fraction of a cent
// each; Higgsfield's is a free price estimate), plus spend where the provider
// reports it: Anthropic and OpenAI through their admin cost APIs when
// ANTHROPIC_ADMIN_KEY / OPENAI_ADMIN_KEY are set, Higgsfield from our own
// clip ledger (admin_content_videos.estimated_usd). Gemini reports neither.

export type ApiStatus = {
    provider: ApiProvider;
    health: ApiHealth;
    message: string | null;
    latencyMs: number | null;
    /** Month-to-date spend in USD, when the provider (or our ledger) can say. */
    monthSpendUSD: number | null;
    spendSource: string | null;
    todaySpendUSD?: number | null;
    dailyBudgetUSD?: number | null;
};

const TIMEOUT_MS = 20_000;

async function probe(request: () => Promise<Response>) {
    const started = Date.now();
    try {
        const response = await request();
        const body = response.ok ? "" : await response.text().catch(() => "");
        return {health: classifyProviderReply(response.status, body), status: response.status, body: body.slice(0, 300), latencyMs: Date.now() - started};
    } catch (error) {
        return {health: "down" as ApiHealth, status: 0, body: error instanceof Error ? error.message : String(error), latencyMs: null};
    }
}

function message(result: {health: ApiHealth; status: number; body: string}) {
    return result.health === "ok" ? null : `HTTP ${result.status || "—"}: ${result.body}`.slice(0, 300);
}

async function claude(now: Date): Promise<ApiStatus> {
    const key = process.env.CLAUDE_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) return {provider: "claude", health: "not_configured", message: "CLAUDE_API_KEY is not set", latencyMs: null, monthSpendUSD: null, spendSource: null};
    const result = await probe(() => fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        body: JSON.stringify({model: process.env.API_STATUS_CLAUDE_MODEL?.trim() || "claude-haiku-5-5", max_tokens: 1, messages: [{role: "user", content: "ping"}]}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store"
    }));
    let monthSpendUSD: number | null = null;
    let spendSource: string | null = "Set ANTHROPIC_ADMIN_KEY (sk-ant-admin…) to show month-to-date spend";
    const adminKey = process.env.ANTHROPIC_ADMIN_KEY?.trim();
    if (adminKey) {
        try {
            const params = new URLSearchParams({starting_at: monthStartUTC(now).toISOString(), bucket_width: "1d", limit: "31"});
            const response = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?${params}`, {
                headers: {"x-api-key": adminKey, "anthropic-version": "2023-06-01"},
                signal: AbortSignal.timeout(TIMEOUT_MS),
                cache: "no-store"
            });
            if (!response.ok) throw new Error(`cost_report ${response.status}`);
            monthSpendUSD = sumAnthropicCostReport(await response.json());
            spendSource = "Anthropic cost report";
        } catch (error) {
            spendSource = `Cost report failed: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    return {provider: "claude", health: result.health, message: message(result), latencyMs: result.latencyMs, monthSpendUSD, spendSource};
}

async function openai(now: Date): Promise<ApiStatus> {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) return {provider: "openai", health: "not_configured", message: "OPENAI_API_KEY is not set", latencyMs: null, monthSpendUSD: null, spendSource: null};
    const result = await probe(() => fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {Authorization: `Bearer ${key}`, "Content-Type": "application/json"},
        body: JSON.stringify({model: process.env.API_STATUS_OPENAI_MODEL?.trim() || "gpt-4o-mini", max_tokens: 1, messages: [{role: "user", content: "ping"}]}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store"
    }));
    let monthSpendUSD: number | null = null;
    let spendSource: string | null = "Set OPENAI_ADMIN_KEY to show month-to-date spend";
    const adminKey = process.env.OPENAI_ADMIN_KEY?.trim();
    if (adminKey) {
        try {
            const params = new URLSearchParams({start_time: String(Math.floor(monthStartUTC(now).getTime() / 1000)), bucket_width: "1d", limit: "31"});
            const response = await fetch(`https://api.openai.com/v1/organization/costs?${params}`, {
                headers: {Authorization: `Bearer ${adminKey}`},
                signal: AbortSignal.timeout(TIMEOUT_MS),
                cache: "no-store"
            });
            if (!response.ok) throw new Error(`organization/costs ${response.status}`);
            monthSpendUSD = sumOpenAICosts(await response.json());
            spendSource = "OpenAI costs API";
        } catch (error) {
            spendSource = `Costs API failed: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    return {provider: "openai", health: result.health, message: message(result), latencyMs: result.latencyMs, monthSpendUSD, spendSource};
}

async function gemini(): Promise<ApiStatus> {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) return {provider: "gemini", health: "not_configured", message: "GEMINI_API_KEY is not set", latencyMs: null, monthSpendUSD: null, spendSource: null};
    const model = process.env.API_STATUS_GEMINI_MODEL?.trim() || "gemini-2.5-flash";
    const result = await probe(() => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: {"x-goog-api-key": key, "Content-Type": "application/json"},
        body: JSON.stringify({contents: [{parts: [{text: "ping"}]}], generationConfig: {maxOutputTokens: 1}}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store"
    }));
    return {provider: "gemini", health: result.health, message: message(result), latencyMs: result.latencyMs, monthSpendUSD: null, spendSource: "Google does not report Gemini spend to an API key; see Google AI Studio / Cloud Billing"};
}

async function higgsfield(now: Date): Promise<ApiStatus> {
    const authorization = higgsfieldAuthorization();
    const dailyBudgetUSD = Number(process.env.CONTENT_VIDEO_DAILY_BUDGET_USD) || 10;
    const [rows, today] = await Promise.all([listContentVideos(200).catch(() => []), spentTodayUSD().catch(() => null)]);
    const monthStart = monthStartUTC(now).toISOString();
    const monthSpendUSD = rows.filter((row) => row.created_at >= monthStart).reduce((sum, row) => sum + row.estimated_usd, 0);
    const ledger = {monthSpendUSD, spendSource: "Our clip ledger (page videos)", todaySpendUSD: today, dailyBudgetUSD};
    if (!authorization) return {provider: "higgsfield", health: "not_configured", message: "HIGGSFIELD_API_KEY is not set", latencyMs: null, ...ledger};
    const result = await probe(() => fetch(`https://api.higgsfield.ai/estimate${textToImagePath()}`, {
        method: "POST",
        headers: {Authorization: authorization, "Content-Type": "application/json"},
        body: JSON.stringify(keyframePayload("A red fox in a meadow")),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store"
    }));
    // The estimate is free and does not touch the balance; a clip that failed for
    // lack of credit in the last three days is the only sign of an empty account.
    const since = new Date(now.getTime() - 3 * 86_400_000).toISOString();
    const creditFailure = rows
        .filter((row) => row.updated_at >= since)
        .flatMap((row) => row.clips.map((clip) => clip.error ?? ""))
        .find((error) => classifyProviderReply(400, error) === "no_credit");
    if (result.health === "ok" && creditFailure) return {provider: "higgsfield", health: "no_credit", message: `A recent clip failed: ${creditFailure.slice(0, 200)}`, latencyMs: result.latencyMs, ...ledger};
    return {provider: "higgsfield", health: result.health, message: message(result), latencyMs: result.latencyMs, ...ledger};
}

export async function checkApiStatuses(now = new Date()): Promise<ApiStatus[]> {
    const checks: Record<ApiProvider, () => Promise<ApiStatus>> = {claude: () => claude(now), openai: () => openai(now), gemini, higgsfield: () => higgsfield(now)};
    return Promise.all(API_PROVIDERS.map((provider) => checks[provider]()));
}
