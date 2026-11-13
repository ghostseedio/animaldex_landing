import {AI_SPEND_MONTHLY_CAP_DEFAULT_USD, AI_SPEND_WARN_RATIO_DEFAULT, estimateRowUsd, monthlyCapStatus, monthStart, type MonthlyCapStatus, type UsageRow} from "@/lib/ai-usage-core";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

// The monthly AI spend cap (16 Nov 2026: $100 a month across every provider
// and surface), read from the apps' ai_spend_alert_config row when migration
// 20261116120000_ai_spend_monthly_cap has added monthly_cap_usd and
// monthly_warn_ratio to it, else from AI_SPEND_MONTHLY_CAP_USD /
// AI_SPEND_WARN_RATIO, else the defaults. Month-to-date is the ledger's own
// estimate (ai_usage_events at list prices, UTC month): the apps' edge
// functions, the web server and local runs together. At 80% the admin sees a
// notice on /admin and /admin/ai-spend; over the cap it turns red. Nothing is
// switched off automatically: the generators keep their own daily budgets.

const TIMEOUT_MS = 20_000;
const CACHE_MS = 10 * 60_000;

export type MonthlyCapConfig = {capUsd: number; warnRatio: number; enabled: boolean; source: "table" | "env" | "default"};

let cache: {at: number; status: MonthlyCapStatus} | null = null;

function rest(path: string) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase service role is not configured");
    return fetch(`${url}/rest/v1/${path}`, {headers: getSupabaseHeaders(key), cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS)});
}

function positive(value: string | undefined, fallback: number) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

/** The env (or default) cap: what applies while the table has no monthly columns. */
export function envMonthlyCapConfig(env: Record<string, string | undefined> = process.env): MonthlyCapConfig {
    const hasEnv = Boolean(env.AI_SPEND_MONTHLY_CAP_USD?.trim());
    const ratio = positive(env.AI_SPEND_WARN_RATIO, AI_SPEND_WARN_RATIO_DEFAULT);
    return {capUsd: positive(env.AI_SPEND_MONTHLY_CAP_USD, AI_SPEND_MONTHLY_CAP_DEFAULT_USD), warnRatio: ratio > 1 ? AI_SPEND_WARN_RATIO_DEFAULT : ratio, enabled: true, source: hasEnv ? "env" : "default"};
}

/** The cap in force: the table's row when it has the monthly columns, else env/defaults. */
export async function loadMonthlyCapConfig(): Promise<MonthlyCapConfig> {
    const fallback = envMonthlyCapConfig();
    try {
        const response = await rest("ai_spend_alert_config?select=monthly_cap_usd,monthly_warn_ratio,enabled&singleton=eq.true&limit=1");
        if (!response.ok) return fallback;
        const [row] = await response.json() as Array<{monthly_cap_usd: number | string | null; monthly_warn_ratio: number | string | null; enabled: boolean}>;
        const cap = Number(row?.monthly_cap_usd);
        if (!row || !Number.isFinite(cap) || cap <= 0) return fallback;
        const ratio = Number(row.monthly_warn_ratio);
        return {capUsd: cap, warnRatio: Number.isFinite(ratio) && ratio > 0 && ratio <= 1 ? ratio : fallback.warnRatio, enabled: row.enabled !== false, source: "table"};
    } catch {
        return fallback;
    }
}

/** Every ledger row of the current UTC month, paged by id; only the columns the estimate needs. */
async function monthRows(now: Date) {
    const since = encodeURIComponent(monthStart(now).toISOString());
    const rows: UsageRow[] = [];
    let after = 0;
    for (let page = 0; page < 200; page += 1) {
        const response = await rest(`ai_usage_events?select=id,created_at,provider,feature,model,input_tokens,cached_input_tokens,output_tokens,reasoning_tokens,estimated_cost_usd&created_at=gte.${since}&id=gt.${after}&order=id.asc&limit=1000`);
        if (!response.ok) {
            // A database without estimated_cost_usd (the apps' migration not applied): ask without it.
            const detail = await response.text().catch(() => "");
            if (response.status === 400 && /estimated_cost_usd|PGRST204|42703/.test(detail)) return monthRowsLegacy(now);
            throw new Error(`ai_usage_events ${response.status}: ${detail.slice(0, 200)}`);
        }
        const batch = await response.json() as UsageRow[];
        rows.push(...batch);
        if (batch.length < 1000) break;
        after = Number(batch[batch.length - 1].id ?? 0);
    }
    return rows;
}

async function monthRowsLegacy(now: Date) {
    const since = encodeURIComponent(monthStart(now).toISOString());
    const rows: UsageRow[] = [];
    let after = 0;
    for (let page = 0; page < 200; page += 1) {
        const response = await rest(`ai_usage_events?select=id,created_at,provider,feature,model,input_tokens,cached_input_tokens,output_tokens,reasoning_tokens&created_at=gte.${since}&id=gt.${after}&order=id.asc&limit=1000`);
        if (!response.ok) throw new Error(`ai_usage_events ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
        const batch = await response.json() as UsageRow[];
        rows.push(...batch);
        if (batch.length < 1000) break;
        after = Number(batch[batch.length - 1].id ?? 0);
    }
    return rows;
}

/** Where the month stands against the cap; cached for ten minutes per process. Never throws: a read failure gives an "unknown" status with the note. */
export async function loadMonthlyCapStatus(now = new Date(), fresh = false): Promise<MonthlyCapStatus> {
    if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.status;
    const config = await loadMonthlyCapConfig();
    let status: MonthlyCapStatus;
    try {
        const rows = await monthRows(now);
        const spent = rows.reduce((total, row) => total + estimateRowUsd(row), 0);
        status = monthlyCapStatus({capUsd: config.capUsd, warnRatio: config.warnRatio, monthToDateUsd: spent, now, enabled: config.enabled, source: config.source, calls: rows.length});
    } catch (error) {
        status = {...monthlyCapStatus({capUsd: config.capUsd, warnRatio: config.warnRatio, monthToDateUsd: 0, now, enabled: config.enabled, source: config.source, calls: 0}), level: "unknown", note: `The ledger could not be read: ${error instanceof Error ? error.message : String(error)}`};
    }
    cache = {at: Date.now(), status};
    return status;
}
