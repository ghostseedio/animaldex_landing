"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Card, CardContent, CardHeader, InfoTip, Segmented, StatGridSkeleton, TD, TH, Table, cn } from "@/components/admin/ui";
import { errorFromBody } from "@/lib/admin-fetch-json";
import { ARK_MIN_DAYS_FOR_RATE, ARK_SOURCES, type ArkMeasureSummary, type ArkPeriod, type ArkSource, type ArkWeek } from "@/lib/ark-measure";
import { ShareBar, TrendChart } from "./charts";
import { dayLabel, num, pct, share, singleSeriesColor } from "./format";
import { Tile, TileGrid } from "./tabs";

/** GET /api/admin/analytics/ark */
export type ArkMeasureResponse = {
  ok: true;
  today: string;
  generatedAt: string;
  from: string;
  to: string;
  launchDay: string;
  summary: ArkMeasureSummary;
  arrivalsFrom: "voyage_events" | "voyage_animals" | "none";
  seenRecorded: boolean;
  eventsRecorded: boolean;
  notes: string[];
};

const SOURCE_LABELS: Record<ArkSource, string> = {
  chat_panel: "Chat panel",
  ark_page: "/ark page",
  capture_band: "Capture card",
  share_link: "Shared link",
};

function seconds(value: number | null) {
  if (value == null) return "—";
  if (value < 60) return `${value}s`;
  const minutes = Math.floor(value / 60);
  return `${minutes}m ${String(value % 60).padStart(2, "0")}s`;
}

function periodLabel(period: ArkPeriod) {
  return `${num(period.days)} day${period.days === 1 ? "" : "s"}`;
}

/** A weekly rate, or the plain count while the period is under a week (a rate from a day or two misleads). */
function weekly(rate: number | null, period: ArkPeriod) {
  return rate === null ? `${num(period.completed)} so far` : num(rate);
}

/**
 * The Ark tab: does the shared Ark get more steps completed? Weekly, from the
 * baseline weeks before the launch (2026-11-10). Steps, arrivals and arrivals
 * seen are server counts; opens and time in the Ark are the website's events.
 */
export function ArkTab({ from, to }: { from: string; to: string }) {
  const [testers, setTesters] = useState<"out" | "in">("out");
  const [data, setData] = useState<ArkMeasureResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (testers === "in") params.set("testers", "1");
      const response = await fetch(`/api/admin/analytics/ark?${params}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(errorFromBody(body, `The Ark numbers failed to load (${response.status})`));
      setData(body as ArkMeasureResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The Ark numbers failed to load");
    } finally {
      setLoading(false);
    }
  }, [from, to, testers]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Dev testers"
          value={testers}
          onChange={setTesters}
          options={[
            { value: "out", label: "Without dev testers" },
            { value: "in", label: "With dev testers" },
          ]}
        />
      </div>
      {error ? <Alert tone="bad">{error}</Alert> : null}
      {loading && !data ? <StatGridSkeleton count={6} /> : null}
      {data ? (
        <div aria-busy={loading || undefined} className={cn("transition-opacity", loading && "opacity-60")}>
          <ArkMeasureView data={data} />
        </div>
      ) : null}
    </div>
  );
}

/** The tab's content from a loaded response: also drawn by the development page from a fixture. */
export function ArkMeasureView({ data }: { data: ArkMeasureResponse }) {
  const { summary } = data;
  const weeks = summary.weeks;
  const launchIndex = weeks.findIndex((week) => week.from <= data.launchDay && data.launchDay <= week.to);
  const markers = launchIndex >= 0 ? [{ index: launchIndex, label: `Ark opens · ${data.launchDay.slice(5)}` }] : [];
  const labels = weeks.map((week) => week.label);
  const partialLast = weeks.at(-1)?.partial ?? false;
  const { baseline, sinceLaunch } = summary;
  const opensTotal = weeks.reduce((sum, week) => sum + week.opensTotal, 0);
  const opensBySource = ARK_SOURCES.map((source) => ({ source, count: weeks.reduce((sum, week) => sum + week.opens[source], 0) }));
  const sessions = weeks.reduce((sum, week) => sum + week.sessions, 0);
  const sessionSeconds = weeks.reduce((sum, week) => sum + (week.avgSeconds ?? 0) * week.sessions, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="The Ark · does it get more steps completed?"
          description={`Steps, arrivals and arrivals seen are server counts (animal_companion_trials, ${data.arrivalsFrom === "voyage_events" ? "voyage_events" : "voyage_animals"}, ark_seen_events), each counted in the week it happened. Weeks before ${dayLabel(data.launchDay, true)} are the baseline. ${summary.testersExcluded ? "Dev testers are left out." : "Dev testers are included."} Numbers this small move by one person: read them as a direction, not a result.`}
          action={<Badge tone={summary.testersExcluded ? "neutral" : "warn"}>{summary.testersExcluded ? "Without dev testers" : "With dev testers"}</Badge>}
        />
        <CardContent>
          <TileGrid>
            <Tile
              label="Completed / week · before"
              value={weekly(baseline.completedPerWeek, baseline)}
              hint={`${num(baseline.completed)} in ${periodLabel(baseline)}`}
              info="Steps marked done (done_at, status done) per 7 days, from the first week with steps to the day before the Ark opened."
            />
            <Tile
              label="Completed / week · since"
              value={weekly(sinceLaunch.completedPerWeek, sinceLaunch)}
              hint={sinceLaunch.completedPerWeek === null ? `${periodLabel(sinceLaunch)} since launch: a weekly rate from ${ARK_MIN_DAYS_FOR_RATE} days` : `${num(sinceLaunch.completed)} in ${periodLabel(sinceLaunch)}`}
              info="The same, from the Ark's launch day to the end of the range. Under a week it shows the count, not a rate."
            />
            <Tile label="Done of offered · before" value={pct(baseline.completionRate)} hint={`${num(baseline.completed)} of ${num(baseline.offered)}`} info="Completed steps over steps offered (set_at), both counted in the period." />
            <Tile label="Done of offered · since" value={pct(sinceLaunch.completionRate)} hint={`${num(sinceLaunch.completed)} of ${num(sinceLaunch.offered)}`} />
            <Tile label="Worked · before → since" value={`${num(baseline.worked)} → ${num(sinceLaunch.worked)}`} hint={`per week: ${num(baseline.workedPerWeek)} → ${num(sinceLaunch.workedPerWeek)}`} info="Steps whose outcome was 'worked': the ones that bring an animal aboard." />
            <Tile
              label="Arrivals seen by owner"
              value={data.seenRecorded ? `${num(summary.arrivalsSeenByOwner)} of ${num(summary.arrivalsWithOwner)}` : "—"}
              hint={data.seenRecorded ? "arrivals in range whose owner has seen them aboard" : "not recorded yet (migration 20261111150000)"}
              info="An Ark surface (the /ark page, the chat's panel, a capture card's band) showed the signed-in owner their own animal aboard, at least once."
            />
          </TileGrid>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Steps completed per week" description="Server count (done_at). The dashed line is the week the Ark opened." />
          <CardContent>
            <TrendChart
              compact
              label="Steps completed per week"
              labels={labels}
              series={[{ key: "completed", label: "Completed", color: singleSeriesColor, values: weeks.map((week) => week.completed) }]}
              format={(value) => num(value)}
              markers={markers}
              partialLast={partialLast}
              height={200}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Arrivals per week" description={data.arrivalsFrom === "voyage_events" ? "voyage_events, kind 'arrival'." : "voyage_animals.arrived_at (until life v2's voyage_events is applied)."} />
          <CardContent>
            <TrendChart
              compact
              label="Arrivals per week"
              labels={labels}
              series={[{ key: "arrivals", label: "Arrivals", color: singleSeriesColor, values: weeks.map((week) => week.arrivals) }]}
              format={(value) => num(value)}
              markers={markers}
              partialLast={partialLast}
              height={200}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Ark opens and time in the Ark"
          description="The website's events (web_ark_events): an open is one visit to an Ark surface; time is how long it stayed on screen with the tab in front. The apps send the same events to Firebase."
          action={data.eventsRecorded ? <Badge>{num(opensTotal)} opens · avg {seconds(sessions ? Math.round(sessionSeconds / sessions) : null)}</Badge> : <Badge tone="warn">Not recorded yet</Badge>}
        />
        <CardContent>
          {data.eventsRecorded ? (
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <TrendChart
                label="Ark opens per week"
                labels={labels}
                series={[{ key: "opens", label: "Opens", color: singleSeriesColor, values: weeks.map((week) => week.opensTotal) }]}
                format={(value) => num(value)}
                markers={markers}
                partialLast={partialLast}
                height={180}
              />
              <div className="space-y-2">
                {opensBySource.map((row) => (
                  <ShareBar key={row.source} label={SOURCE_LABELS[row.source]} value={share(row.count, opensTotal)} detail={num(row.count)} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-400">Opens, time and taps are recorded once landing migration 20261110130000 (web_ark_events) is applied and the site is deployed.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Weekly step funnel"
          description="Offered (set_at) → completed (done_at) → worked (outcome) → arrived → arrival seen by its owner. Each stage is counted in the week it happened, so a step offered one week and done the next counts in both."
        />
        <WeeklyTable weeks={weeks} data={data} />
      </Card>

      {data.notes.length ? (
        <details className="border border-line-300 bg-surface-900 px-4 py-3 text-xs text-ink-400">
          <summary className="cursor-pointer font-black text-ink-300">Ark data notes ({data.notes.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {data.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function WeeklyTable({ weeks, data }: { weeks: ArkWeek[]; data: ArkMeasureResponse }) {
  const head = (label: string, info?: string) => (
    <TH numeric>
      <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap">
        {label}
        {info ? <InfoTip>{info}</InfoTip> : null}
      </span>
    </TH>
  );
  return (
    <Table minWidth={980}>
      <thead>
        <tr>
          <TH>Week</TH>
          {head("Offered")}
          {head("Completed")}
          {head("Worked", "Outcome 'worked'. Partly and didn't work are in the tooltip of Completed.")}
          {head("Arrived")}
          {head("Seen", "Arrivals seen by their owner on an Ark surface, counted in the week they were first seen.")}
          {head("Opens")}
          {head("Avg time")}
          {head("Taps · follows · replays")}
        </tr>
      </thead>
      <tbody>
        {[...weeks].reverse().map((week) => (
          <tr key={week.key} className={cn("hover:bg-white/[.02]", week.baseline && "text-ink-400")}>
            <TD className="whitespace-nowrap">
              <span className="inline-flex items-center gap-2 font-bold text-white">
                {week.label}
                {week.baseline ? <Badge>Baseline</Badge> : week.from <= data.launchDay && data.launchDay <= week.to ? <Badge tone="good">Launch week</Badge> : null}
                {week.partial ? <span className="text-[11px] font-normal text-ink-500">partial</span> : null}
              </span>
            </TD>
            <TD numeric>{num(week.offered)}</TD>
            <TD numeric title={`${week.worked} worked · ${week.partly} partly · ${week.didntWork} didn't work · ${week.completed - week.worked - week.partly - week.didntWork} no outcome`}>
              {num(week.completed)}
            </TD>
            <TD numeric>{num(week.worked)}</TD>
            <TD numeric>{num(week.arrivals)}</TD>
            <TD numeric>{data.seenRecorded ? num(week.arrivalsSeen) : "—"}</TD>
            <TD numeric title={data.eventsRecorded ? ARK_SOURCES.map((source) => `${SOURCE_LABELS[source]} ${week.opens[source]}`).join(" · ") : undefined}>
              {data.eventsRecorded ? num(week.opensTotal) : "—"}
            </TD>
            <TD numeric>{data.eventsRecorded ? seconds(week.avgSeconds) : "—"}</TD>
            <TD numeric>{data.eventsRecorded ? `${num(week.taps)} · ${num(week.follows)} · ${num(week.replays)}` : "—"}</TD>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
