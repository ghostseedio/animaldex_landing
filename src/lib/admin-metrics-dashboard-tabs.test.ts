import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
// These surfaces are split across a directory of modules, so assert against the
// whole set rather than whichever file a symbol happens to live in today.
const readAll = (entry: string, dir: string) => {
  const base = new URL(dir, import.meta.url);
  return [read(entry), ...readdirSync(base).map((name) => readFileSync(new URL(name, base), "utf8"))].join("\n");
};

const marketing = read("../app/admin/metrics/admin-metrics-dashboard.tsx");
const analytics = read("../app/admin/metrics/analytics-dashboard.tsx");
const analyticsTabs = readAll("../app/admin/metrics/_analytics/types.ts", "../app/admin/metrics/_analytics/");
const metricsPage = read("../app/admin/metrics/page.tsx");
const plan = readAll("../app/admin/metrics/growth-plan-panel.tsx", "../app/admin/metrics/_growth/");
const growthRoute = readAll("../app/api/admin/growth/route.ts", "../app/api/admin/growth/_lib/");
const socialRoute = read("../app/api/admin/social-metrics/route.ts");
const metricsRoute = read("../app/api/admin/metrics/route.ts");
const migration = read("../../supabase/migrations/20260915120000_growth_platform_attribution.sql");

describe("analytics dashboard", () => {
  it("opens on Overview with the founder tabs, Blog & social among them", () => {
    assert.match(analyticsTabs, /type MetricsTab = "overview" \| "acquisition" \| "engagement" \| "retention" \| "content" \| "revenue" \| "releases"/);
    assert.match(analytics, /return metricsTabs\.some\(\(tab\) => tab\.value === value\) \? \(value as MetricsTab\) : "overview"/);
  });

  it("picks any date range at day, week or month grain, and keeps it in the URL", () => {
    for (const preset of ["7d", "30d", "90d", "mtd", "last_month", "6m", "12m", "custom"]) assert.match(analytics, new RegExp(`value: "${preset}"`));
    assert.match(analytics, /window\.history\.replaceState/);
    assert.doesNotMatch(analytics, /router\.push/);
  });

  it("sends old spend and plan links to the marketing page", () => {
    assert.match(metricsPage, /tab === "plan" \|\| tab === "channels"/);
    assert.match(metricsPage, /redirect\(`\/admin\/metrics\/marketing/);
  });

  it("shows no retired features", () => {
    for (const source of [analytics, analyticsTabs, marketing, metricsRoute]) assert.doesNotMatch(source, /fusion|alignment|discover_trade_history/i);
  });
});

describe("spend, social & plan page", () => {
  it("keeps the month in its own URL and only the hand-entered tabs", () => {
    assert.match(marketing, /type MetricsTab = "channels" \| "plan"/);
    assert.match(marketing, /parseGrowthMonth\(searchParams\.get\("month"\)\)/);
    assert.match(marketing, /shiftMonth\(growthMonth, -1\)/);
    assert.match(marketing, /\/admin\/metrics\/marketing\?/);
    assert.match(marketing, /setTab\(nextTab\)/);
  });
});

describe("daily log", () => {
  it("logs spend with the app it was for and platform-reported installs", () => {
    assert.match(plan, /name="spendOs"/);
    assert.match(plan, /name="spendInstalls"/);
    assert.doesNotMatch(plan, /name="paidUsers"/);
  });

  it("validates OS and installs on the server", () => {
    assert.match(growthRoute, /spendOsOptions\.includes\(entry\.os as SpendOs\)/);
    assert.match(growthRoute, /reported_installs/);
  });
});

describe("attribution data", () => {
  it("reads platform and channel from the admin view and degrades before the migration", () => {
    assert.match(growthRoute, /admin_user_growth_v1/);
    assert.match(growthRoute, /inferUserPlatform/);
    assert.match(growthRoute, /classifyAcquisition/);
    assert.match(growthRoute, /isMissingTableError\(error, "admin_user_growth_v1"\)/);
  });

  it("does not page every auth account from the metrics API any more", () => {
    assert.doesNotMatch(metricsRoute, /auth\/v1\/admin\/users/);
  });

  it("only calls social providers on an explicit sync", () => {
    const getHandler = socialRoute.slice(socialRoute.indexOf("export async function GET"), socialRoute.indexOf("export async function POST"));
    assert.doesNotMatch(getHandler, /safe\(/);
    assert.match(socialRoute, /export async function POST/);
  });

  it("exposes device and acquisition RPCs to signed-in users only", () => {
    assert.match(migration, /create or replace function public\.record_user_device/);
    assert.match(migration, /create or replace function public\.record_user_acquisition/);
    assert.match(migration, /grant execute on function public\.record_user_device\(text, text, text, text, text\) to authenticated/);
    assert.match(migration, /revoke all on public\.admin_user_growth_v1 from public, anon, authenticated/);
  });
});
