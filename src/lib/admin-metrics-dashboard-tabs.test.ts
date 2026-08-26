import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = readFileSync(new URL("../app/admin/metrics/admin-metrics-dashboard.tsx", import.meta.url), "utf8");

describe("admin metrics dashboard tabs", () => {
    it("defines the four founder-facing tabs", () => {
        assert.match(source, /type MetricsTab = "plan" \| "acquisition" \| "product" \| "revenue"/);
        assert.match(source, /Growth Plan/);
        assert.match(source, /Acquisition/);
        assert.match(source, /Product/);
        assert.match(source, /Revenue & Users/);
    });

    it("defaults invalid tab params to the growth plan", () => {
        assert.match(source, /requestedTab === "acquisition"/);
        assert.match(source, /requestedTab === "product"/);
        assert.match(source, /requestedTab === "revenue"/);
        assert.match(source, /: "plan"/);
    });

    it("keeps analytics timeframe controls out of the growth plan tab", () => {
        assert.match(source, /function PeriodSelector/);
        assert.match(source, /tab === "acquisition"/);
        assert.match(source, /tab === "product"/);
        assert.match(source, /tab === "revenue"/);
        assert.match(source, /tab === "plan" \? <GrowthCommandCenter/);
    });

    it("does not render fake zero-target progress or fallback historical jobs", () => {
        assert.ok(source.includes("userTarget > 0 ? ` / ${format(userTarget)}` : \"\""));
        assert.match(source, /No target set for/);
        assert.match(source, /No jobs were planned for this week/);
    });
});
