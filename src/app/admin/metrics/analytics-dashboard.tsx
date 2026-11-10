"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPage, Alert, PageHeader, RefreshButton, Segmented, StatGridSkeleton, buttonVariants, cn, fieldClass } from "@/components/admin/ui";
import { addDays, dayKeyOf, defaultGrain, isDayKey, previousRange, type Grain, type PlatformFilter } from "@/lib/product-analytics";
import { errorFromBody } from "@/lib/admin-fetch-json";
import { ArkTab } from "./_analytics/ark";
import { Content } from "./_analytics/content";
import { rangeLabel } from "./_analytics/format";
import { Overview } from "./_analytics/overview";
import { Acquisition, Engagement, Releases, Retention, Revenue } from "./_analytics/tabs";
import { metricsTabs, type AnalyticsResponse, type MetricsTab } from "./_analytics/types";

type Preset = "7d" | "30d" | "90d" | "mtd" | "last_month" | "6m" | "12m" | "custom";
const presets: Array<{ value: Preset; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "mtd", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "6m", label: "6 months" },
  { value: "12m", label: "12 months" },
  { value: "custom", label: "Custom" },
];

function monthStartOf(day: string, monthsBack = 0) {
  const date = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - monthsBack);
  return date.toISOString().slice(0, 10);
}

/** A preset's [from, to] in Jakarta days. Rolling presets end today; "Last month" is the whole calendar month. */
export function presetRange(preset: Exclude<Preset, "custom">, today: string) {
  switch (preset) {
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "90d":
      return { from: addDays(today, -89), to: today };
    case "mtd":
      return { from: monthStartOf(today), to: today };
    case "last_month":
      return { from: monthStartOf(today, 1), to: addDays(monthStartOf(today), -1) };
    case "6m":
      return { from: monthStartOf(today, 5), to: today };
    case "12m":
      return { from: monthStartOf(today, 11), to: today };
  }
}

function tabFrom(value: string | null): MetricsTab {
  return metricsTabs.some((tab) => tab.value === value) ? (value as MetricsTab) : "overview";
}

export default function AnalyticsDashboard() {
  const searchParams = useSearchParams();
  const today = useMemo(() => dayKeyOf(Date.now()), []);
  const initialPreset = (presets.find((item) => item.value === searchParams.get("range"))?.value ?? "30d") as Preset;
  const initialCustom = { from: searchParams.get("from"), to: searchParams.get("to") };
  const [preset, setPreset] = useState<Preset>(initialPreset === "custom" && !(isDayKey(initialCustom.from) && isDayKey(initialCustom.to)) ? "30d" : initialPreset);
  const [custom, setCustom] = useState(() =>
    isDayKey(initialCustom.from) && isDayKey(initialCustom.to) ? { from: initialCustom.from, to: initialCustom.to } : presetRange("30d", today),
  );
  const grainParam = searchParams.get("grain");
  const [grainChoice, setGrainChoice] = useState<Grain | "auto">(grainParam === "day" || grainParam === "week" || grainParam === "month" ? grainParam : "auto");
  const platformParam = searchParams.get("platform");
  const [platform, setPlatform] = useState<PlatformFilter>(platformParam === "ios" || platformParam === "android" || platformParam === "web" ? platformParam : "all");
  const [tab, setTab] = useState<MetricsTab>(tabFrom(searchParams.get("tab")));
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = preset === "custom" ? custom : presetRange(preset, today);
  const grain: Grain = grainChoice === "auto" ? defaultGrain(range.from, range.to) : grainChoice;
  const previous = previousRange(range.from, range.to);

  // The query string mirrors the view so a link or a reload lands on the same thing.
  // history.replaceState, not the router: Next 13.4 drops a push that only changes the query.
  useEffect(() => {
    const params = new URLSearchParams();
    if (tab !== "overview") params.set("tab", tab);
    if (preset !== "30d") params.set("range", preset);
    if (preset === "custom") {
      params.set("from", range.from);
      params.set("to", range.to);
    }
    if (grainChoice !== "auto") params.set("grain", grainChoice);
    if (platform !== "all") params.set("platform", platform);
    const query = params.toString();
    window.history.replaceState(null, "", `/admin/metrics${query ? `?${query}` : ""}`);
  }, [tab, preset, range.from, range.to, grainChoice, platform]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to, grain, platform });
      const response = await fetch(`/api/admin/analytics?${params}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(errorFromBody(body, `Analytics failed to load (${response.status})`));
      setData(body as AnalyticsResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Analytics failed to load");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, grain, platform]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminPage width="wide" className="min-w-0">
      <PageHeader
        eyebrow="Analytics"
        title={rangeLabel(range.from, range.to)}
        description={`Compared with ${rangeLabel(previous.from, previous.to)}. iOS, Android and web together, on Asia/Jakarta days.`}
        actions={
          <>
            <Link href="/admin/metrics/marketing" className={buttonVariants({ size: "sm" })}>
              Spend, social & plan →
            </Link>
            <RefreshButton loading={loading} onClick={() => void load()} />
          </>
        }
      />

      <div className="z-20 -mx-4 mt-4 lg:sticky lg:top-0 flex flex-col gap-2 border-b border-line-300 bg-canvas-950/95 px-4 py-2 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Date range" value={preset} options={presets} onChange={setPreset} />
          {preset === "custom" ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-400">
              <input
                type="date"
                aria-label="From"
                value={custom.from}
                max={custom.to}
                onChange={(event) => isDayKey(event.target.value) && setCustom({ ...custom, from: event.target.value })}
                className={cn(fieldClass, "h-9 w-[150px] py-1")}
              />
              to
              <input
                type="date"
                aria-label="To"
                value={custom.to}
                min={custom.from}
                max={today}
                onChange={(event) => isDayKey(event.target.value) && setCustom({ ...custom, to: event.target.value })}
                className={cn(fieldClass, "h-9 w-[150px] py-1")}
              />
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Granularity"
            value={grainChoice}
            onChange={setGrainChoice}
            options={[
              { value: "auto", label: `Auto (${defaultGrain(range.from, range.to)})` },
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
          />
          <Segmented
            label="Platform"
            value={platform}
            onChange={setPlatform}
            options={[
              { value: "all", label: "All platforms" },
              { value: "ios", label: "iOS", count: data?.platforms.ios.signups.users ?? null },
              { value: "android", label: "Android", count: data?.platforms.android.signups.users ?? null },
              { value: "web", label: "Web", count: data?.platforms.web.signups.users ?? null },
            ]}
          />
        </div>
        <Segmented label="Section" value={tab} options={metricsTabs} onChange={setTab} />
      </div>

      {error ? (
        <Alert tone="bad" className="mt-4">
          {error}
        </Alert>
      ) : null}
      {loading && !data ? <StatGridSkeleton count={6} className="mt-6" /> : null}

      {data ? (
        <div aria-busy={loading || undefined} className={cn("mt-5 space-y-4 transition-opacity", loading && "opacity-60")}>
          {tab === "overview" ? <Overview data={data} /> : null}
          {tab === "acquisition" ? <Acquisition data={data} /> : null}
          {tab === "engagement" ? <Engagement data={data} /> : null}
          {tab === "retention" ? <Retention data={data} /> : null}
          {tab === "content" ? <Content data={data} /> : null}
          {tab === "revenue" ? <Revenue data={data} /> : null}
          {tab === "releases" ? <Releases data={data} reload={() => void load()} /> : null}
          {tab === "ark" ? <ArkTab from={range.from} to={range.to} /> : null}

          {data.notes.length ? (
            <details className="border border-line-300 bg-surface-900 px-4 py-3 text-xs text-ink-400">
              <summary className="cursor-pointer font-black text-ink-300">Data notes ({data.notes.length})</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {data.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <p className="text-[11px] text-ink-600">Generated {new Date(data.generatedAt).toLocaleString("en")}.</p>
        </div>
      ) : null}
    </AdminPage>
  );
}
