"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, InfoTip, TD, TH, Table, cn } from "@/components/admin/ui";
import type { Platform } from "@/lib/product-analytics";
import { Legend, Sparkline, TrendChart, type ChartMarker, type ChartSeries } from "./charts";
import {
  countDelta,
  num,
  pct,
  platformColors,
  platformLabels,
  rateDelta,
  singleSeriesColor,
  storeColors,
  storeLabels,
  usd,
  type Delta,
} from "./format";
import type { AnalyticsResponse, PeriodSummary, SeriesRow } from "./types";

type MetricKey = "signups" | "activation" | "d1" | "d7" | "active" | "talk" | "capture" | "push" | "revenue";
type MetricDef = {
  label: string;
  info: string;
  kind: "count" | "rate" | "usd";
  value: (period: PeriodSummary) => number | null;
  /** Stacked parts for the chart, when the metric splits by platform or store. */
  parts?: (period: PeriodSummary) => Array<{ key: string; label: string; color: string; value: number }>;
  hint?: (period: PeriodSummary) => string;
};

const visiblePlatforms: Platform[] = ["ios", "android", "web", "unknown"];

export const metricDefs: Record<MetricKey, MetricDef> = {
  signups: {
    label: "New users",
    info: "Accounts created in the period (Asia/Jakarta days), by the platform they signed up on.",
    kind: "count",
    value: (p) => p.signups.users,
    parts: (p) => visiblePlatforms.map((platform) => ({ key: platform, label: platformLabels[platform], color: platformColors[platform], value: p.signups.byPlatform[platform] })),
  },
  activation: {
    label: "Activated",
    info: "New users who captured an animal, talked to one, started a Trial or asked a debate within 24 hours of signing up. Users younger than 24h aren't counted yet.",
    kind: "rate",
    value: (p) => p.signups.activation.rate,
    hint: (p) => `${num(p.signups.activation.users)} of ${num(p.signups.activation.eligible)}`,
  },
  d1: {
    label: "D1 retention",
    info: "New users who came back the calendar day after signing up: opened the app, captured, talked, did a Trial or a debate.",
    kind: "rate",
    value: (p) => p.signups.d1.rate,
    hint: (p) => `${num(p.signups.d1.users)} of ${num(p.signups.d1.eligible)}`,
  },
  d7: {
    label: "D7 retention",
    info: "New users who were active on the 7th day after signing up. Only users at least 8 days old count.",
    kind: "rate",
    value: (p) => p.signups.d7.rate,
    hint: (p) => `${num(p.signups.d7.users)} of ${num(p.signups.d7.eligible)}`,
  },
  active: {
    label: "Active users",
    info: "Distinct people who used AnimalDex in the period (opened the app, captured, talked, did a Trial or a debate). For one day this is DAU, for a week WAU, for a month MAU.",
    kind: "count",
    value: (p) => p.activity.activeUsers,
    parts: (p) => visiblePlatforms.map((platform) => ({ key: platform, label: platformLabels[platform], color: platformColors[platform], value: p.activity.activeByPlatform[platform] })),
    hint: (p) => `avg ${num(p.activity.avgDau)} a day`,
  },
  talk: {
    label: "Talk rate",
    info: "Share of active users who talked to an animal at least once in the period.",
    kind: "rate",
    value: (p) => p.activity.reach.talk.rate,
    hint: (p) => `${num(p.activity.reach.talk.users)} people · ${num(p.activity.counts.talk)} messages`,
  },
  capture: {
    label: "Capture rate",
    info: "Share of active users who captured at least one animal in the period.",
    kind: "rate",
    value: (p) => p.activity.reach.capture.rate,
    hint: (p) => `${num(p.activity.reach.capture.users)} people · ${num(p.activity.counts.capture)} captures`,
  },
  push: {
    label: "Push opt-in",
    info: "New iOS and Android users with notifications allowed (a push token on file now). iOS only registers a token after the person taps Allow.",
    kind: "rate",
    value: (p) => p.signups.pushOptIn.rate,
    hint: (p) => `${num(p.signups.pushOptIn.users)} of ${num(p.signups.pushOptIn.eligible)} app signups`,
  },
  revenue: {
    label: "Revenue",
    info: "Purchases at list price ($2.99 / $7.99 credit packs, $9.99 Pro), test purchases excluded. Store fees, tax, refunds and local prices are not recorded.",
    kind: "usd",
    value: (p) => p.revenue.usd,
    parts: (p) =>
      (Object.keys(storeLabels) as Array<keyof typeof storeLabels>).map((store) => ({ key: store, label: storeLabels[store], color: storeColors[store], value: p.revenue.byStore[store].usd })),
    hint: (p) => `${num(p.revenue.purchases)} purchases · ${num(p.revenue.payers)} payers`,
  },
};

export function formatMetric(kind: MetricDef["kind"], value: number | null) {
  return kind === "rate" ? pct(value) : kind === "usd" ? usd(value) : num(value);
}

function deltaOf(def: MetricDef, current: PeriodSummary, prior: PeriodSummary): Delta {
  return def.kind === "rate"
    ? rateDelta(def.value(current), def.value(prior))
    : countDelta(def.value(current), def.value(prior), true, (value) => formatMetric(def.kind, value));
}

function KpiTile({ def, data, selected, onSelect }: { def: MetricDef; data: AnalyticsResponse; selected: boolean; onSelect: () => void }) {
  const delta = deltaOf(def, data.current, data.prior);
  const values = data.series.map((row) => def.value(row));
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "min-w-0 border bg-surface-900 p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
        selected ? "border-primary-400" : "border-line-300 hover:border-primary-400/50",
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[.12em] text-ink-500">
        {def.label}
        <InfoTip>{def.info}</InfoTip>
      </span>
      <span className="mt-1 block font-display text-2xl leading-tight text-white tabular-nums">{formatMetric(def.kind, def.value(data.current))}</span>
      <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[11px] tabular-nums">
        {delta ? (
          <span className={cn("font-bold", delta.tone === "good" ? "text-primary-200" : delta.tone === "bad" ? "text-red-300" : "text-ink-400")}>{delta.text}</span>
        ) : null}
        <span className="text-ink-500">vs {formatMetric(def.kind, def.value(data.prior))}</span>
      </span>
      {def.hint ? <span className="mt-0.5 block truncate text-[11px] text-ink-500">{def.hint(data.current)}</span> : null}
      <span className="mt-2 block">
        <Sparkline values={values} />
      </span>
    </button>
  );
}

/** Release and marker positions on the series buckets. */
export function markersFor(data: AnalyticsResponse): ChartMarker[] {
  return data.releases.flatMap((release) => {
    const index = data.series.findIndex((row) => row.from <= release.day && release.day <= row.to);
    if (index < 0) return [];
    const name = release.source === "note" ? release.label ?? "Marker" : `${platformLabels[release.platform]} ${release.version}`;
    return [{ index, label: `${name} · ${release.day.slice(5)}` }];
  });
}

export function seriesFor(def: MetricDef, rows: SeriesRow[]): ChartSeries[] {
  if (def.parts) {
    const first = def.parts(rows[0] ?? ({} as PeriodSummary));
    return first
      .map((part) => ({ key: part.key, label: part.label, color: part.color, values: rows.map((row) => def.parts!(row).find((item) => item.key === part.key)?.value ?? 0) }))
      .filter((item) => item.values.some((value) => (value ?? 0) > 0));
  }
  return [{ key: "value", label: def.label, color: singleSeriesColor, values: rows.map((row) => def.value(row)) }];
}

export function Overview({ data }: { data: AnalyticsResponse }) {
  const [metric, setMetric] = useState<MetricKey>("signups");
  const def = metricDefs[metric];
  const series = data.series.length ? seriesFor(def, data.series) : [];
  const partial = data.series[data.series.length - 1]?.partial ?? false;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
        {(Object.keys(metricDefs) as MetricKey[]).map((key) => (
          <KpiTile key={key} def={metricDefs[key]} data={data} selected={metric === key} onSelect={() => setMetric(key)} />
        ))}
      </div>

      <Card>
        <CardHeader
          title={`${def.label} by ${data.range.grain}`}
          description={
            <>
              {def.info} Click any tile above to chart it. <span className="text-amber-200">◆</span> marks a release or a marker you added.
            </>
          }
        />
        <CardContent className="space-y-3">
          <TrendChart
            label={`${def.label} by ${data.range.grain}`}
            labels={data.series.map((row) => row.label)}
            series={series}
            type={def.kind === "rate" ? "line" : "bar"}
            percent={def.kind === "rate"}
            format={(value) => formatMetric(def.kind, value)}
            markers={markersFor(data)}
            partialLast={partial}
          />
          {series.length > 1 ? <Legend items={series.map((item) => ({ label: item.label, color: item.color }))} /> : null}
        </CardContent>
      </Card>

      <PeriodTable data={data} />
      <PlatformTable data={data} />
    </div>
  );
}

/** Every bucket as a row: months, weeks or days side by side, no switching. */
export function PeriodTable({ data }: { data: AnalyticsResponse }) {
  const rows = [...data.series].reverse();
  const columns: Array<{ key: MetricKey; short: string }> = [
    { key: "signups", short: "New users" },
    { key: "activation", short: "Activated" },
    { key: "d1", short: "D1" },
    { key: "d7", short: "D7" },
    { key: "active", short: "Active" },
    { key: "talk", short: "Talk rate" },
    { key: "capture", short: "Capture rate" },
    { key: "push", short: "Push opt-in" },
    { key: "revenue", short: "Revenue" },
  ];
  return (
    <Card>
      <CardHeader
        title={`Period by period · ${data.range.grain === "day" ? "days" : data.range.grain === "week" ? "weeks" : "months"}`}
        description="Newest first. Set the grain to Month and the range to 6 or 12 months to compare months side by side. A faint row is still in progress."
      />
      <Table minWidth={980}>
        <thead>
          <tr>
            <TH>Period</TH>
            <TH numeric>iOS</TH>
            <TH numeric>Android</TH>
            <TH numeric>Web</TH>
            {columns.map((column) => (
              <TH key={column.key} numeric>
                {column.short}
              </TH>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={cn("hover:bg-white/[.02]", row.partial && "text-ink-400")}>
              <TD className="whitespace-nowrap font-bold text-white">
                {row.label}
                {row.partial ? <span className="ml-1 text-[10px] font-normal text-ink-500">partial</span> : null}
              </TD>
              <TD numeric>{num(row.signups.byPlatform.ios)}</TD>
              <TD numeric>{num(row.signups.byPlatform.android)}</TD>
              <TD numeric>{num(row.signups.byPlatform.web)}</TD>
              {columns.map((column) => (
                <TD key={column.key} numeric className={column.key === "signups" ? "font-bold text-white" : undefined}>
                  {formatMetric(metricDefs[column.key].kind, metricDefs[column.key].value(row))}
                </TD>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          {[
            { label: "Selected range", period: data.current },
            { label: "Previous period", period: data.prior },
          ].map(({ label, period }) => (
            <tr key={label} className="border-t border-line-300 font-bold text-white">
              <TD className="whitespace-nowrap">{label}</TD>
              <TD numeric>{num(period.signups.byPlatform.ios)}</TD>
              <TD numeric>{num(period.signups.byPlatform.android)}</TD>
              <TD numeric>{num(period.signups.byPlatform.web)}</TD>
              {columns.map((column) => (
                <TD key={column.key} numeric>
                  {formatMetric(metricDefs[column.key].kind, metricDefs[column.key].value(period))}
                </TD>
              ))}
            </tr>
          ))}
        </tfoot>
      </Table>
    </Card>
  );
}

/** iOS vs Android vs Web for the selected range. */
export function PlatformTable({ data }: { data: AnalyticsResponse }) {
  const columns: MetricKey[] = ["signups", "activation", "d1", "d7", "active", "talk", "capture", "push", "revenue"];
  return (
    <Card>
      <CardHeader
        title="iOS vs Android vs Web"
        description="The selected range split by platform. Unknown is an account with no platform signal yet (mostly signups before the September app update)."
      />
      <Table minWidth={900}>
        <thead>
          <tr>
            <TH>Platform</TH>
            {columns.map((key) => (
              <TH key={key} numeric>
                {metricDefs[key].label}
              </TH>
            ))}
          </tr>
        </thead>
        <tbody>
          {visiblePlatforms.map((platform) => {
            const period = data.platforms[platform];
            if (!period.signups.users && !period.activity.activeUsers && !period.revenue.purchases) return null;
            return (
              <tr key={platform} className="hover:bg-white/[.02]">
                <TD>
                  <span className="inline-flex items-center gap-2 font-bold text-white">
                    <span className="h-2.5 w-2.5" style={{ background: platformColors[platform] }} aria-hidden="true" />
                    {platformLabels[platform]}
                  </span>
                </TD>
                {columns.map((key) => (
                  <TD key={key} numeric className={key === "signups" ? "font-bold text-white" : undefined}>
                    {key === "push" && platform === "web" ? "n/a" : formatMetric(metricDefs[key].kind, metricDefs[key].value(period))}
                  </TD>
                ))}
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}
