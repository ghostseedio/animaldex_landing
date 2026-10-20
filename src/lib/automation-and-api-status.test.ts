import {test} from "node:test";
import assert from "node:assert/strict";
import {classifyProviderReply, sumAnthropicCostReport, sumOpenAICosts} from "./api-status-core";
import {nextTimerRun} from "./automation-schedule";
import {budgetAllowsVideo, pickRandomSource} from "./content-video/auto-generate-plan";

test("provider replies: credit errors win over the status code", () => {
    assert.equal(classifyProviderReply(200, ""), "ok");
    assert.equal(classifyProviderReply(400, '{"error":{"message":"Your credit balance is too low to access the Anthropic API."}}'), "no_credit");
    assert.equal(classifyProviderReply(429, '{"error":{"code":"insufficient_quota"}}'), "no_credit");
    assert.equal(classifyProviderReply(402, ""), "no_credit");
    assert.equal(classifyProviderReply(401, "invalid x-api-key"), "auth");
    assert.equal(classifyProviderReply(429, "rate limit"), "rate_limited");
    assert.equal(classifyProviderReply(529, "overloaded"), "down");
    assert.equal(classifyProviderReply(404, "model not found"), "ok");
});

test("cost reports: Anthropic is in cents, OpenAI in dollars", () => {
    assert.equal(sumAnthropicCostReport({data: [{results: [{amount: "123.45"}, {amount: "76.55"}]}, {results: []}]}), 2);
    assert.equal(sumOpenAICosts({data: [{results: [{amount: {value: 1.25}}]}, {results: [{amount: {value: "0.75"}}]}]}), 2);
    assert.equal(sumAnthropicCostReport(null), 0);
});

test("random source: only families with pages left, any page of the family", () => {
    const available = {blog: [], comparison: [{slug: "a"}, {slug: "b"}], location: [{slug: "c"}]};
    assert.deepEqual(pickRandomSource(available, () => 0), {type: "comparison", page: {slug: "a"}});
    assert.deepEqual(pickRandomSource(available, () => 0.99), {type: "location", page: {slug: "c"}});
    assert.equal(pickRandomSource({blog: []}), null);
});

test("budget: a run waits unless one more capped video fits", () => {
    assert.ok(budgetAllowsVideo(8.5, 1.5, 10));
    assert.ok(!budgetAllowsVideo(8.6, 1.5, 10));
});

test("next timer run follows the OnCalendar slots and rolls over midnight", () => {
    assert.equal(nextTimerRun("social-auto-share", new Date("2026-10-20T10:00:00Z")).toISOString(), "2026-10-20T10:25:00.000Z");
    assert.equal(nextTimerRun("social-auto-share", new Date("2026-10-20T10:25:00Z")).toISOString(), "2026-10-20T12:25:00.000Z");
    assert.equal(nextTimerRun("video-auto-generate", new Date("2026-10-20T10:00:00Z")).toISOString(), "2026-10-20T10:50:00.000Z");
    assert.equal(nextTimerRun("video-auto-generate", new Date("2026-10-20T22:51:00Z")).toISOString(), "2026-10-21T01:50:00.000Z");
});
