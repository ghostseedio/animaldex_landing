import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import {
    aheadBehind,
    cumulativeTargetByDay,
    dateKeyForDay,
    daysInMonth,
    expectedByDay,
    jakartaDayBounds,
    monthDateKeys,
    monthKey,
    requiredPerDay,
    statusForMetric,
    todayKey,
    weekDateRange
} from "./growth-command-center";

describe("growth command center calendar math", () => {
    it("calculates normal and leap-year month lengths", () => {
        assert.equal(daysInMonth("2026-09"), 30);
        assert.equal(daysInMonth("2028-02"), 29);
        assert.equal(daysInMonth("2027-02"), 28);
    });

    it("uses Asia/Jakarta for month and day keys", () => {
        assert.equal(monthKey(new Date("2026-08-31T18:00:00.000Z")), "2026-09");
        assert.equal(todayKey(new Date("2026-09-02T18:00:00.000Z")), "2026-09-03");
    });

    it("exposes exact Jakarta day boundaries", () => {
        assert.deepEqual(jakartaDayBounds("2026-09-03"), {
            startIso: "2026-09-03T00:00:00+07:00",
            endIso: "2026-09-03T23:59:59.999+07:00"
        });
    });

    it("builds month dates and weekly ranges", () => {
        assert.equal(monthDateKeys("2026-09").length, 30);
        assert.equal(dateKeyForDay("2026-09", 6), "2026-09-06");
        assert.deepEqual(weekDateRange("2026-09", {startDay: 7, endDay: 13}), {start: "2026-09-07", end: "2026-09-13"});
    });

    it("calculates cumulative targets and expected-by-today", () => {
        assert.equal(expectedByDay(1500, 12, 30), 600);
        assert.deepEqual(cumulativeTargetByDay(10, 4), [3, 5, 8, 10]);
    });
});

describe("growth command center pacing", () => {
    it("calculates ahead/behind and required daily users", () => {
        assert.equal(aheadBehind(520, 600), -80);
        assert.equal(requiredPerDay(520, 1500, 12, 30), 55);
        assert.equal(requiredPerDay(1642, 1500, 30, 30), 0);
    });

    it("marks future days separately from misses", () => {
        assert.equal(statusForMetric(0, 50, {future: true}), "future");
        assert.equal(statusForMetric(43, 50), "close");
        assert.equal(statusForMetric(42, 50), "behind");
        assert.equal(statusForMetric(50, 50), "on_target");
    });

    it("paces ad spend as a budget, not a success metric", () => {
        assert.equal(statusForMetric(5, 10, {lowerIsBudget: true}), "on_target");
        assert.equal(statusForMetric(11, 10, {lowerIsBudget: true}), "close");
        assert.equal(statusForMetric(12, 10, {lowerIsBudget: true}), "behind");
    });
});
