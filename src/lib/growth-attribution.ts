import { todayKey } from "./growth-command-center";

/**
 * Platform + acquisition attribution for /admin/metrics.
 *
 * Accounts that pre-date app-side reporting carry no platform, so the platform
 * is inferred from device-only evidence in a fixed order of trust. Every
 * inference keeps its evidence so the dashboard can say how sure it is.
 */

export type GrowthPlatform = "ios" | "android" | "web" | "unknown";
export const growthPlatforms: GrowthPlatform[] = ["ios", "android", "web", "unknown"];
export const growthPlatformLabels: Record<GrowthPlatform, string> = {
  ios: "iOS",
  android: "Android",
  web: "Web",
  unknown: "Unknown",
};

export type PlatformEvidence =
  | "reported"
  | "apns_token"
  | "app_store_purchase"
  | "play_purchase"
  | "apple_sign_in"
  | "reported_web"
  | "none";

export const platformEvidenceLabels: Record<PlatformEvidence, string> = {
  reported: "Reported by the app",
  apns_token: "iOS push token",
  app_store_purchase: "App Store purchase",
  play_purchase: "Google Play purchase",
  apple_sign_in: "Sign in with Apple",
  reported_web: "Used the web app",
  none: "No signal yet",
};

/** One row of `admin_user_growth_v1`. */
export type UserGrowthRow = {
  user_id: string;
  created_at: string;
  first_reported_platform: string | null;
  first_reported_at: string | null;
  reported_platforms: string[] | null;
  has_apns_token: boolean | null;
  has_app_store_purchase: boolean | null;
  has_play_purchase: boolean | null;
  auth_providers: unknown;
  self_reported_source: string | null;
  self_reported_detail?: string | null;
  install_referrer?: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign?: string | null;
  gclid: string | null;
  apple_ads_attributed: boolean | null;
  apple_ads_campaign_id?: string | null;
  store_attribution_at?: string | null;
};

export type InferredPlatform = {
  platform: GrowthPlatform;
  evidence: PlatformEvidence;
  /** True when the app reported this platform within 48h of signup. */
  atSignup: boolean;
};

const SIGNUP_WINDOW_MS = 48 * 60 * 60 * 1000;

function providersOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase());
  }
  if (typeof value === "string") return [value.toLowerCase()];
  return [];
}

function nativePlatform(value: string | null | undefined): "ios" | "android" | null {
  return value === "ios" || value === "android" ? value : null;
}

export function inferUserPlatform(row: UserGrowthRow): InferredPlatform {
  const reported = (row.reported_platforms ?? []).filter(Boolean);
  const createdAt = Date.parse(row.created_at);
  const firstAt = row.first_reported_at ? Date.parse(row.first_reported_at) : Number.NaN;
  const reportedNearSignup =
    Number.isFinite(createdAt) && Number.isFinite(firstAt) && firstAt - createdAt <= SIGNUP_WINDOW_MS;

  if (row.first_reported_platform && reportedNearSignup) {
    const platform = row.first_reported_platform === "web" ? "web" : nativePlatform(row.first_reported_platform);
    if (platform) return { platform, evidence: "reported", atSignup: true };
  }

  // Reported long after signup: a native app report still beats inference, but
  // a later web visit says nothing about where the account started.
  const nativeReports = reported.map(nativePlatform).filter((item): item is "ios" | "android" => Boolean(item));
  if (nativeReports.length) {
    const first = nativePlatform(row.first_reported_platform) ?? nativeReports[0];
    return { platform: first, evidence: "reported", atSignup: false };
  }
  if (row.has_apns_token) return { platform: "ios", evidence: "apns_token", atSignup: false };
  if (row.has_app_store_purchase) return { platform: "ios", evidence: "app_store_purchase", atSignup: false };
  if (row.has_play_purchase) return { platform: "android", evidence: "play_purchase", atSignup: false };
  if (providersOf(row.auth_providers).includes("apple")) {
    return { platform: "ios", evidence: "apple_sign_in", atSignup: false };
  }
  if (reported.includes("web")) return { platform: "web", evidence: "reported_web", atSignup: false };
  return { platform: "unknown", evidence: "none", atSignup: false };
}

// ---------------------------------------------------------------------------
// Acquisition channel
// ---------------------------------------------------------------------------

export type ChannelKind = "paid" | "organic" | "unknown";
export type ChannelEvidence = "store" | "self_reported" | "none";
export type AcquisitionChannel = {
  key: string;
  label: string;
  kind: ChannelKind;
  evidence: ChannelEvidence;
  /** Ad network key matching growth_marketing_daily_spend.platform for paid channels. */
  network: string | null;
};

export const paidNetworkLabels: Record<string, string> = {
  apple_search_ads: "Apple Search Ads",
  google_ads: "Google Ads",
  tiktok_ads: "TikTok Ads",
  meta_ads: "Meta Ads",
  other: "Other ads",
};

export const selfReportedSourceLabels: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  facebook: "Facebook",
  x: "X (Twitter)",
  reddit: "Reddit",
  google_search: "Google search",
  app_store: "App Store search",
  play_store: "Google Play search",
  friend: "Friend or family",
  press: "News or blog",
  other: "Other",
};

const PAID_MEDIUMS = new Set(["cpc", "ppc", "cpi", "cpm", "paid", "paid_social", "paidsocial", "ads", "ad", "display"]);

function networkFromSource(source: string) {
  if (source.includes("tiktok")) return "tiktok_ads";
  if (source.includes("facebook") || source.includes("instagram") || source.includes("meta")) return "meta_ads";
  if (source.includes("apple")) return "apple_search_ads";
  if (source.includes("google") || source.includes("youtube")) return "google_ads";
  return "other";
}

function paidChannel(network: string): AcquisitionChannel {
  return { key: network, label: paidNetworkLabels[network] ?? "Other ads", kind: "paid", evidence: "store", network };
}

export function classifyAcquisition(row: UserGrowthRow): AcquisitionChannel {
  const source = (row.utm_source ?? "").trim().toLowerCase();
  const medium = (row.utm_medium ?? "").trim().toLowerCase();

  // Store-verified paid installs outrank anything the user tells us.
  if (row.apple_ads_attributed === true) return paidChannel("apple_search_ads");
  if (row.gclid) return paidChannel("google_ads");
  if (medium && PAID_MEDIUMS.has(medium)) return paidChannel(networkFromSource(source));

  const self = row.self_reported_source;
  if (self && self !== "skipped" && selfReportedSourceLabels[self]) {
    return {
      key: `said:${self}`,
      label: selfReportedSourceLabels[self],
      kind: "organic",
      evidence: "self_reported",
      network: null,
    };
  }
  if (source === "google-play" && medium === "organic") {
    return { key: "play_store", label: "Google Play search", kind: "organic", evidence: "store", network: null };
  }
  if (source && source !== "google-play" && source !== "(not set)") {
    return { key: `referral:${source}`, label: `Referral · ${source}`, kind: "organic", evidence: "store", network: null };
  }
  if (row.apple_ads_attributed === false) {
    return {
      key: "app_store_unattributed",
      label: "App Store, not Apple Ads",
      kind: "organic",
      evidence: "store",
      network: null,
    };
  }
  return { key: "unknown", label: "Not attributed yet", kind: "unknown", evidence: "none", network: null };
}

// ---------------------------------------------------------------------------
// Daily platform series
// ---------------------------------------------------------------------------

export type PlatformDailyRow = { date: string } & Record<GrowthPlatform, number>;

export function buildPlatformDaily(
  users: Array<{ createdAt: string; platform: GrowthPlatform }>,
  dateKeys: string[],
): PlatformDailyRow[] {
  const rows = new Map<string, PlatformDailyRow>(
    dateKeys.map((date) => [date, { date, ios: 0, android: 0, web: 0, unknown: 0 }]),
  );
  for (const user of users) {
    const row = rows.get(todayKey(new Date(user.createdAt)));
    if (row) row[user.platform] += 1;
  }
  return dateKeys.map((date) => rows.get(date)!);
}

export function countBy<T, K extends string>(items: T[], key: (item: T) => K) {
  const counts = {} as Record<K, number>;
  for (const item of items) {
    const k = key(item);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Paid log: spend and platform-reported installs by network × OS
// ---------------------------------------------------------------------------

export type SpendOs = "ios" | "android" | "web" | "mixed" | "unknown";

export type PaidLogEntry = {
  date: string;
  network: string;
  os: SpendOs;
  currencyCode: string;
  amount: number;
  reportedInstalls: number | null;
};

export type PaidLogRow = {
  network: string;
  os: SpendOs;
  currencyCode: string;
  spend: number;
  installs: number;
  daysWithInstalls: number;
  daysLogged: number;
  costPerInstall: number | null;
};

export function summarizePaidLog(entries: PaidLogEntry[]): PaidLogRow[] {
  const rows = new Map<string, PaidLogRow & { dates: Set<string>; installDates: Set<string> }>();
  for (const entry of entries) {
    const key = `${entry.network}|${entry.os}|${entry.currencyCode}`;
    const row = rows.get(key) ?? {
      network: entry.network,
      os: entry.os,
      currencyCode: entry.currencyCode,
      spend: 0,
      installs: 0,
      daysWithInstalls: 0,
      daysLogged: 0,
      costPerInstall: null,
      dates: new Set<string>(),
      installDates: new Set<string>(),
    };
    row.spend += Math.max(0, entry.amount);
    row.dates.add(entry.date);
    if (entry.reportedInstalls != null) {
      row.installs += Math.max(0, entry.reportedInstalls);
      row.installDates.add(entry.date);
    }
    rows.set(key, row);
  }
  return Array.from(rows.values())
    .map(({ dates, installDates, ...row }) => {
      // Cost per install only over days that logged installs, so a day with
      // spend but no install count doesn't inflate CPI.
      const spendOnInstallDays = entries
        .filter(
          (entry) =>
            entry.network === row.network &&
            entry.os === row.os &&
            entry.currencyCode === row.currencyCode &&
            installDates.has(entry.date),
        )
        .reduce((sum, entry) => sum + Math.max(0, entry.amount), 0);
      return {
        ...row,
        daysLogged: dates.size,
        daysWithInstalls: installDates.size,
        costPerInstall: row.installs > 0 ? spendOnInstallDays / row.installs : null,
      };
    })
    .sort((left, right) => right.installs - left.installs || right.spend - left.spend);
}

export type PaidOrganicSplit = {
  platform: "ios" | "android";
  signups: number;
  reportedInstalls: number;
  paidEstimate: number;
  organicFloor: number;
  organicShare: number | null;
  spendByCurrency: Record<string, number>;
  costPerPaidSignupByCurrency: Record<string, number>;
};

/**
 * Conservative split per OS: every platform-reported paid install is assumed to
 * have become a signup, so organic is a floor, not a point estimate.
 */
export function buildPaidOrganicSplit(
  signups: Record<GrowthPlatform, number>,
  paidRows: PaidLogRow[],
): PaidOrganicSplit[] {
  return (["ios", "android"] as const).map((platform) => {
    const rows = paidRows.filter((row) => row.os === platform);
    const reportedInstalls = rows.reduce((sum, row) => sum + row.installs, 0);
    const total = signups[platform] ?? 0;
    const paidEstimate = Math.min(total, reportedInstalls);
    const organicFloor = total - paidEstimate;
    const spendByCurrency: Record<string, number> = {};
    for (const row of rows) spendByCurrency[row.currencyCode] = (spendByCurrency[row.currencyCode] ?? 0) + row.spend;
    const costPerPaidSignupByCurrency: Record<string, number> = {};
    if (paidEstimate > 0) {
      for (const [currency, amount] of Object.entries(spendByCurrency)) {
        costPerPaidSignupByCurrency[currency] = amount / paidEstimate;
      }
    }
    return {
      platform,
      signups: total,
      reportedInstalls,
      paidEstimate,
      organicFloor,
      organicShare: total > 0 ? Math.round((organicFloor / total) * 1000) / 10 : null,
      spendByCurrency,
      costPerPaidSignupByCurrency,
    };
  });
}

// ---------------------------------------------------------------------------
// Historical imports (growth_marketing_snapshots)
// ---------------------------------------------------------------------------

export type SnapshotLike = {
  source: string;
  periodStart: string;
  periodEnd: string;
  metric: string;
  value: number;
  currency: string | null;
  os?: string | null;
};

export type HistoricalChannelRow = {
  source: string;
  label: string;
  os: SpendOs;
  kind: "paid" | "organic";
  periodStart: string;
  periodEnd: string;
  spend: number | null;
  currency: string | null;
  impressions: number | null;
  clicks: number | null;
  installs: number | null;
  views: number | null;
  costPerInstall: number | null;
  costPerClick: number | null;
};

const snapshotLabels: Record<string, string> = {
  ...paidNetworkLabels,
  tiktok_organic: "TikTok organic",
  google_search_console: "Google Search",
};

function defaultSnapshotOs(source: string): SpendOs {
  if (source === "apple_search_ads") return "ios";
  if (source === "google_ads") return "android";
  return "mixed";
}

export function buildHistoricalChannelRows(snapshots: SnapshotLike[]): HistoricalChannelRow[] {
  const groups = new Map<string, SnapshotLike[]>();
  for (const row of snapshots) {
    const key = `${row.source}|${row.periodStart}|${row.periodEnd}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const metric = (rows: SnapshotLike[], ...names: string[]) =>
    rows.find((row) => names.includes(row.metric)) ?? null;
  return Array.from(groups.values())
    .map((rows) => {
      const first = rows[0];
      const spend = metric(rows, "spend");
      const installs = metric(rows, "installs");
      const clicks = metric(rows, "clicks", "taps", "destination_clicks");
      const views = metric(rows, "video_views", "views");
      const os = (rows.find((row) => row.os)?.os as SpendOs | undefined) ?? defaultSnapshotOs(first.source);
      return {
        source: first.source,
        label: snapshotLabels[first.source] ?? first.source.replace(/_/g, " "),
        os,
        kind: spend ? ("paid" as const) : ("organic" as const),
        periodStart: first.periodStart,
        periodEnd: first.periodEnd,
        spend: spend?.value ?? null,
        currency: spend?.currency ?? null,
        impressions: metric(rows, "impressions")?.value ?? null,
        clicks: clicks?.value ?? null,
        installs: installs?.value ?? null,
        views: views?.value ?? null,
        costPerInstall: spend && installs?.value ? spend.value / installs.value : null,
        costPerClick: spend && clicks?.value ? spend.value / clicks.value : null,
      };
    })
    .sort((left, right) => right.periodEnd.localeCompare(left.periodEnd) || left.label.localeCompare(right.label));
}

// ---------------------------------------------------------------------------
// Purchases by store
// ---------------------------------------------------------------------------

export type PurchaseStore = "app_store" | "google_play" | "web" | "test" | "unknown";
export const purchaseStoreLabels: Record<PurchaseStore, string> = {
  app_store: "App Store",
  google_play: "Google Play",
  web: "Web",
  test: "Test / sandbox",
  unknown: "Unknown store",
};

/** List prices used for estimates; store proceeds, tax and fees are not recorded. */
export const estimatedUsdByProduct: Record<string, number> = {
  purchase_25: 2.99,
  purchase_100: 7.99,
  pro_upgrade: 9.99,
};

export type PurchaseLedgerRow = {
  userId: string;
  createdAt: string;
  source: string | null;
  productCode: string | null;
  environment: string | null;
  testPurchase: boolean;
};

export function classifyPurchaseStore(row: Pick<PurchaseLedgerRow, "source" | "environment" | "testPurchase">): PurchaseStore {
  const source = (row.source ?? "").toLowerCase();
  if (row.testPurchase || source === "simulated_purchase") return "test";
  if ((row.environment ?? "").toLowerCase() === "sandbox") return "test";
  if (source.includes("app_store") || source.includes("storekit")) return "app_store";
  if (source.includes("play") || source.includes("google")) return "google_play";
  if (source.includes("paddle") || source.includes("stripe") || source === "web") return "web";
  return "unknown";
}

export type StoreSummary = {
  purchases: number;
  pro: number;
  credits: number;
  buyers: number;
  estimatedUsd: number;
};

export function summarizePurchasesByStore(rows: PurchaseLedgerRow[], startMs: number, endMs: number) {
  const byStore = {} as Record<PurchaseStore, StoreSummary & { buyerIds: Set<string> }>;
  for (const row of rows) {
    const time = Date.parse(row.createdAt);
    if (!Number.isFinite(time) || time < startMs || time >= endMs) continue;
    const store = classifyPurchaseStore(row);
    const entry = byStore[store] ?? { purchases: 0, pro: 0, credits: 0, buyers: 0, estimatedUsd: 0, buyerIds: new Set<string>() };
    entry.purchases += 1;
    if (row.productCode === "pro_upgrade") entry.pro += 1;
    else entry.credits += 1;
    if (store !== "test") entry.estimatedUsd += estimatedUsdByProduct[row.productCode ?? ""] ?? 0;
    entry.buyerIds.add(row.userId);
    byStore[store] = entry;
  }
  return Object.fromEntries(
    Object.entries(byStore).map(([store, { buyerIds, ...summary }]) => [
      store,
      { ...summary, buyers: buyerIds.size, estimatedUsd: Math.round(summary.estimatedUsd * 100) / 100 },
    ]),
  ) as Partial<Record<PurchaseStore, StoreSummary>>;
}
