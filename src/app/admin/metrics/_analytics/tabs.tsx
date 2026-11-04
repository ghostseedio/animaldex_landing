"use client";

import { FormEvent, useState } from "react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, EmptyState, Field, InfoTip, TD, TH, Table, cn, fieldClass } from "@/components/admin/ui";
import type { GroupRow, Platform } from "@/lib/product-analytics";
import { Legend, ShareBar, TrendChart } from "./charts";
import { formatMetric, markersFor, metricDefs, seriesFor } from "./overview";
import { countDelta, num, pct, platformColors, platformLabels, share, singleSeriesColor, storeColors, storeLabels, usd } from "./format";
import type { AnalyticsResponse } from "./types";

function PlatformTag({ platform }: { platform: Platform | undefined }) {
  if (!platform) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-300">
      <span className="h-2 w-2" style={{ background: platformColors[platform] }} aria-hidden="true" />
      {platformLabels[platform]}
    </span>
  );
}

function Tile({ label, value, hint, info }: { label: string; value: string; hint?: string; info?: string }) {
  return (
    <div className="min-w-0 border border-line-300 bg-surface-900 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[.12em] text-ink-500">
        {label}
        {info ? <InfoTip>{info}</InfoTip> : null}
      </p>
      <p className="mt-1 font-display text-2xl leading-tight text-white tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-4 text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function TileGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{children}</div>;
}
export { Tile };

type SortKey = "users" | "activation" | "d1" | "d7" | "talk" | "push" | "payers";
const sortValue: Record<SortKey, (row: GroupRow) => number> = {
  users: (row) => row.users,
  activation: (row) => row.activation.rate ?? -1,
  d1: (row) => row.d1.rate ?? -1,
  d7: (row) => row.d7.rate ?? -1,
  talk: (row) => row.talkedWeek1.rate ?? -1,
  push: (row) => row.pushOptIn.rate ?? -1,
  payers: (row) => row.payers.users,
};

/** Signup groups (channels, landing pages) with the quality of the users each brought. Click a column to sort. */
function GroupTable({ rows, total, first, showPlatform, empty }: { rows: GroupRow[]; total: number; first: string; showPlatform?: boolean; empty: string }) {
  const [sort, setSort] = useState<SortKey>("users");
  const [all, setAll] = useState(false);
  if (!rows.length) return <EmptyState className="m-4 py-8" title={empty} />;
  const sorted = [...rows].sort((a, b) => sortValue[sort](b) - sortValue[sort](a) || b.users - a.users);
  const visible = all ? sorted : sorted.slice(0, 15);
  const header = (key: SortKey, label: string, info?: string) => (
    <TH numeric>
      <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap">
        <button
          type="button"
          onClick={() => setSort(key)}
          className={cn("font-black uppercase tracking-[inherit]", sort === key ? "text-primary-200" : "hover:text-white")}
        >
          {label}
          {sort === key ? " ↓" : null}
        </button>
        {info ? <InfoTip>{info}</InfoTip> : null}
      </span>
    </TH>
  );
  return (
    <>
      <Table minWidth={860}>
        <thead>
          <tr>
            <TH>{first}</TH>
            {showPlatform ? <TH>Platform</TH> : null}
            {header("users", "Signups")}
            <TH numeric>Share</TH>
            {header("activation", "Activated")}
            {header("d1", "D1")}
            {header("d7", "D7")}
            {header("talk", "Talked wk 1", "Talked to an animal in their first 7 days. Talk logging started Oct 27 2026; earlier signups show —.")}
            {header("push", "Push on")}
            {header("payers", "Payers")}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={`${row.key}|${row.platform ?? ""}`} className="hover:bg-white/[.02]">
              <TD className="max-w-[320px]">
                <span className="break-words font-bold text-white">{row.label}</span>{" "}
                {row.kind === "paid" ? <Badge tone="warn">Paid</Badge> : null}
                {row.evidence === "self_reported" ? <span className="ml-1 text-[11px] text-ink-500">said in app</span> : null}
                {row.evidence === "store" && row.key !== "unknown" ? <span className="ml-1 text-[11px] text-ink-500">tracked</span> : null}
              </TD>
              {showPlatform ? (
                <TD>
                  <PlatformTag platform={row.platform} />
                </TD>
              ) : null}
              <TD numeric className="font-bold text-white">
                {num(row.users)}
              </TD>
              <TD numeric className="text-ink-400">
                {pct(share(row.users, total))}
              </TD>
              <TD numeric title={`${row.activation.users} of ${row.activation.eligible}`}>{pct(row.activation.rate)}</TD>
              <TD numeric title={`${row.d1.users} of ${row.d1.eligible}`}>{pct(row.d1.rate)}</TD>
              <TD numeric title={`${row.d7.users} of ${row.d7.eligible}`}>{pct(row.d7.rate)}</TD>
              <TD numeric>{pct(row.talkedWeek1.rate)}</TD>
              <TD numeric>{pct(row.pushOptIn.rate)}</TD>
              <TD numeric>{num(row.payers.users)}</TD>
            </tr>
          ))}
        </tbody>
      </Table>
      {sorted.length > 15 ? (
        <div className="border-t border-line-300 px-4 py-2">
          <Button size="sm" variant="ghost" onClick={() => setAll(!all)}>
            {all ? "Show top 15" : `Show all ${sorted.length}`}
          </Button>
        </div>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Acquisition
// ---------------------------------------------------------------------------

export function Acquisition({ data }: { data: AnalyticsResponse }) {
  const signups = data.current.signups;
  const unattributed = data.channels.filter((row) => row.key === "unknown").reduce((sum, row) => sum + row.users, 0);
  const landed = data.landingPages.reduce((sum, row) => sum + row.users, 0);
  const search = data.search;
  const clicksDelta = countDelta(search.totals.clicks, search.previousTotals.clicks);
  return (
    <div className="space-y-4">
      <TileGrid>
        <Tile label="New users" value={num(signups.users)} hint={`${num(signups.byPlatform.ios)} iOS · ${num(signups.byPlatform.android)} Android · ${num(signups.byPlatform.web)} web`} />
        <Tile
          label="Source known"
          value={pct(share(signups.users - unattributed, signups.users))}
          hint={`${num(unattributed)} not attributed yet`}
          info="A store-tracked source (Play install referrer, Apple Ads, a website link or the web referrer) or an answer to “Where did you hear about AnimalDex?”."
        />
        <Tile label="Platform known" value={pct(share(signups.users - signups.byPlatform.unknown, signups.users))} hint={`${num(signups.byPlatform.unknown)} unknown`} />
        <Tile label="From a website page" value={num(landed)} hint="Web first visit or a Play link on the site" />
        <Tile
          label="Google clicks"
          value={search.note ? "—" : num(search.totals.clicks)}
          hint={search.note ? "Search Console not connected here" : `${clicksDelta?.text ?? ""} vs previous · ${num(search.totals.impressions)} impressions`}
        />
        <Tile label="Google CTR" value={search.note ? "—" : pct(share(search.totals.clicks, search.totals.impressions))} />
      </TileGrid>

      <Card>
        <CardHeader
          title="Where new users came from"
          description="Each channel and platform with the quality of users it brought. “Said in app” is the answer to “Where did you hear about AnimalDex?”; “tracked” comes from the store, an ad network or the website. Hover a rate for its counts."
        />
        <GroupTable rows={data.channels} total={signups.users} first="Channel" showPlatform empty="No signups in this range." />
      </Card>

      <Card>
        <CardHeader
          title="Website pages that brought signups"
          description="The page a web signup first landed on, or the page whose Google Play button an Android user tapped. Exact pages start with this release; older Play installs only name the section or the button."
        />
        <GroupTable rows={data.landingPages} total={landed} first="Page" empty="No signups traced to a website page in this range yet." />
      </Card>

      <Card>
        <CardHeader
          title="Google search · top landing pages"
          description="Search Console clicks and impressions per page for the range (Pacific days, trails 1–2 days). Clicks are visits, not signups."
        />
        {search.note ? (
          <CardContent>
            <p className="text-sm text-ink-400">{search.note}</p>
          </CardContent>
        ) : search.pages.length ? (
          <Table minWidth={720}>
            <thead>
              <tr>
                <TH>Page</TH>
                <TH numeric>Clicks</TH>
                <TH numeric>vs previous</TH>
                <TH numeric>Impressions</TH>
                <TH numeric>CTR</TH>
                <TH numeric>Avg position</TH>
              </tr>
            </thead>
            <tbody>
              {search.pages.map((row) => {
                const delta = countDelta(row.clicks, row.previousClicks);
                return (
                  <tr key={row.page} className="hover:bg-white/[.02]">
                    <TD className="max-w-[420px] break-all font-bold text-white">{row.page}</TD>
                    <TD numeric className="font-bold text-white">
                      {num(row.clicks)}
                    </TD>
                    <TD numeric className={delta?.tone === "good" ? "text-primary-200" : delta?.tone === "bad" ? "text-red-300" : "text-ink-400"}>
                      {delta?.text ?? "—"}
                    </TD>
                    <TD numeric>{num(row.impressions)}</TD>
                    <TD numeric>{pct(row.ctr)}</TD>
                    <TD numeric>{row.position}</TD>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState className="m-4 py-8" title="No search clicks in this range." />
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Engagement
// ---------------------------------------------------------------------------

export function Engagement({ data }: { data: AnalyticsResponse }) {
  const activity = data.current.activity;
  const labels = data.series.map((row) => row.label);
  const markers = markersFor(data);
  const partial = data.series[data.series.length - 1]?.partial ?? false;
  const activeSeries = seriesFor(metricDefs.active, data.series);
  const reachLabels: Array<{ kind: "capture" | "talk" | "trial" | "debate"; label: string; noun: string }> = [
    { kind: "capture", label: "Captured", noun: "captures" },
    { kind: "talk", label: "Talked to an animal", noun: "messages" },
    { kind: "trial", label: "Did a Trial", noun: "trial actions" },
    { kind: "debate", label: "Asked a debate", noun: "debates" },
  ];
  const coverageNote = (["talk", "open", "debate"] as const)
    .filter((kind) => data.coverage[kind] && data.coverage[kind]! > data.range.from)
    .map((kind) => `${kind === "open" ? "App opens" : kind === "talk" ? "Talk" : "Debates"} from ${data.coverage[kind]}`)
    .join(" · ");
  return (
    <div className="space-y-4">
      <TileGrid>
        <Tile label="Active users" value={num(activity.activeUsers)} hint={`${num(activity.returningUsers)} signed up before this range`} info={metricDefs.active.info} />
        <Tile label="Avg daily active" value={num(activity.avgDau)} hint="Mean DAU over finished days" />
        <Tile label="Stickiness" value={pct(activity.stickiness)} info="Average DAU ÷ active users in the range: the share of days a typical active user shows up. Compare like-for-like ranges (it falls as the range gets longer)." />
        <Tile label="Captures" value={num(activity.counts.capture)} hint={`${num(activity.reach.capture.users)} people`} />
        <Tile label="Talk messages" value={num(activity.counts.talk)} hint={`${num(activity.reach.talk.users)} people`} />
        <Tile label="Push opt-in (app users)" value={pct(share(data.push.optedIn, data.push.nativeActive30d))} hint={`${num(data.push.optedIn)} of ${num(data.push.nativeActive30d)} seen in 30 days`} />
      </TileGrid>
      {coverageNote ? (
        <Alert tone="info" className="py-2 text-xs">
          Some activity is only logged from a recent date, so earlier periods read low: {coverageNote}.
        </Alert>
      ) : null}

      <Card>
        <CardHeader title={`Active users by ${data.range.grain}`} description={metricDefs.active.info} />
        <CardContent className="space-y-3">
          <TrendChart label="Active users" labels={labels} series={activeSeries} format={(value) => num(value)} markers={markers} partialLast={partial} />
          <Legend items={activeSeries.map((item) => ({ label: item.label, color: item.color }))} />
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="What active users did" description="Share of the range's active users who did each thing at least once." />
          <CardContent className="space-y-3">
            {reachLabels.map(({ kind, label, noun }) => (
              <ShareBar key={kind} label={label} value={activity.reach[kind].rate} detail={`${num(activity.reach[kind].users)} · ${num(activity.counts[kind])} ${noun}`} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Notifications" description="App users seen in the last 30 days with a push token (iOS only registers one after Allow)." />
          <CardContent className="space-y-3">
            {(["ios", "android"] as const).map((platform) => (
              <ShareBar
                key={platform}
                label={platformLabels[platform]}
                color={platformColors[platform]}
                value={share(data.push.byPlatform[platform].optedIn, data.push.byPlatform[platform].users)}
                detail={`${num(data.push.byPlatform[platform].optedIn)} of ${num(data.push.byPlatform[platform].users)}`}
              />
            ))}
            <p className="text-[11px] text-ink-500">New users&apos; opt-in by period is on Overview → Push opt-in.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {(["talk", "capture"] as const).map((key) => (
          <Card key={key}>
            <CardHeader title={`${metricDefs[key].label} by ${data.range.grain}`} description={metricDefs[key].info} />
            <CardContent>
              <TrendChart
                label={metricDefs[key].label}
                labels={labels}
                series={[{ key, label: metricDefs[key].label, color: singleSeriesColor, values: data.series.map((row) => metricDefs[key].value(row)) }]}
                type="line"
                percent
                format={pct}
                markers={markers}
                height={200}
                compact
                partialLast={partial}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------------

function heat(value: number | null) {
  if (value == null) return undefined;
  return { backgroundColor: `rgba(89,241,118,${Math.max(0.06, Math.min(0.75, (value / 60) * 0.75))})` };
}

export function Retention({ data }: { data: AnalyticsResponse }) {
  const signups = data.current.signups;
  const labels = data.series.map((row) => row.label);
  const markers = markersFor(data);
  return (
    <div className="space-y-4">
      <TileGrid>
        <Tile label="Activated" value={pct(signups.activation.rate)} hint={`${num(signups.activation.users)} of ${num(signups.activation.eligible)}`} info={metricDefs.activation.info} />
        <Tile label="D1" value={pct(signups.d1.rate)} hint={`${num(signups.d1.users)} of ${num(signups.d1.eligible)}`} info={metricDefs.d1.info} />
        <Tile label="D7" value={pct(signups.d7.rate)} hint={`${num(signups.d7.users)} of ${num(signups.d7.eligible)}`} info={metricDefs.d7.info} />
        <Tile label="D30" value={pct(signups.d30.rate)} hint={`${num(signups.d30.users)} of ${num(signups.d30.eligible)}`} />
        <Tile label="Talked in week 1" value={pct(signups.talkedWeek1.rate)} hint={`${num(signups.talkedWeek1.users)} of ${num(signups.talkedWeek1.eligible)}`} />
        <Tile label="Captures in week 1" value={signups.capturesWeek1 == null ? "—" : String(signups.capturesWeek1)} hint="Per new user" />
      </TileGrid>

      <Card>
        <CardHeader
          title="Retention by weekly signup cohort"
          description="Share of each week's new users who were active N days after signing up. Blank cells are too recent to count. App opens are only logged daily once the analytics migration is applied, so older cohorts lean on captures and talk."
        />
        {data.retention.length ? (
          <Table minWidth={680}>
            <thead>
              <tr>
                <TH>Signed up</TH>
                <TH numeric>Users</TH>
                {(["d1", "d3", "d7", "d14", "d30"] as const).map((key) => (
                  <TH key={key} numeric>
                    {key.toUpperCase()}
                  </TH>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data.retention].reverse().map((row) => (
                <tr key={row.cohort}>
                  <TD className="whitespace-nowrap font-bold text-white">{row.label}</TD>
                  <TD numeric>{num(row.size)}</TD>
                  {(["d1", "d3", "d7", "d14", "d30"] as const).map((key) => (
                    <TD key={key} numeric className="p-1">
                      <span className={cn("block px-2 py-1.5", row.days[key] == null ? "text-ink-600" : "text-white")} style={heat(row.days[key])}>
                        {pct(row.days[key])}
                      </span>
                    </TD>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState className="m-4 py-8" title="No cohorts in this range." />
        )}
      </Card>

      <div className="grid gap-3 xl:grid-cols-3">
        {(["activation", "d1", "d7"] as const).map((key) => (
          <Card key={key}>
            <CardHeader title={`${metricDefs[key].label} by signup ${data.range.grain}`} />
            <CardContent>
              <TrendChart
                label={metricDefs[key].label}
                labels={labels}
                series={[{ key, label: metricDefs[key].label, color: singleSeriesColor, values: data.series.map((row) => metricDefs[key].value(row)) }]}
                type="line"
                percent
                format={pct}
                markers={markers}
                height={200}
                compact
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

export function Revenue({ data }: { data: AnalyticsResponse }) {
  const revenue = data.current.revenue;
  const prior = data.prior.revenue;
  const series = seriesFor(metricDefs.revenue, data.series);
  const stores = Object.keys(storeLabels) as Array<keyof typeof storeLabels>;
  return (
    <div className="space-y-4">
      <TileGrid>
        <Tile label="Revenue (list price)" value={usd(revenue.usd)} hint={`${countDelta(revenue.usd, prior.usd, true, usd)?.text ?? ""} vs ${usd(prior.usd)}`} info={metricDefs.revenue.info} />
        <Tile label="Purchases" value={num(revenue.purchases)} hint={`${num(revenue.pro)} Pro`} />
        <Tile label="Payers" value={num(revenue.payers)} hint={`${num(revenue.newPayers)} paying for the first time`} />
        <Tile
          label="Signups who paid"
          value={pct(data.current.signups.payers.rate)}
          hint={`${num(data.current.signups.payers.users)} of ${num(data.current.signups.users)} new users, ever`}
        />
        <Tile label="Revenue per active user" value={usd(data.current.activity.activeUsers ? revenue.usd / data.current.activity.activeUsers : null)} />
        <Tile label="Avg purchase" value={usd(revenue.purchases ? revenue.usd / revenue.purchases : null)} />
      </TileGrid>
      <Card>
        <CardHeader title={`Revenue by ${data.range.grain}`} description="Estimated at list price, by store." />
        <CardContent className="space-y-3">
          <TrendChart label="Revenue" labels={data.series.map((row) => row.label)} series={series} format={usd} markers={markersFor(data)} partialLast={data.series[data.series.length - 1]?.partial} />
          {series.length > 1 ? <Legend items={series.map((item) => ({ label: item.label, color: item.color }))} /> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="By store" />
        <Table minWidth={560}>
          <thead>
            <tr>
              <TH>Store</TH>
              <TH numeric>Purchases</TH>
              <TH numeric>Revenue</TH>
              <TH numeric>Previous period</TH>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => (
              <tr key={store}>
                <TD className="font-bold text-white">{storeLabels[store]}</TD>
                <TD numeric>{num(revenue.byStore[store].purchases)}</TD>
                <TD numeric>{usd(revenue.byStore[store].usd)}</TD>
                <TD numeric className="text-ink-400">
                  {usd(prior.byStore[store].usd)}
                </TD>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Releases
// ---------------------------------------------------------------------------

function BeforeAfter({ before, after, rate = true }: { before: number | null; after: number | null; rate?: boolean }) {
  const change = before != null && after != null ? Math.round((after - before) * 10) / 10 : null;
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="text-ink-400">{rate ? pct(before) : num(before)}</span>
      <span className="mx-1 text-ink-600">→</span>
      <span className="font-bold text-white">{rate ? pct(after) : num(after)}</span>
      {change != null && change !== 0 ? (
        <span className={cn("ml-1.5 text-[11px]", change > 0 ? "text-primary-200" : "text-red-300")}>
          {change > 0 ? "+" : ""}
          {change}
          {rate ? " pts" : ""}
        </span>
      ) : null}
    </span>
  );
}

export function Releases({ data, reload }: { data: AnalyticsResponse; reload: () => void }) {
  const [day, setDay] = useState(data.today);
  const [platform, setPlatform] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const response = await fetch("/api/admin/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, platform: platform || null, label }),
    });
    const body = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !body?.ok) return setError(body?.error ?? "Couldn't save the marker.");
    setLabel("");
    reload();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/analytics?id=${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Releases and markers in this range"
          description="New users in the 7 days before each release against the 7 days from it, on that platform. The after side fills in over a week, and a week is a small sample: read it with the chart, not alone. App versions are recorded the first time any user reports them; older ones come from the version-bump commit."
        />
        {data.releases.length ? (
          <Table minWidth={860}>
            <thead>
              <tr>
                <TH>Date</TH>
                <TH>Release</TH>
                <TH numeric>New users / 7 days</TH>
                <TH numeric>Activated</TH>
                <TH numeric>D1</TH>
                <TH numeric>D7</TH>
              </tr>
            </thead>
            <tbody>
              {data.releases.map((release) => (
                <tr key={`${release.platform}-${release.version}-${release.day}-${release.label ?? ""}`} className="hover:bg-white/[.02]">
                  <TD className="whitespace-nowrap">{release.day}</TD>
                  <TD>
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {release.platform !== "unknown" ? <PlatformTag platform={release.platform} /> : <span className="text-xs text-ink-400">All platforms</span>}
                      <span className="font-bold text-white">{release.source === "note" ? release.label : release.version}</span>
                      <span className="text-[11px] text-ink-500">{release.source === "store" ? "first user on it" : release.source === "build" ? "version bump" : "marker"}</span>
                      {release.daysAfter < 7 ? <Badge tone="warn">{release.daysAfter}/7 days after</Badge> : null}
                      {release.source === "note" ? (
                        <button
                          type="button"
                          className="text-[11px] text-ink-500 underline hover:text-red-300"
                          onClick={() => {
                            const match = data.annotations.find((note) => note.day === release.day && note.label === release.label);
                            if (match) void remove(match.id);
                          }}
                        >
                          remove
                        </button>
                      ) : null}
                    </span>
                  </TD>
                  <TD numeric>
                    <BeforeAfter before={release.before.users} after={release.after.users} rate={false} />
                  </TD>
                  <TD numeric>
                    <BeforeAfter before={release.before.activation.rate} after={release.after.activation.rate} />
                  </TD>
                  <TD numeric>
                    <BeforeAfter before={release.before.d1.rate} after={release.after.d1.rate} />
                  </TD>
                  <TD numeric>
                    <BeforeAfter before={release.before.d7.rate} after={release.after.d7.rate} />
                  </TD>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState className="m-4 py-8" title="No releases or markers in this range." />
        )}
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="Add a marker" description="A website launch, a campaign, a press mention: it shows on every chart as ◆ so you can line it up against the numbers." />
          <CardContent>
            <form onSubmit={add} className="grid gap-3 sm:grid-cols-[150px_150px_1fr_auto] sm:items-end">
              <Field label="Day">
                <input type="date" value={day} max={data.today} onChange={(event) => setDay(event.target.value)} className={fieldClass} required />
              </Field>
              <Field label="Platform">
                <select value={platform} onChange={(event) => setPlatform(event.target.value)} className={fieldClass}>
                  <option value="">All</option>
                  <option value="ios">iOS</option>
                  <option value="android">Android</option>
                  <option value="web">Web</option>
                </select>
              </Field>
              <Field label="Label">
                <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} placeholder="New home page" className={fieldClass} required />
              </Field>
              <Button type="submit" variant="primary" loading={saving}>
                Add
              </Button>
            </form>
            {error ? (
              <Alert tone="bad" className="mt-3">
                {error}
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="App versions in use" description="Each app user's latest version, and how many were seen in the last 30 days." />
          {data.versions.length ? (
            <Table minWidth={420}>
              <thead>
                <tr>
                  <TH>Platform</TH>
                  <TH>Version</TH>
                  <TH numeric>Users</TH>
                  <TH numeric>Seen in 30 days</TH>
                </tr>
              </thead>
              <tbody>
                {data.versions.map((row) => (
                  <tr key={`${row.platform}-${row.version}`}>
                    <TD>
                      <PlatformTag platform={row.platform} />
                    </TD>
                    <TD className="font-bold text-white">{row.version}</TD>
                    <TD numeric>{num(row.users)}</TD>
                    <TD numeric>{num(row.activeUsers30d)}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState className="m-4 py-8" title="No app has reported a version yet." />
          )}
        </Card>
      </div>
    </div>
  );
}

export { formatMetric };
