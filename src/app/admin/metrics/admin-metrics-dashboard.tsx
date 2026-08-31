"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  formatMoney,
  growthMonthState,
  monthLabel,
  parseGrowthMonth,
  shiftMonth,
} from "@/lib/growth-command-center";
import {
  format,
  formatSpendByCurrency,
  GrowthCommandCenter,
  type GrowthData,
  type GrowthSnapshot,
} from "./growth-plan-panel";

type Period = "hour" | "day" | "week" | "month";
type SeriesRow = {
  date: string;
  users: number;
  captures: number;
  subscriptions: number;
  credits: number;
};
type PostType = "captures" | "alignments" | "fusions" | "challenges" | "trades";
type PostSeriesRow = { date: string } & Record<PostType, number>;
type Metrics = {
  period: Period;
  month: string;
  periodStart: string;
  periodEndExclusive: string;
  generatedAt: string;
  totals: {
    users: number | null;
    captures: number | null;
    activePro: number | null;
    productionPurchases: number | null;
  };
  kpis: Record<
    "users" | "captures" | "subscriptions" | "credits",
    { value: number; change: number }
  >;
  purchaseBreakdown: { production: number; sandbox: number };
  signIn: {
    total: number;
    providers: Record<string, number>;
    appleDeviceSignals: number;
    note: string;
  } | null;
  postActivity: {
    total: number;
    types: Record<PostType, { value: number; change: number }>;
    series: PostSeriesRow[];
  };
  series: SeriesRow[];
};
type SocialMetric = {
  platform: string;
  configured: boolean;
  followers: number | null;
  views: number | null;
  posts: number | null;
  followerChange?: number | null;
  viewChange?: number | null;
  error?: string;
};
type ChartMetric = "users" | "captures" | "subscriptions" | "credits";
type MetricsTab = "plan" | "acquisition" | "product" | "revenue";
type ChannelScorecard = {
  source: string;
  channel: "ORGANIC" | "PAID";
  reach: string;
  traffic: string;
  installs: string;
  spend: string;
  efficiency: string;
  range: string;
  badges: string[];
  rows: GrowthSnapshot[];
};

const tabs: Array<{ key: MetricsTab; label: string; description: string }> = [
  {
    key: "plan",
    label: "Growth Plan",
    description: "North Star, today’s required pace and Update today",
  },
  {
    key: "acquisition",
    label: "Acquisition",
    description: "Users, search, social and paid inputs",
  },
  {
    key: "product",
    label: "Product",
    description: "Captures and Discover activity",
  },
  {
    key: "revenue",
    label: "Revenue & Users",
    description: "Pro, purchases, accounts and LTV",
  },
];

const metricMeta: Record<
  ChartMetric,
  { label: string; color: string; description: string }
> = {
  users: {
    label: "New users",
    color: "#59f176",
    description: "Profiles created",
  },
  captures: {
    label: "Captures",
    color: "#57b8ff",
    description: "Animals captured",
  },
  subscriptions: {
    label: "New Pro",
    color: "#f6bd55",
    description: "Production Pro purchases",
  },
  credits: {
    label: "Credits bought",
    color: "#b997ff",
    description: "Purchased credit units",
  },
};

const postTypeMeta: Record<
  PostType,
  { shortLabel: string; color: string; description: string }
> = {
  captures: {
    shortLabel: "Captures",
    color: "#59f176",
    description: "Discoverable animal posts",
  },
  alignments: {
    shortLabel: "Alignments",
    color: "#57b8ff",
    description: "Shared accepted journal proofs",
  },
  fusions: {
    shortLabel: "Fusions",
    color: "#b997ff",
    description: "Learned principle events",
  },
  challenges: {
    shortLabel: "Challenges",
    color: "#f6bd55",
    description: "Completed animal matchups",
  },
  trades: {
    shortLabel: "Trades",
    color: "#ff7f8f",
    description: "Completed capture trades",
  },
};

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
function sourceLabel(source: string) {
  return source
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
function metricLabel(metric: string) {
  return metric
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
function formatCurrency(value: number | null, currency: string | null) {
  return formatMoney(value, currency);
}
function snapshotValue(rows: GrowthSnapshot[], source: string, metric: string) {
  return rows.find((row) => row.source === source && row.metric === metric);
}
function metadataNumber(row: GrowthSnapshot | undefined, key: string) {
  if (!row || !row.metadata || typeof row.metadata !== "object") return null;
  const value = (row.metadata as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}
function googleAndroidCpi(row: GrowthSnapshot | undefined) {
  if (!row || !row.metadata || typeof row.metadata !== "object") return null;
  const direct = metadataNumber(row, "reported_cost_per_install_idr");
  if (direct != null) return direct;
  const campaigns = (row.metadata as Record<string, unknown>).campaigns;
  if (!Array.isArray(campaigns)) return null;
  for (const campaign of campaigns) {
    if (!campaign || typeof campaign !== "object") continue;
    const value = (campaign as Record<string, unknown>)
      .reported_cost_per_install_idr;
    if (typeof value === "number") return value;
  }
  return null;
}
function snapshotSummary(rows: GrowthSnapshot[], source: string) {
  const sourceRows = rows.filter((row) => row.source === source);
  const first = sourceRows[0];
  return {
    rows: sourceRows,
    range: first
      ? `${dateLabel(first.periodStart)} – ${dateLabel(first.periodEnd)}`
      : "",
    primary: sourceRows.some((row) => row.aggregationRole === "primary"),
    supporting: sourceRows.some((row) => row.aggregationRole === "supporting"),
  };
}
function buildChannelScorecards(rows: GrowthSnapshot[]): ChannelScorecard[] {
  const tiktokOrganic = snapshotSummary(rows, "tiktok_organic");
  const googleSearch = snapshotSummary(rows, "google_search_console");
  const googleAds = snapshotSummary(rows, "google_ads");
  const tiktokAds = snapshotSummary(rows, "tiktok_ads");
  const appleSearchAds = snapshotSummary(rows, "apple_search_ads");
  const googleAdsSpend = snapshotValue(rows, "google_ads", "spend");
  const tiktokAdsSpend = snapshotValue(rows, "tiktok_ads", "spend");
  const appleSearchSpend = snapshotValue(rows, "apple_search_ads", "spend");
  const tiktokDestinationClicks = snapshotValue(
    rows,
    "tiktok_ads",
    "destination_clicks",
  );
  const gscClicks = snapshotValue(rows, "google_search_console", "clicks");
  const gscImpressions = snapshotValue(
    rows,
    "google_search_console",
    "impressions",
  );
  const appleInstalls = snapshotValue(rows, "apple_search_ads", "installs");
  const androidCpi = googleAndroidCpi(googleAdsSpend);
  const tiktokCpc =
    tiktokAdsSpend && tiktokDestinationClicks?.value
      ? tiktokAdsSpend.value / tiktokDestinationClicks.value
      : null;
  const gscCtr =
    gscClicks && gscImpressions?.value
      ? (gscClicks.value / gscImpressions.value) * 100
      : null;
  const appleCpa =
    appleSearchSpend && appleInstalls?.value
      ? appleSearchSpend.value / appleInstalls.value
      : null;
  return [
    {
      source: "TikTok Organic",
      channel: "ORGANIC" as const,
      reach: `${format(snapshotValue(rows, "tiktok_organic", "video_views")?.value ?? null)} views`,
      traffic: `${format(snapshotValue(rows, "tiktok_organic", "profile_views")?.value ?? null)} profile views`,
      installs: "—",
      spend: "Organic",
      efficiency: "engagement evidence only",
      range: tiktokOrganic.range,
      badges: ["IMPORTED"],
      rows: tiktokOrganic.rows,
    },
    {
      source: "TikTok Ads",
      channel: "PAID" as const,
      reach: `${format(snapshotValue(rows, "tiktok_ads", "impressions")?.value ?? null)} impressions`,
      traffic: `${format(tiktokDestinationClicks?.value ?? null)} destination clicks`,
      installs: "—",
      spend: formatCurrency(
        tiktokAdsSpend?.value ?? null,
        tiktokAdsSpend?.currency ?? null,
      ),
      efficiency:
        tiktokCpc == null
          ? "—"
          : `${formatCurrency(tiktokCpc, tiktokAdsSpend?.currency ?? null)}/destination click`,
      range: tiktokAds.range,
      badges: ["IMPORTED", "DERIVED"],
      rows: tiktokAds.rows,
    },
    {
      source: "Google Ads",
      channel: "PAID" as const,
      reach: `${format(snapshotValue(rows, "google_ads", "impressions")?.value ?? null)} impressions`,
      traffic: `~${format(snapshotValue(rows, "google_ads", "clicks")?.value ?? null)} clicks`,
      installs: `${format(snapshotValue(rows, "google_ads", "installs")?.value ?? null)} reported installs`,
      spend: `${formatCurrency(googleAdsSpend?.value ?? null, googleAdsSpend?.currency ?? null)} account spend`,
      efficiency:
        androidCpi == null
          ? "Reported Android CPI unavailable"
          : `Reported Android CPI: ${formatCurrency(androidCpi, "IDR")}`,
      range: googleAds.range,
      badges: ["IMPORTED"],
      rows: googleAds.rows,
    },
    {
      source: "Google Search",
      channel: "ORGANIC" as const,
      reach: `${format(gscImpressions?.value ?? null)} impressions`,
      traffic: `${format(gscClicks?.value ?? null)} clicks`,
      installs: "—",
      spend: "Organic",
      efficiency: gscCtr == null ? "—" : `CTR ${gscCtr.toFixed(2)}%`,
      range: googleSearch.range,
      badges: ["IMPORTED", "DERIVED"],
      rows: googleSearch.rows,
    },
    {
      source: "Apple Search Ads",
      channel: "PAID" as const,
      reach: `${format(snapshotValue(rows, "apple_search_ads", "impressions")?.value ?? null)} impressions`,
      traffic: `${format(snapshotValue(rows, "apple_search_ads", "taps")?.value ?? null)} taps`,
      installs: `${format(appleInstalls?.value ?? null)} reported installs`,
      spend: formatCurrency(
        appleSearchSpend?.value ?? null,
        appleSearchSpend?.currency ?? null,
      ),
      efficiency:
        appleCpa == null
          ? "—"
          : `~${formatCurrency(appleCpa, appleSearchSpend?.currency ?? null)}/install`,
      range: appleSearchAds.range,
      badges: ["IMPORTED", "DERIVED"],
      rows: appleSearchAds.rows,
    },
  ].filter((card) => card.rows.length);
}
function buildAcquisitionInsights(rows: GrowthSnapshot[]) {
  const tiktokViews = snapshotValue(rows, "tiktok_organic", "video_views");
  const googleInstalls = snapshotValue(rows, "google_ads", "installs");
  const googleSpend = snapshotValue(rows, "google_ads", "spend");
  const gscClicks = snapshotValue(rows, "google_search_console", "clicks");
  const gscImpressions = snapshotValue(
    rows,
    "google_search_console",
    "impressions",
  );
  const androidCpi = googleAndroidCpi(googleSpend);
  return [
    tiktokViews
      ? `TikTok Organic generated ${format(tiktokViews.value)} video views without recorded ad spend.`
      : null,
    googleInstalls && androidCpi != null
      ? `Google Ads reported ${format(googleInstalls.value)} Android installs at reported ${formatCurrency(androidCpi, "IDR")} campaign CPI.`
      : null,
    gscClicks && gscImpressions
      ? `Search generated ${format(gscClicks.value)} organic clicks from ${format(gscImpressions.value)} impressions.`
      : null,
  ]
    .filter(Boolean)
    .slice(0, 3) as string[];
}
function TrendChart({
  rows,
  metric,
  period,
}: {
  rows: SeriesRow[];
  metric: ChartMetric;
  period: Period;
}) {
  const max = Math.max(1, ...rows.map((row) => row[metric]));
  const gap = 900 / Math.max(rows.length, 1);
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 900 230" className="min-w-[520px] w-full" role="img">
        <line
          x1="0"
          x2="900"
          y1="205"
          y2="205"
          stroke="rgba(255,255,255,.08)"
        />
        {rows.map((row, index) => {
          const barHeight = (row[metric] / max) * 180;
          return (
            <g key={row.date}>
              <rect
                x={index * gap + gap * 0.19}
                y={205 - barHeight}
                width={Math.max(3, gap * 0.62)}
                height={barHeight}
                rx="4"
                fill={metricMeta[metric].color}
                opacity=".88"
              />
              <text
                x={index * gap + gap / 2}
                y="224"
                textAnchor="middle"
                fill="#84958b"
                fontSize="10"
              >
                {rows.length <= 12 || index % Math.ceil(rows.length / 8) === 0
                  ? new Intl.DateTimeFormat(
                      "en",
                      period === "hour"
                        ? { hour: "2-digit" }
                        : period === "month"
                          ? { month: "short" }
                          : { month: "short", day: "numeric" },
                    ).format(new Date(row.date))
                  : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
function PostTypeChart({
  rows,
  period,
}: {
  rows: PostSeriesRow[];
  period: Period;
}) {
  const keys = Object.keys(postTypeMeta) as PostType[];
  const max = Math.max(
    1,
    ...rows.map((row) => keys.reduce((sum, key) => sum + row[key], 0)),
  );
  const gap = 900 / Math.max(rows.length, 1);
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 900 240" className="min-w-[560px] w-full" role="img">
        {rows.map((row, index) => {
          let accumulated = 0;
          return (
            <g key={row.date}>
              {keys.map((key) => {
                const barHeight = (row[key] / max) * 190;
                const y = 205 - accumulated - barHeight;
                accumulated += barHeight;
                return (
                  <rect
                    key={key}
                    x={index * gap + gap * 0.16}
                    y={y}
                    width={Math.max(5, gap * 0.68)}
                    height={barHeight}
                    rx="2"
                    fill={postTypeMeta[key].color}
                  />
                );
              })}
              <text
                x={index * gap + gap / 2}
                y="228"
                textAnchor="middle"
                fill="#84958b"
                fontSize="10"
              >
                {rows.length <= 12 || index % Math.ceil(rows.length / 8) === 0
                  ? new Intl.DateTimeFormat(
                      "en",
                      period === "hour"
                        ? { hour: "2-digit" }
                        : period === "month"
                          ? { month: "short" }
                          : { month: "short", day: "numeric" },
                    ).format(new Date(row.date))
                  : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CollectorDepth({
  data,
}: {
  data: NonNullable<GrowthData["collectorAnalytics"]>;
}) {
  const max = Math.max(1, ...data.depth.map((row) => row.users));
  return (
    <section className="rounded-xl border border-line-300 bg-surface-900 p-4">
      <h2 className="font-display text-xl text-white">Collector depth</h2>
      <p className="mt-1 text-xs text-ink-500">
        How broadly qualifying captures are distributed across collectors in the
        selected month.
      </p>
      <div className="mt-4 space-y-3">
        {data.depth.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[72px_1fr_92px] items-center gap-3"
          >
            <p className="text-xs font-black text-white">
              {row.label} {row.label === "1" ? "capture" : "captures"}
            </p>
            <div className="h-5 overflow-hidden rounded bg-white/[.06]">
              <div
                className="h-full rounded bg-primary-400/80"
                style={{ width: `${(row.users / max) * 100}%` }}
              />
            </div>
            <p className="text-right text-xs text-ink-300">
              {format(row.users)} · {row.percent}%
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CaptureRetention({
  data,
}: {
  data: NonNullable<GrowthData["collectorAnalytics"]>;
}) {
  const rows = data.retention.slice(-8);
  return (
    <section className="rounded-xl border border-line-300 bg-surface-900 p-4">
      <h2 className="font-display text-xl text-white">Capture retention</h2>
      <p className="mt-1 text-xs text-ink-500">
        Activation-date cohorts · Asia/Jakarta calendar days · immature cells
        are excluded.
      </p>
      {rows.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[700px] w-full text-center text-xs">
            <thead className="text-[10px] uppercase text-ink-500">
              <tr>
                <th className="px-2 py-2 text-left">D0 cohort</th>
                <th className="px-2 py-2">Collectors</th>
                {Array.from({ length: 8 }, (_, day) => (
                  <th key={day} className="px-2 py-2">
                    D{day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.cohort} className="border-t border-line-300">
                  <td className="px-2 py-2 text-left font-bold text-white">
                    {row.cohort.slice(5)}
                  </td>
                  <td className="px-2 py-2 text-ink-300">{row.size}</td>
                  {row.days.map((value, day) => (
                    <td key={day} className="px-1 py-1">
                      <span
                        className={`block rounded px-2 py-2 ${value == null ? "bg-white/[.03] text-ink-600" : "text-white"}`}
                        style={
                          value == null
                            ? undefined
                            : {
                                backgroundColor: `rgba(89,241,118,${Math.max(0.08, (value / 100) * 0.75)})`,
                              }
                        }
                      >
                        {value == null ? "—" : `${value}%`}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-400">
          Not enough activated collectors yet.
        </p>
      )}
    </section>
  );
}

function CollectorActivity({
  data,
}: {
  data: NonNullable<GrowthData["collectorAnalytics"]>;
}) {
  const maxCaptures = Math.max(1, ...data.activity.map((row) => row.captures));
  const maxCollectors = Math.max(
    1,
    ...data.activity.map((row) => row.collectors),
  );
  const width = 900 / Math.max(1, data.activity.length);
  const points = data.activity
    .map(
      (row, index) =>
        `${index * width + width / 2},${190 - (row.collectors / maxCollectors) * 160}`,
    )
    .join(" ");
  return (
    <section className="rounded-xl border border-line-300 bg-surface-900 p-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl text-white">Capture activity</h2>
          <p className="mt-1 text-xs text-ink-500">
            Daily qualifying captures and unique collectors · selected month.
          </p>
        </div>
        <p className="text-[10px] text-ink-400">
          <span className="text-primary-300">■</span> captures ·{" "}
          <span className="text-sky-300">●</span> collectors
        </p>
      </div>
      {data.activity.length ? (
        <div className="mt-3 overflow-x-auto">
          <svg
            viewBox="0 0 900 225"
            className="min-w-[680px] w-full"
            role="img"
            aria-label="Qualifying captures and unique collectors by day"
          >
            {data.activity.map((row, index) => {
              const height = (row.captures / maxCaptures) * 160;
              return (
                <g key={row.date}>
                  <rect
                    x={index * width + width * 0.2}
                    y={190 - height}
                    width={Math.max(4, width * 0.6)}
                    height={height}
                    rx="3"
                    fill="#59f176"
                    opacity=".7"
                  />
                  <text
                    x={index * width + width / 2}
                    y="213"
                    textAnchor="middle"
                    fill="#84958b"
                    fontSize="9"
                  >
                    {data.activity.length <= 12 ||
                    index % Math.ceil(data.activity.length / 10) === 0
                      ? row.date.slice(8)
                      : ""}
                  </text>
                </g>
              );
            })}
            <polyline
              points={points}
              fill="none"
              stroke="#57b8ff"
              strokeWidth="4"
            />
            <g>
              {data.activity.map((row, index) => (
                <circle
                  key={row.date}
                  cx={index * width + width / 2}
                  cy={190 - (row.collectors / maxCollectors) * 160}
                  r="3"
                  fill="#57b8ff"
                />
              ))}
            </g>
          </svg>
          <p className="text-[11px] text-ink-500">
            Each series uses its own clearly labelled scale: captures max{" "}
            {format(maxCaptures)} · collectors max {format(maxCollectors)}.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-400">
          No qualifying captures in this period.
        </p>
      )}
    </section>
  );
}

function ChannelScoreboard({
  cards,
  insights,
  supportingSnapshots,
  rule,
}: {
  cards: ChannelScorecard[];
  insights: string[];
  supportingSnapshots: GrowthSnapshot[];
  rule?: string;
}) {
  return (
    <section className="rounded-xl border border-line-300 bg-surface-900 p-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-xl text-white">
            Channel scoreboard
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            Primary historical snapshots only. Date ranges stay intact; no fake
            daily distribution.
          </p>
        </div>
        <span className="rounded-full border border-primary-400/30 bg-primary-500/10 px-2 py-1 text-[10px] font-black text-primary-100">
          AUTO-SAFE
        </span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[.14em] text-ink-500">
            <tr>
              {[
                "Channel",
                "Reach",
                "Traffic",
                "Installs",
                "Spend",
                "Efficiency",
              ].map((head) => (
                <th key={head} className="px-3 py-2">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr
                key={card.source}
                className="border-t border-line-300 odd:bg-white/[.02]"
              >
                <td className="px-3 py-3">
                  <p className="font-black text-white">{card.source}</p>
                  <p className="mt-1 text-[11px] text-ink-500">{card.range}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {[card.channel, ...card.badges].map((badge) => (
                      <span
                        key={badge}
                        className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black ${badge === "PAID" ? "border-amber-300/30 bg-amber-400/10 text-amber-200" : badge === "ORGANIC" ? "border-primary-400/30 bg-primary-500/10 text-primary-100" : "border-line-300 text-ink-400"}`}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 font-display text-lg text-white">
                  {card.reach}
                </td>
                <td className="px-3 py-3 font-display text-lg text-white">
                  {card.traffic}
                </td>
                <td className="px-3 py-3 text-ink-200">{card.installs}</td>
                <td className="px-3 py-3 text-ink-200">{card.spend}</td>
                <td className="px-3 py-3 text-ink-300">{card.efficiency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {insights.length ? (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {insights.map((insight) => (
            <p
              key={insight}
              className="rounded-lg border border-line-300 bg-canvas-900 p-3 text-xs text-ink-300"
            >
              {insight}
            </p>
          ))}
        </div>
      ) : null}
      {supportingSnapshots.length ? (
        <details className="mt-3 rounded-lg border border-line-300 bg-canvas-900 p-3">
          <summary className="cursor-pointer text-xs font-black text-ink-300">
            Supporting evidence excluded from totals (
            {supportingSnapshots.length})
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-[720px] w-full text-left text-xs">
              <tbody>
                {supportingSnapshots.map((row) => (
                  <tr
                    key={`${row.source}-${row.periodStart}-${row.periodEnd}-${row.metric}`}
                    className="odd:bg-white/[.02]"
                  >
                    <td className="px-2 py-1.5 font-bold text-white">
                      {sourceLabel(row.source)}
                    </td>
                    <td className="px-2 py-1.5">
                      {dateLabel(row.periodStart)} – {dateLabel(row.periodEnd)}
                    </td>
                    <td className="px-2 py-1.5">{metricLabel(row.metric)}</td>
                    <td className="px-2 py-1.5">
                      {formatCurrency(row.value, row.currency)}
                    </td>
                    <td className="px-2 py-1.5 text-amber-200">SUPPORTING</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
      {rule ? <p className="mt-3 text-[11px] text-ink-500">{rule}</p> : null}
      {!cards.length ? (
        <p className="mt-3 text-sm text-ink-400">
          No primary historical marketing imports overlap this selected month.
        </p>
      ) : null}
    </section>
  );
}

export default function AdminMetricsDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [period, setPeriod] = useState<Period>("day");
  const [metric, setMetric] = useState<ChartMetric>("users");
  const [data, setData] = useState<Metrics | null>(null);
  const growthMonth = parseGrowthMonth(searchParams.get("month"));
  const [growth, setGrowth] = useState<GrowthData | null>(null);
  const [social, setSocial] = useState<SocialMetric[]>([]);
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingMonth, setPendingMonth] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadRequestId = useRef(0);
  const rangeLabel = monthLabel(growthMonth);
  const requestedTab = searchParams.get("tab");
  const tab: MetricsTab =
    requestedTab === "acquisition" ||
    requestedTab === "product" ||
    requestedTab === "revenue"
      ? requestedTab
      : "plan";
  const paidUsers =
    growth?.daily?.reduce((sum, row) => sum + row.marketing.paidUsers, 0) ?? 0;
  const primarySnapshots = growth?.primaryMarketingSnapshots ?? [];
  const allSnapshots = growth?.marketingSnapshots ?? [];
  const historicalCards = buildChannelScorecards(primarySnapshots);
  const acquisitionInsights = buildAcquisitionInsights(primarySnapshots);
  const supportingSnapshots = allSnapshots.filter(
    (row) => row.aggregationRole === "supporting",
  );
  const selectedMonthState = growthMonthState(growthMonth);

  function setTab(nextTab: MetricsTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "plan") params.delete("tab");
    else params.set("tab", nextTab);
    params.set("month", growthMonth);
    router.push(
      `/admin/metrics${params.toString() ? `?${params.toString()}` : ""}`,
    );
  }

  function setGrowthMonth(nextMonth: string) {
    const normalizedMonth = parseGrowthMonth(nextMonth);
    if (normalizedMonth === growthMonth || pendingMonth) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", normalizedMonth);
    setPendingMonth(normalizedMonth);
    router.push(`/admin/metrics?${params.toString()}`);
  }

  function KpiCard({
    name,
    value,
    caption,
    selected,
    onClick,
  }: {
    name: string;
    value: number | null;
    caption: string;
    selected?: boolean;
    onClick?: () => void;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-xl border p-4 text-left ${selected ? "border-primary-300 bg-primary-500/[.08]" : "border-line-300 bg-surface-900"}`}
      >
        <p className="text-xs font-black uppercase tracking-[.14em] text-ink-400">
          {name}
        </p>
        <p className="mt-2 font-display text-3xl text-white">{format(value)}</p>
        <p className="mt-1 text-xs text-ink-500">{caption}</p>
      </button>
    );
  }

  const loadGrowth = useCallback(async (month: string) => {
    const response = await fetch(`/api/admin/growth?month=${month}`, {
      cache: "no-store",
    });
    if (response.status === 401) {
      setAuthorized(false);
      return;
    }
    const body = await response.json();
    if (response.ok && body.ok) setGrowth(body);
  }, []);
  const loadMetrics = useCallback(async (nextPeriod: Period, month: string) => {
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/metrics?period=${nextPeriod}&month=${month}`,
        { cache: "no-store" },
      );
      if (response.status === 401) {
        setAuthorized(false);
        return;
      }
      const body = await response.json();
      if (!response.ok || !body.ok)
        throw new Error(body.error || "Unable to load metrics");
      setData(body);
      setAuthorized(true);
      await loadGrowth(month);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load metrics",
      );
    } finally {
      if (requestId === loadRequestId.current) {
        setLoading(false);
        setPendingMonth(null);
      }
    }
  }, [loadGrowth]);
  const syncSocial = useCallback(async () => {
    setSocialLoading(true);
    try {
      const response = await fetch("/api/admin/social-metrics", {
        cache: "no-store",
      });
      const body = await response.json();
      if (response.ok && body.ok) setSocial(body.metrics);
    } finally {
      setSocialLoading(false);
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
    await loadMetrics(period, growthMonth);
    await syncSocial();
  }

  useEffect(() => {
    void loadMetrics(period, growthMonth);
  }, [growthMonth, loadMetrics, period]);
  useEffect(() => {
    void syncSocial();
  }, [syncSocial]);

  if (authorized === false) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas-950 px-4">
        <form
          onSubmit={login}
          className="w-full max-w-sm rounded-2xl border border-line-300 bg-surface-900 p-6"
        >
          <p className="text-xs font-black uppercase tracking-[.2em] text-primary-200">
            AnimalDex admin
          </p>
          <h1 className="mt-2 font-display text-3xl text-white">Metrics</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="mt-6 w-full rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-white outline-none focus:border-primary-300"
          />
          <button className="mt-3 w-full rounded-xl bg-primary-400 py-3 font-black text-canvas-950">
            Sign in
          </button>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(33,192,94,.1),transparent_28%)] p-4 text-ink-100 sm:p-7">
      <div className="mx-auto max-w-[96rem]">
        <header className="border-b border-line-300 pb-5">
          <Link href="/admin" className="text-sm text-ink-400 hover:text-white">
            ← Admin
          </Link>
          <h1 className="mt-2 font-display text-4xl text-white sm:text-5xl">
            Growth metrics
          </h1>
          <div className="mt-5 grid gap-2 md:grid-cols-4">
            {tabs.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`rounded-xl border p-3 text-left ${tab === item.key ? "border-primary-300 bg-primary-500/[.10]" : "border-line-300 bg-surface-900"}`}
              >
                <p className="text-sm font-black text-white">{item.label}</p>
                <p className="mt-1 text-xs text-ink-500">{item.description}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-line-300 bg-surface-900 p-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={() => setGrowthMonth(shiftMonth(growthMonth, -1))}
              disabled={Boolean(pendingMonth)}
              className="rounded-lg border border-line-300 px-3 py-2 text-xs font-black text-ink-300 disabled:cursor-wait disabled:opacity-50"
            >
              ← {monthLabel(shiftMonth(growthMonth, -1))}
            </button>
            <div className="text-center">
              <p className="font-display text-2xl text-white">
                {monthLabel(growthMonth)}
              </p>
              <span
                className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${selectedMonthState === "current" ? "border-primary-400/30 bg-primary-500/10 text-primary-100" : selectedMonthState === "past" ? "border-line-300 text-ink-400" : "border-amber-300/30 bg-amber-400/10 text-amber-200"}`}
              >
                {selectedMonthState.toUpperCase()}
              </span>
            </div>
            <button
              onClick={() => setGrowthMonth(shiftMonth(growthMonth, 1))}
              disabled={Boolean(pendingMonth)}
              className="rounded-lg border border-line-300 px-3 py-2 text-xs font-black text-ink-300 disabled:cursor-wait disabled:opacity-50"
            >
              {monthLabel(shiftMonth(growthMonth, 1))} →
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}
        {loading && !data ? (
          <div className="py-20 text-center text-ink-400">
            Loading growth data...
          </div>
        ) : null}
        {pendingMonth || (loading && data) ? (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-canvas-950/80 px-4 backdrop-blur-sm"
            role="status"
            aria-live="polite"
            aria-label={`Loading ${monthLabel(pendingMonth ?? growthMonth)} metrics`}
          >
            <div className="w-full max-w-sm rounded-2xl border border-line-300 bg-surface-900 p-7 text-center shadow-2xl">
              <div
                className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-line-300 border-t-primary-400"
                aria-hidden="true"
              />
              <p className="mt-5 font-display text-2xl text-white">
                Loading {monthLabel(pendingMonth ?? growthMonth)}
              </p>
              <p className="mt-2 text-sm text-ink-400">
                Refreshing Growth Plan, Acquisition, Product, and Revenue data…
              </p>
            </div>
          </div>
        ) : null}
        {data && tab === "plan" ? (
          <GrowthCommandCenter
            growth={growth}
            month={growthMonth}
            reload={() => loadGrowth(growthMonth)}
          />
        ) : null}

        {data && tab === "acquisition" ? (
          <section className="mt-6 space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">
                Acquisition
              </p>
              <p className="mt-1 text-sm text-ink-400">
                {rangeLabel} calendar month · Update today feeds this month’s
                social, search and spend. Historical snapshots stay separate.
              </p>
            </div>
            {selectedMonthState === "upcoming" ? (
              <div className="rounded-xl border border-amber-300/30 bg-amber-400/[.06] p-5">
                <p className="font-display text-3xl text-white">UPCOMING</p>
                <p className="mt-1 text-sm text-ink-400">
                  Future acquisition actuals are not represented as zero.
                </p>
              </div>
            ) : (
              <>
                <section className="rounded-xl border border-line-300 bg-surface-900 p-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl text-white">
                        Acquisition intelligence
                      </h2>
                      <p className="mt-1 text-xs text-ink-500">
                        Registered-user truth first. Platform cells stay
                        unavailable until AnimalDex records device platform.
                      </p>
                    </div>
                    <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-1 text-[10px] font-black text-amber-200">
                      ATTRIBUTION LIMITED
                    </span>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-[680px] w-full text-left text-xs">
                      <thead className="text-[10px] uppercase tracking-[.14em] text-ink-500">
                        <tr>
                          <th className="px-3 py-2">Metric</th>
                          <th className="px-3 py-2">Overall</th>
                          <th className="px-3 py-2">Android</th>
                          <th className="px-3 py-2">iOS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          [
                            "New users",
                            format(growth?.actuals?.users ?? null),
                            "Unavailable",
                            "Unavailable",
                          ],
                          [
                            "Paid attributed",
                            format(paidUsers),
                            "Not recorded",
                            "Not recorded",
                          ],
                          [
                            "Organic / direct",
                            paidUsers <= (growth?.actuals?.users ?? 0)
                              ? format(
                                  (growth?.actuals?.users ?? 0) - paidUsers,
                                )
                              : "Unresolved",
                            "Not recorded",
                            "Not recorded",
                          ],
                          [
                            "Avg registered-user CPA",
                            "Insufficient attribution",
                            "Insufficient attribution",
                            "Insufficient attribution",
                          ],
                          [
                            "Click → registered",
                            "Insufficient attribution",
                            "Insufficient attribution",
                            "Insufficient attribution",
                          ],
                          [
                            "Install → registered",
                            "Insufficient attribution",
                            "Insufficient attribution",
                            "Insufficient attribution",
                          ],
                        ].map((row) => (
                          <tr
                            key={row[0]}
                            className="border-t border-line-300 odd:bg-white/[.02]"
                          >
                            {row.map((cell, index) => (
                              <td
                                key={`${row[0]}-${index}`}
                                className={`px-3 py-2.5 ${index === 0 ? "font-black text-white" : cell === "Unavailable" || cell === "Not recorded" || cell === "Insufficient attribution" ? "text-amber-200" : "text-ink-200"}`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <div className="grid gap-3 lg:grid-cols-[.8fr_1.2fr]">
                  <KpiCard
                    name="AnimalDex users"
                    value={data.kpis.users.value}
                    caption={`AUTO · registered AnimalDex profiles · ${rangeLabel}`}
                  />
                  <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
                    <p className="text-xs font-black uppercase tracking-[.14em] text-ink-400">
                      {(growth?.manualDailyEntryCount ?? 0) > 0
                        ? "Daily/manual tracking"
                        : "Daily tracking entries"}
                    </p>
                    {(growth?.manualDailyEntryCount ?? 0) > 0 ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-4">
                        <div>
                          <p className="text-[10px] text-ink-500">
                            MANUAL social
                          </p>
                          <p className="font-display text-2xl text-white">
                            {format(growth?.actuals?.socialViews ?? 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-ink-500">
                            MANUAL search
                          </p>
                          <p className="font-display text-2xl text-white">
                            {format(growth?.actuals?.searchClicks ?? 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-ink-500">
                            MANUAL spend
                          </p>
                          <p className="font-display text-2xl text-white">
                            {formatSpendByCurrency(growth?.adSpendByCurrency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-ink-500">
                            MANUAL attributed
                          </p>
                          <p className="font-display text-2xl text-white">
                            {format(paidUsers)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-line-300 bg-canvas-900 p-3 text-sm text-ink-300">
                        <p className="font-bold text-white">
                          No daily marketing entries were recorded for this
                          month.
                        </p>
                        <p className="mt-1 text-xs text-ink-500">
                          Historical platform results are shown below. Spend
                          snapshots keep their original currencies and are not
                          combined without FX conversion.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                {(growth?.daily ?? []).some(
                  (row) => (row.organicEntries?.length ?? 0) > 0,
                ) ? (
                  <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
                    <p className="text-xs font-black uppercase tracking-[.14em] text-ink-400">
                      Platform reach from Update today
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                      {[
                        "tiktok",
                        "instagram",
                        "youtube",
                        "facebook",
                        "reddit",
                        "other",
                      ].map((platform) => {
                        const entries = (growth?.daily ?? [])
                          .flatMap((row) => row.organicEntries ?? [])
                          .filter((entry) => entry.platform === platform);
                        const views = entries.reduce(
                          (sum, entry) => sum + entry.views,
                          0,
                        );
                        const posts = entries.reduce(
                          (sum, entry) => sum + entry.posts,
                          0,
                        );
                        return (
                          <div key={platform}>
                            <p className="text-[10px] capitalize text-ink-500">
                              {platform}
                            </p>
                            <p className="font-display text-xl text-white">
                              {format(views)}
                            </p>
                            <p className="text-[11px] text-ink-500">
                              {format(posts)} posts
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <ChannelScoreboard
                  cards={historicalCards}
                  insights={acquisitionInsights}
                  supportingSnapshots={supportingSnapshots}
                  rule={growth?.marketingSnapshotAggregationRule}
                />
                {data.signIn ? (
                  <section className="rounded-xl border border-line-300 bg-surface-900 p-4">
                    <h2 className="font-display text-xl text-white">
                      Platform & sign-in evidence
                    </h2>
                    <p className="mt-1 text-xs text-ink-500">
                      Current all-account evidence, not a historical month
                      split. Auth method is not device platform. Google sign-in
                      works on iOS; Apple device evidence is shown separately.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {Object.entries(data.signIn.providers)
                        .sort((left, right) => right[1] - left[1])
                        .map(([provider, count]) => (
                          <div
                            key={provider}
                            className="rounded-lg border border-line-300 bg-canvas-900 p-3"
                          >
                            <p className="text-[10px] capitalize text-ink-500">
                              {provider} sign-in
                            </p>
                            <p className="font-display text-2xl text-white">
                              {format(count)}
                            </p>
                            <p className="text-[11px] text-ink-500">
                              {data.signIn!.total
                                ? Math.round((count / data.signIn!.total) * 100)
                                : 0}
                              % of accounts
                            </p>
                          </div>
                        ))}
                    </div>
                    <div className="mt-2 rounded-lg border border-amber-300/25 bg-amber-400/[.06] p-3">
                      <p className="text-sm font-black text-white">
                        Confirmed Apple device signals:{" "}
                        {format(data.signIn.appleDeviceSignals)}
                      </p>
                      <p className="mt-1 text-xs text-amber-100/80">
                        All other accounts remain platform unknown—not
                        Android—until first-party platform capture exists.{" "}
                        {data.signIn.note}
                      </p>
                    </div>
                  </section>
                ) : null}
                <section className="rounded-xl border border-line-300 bg-surface-900 p-4">
                  <h2 className="font-display text-xl text-white">
                    First-party user trend
                  </h2>
                  <p className="text-xs text-ink-500">
                    {rangeLabel} · registered AnimalDex profiles, not attributed
                    to ad platforms.
                  </p>
                  <div className="mt-3">
                    <TrendChart
                      rows={data.series}
                      metric="users"
                      period={period}
                    />
                  </div>
                </section>
              </>
            )}
          </section>
        ) : null}

        {data && tab === "product" ? (
          <section className="mt-6 space-y-4">
            <div>
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">
                  Product
                </p>
                <h2 className="mt-1 font-display text-3xl text-white">
                  Collector health
                </h2>
                <p className="mt-1 text-sm text-ink-400">
                  Cohort: users acquired in {rangeLabel}, including mature
                  follow-up after month-end. Activity: events occurring inside
                  {rangeLabel}.
                </p>
              </div>
            </div>
            {selectedMonthState === "upcoming" ? (
              <div className="rounded-xl border border-amber-300/30 bg-amber-400/[.06] p-5">
                <p className="font-display text-3xl text-white">UPCOMING</p>
                <p className="mt-1 text-sm text-ink-400">
                  Future collector actuals are not represented as zero.
                </p>
              </div>
            ) : growth?.collectorAnalytics ? (
              <>
                <section className="rounded-xl border border-line-300 bg-surface-900 p-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <h2 className="font-display text-xl text-white">
                        Collector funnel
                      </h2>
                      <p className="mt-1 text-xs text-ink-500">
                        Are acquired users becoming real collectors?
                      </p>
                    </div>
                    <span className="text-[10px] font-black text-primary-100">
                      QUALIFYING CAPTURES ONLY
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-4">
                    {[
                      {
                        name: "New users",
                        value: format(growth.collectorAnalytics.newUsers),
                        sub: "Profiles created in cohort period",
                      },
                      {
                        name: "Activation",
                        value:
                          growth.collectorAnalytics.activation.rate == null
                            ? "—"
                            : `${Math.round(growth.collectorAnalytics.activation.rate)}%`,
                        sub: growth.collectorAnalytics.activation.eligible
                          ? `${format(growth.collectorAnalytics.activation.users)} of ${format(growth.collectorAnalytics.activation.eligible)} eligible users`
                          : "Not enough mature users yet",
                      },
                      {
                        name: "Repeat collectors",
                        value:
                          growth.collectorAnalytics.repeat.rate == null
                            ? "—"
                            : `${Math.round(growth.collectorAnalytics.repeat.rate)}%`,
                        sub: growth.collectorAnalytics.repeat.activated
                          ? `${format(growth.collectorAnalytics.repeat.users)} of ${format(growth.collectorAnalytics.repeat.activated)} activated`
                          : "No activated collectors yet",
                      },
                      {
                        name: "7-day retained",
                        value:
                          growth.collectorAnalytics.retained7Day.rate == null
                            ? "—"
                            : `${growth.collectorAnalytics.retained7Day.rate}%`,
                        sub: growth.collectorAnalytics.retained7Day.eligible
                          ? `${format(growth.collectorAnalytics.retained7Day.users)} of ${format(growth.collectorAnalytics.retained7Day.eligible)} mature collectors`
                          : "Not enough mature users yet",
                      },
                    ].map((step, index) => (
                      <div
                        key={step.name}
                        className="relative rounded-lg border border-line-300 bg-canvas-900 p-3"
                      >
                        <p className="text-[10px] font-black uppercase tracking-[.12em] text-ink-500">
                          {step.name}
                        </p>
                        <p className="mt-1 font-display text-3xl text-white">
                          {step.value}
                        </p>
                        <p className="mt-1 text-[11px] text-ink-400">
                          {step.sub}
                        </p>
                        {index < 3 ? (
                          <span className="absolute -right-3 top-1/2 z-10 hidden text-primary-300 md:block">
                            →
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <div className="rounded-lg border border-line-300 bg-canvas-900 p-3">
                      <p className="text-xs font-black text-white">
                        D1 capture retention ·{" "}
                        {growth.collectorAnalytics.d1.rate == null
                          ? "—"
                          : `${growth.collectorAnalytics.d1.rate}%`}
                      </p>
                      <p className="mt-1 text-[11px] text-ink-400">
                        {growth.collectorAnalytics.d1.eligible
                          ? `${format(growth.collectorAnalytics.d1.users)} of ${format(growth.collectorAnalytics.d1.eligible)} mature activated collectors captured again 24–48h later`
                          : "Not enough mature users yet"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-line-300 bg-canvas-900 p-3">
                      <p className="text-xs font-black text-white">
                        D7 capture retention ·{" "}
                        {growth.collectorAnalytics.d7.rate == null
                          ? "—"
                          : `${growth.collectorAnalytics.d7.rate}%`}
                      </p>
                      <p className="mt-1 text-[11px] text-ink-400">
                        {growth.collectorAnalytics.d7.eligible
                          ? `${format(growth.collectorAnalytics.d7.users)} of ${format(growth.collectorAnalytics.d7.eligible)} mature activated collectors captured again during days 6–8`
                          : "Not enough mature users yet"}
                      </p>
                    </div>
                  </div>
                </section>
                <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    [
                      "Qualifying captures",
                      format(growth.collectorAnalytics.summary.captures),
                    ],
                    [
                      "Unique collectors",
                      format(growth.collectorAnalytics.summary.collectors),
                    ],
                    [
                      "Captures / collector",
                      growth.collectorAnalytics.summary.capturesPerCollector?.toFixed(
                        1,
                      ) ?? "—",
                    ],
                    [
                      "Median captures",
                      growth.collectorAnalytics.summary.medianCaptures
                        ?.toFixed(1)
                        .replace(".0", "") ?? "—",
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-line-300 bg-surface-900 p-3"
                    >
                      <p className="text-[10px] font-black uppercase text-ink-500">
                        {label}
                      </p>
                      <p className="mt-1 font-display text-2xl text-white">
                        {value}
                      </p>
                    </div>
                  ))}
                </section>
                <CollectorDepth data={growth.collectorAnalytics} />
                <CaptureRetention data={growth.collectorAnalytics} />
                <CollectorActivity data={growth.collectorAnalytics} />
                <section className="rounded-xl border border-amber-300/20 bg-amber-400/[.05] p-3 text-xs text-amber-100/80">
                  Platform filtering is unavailable: confirmed Apple signals do
                  not provide complete Android/iOS classification.
                  Acquisition-source product quality is also unavailable because
                  aggregate marketing snapshots do not attribute individual
                  users.
                </section>
              </>
            ) : (
              <p className="rounded-xl border border-line-300 bg-surface-900 p-4 text-sm text-ink-400">
                Collector analytics are unavailable until the updated growth API
                is loaded.
              </p>
            )}
            <section className="rounded-xl border border-line-300 bg-surface-900 p-4">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="font-display text-xl text-white">
                    Discover / social activity
                  </h2>
                  <p className="mt-1 text-xs text-ink-500">
                    Secondary community engagement · {rangeLabel}.
                  </p>
                </div>
                <p className="text-xs text-ink-400">
                  {format(data.postActivity.total)} total posts
                </p>
              </div>
              <div className="mt-3">
                <PostTypeChart
                  rows={data.postActivity.series}
                  period={period}
                />
              </div>
            </section>
          </section>
        ) : null}

        {data && tab === "revenue" ? (
          <section className="mt-6 space-y-4">
            <div>
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">
                  Revenue & users
                </p>
                <p className="mt-1 text-sm text-ink-400">
                  Transactions occurring during the {rangeLabel} calendar month.
                  Cohort conversion is shown separately.
                </p>
              </div>
            </div>
            {selectedMonthState === "upcoming" ? (
              <div className="rounded-xl border border-amber-300/30 bg-amber-400/[.06] p-5">
                <p className="font-display text-3xl text-white">UPCOMING</p>
                <p className="mt-1 text-sm text-ink-400">
                  Future purchases and conversion are not represented as zero.
                </p>
              </div>
            ) : (
              <>
                <Link
                  href="/admin/users"
                  className="inline-flex text-sm font-bold text-primary-100 hover:text-primary-200"
                >
                  View users, buyers & LTV →
                </Link>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard
                    name="New users"
                    value={data.kpis.users.value}
                    caption={`${rangeLabel} profile creations`}
                  />
                  <KpiCard
                    name="Qualifying captures"
                    value={growth?.collectorAnalytics?.summary.captures ?? null}
                    caption={`${rangeLabel} ready captures`}
                  />
                  <KpiCard
                    name="Production purchases"
                    value={data.purchaseBreakdown.production}
                    caption={`transactions during ${rangeLabel}`}
                  />
                  <KpiCard
                    name="First-time purchasers"
                    value={growth?.funnel?.firstTimePurchasers ?? null}
                    caption={`first production purchase occurred during ${rangeLabel}`}
                  />
                  <KpiCard
                    name="Signup-cohort purchasers"
                    value={growth?.funnel?.cohortFirstTimePurchasers ?? null}
                    caption={`${rangeLabel} signups that later made a first production purchase`}
                  />
                  <KpiCard
                    name="Signup-cohort payer conversion"
                    value={growth?.funnel?.payerConversionRate ?? null}
                    caption="signup-cohort purchasers / new users"
                  />
                  <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
                    <p className="text-xs font-black uppercase tracking-[.14em] text-ink-400">
                      Historical Active Pro
                    </p>
                    <p className="mt-2 font-display text-2xl text-white">
                      NOT AVAILABLE
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      Current profiles.is_pro state cannot be back-projected.
                    </p>
                  </div>
                </div>
              </>
            )}
            {growth?.payingProDefinition ? (
              <p className="text-xs text-amber-200">
                Pro note: {growth.payingProDefinition}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
