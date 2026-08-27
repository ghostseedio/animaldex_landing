import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

const routeSource = readFileSync(
  join(process.cwd(), "src/app/api/admin/growth/route.ts"),
  "utf8",
);
const metricsRouteSource = readFileSync(
  join(process.cwd(), "src/app/api/admin/metrics/route.ts"),
  "utf8",
);
const migrationSource = [
  readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260826090000_growth_command_center.sql",
    ),
    "utf8",
  ),
  readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260826120000_growth_north_star.sql",
    ),
    "utf8",
  ),
].join("\n");
const seedSource = readFileSync(
  join(
    process.cwd(),
    "supabase/seed_sql/2026_08_growth_marketing_snapshots.sql",
  ),
  "utf8",
);

describe("growth command center route contract", () => {
  it("keeps growth APIs admin-only and service-role backed", () => {
    assert.match(routeSource, /resolveAdminActor/);
    assert.match(routeSource, /status: 401/);
    assert.match(routeSource, /getSupabaseServiceKey/);
    assert.doesNotMatch(routeSource, /NEXT_PUBLIC_/);
  });

  it("pages automatic user and capture reads past PostgREST's 1000-row cap", () => {
    assert.match(routeSource, /limit=1000&offset=\$\{offset\}/);
    assert.match(routeSource, /if \(page\.length < 1000\) break/);
    assert.match(routeSource, /fetchRows<DatedRow>\(\s*"profiles"/);
    assert.match(routeSource, /fetchRows<DatedRow>\(\s*"captures"/);
  });

  it("upserts daily manual marketing values by date", () => {
    assert.match(routeSource, /action === "save-marketing"/);
    assert.match(routeSource, /on_conflict=date/);
    assert.match(routeSource, /social_views/);
    assert.match(routeSource, /search_clicks/);
    assert.match(routeSource, /ad_spend/);
    assert.match(routeSource, /paid_users/);
    assert.match(routeSource, /short_videos/);
    assert.match(routeSource, /seo_pages/);
    assert.match(routeSource, /growth_marketing_daily_spend/);
    assert.match(routeSource, /currency_code/);
    assert.match(routeSource, /on_conflict=date,platform,currency_code/);
    assert.match(routeSource, /deleteSpendRows\(body\.date\)/);
    assert.match(routeSource, /spendEntries/);
    assert.match(routeSource, /updated_by: actor.email \?\? actor.kind/);
    assert.match(routeSource, /organicEntries/);
    assert.match(routeSource, /deleteOrganicRows\(body\.date\)/);
  });

  it("persists a North Star and freezes generated monthly user targets", () => {
    assert.match(routeSource, /action === "save-north-star"/);
    assert.match(routeSource, /growth_north_star/);
    assert.match(routeSource, /generateNorthStarTrajectory/);
    assert.match(routeSource, /resolveUsersTarget/);
    assert.match(routeSource, /growth_marketing_daily_organic/);
    assert.match(routeSource, /usersOverride/);
    assert.match(routeSource, /generatedUsers/);
    assert.match(
      migrationSource,
      /create table if not exists public\.growth_north_star/,
    );
    assert.match(
      migrationSource,
      /create table if not exists public\.growth_marketing_daily_organic/,
    );
  });

  it("keeps mixed-currency spend out of normal budget totals", () => {
    assert.match(routeSource, /function sumSpendRangeByCurrency/);
    assert.match(routeSource, /function comparableMonthlySpend/);
    assert.match(routeSource, /adSpendByCurrency: sumSpendRangeByCurrency/);
    assert.match(
      routeSource,
      /const comparableAdSpend = plan\s*\? comparableMonthlySpend/,
    );
    assert.match(
      routeSource,
      /comparableAdSpend == null\s*\? \[\]\s*: \[\s*\{\s*label: "Ad spend"/,
    );
    assert.doesNotMatch(
      routeSource,
      /\{label: "Ad spend", actual: actualMonth\.actuals\.adSpend/,
    );
  });

  it("keeps growth reads/writes compatible with older daily marketing schemas", () => {
    assert.match(routeSource, /function isMissingColumnError/);
    assert.match(routeSource, /function isMissingTableError/);
    assert.match(routeSource, /PGRST204/);
    assert.match(routeSource, /PGRST205/);
    assert.match(routeSource, /async function loadMarketingRows/);
    assert.match(
      routeSource,
      /select=date,social_views,search_clicks,ad_spend,paid_users,short_videos,seo_pages,notes,updated_at,updated_by/,
    );
    assert.match(
      routeSource,
      /select=date,social_views,search_clicks,ad_spend,paid_users,notes,updated_at,updated_by/,
    );
    assert.match(routeSource, /async function writeMarketingRow/);
    assert.match(routeSource, /async function writeSpendRows/);
    assert.match(
      routeSource,
      /isMissingTableError\(error, "growth_marketing_daily_spend"\)/,
    );
    assert.match(routeSource, /legacyAdSpend/);
    assert.match(routeSource, /legacySpendCurrency/);
    assert.match(routeSource, /legacySpendCurrency = "IDR"/);
    assert.match(
      routeSource,
      /platform: "google_ads", amount, currencyCode: legacySpendCurrency/,
    );
    assert.match(
      routeSource,
      /const \{\s*short_videos: _shortVideos,\s*seo_pages: _seoPages,\s*\.\.\.legacyBody\s*\}/,
    );
    assert.match(
      routeSource,
      /loadMarketingRows\(dates\[0\], dates\[dates\.length - 1\]\)/,
    );
  });

  it("feeds measured 24-hour social performance back into idea generation", () => {
    assert.match(routeSource, /projected_views_24h/);
    assert.match(routeSource, /actual_views_24h/);
    assert.match(routeSource, /projection_confidence/);
    assert.match(routeSource, /action === "record-social-idea-views"/);
    assert.match(routeSource, /action === "backfill-social-idea-projections"/);
    assert.match(routeSource, /actualViews24h/);
    assert.match(routeSource, /Use history rows with actualViews24h/);
  });

  it("stores plans separately from automatic metrics", () => {
    assert.match(routeSource, /growth_monthly_plans/);
    assert.match(routeSource, /growth_marketing_daily/);
    assert.match(routeSource, /growth_marketing_snapshots/);
    assert.match(routeSource, /aggregation_role/);
    assert.match(routeSource, /async function loadSnapshotRows/);
    assert.match(
      routeSource,
      /select=source,period_start,period_end,metric,value,currency,aggregation_role,metadata,captured_at,notes/,
    );
    assert.match(
      routeSource,
      /select=source,period_start,period_end,metric,value,currency,metadata,captured_at,notes/,
    );
    assert.match(routeSource, /primarySnapshots = snapshots\.filter/);
    assert.match(
      routeSource,
      /aggregation_role=primary historical snapshots are eligible/,
    );
    assert.match(
      migrationSource,
      /alter table public\.growth_monthly_plans enable row level security/,
    );
    assert.match(
      migrationSource,
      /alter table public\.growth_marketing_daily enable row level security/,
    );
    assert.match(
      migrationSource,
      /create table if not exists public\.growth_marketing_daily_spend/,
    );
    assert.match(
      migrationSource,
      /currency_code text not null check \(currency_code ~ '\^\[A-Z\]\{3\}\$'\)/,
    );
    assert.match(
      migrationSource,
      /platform text not null check \(platform in \('google_ads', 'tiktok_ads', 'apple_search_ads', 'meta_ads', 'other'\)\)/,
    );
    assert.match(migrationSource, /unique \(date, platform, currency_code\)/);
    assert.match(
      migrationSource,
      /alter table public\.growth_marketing_daily_spend enable row level security/,
    );
    assert.match(
      migrationSource,
      /alter table public\.growth_marketing_snapshots enable row level security/,
    );
    assert.doesNotMatch(migrationSource, /create policy/i);
  });

  it("accepts legacy granularity params without reverting to rolling windows", () => {
    assert.match(
      metricsRouteSource,
      /type Period = "hour" \| "day" \| "week" \| "month"/,
    );
    assert.match(metricsRouteSource, /requested\s*===\s*"hour"/);
    assert.match(metricsRouteSource, /requested\s*===\s*"week"/);
    assert.match(metricsRouteSource, /requested\s*===\s*"month"/);
    assert.doesNotMatch(metricsRouteSource, /windowMs/);
    assert.doesNotMatch(metricsRouteSource, /Last 30 days/);
  });

  it("uses explicit Jakarta calendar months for supporting metrics", () => {
    assert.match(
      metricsRouteSource,
      /parseGrowthMonth\([\s\S]*request\.nextUrl\.searchParams\.get\("month"\)[\s\S]*\)/,
    );
    assert.match(metricsRouteSource, /jakartaMonthBounds\(selectedMonth\)/);
    assert.match(metricsRouteSource, /periodEndExclusive/);
    assert.match(
      metricsRouteSource,
      /new Date\(row\.created_at \?\? 0\)\s*<\s*end/,
    );
  });

  it("documents derived funnel metrics without pretending paying pro is reliable", () => {
    assert.match(routeSource, /buildCollectorAnalytics/);
    assert.match(routeSource, /collectorAnalytics\.definitions\.activation/);
    assert.match(routeSource, /collectorAnalytics\.definitions\.d1/);
    assert.match(routeSource, /collectorAnalytics\.definitions\.d7/);
    assert.match(routeSource, /activationEligibleUsers/);
    assert.match(routeSource, /d1EligibleUsers/);
    assert.match(routeSource, /d7EligibleUsers/);
    assert.match(routeSource, /captureReadEndIso/);
    assert.match(routeSource, /first recorded Production App Store purchase/);
    assert.match(routeSource, /cohortFirstTimePurchasers/);
    assert.match(
      routeSource,
      /rate\(cohortFirstTimePurchasers, actuals\.users\)/,
    );
    assert.match(routeSource, /Transaction-period metric/);
    assert.match(routeSource, /Cohort metric/);
    assert.match(routeSource, /Not yet reliable/);
  });

  it("seeds only external historical snapshots without fake daily product metrics", () => {
    assert.match(seedSource, /insert into public\.growth_marketing_snapshots/);
    assert.match(
      seedSource,
      /on conflict \(source, period_start, period_end, metric\) do update/,
    );
    assert.match(seedSource, /google_search_console/);
    assert.match(seedSource, /tiktok_organic/);
    assert.match(seedSource, /tiktok_ads/);
    assert.match(seedSource, /google_ads/);
    assert.match(seedSource, /apple_search_ads/);
    assert.match(seedSource, /'IDR'/);
    assert.match(seedSource, /'GBP'/);
    assert.match(seedSource, /'USD'/);
    assert.match(
      seedSource,
      /aggregation_role text not null default 'primary'/,
    );
    assert.match(
      seedSource,
      /date '2026-08-17', date '2026-08-23', 'spend', 504370, 'IDR', 'supporting'/,
    );
    assert.match(seedSource, /do_not_sum_with_main/);
    assert.match(seedSource, /Organic search, not ads/);
    assert.match(seedSource, /Profile views are not website visits/);
    assert.match(seedSource, /Do not treat as installs or users/);
    assert.match(seedSource, /Not verified as AnimalDex users/);
    assert.match(seedSource, /'taps'/);
    assert.match(seedSource, /"approximate":true/);
    assert.doesNotMatch(seedSource, /insert into public\.profiles/i);
    assert.doesNotMatch(seedSource, /insert into public\.captures/i);
    assert.doesNotMatch(seedSource, /insert into public\.app_store_purchases/i);
  });
});
