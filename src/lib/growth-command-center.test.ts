import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import {
  aheadBehind,
  buildRecoveryPlan,
  buildCollectorAnalytics,
  collectorDepthBucket,
  calendarWeeksForMonth,
  comparePercent,
  comparableSpendTotal,
  cumulativeTargetByDay,
  dailyPaceTarget,
  dateKeyForDay,
  daysInMonth,
  daysInclusive,
  deriveOrganicTotals,
  deriveShortVideoCount,
  emptyGrowthTargets,
  generateNorthStarTrajectory,
  generatedCaptureTarget,
  generatedAdSpendTarget,
  expectedByDay,
  expectedByCompletedReportingDays,
  expectedByWeekDay,
  formatMoney,
  isCohortMature,
  jakartaDayBounds,
  jakartaMonthBounds,
  manualReportingThroughDay,
  manualStatusForDaily,
  monthDateKeys,
  monthKey,
  growthMonthState,
  parseGrowthMonth,
  monthKeysBetween,
  needsAttention,
  normalizeOrganicEntries,
  previousDateKey,
  rate,
  remainingDaysInMonth,
  requiredPerDay,
  resolveUsersTarget,
  splitMonthlyTargetsByCalendarWeeks,
  statusForMetric,
  sumSpendByCurrency,
  todayKey,
  weekDateRange,
} from "./growth-command-center";

describe("growth command center calendar math", () => {
  it("parses one canonical month and classifies it in Asia/Jakarta", () => {
    const now = new Date("2026-08-31T18:00:00Z");
    assert.equal(parseGrowthMonth(null, now), "2026-09");
    assert.equal(parseGrowthMonth("2026-08", now), "2026-08");
    assert.equal(parseGrowthMonth("2026-13", now), "2026-09");
    assert.equal(parseGrowthMonth("not-a-month", now), "2026-09");
    assert.equal(growthMonthState("2026-08", now), "past");
    assert.equal(growthMonthState("2026-09", now), "current");
    assert.equal(growthMonthState("2026-10", now), "upcoming");
  });

  it("builds exclusive Jakarta calendar-month boundaries", () => {
    assert.deepEqual(jakartaMonthBounds("2026-07"), {
      startIso: "2026-07-01T00:00:00+07:00",
      endExclusiveIso: "2026-08-01T00:00:00+07:00",
    });
    assert.deepEqual(jakartaMonthBounds("2026-08"), {
      startIso: "2026-08-01T00:00:00+07:00",
      endExclusiveIso: "2026-09-01T00:00:00+07:00",
    });
    assert.deepEqual(jakartaMonthBounds("2028-02"), {
      startIso: "2028-02-01T00:00:00+07:00",
      endExclusiveIso: "2028-03-01T00:00:00+07:00",
    });
  });
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
      endIso: "2026-09-03T23:59:59.999+07:00",
    });
  });

  it("builds month dates and weekly ranges", () => {
    assert.equal(monthDateKeys("2026-09").length, 30);
    assert.equal(dateKeyForDay("2026-09", 6), "2026-09-06");
    assert.deepEqual(weekDateRange("2026-09", { startDay: 7, endDay: 13 }), {
      start: "2026-09-07",
      end: "2026-09-13",
    });
    assert.deepEqual(calendarWeeksForMonth("2026-09"), [
      { label: "Week 1", startDay: 1, endDay: 6 },
      { label: "Week 2", startDay: 7, endDay: 13 },
      { label: "Week 3", startDay: 14, endDay: 20 },
      { label: "Week 4", startDay: 21, endDay: 27 },
      { label: "Week 5", startDay: 28, endDay: 30 },
    ]);
  });

  it("calculates cumulative targets and expected-by-today", () => {
    assert.equal(expectedByDay(1500, 12, 30), 600);
    assert.equal(dailyPaceTarget(1500, 30), 50);
    assert.equal(dailyPaceTarget(5000, 30), 167);
    assert.equal(dailyPaceTarget(90, 30), 3);
    assert.equal(expectedByWeekDay(350, 2, 7), 100);
    assert.deepEqual(cumulativeTargetByDay(10, 4), [3, 5, 8, 10]);
    const split = splitMonthlyTargetsByCalendarWeeks("2026-09", {
      ...emptyGrowthTargets,
      users: 1500,
      captures: 5000,
      socialViews: 300000,
      searchClicks: 900,
      activePro: 10,
      adSpend: 150,
      shortVideos: 90,
      seoPages: 8,
    });
    assert.deepEqual(
      split.map((week) => week.targets.users),
      [300, 350, 350, 350, 150],
    );
    assert.deepEqual(
      split.map((week) => week.targets.activePro),
      [2, 4, 7, 9, 10],
    );
    assert.deepEqual(
      split.map((week) => week.targets.shortVideos),
      [18, 21, 21, 21, 9],
    );
  });

  it("calculates previous reporting dates in Asia/Jakarta", () => {
    assert.equal(previousDateKey("2026-08-26"), "2026-08-25");
    assert.equal(previousDateKey("2026-09-01"), "2026-08-31");
    assert.equal(manualReportingThroughDay("2026-09", "2026-09-01"), 0);
    assert.equal(manualReportingThroughDay("2026-09", "2026-09-02"), 1);
    assert.equal(manualReportingThroughDay("2026-08", "2026-09-01"), 31);
    assert.equal(manualReportingThroughDay("2026-10", "2026-09-30"), 0);
  });
});

describe("growth command center pacing", () => {
  it("calculates ahead/behind and required daily users", () => {
    assert.equal(aheadBehind(520, 600), -80);
    assert.equal(requiredPerDay(520, 1500, 12, 30), 55);
    assert.equal(requiredPerDay(539, 799, 26, 31), 52);
    assert.equal(requiredPerDay(1642, 1500, 30, 30), 0);
  });

  it("marks future days and missing targets separately from misses", () => {
    assert.equal(statusForMetric(0, 50, { future: true }), "future");
    assert.equal(statusForMetric(531, 0), "no_target");
    assert.equal(statusForMetric(43, 50), "close");
    assert.equal(statusForMetric(42, 50), "behind");
    assert.equal(statusForMetric(50, 50), "on_target");
  });

  it("paces ad spend as a budget, not a success metric", () => {
    assert.equal(statusForMetric(5, 10, { lowerIsBudget: true }), "on_target");
    assert.equal(statusForMetric(11, 10, { lowerIsBudget: true }), "close");
    assert.equal(statusForMetric(12, 10, { lowerIsBudget: true }), "behind");
  });

  it("formats and aggregates spend only within the same currency", () => {
    assert.equal(formatMoney(313196, "IDR"), "IDR 313,196");
    assert.equal(formatMoney(41.25, "GBP"), "£41.25");
    assert.equal(formatMoney(10, "USD"), "$10.00");
    assert.equal(formatMoney(150, null), "Unknown currency 150");
    const sameCurrency = [
      { platform: "google_ads" as const, amount: 313196, currencyCode: "IDR" },
      { platform: "other" as const, amount: 1000, currencyCode: "IDR" },
    ];
    const mixedCurrency = [
      ...sameCurrency,
      { platform: "tiktok_ads" as const, amount: 5.2, currencyCode: "GBP" },
    ];
    assert.deepEqual(sumSpendByCurrency(mixedCurrency), {
      IDR: 314196,
      GBP: 5.2,
    });
    assert.equal(comparableSpendTotal(sameCurrency, "IDR"), 314196);
    assert.equal(comparableSpendTotal(mixedCurrency, "IDR"), null);
    assert.equal(comparableSpendTotal(sameCurrency, "GBP"), null);
    assert.equal(comparableSpendTotal([], "IDR"), 0);
  });

  it("uses completed reporting days for manual metric pace", () => {
    assert.equal(expectedByCompletedReportingDays(300000, 7, 30), 70000);
    assert.equal(expectedByCompletedReportingDays(900, 7, 30), 210);
  });

  it("separates manual pending, missing, previous-day, and future statuses", () => {
    assert.equal(
      manualStatusForDaily({
        date: "2026-08-26",
        today: "2026-08-26",
        hasEntry: false,
        actual: 0,
        expected: 10000,
      }),
      "pending",
    );
    assert.equal(
      manualStatusForDaily({
        date: "2026-08-25",
        today: "2026-08-26",
        hasEntry: true,
        actual: 9500,
        expected: 10000,
      }),
      "close",
    );
    assert.equal(
      manualStatusForDaily({
        date: "2026-08-24",
        today: "2026-08-26",
        hasEntry: false,
        actual: 0,
        expected: 10000,
      }),
      "missing",
    );
    assert.equal(
      manualStatusForDaily({
        date: "2026-08-27",
        today: "2026-08-26",
        hasEntry: false,
        actual: 0,
        expected: 10000,
      }),
      "future",
    );
    assert.equal(
      manualStatusForDaily({
        date: "2026-08-25",
        today: "2026-08-26",
        hasEntry: true,
        actual: 4.2,
        expected: 5,
        lowerIsBudget: true,
      }),
      "on_target",
    );
  });

  it("calculates rates, comparisons and needs-attention messages", () => {
    assert.equal(rate(64, 100), 64);
    assert.equal(rate(1, 200), 0.5);
    assert.equal(rate(1, 0), null);
    assert.equal(comparePercent(142, 100), 42);
    assert.deepEqual(
      needsAttention([
        { label: "New users", actual: 520, expected: 600, priority: 100 },
        {
          label: "Ad spend",
          actual: 80,
          expected: 50,
          lowerIsBudget: true,
          priority: 90,
        },
        { label: "Social views", actual: 70000, expected: 60000, priority: 80 },
      ]),
      ["New users is 80 behind pace.", "Ad spend is 30 over pace."],
    );
  });

  it("excludes immature cohorts from retention denominators", () => {
    const cutoffTime = new Date("2026-08-26T23:59:59.999+07:00").getTime();
    assert.equal(
      isCohortMature("2026-08-26T08:00:00+07:00", cutoffTime, 24),
      false,
    );
    assert.equal(
      isCohortMature("2026-08-25T08:00:00+07:00", cutoffTime, 24),
      true,
    );
    assert.equal(
      isCohortMature("2026-08-25T08:00:00+07:00", cutoffTime, 48),
      false,
    );
    assert.equal(
      isCohortMature("2026-08-24T08:00:00+07:00", cutoffTime, 48),
      true,
    );
    assert.equal(
      isCohortMature("2026-08-19T08:00:00+07:00", cutoffTime, 192),
      false,
    );
    assert.equal(
      isCohortMature("2026-08-18T08:00:00+07:00", cutoffTime, 192),
      true,
    );
  });
});

describe("recovery engine", () => {
  it("uses full days after today and forecasts from recorded user performance", () => {
    const plan = buildRecoveryPlan({
      actualUsers: 539,
      targetUsers: 799,
      currentDay: 26,
      totalDays: 31,
      dailyUsers: Array.from({ length: 26 }, () => 20),
    });
    assert.equal(plan.remainingUsers, 260);
    assert.equal(plan.remainingDays, 5);
    assert.equal(plan.requiredPerDay, 52);
    assert.equal(plan.projectedMonthEnd, 639);
    assert.equal(plan.targetLikely, false);
  });

  it("never derives users from installs, clicks or views without attribution", () => {
    const plan = buildRecoveryPlan({
      actualUsers: 539,
      targetUsers: 799,
      currentDay: 26,
      totalDays: 31,
      dailyUsers: Array.from({ length: 26 }, () => 20),
      snapshots: [
        {
          source: "google_ads",
          periodStart: "2026-07-27",
          periodEnd: "2026-08-25",
          metric: "spend",
          value: 2155324,
          currency: "IDR",
        },
        {
          source: "google_ads",
          periodStart: "2026-07-27",
          periodEnd: "2026-08-25",
          metric: "installs",
          value: 498,
          currency: null,
        },
        {
          source: "tiktok_organic",
          periodStart: "2026-07-28",
          periodEnd: "2026-08-24",
          metric: "video_views",
          value: 186600,
          currency: null,
        },
      ],
    });
    assert.deepEqual(plan.evidence, []);
    assert.equal(plan.blockers.length, 2);
  });

  it("unlocks CPA and organic rates only for matching attributed cohorts with a minimum sample", () => {
    const period = { periodStart: "2026-08-01", periodEnd: "2026-08-25" };
    const plan = buildRecoveryPlan({
      actualUsers: 100,
      targetUsers: 200,
      currentDay: 25,
      totalDays: 31,
      dailyUsers: Array.from({ length: 25 }, () => 4),
      snapshots: [
        {
          source: "paid_test",
          ...period,
          metric: "registered_users",
          value: 20,
          currency: null,
        },
        {
          source: "paid_test",
          ...period,
          metric: "spend",
          value: 40,
          currency: "GBP",
        },
        {
          source: "paid_test",
          ...period,
          metric: "views",
          value: 10000,
          currency: null,
        },
      ],
    });
    assert.equal(plan.evidence[0]?.cpa, 2);
    assert.equal(plan.evidence[0]?.usersPerThousandViews, 2);
    assert.equal(plan.evidence[0]?.confidence, "medium");
    assert.deepEqual(plan.blockers, []);
  });
});

describe("collector lifecycle analytics", () => {
  const profiles = [
    { id: "a", createdAt: "2026-08-01T08:00:00+07:00" },
    { id: "b", createdAt: "2026-08-02T08:00:00+07:00" },
    { id: "c", createdAt: "2026-08-10T08:00:00+07:00" },
    { id: "immature", createdAt: "2026-08-20T11:30:00+07:00" },
  ];
  const captures = [
    { userId: "a", createdAt: "2026-08-01T09:00:00+07:00", status: "ready" },
    { userId: "a", createdAt: "2026-08-02T10:00:00+07:00", status: "ready" },
    { userId: "a", createdAt: "2026-08-08T09:00:00+07:00", status: "ready" },
    { userId: "b", createdAt: "2026-08-02T09:00:00+07:00", status: "ready" },
    { userId: "b", createdAt: "2026-08-02T12:00:00+07:00", status: "ready" },
    { userId: "c", createdAt: "2026-08-10T09:00:00+07:00", status: "failed" },
    {
      userId: "immature",
      createdAt: "2026-08-20T12:00:00+07:00",
      status: "ready",
    },
  ];
  const result = buildCollectorAnalytics({
    profiles,
    captures,
    periodStart: "2026-08-01T00:00:00+07:00",
    periodEnd: "2026-08-31T23:59:59+07:00",
    observationCutoff: "2026-08-20T12:00:00+07:00",
  });

  it("uses mature signup cohorts and the first qualifying capture for activation", () => {
    assert.deepEqual(result.activation, { users: 2, eligible: 3, rate: 66.7 });
    assert.equal(result.newUsers, 4);
  });

  it("defines repeat and seven-day retained collectors from qualifying captures", () => {
    assert.deepEqual(result.repeat, { users: 2, activated: 2, rate: 100 });
    assert.deepEqual(result.retained7Day, { users: 1, eligible: 2, rate: 50 });
  });

  it("anchors strict D1 and D7 windows to first capture and excludes immature windows", () => {
    assert.deepEqual(result.d1, { users: 1, eligible: 2, rate: 50 });
    assert.deepEqual(result.d7, { users: 1, eligible: 2, rate: 50 });
  });

  it("follows a month-end signup into the next month without leaking that activity into the selected month", () => {
    const monthEnd = buildCollectorAnalytics({
      profiles: [{ id: "edge", createdAt: "2026-08-31T08:00:00+07:00" }],
      captures: [
        {
          userId: "edge",
          createdAt: "2026-08-31T09:00:00+07:00",
          status: "ready",
        },
        {
          userId: "edge",
          createdAt: "2026-09-01T10:00:00+07:00",
          status: "ready",
        },
      ],
      periodStart: "2026-08-01T00:00:00+07:00",
      periodEnd: "2026-08-31T23:59:59.999+07:00",
      observationCutoff: "2026-09-03T12:00:00+07:00",
    });

    assert.deepEqual(monthEnd.activation, { users: 1, eligible: 1, rate: 100 });
    assert.deepEqual(monthEnd.d1, { users: 1, eligible: 1, rate: 100 });
    assert.deepEqual(monthEnd.summary, {
      captures: 1,
      collectors: 1,
      capturesPerCollector: 1,
      medianCaptures: 1,
    });
    assert.equal(
      monthEnd.activity.some((row) => row.date === "2026-09-01"),
      false,
    );
  });

  it("calculates depth, unique collectors, median and daily unique activity", () => {
    assert.deepEqual(result.summary, {
      captures: 6,
      collectors: 3,
      capturesPerCollector: 2,
      medianCaptures: 2,
    });
    assert.equal(result.depth.find((row) => row.label === "1")?.users, 1);
    assert.equal(result.depth.find((row) => row.label === "2–4")?.users, 2);
    assert.deepEqual(
      result.activity.find((row) => row.date === "2026-08-02"),
      { date: "2026-08-02", captures: 3, collectors: 2 },
    );
  });

  it("keeps capture depth bucket boundaries explicit", () => {
    assert.deepEqual([1, 2, 4, 5, 9, 10, 24, 25].map(collectorDepthBucket), [
      "1",
      "2–4",
      "2–4",
      "5–9",
      "5–9",
      "10–24",
      "10–24",
      "25+",
    ]);
  });
});

describe("north star trajectory", () => {
  it("counts remaining days inclusively in Asia/Jakarta", () => {
    assert.equal(daysInclusive("2026-08-26", "2026-12-31"), 128);
    assert.equal(
      remainingDaysInMonth("2026-08", "2026-08-26", "2026-12-31"),
      6,
    );
    assert.equal(
      remainingDaysInMonth("2026-09", "2026-08-26", "2026-12-31"),
      30,
    );
    assert.deepEqual(monthKeysBetween("2026-08", "2026-12"), [
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
  });

  it("adds current-month actuals onto the remaining allocation", () => {
    const linear = generateNorthStarTrajectory({
      goal: {
        targetUsers: 10000,
        targetDate: "2026-12-31",
        growthModel: "linear",
        rampPercent: 20,
      },
      today: "2026-08-26",
      currentUsers: 1195,
      currentMonthActual: 538,
    });
    assert.equal(linear.remainingUsers, 8805);
    assert.equal(linear.remainingDays, 128);
    assert.equal(linear.requiredAverage, 68.8);
    const august = linear.months.find((row) => row.month === "2026-08");
    assert.equal(august?.remainingDays, 6);
    assert.equal(
      august?.generatedTarget,
      538 + (august?.allocatedRemaining ?? 0),
    );
    assert.equal(
      linear.months.reduce((sum, row) => sum + row.allocatedRemaining, 0),
      8805,
    );
  });

  it("ramps later months instead of splitting evenly", () => {
    const ramp = generateNorthStarTrajectory({
      goal: {
        targetUsers: 10000,
        targetDate: "2026-12-31",
        growthModel: "ramp",
        rampPercent: 20,
      },
      today: "2026-09-01",
      currentUsers: 1195,
    });
    const byMonth = Object.fromEntries(
      ramp.months.map((row) => [row.month, row.generatedTarget]),
    );
    assert.ok(byMonth["2026-09"] < byMonth["2026-10"]);
    assert.ok(byMonth["2026-10"] < byMonth["2026-11"]);
    assert.ok(byMonth["2026-11"] < byMonth["2026-12"]);
    assert.equal(
      ramp.months.reduce((sum, row) => sum + row.generatedTarget, 0),
      8805,
    );
    assert.match(ramp.explanation, /\+20% monthly ramp/);
    assert.match(ramp.explanation, /Current users: 1,195/);
  });

  it("uses generated user targets unless a month is explicitly overridden", () => {
    assert.deepEqual(
      resolveUsersTarget({ storedUsers: 0, generatedTarget: 650 }),
      { users: 650, source: "generated" },
    );
    assert.deepEqual(
      resolveUsersTarget({ storedUsers: 1500, generatedTarget: 650 }),
      { users: 1500, source: "override" },
    );
    assert.deepEqual(
      resolveUsersTarget({
        storedUsers: 1500,
        usersOverride: false,
        generatedTarget: 650,
      }),
      { users: 650, source: "generated" },
    );
    assert.deepEqual(
      resolveUsersTarget({
        storedUsers: 900,
        usersOverride: true,
        generatedTarget: 650,
      }),
      { users: 900, source: "override" },
    );
    assert.deepEqual(
      resolveUsersTarget({ storedUsers: 0, generatedTarget: null }),
      { users: 0, source: "none" },
    );
  });

  it("generates capture targets from the launch-plan captures-per-user assumption", () => {
    assert.equal(generatedCaptureTarget(1500), 5000);
    assert.equal(generatedCaptureTarget(0), 0);
  });

  it("generates ad-spend targets in the selected currency's real units", () => {
    assert.equal(generatedAdSpendTarget(1500, "IDR"), 2_400_000);
    assert.equal(generatedAdSpendTarget(1500, "GBP"), 150);
    assert.equal(generatedAdSpendTarget(1500, "USD"), 195);
  });

  it("derives social totals from platform posts and views without inventing zeros", () => {
    const entries = normalizeOrganicEntries([
      { platform: "tiktok", posts: 3, views: 12430 },
      { platform: "instagram", posts: 3, views: 4821 },
      { platform: "youtube", posts: 3, views: 2105 },
      { platform: "facebook", posts: 1, views: 620 },
      { platform: "reddit", posts: 1, views: 8400 },
      { platform: "other", posts: 0, views: 0 },
    ]);
    assert.deepEqual(deriveOrganicTotals(entries), { posts: 11, views: 28376 });
    assert.equal(
      entries.some((entry) => entry.platform === "other"),
      false,
    );
  });

  it("counts one original when the same short is cross-posted", () => {
    const entries = normalizeOrganicEntries([
      { platform: "tiktok", posts: 3, views: 1200 },
      { platform: "instagram", posts: 3, views: 800 },
      { platform: "youtube", posts: 2, views: 500 },
      { platform: "x", posts: 3, views: 200 },
      { platform: "reddit", posts: 6, views: 900 },
    ]);
    assert.equal(deriveShortVideoCount(entries), 3);
  });
});
