"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createContext, FormEvent, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AdminPage,
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  InfoTip,
  PageHeader,
  RefreshButton,
  Section,
  Segmented,
  Skeleton,
  Stat,
  StatGrid,
  StatGridSkeleton,
  TD,
  TH,
  Table,
  TableSkeleton,
  cn,
  fieldClass,
} from "@/components/admin/ui";
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
import { errorFromBody, fetchJson } from "@/lib/admin-fetch-json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Metrics = {
  month: string;
  kpis: Record<"users" | "captures" | "subscriptions" | "credits", { value: number; change: number }>;
  purchaseBreakdown: { production: number; sandbox: number };
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
type MetricsTab = "channels" | "plan";
type PlatformFilter = "all" | GrowthPlatform;

// Signups, activation, retention, channels and revenue live on /admin/metrics
// (Analytics). This page keeps what is entered or synced by hand: ad spend,
// social accounts, imported reports, and the monthly plan.
const tabs: Array<{ value: MetricsTab; label: string }> = [
  { value: "channels", label: "Spend & social" },
  { value: "plan", label: "Plan & log" },
];

function tabFromQuery(value: string | null): MetricsTab {
  return value === "plan" ? "plan" : "channels";
}

const platformColors: Record<GrowthPlatform, string> = {
  ios: "#7cc4ff",
  android: "#5fd08f",
  web: "#b997ff",
  unknown: "#46544b",
};
const osLabels: Record<SpendOs, string> = { ios: "iOS", android: "Android", web: "Web", mixed: "iOS + Android", unknown: "App not set" };

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
// Sections
// ---------------------------------------------------------------------------

function AttributionPending() {
  return (
    <Alert tone="warn" title="Platform and channel data is not switched on yet">
      <span className="text-xs leading-5">
        Apply <code className="break-all bg-black/30 px-1">supabase/migrations/20260915120000_growth_platform_attribution.sql</code>. Existing
        accounts are then split by device evidence straight away, and new signups are tagged once the iOS and Android updates ship.
      </span>
    </Alert>
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
                <span className="text-xs text-ink-400 tabular-nums">{format(item.signups)} new users</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden bg-white/[.07]" aria-hidden="true">
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
                  <dd className="text-ink-200 tabular-nums"><MoneyTotal values={item.spendByCurrency} /></dd>
                </div>
                <div>
                  <dt className="text-ink-500">Cost per paid signup</dt>
                  <dd className="text-ink-200 tabular-nums"><MoneyTotal values={item.costPerPaidSignupByCurrency} /></dd>
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
  if (!rows.length) return <EmptyState className="m-4 py-8" title="No spend or installs logged this month." />;
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
  if (!rows.length) return <EmptyState className="m-4 py-8" title="No imported channel reports yet." />;
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
            <Button size="sm" onClick={onSync} loading={syncing}>
              {syncing ? "Syncing…" : "Sync accounts"}
            </Button>
          ) : null
        }
      />
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-7">
          {organicViews.map((item) => (
            <div key={item.platform} className="border border-line-300 bg-canvas-900 p-3">
              <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">{item.platform}</p>
              <p className="font-display text-xl text-white tabular-nums">{format(item.views)}</p>
              <p className="text-[11px] text-ink-500">{format(item.posts)} posts</p>
            </div>
          ))}
        </div>
        {configured.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {configured.map((item) => (
              <div key={item.platform} className="border border-line-300 bg-canvas-900 p-3">
                <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">{item.platform} followers</p>
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
          <Alert tone="warn">
            <ul className="space-y-1 text-xs">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Bars at fixed, varied heights so the placeholder reads as a chart. */
const skeletonBars = [38, 52, 44, 61, 35, 70, 58, 47, 66, 74, 55, 63, 49, 81, 68, 57, 72, 60, 77, 65];

function ChartSkeleton({ height = "h-48" }: { height?: string }) {
  return (
    <div className={cn("relative flex items-end gap-1.5 border-b border-white/[.12] pl-8", height)} aria-hidden="true">
      <div className="absolute inset-x-0 top-0 border-t border-white/[.05]" />
      <div className="absolute inset-x-0 top-1/2 border-t border-white/[.05]" />
      {skeletonBars.map((bar, index) => (
        <Skeleton key={index} className="flex-1" style={{ height: `${bar}%` }} />
      ))}
    </div>
  );
}

/** First load only: the overview's shape, so the page doesn't jump when data lands. */
function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading growth data" className="mt-6 space-y-6">
      <StatGridSkeleton />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <div className="border-b border-line-300 px-4 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-2.5 w-72 max-w-full" />
          </div>
          <CardContent className="space-y-3">
            <ChartSkeleton />
            <div className="flex gap-4">
              {[0, 1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-2.5 w-16" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <div className="border-b border-line-300 px-4 py-3">
            <Skeleton className="h-4 w-32" />
          </div>
          <CardContent className="space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-3" style={{ width: `${90 - item * 12}%` }} />
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <div className="border-b border-line-300 px-4 py-3">
          <Skeleton className="h-4 w-32" />
        </div>
        <TableSkeleton rows={5} columns={6} />
      </Card>
    </div>
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
    if (nextTab === "channels") params.delete("tab");
    else params.set("tab", nextTab);
    params.set("month", nextMonth);
    const url = `/admin/metrics/marketing?${params.toString()}`;
    const historyState = window.history.state;
    window.history.pushState(historyState ? { ...historyState } : historyState, "", url);
  }

  const loadGrowth = useCallback(async (month: string) => {
    const { response, body } = await fetchJson(`/api/admin/growth?month=${month}`, { cache: "no-store" });
    if (response.status === 401) {
      setAuthorized(false);
      return;
    }
    if (response.ok && body.ok) setGrowth(body as unknown as Growth);
    else throw new Error(errorFromBody(body, "Unable to load growth data"));
  }, []);

  const load = useCallback(
    async (month: string) => {
      const requestId = ++loadRequestId.current;
      setLoading(true);
      setError(null);
      try {
        const { response, body } = await fetchJson(`/api/admin/metrics?month=${month}`, { cache: "no-store" });
        if (response.status === 401) {
          setAuthorized(false);
          return;
        }
        if (!response.ok || !body.ok) throw new Error(errorFromBody(body, "Unable to load metrics"));
        if (requestId !== loadRequestId.current) return;
        setData(body as unknown as Metrics);
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
      const { response, body: raw } = await fetchJson("/api/admin/social-metrics", { method: force ? "POST" : "GET", cache: "no-store" });
      if (!response.ok || !raw.ok) return;
      const body = raw as { metrics?: SocialMetric[]; lastSyncedAt?: string | null; errors?: string[]; notes?: string[] };
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
    const { response, body } = await fetchJson("/api/admin/support/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok || !body.ok) {
      setError(errorFromBody(body, "Unable to sign in"));
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
      <AdminPage width="narrow" className="grid min-h-[70vh] place-items-center">
        <form onSubmit={login} className="w-full max-w-sm border border-line-300 bg-surface-900 p-6">
          <p className="text-[11px] font-black uppercase tracking-[.16em] text-primary-200">AnimalDex admin</p>
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
            className={cn(fieldClass, "mt-6")}
          />
          <Button type="submit" variant="primary" size="lg" className="mt-3 w-full">
            Sign in
          </Button>
          {error && (
            <Alert tone="bad" className="mt-3">
              {error}
            </Alert>
          )}
        </form>
      </AdminPage>
    );
  }

  const attribution = growth?.attribution;
  const attributionMonth = attribution?.available ? attribution.month : null;
  const organicViews = [...organicPlatforms].map((platform) => {
    const entries = (growth?.daily ?? []).flatMap((row) => row.organicEntries ?? []).filter((entry) => entry.platform === platform);
    return {
      platform: organicPlatformLabels[platform],
      views: entries.reduce((sum, entry) => sum + entry.views, 0),
      posts: entries.reduce((sum, entry) => sum + entry.posts, 0),
    };
  });

  const upcoming = monthState === "upcoming";

  return (
    <FxContext.Provider value={{ display: displayCurrency, rates: fx, referenceDate }}>
      <AdminPage width="wide" className="min-w-0">
        <PageHeader
          eyebrow="Spend, social & plan"
          title={monthName}
          description="Ad spend, organic social, imported channel reports and the monthly plan, on the Asia/Jakarta calendar. Signups, retention, channels and revenue are on Analytics."
          actions={
            <>
              <Link href="/admin/metrics" className={buttonVariants({ size: "sm" })}>
                ← Analytics
              </Link>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => navigate({ month: shiftMonth(growthMonth, -1) })} aria-label={`Show ${monthLabel(shiftMonth(growthMonth, -1))}`}>
                  ←
                </Button>
                <Badge tone={monthState === "current" ? "good" : monthState === "upcoming" ? "warn" : "neutral"}>{monthState}</Badge>
                <Button size="sm" onClick={() => navigate({ month: shiftMonth(growthMonth, 1) })} aria-label={`Show ${monthLabel(shiftMonth(growthMonth, 1))}`}>
                  →
                </Button>
              </div>
              <RefreshButton loading={loading} onClick={() => void load(growthMonth)} />
            </>
          }
        />
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented label="Metrics section" value={tab} options={tabs} onChange={(value) => navigate({ tab: value })} />
            {tab !== "plan" ? (
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
            {tab !== "plan" ? (
              <Segmented
                label="Currency"
                value={displayCurrency}
                onChange={chooseCurrency}
                options={displayCurrencies.map((currency) => ({ value: currency, label: currency }))}
              />
            ) : null}
          </div>
          {fxError && tab !== "plan" ? (
            <Alert tone="warn" className="py-2 text-xs">
              {fxError}
            </Alert>
          ) : null}
        </div>

        {error ? (
          <Alert tone="bad" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {loading && !data ? <DashboardSkeleton /> : null}

        <div aria-busy={(loading && Boolean(data)) || undefined} className={cn("mt-6 space-y-6 transition-opacity", loading && data && "opacity-60")}>
          {data && tab === "channels" ? (
            <>
              {attribution && !attribution.available ? <AttributionPending /> : null}
              {!upcoming && growth?.paid?.split.length ? (
                <Section
                  title="Paid vs organic by platform"
                  description="Signups on each platform against installs the ad platforms reported in the daily log."
                  className="mt-0"
                >
                  <PaidOrganicCards split={growth.paid.split} log={growth.paid.log} />
                </Section>
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
                  <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {(Object.keys(platformEvidenceLabels) as PlatformEvidence[]).map((evidence) => (
                      <div key={evidence} className="border border-line-300 bg-canvas-900 p-3">
                        <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">{platformEvidenceLabels[evidence]}</p>
                        <p className="font-display text-xl text-white tabular-nums">{format(attribution.allTime.evidenceCounts[evidence] ?? 0)}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : null}

          {data && tab === "plan" ? <GrowthCommandCenter growth={growth} month={growthMonth} reload={() => loadGrowth(growthMonth)} /> : null}
        </div>
      </AdminPage>
    </FxContext.Provider>
  );
}
