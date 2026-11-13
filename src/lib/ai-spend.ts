import {anthropicDailyCost, dayKeys, openaiDailyCost, spendSpikes, splitFeature, estimateRowUsd, summarizeLedger, featureArea, type LedgerSummary, type UsageRow} from "@/lib/ai-usage-core";
import {loadMonthlyCapStatus} from "@/lib/ai-spend-cap";
import {comparisonsGenerateEnabled} from "@/lib/comparison-generation-guard";
import type {MonthlyCapStatus} from "@/lib/ai-usage-core";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

// /admin/ai-spend: what the AI providers billed, set against our own call
// ledger (ai_usage_events: the apps' edge functions, the production web
// server, local runs). Billed spend the ledger cannot account for is shown as
// "untracked": Batch jobs, scripts and tools calling the API directly with
// the same key, and calls from before web logging began.

const TIMEOUT_MS = 25_000;
const MAX_ROWS = 120_000;

function rest(path: string) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase service role is not configured");
    return fetch(`${url}/rest/v1/${path}`, {headers: getSupabaseHeaders(key), cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS)});
}

async function restJson<T>(path: string): Promise<T> {
    const response = await rest(path);
    if (!response.ok) throw new Error(`${path.split("?")[0]} ${response.status}: ${(await response.text()).slice(0, 200)}`);
    return await response.json() as T;
}

/** Every ledger row since `start`, paged by id (select=* so a database with or without the newer columns both work). */
async function ledgerRows(start: Date) {
    const rows: UsageRow[] = [];
    let after = 0;
    while (rows.length < MAX_ROWS) {
        const page = await restJson<UsageRow[]>(`ai_usage_events?select=*&created_at=gte.${encodeURIComponent(start.toISOString())}&id=gt.${after}&order=id.asc&limit=1000`);
        rows.push(...page);
        if (page.length < 1000) break;
        after = Number(page[page.length - 1].id ?? 0);
    }
    return rows;
}

async function firstWebLogAt() {
    const rows = await restJson<Array<{created_at: string}>>("ai_usage_events?select=created_at&feature=like.web:*&order=id.asc&limit=1").catch(() => []);
    return rows[0]?.created_at ?? null;
}

async function anthropicBilled(start: Date) {
    const adminKey = process.env.ANTHROPIC_ADMIN_KEY?.trim();
    if (!adminKey) return {days: null, note: "Set ANTHROPIC_ADMIN_KEY (sk-ant-admin…) to compare against what Anthropic billed"};
    const merged: Record<string, {usd: number; batchUsd: number}> = {};
    let page: string | null = null;
    for (let i = 0; i < 6; i++) {
        const params = new URLSearchParams({starting_at: start.toISOString(), bucket_width: "1d", limit: "31"});
        params.append("group_by[]", "description");
        if (page) params.set("page", page);
        const response = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?${params}`, {
            headers: {"x-api-key": adminKey, "anthropic-version": "2023-06-01"},
            cache: "no-store",
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        if (!response.ok) return {days: null, note: `Anthropic cost report failed (${response.status})`};
        const json = await response.json() as {has_more?: boolean; next_page?: string | null};
        for (const [day, cost] of Object.entries(anthropicDailyCost(json))) {
            const entry = (merged[day] ??= {usd: 0, batchUsd: 0});
            entry.usd += cost.usd;
            entry.batchUsd += cost.batchUsd;
        }
        if (!json.has_more || !json.next_page) break;
        page = json.next_page;
    }
    return {days: merged, note: "Anthropic cost report (updates within minutes; today is partial)"};
}

async function openaiBilled(start: Date) {
    const adminKey = process.env.OPENAI_ADMIN_KEY?.trim();
    if (!adminKey) return {days: null, note: "Set OPENAI_ADMIN_KEY to compare against what OpenAI billed"};
    const params = new URLSearchParams({start_time: String(Math.floor(start.getTime() / 1000)), bucket_width: "1d", limit: "31"});
    const response = await fetch(`https://api.openai.com/v1/organization/costs?${params}`, {headers: {Authorization: `Bearer ${adminKey}`}, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS)});
    if (!response.ok) return {days: null, note: `OpenAI costs API failed (${response.status})`};
    return {days: openaiDailyCost(await response.json()), note: "OpenAI costs API"};
}

/** New comparisons per day: the page that bots once walked into paid generations. */
async function comparisonsPerDay(start: Date) {
    const rows = await restJson<Array<{created_at: string}>>(`species_comparisons?select=created_at&created_at=gte.${encodeURIComponent(start.toISOString())}&limit=20000`).catch(() => []);
    const days: Record<string, number> = {};
    for (const row of rows) days[row.created_at.slice(0, 10)] = (days[row.created_at.slice(0, 10)] ?? 0) + 1;
    return days;
}

export type ProviderDay = {day: string; billedUsd: number | null; batchUsd: number; loggedUsd: number; untrackedUsd: number | null};

export type AiSpendReport = {
    generatedAt: string;
    days: number;
    start: string;
    ledger: Omit<LedgerSummary, "hourly">;
    hourly: LedgerSummary["hourly"];
    last24hUsd: number;
    lastHourUsd: number;
    claude: {days: ProviderDay[]; billedUsd: number | null; untrackedUsd: number | null; note: string};
    openai: {days: ProviderDay[]; billedUsd: number | null; note: string};
    gemini: {note: string};
    comparisons: {perDay: Array<{day: string; count: number}>; dailyLimit: number; generationOn: boolean};
    /** The $100-a-month cap (src/lib/ai-spend-cap.ts), with where the month stands. */
    monthCap: MonthlyCapStatus;
    spikes: Array<{feature: string; source: string; area: string; todayUsd: number; dailyAverageUsd: number}>;
    recent: Array<{at: string; source: string; feature: string; provider: string; model: string; inputTokens: number; outputTokens: number; usd: number}>;
    webLoggingSince: string | null;
    edgeCacheWritesLogged: boolean;
    warnings: string[];
};

function providerDays(keys: string[], billed: Record<string, {usd: number; batchUsd: number}> | Record<string, number> | null, logged: LedgerSummary["dailyByProvider"], provider: string): ProviderDay[] {
    return keys.map((day) => {
        const entry = billed?.[day];
        const billedUsd = billed ? (typeof entry === "number" ? entry : entry?.usd ?? 0) : null;
        const batchUsd = typeof entry === "object" && entry ? entry.batchUsd : 0;
        const loggedUsd = logged[day]?.[provider] ?? 0;
        return {day, billedUsd, batchUsd, loggedUsd, untrackedUsd: billedUsd == null ? null : Math.max(0, billedUsd - loggedUsd)};
    });
}

export async function buildAiSpendReport(days: number, now = new Date()): Promise<AiSpendReport> {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
    const hourlyStart = new Date(now.getTime() - 48 * 3_600_000);
    const fetchFrom = start < hourlyStart ? start : hourlyStart;
    const warnings: string[] = [];
    const [rows, claudeBilled, openaiBilledResult, comparisons, webLoggingSince, monthCap] = await Promise.all([
        ledgerRows(fetchFrom),
        anthropicBilled(start).catch((error) => ({days: null, note: `Anthropic cost report failed: ${error instanceof Error ? error.message : String(error)}`})),
        openaiBilled(start).catch((error) => ({days: null, note: `OpenAI costs API failed: ${error instanceof Error ? error.message : String(error)}`})),
        comparisonsPerDay(start),
        firstWebLogAt(),
        loadMonthlyCapStatus(now)
    ]);
    if (rows.length >= MAX_ROWS) warnings.push(`Only the first ${MAX_ROWS.toLocaleString()} calls were read; totals are low.`);
    const startIso = start.toISOString();
    const inRange = rows.filter((row) => row.created_at >= startIso);
    const summary = summarizeLedger(inRange, {start, end: now});
    const {hourly} = summarizeLedger(rows.filter((row) => row.created_at >= hourlyStart.toISOString()), {start: hourlyStart, end: now, hours: 48});
    const keys = dayKeys(start, now);
    const claudeDays = providerDays(keys, claudeBilled.days, summary.dailyByProvider, "anthropic");
    const openaiDays = providerDays(keys, openaiBilledResult.days, summary.dailyByProvider, "openai");
    const sum = (values: Array<number | null>) => values.some((value) => value == null) ? null : values.reduce<number>((total, value) => total + (value ?? 0), 0);
    const cutoff24 = new Date(now.getTime() - 86_400_000).toISOString();
    const cutoff1 = new Date(now.getTime() - 3_600_000).toISOString();
    const recentRows = rows.slice(-60).reverse();
    const {hourly: _unused, ...ledger} = summary;
    void _unused;
    return {
        generatedAt: now.toISOString(),
        days,
        start: startIso,
        ledger,
        hourly,
        last24hUsd: rows.filter((row) => row.created_at >= cutoff24).reduce((total, row) => total + estimateRowUsd(row), 0),
        lastHourUsd: rows.filter((row) => row.created_at >= cutoff1).reduce((total, row) => total + estimateRowUsd(row), 0),
        claude: {days: claudeDays, billedUsd: sum(claudeDays.map((day) => day.billedUsd)), untrackedUsd: sum(claudeDays.map((day) => day.untrackedUsd)), note: claudeBilled.note},
        openai: {days: openaiDays, billedUsd: sum(openaiDays.map((day) => day.billedUsd)), note: openaiBilledResult.note},
        gemini: {note: "Google does not report Gemini spend to an API key: the ledger estimate is the only figure here. The invoice is in Google AI Studio / Cloud Billing."},
        comparisons: {
            perDay: keys.map((day) => ({day, count: comparisons[day] ?? 0})),
            dailyLimit: Number(process.env.COMPARISON_DAILY_GENERATION_LIMIT) || 40,
            generationOn: comparisonsGenerateEnabled()
        },
        monthCap,
        spikes: spendSpikes(inRange, now).map((spike) => {
            const {source, feature} = splitFeature(spike.feature);
            return {...spike, source, feature, area: featureArea(feature)};
        }),
        recent: recentRows.map((row) => {
            const {source, feature} = splitFeature(row.feature);
            return {
                at: row.created_at,
                source,
                feature,
                provider: row.provider,
                model: row.model ?? "",
                inputTokens: (row.input_tokens ?? 0) + (row.cached_input_tokens ?? 0) + (row.cache_creation_input_tokens ?? 0),
                outputTokens: row.output_tokens ?? 0,
                usd: estimateRowUsd(row)
            };
        }),
        webLoggingSince,
        edgeCacheWritesLogged: rows.some((row) => "cache_creation_input_tokens" in row),
        warnings
    };
}
