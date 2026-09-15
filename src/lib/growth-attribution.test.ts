import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHistoricalChannelRows,
  buildPaidOrganicSplit,
  buildPlatformDaily,
  classifyAcquisition,
  classifyPurchaseStore,
  inferUserPlatform,
  summarizePaidLog,
  summarizePurchasesByStore,
  type UserGrowthRow,
} from "./growth-attribution";

function row(overrides: Partial<UserGrowthRow> = {}): UserGrowthRow {
  return {
    user_id: "u1",
    created_at: "2026-09-10T03:00:00Z",
    first_reported_platform: null,
    first_reported_at: null,
    reported_platforms: null,
    has_apns_token: false,
    has_app_store_purchase: false,
    has_play_purchase: false,
    auth_providers: ["google"],
    self_reported_source: null,
    utm_source: null,
    utm_medium: null,
    gclid: null,
    apple_ads_attributed: null,
    ...overrides,
  };
}

describe("inferUserPlatform", () => {
  it("trusts an app report made within 48h of signup", () => {
    const result = inferUserPlatform(
      row({ first_reported_platform: "android", first_reported_at: "2026-09-11T01:00:00Z", reported_platforms: ["android"] }),
    );
    assert.deepEqual(result, { platform: "android", evidence: "reported", atSignup: true });
  });

  it("keeps a native report made later but ignores a later web visit", () => {
    assert.equal(
      inferUserPlatform(
        row({ first_reported_platform: "ios", first_reported_at: "2026-12-01T00:00:00Z", reported_platforms: ["ios"] }),
      ).platform,
      "ios",
    );
    const webLater = inferUserPlatform(
      row({
        first_reported_platform: "web",
        first_reported_at: "2026-12-01T00:00:00Z",
        reported_platforms: ["web"],
        auth_providers: ["apple"],
      }),
    );
    assert.deepEqual(webLater, { platform: "ios", evidence: "apple_sign_in", atSignup: false });
  });

  it("falls back through device evidence in trust order", () => {
    assert.equal(inferUserPlatform(row({ has_apns_token: true, has_play_purchase: true })).evidence, "apns_token");
    assert.equal(inferUserPlatform(row({ has_app_store_purchase: true })).platform, "ios");
    assert.equal(inferUserPlatform(row({ has_play_purchase: true })).platform, "android");
    assert.equal(inferUserPlatform(row({ auth_providers: ["email", "apple"] })).platform, "ios");
    assert.deepEqual(inferUserPlatform(row()), { platform: "unknown", evidence: "none", atSignup: false });
  });
});

describe("classifyAcquisition", () => {
  it("ranks store-verified paid installs above a self-reported answer", () => {
    assert.equal(classifyAcquisition(row({ apple_ads_attributed: true, self_reported_source: "tiktok" })).key, "apple_search_ads");
    assert.equal(classifyAcquisition(row({ gclid: "abc" })).kind, "paid");
    assert.equal(classifyAcquisition(row({ utm_source: "tiktok", utm_medium: "paid_social" })).network, "tiktok_ads");
  });

  it("uses the self-reported answer before organic store signals", () => {
    const said = classifyAcquisition(row({ self_reported_source: "friend", utm_source: "google-play", utm_medium: "organic" }));
    assert.equal(said.key, "said:friend");
    assert.equal(said.evidence, "self_reported");
    assert.equal(classifyAcquisition(row({ utm_source: "google-play", utm_medium: "organic" })).key, "play_store");
    assert.equal(classifyAcquisition(row({ self_reported_source: "skipped" })).key, "unknown");
    assert.equal(classifyAcquisition(row({ apple_ads_attributed: false })).key, "app_store_unattributed");
  });
});

describe("paid log and organic split", () => {
  const entries = [
    { date: "2026-09-01", network: "google_ads", os: "android" as const, currencyCode: "IDR", amount: 100000, reportedInstalls: 50 },
    { date: "2026-09-02", network: "google_ads", os: "android" as const, currencyCode: "IDR", amount: 80000, reportedInstalls: null },
    { date: "2026-09-02", network: "apple_search_ads", os: "ios" as const, currencyCode: "GBP", amount: 20, reportedInstalls: 10 },
  ];

  it("computes CPI only over days that logged installs", () => {
    const rows = summarizePaidLog(entries);
    const google = rows.find((item) => item.network === "google_ads")!;
    assert.equal(google.spend, 180000);
    assert.equal(google.installs, 50);
    assert.equal(google.daysLogged, 2);
    assert.equal(google.costPerInstall, 2000);
  });

  it("caps paid at signups so organic is a floor", () => {
    const split = buildPaidOrganicSplit({ ios: 8, android: 120, web: 0, unknown: 30 }, summarizePaidLog(entries));
    const ios = split.find((item) => item.platform === "ios")!;
    const android = split.find((item) => item.platform === "android")!;
    assert.equal(ios.paidEstimate, 8);
    assert.equal(ios.organicFloor, 0);
    assert.equal(android.paidEstimate, 50);
    assert.equal(android.organicShare, 58.3);
    assert.equal(android.costPerPaidSignupByCurrency.IDR, 3600);
  });
});

describe("historical imports", () => {
  it("groups snapshot metrics per source and period with an OS", () => {
    const rows = buildHistoricalChannelRows([
      { source: "apple_search_ads", periodStart: "2026-08-01", periodEnd: "2026-08-31", metric: "spend", value: 40, currency: "GBP" },
      { source: "apple_search_ads", periodStart: "2026-08-01", periodEnd: "2026-08-31", metric: "installs", value: 20, currency: null },
      { source: "tiktok_organic", periodStart: "2026-08-01", periodEnd: "2026-08-31", metric: "video_views", value: 5000, currency: null },
    ]);
    const asa = rows.find((item) => item.source === "apple_search_ads")!;
    assert.equal(asa.os, "ios");
    assert.equal(asa.costPerInstall, 2);
    assert.equal(rows.find((item) => item.source === "tiktok_organic")!.kind, "organic");
  });
});

describe("purchases by store", () => {
  it("classifies ledger sources and excludes tests from revenue", () => {
    assert.equal(classifyPurchaseStore({ source: "app_store_server_api", environment: "Production", testPurchase: false }), "app_store");
    assert.equal(classifyPurchaseStore({ source: "app_store_server_api", environment: "Sandbox", testPurchase: false }), "test");
    assert.equal(classifyPurchaseStore({ source: "play_billing", environment: null, testPurchase: false }), "google_play");
    assert.equal(classifyPurchaseStore({ source: "simulated_purchase", environment: null, testPurchase: true }), "test");

    const summary = summarizePurchasesByStore(
      [
        { userId: "a", createdAt: "2026-09-02T00:00:00Z", source: "app_store_server_api", productCode: "pro_upgrade", environment: "Production", testPurchase: false },
        { userId: "a", createdAt: "2026-09-03T00:00:00Z", source: "app_store_server_api", productCode: "purchase_25", environment: "Production", testPurchase: false },
        { userId: "b", createdAt: "2026-09-03T00:00:00Z", source: "simulated_purchase", productCode: "purchase_25", environment: null, testPurchase: true },
        { userId: "c", createdAt: "2026-10-01T00:00:00Z", source: "play_billing", productCode: "pro_upgrade", environment: null, testPurchase: false },
      ],
      Date.parse("2026-09-01T00:00:00Z"),
      Date.parse("2026-10-01T00:00:00Z"),
    );
    assert.deepEqual(summary.app_store, { purchases: 2, pro: 1, credits: 1, buyers: 1, estimatedUsd: 12.98 });
    assert.equal(summary.test?.estimatedUsd, 0);
    assert.equal(summary.google_play, undefined);
  });
});

describe("platform daily", () => {
  it("buckets signups by Asia/Jakarta day", () => {
    const rows = buildPlatformDaily(
      [
        { createdAt: "2026-09-01T18:30:00Z", platform: "ios" },
        { createdAt: "2026-09-01T10:00:00Z", platform: "android" },
      ],
      ["2026-09-01", "2026-09-02"],
    );
    assert.equal(rows[0].android, 1);
    assert.equal(rows[1].ios, 1);
  });
});
