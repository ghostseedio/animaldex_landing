"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createContext, FormEvent, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Badge, Button, Card, CardContent, CardHeader, InfoTip, Segmented, Stat, TD, TH, Table } from "@/components/admin/ui";
import {
  daysInMonth,
  formatMoney,
  growthMonthState,
  monthLabel,
  organicPlatformLabels,
  organicPlatforms,
  parseGrowthMonth,
  shiftMonth,
} from "@/lib/growth-command-center";
import {
  growthPlatformLabels,
  growthPlatforms,
  paidNetworkLabels,
  platformEvidenceLabels,
  purchaseStoreLabels,
  type AcquisitionChannel,
  type GrowthPlatform,
  type HistoricalChannelRow,
  type PaidLogRow,
  type PaidOrganicSplit,
  type PlatformDailyRow,
  type PlatformEvidence,
  type PurchaseStore,
  type SpendOs,
  type StoreSummary,
} from "@/lib/growth-attribution";
import { convertAmount, displayCurrencies, fxDate, fxKey, isDisplayCurrency, type DisplayCurrency, type FxRates } from "@/lib/fx-convert";
import { format, GrowthCommandCenter, type GrowthData } from "./growth-plan-panel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PostType = "captures" | "alignments" | "fusions" | "challenges" | "trades";
type PostSeriesRow = { date: string } & Record<PostType, number>;
type Metrics = {
  month: string;
  kpis: Record<"users" | "captures" | "subscriptions" | "credits", { value: number; change: number }>;
  purchaseBreakdown: { production: number; sandbox: number };
  postActivity: { total: number; types: Record<PostType, { value: number; change: number }>; series: PostSeriesRow[] };
};
type SocialMetric = {
  platform: string;
  configured: boolean;
  followers: number | null;
  views: number | null;
  posts: number | null;
  followerChange?: number | null;
  recordedAt?: string | null;
};
type GroupStats = {
  users: number;
  activationRate: number | null;
  activationEligible: number;
  d7Rate: number | null;
  d7Eligible: number;
  capturesPerCollector: number | null;
  payers: number;
};
type ChannelRow = AcquisitionChannel & GroupStats & { platform: GrowthPlatform; costPerUser: Record<string, number> | null };
type Insights = {
  attribution?:
    | { available: false }
    | {
        available: true;
        month: {
          users: number;
          signupsByPlatform: Record<GrowthPlatform, number>;
          evidenceCounts: Partial<Record<PlatformEvidence, number>>;
          reportedAtSignup: number;
          selfReported: number;
          storeAttributed: number;
          platformDaily: PlatformDailyRow[];
          byPlatform: Record<GrowthPlatform, GroupStats>;
          channels: ChannelRow[];
        };
        allTime: {
          users: number;
          byPlatform: Partial<Record<GrowthPlatform, number>>;
          evidenceCounts: Partial<Record<PlatformEvidence, number>>;
          selfReported: number;
          storeAttributed: number;
        };
      };
  paid?: { log: PaidLogRow[]; split: PaidOrganicSplit[] };
  historicalChannels?: HistoricalChannelRow[];
  revenue?: {
    month: Partial<Record<PurchaseStore, StoreSummary>>;
    allTime: Partial<Record<PurchaseStore, StoreSummary>>;
    note: string;
  };
  previousMonthUsers?: number | null;
};
type Growth = GrowthData & Insights;
type MetricsTab = "overview" | "channels" | "product" | "revenue" | "plan";
type PlatformFilter = "all" | GrowthPlatform;

const tabs: Array<{ value: MetricsTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "channels", label: "Channels" },
  { value: "product", label: "Product" },
  { value: "revenue", label: "Revenue" },
  { value: "plan", label: "Plan & log" },
];

function tabFromQuery(value: string | null): MetricsTab {
  // Older links used ?tab=acquisition for what is now Channels.
  if (value === "channels" || value === "acquisition") return "channels";
  if (value === "product" || value === "revenue" || value === "plan") return value;
  return "overview";
}

const platformColors: Record<GrowthPlatform, string> = {
  ios: "#7cc4ff",
  android: "#5fd08f",
  web: "#b997ff",
  unknown: "#46544b",
};
const osLabels: Record<SpendOs, string> = { ios: "iOS", android: "Android", web: "Web", mixed: "iOS + Android", unknown: "App not set" };

const postTypeMeta: Record<PostType, { label: string; color: string }> = {
  captures: { label: "Captures", color: "#59f176" },
  alignments: { label: "Alignments", color: "#57b8ff" },
  fusions: { label: "Fusions", color: "#b997ff" },
  challenges: { label: "Challenges", color: "#f6bd55" },
  trades: { label: "Trades", color: "#ff7f8f" },
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 10) / 10}%`;
}
function share(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
function moneyByCurrency(values: Record<string, number> | null | undefined) {
  const entries = Object.entries(values ?? {}).filter(([, amount]) => amount > 0);
  return entries.length ? entries.map(([currency, amount]) => formatMoney(amount, currency)).join(" · ") : "—";
}
function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
function PlatformBadge({ platform }: { platform: GrowthPlatform | SpendOs }) {
  const tone = platform === "ios" ? "ios" : platform === "android" ? "android" : platform === "web" ? "web" : "neutral";
  const label = platform in growthPlatformLabels ? growthPlatformLabels[platform as GrowthPlatform] : osLabels[platform as SpendOs];
  return <Badge tone={tone}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// Currency conversion (Wise rates, per amount date)
// ---------------------------------------------------------------------------

type FxState = { display: DisplayCurrency; rates: FxRates | null; referenceDate: string };
const FxContext = createContext<FxState>({ display: "USD", rates: null, referenceDate: new Date().toISOString().slice(0, 10) });
const CURRENCY_STORAGE_KEY = "animaldex.admin.metrics.currency";

function useFx() {
  const state = useContext(FxContext);
  const convert = (amount: number, currency: string, date?: string) =>
    convertAmount(amount, currency, date ?? state.referenceDate, state.display, state.rates);
  const text = (amount: number | null | undefined, currency: string | null | undefined, date?: string) => {
    if (amount == null || !currency) return "—";
    const converted = convert(amount, currency, date);
    return converted == null ? formatMoney(amount, currency) : formatMoney(converted, state.display);
  };
  /** One converted total, or the per-currency list when any rate is missing. */
  const total = (values: Record<string, number> | null | undefined, date?: string) => {
    const entries = Object.entries(values ?? {}).filter(([, amount]) => amount > 0);
    if (!entries.length) return "—";
    const converted = entries.map(([currency, amount]) => convert(amount, currency, date));
    if (converted.some((value) => value == null)) return moneyByCurrency(values);
    return formatMoney(converted.reduce<number>((sum, value) => sum + (value ?? 0), 0), state.display);
  };
  return { ...state, convert, text, total };
}

/** Converted amount with the original underneath, so nothing is hidden by the conversion. */
function Money({ amount, currency, date }: { amount: number | null | undefined; currency: string | null | undefined; date?: string }) {
  const fx = useFx();
  if (amount == null || !currency) return <>—</>;
  const converted = fx.convert(amount, currency, date);
  if (converted == null || currency.toUpperCase() === fx.display) return <>{formatMoney(amount, currency)}</>;
  return (
    <span title={`${formatMoney(amount, currency)} at the Wise rate for ${fxDate(date ?? fx.referenceDate)}`}>
      {formatMoney(converted, fx.display)}
      <span className="block text-[10px] font-normal text-ink-500">{formatMoney(amount, currency)}</span>
    </span>
  );
}

function MoneyTotal({ values, date }: { values: Record<string, number> | null | undefined; date?: string }) {
  return <>{useFx().total(values, date)}</>;
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

/** A chart ceiling of four equal, whole-number steps (e.g. 40 → ticks 0/10/20/30/40). */
function niceMax(value: number) {
  const rough = Math.max(1, value) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough) ?? magnitude * 10;
  return Math.max(4, Math.ceil(step) * 4);
}

function PlatformDailyChart({ rows, filter }: { rows: PlatformDailyRow[]; filter: PlatformFilter }) {
  const visible: GrowthPlatform[] = filter === "all" ? growthPlatforms : [filter];
  const totals = rows.map((row) => visible.reduce((sum, platform) => sum + row[platform], 0));
  const max = niceMax(Math.max(1, ...totals));
  const width = 900;
  const height = 240;
  const left = 34;
  const bottom = 24;
  const top = 8;
  const plot = height - bottom - top;
  const slot = (width - left) / Math.max(rows.length, 1);
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[560px]" role="img" aria-label="New users per day by platform">
        {ticks.map((tick) => {
          const y = top + plot - (tick / max) * plot;
          return (
            <g key={tick}>
              <line x1={left} x2={width} y1={y} y2={y} stroke="rgba(255,255,255,.07)" />
              <text x={left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#84958b">
                {Math.round(tick)}
              </text>
            </g>
          );
        })}
        {rows.map((row, index) => {
          let y = top + plot;
          return (
            <g key={row.date}>
              {visible.map((platform) => {
                const h = (row[platform] / max) * plot;
                y -= h;
                return h > 0 ? (
                  <rect key={platform} x={left + index * slot + slot * 0.18} y={y} width={Math.max(3, slot * 0.64)} height={h} fill={platformColors[platform]}>
                    <title>{`${row.date} · ${growthPlatformLabels[platform]} ${row[platform]}`}</title>
                  </rect>
                ) : null;
              })}
              {rows.length <= 16 || index % 2 === 0 ? (
                <text x={left + index * slot + slot / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="#84958b">
                  {Number(row.date.slice(8))}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PostTypeChart({ rows }: { rows: PostSeriesRow[] }) {
  const keys = Object.keys(postTypeMeta) as PostType[];
  const max = niceMax(Math.max(1, ...rows.map((row) => keys.reduce((sum, key) => sum + row[key], 0))));
  const slot = 900 / Math.max(rows.length, 1);
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 900 230" className="w-full min-w-[560px]" role="img" aria-label="Discover posts per day by type">
        {rows.map((row, index) => {
          let y = 200;
          return (
            <g key={row.date}>
              {keys.map((key) => {
                const h = (row[key] / max) * 190;
                y -= h;
                return <rect key={key} x={index * slot + slot * 0.16} y={y} width={Math.max(4, slot * 0.68)} height={h} fill={postTypeMeta[key].color} />;
              })}
              {rows.length <= 16 || index % 2 === 0 ? (
                <text x={index * slot + slot / 2} y="222" textAnchor="middle" fontSize="10" fill="#84958b">
                  {new Date(row.date).getUTCDate()}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Legend({ items }: { items: Array<{ label: string; color: string; value?: ReactNode }> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} aria-hidden="true" />
          {item.label}
          {item.value != null ? <span className="font-bold text-white tabular-nums">{item.value}</span> : null}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function AttributionPending() {
  return (
    <Card className="border-amber-300/30 bg-amber-400/[.05]">
      <CardContent className="text-sm text-amber-100">
        <p className="font-black text-white">Platform and channel data is not switched on yet</p>
        <p className="mt-1 text-xs leading-5 text-amber-100/80">
          Apply <code className="break-all rounded bg-black/30 px-1">supabase/migrations/20260915120000_growth_platform_attribution.sql</code>. Existing
          accounts are then split by device evidence straight away, and new signups are tagged once the iOS and Android updates ship.
        </p>
      </CardContent>
    </Card>
  );
}

function PaidOrganicCards({ split, log }: { split: PaidOrganicSplit[]; log: PaidLogRow[] }) {
  const fx = useFx();
  const unallocated = log.filter((row) => row.os !== "ios" && row.os !== "android");
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {split.map((item) => (
          <Card key={item.platform}>
            <CardContent>
              <div className="flex items-center justify-between gap-2">
                <PlatformBadge platform={item.platform} />
                <span className="text-xs text-ink-400">{format(item.signups)} new users</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/[.07]" aria-hidden="true">
                <div className="flex h-full">
                  <div style={{ width: `${100 - (item.organicShare ?? 100)}%`, background: "#f6bd55" }} />
                  <div style={{ width: `${item.organicShare ?? 0}%`, background: platformColors[item.platform] }} />
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-ink-500">Paid (ad platform installs)</dt>
                  <dd className="font-display text-xl text-white tabular-nums">{format(item.paidEstimate)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-ink-500">
                    Organic, at least
                    <InfoTip>Signups minus installs the ad platforms reported. It assumes every paid install signed up, so the real organic number can only be higher.</InfoTip>
                  </dt>
                  <dd className="font-display text-xl text-white tabular-nums">
                    {format(item.organicFloor)} <span className="text-sm text-ink-400">{pct(item.organicShare)}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-500">Spend</dt>
                  <dd className="text-ink-200"><MoneyTotal values={item.spendByCurrency} /></dd>
                </div>
                <div>
                  <dt className="text-ink-500">Cost per paid signup</dt>
                  <dd className="text-ink-200"><MoneyTotal values={item.costPerPaidSignupByCurrency} /></dd>
                </div>
              </dl>
              {item.reportedInstalls === 0 && Object.keys(item.spendByCurrency).length ? (
                <p className="mt-2 text-[11px] text-amber-200">Spend logged without installs. Add the installs to see cost per signup.</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      {unallocated.length ? (
        <p className="text-xs text-ink-400">
          Not split by app: {unallocated.map((row) => `${paidNetworkLabels[row.network] ?? row.network} (${osLabels[row.os]}) ${fx.text(row.spend, row.currencyCode)}`).join(" · ")}. Set the app on those log rows to include them.
        </p>
      ) : null}
    </div>
  );
}

function ChannelTable({ channels, filter, limit }: { channels: ChannelRow[]; filter: PlatformFilter; limit?: number }) {
  const rows = channels.filter((row) => filter === "all" || row.platform === filter).slice(0, limit ?? Infinity);
  if (!rows.length) return <p className="px-4 pb-4 text-sm text-ink-400">No users for this filter yet.</p>;
  return (
    <Table minWidth={760}>
      <thead>
        <tr>
          <TH>Channel</TH>
          <TH>Platform</TH>
          <TH numeric>Users</TH>
          <TH numeric>Activated</TH>
          <TH numeric>D7</TH>
          <TH numeric>Payers</TH>
          <TH numeric>Cost / user</TH>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.key}-${row.platform}`} className="hover:bg-white/[.02]">
            <TD>
              <span className="font-bold text-white">{row.label}</span>{" "}
              {row.kind === "paid" ? <Badge tone="warn">Paid</Badge> : row.kind === "organic" ? <Badge tone="good">Organic</Badge> : null}
              {row.evidence === "self_reported" ? (
                <span className="ml-1 text-[11px] text-ink-500">said in app</span>
              ) : row.evidence === "store" ? (
                <span className="ml-1 text-[11px] text-ink-500">store verified</span>
              ) : null}
            </TD>
            <TD>
              <PlatformBadge platform={row.platform} />
            </TD>
            <TD numeric className="font-bold text-white">
              {format(row.users)}
            </TD>
            <TD numeric title={`${row.activationEligible} users old enough to count`}>
              {pct(row.activationRate)}
            </TD>
            <TD numeric title={`${row.d7Eligible} activated users old enough to count`}>
              {pct(row.d7Rate)}
            </TD>
            <TD numeric>{format(row.payers)}</TD>
            <TD numeric><MoneyTotal values={row.costPerUser} /></TD>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function PaidLogTable({ rows }: { rows: PaidLogRow[] }) {
  const fx = useFx();
  const converted = rows.map((row) => ({
    spend: fx.convert(row.spend, row.currencyCode),
    installSpend: row.costPerInstall != null && row.installs > 0 ? fx.convert(row.costPerInstall * row.installs, row.currencyCode) : null,
    installs: row.costPerInstall != null ? row.installs : 0,
  }));
  const allConverted = converted.every((row) => row.spend != null);
  const totalSpend = converted.reduce((sum, row) => sum + (row.spend ?? 0), 0);
  const totalInstalls = converted.reduce((sum, row) => sum + row.installs, 0);
  const installSpend = converted.reduce((sum, row) => sum + (row.installSpend ?? 0), 0);
  if (!rows.length) return <p className="px-4 pb-4 text-sm text-ink-400">No spend or installs logged this month.</p>;
  return (
    <Table minWidth={640}>
      <thead>
        <tr>
          <TH>Network</TH>
          <TH>App</TH>
          <TH numeric>Spend</TH>
          <TH numeric>Installs</TH>
          <TH numeric>Cost / install</TH>
          <TH numeric>Days logged</TH>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.network}-${row.os}-${row.currencyCode}`}>
            <TD className="font-bold text-white">{paidNetworkLabels[row.network] ?? row.network}</TD>
            <TD>
              <PlatformBadge platform={row.os} />
            </TD>
            <TD numeric>
              <Money amount={row.spend} currency={row.currencyCode} />
            </TD>
            <TD numeric>{row.daysWithInstalls ? format(row.installs) : "—"}</TD>
            <TD numeric>
              <Money amount={row.costPerInstall} currency={row.currencyCode} />
            </TD>
            <TD numeric>{row.daysLogged}</TD>
          </tr>
        ))}
      </tbody>
      {rows.length > 1 && allConverted ? (
        <tfoot>
          <tr className="font-bold text-white">
            <TD colSpan={2}>Total ({fx.display})</TD>
            <TD numeric className="text-white">{formatMoney(totalSpend, fx.display)}</TD>
            <TD numeric className="text-white">{totalInstalls ? format(totalInstalls) : "—"}</TD>
            <TD numeric className="text-white">{totalInstalls ? formatMoney(installSpend / totalInstalls, fx.display) : "—"}</TD>
            <TD />
          </tr>
        </tfoot>
      ) : null}
    </Table>
  );
}

function HistoricalTable({ rows }: { rows: HistoricalChannelRow[] }) {
  const fx = useFx();
  const paid = rows.filter((row) => row.spend != null && row.currency);
  const paidConverted = paid.map((row) => ({ row, spend: fx.convert(row.spend ?? 0, row.currency ?? "", row.periodEnd) }));
  const allConverted = paidConverted.every((item) => item.spend != null);
  const totalSpend = paidConverted.reduce((sum, item) => sum + (item.spend ?? 0), 0);
  const withInstalls = paidConverted.filter((item) => (item.row.installs ?? 0) > 0);
  const totalInstalls = withInstalls.reduce((sum, item) => sum + (item.row.installs ?? 0), 0);
  const installSpend = withInstalls.reduce((sum, item) => sum + (item.spend ?? 0), 0);
  if (!rows.length) return <p className="px-4 pb-4 text-sm text-ink-400">No imported channel reports yet.</p>;
  return (
    <Table minWidth={860}>
      <thead>
        <tr>
          <TH>Source</TH>
          <TH>App</TH>
          <TH>Period</TH>
          <TH numeric>Spend</TH>
          <TH numeric>Installs</TH>
          <TH numeric>Cost / install</TH>
          <TH numeric>Clicks</TH>
          <TH numeric>Impr. / views</TH>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.source}-${row.periodStart}-${row.periodEnd}`}>
            <TD>
              <span className="font-bold text-white">{row.label}</span>{" "}
              {row.kind === "paid" ? <Badge tone="warn">Paid</Badge> : <Badge tone="good">Organic</Badge>}
            </TD>
            <TD>
              <PlatformBadge platform={row.os} />
            </TD>
            <TD className="whitespace-nowrap">
              {dateLabel(row.periodStart)} – {dateLabel(row.periodEnd)}
            </TD>
            <TD numeric>
              <Money amount={row.spend} currency={row.currency} date={row.periodEnd} />
            </TD>
            <TD numeric>{format(row.installs)}</TD>
            <TD numeric>
              <Money amount={row.costPerInstall} currency={row.currency} date={row.periodEnd} />
            </TD>
            <TD numeric>{format(row.clicks)}</TD>
            <TD numeric>{format(row.impressions ?? row.views)}</TD>
          </tr>
        ))}
      </tbody>
      {paid.length > 1 && allConverted ? (
        <tfoot>
          <tr className="font-bold text-white">
            <TD colSpan={3}>
              Paid total ({fx.display})
              <span className="block text-[10px] font-normal text-ink-500">Each report converted at the rate on its end date</span>
            </TD>
            <TD numeric className="text-white">{formatMoney(totalSpend, fx.display)}</TD>
            <TD numeric className="text-white">{totalInstalls ? format(totalInstalls) : "—"}</TD>
            <TD numeric className="text-white">{totalInstalls ? formatMoney(installSpend / totalInstalls, fx.display) : "—"}</TD>
            <TD />
            <TD />
          </tr>
        </tfoot>
      ) : null}
    </Table>
  );
}

function StoreTable({ revenue }: { revenue: NonNullable<Insights["revenue"]> }) {
  const stores: PurchaseStore[] = ["app_store", "google_play", "web", "unknown", "test"];
  return (
    <Table minWidth={700}>
      <thead>
        <tr>
          <TH>Store</TH>
          <TH numeric>Purchases</TH>
          <TH numeric>Pro</TH>
          <TH numeric>Credits</TH>
          <TH numeric>Buyers</TH>
          <TH numeric>Est. revenue</TH>
          <TH numeric>All-time purchases</TH>
        </tr>
      </thead>
      <tbody>
        {stores
          .filter((store) => revenue.month[store] || revenue.allTime[store] || store === "google_play")
          .map((store) => {
            const month = revenue.month[store];
            const allTime = revenue.allTime[store];
            return (
              <tr key={store}>
                <TD className="font-bold text-white">
                  {purchaseStoreLabels[store]}
                  {store === "google_play" && !allTime ? (
                    <span className="ml-2">
                      <Badge tone="bad">Never recorded</Badge>
                    </span>
                  ) : null}
                </TD>
                <TD numeric>{format(month?.purchases ?? 0)}</TD>
                <TD numeric>{format(month?.pro ?? 0)}</TD>
                <TD numeric>{format(month?.credits ?? 0)}</TD>
                <TD numeric>{format(month?.buyers ?? 0)}</TD>
                <TD numeric>{store === "test" ? "—" : <Money amount={month?.estimatedUsd ?? 0} currency="USD" />}</TD>
                <TD numeric>{format(allTime?.purchases ?? 0)}</TD>
              </tr>
            );
          })}
      </tbody>
    </Table>
  );
}

function CollectorDepth({ data }: { data: NonNullable<GrowthData["collectorAnalytics"]> }) {
  const max = Math.max(1, ...data.depth.map((row) => row.users));
  return (
    <Card>
      <CardHeader title="Collector depth" description="How many qualifying captures each collector made this month." />
      <CardContent className="space-y-2.5">
        {data.depth.map((row) => (
          <div key={row.label} className="grid grid-cols-[84px_1fr_92px] items-center gap-3">
            <p className="text-xs font-black text-white">
              {row.label} {row.label === "1" ? "capture" : "captures"}
            </p>
            <div className="h-4 overflow-hidden rounded bg-white/[.06]">
              <div className="h-full rounded bg-primary-400/80" style={{ width: `${(row.users / max) * 100}%` }} />
            </div>
            <p className="text-right text-xs text-ink-300 tabular-nums">
              {format(row.users)} · {row.percent}%
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CaptureRetention({ data }: { data: NonNullable<GrowthData["collectorAnalytics"]> }) {
  const rows = data.retention.slice(-8);
  return (
    <Card>
      <CardHeader title="Capture retention by activation day" description="Share of each day's new collectors who captured again on day N. Blank cells are too recent to count." />
      {rows.length ? (
        <Table minWidth={700}>
          <thead>
            <tr>
              <TH>Cohort</TH>
              <TH numeric>Collectors</TH>
              {Array.from({ length: 8 }, (_, day) => (
                <TH key={day} numeric>
                  D{day}
                </TH>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cohort}>
                <TD className="font-bold text-white">{row.cohort.slice(5)}</TD>
                <TD numeric>{row.size}</TD>
                {row.days.map((value, day) => (
                  <TD key={day} numeric className="p-1">
                    <span
                      className={`block rounded px-2 py-1.5 ${value == null ? "text-ink-600" : "text-white"}`}
                      style={value == null ? undefined : { backgroundColor: `rgba(89,241,118,${Math.max(0.08, (value / 100) * 0.75)})` }}
                    >
                      {value == null ? "—" : `${value}%`}
                    </span>
                  </TD>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <CardContent className="text-sm text-ink-400">Not enough activated collectors yet.</CardContent>
      )}
    </Card>
  );
}

function SocialAccounts({
  social,
  lastSyncedAt,
  syncing,
  onSync,
  organicViews,
  issues,
}: {
  social: SocialMetric[];
  lastSyncedAt: string | null;
  syncing: boolean;
  onSync: () => void;
  organicViews: Array<{ platform: string; views: number; posts: number }>;
  issues: string[];
}) {
  const configured = social.filter((item) => item.configured);
  return (
    <Card>
      <CardHeader
        title="Organic social"
        description={`Views and posts from the daily log this month: posts shared from Story videos and views from connected accounts are recorded automatically. Account totals synced ${lastSyncedAt ? new Date(lastSyncedAt).toLocaleString("en") : "never"}.`}
        action={
          configured.length ? (
            <Button size="sm" onClick={onSync} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync accounts"}
            </Button>
          ) : null
        }
      />
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-7">
          {organicViews.map((item) => (
            <div key={item.platform} className="rounded-lg border border-line-300 bg-canvas-900 p-3">
              <p className="text-[11px] text-ink-500">{item.platform}</p>
              <p className="font-display text-xl text-white tabular-nums">{format(item.views)}</p>
              <p className="text-[11px] text-ink-500">{format(item.posts)} posts</p>
            </div>
          ))}
        </div>
        {configured.length ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {configured.map((item) => (
              <div key={item.platform} className="rounded-lg border border-line-300 p-3">
                <p className="text-[11px] text-ink-500">{item.platform} followers</p>
                <p className="font-display text-xl text-white tabular-nums">{format(item.followers)}</p>
                {item.followerChange != null ? (
                  <p className={`text-[11px] tabular-nums ${item.followerChange >= 0 ? "text-primary-200" : "text-red-300"}`}>
                    {item.followerChange >= 0 ? "+" : ""}
                    {format(item.followerChange)} since previous sync
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-500">No social API keys or Story videos logins, so follower counts aren&apos;t synced.</p>
        )}
        {issues.length ? (
          <ul className="space-y-1 text-[11px] text-amber-200/80">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminMetricsDashboard() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const urlTab = tabFromQuery(requestedTab);
  const urlMonth = parseGrowthMonth(searchParams.get("month"));
  // The visible tab is local state. Next 13.4 ignores router.push when only the
  // query string changes, so a click that only wrote ?tab= never re-rendered.
  const [tab, setTab] = useState<MetricsTab>(urlTab);
  const [growthMonth, setGrowthMonth] = useState(urlMonth);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("USD");
  const [fx, setFx] = useState<FxRates | null>(null);
  const [fxError, setFxError] = useState<string | null>(null);
  const [data, setData] = useState<Metrics | null>(null);
  const [growth, setGrowth] = useState<Growth | null>(null);
  const [social, setSocial] = useState<SocialMetric[]>([]);
  const [socialSyncedAt, setSocialSyncedAt] = useState<string | null>(null);
  const [socialSyncing, setSocialSyncing] = useState(false);
  const [socialSyncIssues, setSocialSyncIssues] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRequestId = useRef(0);
  const monthName = monthLabel(growthMonth);
  const monthState = growthMonthState(growthMonth);

  useEffect(() => {
    // Follow the address bar. A tab click writes it directly, because Next 13.4
    // leaves useSearchParams on the previous query for same-page navigations.
    const live = new URLSearchParams(window.location.search);
    setTab(tabFromQuery(live.get("tab")));
    setGrowthMonth(parseGrowthMonth(live.get("month")));
  }, [urlTab, urlMonth]);

  useEffect(() => {
    function syncFromHistory() {
      const params = new URLSearchParams(window.location.search);
      setTab(tabFromQuery(params.get("tab")));
      setGrowthMonth(parseGrowthMonth(params.get("month")));
    }
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  function navigate(next: { tab?: MetricsTab; month?: string }) {
    const nextTab = next.tab ?? tab;
    const nextMonth = next.month ? parseGrowthMonth(next.month) : growthMonth;
    setTab(nextTab);
    setGrowthMonth(nextMonth);
    const params = new URLSearchParams(window.location.search);
    if (nextTab === "overview") params.delete("tab");
    else params.set("tab", nextTab);
    params.set("month", nextMonth);
    const url = `/admin/metrics?${params.toString()}`;
    const historyState = window.history.state;
    window.history.pushState(historyState ? { ...historyState } : historyState, "", url);
  }

  const loadGrowth = useCallback(async (month: string) => {
    const response = await fetch(`/api/admin/growth?month=${month}`, { cache: "no-store" });
    if (response.status === 401) {
      setAuthorized(false);
      return;
    }
    const body = await response.json();
    if (response.ok && body.ok) setGrowth(body);
    else throw new Error(body.error || "Unable to load growth data");
  }, []);

  const load = useCallback(
    async (month: string) => {
      const requestId = ++loadRequestId.current;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/metrics?month=${month}`, { cache: "no-store" });
        if (response.status === 401) {
          setAuthorized(false);
          return;
        }
        const body = await response.json();
        if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load metrics");
        if (requestId !== loadRequestId.current) return;
        setData(body);
        setAuthorized(true);
        await loadGrowth(month);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load metrics");
      } finally {
        if (requestId === loadRequestId.current) setLoading(false);
      }
    },
    [loadGrowth],
  );

  const syncSocial = useCallback(async (force: boolean) => {
    if (force) setSocialSyncing(true);
    try {
      const response = await fetch("/api/admin/social-metrics", { method: force ? "POST" : "GET", cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.ok) return;
      setSocial(body.metrics ?? []);
      setSocialSyncedAt(body.lastSyncedAt ?? null);
      if (force) setSocialSyncIssues([...(body.errors ?? []), ...(body.notes ?? [])]);
      // Sync from the providers at most once a day without being asked.
      const stale = !body.lastSyncedAt || Date.now() - Date.parse(body.lastSyncedAt) > 24 * 60 * 60 * 1000;
      if (!force && stale && (body.metrics ?? []).some((item: SocialMetric) => item.configured)) {
        void syncSocial(true);
      }
    } finally {
      if (force) setSocialSyncing(false);
    }
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/support/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = await response.json();
    if (!response.ok || !body.ok) {
      setError(body.error || "Unable to sign in");
      return;
    }
    setPassword("");
    await load(growthMonth);
    await syncSocial(false);
  }

  useEffect(() => {
    void load(growthMonth);
  }, [growthMonth, load]);
  useEffect(() => {
    void syncSocial(false);
  }, [syncSocial]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (isDisplayCurrency(saved)) setDisplayCurrency(saved);
    } catch {
      // Storage can be unavailable; USD stays the default.
    }
  }, []);

  function chooseCurrency(next: DisplayCurrency) {
    setDisplayCurrency(next);
    try {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, next);
    } catch {
      // Not persisted this time.
    }
  }

  // Month totals convert at month end (or today for the current month);
  // imported reports at the end of their own period.
  const referenceDate = fxDate(`${growthMonth}-${String(daysInMonth(growthMonth)).padStart(2, "0")}`);

  useEffect(() => {
    if (!growth) return undefined;
    const pairs = new Set<string>();
    const add = (currency: string | null | undefined, date: string) => {
      if (currency && currency.toUpperCase() !== displayCurrency) pairs.add(fxKey(currency, fxDate(date)));
    };
    for (const row of growth.historicalChannels ?? []) add(row.currency, row.periodEnd);
    for (const row of growth.paid?.log ?? []) add(row.currencyCode, referenceDate);
    for (const item of growth.paid?.split ?? []) for (const currency of Object.keys(item.spendByCurrency)) add(currency, referenceDate);
    if (growth.attribution?.available) {
      for (const channel of growth.attribution.month.channels) for (const currency of Object.keys(channel.costPerUser ?? {})) add(currency, referenceDate);
    }
    add("USD", referenceDate);
    if (!pairs.size) {
      setFx({ base: displayCurrency, rates: {}, failed: [], provider: "Wise", fetchedAt: new Date().toISOString() });
      return undefined;
    }
    let cancelled = false;
    void fetch(`/api/admin/fx?base=${displayCurrency}&q=${encodeURIComponent(Array.from(pairs).join(","))}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        if (response.ok && body?.ok) {
          setFx(body as FxRates);
          setFxError(body.failed?.length ? `No Wise rate for ${body.failed.join(", ")}; those amounts stay in their original currency.` : null);
        } else {
          setFx(null);
          setFxError(body?.error ?? "Exchange rates are unavailable; amounts stay in their original currencies.");
        }
      })
      .catch(() => {
        if (!cancelled) setFxError("Exchange rates are unavailable; amounts stay in their original currencies.");
      });
    return () => {
      cancelled = true;
    };
  }, [growth, displayCurrency, referenceDate]);

  if (authorized === false) {
    return (
      <main className="grid min-h-[70vh] place-items-center px-4">
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-line-300 bg-surface-900 p-6">
          <p className="text-xs font-black uppercase tracking-[.2em] text-primary-200">AnimalDex admin</p>
          <h1 className="mt-2 font-display text-3xl text-white">Metrics</h1>
          <label htmlFor="admin-metrics-password" className="sr-only">
            Admin password
          </label>
          <input
            id="admin-metrics-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="mt-6 w-full rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-white outline-none focus:border-primary-300"
          />
          <button className="mt-3 w-full rounded-xl bg-primary-400 py-3 font-black text-canvas-950">Sign in</button>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </form>
      </main>
    );
  }

  const attribution = growth?.attribution;
  const attributionMonth = attribution?.available ? attribution.month : null;
  const collector = growth?.collectorAnalytics;
  const monthUsers = data?.kpis.users.value ?? growth?.actuals?.users ?? 0;
  const knownUsers = attributionMonth ? attributionMonth.users - (attributionMonth.signupsByPlatform.unknown ?? 0) : 0;
  const knownShare = attributionMonth ? share(knownUsers, attributionMonth.users) : 0;
  const filteredStats = attributionMonth && platformFilter !== "all" ? attributionMonth.byPlatform[platformFilter] : null;
  const monthPurchases = Object.entries(growth?.revenue?.month ?? {}).filter(([store]) => store !== "test");
  const purchaseCount = monthPurchases.reduce((sum, [, summary]) => sum + (summary?.purchases ?? 0), 0);
  const purchaseUsd = monthPurchases.reduce((sum, [, summary]) => sum + (summary?.estimatedUsd ?? 0), 0);
  const organicViews = [...organicPlatforms].map((platform) => {
    const entries = (growth?.daily ?? []).flatMap((row) => row.organicEntries ?? []).filter((entry) => entry.platform === platform);
    return {
      platform: organicPlatformLabels[platform],
      views: entries.reduce((sum, entry) => sum + entry.views, 0),
      posts: entries.reduce((sum, entry) => sum + entry.posts, 0),
    };
  });

  const attention: string[] = [
    ...(growth?.funnel?.needsAttention ?? []),
    attribution && !attribution.available ? "Apply the platform attribution migration to split users by platform and channel." : null,
    attributionMonth && attributionMonth.users > 0 && knownShare < 60
      ? `${100 - knownShare}% of this month's users have no platform signal yet. The next iOS and Android releases fix this for new signups.`
      : null,
    (growth?.paid?.log ?? []).some((row) => row.os === "unknown")
      ? "Some ad spend rows have no app set, so they're left out of the Android vs iOS split."
      : null,
    growth?.revenue && !growth.revenue.allTime.google_play
      ? "No Google Play purchase has ever reached the backend. Check the Android purchase sync."
      : null,
  ].filter((item): item is string => Boolean(item));

  const upcoming = monthState === "upcoming";
  const fxText = (amount: number, currency: string) => {
    const converted = convertAmount(amount, currency, referenceDate, displayCurrency, fx);
    return converted == null ? formatMoney(amount, currency) : formatMoney(converted, displayCurrency);
  };

  return (
    <FxContext.Provider value={{ display: displayCurrency, rates: fx, referenceDate }}>
      <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-line-300 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">Growth</p>
              <h1 className="font-display text-3xl text-white sm:text-4xl">{monthName}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => navigate({ month: shiftMonth(growthMonth, -1) })} aria-label={`Show ${monthLabel(shiftMonth(growthMonth, -1))}`}>
                ←
              </Button>
              <Badge tone={monthState === "current" ? "good" : monthState === "upcoming" ? "warn" : "neutral"}>{monthState}</Badge>
              <Button size="sm" onClick={() => navigate({ month: shiftMonth(growthMonth, 1) })} aria-label={`Show ${monthLabel(shiftMonth(growthMonth, 1))}`}>
                →
              </Button>
              {loading && data ? <span className="text-xs text-ink-400" role="status">Loading…</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented label="Metrics section" value={tab} options={tabs} onChange={(value) => navigate({ tab: value })} />
            {tab !== "plan" && tab !== "revenue" ? (
              <Segmented
                label="Platform filter"
                value={platformFilter}
                onChange={setPlatformFilter}
                options={[
                  { value: "all" as PlatformFilter, label: "All" },
                  ...growthPlatforms.map((platform) => ({
                    value: platform as PlatformFilter,
                    label: growthPlatformLabels[platform],
                    count: attributionMonth ? attributionMonth.signupsByPlatform[platform] : null,
                  })),
                ]}
              />
            ) : null}
            {tab !== "plan" && tab !== "product" ? (
              <Segmented
                label="Currency"
                value={displayCurrency}
                onChange={chooseCurrency}
                options={displayCurrencies.map((currency) => ({ value: currency, label: currency }))}
              />
            ) : null}
          </div>
          {fxError && tab !== "plan" && tab !== "product" ? <p className="text-xs text-amber-200">{fxError}</p> : null}
        </header>

        {error ? <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
        {loading && !data ? <div className="py-20 text-center text-ink-400">Loading growth data…</div> : null}

        <div className={`mt-5 space-y-4 transition-opacity ${loading && data ? "opacity-60" : ""}`}>
          {data && tab === "overview" ? (
            upcoming ? (
              <Card>
                <CardContent className="text-sm text-ink-400">{monthName} hasn&apos;t started. Targets for it are on the Plan &amp; log tab.</CardContent>
              </Card>
            ) : (
              <>
                {attribution && !attribution.available ? <AttributionPending /> : null}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Stat
                    label="New users"
                    value={format(filteredStats ? filteredStats.users : monthUsers)}
                    hint={
                      platformFilter !== "all"
                        ? `${growthPlatformLabels[platformFilter]} of ${format(monthUsers)} total`
                        : growth?.previousMonthUsers != null
                          ? `${monthLabel(shiftMonth(growthMonth, -1))}: ${format(growth.previousMonthUsers)}`
                          : undefined
                    }
                    info="Profiles created this month (Asia/Jakarta calendar)."
                  />
                  <Stat
                    label="Activated"
                    value={pct(filteredStats ? filteredStats.activationRate : collector?.activation.rate)}
                    hint={`Captured within 24h of signup · ${format(filteredStats ? filteredStats.activationEligible : collector?.activation.eligible ?? null)} users old enough to count`}
                  />
                  <Stat
                    label="Captured again, days 6–8"
                    value={pct(filteredStats ? filteredStats.d7Rate : collector?.d7.rate)}
                    hint={`D7 capture retention · ${format(filteredStats ? filteredStats.d7Eligible : collector?.d7.eligible ?? null)} activated users old enough`}
                  />
                  <Stat
                    label="Purchases"
                    value={format(purchaseCount)}
                    hint={`≈ ${fxText(purchaseUsd, "USD")} at list price · excludes test purchases`}
                  />
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                  <Card>
                    <CardHeader
                      title="New users per day"
                      description={
                        attributionMonth
                          ? `${knownShare}% have a known platform · ${format(attributionMonth.reportedAtSignup)} reported by the app at signup, the rest inferred from device evidence.`
                          : "Split by platform appears once the attribution migration is applied."
                      }
                    />
                    <CardContent className="space-y-3">
                      {attributionMonth ? (
                        <>
                          <PlatformDailyChart rows={attributionMonth.platformDaily} filter={platformFilter} />
                          <Legend
                            items={growthPlatforms.map((platform) => ({
                              label: growthPlatformLabels[platform],
                              color: platformColors[platform],
                              value: format(attributionMonth.signupsByPlatform[platform]),
                            }))}
                          />
                        </>
                      ) : (
                        <PlatformDailyChart
                          rows={(growth?.daily ?? []).map((row) => ({ date: row.date, ios: 0, android: 0, web: 0, unknown: row.users }))}
                          filter="all"
                        />
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader title="Needs attention" />
                    <CardContent>
                      {attention.length ? (
                        <ul className="space-y-2.5 text-sm text-ink-200">
                          {attention.slice(0, 6).map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" aria-hidden="true" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-ink-400">Nothing flagged for {monthName}.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {growth?.paid?.split.length ? (
                  <section className="space-y-2">
                    <h2 className="font-display text-lg text-white">Paid vs organic</h2>
                    <PaidOrganicCards split={growth.paid.split} log={growth.paid.log} />
                  </section>
                ) : null}

                {attributionMonth ? (
                  <Card>
                    <CardHeader
                      title="Top channels"
                      description="Where this month's users came from, ranked by users. Activation and D7 show which channels bring collectors who stay."
                      action={
                        <Button size="sm" variant="ghost" onClick={() => navigate({ tab: "channels" })}>
                          All channels →
                        </Button>
                      }
                    />
                    <ChannelTable channels={attributionMonth.channels} filter={platformFilter} limit={6} />
                  </Card>
                ) : null}
              </>
            )
          ) : null}

          {data && tab === "channels" ? (
            <>
              {attribution && !attribution.available ? <AttributionPending /> : null}
              {!upcoming && growth?.paid?.split.length ? (
                <section className="space-y-2">
                  <div>
                    <h2 className="font-display text-lg text-white">Paid vs organic by platform</h2>
                    <p className="text-xs text-ink-400">Signups on each platform against installs the ad platforms reported in the daily log.</p>
                  </div>
                  <PaidOrganicCards split={growth.paid.split} log={growth.paid.log} />
                </section>
              ) : null}

              {attributionMonth ? (
                <Card>
                  <CardHeader
                    title="Where users came from"
                    description={`${format(attributionMonth.storeAttributed)} store-verified · ${format(attributionMonth.selfReported)} answered "Where did you hear about AnimalDex?" · ${format(
                      attributionMonth.users - attributionMonth.storeAttributed - attributionMonth.selfReported,
                    )} not attributed yet. People who saw an ad may still answer "TikTok" or "Instagram".`}
                  />
                  <ChannelTable channels={attributionMonth.channels} filter={platformFilter} />
                </Card>
              ) : null}

              <Card>
                <CardHeader
                  title={`Paid log · ${monthName}`}
                  description="Spend and platform-reported installs from Plan & log, by network and app."
                  action={
                    <Button size="sm" variant="primary" onClick={() => navigate({ tab: "plan" })}>
                      Log spend
                    </Button>
                  }
                />
                <PaidLogTable rows={growth?.paid?.log ?? []} />
              </Card>

              <Card>
                <CardHeader
                  title="Imported channel reports · all time"
                  description="Every report imported from ad and search platforms, whatever month it covers. Periods are shown as reported, not spread across days."
                />
                <HistoricalTable rows={growth?.historicalChannels ?? []} />
              </Card>

              <SocialAccounts social={social} lastSyncedAt={socialSyncedAt} syncing={socialSyncing} onSync={() => void syncSocial(true)} organicViews={organicViews} issues={[...socialSyncIssues, ...(growth?.socialAutoLogNotes ?? [])]} />

              {attribution?.available ? (
                <Card>
                  <CardHeader title="Platform signal, all accounts" description="How each account's platform is known. App reports replace inferences as people update." />
                  <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {(Object.keys(platformEvidenceLabels) as PlatformEvidence[]).map((evidence) => (
                      <div key={evidence} className="rounded-lg border border-line-300 p-3">
                        <p className="text-[11px] text-ink-500">{platformEvidenceLabels[evidence]}</p>
                        <p className="font-display text-xl text-white tabular-nums">{format(attribution.allTime.evidenceCounts[evidence] ?? 0)}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : null}

          {data && tab === "product" ? (
            upcoming ? (
              <Card>
                <CardContent className="text-sm text-ink-400">{monthName} hasn&apos;t started.</CardContent>
              </Card>
            ) : (
              <>
                {attributionMonth ? (
                  <Card>
                    <CardHeader title="Collector quality by platform" description="Users who signed up this month, split by platform." />
                    <Table minWidth={640}>
                      <thead>
                        <tr>
                          <TH>Platform</TH>
                          <TH numeric>Users</TH>
                          <TH numeric>Activated</TH>
                          <TH numeric>D7</TH>
                          <TH numeric>Captures / collector</TH>
                          <TH numeric>Payers</TH>
                        </tr>
                      </thead>
                      <tbody>
                        {growthPlatforms
                          .filter((platform) => platformFilter === "all" || platform === platformFilter)
                          .map((platform) => {
                            const stats = attributionMonth.byPlatform[platform];
                            return (
                              <tr key={platform}>
                                <TD>
                                  <PlatformBadge platform={platform} />
                                </TD>
                                <TD numeric className="font-bold text-white">
                                  {format(stats.users)}
                                </TD>
                                <TD numeric>{pct(stats.activationRate)}</TD>
                                <TD numeric>{pct(stats.d7Rate)}</TD>
                                <TD numeric>{stats.capturesPerCollector?.toFixed(1) ?? "—"}</TD>
                                <TD numeric>{format(stats.payers)}</TD>
                              </tr>
                            );
                          })}
                      </tbody>
                    </Table>
                  </Card>
                ) : null}
                {collector ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <Stat label="Activated" value={pct(collector.activation.rate)} hint={`${format(collector.activation.users)} of ${format(collector.activation.eligible)} users captured within 24h`} />
                      <Stat label="Repeat collectors" value={pct(collector.repeat.rate)} hint={`${format(collector.repeat.users)} of ${format(collector.repeat.activated)} activated captured again`} />
                      <Stat label="D1 capture retention" value={pct(collector.d1.rate)} hint={`${format(collector.d1.users)} of ${format(collector.d1.eligible)} captured again 24–48h later`} />
                      <Stat label="D7 capture retention" value={pct(collector.d7.rate)} hint={`${format(collector.d7.users)} of ${format(collector.d7.eligible)} captured again on days 6–8`} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <Stat label="Qualifying captures" value={format(collector.summary.captures)} />
                      <Stat label="Unique collectors" value={format(collector.summary.collectors)} />
                      <Stat label="Captures per collector" value={collector.summary.capturesPerCollector?.toFixed(1) ?? "—"} />
                      <Stat label="Median captures" value={collector.summary.medianCaptures?.toFixed(1).replace(".0", "") ?? "—"} />
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      <CollectorDepth data={collector} />
                      <CaptureRetention data={collector} />
                    </div>
                  </>
                ) : null}
                <Card>
                  <CardHeader title="Discover activity" description={`${format(data.postActivity.total)} posts in ${monthName}.`} />
                  <CardContent className="space-y-3">
                    <PostTypeChart rows={data.postActivity.series} />
                    <Legend
                      items={(Object.keys(postTypeMeta) as PostType[]).map((key) => ({
                        label: postTypeMeta[key].label,
                        color: postTypeMeta[key].color,
                        value: format(data.postActivity.types[key].value),
                      }))}
                    />
                  </CardContent>
                </Card>
              </>
            )
          ) : null}

          {data && tab === "revenue" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Purchases" value={format(purchaseCount)} hint="All stores, excluding test purchases" />
                <Stat label="Estimated revenue" value={fxText(purchaseUsd, "USD")} info={growth?.revenue?.note} />
                <Stat label="First-time purchasers" value={format(growth?.funnel?.firstTimePurchasers ?? null)} hint={`First production purchase happened in ${monthName}`} />
                <Stat
                  label="Signup-to-payer conversion"
                  value={pct(growth?.funnel?.payerConversionRate)}
                  hint={`${format(growth?.funnel?.cohortFirstTimePurchasers ?? null)} of ${format(monthUsers)} ${monthName} signups have paid`}
                />
              </div>
              {growth?.revenue ? (
                <Card>
                  <CardHeader
                    title="Purchases by store"
                    description={growth.revenue.note}
                    action={
                      <Link href="/admin/users" className="text-xs font-black text-primary-100 hover:text-primary-200">
                        Users & LTV →
                      </Link>
                    }
                  />
                  <StoreTable revenue={growth.revenue} />
                </Card>
              ) : null}
              {growth?.payingProDefinition ? <p className="text-xs text-ink-500">Active Pro: {growth.payingProDefinition}</p> : null}
            </>
          ) : null}

          {data && tab === "plan" ? <GrowthCommandCenter growth={growth} month={growthMonth} reload={() => loadGrowth(growthMonth)} /> : null}
        </div>
      </main>
    </FxContext.Provider>
  );
}
