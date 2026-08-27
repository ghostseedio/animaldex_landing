import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(
  new URL("../app/admin/metrics/admin-metrics-dashboard.tsx", import.meta.url),
  "utf8",
);
const plan = readFileSync(
  new URL("../app/admin/metrics/growth-plan-panel.tsx", import.meta.url),
  "utf8",
);
const source = `${dashboard}\n${plan}`;

describe("admin metrics dashboard tabs", () => {
  it("defines the four founder-facing tabs", () => {
    assert.match(
      source,
      /type MetricsTab = "plan" \| "acquisition" \| "product" \| "revenue"/,
    );
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

  it("keeps the canonical URL month across tabs and month navigation", () => {
    assert.match(source, /parseGrowthMonth\(searchParams\.get\("month"\)\)/);
    assert.match(source, /params\.set\("month", growthMonth\)/);
    assert.match(
      source,
      /const normalizedMonth = parseGrowthMonth\(nextMonth\)/,
    );
    assert.match(source, /params\.set\("month", normalizedMonth\)/);
    assert.match(source, /shiftMonth\(growthMonth, -1\)/);
    assert.match(source, /shiftMonth\(growthMonth, 1\)/);
    assert.match(source, /selectedMonthState\.toUpperCase\(\)/);
  });

  it("separates Product cohort month from activity month", () => {
    assert.match(source, /Cohort: users acquired in/);
    assert.match(source, /including mature/);
    assert.match(source, /Activity: events occurring inside/);
    assert.match(
      source,
      /Future collector actuals are not represented as zero/,
    );
  });

  it("separates Revenue transaction-period purchasers from signup-cohort conversion", () => {
    assert.match(source, /First-time purchasers/);
    assert.match(source, /first production purchase occurred during/);
    assert.match(source, /Signup-cohort purchasers/);
    assert.match(source, /Signup-cohort payer conversion/);
    assert.match(source, /signup-cohort purchasers \/ new users/);
  });

  it("uses the shared month selector instead of tab-local rolling controls", () => {
    assert.doesNotMatch(source, /function PeriodSelector/);
    assert.match(source, /tab === "acquisition"/);
    assert.match(source, /tab === "product"/);
    assert.match(source, /tab === "revenue"/);
    assert.match(source, /<GrowthCommandCenter/);
  });

  it("centers the growth plan on a North Star instead of optional monthly inventing", () => {
    assert.match(source, /North Star/);
    assert.match(source, /Set a long-term user goal/);
    assert.match(source, /Growth targets —/);
    assert.match(source, /These are targets, not actuals/);
    assert.match(source, /Override this month’s generated user target/);
    assert.match(source, /AUTO-GENERATED/);
    assert.match(source, /Am I doing enough today/);
    assert.match(source, /Required from today/);
    assert.match(source, /original\s+planned\s+pace/);
    assert.match(source, /Generated from long-term growth plan/);
    assert.doesNotMatch(source, /Add optional target/);
    assert.doesNotMatch(source, /Create optional target plan/);
    assert.match(source, /No jobs were planned for this week/);
  });

  it("renders historical acquisition snapshots without mixing supporting evidence into cards", () => {
    assert.match(source, /primaryMarketingSnapshots/);
    assert.match(source, /supportingSnapshots/);
    assert.match(source, /TikTok Organic/);
    assert.match(source, /Google Search/);
    assert.match(source, /Google Ads/);
    assert.match(source, /Apple Search Ads/);
    assert.match(source, /IMPORTED/);
    assert.match(source, /DERIVED/);
    assert.match(source, /Supporting evidence excluded from totals/);
    assert.match(source, /registered AnimalDex profiles/);
    assert.match(source, /reported installs/);
    assert.match(source, /Reported Android CPI/);
    assert.match(source, /account spend/);
    assert.match(source, /Update today feeds this month/);
    assert.doesNotMatch(source, /2,155,324 \/ 498/);
  });

  it("does not show prominent manual zero KPIs when no daily entries exist", () => {
    assert.match(source, /manualDailyEntryCount/);
    assert.match(
      source,
      /No daily marketing entries were recorded for this\s+month/,
    );
    assert.match(source, /Historical platform results are shown\s+below/);
    assert.match(source, /not\s+combined without FX conversion/);
    assert.match(source, /Daily\/manual tracking/);
  });

  it("shows collector lifecycle percentages with explicit mature denominators", () => {
    assert.match(source, /Collector funnel/);
    assert.match(source, /Repeat collectors/);
    assert.match(source, /7-day retained/);
    assert.match(source, /Not enough mature users yet/);
    assert.match(
      source,
      /mature activated collectors captured again 24–48h later/,
    );
    assert.match(
      source,
      /mature activated collectors captured again during days 6–8/,
    );
    assert.match(
      source,
      /\$\{Math\.round\(growth\.collectorAnalytics\.activation\.rate\)\}%/,
    );
  });

  it("makes Update today the canonical manual source", () => {
    assert.match(source, /Manual boundary/);
    assert.match(source, /Update today is the canonical source/);
    assert.match(
      source,
      /platform posts\/views · Google clicks · Ad spend · Shorts · SEO/,
    );
    assert.match(
      source,
      /Users, captures, Active Pro, retention and production purchases are\s+AUTO/,
    );
    assert.match(source, /required\/day are DERIVED/);
    assert.match(source, /Missing manual data\s+is never scored as zero/);
    assert.match(source, /organicPosts/);
    assert.match(source, /organicViews/);
    assert.match(source, /name="socialViews"/);
    assert.match(source, /combined or unattributed total/);
    assert.match(source, /socialViews: form\.get\("socialViews"\)/);
    assert.doesNotMatch(source, /"paidUsers", "activePro"/);
  });

  it("surfaces required pace separately from original planned pace", () => {
    assert.match(source, /function TodayCard/);
    assert.match(source, /function YesterdayCard/);
    assert.match(source, /dailyPaceTarget/);
    assert.match(source, /requiredPerDay/);
    assert.match(source, /Today ·/);
    assert.match(source, /Update today/);
    assert.match(source, /Yesterday ·/);
    assert.match(source, /Finalized daily results/);
    assert.match(source, /Organic execution/);
    assert.match(source, /Pending/);
    assert.match(source, /MISSING DATA/);
    assert.match(source, /Not entered/);
  });

  it("makes daily and monthly ad spend currency-aware", () => {
    assert.match(source, /formatMoney/);
    assert.match(source, /formatSpendByCurrency/);
    assert.match(source, /formatSpendEntries/);
    assert.match(source, /name="adSpendCurrency"/);
    assert.match(source, /name="spendCurrency"/);
    assert.match(source, /name="spendPlatform"/);
    assert.match(source, /spendFormRows\.map/);
    assert.match(source, /max-h-\[calc\(100dvh-2rem\)\]/);
    assert.match(source, /marketingSaving/);
    assert.match(source, /animate-spin/);
    assert.match(source, /Saving\.\.\./);
    assert.match(source, /form\s*\.getAll\("spendAmount"\)/);
    assert.match(source, /setMarketingError\(""\)/);
    assert.match(source, /Unable to save marketing data/);
    assert.match(source, /await reload\(\);\s*setEditingDate\(null\)/);
    assert.doesNotMatch(source, /setEditingDate\(null\);\s*await reload\(\)/);
    assert.match(source, /Google Ads/);
    assert.match(source, /TikTok Ads/);
    assert.match(source, /Apple Search Ads/);
    assert.match(source, /budget currency not set/);
    assert.doesNotMatch(
      source,
      /format\(growth\?\.actuals\?\.adSpend \?\? 0, true\)/,
    );
  });

  it("opens the existing plan editor from this week's jobs", () => {
    assert.match(source, /This week’s jobs/);
    assert.match(source, /setEditingPlan\(true\)/);
    assert.doesNotMatch(
      source,
      /This week’s jobs[\s\S]{0,220}setCopyingPlan\(true\)/,
    );
  });

  it("shows projections and captures measured social idea performance", () => {
    assert.match(source, /Projected 24h views/);
    assert.match(source, /Published feedback/);
    assert.match(source, /record-social-idea-views/);
    assert.match(source, /Save 24h views/);
  });

  it("compares automatic user and capture velocity as daily rolling averages", () => {
    assert.match(source, /function GrowthVelocityChart/);
    assert.match(source, /User acquisition vs captures/);
    assert.match(source, /Seven-day rolling daily averages/);
    assert.match(source, /rows\.map\(\(row\) => row\.users\)/);
    assert.match(source, /rows\.map\(\(row\) => row\.captures\)/);
    assert.match(source, /captures\/user/);
  });
});
