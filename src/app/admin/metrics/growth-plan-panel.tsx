"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  comparableSpendTotal,
  buildRecoveryPlan,
  cumulativeTargetByDay,
  dailyPaceTarget,
  daysInMonth,
  deriveOrganicTotals,
  deriveShortVideoCount,
  emptyGrowthTargets,
  expectedByDay,
  expectedByWeekDay,
  formatMoney,
  generatedAdSpendTarget,
  generatedOperatingTargets,
  manualStatusForDaily,
  organicPlatformLabels,
  organicPlatforms,
  paceNumber,
  requiredPerDay,
  shiftMonth,
  splitMonthlyTargetsByCalendarWeeks,
  statusForMetric,
  timeElapsedPercent,
  type GrowthMetricKey,
  type GrowthTargets,
  type CollectorAnalytics,
  type NorthStarGoal,
  type NorthStarTrajectory,
  type OrganicEntry,
  type SpendEntry,
  type UsersTargetSource,
} from "@/lib/growth-command-center";

type GrowthChartMetric = "users" | "captures" | "socialViews" | "searchClicks";
type GrowthWeek = {
  label: string;
  startDay: number;
  endDay: number;
  targets: GrowthTargets;
};
type GrowthActionPlan = {
  label: string;
  startDay: number;
  endDay: number;
  items: string[];
};
export type GrowthPlan = {
  month: string;
  targets: GrowthTargets;
  adSpendCurrency?: string | null;
  adSpendOverride?: boolean;
  usersOverride?: boolean;
  generatedUsers?: number | null;
  usersTargetSource?: UsersTargetSource;
  weeklyTargets: GrowthWeek[];
  weeklyActionPlans: GrowthActionPlan[];
};
export type GrowthDaily = {
  date: string;
  day: number;
  users: number;
  captures: number;
  hasMarketingEntry?: boolean;
  spendEntries?: SpendEntry[];
  organicEntries?: OrganicEntry[];
  marketing: {
    date: string;
    socialViews: number;
    searchClicks: number;
    adSpend: number;
    paidUsers: number;
    shortVideos: number;
    seoPages: number;
    notes: string;
  };
};
type GrowthFunnel = {
  activatedUsers: number;
  activationEligibleUsers?: number;
  activationRate: number | null;
  d1RetainedUsers: number;
  d1EligibleUsers?: number;
  d1RetentionRate: number | null;
  d7RetainedUsers: number;
  d7EligibleUsers?: number;
  d7RetentionRate: number | null;
  firstTimePurchasers: number;
  cohortFirstTimePurchasers: number;
  payerConversionRate: number | null;
  definitions: {
    activation: string;
    d1: string;
    d7: string;
    firstTimePurchasers: string;
    payerConversion: string;
    payingPro: string;
  };
  needsAttention: string[];
};
type GrowthResult = {
  month: string;
  targets: GrowthTargets;
  actuals: GrowthTargets;
};
export type GrowthSnapshot = {
  source: string;
  periodStart: string;
  periodEnd: string;
  metric: string;
  value: number;
  currency: string | null;
  aggregationRole: "primary" | "supporting";
  metadata: unknown;
  capturedAt: string;
  notes: string;
};
export type GrowthData = {
  ok: boolean;
  month: string;
  timezone: string;
  today?: string;
  currentDay?: number;
  manualReportingThroughDay?: number;
  manualReportingThroughDate?: string | null;
  hasYesterdayMarketingEntry?: boolean;
  totalDays?: number;
  totalUsers?: number;
  northStar?: NorthStarGoal | null;
  trajectory?: NorthStarTrajectory | null;
  usersTargetSource?: UsersTargetSource;
  plannedPace?: number;
  requiredPace?: number;
  plan: GrowthPlan | null;
  previousPlan: GrowthPlan | null;
  payingProDefinition?: string;
  marketingSnapshotAggregationRule?: string;
  manualDailyEntryCount?: number;
  actuals?: GrowthTargets;
  adSpendByCurrency?: Record<string, number>;
  funnel?: GrowthFunnel;
  collectorAnalytics?: CollectorAnalytics;
  marketingSnapshots?: GrowthSnapshot[];
  primaryMarketingSnapshots?: GrowthSnapshot[];
  daily?: GrowthDaily[];
  socialPages?: Array<{
    id: string;
    platform: string;
    page_name: string;
    description: string;
    posts_per_day: number;
    active: boolean;
    notes: string;
  }>;
  socialIdeaHistory?: Array<{
    id: string;
    idea_date: string;
    page_name: string;
    platform: string;
    title: string;
    hook: string;
    length_seconds: number;
    tips: string;
    status: string;
    completed_at: string | null;
    projected_views_24h: number;
    projection_confidence: string;
    projection_reason: string;
    actual_views_24h: number | null;
    measured_at: string | null;
  }>;
  weeklyActuals?: Array<{
    label: string;
    startDay: number;
    endDay: number;
    actuals: GrowthTargets;
    adSpendByCurrency?: Record<string, number>;
  }>;
  monthResult?: GrowthResult | null;
  previousMonthResult?: GrowthResult | null;
  error?: string;
};

const growthMeta: Record<
  GrowthMetricKey,
  {
    label: string;
    short: string;
    kind: "AUTO" | "MANUAL";
    budget?: boolean;
    money?: boolean;
    role?: string;
  }
> = {
  users: {
    label: "New users",
    short: "Users",
    kind: "AUTO",
    role: "North Star outcome",
  },
  captures: {
    label: "Captures",
    short: "Captures",
    kind: "AUTO",
    role: "Operating target",
  },
  socialViews: {
    label: "Social views",
    short: "Social",
    kind: "MANUAL",
    role: "Operating target",
  },
  searchClicks: {
    label: "Google clicks",
    short: "Google",
    kind: "MANUAL",
    role: "Operating target",
  },
  activePro: {
    label: "Active Pro",
    short: "Pro",
    kind: "AUTO",
    role: "Operating target",
  },
  adSpend: {
    label: "Ad spend",
    short: "Ads",
    kind: "MANUAL",
    budget: true,
    money: true,
    role: "Operating target",
  },
  paidUsers: {
    label: "Paid users",
    short: "Paid",
    kind: "MANUAL",
    role: "Operating target",
  },
  activationRate: {
    label: "Activation rate",
    short: "Act",
    kind: "AUTO",
    role: "Operating target",
  },
  d7Retention: {
    label: "D7 retention",
    short: "D7",
    kind: "AUTO",
    role: "Operating target",
  },
  shortVideos: {
    label: "Short videos",
    short: "Shorts",
    kind: "MANUAL",
    role: "Execution target",
  },
  seoPages: {
    label: "SEO pages",
    short: "SEO",
    kind: "MANUAL",
    role: "Execution target",
  },
};
const defaultJobs = [
  "Publish 3 original short videos/day",
  "Cross-post winning videos",
  "Publish 2 SEO articles",
  "Test 3 content hooks",
  "Run measured ads",
  "Review acquisition sources Sunday",
];
const targetFields: GrowthMetricKey[] = [
  "users",
  "captures",
  "socialViews",
  "searchClicks",
  "activePro",
  "adSpend",
  "shortVideos",
  "seoPages",
  "activationRate",
  "d7Retention",
];

export function format(value: number | null, money = false) {
  if (value == null) return "-";
  return new Intl.NumberFormat("en", {
    notation: value >= 10000 && !money ? "compact" : "standard",
    style: money ? "currency" : "decimal",
    currency: money ? "USD" : undefined,
    maximumFractionDigits: money ? 2 : 0,
  }).format(value);
}
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}
function shortDate(month: string, day: number) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-${String(day).padStart(2, "0")}T00:00:00Z`));
}
function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
export function formatSpendByCurrency(
  totals: Record<string, number> | undefined,
) {
  const entries = Object.entries(totals ?? {}).filter(
    ([, amount]) => amount > 0,
  );
  return entries.length
    ? entries
        .map(([currency, amount]) => formatMoney(amount, currency))
        .join(" · ")
    : "Not entered";
}
function formatSpendEntries(entries: SpendEntry[] | undefined) {
  if (!entries?.length) return "Not entered";
  return entries
    .map(
      (entry) =>
        `${entry.platform.replace(/_/g, " ")} ${formatMoney(entry.amount, entry.currencyCode)}`,
    )
    .join(" · ");
}
function statusLabel(status: string) {
  return status === "on_target"
    ? "ON PACE"
    : status === "close"
      ? "SLIGHTLY BEHIND"
      : status === "future"
        ? "FUTURE"
        : status === "pending"
          ? "PENDING"
          : status === "missing"
            ? "MISSING DATA"
            : status === "no_target"
              ? "NO TARGET SET"
              : "BEHIND";
}
function statusClass(status: string) {
  if (status === "on_target")
    return "border-primary-400/30 bg-primary-500/10 text-primary-100";
  if (status === "close")
    return "border-amber-300/30 bg-amber-400/10 text-amber-200";
  if (status === "future" || status === "no_target" || status === "pending")
    return "border-line-300 bg-white/[.03] text-ink-400";
  if (status === "missing")
    return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-red-400/30 bg-red-500/10 text-red-200";
}
function progressFillClass(status: string) {
  if (status === "on_target") return "bg-primary-400";
  if (status === "close") return "bg-amber-300";
  if (status === "behind") return "bg-red-400";
  return "bg-white/20";
}
function percentOf(actual: number, target: number) {
  return target > 0 ? Math.round((actual / target) * 100) : null;
}
function rollingRequiredPerDay(
  target: number,
  actualThroughPreviousDay: number,
  currentDay: number,
  totalDays: number,
  lowerIsBetter = false,
) {
  if (target <= 0 || totalDays <= 0 || currentDay <= 0) return 0;
  const daysRemaining = Math.max(1, totalDays - currentDay + 1);
  const remaining = lowerIsBetter
    ? Math.max(0, target - actualThroughPreviousDay)
    : Math.max(0, target - actualThroughPreviousDay);
  return lowerIsBetter
    ? Math.ceil(remaining / daysRemaining)
    : Math.ceil(remaining / daysRemaining);
}
function friendlyGrowthError(message: string) {
  return message.includes("growth_")
    ? "Growth tables are not in Supabase yet. Apply the latest growth migrations, then retry."
    : message;
}
function defaultTargetsForMonth(
  month: string,
  source?: GrowthPlan | null,
): GrowthTargets {
  const baseUsers = source?.targets?.users ?? (month === "2026-09" ? 1500 : 0);
  const generated = generatedOperatingTargets(
    baseUsers,
    source?.adSpendCurrency ?? "IDR",
  );
  return (
    source?.targets ?? {
      ...emptyGrowthTargets,
      users: baseUsers,
      captures: month === "2026-09" ? generated.captures : 0,
      socialViews: month === "2026-09" ? generated.socialViews : 0,
      searchClicks: month === "2026-09" ? generated.searchClicks : 0,
      activePro: month === "2026-09" ? 10 : 0,
      adSpend: month === "2026-09" ? generated.adSpend : 0,
      shortVideos: month === "2026-09" ? generated.shortVideos : 0,
      seoPages: month === "2026-09" ? generated.seoPages : 0,
    }
  );
}
function actionPlansFromText(
  month: string,
  text: string,
  existingPlans: GrowthActionPlan[] = [],
  activeDay = 1,
): GrowthActionPlan[] {
  const weeks = splitMonthlyTargetsByCalendarWeeks(month, emptyGrowthTargets);
  const items = text
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const activeWeek =
    weeks.find(
      (week) => activeDay >= week.startDay && activeDay <= week.endDay,
    ) ?? weeks[0];
  return weeks.map((week) => ({
    label: `${shortDate(month, week.startDay)}-${week.endDay} jobs`,
    startDay: week.startDay,
    endDay: week.endDay,
    items:
      week.startDay === activeWeek?.startDay
        ? items
        : (existingPlans.find(
            (plan) =>
              plan.startDay === week.startDay ||
              (plan.startDay <= week.endDay && plan.endDay >= week.startDay),
          )?.items ?? []),
  }));
}
function targetValue(
  label: string,
  actual: number | string,
  target: number,
  missing = false,
) {
  if (missing)
    return `${typeof actual === "number" ? "—" : actual}${target > 0 ? ` / ${format(target)}` : ""}`;
  return target > 0 ? `${actual} / ${format(target)}` : String(actual);
}

function progressPercent(actual: number, target: number, lowerIsBetter = false) {
  if (target <= 0) return 0;
  const ratio = lowerIsBetter ? target / Math.max(actual, 1) : actual / target;
  return Math.max(0, Math.min(1, ratio));
}

function ProgressRing({
  percent,
  lowerIsBetter = false,
}: {
  percent: number;
  lowerIsBetter?: boolean;
}) {
  const size = 18;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const visiblePercent = Math.max(0, Math.min(1, percent));
  const dashOffset = circumference * (1 - visiblePercent);
  const color = lowerIsBetter ? "#59f176" : "#74d8ff";
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="shrink-0"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,.12)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function MetricProgress({
  actual,
  target,
  lowerIsBetter = false,
  missing = false,
  money = false,
  currencyCode,
}: {
  actual: number | string;
  target: number;
  lowerIsBetter?: boolean;
  missing?: boolean;
  money?: boolean;
  currencyCode?: string | null;
}) {
  const actualNumber = typeof actual === "number" ? actual : Number(actual);
  const canShow = !missing && Number.isFinite(actualNumber) && target > 0;
  const percent = canShow
    ? progressPercent(actualNumber, target, lowerIsBetter)
    : 0;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      {canShow ? <ProgressRing percent={percent} lowerIsBetter={lowerIsBetter} /> : null}
      <span>
        {typeof actual === "number"
          ? money
            ? formatMoney(actual, currencyCode)
            : format(actual)
          : actual}
        {target > 0
          ? ` / ${money ? formatMoney(target, currencyCode) : format(target)}`
          : ""}
      </span>
    </span>
  );
}

function rollingDailyAverage(values: number[], windowSize = 7) {
  return values.map((_, index) => {
    const window = values.slice(Math.max(0, index - windowSize + 1), index + 1);
    return window.reduce((sum, value) => sum + value, 0) / window.length;
  });
}

function perMinuteRate(value: number) {
  return value / (24 * 60);
}

function GrowthVelocityChart({ rows }: { rows: GrowthDaily[] }) {
  if (!rows.length) return null;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const usersPerDay = rollingDailyAverage(rows.map((row) => row.users));
  const capturesPerDay = rollingDailyAverage(rows.map((row) => row.captures));
  const users = usersPerDay.map(perMinuteRate);
  const captures = capturesPerDay.map(perMinuteRate);
  const userMax = Math.max(0.001, ...users);
  const captureMax = Math.max(0.001, ...captures);
  const width = 900;
  const height = 280;
  const left = 52;
  const right = 58;
  const top = 34;
  const bottom = 38;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const x = (index: number) =>
    left + index * (chartWidth / Math.max(1, rows.length - 1));
  const y = (value: number, max: number) =>
    top + chartHeight - (value / max) * chartHeight;
  const points = (values: number[], max: number) =>
    values.map((value, index) => `${x(index)},${y(value, max)}`).join(" ");
  const hoveredRow =
    hoveredIndex === null ? null : rows[hoveredIndex] ?? null;
  const hoveredPoint =
    hoveredIndex === null
      ? null
      : {
          index: hoveredIndex,
          row: hoveredRow,
          userAverage: users[hoveredIndex] ?? 0,
          captureAverage: captures[hoveredIndex] ?? 0,
          userDailyAverage: usersPerDay[hoveredIndex] ?? 0,
          captureDailyAverage: capturesPerDay[hoveredIndex] ?? 0,
        };
  const recentStart = Math.max(0, rows.length - 7);
  const recentUsers = rows
    .slice(recentStart)
    .reduce((sum, row) => sum + row.users, 0);
  const recentCaptures = rows
    .slice(recentStart)
    .reduce((sum, row) => sum + row.captures, 0);
  const recentDays = Math.max(1, rows.length - recentStart);
  const numberWithUpToThreeDecimals = (value: number) =>
    new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value);
  const hoveredTop =
    hoveredPoint && hoveredPoint.row
      ? Math.min(
          Math.max(
            12,
            Math.min(
              y(users[hoveredPoint.index], userMax),
              y(captures[hoveredPoint.index], captureMax),
            ) - 118,
          ),
          height - 138,
        )
      : 0;
  const hoveredLeft =
    hoveredPoint && hoveredPoint.row
      ? Math.min(
          Math.max(12, x(hoveredPoint.index) - 140),
          width - 296,
        )
      : 0;

  return (
    <section className="rounded-xl border border-line-300 bg-surface-900 p-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">
            Growth velocity
          </p>
          <h3 className="mt-1 font-display text-2xl text-white">
            User acquisition vs captures per minute
          </h3>
          <p className="mt-1 text-xs text-ink-400">
            Seven-day rolling averages normalized to per-minute rates from
            stored signup and qualifying capture timestamps.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-xs">
          <div>
            <p className="font-black text-sky-300">
              {numberWithUpToThreeDecimals(
                perMinuteRate(recentUsers / recentDays),
              )}
            </p>
            <p className="text-ink-500">users/min</p>
          </div>
          <div>
            <p className="font-black text-primary-200">
              {numberWithUpToThreeDecimals(
                perMinuteRate(recentCaptures / recentDays),
              )}
            </p>
            <p className="text-ink-500">captures/min</p>
          </div>
          <div>
            <p className="font-black text-white">
              {recentUsers > 0
                ? numberWithUpToThreeDecimals(recentCaptures / recentUsers)
                : "—"}
            </p>
            <p className="text-ink-500">captures/user</p>
          </div>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <div className="relative min-w-[680px] w-full">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full"
            role="img"
            aria-label="Seven-day rolling averages for per-minute user acquisitions and captures"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const gridY = top + chartHeight * ratio;
              return (
                <line
                  key={ratio}
                  x1={left}
                  x2={width - right}
                  y1={gridY}
                  y2={gridY}
                  stroke="rgba(255,255,255,.08)"
                />
              );
            })}
            <text x={left} y="16" fill="#74d8ff" fontSize="12">
              users/min · left scale 0–
              {numberWithUpToThreeDecimals(userMax)}
            </text>
            <text
              x={width - right}
              y="16"
              textAnchor="end"
              fill="#59f176"
              fontSize="12"
            >
              captures/min · right scale 0–
              {numberWithUpToThreeDecimals(captureMax)}
            </text>
            {hoveredPoint && hoveredPoint.row ? (
              <line
                x1={x(hoveredPoint.index)}
                x2={x(hoveredPoint.index)}
                y1={top}
                y2={height - bottom}
                stroke="rgba(255,255,255,.28)"
                strokeDasharray="4 4"
              />
            ) : null}
            <polyline
              points={points(users, userMax)}
              fill="none"
              stroke="#74d8ff"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points={points(captures, captureMax)}
              fill="none"
              stroke="#59f176"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {rows.map((row, index) => (
              <g key={row.date}>
                <rect
                  x={Math.max(0, x(index) - 12)}
                  y={top}
                  width={24}
                  height={chartHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                />
                <circle
                  cx={x(index)}
                  cy={y(users[index], userMax)}
                  r={hoveredIndex === index ? 8 : 4}
                  fill={hoveredIndex === index ? "#b7ecff" : "#74d8ff"}
                  stroke={hoveredIndex === index ? "#ffffff" : "#041017"}
                  strokeWidth={hoveredIndex === index ? 2.5 : 1.5}
                />
                <circle
                  cx={x(index)}
                  cy={y(captures[index], captureMax)}
                  r={hoveredIndex === index ? 8 : 4}
                  fill={hoveredIndex === index ? "#b8ffd0" : "#59f176"}
                  stroke={hoveredIndex === index ? "#ffffff" : "#041017"}
                  strokeWidth={hoveredIndex === index ? 2.5 : 1.5}
                />
                {index === 0 || index === rows.length - 1 || row.day % 5 === 0 ? (
                  <text
                    x={x(index)}
                    y={height - 12}
                    textAnchor="middle"
                    fill="#84958b"
                    fontSize="10"
                  >
                    {dateLabel(row.date)}
                  </text>
                ) : null}
              </g>
            ))}
          </svg>
          {hoveredPoint && hoveredPoint.row ? (
            <div
              className="pointer-events-none absolute z-10 rounded-xl border border-line-300 bg-canvas-950/95 px-3 py-2 text-[11px] shadow-2xl backdrop-blur"
              style={{
                left: hoveredLeft,
                top: hoveredTop,
              }}
            >
              <p className="font-black text-white">
                {dateLabel(hoveredPoint.row.date)}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sky-300">Users</p>
                  <p className="font-black text-white">
                    {hoveredPoint.row.users}
                  </p>
                  <p className="text-ink-400">
                    Daily rate {numberWithUpToThreeDecimals(hoveredPoint.row.users / (24 * 60))} / min
                    <span className="block text-ink-500">
                      7-day avg {numberWithUpToThreeDecimals(hoveredPoint.userAverage)} / min
                    </span>
                    <span className="block text-ink-500">
                      {numberWithUpToThreeDecimals(
                        hoveredPoint.userDailyAverage,
                      )} / day
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-primary-200">Captures</p>
                  <p className="font-black text-white">
                    {hoveredPoint.row.captures}
                  </p>
                  <p className="text-ink-400">
                    Daily rate {numberWithUpToThreeDecimals(hoveredPoint.row.captures / (24 * 60))} / min
                    <span className="block text-ink-500">
                      7-day avg {numberWithUpToThreeDecimals(hoveredPoint.captureAverage)} / min
                    </span>
                    <span className="block text-ink-500">
                      {numberWithUpToThreeDecimals(
                        hoveredPoint.captureDailyAverage,
                      )} / day
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MiniChart({
  rows,
  metric,
  target,
}: {
  rows: GrowthDaily[];
  metric: GrowthChartMetric;
  target: number;
}) {
  const totalDays = rows.length || 1;
  const targetLine = target > 0 ? cumulativeTargetByDay(target, totalDays) : [];
  let running = 0;
  const actualLine = rows.map((row) => {
    running +=
      metric === "users"
        ? row.users
        : metric === "captures"
          ? row.captures
          : row.hasMarketingEntry
            ? row.marketing[metric]
            : 0;
    return running;
  });
  const max = Math.max(1, target, ...actualLine);
  const points = (values: number[]) =>
    values
      .map(
        (value, index) =>
          `${index * (900 / Math.max(1, totalDays - 1))},${220 - (value / max) * 190}`,
      )
      .join(" ");
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 900 245"
        className="max-h-44 min-w-[620px] w-full"
        role="img"
        aria-label="Target versus actual"
      >
        <line
          x1="0"
          x2="900"
          y1="220"
          y2="220"
          stroke="rgba(255,255,255,.12)"
        />
        {target > 0 ? (
          <polyline
            points={points(targetLine)}
            fill="none"
            stroke="#84958b"
            strokeWidth="4"
            strokeDasharray="8 8"
          />
        ) : null}
        <polyline
          points={points(actualLine)}
          fill="none"
          stroke="#59f176"
          strokeWidth="5"
        />
        <text x="10" y="20" fill="#59f176" fontSize="12">
          actual
        </text>
        {target > 0 ? (
          <text x="70" y="20" fill="#84958b" fontSize="12">
            target
          </text>
        ) : null}
      </svg>
      {target <= 0 ? (
        <p className="mt-2 text-xs text-ink-500">
          No operating target configured for this month.
        </p>
      ) : null}
    </div>
  );
}

function PlanForm({
  month,
  source,
  generatedUsers,
  activeDay,
  onCancel,
  onSaved,
}: {
  month: string;
  source?: GrowthPlan | null;
  generatedUsers?: number | null;
  activeDay?: number;
  onCancel?: () => void;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideUsers, setOverrideUsers] = useState(
    source?.usersTargetSource === "override",
  );
  const [overrideAdSpend, setOverrideAdSpend] = useState(
    source?.adSpendOverride === true,
  );
  const [adSpendCurrency, setAdSpendCurrency] = useState(
    source?.adSpendCurrency ?? "IDR",
  );
  const defaults = defaultTargetsForMonth(month, source);
  const generated = generatedUsers ?? source?.generatedUsers ?? defaults.users;
  const editingWeek =
    source?.weeklyTargets.find(
      (week) =>
        (activeDay ?? 1) >= week.startDay &&
        (activeDay ?? 1) <= week.endDay,
    ) ?? source?.weeklyTargets[0];
  const editingWeekPlan = source?.weeklyActionPlans.find(
    (plan) =>
      editingWeek &&
      (plan.startDay === editingWeek.startDay ||
        (plan.startDay <= editingWeek.endDay &&
          plan.endDay >= editingWeek.startDay)),
  );
  const editingJobItems = editingWeekPlan?.items?.length
    ? editingWeekPlan.items
    : source?.weeklyActionPlans.length
      ? []
      : defaultJobs;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submittedAdSpendCurrency = String(
      form.get("adSpendCurrency") || source?.adSpendCurrency || "IDR",
    ).toUpperCase();
    const targets = Object.fromEntries(
      targetFields.map((key) => [key, Math.max(0, Number(form.get(key) ?? 0))]),
    ) as GrowthTargets;
    if (!overrideUsers) targets.users = generated;
    if (!overrideAdSpend) {
      targets.adSpend = generatedAdSpendTarget(
        targets.users,
        submittedAdSpendCurrency,
      );
    }
    const weeklyTargets = splitMonthlyTargetsByCalendarWeeks(month, targets);
    const weeklyActionPlans = actionPlansFromText(
      month,
      String(form.get("jobs") ?? ""),
      source?.weeklyActionPlans,
      activeDay,
    );
    try {
      setSaving(true);
      setError(null);
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-plan",
          month,
          targets: {
            ...targets,
            adSpendCurrency: submittedAdSpendCurrency,
            adSpendOverride: overrideAdSpend,
            usersOverride: overrideUsers,
          },
          weeklyTargets,
          weeklyActionPlans,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok)
        throw new Error(body.error || "Unable to save targets");
      await onSaved();
      onCancel?.();
    } catch (caught) {
      setError(
        friendlyGrowthError(
          caught instanceof Error ? caught.message : "Unable to save targets",
        ),
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-line-300 bg-canvas-900 p-4"
    >
      <h3 className="font-display text-2xl text-white">
        Growth targets — {monthLabel(month)}
      </h3>
      <p className="mt-1 text-sm text-ink-400">
        These are targets, not actuals. Update today records what actually
        happened.
      </p>
      <label className="mt-4 flex items-center gap-2 text-sm text-ink-200">
        <input
          type="checkbox"
          checked={overrideUsers}
          onChange={(event) => setOverrideUsers(event.target.checked)}
        />{" "}
        Override this month’s generated user target
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {targetFields.map((key) => {
          const generatedUserField = key === "users";
          const badge =
            generatedUserField && !overrideUsers
              ? "AUTO-GENERATED"
              : key === "adSpend" && !overrideAdSpend
                ? "AUTO-GENERATED"
              : growthMeta[key].role === "Execution target"
                ? "EXECUTION TARGET"
                : "TARGET";
          if (key === "adSpend") {
            return (
              <label key={key} className="text-sm font-bold text-ink-300">
                Monthly ad budget
                <span className="ml-2 text-[10px] font-black text-primary-100">
                  {badge}
                </span>
                <div className="mt-1 grid grid-cols-[5.5rem_1fr] gap-2">
                  <select
                    name="adSpendCurrency"
                    value={adSpendCurrency}
                    onChange={(event) => setAdSpendCurrency(event.target.value)}
                    className="rounded-lg border border-line-300 bg-surface-900 px-2 py-2 text-white outline-none focus:border-primary-300"
                  >
                    <option value="IDR">IDR</option>
                    <option value="GBP">GBP</option>
                    <option value="USD">USD</option>
                  </select>
                  <input
                    key={`${adSpendCurrency}-${overrideAdSpend}`}
                    name={key}
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!overrideAdSpend}
                    defaultValue={
                      overrideAdSpend
                        ? defaults[key]
                        : generatedAdSpendTarget(
                            overrideUsers ? defaults.users : generated,
                            adSpendCurrency,
                          )
                    }
                    className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-white outline-none focus:border-primary-300"
                  />
                </div>
                <span className="mt-1 flex items-center gap-2 text-xs font-normal text-ink-400">
                  <input
                    type="checkbox"
                    checked={overrideAdSpend}
                    onChange={(event) =>
                      setOverrideAdSpend(event.target.checked)
                    }
                  />
                  Override autogenerated acquisition budget
                </span>
              </label>
            );
          }
          return (
            <label key={key} className="text-sm font-bold text-ink-300">
              {growthMeta[key].label}
              <span className="ml-2 text-[10px] font-black text-primary-100">
                {badge}
              </span>
              <input
                name={key}
                type="number"
                min="0"
                step="1"
                defaultValue={
                  generatedUserField && !overrideUsers
                    ? generated
                    : defaults[key]
                }
                readOnly={generatedUserField && !overrideUsers}
                className="mt-1 w-full rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-white outline-none focus:border-primary-300 read-only:opacity-70"
              />
              {generatedUserField ? (
                <span className="mt-1 block text-[11px] text-ink-500">
                  {overrideUsers
                    ? "Manual override for this month only."
                    : "Required for the long-term user goal. Not invented from TikTok or ads."}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      <div className="mt-4 rounded-lg border border-line-300 bg-surface-900 p-3">
        <p className="text-sm font-black text-white">Weekly targets</p>
        <p className="mt-1 text-xs text-ink-400">
          Automatically split from the monthly targets. Input targets stay
          hypotheses until enough daily history exists to estimate conversion.
        </p>
      </div>
      <label className="mt-4 block text-sm font-bold text-ink-300">
        This week’s jobs
        {editingWeek
          ? ` · ${shortDate(month, editingWeek.startDay)}–${shortDate(month, editingWeek.endDay)}`
          : ""}
        <textarea
          name="jobs"
          rows={5}
          defaultValue={editingJobItems.join("\n")}
          className="mt-1 w-full rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-white outline-none focus:border-primary-300"
        />
      </label>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-5 flex gap-2">
        <button
          disabled={saving}
          className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950"
        >
          {saving ? "Saving..." : `Save ${monthLabel(month)} targets`}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line-300 px-4 py-2 text-sm font-black text-white"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function NorthStarCard({
  goal,
  trajectory,
  totalUsers,
  onEdit,
}: {
  goal: NorthStarGoal | null | undefined;
  trajectory: NorthStarTrajectory | null | undefined;
  totalUsers: number;
  onEdit: () => void;
}) {
  if (!goal || !trajectory) {
    return (
      <div className="rounded-xl border border-line-300 bg-surface-900 p-5">
        <p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">
          North Star
        </p>
        <h3 className="mt-2 font-display text-3xl text-white">
          Set a long-term user goal
        </h3>
        <p className="mt-2 text-sm text-ink-400">
          Monthly, weekly and daily user targets should come from one goal, not
          from inventing a number every month.
        </p>
        <button
          onClick={onEdit}
          className="mt-4 rounded-lg bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950"
        >
          Set North Star
        </button>
      </div>
    );
  }
  const pct = percentOf(totalUsers, goal.targetUsers) ?? 0;
  return (
    <div className="rounded-xl border border-line-300 bg-surface-900 p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">
            North Star
          </p>
          <h3 className="mt-2 font-display text-4xl text-white">
            {format(goal.targetUsers)} users
          </h3>
          <p className="mt-1 text-sm text-ink-300">
            by {dateLabel(goal.targetDate)}
          </p>
        </div>
        <button
          onClick={onEdit}
          className="rounded-lg border border-line-300 px-3 py-2 text-xs font-black text-white"
        >
          Edit goal
        </button>
      </div>
      <p className="mt-3 font-display text-2xl text-white">
        {format(totalUsers)} current · {pct}%
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[.08]">
        <div
          className="h-full rounded-full bg-primary-400"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-ink-300">
        {format(trajectory.remainingUsers)} to go ·{" "}
        {format(trajectory.remainingDays)} days · required average{" "}
        {trajectory.requiredAverage}/day
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-black text-primary-100">
          View calculation
        </summary>
        <p className="mt-2 text-xs text-ink-400">{trajectory.explanation}</p>
      </details>
    </div>
  );
}

function NorthStarForm({
  source,
  onCancel,
  onSaved,
}: {
  source?: NorthStarGoal | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-north-star",
          northStar: {
            targetUsers: form.get("targetUsers"),
            targetDate: form.get("targetDate"),
            growthModel: form.get("growthModel"),
            rampPercent: form.get("rampPercent"),
          },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok)
        throw new Error(body.error || "Unable to save North Star");
      await onSaved();
      onCancel();
    } catch (caught) {
      setError(
        friendlyGrowthError(
          caught instanceof Error
            ? caught.message
            : "Unable to save North Star",
        ),
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-line-300 bg-canvas-900 p-4"
    >
      <h3 className="font-display text-2xl text-white">North Star goal</h3>
      <p className="mt-1 text-sm text-ink-400">
        This generates monthly user targets. It does not invent TikTok, Google
        or ad numbers.
      </p>
      <label className="mt-4 block text-sm font-bold text-ink-300">
        Total users
        <input
          name="targetUsers"
          type="number"
          min="1"
          defaultValue={source?.targetUsers ?? 10000}
          className="mt-1 w-full rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-white outline-none focus:border-primary-300"
        />
      </label>
      <label className="mt-3 block text-sm font-bold text-ink-300">
        By date
        <input
          name="targetDate"
          type="date"
          defaultValue={source?.targetDate ?? "2026-12-31"}
          className="mt-1 w-full rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-white outline-none focus:border-primary-300"
        />
      </label>
      <label className="mt-3 block text-sm font-bold text-ink-300">
        Growth model
        <select
          name="growthModel"
          defaultValue={source?.growthModel ?? "ramp"}
          className="mt-1 w-full rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-white outline-none focus:border-primary-300"
        >
          <option value="ramp">Compounding ramp</option>
          <option value="linear">Linear</option>
        </select>
      </label>
      <label className="mt-3 block text-sm font-bold text-ink-300">
        Monthly ramp %
        <input
          name="rampPercent"
          type="number"
          min="0"
          step="1"
          defaultValue={source?.rampPercent ?? 20}
          className="mt-1 w-full rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-white outline-none focus:border-primary-300"
        />
      </label>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-5 flex gap-2">
        <button
          disabled={saving}
          className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950"
        >
          {saving ? "Saving..." : "Save goal and generate months"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-line-300 px-4 py-2 text-sm font-black text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

type SocialPageDraft = {
  platform: string;
  pageName: string;
  description: string;
  active: boolean;
  notes: string;
};

function SocialPagesPanel({
  pages,
  history,
  onSaved,
  ideaCount,
}: {
  pages: NonNullable<GrowthData["socialPages"]>;
  history: NonNullable<GrowthData["socialIdeaHistory"]>;
  onSaved: () => Promise<void>;
  ideaCount: number;
}) {
  const [drafts, setDrafts] = useState<SocialPageDraft[]>(
    pages.length
      ? pages.map((page) => ({
          platform: page.platform,
          pageName: page.page_name,
          description: page.description,
          active: page.active,
          notes: page.notes,
        }))
      : [
          {
            platform: "tiktok",
            pageName: "",
            description: "",
            active: true,
            notes: "",
          },
        ],
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState("");
  const [editingPages, setEditingPages] = useState(false);
  const [viewDrafts, setViewDrafts] = useState<Record<string, string>>({});
  const [manualIdeaDraft, setManualIdeaDraft] = useState({
    pageName: "",
    platform: "",
    title: "",
    hook: "",
    lengthSeconds: "",
    tips: "",
    projectedViews24h: "",
    actualViews24h: "",
  });
  const suggestions = history.filter((item) => item.status !== "completed");
  const completedIdeas = history
    .filter((item) => item.status === "completed")
    .slice(0, 20);

  useEffect(() => {
    setDrafts(
      pages.length
        ? pages.map((page) => ({
            platform: page.platform,
            pageName: page.page_name,
            description: page.description,
            active: page.active,
            notes: page.notes,
          }))
        : [
            {
              platform: "tiktok",
              pageName: "",
              description: "",
              active: true,
              notes: "",
            },
          ],
    );
  }, [pages]);

  async function savePages() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-social-pages", pages: drafts }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "Unable to save pages");
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save pages");
    } finally {
      setSaving(false);
    }
  }

  async function generateIdeas() {
    setGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-social-ideas",
          totalIdeas: ideaCount,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "Unable to generate ideas");
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to generate ideas");
    } finally {
      setGenerating(false);
    }
  }

  async function backfillProjections() {
    setBackfilling(true);
    setError("");
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "backfill-social-idea-projections",
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        throw new Error(body.error || "Unable to backfill projections");
      }
      await onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to backfill projections",
      );
    } finally {
      setBackfilling(false);
    }
  }

  async function markComplete(idea: {
    page_name: string;
    title: string;
    idea_date: string;
  }) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark-social-idea-complete",
          date: idea.idea_date,
          pageName: idea.page_name,
          title: idea.title,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "Unable to mark complete");
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to mark complete");
    } finally {
      setSaving(false);
    }
  }

  async function recordViews(idea: { id: string; actual_views_24h: number | null }) {
    const rawViews =
      viewDrafts[idea.id] ??
      (idea.actual_views_24h == null ? "" : String(idea.actual_views_24h));
    if (rawViews.trim() === "") {
      setError("Enter the views recorded 24 hours after publishing");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record-social-idea-views",
          ideaId: idea.id,
          actualViews24h: Number(rawViews),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok)
        throw new Error(body.error || "Unable to save 24-hour views");
      setViewDrafts((current) => {
        const next = { ...current };
        delete next[idea.id];
        return next;
      });
      await onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save 24-hour views",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveManualIdea() {
    const pageName = manualIdeaDraft.pageName.trim();
    const platform = manualIdeaDraft.platform.trim();
    const title = manualIdeaDraft.title.trim();
    if (!pageName || !platform || !title) {
      setError("Page name, platform, and title are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-custom-social-idea",
          customIdea: {
            ...manualIdeaDraft,
            pageName,
            platform,
            title,
            lengthSeconds: Number(manualIdeaDraft.lengthSeconds || 0),
            projectedViews24h: Number(manualIdeaDraft.projectedViews24h || 0),
            actualViews24h:
              manualIdeaDraft.actualViews24h.trim() === ""
                ? null
                : Number(manualIdeaDraft.actualViews24h),
            status:
              manualIdeaDraft.actualViews24h.trim() === ""
                ? "suggested"
                : "completed",
            ideaDate: new Date().toISOString().slice(0, 10),
          },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok)
        throw new Error(body.error || "Unable to save manual idea");
      setManualIdeaDraft({
        pageName: "",
        platform: "",
        title: "",
        hook: "",
        lengthSeconds: "",
        tips: "",
        projectedViews24h: "",
        actualViews24h: "",
      });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save manual idea");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-line-300 bg-surface-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-white">Social pages</h3>
          <p className="text-xs text-ink-500">
            Store your pages, descriptions, and daily posting targets here. The
            daily generation count follows the current short-video target.
          </p>
          <p className="mt-1 text-xs font-bold text-primary-100">
            Today&apos;s idea count: {ideaCount}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditingPages((current) => !current)}
            className="rounded-lg border border-line-300 px-4 py-2 text-sm font-black text-white"
          >
            {editingPages ? "Lock pages" : "Edit pages"}
          </button>
          <button
            onClick={() =>
              setDrafts((current) => [
                ...current,
                {
                  platform: "tiktok",
                  pageName: "",
                  description: "",
                  active: true,
                  notes: "",
                },
              ])
            }
            className="rounded-lg border border-line-300 px-4 py-2 text-sm font-black text-white"
          >
            Add page
          </button>
          <button
            onClick={savePages}
            disabled={saving}
            className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950"
          >
            {saving ? "Saving..." : "Save pages"}
          </button>
          <button
            onClick={generateIdeas}
            disabled={generating}
            className="rounded-lg border border-line-300 px-4 py-2 text-sm font-black text-white"
          >
            {generating ? "Generating..." : "Generate ideas"}
          </button>
          <button
            onClick={backfillProjections}
            disabled={backfilling || !suggestions.length}
            className="rounded-lg border border-line-300 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            {backfilling ? "Backfilling..." : "Backfill projections"}
          </button>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-4 space-y-3">
        {drafts.map((page, index) => (
          <div
            key={`social-page-${index}`}
            className="grid gap-2 rounded-lg border border-line-300 bg-canvas-900 p-3 md:grid-cols-[9rem_1fr_5rem_1fr]"
          >
            <input
              value={page.platform}
              readOnly={!editingPages}
              onChange={(event) => {
                const next = [...drafts];
                next[index] = {...page, platform: event.target.value};
                setDrafts(next);
              }}
              placeholder="platforms"
              className="rounded-lg border border-line-300 bg-surface-900 px-2 py-2 text-white outline-none read-only:opacity-60"
            />
            <input
              value={page.pageName}
              readOnly={!editingPages}
              onChange={(event) => {
                const next = [...drafts];
                next[index] = {...page, pageName: event.target.value};
                setDrafts(next);
              }}
              placeholder="page name"
              className="rounded-lg border border-line-300 bg-surface-900 px-2 py-2 text-white outline-none read-only:opacity-60"
            />
            <label className="flex items-center gap-2 text-xs font-bold text-ink-300">
              <input
                type="checkbox"
                checked={page.active}
                disabled={!editingPages}
                onChange={(event) => {
                  const next = [...drafts];
                  next[index] = {...page, active: event.target.checked};
                  setDrafts(next);
                }}
              />
              Active
            </label>
            <button
              type="button"
              onClick={() =>
                setDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index))
              }
              disabled={drafts.length <= 1}
              className="text-left text-xs font-black text-red-300 disabled:opacity-40"
            >
              Remove
            </button>
            <textarea
              value={page.description}
              readOnly={!editingPages}
              onChange={(event) => {
                const next = [...drafts];
                next[index] = {...page, description: event.target.value};
                setDrafts(next);
              }}
              placeholder="description and audience"
              className="min-h-20 rounded-lg border border-line-300 bg-surface-900 px-2 py-2 text-white outline-none md:col-span-4 read-only:opacity-60"
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-500">
        Prior generated titles loaded for duplicate rejection: {history.length}
      </p>
      <div className="mt-4 space-y-2">
        <h4 className="text-sm font-black uppercase tracking-[.12em] text-primary-100">
          Suggestions
        </h4>
        {suggestions.length ? (
          suggestions.map((idea) => (
            <div
              key={idea.id}
              className="grid gap-2 rounded-lg border border-line-300 bg-canvas-900 p-3 md:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="font-bold text-white">{idea.page_name} · {idea.title}</p>
                <p className="text-xs text-ink-400">{idea.platform} · {idea.idea_date} · {idea.length_seconds}s</p>
                <p className="mt-1 text-xs text-ink-300">{idea.hook}</p>
                <p className="mt-1 text-xs text-ink-500">{idea.tips}</p>
                <p className="mt-2 text-xs font-black text-primary-100">
                  Projected 24h views: ~{format(idea.projected_views_24h)} · {idea.projection_confidence} confidence
                </p>
                {idea.projection_reason ? (
                  <p className="mt-1 text-[11px] text-ink-500">
                    {idea.projection_reason}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => markComplete(idea)}
                className="h-fit rounded-lg border border-line-300 px-3 py-2 text-xs font-black text-white"
              >
                Mark complete
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-400">No pending suggestions yet.</p>
        )}
      </div>
      <div className="mt-6 space-y-3 rounded-lg border border-line-300 bg-canvas-900 p-3">
        <h4 className="text-sm font-black uppercase tracking-[.12em] text-primary-100">
          Add your own post
        </h4>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            value={manualIdeaDraft.platform}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                platform: event.target.value,
              }))
            }
            placeholder="platform"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none"
          />
          <input
            value={manualIdeaDraft.pageName}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                pageName: event.target.value,
              }))
            }
            placeholder="page / account"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none"
          />
          <input
            value={manualIdeaDraft.title}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            placeholder="title"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none md:col-span-2"
          />
          <input
            value={manualIdeaDraft.hook}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                hook: event.target.value,
              }))
            }
            placeholder="hook"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none md:col-span-2"
          />
          <input
            type="number"
            min="0"
            step="1"
            value={manualIdeaDraft.lengthSeconds}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                lengthSeconds: event.target.value,
              }))
            }
            placeholder="duration seconds"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none"
          />
          <input
            type="number"
            min="0"
            step="1"
            value={manualIdeaDraft.projectedViews24h}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                projectedViews24h: event.target.value,
              }))
            }
            placeholder="projected 24h views"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none"
          />
          <input
            type="number"
            min="0"
            step="1"
            value={manualIdeaDraft.actualViews24h}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                actualViews24h: event.target.value,
              }))
            }
            placeholder="actual 24h views"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none"
          />
          <input
            value={manualIdeaDraft.tips}
            onChange={(event) =>
              setManualIdeaDraft((current) => ({
                ...current,
                tips: event.target.value,
              }))
            }
            placeholder="tips"
            className="rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none md:col-span-2"
          />
        </div>
        <button
          type="button"
          onClick={saveManualIdea}
          disabled={saving}
          className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950"
        >
          Save manual post
        </button>
      </div>
      <div className="mt-6 space-y-2">
        <h4 className="text-sm font-black uppercase tracking-[.12em] text-primary-100">
          Published feedback
        </h4>
        <p className="text-xs text-ink-500">
          Enter combined views 24 hours after publishing. Future ideas and
          projections use this measured history for the same page and platform.
        </p>
        {completedIdeas.length ? (
          completedIdeas.map((idea) => {
            const actualValue =
              viewDrafts[idea.id] ??
              (idea.actual_views_24h == null
                ? ""
                : String(idea.actual_views_24h));
            const projectionRatio =
              idea.actual_views_24h != null && idea.projected_views_24h > 0
                ? idea.actual_views_24h / idea.projected_views_24h
                : null;
            return (
              <div
                key={idea.id}
                className="rounded-lg border border-line-300 bg-canvas-900 p-3"
              >
                <p className="font-bold text-white">
                  {idea.page_name} · {idea.title}
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  Projected ~{format(idea.projected_views_24h)} views in 24h
                  {projectionRatio == null
                    ? ""
                    : ` · actual was ${projectionRatio.toFixed(1)}× projection`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={actualValue}
                    onChange={(event) =>
                      setViewDrafts((current) => ({
                        ...current,
                        [idea.id]: event.target.value,
                      }))
                    }
                    placeholder="actual views after 24h"
                    className="min-w-56 flex-1 rounded-lg border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-300"
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => recordViews(idea)}
                    className="rounded-lg border border-line-300 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                  >
                    {idea.actual_views_24h == null
                      ? "Save 24h views"
                      : "Update 24h views"}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-ink-400">
            Mark a suggestion complete to start measuring it.
          </p>
        )}
      </div>
    </section>
  );
}

function TodayCard({
  row,
  targets,
  requiredUsers,
  requiredCaptures,
  totalDays,
  onEdit,
}: {
  row: GrowthDaily | null;
  targets: GrowthTargets;
  requiredUsers: number;
  requiredCaptures: number;
  totalDays: number;
  onEdit: (row: GrowthDaily) => void;
}) {
  if (!row) return null;
  const remainingUsers = Math.max(0, requiredUsers - row.users);
  return (
    <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-white">
            Today · {dateLabel(row.date)}
          </h3>
          <p className="mt-1 text-xs font-black uppercase tracking-[.14em] text-primary-200">
            Am I doing enough today?
          </p>
        </div>
        <button
          onClick={() => onEdit(row)}
          className="rounded-lg bg-primary-500 px-3 py-2 text-xs font-black text-canvas-950"
        >
          Update today
        </button>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-ink-200">
        <p>
          New users {row.users} / {format(requiredUsers)} needed
        </p>
        <p>
          Captures {row.captures} / {format(requiredCaptures)}
        </p>
        <p>
          Social views{" "}
          {row.hasMarketingEntry ? format(row.marketing.socialViews) : "—"}
          {targets.socialViews > 0
            ? ` / ${format(dailyPaceTarget(targets.socialViews, totalDays))}`
            : ""}
        </p>
        <p>
          Google clicks{" "}
          {row.hasMarketingEntry ? format(row.marketing.searchClicks) : "—"}
          {targets.searchClicks > 0
            ? ` / ${format(dailyPaceTarget(targets.searchClicks, totalDays))}`
            : ""}
        </p>
        <p>
          Shorts{" "}
          {row.hasMarketingEntry ? format(row.marketing.shortVideos) : "—"}
          {targets.shortVideos > 0
            ? ` / ${format(dailyPaceTarget(targets.shortVideos, totalDays))}`
            : ""}
        </p>
        <p>
          SEO {row.hasMarketingEntry ? format(row.marketing.seoPages) : "—"}{" "}
          this week
          {targets.seoPages > 0
            ? ` / ~${format(Math.max(1, Math.round(targets.seoPages / 4)))}`
            : ""}
        </p>
      </div>
      <p className="mt-3 text-sm font-black text-white">
        {remainingUsers > 0
          ? `${format(remainingUsers)} more users needed today to maintain trajectory`
          : "Today’s user pace is covered."}
      </p>
      <p className="mt-2 text-xs text-ink-500">
        Users and captures are AUTO. Missing marketing is shown as — , never as
        a fake zero miss.
      </p>
    </div>
  );
}

function YesterdayCard({
  row,
  targets,
  totalDays,
  adSpendCurrency,
  requiredUsers,
  requiredCaptures,
  onEdit,
}: {
  row: GrowthDaily | null;
  targets: GrowthTargets;
  totalDays: number;
  adSpendCurrency?: string | null;
  requiredUsers: number;
  requiredCaptures: number;
  onEdit: (row: GrowthDaily) => void;
}) {
  if (!row) return null;
  const comparableSpend = comparableSpendTotal(
    row.spendEntries ?? [],
    adSpendCurrency,
  );
  const dailySpend = targets.adSpend / Math.max(1, totalDays);
  const spendText = !row.hasMarketingEntry
    ? "Not entered"
    : !adSpendCurrency
      ? `${formatSpendEntries(row.spendEntries)} · budget currency not set`
      : comparableSpend == null
        ? `${formatSpendEntries(row.spendEntries)} · mixed currency, no budget comparison`
        : `${formatMoney(comparableSpend, adSpendCurrency)} / ${formatMoney(dailySpend, adSpendCurrency)}`;
  const organic = deriveOrganicTotals(row.organicEntries ?? []);
  return (
    <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-white">
            Yesterday · {dateLabel(row.date)}
          </h3>
          <p className="mt-1 text-xs font-black uppercase tracking-[.14em] text-primary-200">
            Finalized daily results
          </p>
        </div>
        <button
          onClick={() => onEdit(row)}
          className="rounded-lg border border-line-300 px-3 py-2 text-xs font-black text-white"
        >
          Edit {shortDate(row.date.slice(0, 7), row.day)}
        </button>
      </div>
      {!row.hasMarketingEntry ? (
        <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
          <p className="font-black">
            Yesterday’s marketing data hasn’t been entered yet.
          </p>
          <p className="mt-1 text-xs text-amber-100/80">
            Users and captures are automatic. External marketing is missing, not
            zero.
          </p>
        </div>
      ) : (
        <div className="mt-3 grid gap-2 text-sm text-ink-200">
          <p>Users {targetValue("", row.users, requiredUsers)}</p>
          <p>Captures {targetValue("", row.captures, requiredCaptures)}</p>
          <p>
            Social{" "}
            {organic.views > 0
              ? `${format(organic.views)} views · ${format(organic.posts)} posts`
              : format(row.marketing.socialViews)}
            {targets.socialViews > 0
              ? ` / ${format(dailyPaceTarget(targets.socialViews, totalDays))}`
              : ""}
          </p>
          <p>
            Google {format(row.marketing.searchClicks)}
            {targets.searchClicks > 0
              ? ` / ${format(dailyPaceTarget(targets.searchClicks, totalDays))}`
              : ""}
          </p>
          <p>
            Shorts {format(row.marketing.shortVideos)}
            {targets.shortVideos > 0
              ? ` / ${format(dailyPaceTarget(targets.shortVideos, totalDays))}`
              : ""}
          </p>
          <p>Spend {spendText}</p>
        </div>
      )}
    </div>
  );
}

export function GrowthCommandCenter({
  growth,
  month,
  reload,
}: {
  growth: GrowthData | null;
  month: string;
  reload: () => Promise<void>;
}) {
  const [chartMetric, setChartMetric] = useState<GrowthChartMetric>("users");
  const [editingDate, setEditingDate] = useState<GrowthDaily | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [editingNorthStar, setEditingNorthStar] = useState(false);
  const [marketingError, setMarketingError] = useState("");
  const [marketingSaving, setMarketingSaving] = useState(false);
  const plan = growth?.plan;
  const actuals = growth?.actuals ?? emptyGrowthTargets;
  const totalDays = growth?.totalDays ?? daysInMonth(month);
  const currentDay = growth?.currentDay ?? 0;
  const todayMonth =
    growth?.today?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
  const planState: "past" | "current" | "upcoming" =
    month < todayMonth ? "past" : month > todayMonth ? "upcoming" : "current";
  const isUpcoming = planState === "upcoming";
  const isCurrent = planState === "current";
  const todayRow = isCurrent
    ? ((growth?.daily ?? []).find((row) => row.date === growth?.today) ?? null)
    : null;
  const manualThroughDay =
    growth?.manualReportingThroughDay ??
    (isCurrent
      ? Math.max(0, currentDay - 1)
      : planState === "past"
        ? totalDays
        : 0);
  const reportingRow =
    manualThroughDay > 0
      ? ((growth?.daily ?? []).find((row) => row.day === manualThroughDay) ??
        null)
      : null;
  const userTarget = plan?.targets.users ?? 0;
  const userStatus = isUpcoming
    ? "future"
    : statusForMetric(
        actuals.users,
        expectedByDay(userTarget, currentDay || totalDays, totalDays),
      );
  const planned = growth?.plannedPace ?? dailyPaceTarget(userTarget, totalDays);
  const required = 
    growth?.requiredPace ??
    requiredPerDay(actuals.users, userTarget, currentDay || 1, totalDays);
  const currentPace = paceNumber(actuals.users, currentDay || 1);
  const elapsed = timeElapsedPercent(currentDay, totalDays);
  const socialIdeaCount = (() => {
    if (!plan) return 0;
    const ideaDay = currentDay || totalDays;
    let shortsSoFar = 0;
    for (const row of growth?.daily ?? []) {
      if (row.day >= ideaDay) break;
      if (row.hasMarketingEntry) shortsSoFar += row.marketing.shortVideos;
    }
    return rollingRequiredPerDay(
      plan.targets.shortVideos,
      shortsSoFar,
      ideaDay,
      totalDays,
    );
  })();
  const dailyRows = (() => {
    if (!plan) return [];
    let usersSoFar = 0;
    let capturesSoFar = 0;
    let socialSoFar = 0;
    let clicksSoFar = 0;
    let spendSoFar = 0;
    let shortsSoFar = 0;
    let seoSoFar = 0;
    return (growth?.daily ?? []).map((row) => {
      const future =
        isUpcoming || (growth?.today ? row.date > growth.today : false);
      const today = isCurrent && row.date === growth?.today;
      const hasManualEntry = Boolean(row.hasMarketingEntry);
      const status = statusForMetric(row.users, required, {
        future,
      });
      const dayIndex = row.day;
      const socialTarget = rollingRequiredPerDay(
        plan.targets.socialViews,
        socialSoFar,
        dayIndex,
        totalDays,
      );
      const clicksTarget = rollingRequiredPerDay(
        plan.targets.searchClicks,
        clicksSoFar,
        dayIndex,
        totalDays,
      );
      const shortsTarget = rollingRequiredPerDay(
        plan.targets.shortVideos,
        shortsSoFar,
        dayIndex,
        totalDays,
      );
      const seoTarget = rollingRequiredPerDay(
        plan.targets.seoPages,
        seoSoFar,
        dayIndex,
        totalDays,
      );
      const spendActual = comparableSpendTotal(
        row.spendEntries ?? [],
        plan.adSpendCurrency,
      );
      const spendTarget = rollingRequiredPerDay(
        plan.targets.adSpend,
        spendSoFar,
        dayIndex,
        totalDays,
      );
      usersSoFar += row.users;
      capturesSoFar += row.captures;
      socialSoFar += row.hasMarketingEntry ? row.marketing.socialViews : 0;
      clicksSoFar += row.hasMarketingEntry ? row.marketing.searchClicks : 0;
      spendSoFar += spendActual ?? 0;
      shortsSoFar += row.hasMarketingEntry ? row.marketing.shortVideos : 0;
      seoSoFar += row.hasMarketingEntry ? row.marketing.seoPages : 0;
      const manualStatus = manualStatusForDaily({
        date: row.date,
        today: growth?.today ?? row.date,
        hasEntry: hasManualEntry,
        actual: row.marketing.socialViews,
        expected: socialTarget,
      });
      return (
        <tr
          key={row.date}
          className={today ? "bg-primary-500/[.08]" : "odd:bg-white/[.02]"}
        >
          <td className="px-2.5 py-1.5 font-bold text-white">
            {shortDate(month, row.day)}
          </td>
          <td className="px-2.5 py-1.5">
            {future ? "—" : (
              <MetricProgress
                actual={row.users}
                target={today ? required : rollingRequiredPerDay(
                  plan.targets.users,
                  usersSoFar - row.users,
                  dayIndex,
                  totalDays,
                )}
              />
            )}
          </td>
          <td className="px-2.5 py-1.5">
            {future ? "—" : (
              <MetricProgress
                actual={row.captures}
                target={rollingRequiredPerDay(
                  plan.targets.captures,
                  capturesSoFar - row.captures,
                  dayIndex,
                  totalDays,
                )}
              />
            )}
          </td>
          <td className="px-2.5 py-1.5">
            {future ? "—" : today && !hasManualEntry ? (
              <MetricProgress actual="Pending" target={socialTarget} />
            ) : hasManualEntry ? (
              <MetricProgress actual={row.marketing.socialViews} target={socialTarget} />
            ) : (
              <MetricProgress actual="Not entered" target={socialTarget} />
            )}
          </td>
          <td className="px-2.5 py-1.5">
            {future ? "—" : today && !hasManualEntry ? (
              <MetricProgress actual="Pending" target={clicksTarget} />
            ) : hasManualEntry ? (
              <MetricProgress actual={row.marketing.searchClicks} target={clicksTarget} />
            ) : (
              <MetricProgress actual="Not entered" target={clicksTarget} />
            )}
          </td>
          <td className="px-2.5 py-1.5">
            {future ? "—" : today && !hasManualEntry ? (
              <MetricProgress actual="Pending" target={spendTarget} money currencyCode={plan.adSpendCurrency} />
            ) : hasManualEntry ? spendActual == null ? formatSpendEntries(row.spendEntries) : (
              <MetricProgress actual={spendActual} target={spendTarget} money currencyCode={plan.adSpendCurrency} />
            ) : (
              <MetricProgress actual="Not entered" target={spendTarget} money currencyCode={plan.adSpendCurrency} />
            )}
          </td>
          <td className="px-2.5 py-1.5">
            {future ? "—" : today && !hasManualEntry ? (
              <MetricProgress actual="Pending" target={shortsTarget} />
            ) : hasManualEntry ? (
              <MetricProgress actual={row.marketing.shortVideos} target={shortsTarget} />
            ) : (
              <MetricProgress actual="Not entered" target={shortsTarget} />
            )}
          </td>
          <td className="px-2.5 py-1.5">
            {future ? "—" : today && !hasManualEntry ? (
              <MetricProgress actual="Pending" target={seoTarget} />
            ) : hasManualEntry ? (
              <MetricProgress actual={row.marketing.seoPages} target={seoTarget} />
            ) : (
              <MetricProgress actual="Not entered" target={seoTarget} />
            )}
          </td>
          <td className="px-2.5 py-1.5">
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black ${statusClass(today ? "pending" : manualStatus === "pending" || manualStatus === "missing" ? manualStatus : status)}`}
            >
              {today
                ? "AUTO TODAY"
                : statusLabel(
                    manualStatus === "pending" || manualStatus === "missing"
                      ? manualStatus
                      : status,
                  )}
            </span>
          </td>
          <td className="px-2.5 py-1.5">
            {!future ? (
              <button
                onClick={() => {
                  setMarketingError("");
                  setEditingDate(row);
                }}
                className="text-[11px] font-black text-primary-100"
              >
                Edit
              </button>
            ) : null}
          </td>
        </tr>
      );
    });
  })();
  const complete = percentOf(actuals.users, userTarget);
  const recovery = buildRecoveryPlan({
    actualUsers: actuals.users,
    targetUsers: userTarget,
    currentDay: currentDay || 1,
    totalDays,
    dailyUsers: (growth?.daily ?? []).map((row) => row.users),
    snapshots: (growth?.primaryMarketingSnapshots ?? []).map((row) => ({
      source: row.source,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      metric: row.metric,
      value: row.value,
      currency: row.currency,
    })),
  });
  const currentWeek = isUpcoming
    ? plan?.weeklyTargets?.[0]
    : ((plan?.weeklyTargets ?? []).find(
        (week) => currentDay >= week.startDay && currentDay <= week.endDay,
      ) ?? plan?.weeklyTargets?.[0]);
  const currentWeekReport =
    !isUpcoming && currentWeek
      ? growth?.weeklyActuals?.find((row) => row.label === currentWeek.label)
      : null;
  const currentJobs =
    (plan?.weeklyActionPlans ?? []).find(
      (week) =>
        currentWeek &&
        (week.startDay === currentWeek.startDay ||
          (week.startDay <= currentWeek.endDay &&
            week.endDay >= currentWeek.startDay)),
    );
  const currentJobItems = currentJobs?.items?.length
    ? currentJobs.items
    : plan?.weeklyActionPlans?.length
      ? []
      : defaultJobs;
  const spendFormRows = editingDate
    ? [
        ...(editingDate.spendEntries?.length ? editingDate.spendEntries : []),
        ...Array.from(
          { length: Math.max(1, 3 - (editingDate.spendEntries?.length ?? 0)) },
          () => ({
            platform: "google_ads" as const,
            currencyCode: plan?.adSpendCurrency ?? "IDR",
            amount: 0,
          }),
        ),
      ]
    : [];
  const organicFormRows = organicPlatforms.map(
    (platform) =>
      editingDate?.organicEntries?.find(
        (entry) => entry.platform === platform,
      ) ?? { platform, posts: 0, views: 0 },
  );

  async function saveMarketing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDate || marketingSaving) return;
    const form = new FormData(event.currentTarget);
    const spendEntries = form
      .getAll("spendAmount")
      .flatMap((rawAmount, index) => {
        const amount = Number(rawAmount || 0);
        if (!Number.isFinite(amount) || amount <= 0) return [];
        return [
          {
            platform: String(
              form.getAll("spendPlatform")[index] || "google_ads",
            ),
            currencyCode: String(form.getAll("spendCurrency")[index] || "IDR"),
            amount,
          },
        ];
      });
    const organicEntries = organicPlatforms.flatMap((platform, index) => {
      const posts = Number(form.getAll("organicPosts")[index] || 0);
      const views = Number(form.getAll("organicViews")[index] || 0);
      if (
        (!Number.isFinite(posts) || posts <= 0) &&
        (!Number.isFinite(views) || views <= 0)
      )
        return [];
      return [
        { platform, posts: Math.max(0, posts), views: Math.max(0, views) },
      ];
    });
    const derivedShortVideos = deriveShortVideoCount(organicEntries);
    setMarketingError("");
    setMarketingSaving(true);
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-marketing",
          date: editingDate.date,
          marketing: {
            socialViews: form.get("socialViews"),
            searchClicks: form.get("searchClicks"),
            paidUsers: form.get("paidUsers"),
            shortVideos: organicEntries.length
              ? derivedShortVideos
              : editingDate.marketing.shortVideos,
            seoPages: form.get("seoPages"),
            spendEntries,
            organicEntries,
            notes: form.get("notes"),
          },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        setMarketingError(body.error || "Unable to save marketing data");
        return;
      }
      await reload();
      setEditingDate(null);
    } finally {
      setMarketingSaving(false);
    }
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">
            Growth control
          </p>
          <h2 className="mt-1 font-display text-3xl text-white">
            {monthLabel(month)}
          </h2>
          <p className="text-xs text-ink-500">
            Asia/Jakarta calendar ·{" "}
            <span className="font-black uppercase text-primary-100">
              {planState}
            </span>
          </p>
        </div>
      </div>

      {editingNorthStar ? (
        <NorthStarForm
          source={growth?.northStar}
          onCancel={() => setEditingNorthStar(false)}
          onSaved={reload}
        />
      ) : (
        <NorthStarCard
          goal={growth?.northStar}
          trajectory={growth?.trajectory}
          totalUsers={growth?.totalUsers ?? 0}
          onEdit={() => setEditingNorthStar(true)}
        />
      )}

      {plan && userTarget > 0 ? (
        <div className={`rounded-2xl border p-5 ${statusClass(userStatus)}`}>
          <p className="text-sm font-black">
            {monthLabel(month).toUpperCase()} GROWTH
          </p>
          <h3 className="mt-2 font-display text-5xl text-white">
            {isUpcoming
              ? format(userTarget)
              : `${format(actuals.users)} / ${format(userTarget)}`}{" "}
            new users
          </h3>
          {!isUpcoming ? (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[.08]">
              <div
                className={`h-full rounded-full ${progressFillClass(userStatus)}`}
                style={{ width: `${Math.min(100, complete ?? 0)}%` }}
              />
            </div>
          ) : null}
          {isUpcoming ? (
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <p>Target {format(userTarget)}</p>
              <p>Planned pace {planned}/day</p>
              <p>Actual users —</p>
              <p>Retention —</p>
            </div>
          ) : planState === "past" ? (
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <p>
                Final result {format(actuals.users)} / {format(userTarget)}
              </p>
              <p>
                {actuals.users >= userTarget
                  ? `Finished ${format(actuals.users - userTarget)} ahead of target`
                  : `Finished ${format(userTarget - actuals.users)} behind target`}
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <p>
                {format(Math.max(0, userTarget - actuals.users))} users
                remaining
              </p>
              <p>
                {format(Math.max(0, totalDays - currentDay))} days remaining
              </p>
              <p>Current pace {currentPace}/day</p>
              <p>Required from today {required}/day</p>
            </div>
          )}
          <p className="mt-3 text-sm font-black">
            {isUpcoming ? "UPCOMING" : statusLabel(userStatus)}
          </p>
          <p className="mt-2 text-xs text-ink-200">
            {complete ?? 0}% complete · {elapsed}% time elapsed · original
            planned pace {planned}/day
          </p>
          <p className="mt-2 text-xs text-ink-400">
            {plan.usersTargetSource === "generated"
              ? "Generated from long-term growth plan"
              : plan.usersTargetSource === "override"
                ? "Manual monthly override"
                : "No user target"}{" "}
            ·{" "}
            <button
              className="font-black text-primary-100"
              onClick={() => setEditingPlan(true)}
            >
              Adjust
            </button>
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-line-300 bg-surface-900 p-5">
          <p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">
            Current month
          </p>
          <h3 className="mt-2 font-display text-4xl text-white">
            {format(actuals.users)} new users
          </h3>
          <p className="mt-2 text-sm text-ink-400">
            Automatic AnimalDex actuals. Set a North Star so this month gets a
            generated user target instead of asking you to invent one.
          </p>
        </div>
      )}

      {isCurrent && plan && userTarget > 0 && userStatus !== "on_target" ? (
        <section className="rounded-2xl border border-red-400/30 bg-red-500/[.06] p-5">
          <p className="text-xs font-black uppercase tracking-[.18em] text-red-200">
            Get back on track
          </p>
          <h3 className="mt-2 font-display text-3xl text-white">
            You need {format(recovery.remainingUsers)} users in{" "}
            {format(recovery.remainingDays)} days ·{" "}
            {format(recovery.requiredPerDay)}/day
          </h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-line-300 bg-canvas-900 p-3">
              <p className="text-[10px] font-black uppercase text-ink-500">
                Recent pace
              </p>
              <p className="mt-1 font-display text-2xl text-white">
                {recovery.recentAveragePerDay}/day
              </p>
              <p className="text-xs text-ink-500">last 7 available days</p>
            </div>
            <div className="rounded-lg border border-line-300 bg-canvas-900 p-3">
              <p className="text-[10px] font-black uppercase text-ink-500">
                Expected finish
              </p>
              <p className="mt-1 font-display text-2xl text-white">
                {format(recovery.projectedMonthEnd)} / {format(userTarget)}
              </p>
              <p className="text-xs text-ink-500">if recent pace repeats</p>
            </div>
            <div className="rounded-lg border border-line-300 bg-canvas-900 p-3">
              <p className="text-[10px] font-black uppercase text-ink-500">
                Best observed finish
              </p>
              <p className="mt-1 font-display text-2xl text-white">
                {format(recovery.bestObservedProjectedMonthEnd)} /{" "}
                {format(userTarget)}
              </p>
              <p
                className={`text-xs ${recovery.targetLikely ? "text-primary-100" : "text-red-200"}`}
              >
                {recovery.targetLikely
                  ? "Target remains feasible at observed performance"
                  : "Target unlikely at recorded performance"}
              </p>
            </div>
          </div>
          {recovery.evidence.length ? (
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {recovery.evidence.map((item) => (
                <div
                  key={`${item.source}-${item.currency}`}
                  className="rounded-lg border border-primary-400/20 bg-primary-500/[.06] p-3"
                >
                  <p className="font-black capitalize text-white">
                    {item.source.replace(/_/g, " ")}
                  </p>
                  <p className="mt-1 text-xs text-ink-300">
                    {format(item.registeredUsers)} attributed users ·{" "}
                    {item.confidence} confidence
                  </p>
                  {item.cpa != null ? (
                    <p className="mt-2 text-sm font-bold text-primary-100">
                      Remaining-user budget ≈{" "}
                      {formatMoney(
                        item.cpa * recovery.remainingUsers,
                        item.currency,
                      )}
                    </p>
                  ) : null}
                  {item.usersPerThousandViews != null ? (
                    <p className="mt-2 text-sm font-bold text-primary-100">
                      Required reach ≈{" "}
                      {format(
                        Math.ceil(
                          (recovery.requiredPerDay /
                            item.usersPerThousandViews) *
                            1000,
                        ),
                      )}{" "}
                      views/day
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {recovery.blockers.length ? (
            <div className="mt-4 rounded-lg border border-amber-300/25 bg-amber-400/[.07] p-3">
              <p className="text-xs font-black uppercase tracking-[.12em] text-amber-200">
                Insufficient attribution data
              </p>
              {recovery.blockers.map((blocker) => (
                <p key={blocker} className="mt-1 text-xs text-amber-100/80">
                  {blocker}
                </p>
              ))}
              <p className="mt-2 text-xs text-ink-400">
                Reported installs and clicks remain channel evidence only. Add
                attributed registered-user snapshots to unlock paid, organic and
                mixed recovery options.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {isCurrent && plan ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <TodayCard
            row={todayRow}
            targets={plan.targets}
            requiredUsers={required}
            requiredCaptures={requiredPerDay(
              actuals.captures,
              plan.targets.captures,
              currentDay || 1,
              totalDays,
            )}
            totalDays={totalDays}
            onEdit={(row) => {
              setMarketingError("");
              setEditingDate(row);
            }}
          />
          <YesterdayCard
            row={reportingRow}
            targets={plan.targets}
            totalDays={totalDays}
            adSpendCurrency={plan.adSpendCurrency}
            requiredUsers={planned}
            requiredCaptures={dailyPaceTarget(plan.targets.captures, totalDays)}
            onEdit={(row) => {
              setMarketingError("");
              setEditingDate(row);
            }}
          />
        </div>
      ) : null}

      {!isUpcoming ? (
        <GrowthVelocityChart
          rows={(growth?.daily ?? []).filter(
            (row) => !growth?.today || row.date <= growth.today,
          )}
        />
      ) : null}

      <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
        <h3 className="text-xs font-black uppercase tracking-[.18em] text-primary-200">
          Manual boundary
        </h3>
        <p className="mt-2 text-sm text-white">
          Update today is the canonical source for{" "}
          <span className="font-black text-primary-100">
            platform posts/views · Google clicks · Ad spend · Shorts · SEO
          </span>
          .
        </p>
        <p className="mt-1 text-xs text-ink-500">
          Users, captures, Active Pro, retention and production purchases are
          AUTO. Planned pace and required/day are DERIVED. Missing manual data
          is never scored as zero.
        </p>
      </div>

      {plan ? (
        <>
          <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
            <h3 className="text-xs font-black uppercase tracking-[.18em] text-primary-200">
              Core funnel
            </h3>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              {[
                {
                  label: "New users",
                  value: isUpcoming ? null : actuals.users,
                  sub: isUpcoming ? "UPCOMING" : "AUTO · cohort",
                },
                {
                  label: "Activated",
                  value: isUpcoming
                    ? null
                    : (growth?.funnel?.activatedUsers ?? 0),
                  sub:
                    (growth?.funnel?.activationEligibleUsers ?? 0) > 0
                      ? `${growth?.funnel?.activationRate ?? "-"}% · ${format(growth?.funnel?.activatedUsers ?? null)} / ${format(growth?.funnel?.activationEligibleUsers ?? null)} eligible`
                      : "Not enough data yet",
                },
                {
                  label: "Retained D7",
                  value: isUpcoming
                    ? null
                    : (growth?.funnel?.d7RetainedUsers ?? 0),
                  sub:
                    (growth?.funnel?.d7EligibleUsers ?? 0) > 0
                      ? `${growth?.funnel?.d7RetentionRate ?? "-"}% · ${format(growth?.funnel?.d7RetainedUsers ?? null)} / ${format(growth?.funnel?.d7EligibleUsers ?? null)} mature`
                      : "Not enough mature users yet",
                },
                {
                  label: "Paying",
                  value: isUpcoming
                    ? null
                    : (growth?.funnel?.cohortFirstTimePurchasers ?? 0),
                  sub: isUpcoming
                    ? "UPCOMING"
                    : `${growth?.funnel?.payerConversionRate ?? 0}% of signup cohort paid`,
                },
              ].map((item, index) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 rounded-lg border border-line-300 bg-canvas-900 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[.12em] text-ink-500">
                      {item.label}
                    </p>
                    <p className="font-display text-2xl text-white">
                      {item.value == null ? "—" : format(item.value)}
                    </p>
                    <p className="text-[11px] text-ink-400">{item.sub}</p>
                  </div>
                  {index < 3 ? (
                    <span className="hidden text-ink-500 md:block">→</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-[.9fr_1fr_.8fr]">
            <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
              <h3 className="font-display text-2xl text-white">This week</h3>
              {currentWeek ? (
                <>
                  <p className="mt-1 text-sm text-ink-400">
                    {shortDate(month, currentWeek.startDay)}–
                    {shortDate(month, currentWeek.endDay)}
                  </p>
                  <p className="mt-3 text-2xl font-black text-white">
                    {format(currentWeekReport?.actuals.users ?? 0)} /{" "}
                    {format(currentWeek.targets.users)} users
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    Need{" "}
                    {format(
                      requiredPerDay(
                        currentWeekReport?.actuals.users ?? 0,
                        currentWeek.targets.users,
                        Math.max(
                          1,
                          Math.min(currentDay, currentWeek.endDay) -
                            currentWeek.startDay +
                            1,
                        ),
                        currentWeek.endDay - currentWeek.startDay + 1,
                      ),
                    )}
                    /day · expected{" "}
                    {format(
                      expectedByWeekDay(
                        currentWeek.targets.users,
                        Math.max(
                          0,
                          Math.min(currentDay, currentWeek.endDay) -
                            currentWeek.startDay +
                            1,
                        ),
                        currentWeek.endDay - currentWeek.startDay + 1,
                      ),
                    )}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-400">
                  No weekly target yet.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
              <h3 className="font-display text-2xl text-white">
                Organic execution
              </h3>
              <p className="mt-3 text-sm">
                Shorts{" "}
                {isUpcoming
                  ? "—"
                  : format(currentWeekReport?.actuals.shortVideos ?? 0)}
                {currentWeek && currentWeek.targets.shortVideos > 0
                  ? ` / ${format(currentWeek.targets.shortVideos)}`
                  : ""}
              </p>
              <p className="text-sm">
                SEO pages{" "}
                {isUpcoming
                  ? "—"
                  : format(currentWeekReport?.actuals.seoPages ?? 0)}
                {currentWeek && currentWeek.targets.seoPages > 0
                  ? ` / ${format(currentWeek.targets.seoPages)}`
                  : ""}
              </p>
              <p className="text-sm">
                Social{" "}
                {isUpcoming
                  ? "—"
                  : format(currentWeekReport?.actuals.socialViews ?? 0)}
                {currentWeek && currentWeek.targets.socialViews > 0
                  ? ` / ${format(currentWeek.targets.socialViews)}`
                  : ""}{" "}
                reported through{" "}
                {manualThroughDay > 0
                  ? shortDate(
                      month,
                      Math.min(
                        manualThroughDay,
                        currentWeek?.endDay ?? manualThroughDay,
                      ),
                    )
                  : "none"}
              </p>
            </div>
            <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
              <h3 className="font-display text-2xl text-white">
                Needs attention
              </h3>
              {growth?.funnel?.needsAttention?.length ? (
                <ul className="mt-3 space-y-2 text-sm text-ink-200">
                  {growth.funnel.needsAttention.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-ink-400">
                  No major issues in this {planState} month.
                </p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl text-white">
                This week’s jobs
              </h3>
              <button
                onClick={() => setEditingPlan(true)}
                className="text-xs font-black text-primary-100"
              >
                Edit
              </button>
            </div>
            {currentJobItems.length ? (
              <ul className="mt-3 grid gap-2 text-sm text-ink-200 md:grid-cols-2">
                {currentJobItems.map((item) => (
                  <li key={item}>☐ {item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-400">
                No jobs were planned for this week.
              </p>
            )}
          </div>
          <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-display text-2xl text-white">
                  {growthMeta[chartMetric].label}
                </h3>
                <p className="text-xs text-ink-500">
                  Actual vs target trajectory
                </p>
              </div>
              <div className="flex flex-wrap gap-1 rounded-lg border border-line-300 bg-canvas-900 p-1">
                {(
                  [
                    "users",
                    "captures",
                    "socialViews",
                    "searchClicks",
                  ] as GrowthChartMetric[]
                ).map((key) => (
                  <button
                    key={key}
                    onClick={() => setChartMetric(key)}
                    className={`rounded-md px-2 py-1.5 text-[11px] font-black ${chartMetric === key ? "bg-primary-500 text-canvas-950" : "text-ink-400"}`}
                  >
                    {growthMeta[key].short}
                  </button>
                ))}
              </div>
            </div>
            <MiniChart
              rows={isUpcoming ? [] : (growth?.daily ?? [])}
              metric={chartMetric}
              target={plan.targets[chartMetric]}
            />
          </div>
          <details className="rounded-xl border border-line-300 bg-surface-900 p-4">
            <summary className="cursor-pointer font-display text-2xl text-white">
              Daily details
            </summary>
            <div className="mt-3 max-h-[30rem] overflow-auto rounded-lg border border-line-300">
              <table className="min-w-[980px] w-full text-left text-xs">
                <thead className="sticky top-0 bg-canvas-900 text-[10px] uppercase tracking-[.12em] text-ink-500">
                  <tr>
                    {[
                      "Date",
                      "Users",
                      "Captures",
                      "Social",
                      "Clicks",
                      "Spend",
                      "Shorts",
                      "SEO",
                      "Status",
                      "",
                    ].map((head) => (
                      <th key={head} className="px-2.5 py-2">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>{dailyRows}</tbody>
              </table>
            </div>
          </details>
          <SocialPagesPanel
            pages={growth?.socialPages ?? []}
            history={growth?.socialIdeaHistory ?? []}
            ideaCount={socialIdeaCount}
            onSaved={reload}
          />
          <div className="flex flex-wrap gap-2">
            {todayRow ? (
              <button
                onClick={() => {
                  setMarketingError("");
                  setEditingDate(todayRow);
                }}
                className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950"
              >
                Update today
              </button>
            ) : null}
            <button
              onClick={() => setEditingPlan(true)}
              className="rounded-lg border border-line-300 px-4 py-2 text-sm font-black text-white"
            >
              Edit month targets
            </button>
          </div>
        </>
      ) : null}

      {editingPlan && plan ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto">
            <PlanForm
              month={month}
              source={plan}
              activeDay={(currentWeek?.startDay ?? currentDay) || 1}
              generatedUsers={
                plan.generatedUsers ??
                growth?.trajectory?.months.find((row) => row.month === month)
                  ?.generatedTarget
              }
              onSaved={reload}
              onCancel={() => setEditingPlan(false)}
            />
          </div>
        </div>
      ) : null}
      {editingDate ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4">
          <form
            onSubmit={saveMarketing}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-line-300 bg-surface-900 p-5 shadow-2xl"
          >
            <h3 className="font-display text-2xl text-white">
              {editingDate.date === growth?.today
                ? "Update today"
                : `Update ${shortDate(month, editingDate.day)}`}
            </h3>
            <p className="mt-1 text-xs text-ink-500">
              Canonical manual source. AnimalDex users/captures stay automatic.
              Empty fields mean not entered, not zero.
            </p>
            <p className="mt-4 text-xs font-black uppercase tracking-[.16em] text-primary-200">
              Publishing &amp; social reach
            </p>
            <label className="mt-3 block text-sm font-bold text-ink-300">
              Total social views
              <span className="mt-1 block text-[11px] font-normal text-ink-500">
                Use this for a combined or unattributed total. If you enter
                platform views below, their sum becomes the total instead.
              </span>
              <input
                name="socialViews"
                type="number"
                min="0"
                step="1"
                defaultValue={
                  editingDate.organicEntries?.length
                    ? ""
                    : editingDate.marketing.socialViews || ""
                }
                placeholder="combined views"
                className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-white outline-none focus:border-primary-300"
              />
            </label>
            <p className="mt-4 text-xs text-ink-400">
              Enter posts and views once per platform. Cross-posted videos are
              counted once toward the Shorts target using the highest platform
              post count.
            </p>
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-1 text-[10px] font-black uppercase tracking-[.12em] text-ink-500">
                <span>Platform</span>
                <span>Posts</span>
                <span>Views</span>
              </div>
              {organicFormRows.map((entry) => (
                <div
                  key={entry.platform}
                  className="grid grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] gap-2"
                >
                  <p className="self-center text-xs font-bold text-white">
                    {organicPlatformLabels[entry.platform]}
                  </p>
                  <input
                    name="organicPosts"
                    type="number"
                    min="0"
                    placeholder="posts"
                    defaultValue={entry.posts || ""}
                    className="min-w-0 w-full rounded-xl border border-line-300 bg-canvas-900 px-2 py-2 text-white outline-none focus:border-primary-300"
                  />
                  <input
                    name="organicViews"
                    type="number"
                    min="0"
                    placeholder="views"
                    defaultValue={entry.views || ""}
                    className="min-w-0 w-full rounded-xl border border-line-300 bg-canvas-900 px-2 py-2 text-white outline-none focus:border-primary-300"
                  />
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-[.16em] text-primary-200">
              Search
            </p>
            <label className="mt-3 block text-sm font-bold text-ink-300">
              Google Search clicks
              <input
                name="searchClicks"
                type="number"
                step="1"
                defaultValue={editingDate.marketing.searchClicks || ""}
                className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-white outline-none focus:border-primary-300"
              />
            </label>
            <label className="mt-3 block text-sm font-bold text-ink-300">
              SEO pages published
              <input
                name="seoPages"
                type="number"
                step="1"
                defaultValue={editingDate.marketing.seoPages || ""}
                className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-white outline-none focus:border-primary-300"
              />
            </label>
            <p className="mt-4 text-xs font-black uppercase tracking-[.16em] text-primary-200">
              Paid
            </p>
            <label className="mt-3 block text-sm font-bold text-ink-300">
              Ad spend
              <span className="mt-1 block text-[11px] text-ink-500">
                One row per ad platform/currency. Leave amount empty to skip.
              </span>
              <div className="mt-2 space-y-2">
                {spendFormRows.map((entry, index) => (
                  <div
                    key={index}
                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)]"
                  >
                    <select
                      name="spendPlatform"
                      defaultValue={entry.platform}
                      className="min-w-0 w-full rounded-xl border border-line-300 bg-canvas-900 px-2 py-2 text-white outline-none focus:border-primary-300"
                    >
                      <option value="google_ads">Google Ads</option>
                      <option value="tiktok_ads">TikTok Ads</option>
                      <option value="apple_search_ads">Apple Search Ads</option>
                      <option value="meta_ads">Meta Ads</option>
                      <option value="other">Other</option>
                    </select>
                    <select
                      name="spendCurrency"
                      defaultValue={entry.currencyCode}
                      className="min-w-0 w-full rounded-xl border border-line-300 bg-canvas-900 px-2 py-2 text-white outline-none focus:border-primary-300"
                    >
                      <option value="IDR">IDR</option>
                      <option value="GBP">GBP</option>
                      <option value="USD">USD</option>
                    </select>
                    <input
                      name="spendAmount"
                      type="number"
                      step="0.01"
                      defaultValue={entry.amount > 0 ? entry.amount : ""}
                      placeholder="not entered"
                      className="min-w-0 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-white outline-none focus:border-primary-300"
                    />
                  </div>
                ))}
              </div>
            </label>
            <label className="mt-3 block text-sm font-bold text-ink-300">
              Paid installs/users
              <input
                name="paidUsers"
                type="number"
                step="1"
                defaultValue={editingDate.marketing.paidUsers || ""}
                className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-white outline-none focus:border-primary-300"
              />
            </label>
            {marketingError ? (
              <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-sm text-red-200">
                {marketingError}
              </p>
            ) : null}
            <label className="mt-4 block text-sm font-bold text-ink-300">
              Notes
              <textarea
                name="notes"
                defaultValue={editingDate.marketing.notes}
                className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-white outline-none focus:border-primary-300"
              />
            </label>
            <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 flex gap-2 border-t border-line-300 bg-surface-900 px-5 py-4">
              <button
                disabled={marketingSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {marketingSaving ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-canvas-950/30 border-t-canvas-950" />
                ) : null}
                {marketingSaving
                  ? "Saving..."
                  : `Save ${shortDate(month, editingDate.day)}`}
              </button>
              <button
                type="button"
                onClick={() => setEditingDate(null)}
                className="rounded-xl border border-line-300 px-4 py-2 text-sm font-black text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
