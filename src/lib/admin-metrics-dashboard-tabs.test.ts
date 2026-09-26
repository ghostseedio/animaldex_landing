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

const dashboard = read("../app/admin/metrics/admin-metrics-dashboard.tsx");
const plan = readAll("../app/admin/metrics/growth-plan-panel.tsx", "../app/admin/metrics/_growth/");
const growthRoute = readAll("../app/api/admin/growth/route.ts", "../app/api/admin/growth/_lib/");
const socialRoute = read("../app/api/admin/social-metrics/route.ts");
const metricsRoute = read("../app/api/admin/metrics/route.ts");
const migration = read("../../supabase/migrations/20260915120000_growth_platform_attribution.sql");

describe("admin metrics dashboard", () => {
  it("opens on Overview and keeps the other founder tabs", () => {
    assert.match(dashboard, /type MetricsTab = "overview" \| "channels" \| "product" \| "revenue" \| "plan"/);
    assert.match(dashboard, /: "overview"/);
  });

  it("maps the old acquisition tab link onto Channels", () => {
    assert.match(dashboard, /requestedTab === "acquisition"/);
  });

  it("keeps the month in the URL across tabs and month navigation", () => {
    assert.match(dashboard, /parseGrowthMonth\(searchParams\.get\("month"\)\)/);
    assert.match(dashboard, /params\.set\("month"/);
    assert.match(dashboard, /shiftMonth\(growthMonth, -1\)/);
    assert.match(dashboard, /shiftMonth\(growthMonth, 1\)/);
  });

  it("formats rates as percentages", () => {
    assert.match(dashboard, /value=\{pct\(growth\?\.funnel\?\.payerConversionRate\)\}/);
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
