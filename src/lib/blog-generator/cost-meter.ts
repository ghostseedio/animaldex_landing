import {AsyncLocalStorage} from "async_hooks";

// What one generation spends on the Claude API, per stage. Every call site
// records its response's usage into the meter of the run it belongs to
// (AsyncLocalStorage keeps concurrent runs apart without threading a
// parameter through every function).
//
// List prices for claude-opus-5-5, USD per million tokens; web search is per
// request. Update these if the model or prices change.
const RATES = {input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2, webSearch: 10 / 1000};

export type StageUsage = {
    calls: number;
    inputTokens: number;
    cacheWriteTokens: number;
    cacheReadTokens: number;
    outputTokens: number;
    webSearches: number;
    webFetches: number;
    usd: number;
};

export type CostReport = {totalUsd: number; stages: Record<string, StageUsage>};

type UsageLike = {
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
    server_tool_use?: {web_search_requests?: number | null; web_fetch_requests?: number | null} | null;
};

export class CostMeter {
    private stages = new Map<string, StageUsage>();

    record(stage: string, usage: UsageLike | null | undefined) {
        if (!usage) return;
        const entry = this.stages.get(stage) ?? {calls: 0, inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0, webSearches: 0, webFetches: 0, usd: 0};
        const input = usage.input_tokens ?? 0;
        const output = usage.output_tokens ?? 0;
        const cacheWrite = usage.cache_creation_input_tokens ?? 0;
        const cacheRead = usage.cache_read_input_tokens ?? 0;
        const searches = usage.server_tool_use?.web_search_requests ?? 0;
        entry.calls += 1;
        entry.inputTokens += input;
        entry.outputTokens += output;
        entry.cacheWriteTokens += cacheWrite;
        entry.cacheReadTokens += cacheRead;
        entry.webSearches += searches;
        entry.webFetches += usage.server_tool_use?.web_fetch_requests ?? 0;
        entry.usd += (input * RATES.input + output * RATES.output + cacheWrite * RATES.cacheWrite + cacheRead * RATES.cacheRead) / 1_000_000 + searches * RATES.webSearch;
        this.stages.set(stage, entry);
    }

    report(): CostReport {
        const stages = Object.fromEntries(Array.from(this.stages.entries()).map(([stage, usage]) => [stage, {...usage, usd: Math.round(usage.usd * 1000) / 1000}]));
        const totalUsd = Array.from(this.stages.values()).reduce((sum, usage) => sum + usage.usd, 0);
        return {totalUsd: Math.round(totalUsd * 100) / 100, stages};
    }
}

// One store per process even if this module is loaded twice (a tsx script
// importing it as ESM while the library loads it as CommonJS gets two copies).
const store: AsyncLocalStorage<CostMeter> = ((globalThis as typeof globalThis & {__blogGeneratorCostStore?: AsyncLocalStorage<CostMeter>}).__blogGeneratorCostStore ??= new AsyncLocalStorage<CostMeter>());

export function withCostMeter<T>(meter: CostMeter, work: () => Promise<T>) {
    return store.run(meter, work);
}

/** Adds a response's usage to the current run's meter, if there is one. */
export function recordUsage(stage: string, usage: UsageLike | null | undefined) {
    store.getStore()?.record(stage, usage);
}

export function formatCost(report: CostReport) {
    return `$${report.totalUsd.toFixed(2)} (${Object.entries(report.stages).map(([stage, usage]) => `${stage} $${usage.usd.toFixed(2)}`).join(", ")})`;
}
