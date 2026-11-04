import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
    funnelPath,
    isNonHumanAgent,
    normalizeWebFunnelReport,
    summarizeWebFunnel,
    WEB_FUNNEL_EVENTS,
    type WebFunnelRow
} from "./web-funnel";

const VID = "c0ffee00c0ffee00c0ffee00";

describe("web funnel reports", () => {
    it("are the seven steps of the spec", () => {
        assert.deepEqual([...WEB_FUNNEL_EVENTS], ["hero_view", "demo_start", "demo_reply", "second_message", "share_take", "signup", "store_click"]);
    });

    it("take a known step, a variant and a visitor id; the chip kind only on a start; the path alone", () => {
        assert.deepEqual(normalizeWebFunnelReport({event: "demo_start", variant: "b", vid: VID, chip_kind: "idea", path: "/?utm_source=tiktok#top"}), {
            event: "demo_start",
            variant: "b",
            visitorId: VID,
            chipKind: "idea",
            path: "/"
        });
        assert.equal(normalizeWebFunnelReport({event: "hero_view", variant: "a", vid: VID, chip_kind: "idea"})?.chipKind, null);
        assert.equal(normalizeWebFunnelReport({event: "demo_start", variant: "a", vid: VID, chip_kind: "anything"})?.chipKind, null);
    });

    it("refuse anything else, and a signup, which only the server records", () => {
        for (const body of [
            null,
            "hero_view",
            [],
            {event: "page_view", variant: "a", vid: VID},
            {event: "hero_view", variant: "c", vid: VID},
            {event: "hero_view", variant: "a", vid: "short"},
            {event: "hero_view", variant: "a", vid: `${VID}<script>`},
            {event: "signup", variant: "a", vid: VID}
        ]) {
            assert.equal(normalizeWebFunnelReport(body), null, JSON.stringify(body));
        }
        assert.equal(funnelPath("https://evil.example/x"), null);
        assert.equal(funnelPath("//evil.example"), null);
        assert.equal(funnelPath(`/${"a".repeat(400)}`)?.length, 300);
    });

    it("leave crawlers, previews and headless browsers out", () => {
        assert.ok(isNonHumanAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"));
        assert.ok(isNonHumanAgent("facebookexternalhit/1.1"));
        assert.ok(isNonHumanAgent("Mozilla/5.0 HeadlessChrome/131.0"));
        assert.ok(isNonHumanAgent(""));
        assert.ok(!isNonHumanAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"));
    });
});

describe("the admin's funnel", () => {
    const at = (minute: number) => new Date(Date.UTC(2026, 10, 4, 10, minute)).toISOString();
    const row = (visitor: string, event: string, variant: string, minute: number, chip_kind: string | null = null): WebFunnelRow => ({
        visitor_hash: visitor,
        event,
        variant,
        chip_kind,
        created_at: at(minute)
    });

    it("counts people per step, after the hero they saw, with rates of that variant's viewers", () => {
        const summary = summarizeWebFunnel([
            row("a1", "hero_view", "a", 0),
            row("a1", "hero_view", "a", 5),
            row("a1", "demo_start", "a", 6, "typed"),
            row("a1", "demo_start", "a", 9, "typed"),
            row("a2", "hero_view", "a", 1),
            row("b1", "hero_view", "b", 0),
            row("b1", "demo_start", "b", 1, "idea"),
            row("b1", "demo_reply", "b", 2),
            row("b1", "second_message", "b", 3),
            row("b1", "share_take", "b", 4),
            row("b1", "store_click", "b", 5),
            row("b2", "hero_view", "b", 0),
            row("b2", "demo_start", "b", 1, "problem"),
            row("b2", "demo_reply", "b", 2),
            row("b2", "signup", "b", 9)
        ]);
        const [a, b] = summary.variants;
        assert.equal(a.viewers, 2);
        assert.equal(a.steps.find((step) => step.event === "demo_start")?.visitors, 1, "one person, two starts");
        assert.equal(a.steps.find((step) => step.event === "demo_start")?.rate, 50);
        assert.deepEqual(a.starts, {idea: 0, problem: 0, typed: 1, suggested: 0});
        assert.equal(b.viewers, 2);
        assert.deepEqual(b.steps.map((step) => [step.event, step.visitors]), [
            ["demo_start", 2], ["demo_reply", 2], ["second_message", 1], ["share_take", 1], ["signup", 1], ["store_click", 1]
        ]);
        assert.deepEqual(b.starts, {idea: 1, problem: 1, typed: 0, suggested: 0});
        assert.equal(b.shareOfReplies, 50);
        assert.equal(summary.demoStartLift, 2, "B's start rate (100%) over A's (50%)");
    });

    it("ignores what a visitor did before seeing the hero, and counts them in their first variant only", () => {
        const summary = summarizeWebFunnel([
            row("v", "store_click", "a", 0),
            row("v", "hero_view", "a", 1),
            // A QA override never sends events, but a stray one cannot move them to B.
            row("v", "hero_view", "b", 2),
            row("v", "demo_start", "b", 3, "idea"),
            row("w", "demo_start", "b", 3, "idea")
        ]);
        const [a, b] = summary.variants;
        assert.equal(a.viewers, 1);
        assert.equal(b.viewers, 0);
        assert.equal(a.steps.find((step) => step.event === "store_click")?.visitors, 0);
        assert.equal(a.steps.find((step) => step.event === "demo_start")?.visitors, 1);
        assert.equal(b.steps.find((step) => step.event === "demo_start")?.rate, null);
        assert.equal(summary.demoStartLift, null);
    });

    it("is empty, not broken, with no rows", () => {
        const summary = summarizeWebFunnel([]);
        assert.deepEqual(summary.variants.map((variant) => variant.viewers), [0, 0]);
        assert.equal(summary.demoStartLift, null);
    });
});
