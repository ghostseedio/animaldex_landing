"use client";

import React, {useContext, useId, useMemo, useState} from "react";
import {ArkGraphWordsContext} from "@/app/[locale]/(composited)/ark/ark-graph-context";
import ArkSpeciesIcon from "@/app/[locale]/(composited)/ark/ark-species-icon";
import {arkIconUrl} from "@/ark-scene/placeholder-icon";
import {ARK_GRAPH_ENGLISH, type ArkGraphWords} from "@/lib/ark-graph-words";
import {fillArkWords} from "@/lib/ark-words";
import {
    ARK_PERIODS,
    arkDayAt,
    arkGraphDate,
    arkGraphWhen,
    arkHistoryLines,
    arkLinePath,
    arkStatsChangeText,
    type ArkHistory,
    type ArkLine,
    type ArkPeriod,
    type ArkSeries,
    type ArkSeriesStats
} from "@/lib/ark-population-history";

export * from "@/lib/ark-population-history";
// Male and female in a species row (`ark-sex.tsx`): beside the lazy graphs, outside the page's first JavaScript.
export {default as ArkSex} from "@/app/[locale]/(composited)/ark/ark-sex";

/**
 * The population HUD's lines (owner, 2026-11-17: "a population line graph per species, just a line might do it and a
 * time period"): a sparkline in each species' row and, from it, a larger graph of that species with a period switch,
 * its count now, its change, peak and low, and what the record says happened in the period. Loaded with a dynamic
 * import once the HUD is open (the Ark page's first JavaScript is frozen, decision 371), so nothing here is in the
 * page's static bundle.
 *
 * Its words come from the page (`ark.graph`, in every Ark language) through `ArkGraphWordsContext`; English where there
 * is no provider. Dates and days are the viewer's own (`history.zone`).
 */
/** The words in force: the page's, else English. */
function useGraphWords(): ArkGraphWords {
    return useContext(ArkGraphWordsContext) ?? ARK_GRAPH_ENGLISH;
}

const UP = "#86e08f";
const DOWN = "#ff8a7a";
const LIME = "#c8fa63";
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#c8fa63]";

/** The line's colour: green up, red down, the panel's white when the same. */
function tone(stats: Pick<ArkSeriesStats, "delta">): string {
    return stats.delta > 0 ? UP : stats.delta < 0 ? DOWN : "rgba(255,252,244,0.55)";
}

/** A row's line: the period's counts as a step line, coloured by the change. Decorative: the row says the numbers. */
export function ArkSparkline({series, stats, width = 44, height = 16}: {series: ArkSeries; stats: ArkSeriesStats; width?: number; height?: number}) {
    const line = useMemo(() => arkLinePath(series.counts, width, height), [series, width, height]);
    return (
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" focusable="false" className="block shrink-0 overflow-visible">
            <path d={line.d} fill="none" stroke={tone(stats)} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

/** The period switch: 24 h · 7 d · 30 d · All. */
export function ArkPeriodSwitch({period, onPeriod}: {period: ArkPeriod; onPeriod: (period: ArkPeriod) => void}) {
    const words = useGraphWords();
    return (
        <div role="group" aria-label={words.periodLabel} className="flex rounded-full bg-white/[0.07] p-0.5">
            {ARK_PERIODS.map((id) => (
                <button
                    key={id}
                    type="button"
                    aria-pressed={period === id}
                    aria-label={words.periods[id]}
                    onClick={() => onPeriod(id)}
                    className={`min-h-8 rounded-full px-2.5 text-[11.5px] font-bold tabular-nums transition-colors md:min-h-7 ${FOCUS} ${period === id ? "bg-white/[0.16] text-white" : "text-white/60 hover:text-white"}`}
                >
                    {words.periodsShort[id]}
                </button>
            ))}
        </div>
    );
}

export type ArkSortMode = "biggest" | "thriving" | "declining";

/** Biggest · Thriving · Declining. */
export function ArkSortSwitch({mode, onMode}: {mode: ArkSortMode; onMode: (mode: ArkSortMode) => void}) {
    const words = useGraphWords();
    const modes: ArkSortMode[] = ["biggest", "thriving", "declining"];
    return (
        <div role="group" aria-label={words.sortLabel} className="flex rounded-full bg-white/[0.07] p-0.5">
            {modes.map((id) => (
                <button
                    key={id}
                    type="button"
                    aria-pressed={mode === id}
                    onClick={() => onMode(id)}
                    className={`min-h-8 rounded-full px-2.5 text-[11.5px] font-bold transition-colors md:min-h-7 ${FOCUS} ${mode === id ? "bg-white/[0.16] text-white" : "text-white/60 hover:text-white"}`}
                >
                    {id === "thriving" ? <span aria-hidden="true" className="mr-1 text-[8px]" style={{color: UP}}>▲</span> : id === "declining" ? <span aria-hidden="true" className="mr-1 text-[8px]" style={{color: DOWN}}>▼</span> : null}
                    {words[id]}
                </button>
            ))}
        </div>
    );
}

/** "+12 · +25%" in the line's colour; "0" grey. */
export function ArkPeriodChange({stats, locale, className = ""}: {stats: ArkSeriesStats; locale: string; className?: string}) {
    const said = arkStatsChangeText(stats, locale);
    return (
        <span className={`shrink-0 whitespace-nowrap text-[11px] font-bold tabular-nums leading-none ${className}`} style={{color: tone(stats)}}>
            {said.up === null ? null : <span aria-hidden="true" className="text-[8px]">{said.up ? "▲" : "▼"} </span>}
            {said.percent && said.up !== null ? said.percent : said.count}
        </span>
    );
}

type GraphProps = {
    name: string;
    icon: React.ReactNode;
    history: ArkHistory;
    series: ArkSeries;
    stats: ArkSeriesStats;
    period: ArkPeriod;
    onPeriod: (period: ArkPeriod) => void;
    onBack: () => void;
    /** Fly to one of its animals; absent: none aboard. */
    onFly?: (() => void) | null;
    locale: string;
};

const W = 300;
const H = 132;
const LEFT = 30;
const BOTTOM = 18;

/** One species' graph: the line over the period, its axis, and the period's numbers. */
export function ArkPopulationGraph({name, icon, history, series, stats, period, onPeriod, onBack, onFly = null, locale}: GraphProps) {
    const words = useGraphWords();
    const titleId = useId();
    const [hover, setHover] = useState<number | null>(null);
    const plotW = W - LEFT - 4;
    const plotH = H - BOTTOM - 6;
    const line = useMemo(() => arkLinePath(series.counts, plotW, plotH, {pad: 2, fromZero: true, max: stats.peak}), [series, stats.peak, plotW, plotH]);
    const number = (value: number) => value.toLocaleString(locale);
    const start = series.times[0] ?? history.asOf;
    const end = series.times[series.times.length - 1] ?? history.asOf;
    const said = arkStatsChangeText(stats, locale);
    const dayFrom = arkDayAt(start, history.startedAt);
    const dayTo = arkDayAt(end, history.startedAt);
    const fromRecord = start <= history.firstAt + history.bucketMs;
    const happened = ([["arrived", stats.arrived], ["born", stats.born], ["revived", stats.revived], ["died", stats.died], ["eaten", stats.eaten]] as const).filter(([, n]) => n > 0);
    const hoverIndex = hover === null ? null : Math.max(0, Math.min(series.counts.length - 1, hover));
    const hoverPoint = hoverIndex === null ? null : line.points[Math.min(hoverIndex, line.points.length - 1)];
    const label = fillArkWords(words.graphLabel, {animal: name, period: words.periods[period], start: number(stats.start), now: number(stats.now)});
    // Count ticks: 0, the top, and the middle when it is a whole number apart.
    const top = line.max;
    const ticks = top < 1 ? [0] : top > 1 && top % 2 === 0 ? [0, top / 2, top] : [0, top];
    const yOf = (v: number) => 6 + 2 + (plotH - 4) - (v / Math.max(top, 1)) * (plotH - 4);
    const color = tone(stats);
    const gradientId = `${titleId}-fill`;

    const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - box.left) / Math.max(box.width, 1)) * W - LEFT;
        const n = series.counts.length;
        setHover(n <= 1 ? 0 : Math.round((x / plotW) * (n - 1)));
    };

    return (
        <section aria-labelledby={titleId} className="flex min-h-0 flex-col">
            <div className="flex items-center gap-2 px-2 pb-1.5 pt-0.5">
                <button type="button" onClick={onBack} className={`flex min-h-11 items-center gap-1 rounded-full px-1.5 text-[12px] font-semibold text-white/70 hover:text-white md:min-h-8 ${FOCUS}`}>
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.5 5l-5 5 5 5" /></svg>
                    {words.back}
                </button>
            </div>
            <div className="flex items-center gap-2.5 px-3.5">
                {icon}
                <h3 id={titleId} className="min-w-0 flex-1 truncate font-sans text-[14px] font-bold normal-case leading-tight tracking-normal">{name}</h3>
                <span className="text-[15px] font-bold tabular-nums">{number(stats.now)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 pb-1 pt-2">
                <ArkPeriodSwitch period={period} onPeriod={onPeriod} />
                <span className="text-[12px] font-bold tabular-nums" style={{color}}>
                    {said.up === null ? null : <span aria-hidden="true" className="text-[9px]">{said.up ? "▲" : "▼"} </span>}
                    {said.count}
                    {said.percent && said.up !== null ? ` · ${said.percent}` : null}
                </span>
            </div>
            <div className="relative px-2">
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="block h-auto w-full touch-none select-none"
                    role="img"
                    aria-label={label}
                    onPointerMove={onMove}
                    onPointerDown={onMove}
                    onPointerLeave={() => setHover(null)}
                >
                    <defs>
                        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    {ticks.map((tick) => (
                        <g key={tick}>
                            <line x1={LEFT} x2={W - 4} y1={yOf(tick)} y2={yOf(tick)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                            <text x={LEFT - 5} y={yOf(tick) + 3.5} textAnchor="end" fontSize={10} fill="rgba(255,252,244,0.5)" className="tabular-nums">{number(tick)}</text>
                        </g>
                    ))}
                    <g transform={`translate(${LEFT} 6)`}>
                        <path d={line.area} fill={`url(#${gradientId})`} />
                        <path d={line.d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                        {hoverPoint ? (
                            <g>
                                <line x1={hoverPoint[0]} x2={hoverPoint[0]} y1={0} y2={plotH} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                                <circle cx={hoverPoint[0]} cy={hoverPoint[1]} r={3.5} fill={LIME} />
                            </g>
                        ) : (
                            <circle cx={line.points[line.points.length - 1][0]} cy={line.points[line.points.length - 1][1]} r={3} fill={color} />
                        )}
                    </g>
                    <text x={LEFT} y={H - 4} fontSize={10} fill="rgba(255,252,244,0.5)">{arkGraphWhen(Math.max(start, history.firstAt), locale, history)}</text>
                    <text x={W - 4} y={H - 4} fontSize={10} textAnchor="end" fill="rgba(255,252,244,0.5)">{words.now}</text>
                </svg>
                {hoverIndex !== null ? (
                    <p aria-live="polite" className="pointer-events-none absolute right-3 top-0 rounded-md bg-black/50 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                        {fillArkWords(words.pointAt, {count: number(series.counts[hoverIndex]), time: arkGraphWhen(series.times[hoverIndex], locale, history)})}
                    </p>
                ) : null}
            </div>
            <p className="px-3.5 text-[10.5px] text-white/45">
                {[
                    dayFrom !== null && dayTo !== null ? fillArkWords(words.arkDays, {from: number(Math.max(0, dayFrom)), to: number(dayTo)}) : null,
                    fromRecord ? fillArkWords(words.recordStarts, {date: arkGraphDate(history.firstAt, locale, history)}) : null
                ].filter(Boolean).join(" · ")}
            </p>
            <dl className="grid grid-cols-4 gap-1 px-3.5 pb-1 pt-2.5 text-center">
                {([["now", words.now, stats.now], ["change", words.change, said.count], ["peak", words.peak, stats.peak], ["low", words.low, stats.low]] as const).map(([id, term, value]) => (
                    <div key={id} className="rounded-lg bg-white/[0.05] px-1 py-1.5">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-white/45">{term}</dt>
                        <dd className="text-[13px] font-bold tabular-nums" style={id === "change" ? {color} : undefined}>{typeof value === "number" ? number(value) : value}</dd>
                    </div>
                ))}
            </dl>
            <p className="px-3.5 pb-2 pt-1.5 text-[11.5px] leading-snug text-white/65">
                {happened.length ? happened.map(([kind, n]) => fillArkWords(words[kind], {count: number(n)})).join(" · ") : words.nothing}
                {stats.goneNow ? <span className="block pt-0.5 font-semibold" style={{color: DOWN}}>{words.goneNow}</span> : null}
            </p>
            {onFly ? (
                <div className="px-3.5 pb-3">
                    <button type="button" onClick={onFly} className={`min-h-11 w-full rounded-full bg-white/[0.1] text-[12.5px] font-bold text-white hover:bg-white/[0.16] md:min-h-9 ${FOCUS}`}>
                        {words.flyTo}
                    </button>
                </div>
            ) : null}
        </section>
    );
}

// MARK: The HUD's pieces (here, not in the HUD, to keep the page's first JavaScript inside its budget)

export type ArkHudLine = ArkLine;
export const arkHudLines = arkHistoryLines;

function Icon({slug, size}: {slug: string; size: number}) {
    return (
        <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7]" style={{width: size, height: size}}>
            <ArkSpeciesIcon src={arkIconUrl(slug)} size={size} className="h-[84%] w-[84%] object-contain" />
        </span>
    );
}

/** The sparkline as a button at a row's end: opens that species' graph. */
export function ArkRowSpark({name, line, onOpen}: {name: string; line: ArkHudLine; onOpen: () => void}) {
    const label = fillArkWords(useGraphWords().openGraph, {animal: name});
    return (
        <button type="button" onClick={onOpen} aria-label={label} title={label} className={`flex min-h-11 shrink-0 items-center pl-1 pr-3 transition-colors hover:bg-white/[0.06] md:min-h-[2.375rem] ${FOCUS}`}>
            <ArkSparkline series={line.series} stats={line.stats} />
        </button>
    );
}

/** Declining: a kind that died out in the period (none aboard to fly to; its graph only). */
export function ArkGoneRow({name, slug, line, locale, onOpen, setsize, posinset}: {name: string; slug: string | null; line: ArkHudLine | null; locale: string; onOpen: () => void; setsize: number; posinset: number}) {
    const words = useGraphWords();
    return (
        <li aria-setsize={setsize} aria-posinset={posinset} className="flex items-stretch">
            <button type="button" onClick={onOpen} aria-label={`${name}: 0, ${words.goneNow}`} className={`relative flex min-h-11 min-w-0 flex-1 items-center gap-2.5 py-1 pl-3.5 pr-1 text-left transition-colors duration-200 hover:bg-white/[0.06] md:min-h-[2.375rem] ${FOCUS}`}>
                <span className="opacity-60"><Icon slug={slug ?? ""} size={24} /></span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight text-white/70">{name}</span>
                {line ? <ArkPeriodChange stats={line.stats} locale={locale} /> : null}
                <span className="min-w-[2rem] text-right text-[13px] font-bold tabular-nums text-white/60">0</span>
            </button>
            {line ? <ArkRowSpark name={name} line={line} onOpen={onOpen} /> : null}
        </li>
    );
}

/**
 * The panel's graph view of one species, in place of the list. `rows` are the species aboard (a name and an icon);
 * a kind that died out is named by the answer's `gone`. Nothing when the kind is in neither, or has no line.
 */
export function ArkHudGraphPane<Row extends {name: string; slug: string}>({history, graphKey, rows, line, period, onPeriod, onBack, onFly, locale}: {history: ArkHistory; graphKey: string; rows: ReadonlyMap<string, Row>; line: ArkHudLine | undefined; period: ArkPeriod; onPeriod: (period: ArkPeriod) => void; onBack: () => void; onFly: (row: Row) => void; locale: string}) {
    const row = rows.get(graphKey);
    const gone = history.gone.get(graphKey);
    if (!line || !(row || gone)) return null;
    const slug = row?.slug ?? gone?.slug ?? "";
    return (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-white/[0.08] pt-1 [scrollbar-width:thin]">
            <ArkPopulationGraph name={row?.name ?? gone?.name ?? ""} icon={<Icon slug={slug} size={28} />} history={history} series={line.series} stats={line.stats} period={period} onPeriod={onPeriod} onBack={onBack} onFly={row ? () => onFly(row) : null} locale={locale} />
        </div>
    );
}

/** "Thriving · +25%, 7 days" for a row's screen-reader label in those orders. */
export function arkPeriodLabel(stats: ArkSeriesStats, period: ArkPeriod, locale: string, words: ArkGraphWords = ARK_GRAPH_ENGLISH): string {
    const said = arkStatsChangeText(stats, locale);
    return `${said.percent ?? said.count}, ${words.periods[period]}`;
}

/** The order and the period over the list; the message when nothing changed in the period. */
export function ArkHudControls({mode, onMode, period, onPeriod}: {mode: ArkSortMode; onMode: (mode: ArkSortMode) => void; period: ArkPeriod; onPeriod: (period: ArkPeriod) => void}) {
    return (
        <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-2.5">
            <ArkSortSwitch mode={mode} onMode={onMode} />
            <ArkPeriodSwitch period={period} onPeriod={onPeriod} />
        </div>
    );
}

export function ArkHudNone({mode}: {mode: ArkSortMode}) {
    const words = useGraphWords();
    return <li className="px-3.5 py-3 text-[12px] text-white/55">{mode === "thriving" ? words.noneThriving : words.noneDeclining}</li>;
}
