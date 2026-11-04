import assert from "node:assert/strict";
import test from "node:test";
import {aiProviderForUrl, estimateRowUsd, featureFromStack, newUsage, parseUsageFromBody, splitFeature, spendSpikes, summarizeLedger, webFeature, anthropicDailyCost} from "./ai-usage-core";
import {legacyRow} from "./ai-usage";

test("only paid AI endpoints are watched", () => {
    assert.equal(aiProviderForUrl("https://api.anthropic.com/v1/messages"), "anthropic");
    assert.equal(aiProviderForUrl("https://api.anthropic.com/v1/organizations/cost_report?x=1"), null);
    assert.equal(aiProviderForUrl("https://api.anthropic.com/v1/messages/count_tokens"), null);
    assert.equal(aiProviderForUrl("https://api.openai.com/v1/chat/completions"), "openai");
    assert.equal(aiProviderForUrl("https://api.openai.com/v1/organization/costs"), null);
    assert.equal(aiProviderForUrl("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse"), "gemini");
    assert.equal(aiProviderForUrl("https://generativelanguage.googleapis.com/v1beta/models"), null);
    assert.equal(aiProviderForUrl("https://wwhsdzpczekgdlobwaej.supabase.co/rest/v1/ai_usage_events"), null);
    assert.equal(aiProviderForUrl("not a url"), null);
});

test("a Claude reply and a Claude stream give the same usage", () => {
    const whole = parseUsageFromBody(newUsage("anthropic", "claude-opus-5-5"), JSON.stringify({type: "message", model: "claude-opus-5-5", usage: {input_tokens: 100, cache_creation_input_tokens: 2000, cache_read_input_tokens: 500, output_tokens: 300}}));
    const stream = parseUsageFromBody(newUsage("anthropic", "unknown"), [
        "event: message_start",
        `data: ${JSON.stringify({type: "message_start", message: {model: "claude-opus-5-5", usage: {input_tokens: 100, cache_creation_input_tokens: 2000, cache_read_input_tokens: 500, output_tokens: 1}}})}`,
        "event: content_block_delta",
        `data: ${JSON.stringify({type: "content_block_delta", delta: {text: "hi"}})}`,
        "event: message_delta",
        `data: ${JSON.stringify({type: "message_delta", usage: {output_tokens: 300}})}`
    ].join("\n"));
    for (const usage of [whole, stream]) {
        assert.equal(usage.model, "claude-opus-5-5");
        assert.equal(usage.inputTokens, 100);
        assert.equal(usage.cacheWriteTokens, 2000);
        assert.equal(usage.cachedInputTokens, 500);
        assert.equal(usage.outputTokens, 300);
    }
});

test("OpenAI and Gemini usage, streamed or whole", () => {
    const chat = parseUsageFromBody(newUsage("openai", "gpt-4o-mini"), JSON.stringify({model: "gpt-4o-mini-2024", usage: {prompt_tokens: 1000, completion_tokens: 50, prompt_tokens_details: {cached_tokens: 200}}}));
    assert.deepEqual([chat.inputTokens, chat.cachedInputTokens, chat.outputTokens], [1000, 200, 50]);
    const responses = parseUsageFromBody(newUsage("openai", "gpt-5"), `data: ${JSON.stringify({type: "response.completed", response: {model: "gpt-5", usage: {input_tokens: 10, output_tokens: 20}}})}\n\ndata: [DONE]`);
    assert.deepEqual([responses.inputTokens, responses.outputTokens], [10, 20]);
    const gemini = parseUsageFromBody(newUsage("gemini", "gemini-2.5-flash"), [
        `data: ${JSON.stringify({usageMetadata: {promptTokenCount: 40, candidatesTokenCount: 5}})}`,
        `data: ${JSON.stringify({modelVersion: "gemini-2.5-flash", usageMetadata: {promptTokenCount: 40, candidatesTokenCount: 90, thoughtsTokenCount: 12}})}`
    ].join("\r\n"));
    assert.deepEqual([gemini.inputTokens, gemini.outputTokens, gemini.reasoningTokens], [40, 90, 12]);
});

test("the feature comes from the calling file, in dev and in a production build", () => {
    const dev = `Error\n    at wrapped (/repo/src/lib/ai-usage.ts:120:20)\n    at Anthropic.makeRequest (/repo/node_modules/@anthropic-ai/sdk/client.js:10:5)\n    at async streamClaude (/repo/src/lib/ask-animaldex/providers.ts:300:9)\n    at async POST (/repo/src/app/api/ask/stream/route.ts:900:3)`;
    assert.equal(featureFromStack(dev), "ask-animaldex/providers");
    const prod = `Error\n    at wrapped (/app/.next/server/chunks/8812.js:1:200)\n    at /app/node_modules/next/dist/server/lib/patch-fetch.js:40:1\n    at async POST (/app/.next/server/app/api/ask/stream/route.js:1:5000)`;
    assert.equal(featureFromStack(prod), "api/ask/stream");
    assert.equal(featureFromStack(`Error\n    at main (/repo/scripts/generate-music-beds.mts:40:2)`), "scripts/generate-music-beds");
    assert.equal(featureFromStack(undefined), "unattributed");
});

test("web rows carry their source; edge-function rows are the apps", () => {
    assert.deepEqual(splitFeature(webFeature("local", "blog-generator/pipeline")), {source: "local", feature: "blog-generator/pipeline"});
    assert.deepEqual(splitFeature(webFeature("prod", "api/ask/stream")), {source: "prod", feature: "api/ask/stream"});
    assert.deepEqual(splitFeature("species_comparison_copy"), {source: "app", feature: "species_comparison_copy"});
});

test("rows are priced like the database's price list", () => {
    const base = {created_at: "2026-11-04T10:00:00Z", feature: "x", reasoning_tokens: null};
    // Claude: input excludes cache reads and writes.
    assert.equal(estimateRowUsd({...base, provider: "anthropic", model: "claude-opus-5-5", input_tokens: 1_000_000, cached_input_tokens: 1_000_000, cache_creation_input_tokens: 1_000_000, output_tokens: 1_000_000}), 4 + 0.2 + 5 + 20);
    // OpenAI: the prompt count includes the cached part.
    assert.equal(estimateRowUsd({...base, provider: "openai", model: "gpt-4o-mini", input_tokens: 1_000_000, cached_input_tokens: 1_000_000, output_tokens: 0}), 0.075);
    // A stored estimate wins.
    assert.equal(estimateRowUsd({...base, provider: "openai", model: "gpt-4o", input_tokens: 5, cached_input_tokens: 0, output_tokens: 5, estimated_cost_usd: "1.5"}), 1.5);
    assert.equal(estimateRowUsd({...base, provider: "gemini", model: "unknown-model", input_tokens: 5, cached_input_tokens: 0, output_tokens: 5}), 0);
});

test("an older database gets Claude cache writes folded into input at the write rate", () => {
    const legacy = legacyRow({provider: "anthropic", input_tokens: 100, cache_creation_input_tokens: 1000, output_tokens: 5});
    assert.deepEqual(legacy, {provider: "anthropic", input_tokens: 1350, output_tokens: 5});
    assert.equal(legacyRow({provider: "elevenlabs", usage_units: 40, usage_unit: "characters"}), null);
});

test("the ledger splits spend by source, area and day; spikes stand out", () => {
    const rows = [
        {created_at: "2026-11-03T09:00:00Z", provider: "anthropic", feature: "species_comparison_copy", model: "claude-opus-5-5", input_tokens: 0, cached_input_tokens: 0, output_tokens: 50_000, reasoning_tokens: null},
        {created_at: "2026-11-04T09:00:00Z", provider: "anthropic", feature: "web:prod:api/ask/stream", model: "claude-opus-5-5", input_tokens: 0, cached_input_tokens: 0, output_tokens: 100_000, reasoning_tokens: null},
        {created_at: "2026-11-04T09:30:00Z", provider: "gemini", feature: "web:local:blog-generator/images", model: "gemini-2.5-flash", input_tokens: 0, cached_input_tokens: 0, output_tokens: 400_000, reasoning_tokens: null}
    ];
    const summary = summarizeLedger(rows, {start: new Date("2026-11-03T00:00:00Z"), end: new Date("2026-11-04T12:00:00Z")});
    assert.equal(summary.bySource.app.usd, 1);
    assert.equal(summary.bySource.prod.usd, 2);
    assert.equal(summary.bySource.local.usd, 1);
    assert.deepEqual(summary.daily.map((day) => day.key), ["2026-11-03", "2026-11-04"]);
    assert.equal(summary.byArea.find((area) => area.area === "Comparisons")?.usd, 1);
    assert.equal(summary.byArea.find((area) => area.area === "Ask & chat")?.usd, 2);
    assert.equal(summary.hourly.length, 48);
    const spikes = spendSpikes(rows, new Date("2026-11-04T12:00:00Z"));
    assert.deepEqual(spikes.map((spike) => spike.feature), ["web:prod:api/ask/stream", "web:local:blog-generator/images"]);
});

test("Anthropic's cost report is read as cents per day, Batch split out", () => {
    const days = anthropicDailyCost({data: [{starting_at: "2026-10-12T00:00:00Z", results: [{amount: "7779", description: "Claude Sonnet 5.5 - Output Tokens - Batch"}, {amount: "289", description: "Claude Opus 5.5 - Output Tokens"}]}]});
    assert.ok(Math.abs(days["2026-10-12"].usd - 80.68) < 1e-9);
    assert.ok(Math.abs(days["2026-10-12"].batchUsd - 77.79) < 1e-9);
});
