"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import type {AiSpendReport} from "@/lib/ai-spend";
import {AdminPage, Alert, Badge, ListSkeleton, PageHeader, RefreshButton, Section, Segmented, Stat, StatGrid, Table, TD, TH} from "@/components/admin/ui";

/**
 * Where the AI money goes. Two views of the same spend: what each provider
 * billed (Anthropic and OpenAI admin cost reports) and our own call ledger
 * (ai_usage_events), which says who made each call: the apps' edge
 * functions, the production web server, or a local run (dev server, scripts,
 * Claude Code testing). Billed Claude spend the ledger cannot account for is
 * "untracked". Built on src/lib/ai-spend.ts.
 */

type Payload = {ok: boolean; error?: string; report: AiSpendReport};
type Range = "1" | "7" | "14" | "30";
type SourceFilter = "all" | "app" | "prod" | "local";

// Validated (dataviz validate_palette, dark, on surface-900): blue, orange, aqua, yellow.
const SERIES = [
    {key: "app", label: "Apps (edge functions)", color: "#3987e5"},
    {key: "prod", label: "Web server (prod)", color: "#d95926"},
    {key: "local", label: "Local runs & testing", color: "#199e70"},
    {key: "untracked", label: "Untracked Claude", color: "#c98500", hatched: true}
] as const;

const SOURCE_LABEL: Record<string, string> = {app: "Apps", prod: "Web prod", local: "Local"};
const PROVIDER_LABEL: Record<string, string> = {anthropic: "Claude", openai: "OpenAI", gemini: "Gemini", elevenlabs: "ElevenLabs", google_tts: "Google TTS"};

function usd(value: number | null | undefined, digits = 2) {
    if (value == null) return "—";
    if (value > 0 && value < 0.01 && digits === 2) return "<$0.01";
    return `$${value.toFixed(digits)}`;
}

function tokens(value: number) {
    return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1000 ? `${Math.round(value / 1000)}k` : String(value);
}

function ago(iso: string, now: number) {
    const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
    if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
    return `${Math.round(seconds / 86_400)}d ago`;
}

type Bar = {key: string; label: string; values: number[]};

/** Stacked bars, one per day or hour, with a hover readout. Square marks (the site's square design). */
function StackedBars({bars, series, height = 160}: {bars: Bar[]; series: ReadonlyArray<{label: string; color: string; hatched?: boolean}>; height?: number}) {
    const [hover, setHover] = useState<number | null>(null);
    const max = Math.max(0.01, ...bars.map((bar) => bar.values.reduce((a, b) => a + b, 0)));
    const width = 1000;
    const slot = width / Math.max(1, bars.length);
    const barWidth = Math.max(2, slot - Math.min(6, slot * 0.25));
    const active = hover == null ? null : bars[hover];
    const tickEvery = Math.ceil(bars.length / 8);
    return (
        <div className="relative">
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block h-40 w-full" role="img" aria-label="Spend over time" onMouseLeave={() => setHover(null)}>
                <defs>
                    <pattern id="ai-spend-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="6" height="6" fill="#c98500" opacity="0.35" />
                        <line x1="0" y1="0" x2="0" y2="6" stroke="#c98500" strokeWidth="3" />
                    </pattern>
                </defs>
                {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="0" x2={width} y1={height - f * height} y2={height - f * height} stroke="currentColor" className="text-white/[.06]" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
                {bars.map((bar, i) => {
                    let y = height;
                    return (
                        <g key={bar.key} onMouseEnter={() => setHover(i)}>
                            <rect x={i * slot} y={0} width={slot} height={height} fill="transparent" />
                            {bar.values.map((value, s) => {
                                if (value <= 0) return null;
                                const h = (value / max) * height;
                                y -= h;
                                // 2px surface gap between stacked segments.
                                return <rect key={s} x={i * slot + (slot - barWidth) / 2} y={y} width={barWidth} height={Math.max(0, h - (h > 3 ? 1.5 : 0))} fill={series[s].hatched ? "url(#ai-spend-hatch)" : series[s].color} opacity={hover == null || hover === i ? 1 : 0.45} />;
                            })}
                        </g>
                    );
                })}
            </svg>
            <div className="mt-1 flex justify-between text-[10px] tabular-nums text-ink-500">
                {bars.filter((_, i) => i % tickEvery === 0).map((bar) => <span key={bar.key}>{bar.label}</span>)}
            </div>
            <p className="absolute right-0 top-0 text-[10px] tabular-nums text-ink-500">{usd(max)}</p>
            {active ? (
                <div className="pointer-events-none absolute left-1/2 top-2 z-10 min-w-[200px] -translate-x-1/2 border border-line-300 bg-canvas-950 px-3 py-2 text-xs shadow-xl">
                    <p className="font-black text-white">{active.label}</p>
                    {active.values.map((value, s) => (
                        <p key={s} className="mt-0.5 flex items-center gap-2 text-ink-300">
                            <span className="h-2 w-2 shrink-0" style={{background: series[s].color}} />
                            <span className="flex-1">{series[s].label}</span>
                            <span className="tabular-nums text-white">{usd(value)}</span>
                        </p>
                    ))}
                    <p className="mt-1 border-t border-line-300 pt-1 text-right font-black tabular-nums text-white">{usd(active.values.reduce((a, b) => a + b, 0))}</p>
                </div>
            ) : null}
        </div>
    );
}

function Legend({series}: {series: ReadonlyArray<{label: string; color: string; hatched?: boolean}>}) {
    return (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-300">
            {series.map((item) => (
                <li key={item.label} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5" style={item.hatched ? {background: `repeating-linear-gradient(45deg, ${item.color} 0 2px, transparent 2px 4px)`, outline: `1px solid ${item.color}`} : {background: item.color}} />
                    {item.label}
                </li>
            ))}
        </ul>
    );
}

export default function AdminAiSpendClient() {
    const [range, setRange] = useState<Range>("7");
    const [auto, setAuto] = useState<"off" | "60">("off");
    const [filter, setFilter] = useState<SourceFilter>("all");
    const [data, setData] = useState<AiSpendReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(() => Date.now());

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/admin/ai-spend?days=${range}`, {cache: "no-store"});
            const payload = (await response.json()) as Payload;
            if (!response.ok || !payload.ok) throw new Error(payload.error || `Request failed (${response.status})`);
            setData(payload.report);
            setError(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not load AI spend");
        } finally {
            setLoading(false);
            setNow(Date.now());
        }
    }, [range]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (auto === "off") return;
        const timer = window.setInterval(() => {
            if (document.visibilityState === "visible") void load();
        }, Number(auto) * 1000);
        return () => window.clearInterval(timer);
    }, [auto, load]);

    const dailyBars = useMemo<Bar[]>(() => {
        if (!data) return [];
        const untracked = new Map(data.claude.days.map((day) => [day.day, day.untrackedUsd ?? 0]));
        return data.ledger.daily.map((point) => ({key: point.key, label: point.key.slice(5), values: [point.app, point.prod, point.local, untracked.get(point.key) ?? 0]}));
    }, [data]);

    const hourlyBars = useMemo<Bar[]>(() => (data?.hourly ?? []).map((point) => ({key: point.key, label: `${point.key.slice(11, 13)}h`, values: [point.app, point.prod, point.local]})), [data]);

    const features = useMemo(() => (data?.ledger.features ?? []).filter((row) => filter === "all" || row.source === filter).slice(0, 60), [data, filter]);
    const recent = useMemo(() => (data?.recent ?? []).filter((row) => filter === "all" || row.source === filter), [data, filter]);

    const comparisonsToday = data?.comparisons.perDay.at(-1)?.count ?? 0;
    const comparisonPeak = data ? data.comparisons.perDay.reduce((best, day) => day.count > best.count ? day : best, {day: "", count: 0}) : null;
    const loggedClaude = data?.ledger.byProvider.anthropic?.usd ?? 0;

    return (
        <AdminPage width="wide">
            <PageHeader
                eyebrow="Operations"
                title="AI spend"
                description="What Claude, OpenAI and Gemini cost, and who spent it: the apps (capture analysis, comparisons, catalog indexing), the web server (Ask chats, blog and social automations) or local runs and testing. Billed Claude spend that no logged call explains shows as untracked."
                meta={data ? <>Updated {ago(data.generatedAt, now)} · {data.ledger.rows.toLocaleString()} logged calls · UTC days</> : null}
                actions={
                    <>
                        <Segmented label="Range" value={range} onChange={setRange} options={[{value: "1", label: "Today"}, {value: "7", label: "7 days"}, {value: "14", label: "14 days"}, {value: "30", label: "30 days"}]} />
                        <Segmented label="Auto refresh" value={auto} onChange={setAuto} options={[{value: "off", label: "Manual"}, {value: "60", label: "Every 1 min"}]} />
                        <RefreshButton loading={loading} onClick={() => void load()} />
                    </>
                }
            />
            {error ? <Alert tone="bad" title="Could not load AI spend." className="mt-6">{error}</Alert> : null}
            {!data && loading ? <ListSkeleton rows={6} className="mt-6" /> : null}
            {data ? (
                <>
                    {data.warnings.map((warning) => <Alert key={warning} tone="warn" className="mt-6">{warning}</Alert>)}
                    {data.spikes.length ? (
                        <Alert tone="warn" title="Spending faster than usual today" className="mt-6">
                            {data.spikes.slice(0, 5).map((spike) => (
                                <span key={`${spike.source}${spike.feature}`} className="block">
                                    {SOURCE_LABEL[spike.source]} · <span className="font-mono">{spike.feature}</span>: {usd(spike.todayUsd)} today vs {usd(spike.dailyAverageUsd)}/day before
                                </span>
                            ))}
                        </Alert>
                    ) : null}

                    <StatGrid className="mt-6">
                        <Stat label="Claude billed" value={usd(data.claude.billedUsd)} hint={data.claude.note} info="Anthropic's own cost report for this range, every key and workspace in the organisation." />
                        <Stat label="Logged estimate" value={usd(data.ledger.totalUsd)} hint={`All providers, ${data.ledger.rows.toLocaleString()} calls at list price`} />
                        <Stat
                            label="Untracked Claude"
                            value={usd(data.claude.untrackedUsd)}
                            tone={data.claude.untrackedUsd != null && data.claude.billedUsd ? (data.claude.untrackedUsd / data.claude.billedUsd > 0.5 ? "warn" : undefined) : undefined}
                            hint="Billed minus logged: Batch jobs, scripts and tools on the same key"
                            info="Every Claude call from the apps and (from now on) the web server is logged. What remains is spend from outside them: the Batch API (translation runs), scripts calling the API directly, Claude-powered tools using the key, and web calls from before logging began."
                        />
                        <Stat label="Last hour / 24 h" value={<>{usd(data.lastHourUsd)} <span className="text-base text-ink-400">/ {usd(data.last24hUsd)}</span></>} hint="Logged calls only" />
                    </StatGrid>

                    <Section title="Spend per day" description="Logged calls by where they came from, plus Claude spend the ledger cannot explain. Hover a day for the split.">
                        <div className="border border-line-300 bg-surface-900 p-4">
                            <Legend series={SERIES} />
                            <StackedBars bars={dailyBars} series={SERIES} />
                        </div>
                    </Section>

                    <Section title="Last 48 hours, by hour" description="Logged calls only. A burst at one hour with nothing on either side is usually a run someone started (a backfill, a test, a script), not traffic.">
                        <div className="border border-line-300 bg-surface-900 p-4">
                            <Legend series={SERIES.slice(0, 3)} />
                            <StackedBars bars={hourlyBars} series={SERIES.slice(0, 3)} />
                        </div>
                    </Section>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Section title="By area">
                            <Table minWidth={360}>
                                <thead><tr><TH>Area</TH><TH numeric>Calls</TH><TH numeric>Est. cost</TH><TH numeric>Share</TH></tr></thead>
                                <tbody>
                                    {data.ledger.byArea.map((row) => (
                                        <tr key={row.area}>
                                            <TD className="text-white">{row.area}</TD>
                                            <TD numeric>{row.calls.toLocaleString()}</TD>
                                            <TD numeric>{usd(row.usd)}</TD>
                                            <TD numeric>{data.ledger.totalUsd ? `${Math.round((row.usd / data.ledger.totalUsd) * 100)}%` : "—"}</TD>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </Section>
                        <Section title="By provider and source">
                            <Table minWidth={360}>
                                <thead><tr><TH>Provider</TH><TH numeric>Calls</TH><TH numeric>Logged</TH><TH numeric>Billed</TH></tr></thead>
                                <tbody>
                                    {Object.entries(data.ledger.byProvider).sort((a, b) => b[1].usd - a[1].usd).map(([provider, total]) => (
                                        <tr key={provider}>
                                            <TD className="text-white">{PROVIDER_LABEL[provider] ?? provider}</TD>
                                            <TD numeric>{total.calls.toLocaleString()}</TD>
                                            <TD numeric>{usd(total.usd)}</TD>
                                            <TD numeric>{provider === "anthropic" ? usd(data.claude.billedUsd) : provider === "openai" ? usd(data.openai.billedUsd) : "—"}</TD>
                                        </tr>
                                    ))}
                                    {(["app", "prod", "local"] as const).map((source) => (
                                        <tr key={source}>
                                            <TD className="text-ink-400">{SERIES.find((item) => item.key === source)?.label}</TD>
                                            <TD numeric>{data.ledger.bySource[source].calls.toLocaleString()}</TD>
                                            <TD numeric>{usd(data.ledger.bySource[source].usd)}</TD>
                                            <TD numeric />
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                            <p className="mt-2 text-[11px] leading-4 text-ink-500">{data.openai.note}. {data.gemini.note}</p>
                        </Section>
                    </div>

                    <Section
                        title="Bot check: new comparisons per day"
                        description={`Each new comparison is a paid Claude write-up plus a VS image (~$0.15). New ones need a human Generate click and are capped at ${data.comparisons.dailyLimit}/day site-wide; a day at the cap, or apps-side comparison spend with few people comparing, is worth a look.`}
                    >
                        <div className="border border-line-300 bg-surface-900 p-4">
                            <div className="flex h-16 items-end gap-px">
                                {data.comparisons.perDay.map((day) => {
                                    const peak = Math.max(data.comparisons.dailyLimit, comparisonPeak?.count ?? 0);
                                    return <div key={day.day} title={`${day.day}: ${day.count}`} className={day.count >= data.comparisons.dailyLimit ? "bg-red-400" : "bg-primary-400"} style={{flex: 1, height: `${Math.max(day.count ? 4 : 1, (day.count / peak) * 100)}%`, opacity: day.count ? 1 : 0.25}} />;
                                })}
                            </div>
                            <p className="mt-2 text-xs text-ink-400">
                                Today {comparisonsToday} · busiest day {comparisonPeak?.count ? `${comparisonPeak.day} (${comparisonPeak.count})` : "none"} · {data.comparisons.perDay.reduce((total, day) => total + day.count, 0)} in range
                            </p>
                        </div>
                    </Section>

                    <Section
                        title="Features"
                        description="Every logged feature, most expensive first. Apps rows are edge-function names; web rows are the route or file that made the call."
                        action={<Segmented label="Source" value={filter} onChange={setFilter} options={[{value: "all", label: "All"}, {value: "app", label: "Apps"}, {value: "prod", label: "Web prod"}, {value: "local", label: "Local"}]} />}
                    >
                        <Table minWidth={860}>
                            <thead><tr><TH>Feature</TH><TH>Area</TH><TH>Source</TH><TH>Model</TH><TH numeric>Calls</TH><TH numeric>In / out tokens</TH><TH numeric>$/call</TH><TH numeric>Est. cost</TH><TH numeric>Last</TH></tr></thead>
                            <tbody>
                                {features.map((row) => (
                                    <tr key={`${row.source}|${row.provider}|${row.feature}`}>
                                        <TD className="font-mono text-[11px] text-white">{row.feature}</TD>
                                        <TD>{row.area}</TD>
                                        <TD><Badge tone={row.source === "local" ? "warn" : "neutral"}>{SOURCE_LABEL[row.source]}</Badge></TD>
                                        <TD className="text-ink-400">{PROVIDER_LABEL[row.provider] ?? row.provider} · {row.model}</TD>
                                        <TD numeric>{row.calls.toLocaleString()}</TD>
                                        <TD numeric>{tokens(row.inputTokens)} / {tokens(row.outputTokens)}</TD>
                                        <TD numeric>{usd(row.usd / Math.max(1, row.calls), 4)}</TD>
                                        <TD numeric className="font-bold text-white">{usd(row.usd)}</TD>
                                        <TD numeric className="text-ink-500">{ago(row.lastAt, now)}</TD>
                                    </tr>
                                ))}
                                {!features.length ? <tr><TD colSpan={9} className="text-ink-500">No calls logged for this source in range.</TD></tr> : null}
                            </tbody>
                        </Table>
                    </Section>

                    <Section title="Latest calls" description="The newest 60 logged calls. Turn on auto refresh to watch them arrive.">
                        <Table minWidth={760}>
                            <thead><tr><TH>When</TH><TH>Source</TH><TH>Feature</TH><TH>Model</TH><TH numeric>In / out</TH><TH numeric>Est.</TH></tr></thead>
                            <tbody>
                                {recent.map((row, i) => (
                                    <tr key={`${row.at}${i}`}>
                                        <TD className="whitespace-nowrap text-ink-400" title={row.at}>{ago(row.at, now)}</TD>
                                        <TD><Badge tone={row.source === "local" ? "warn" : "neutral"}>{SOURCE_LABEL[row.source]}</Badge></TD>
                                        <TD className="font-mono text-[11px] text-white">{row.feature}</TD>
                                        <TD className="text-ink-400">{row.model}</TD>
                                        <TD numeric>{tokens(row.inputTokens)} / {tokens(row.outputTokens)}</TD>
                                        <TD numeric>{usd(row.usd, 4)}</TD>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Section>

                    <Section title="Claude: billed against logged, per day">
                        <Table minWidth={560}>
                            <thead><tr><TH>Day (UTC)</TH><TH numeric>Billed</TH><TH numeric>of which Batch</TH><TH numeric>Logged</TH><TH numeric>Untracked</TH></tr></thead>
                            <tbody>
                                {[...data.claude.days].reverse().map((day) => (
                                    <tr key={day.day}>
                                        <TD className="text-white">{day.day}</TD>
                                        <TD numeric>{usd(day.billedUsd)}</TD>
                                        <TD numeric className="text-ink-400">{day.batchUsd ? usd(day.batchUsd) : "—"}</TD>
                                        <TD numeric>{usd(day.loggedUsd)}</TD>
                                        <TD numeric className={day.untrackedUsd && day.untrackedUsd > 10 ? "font-bold text-amber-200" : undefined}>{usd(day.untrackedUsd)}</TD>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Section>

                    <Alert tone="info" className="mt-8" title="How to read this">
                        Costs are list-price estimates, not invoices. {data.webLoggingSince ? `Web-server and local calls are logged since ${new Date(data.webLoggingSince).toLocaleString()}` : "Web-server and local calls are not logged yet (deploy pending, or none made)"}; before that the web&apos;s Claude spend shows as untracked.
                        {data.edgeCacheWritesLogged ? null : " The apps' Claude rows have no prompt-cache-write counts until AnimalDex migration 20261029161300 is applied, so their Claude estimate runs low."}
                        {" "}Every surface shares one Anthropic key, so the provider cannot split by surface: separate keys for prod, the apps and local work (in the Claude Console) would make the billed side split too.
                    </Alert>
                </>
            ) : null}
        </AdminPage>
    );
}
