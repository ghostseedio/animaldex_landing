"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {useArkLanding} from "@/app/[locale]/(composited)/(home)/_components/home-live-numbers";
import type {ArkPopulationSeries} from "@/lib/ark-population-series";

/**
 * "Populations over time" (landing lane S2): everyone aboard since the voyage began, and the six biggest species,
 * counted back from the Ark's event log (`arkPopulationSeries`, `/api/ark/landing`). One series per chart, one
 * hue, one axis: the total as a line over its wash with a crosshair readout, the species as small multiples on the
 * same time axis. A table carries every value for screen readers.
 */

export type HomeArkPopulationsWords = {
    total: string;
    backfill: string;
    /** "{change} in 24 h". */
    day24: string;
    same: string;
    unavailable: string;
    axisStart: string;
    axisNow: string;
    legend: string;
};

const HEIGHT = 260;
const PAD = {top: 16, right: 12, bottom: 28, left: 48};

function niceMax(value: number): number {
    if (value <= 4) return 4;
    const power = 10 ** Math.floor(Math.log10(value));
    for (const step of [1, 2, 2.5, 5, 10]) if (step * power >= value) return step * power;
    return 10 * power;
}

function useWidth(): [React.RefObject<HTMLDivElement>, number] {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return [ref, width];
}

/** The count 24 hours before the last moment (the nearest moment at or before it). */
function dayChange(times: number[], values: number[]): number {
    const last = times[times.length - 1];
    let i = times.length - 1;
    while (i > 0 && times[i] > last - 86_400_000) i--;
    return values[values.length - 1] - values[i];
}

function TotalChart({series, words, locale}: {series: ArkPopulationSeries; words: HomeArkPopulationsWords; locale: string}) {
    const [ref, width] = useWidth();
    const [hover, setHover] = useState<number | null>(null);
    const times = useMemo(() => series.times.map((time) => Date.parse(time)), [series.times]);
    const max = niceMax(Math.max(...series.total, 1));
    const plotW = Math.max(width - PAD.left - PAD.right, 10);
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (plotW * (times[i] - times[0])) / Math.max(times[times.length - 1] - times[0], 1);
    const y = (value: number) => PAD.top + plotH - (plotH * value) / max;
    const line = series.total.map((value, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(value).toFixed(1)}`).join("");
    const area = `${line}L${x(series.total.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
    const ticks = [0, max / 2, max];
    // The step where most came aboard at once: the captures from before launch.
    const arrivals = series.happenings.arrivals;
    const burst = arrivals.reduce((best, value, i) => (value > arrivals[best] ? i : best), 0);
    const showBurst = arrivals[burst] > series.total[series.total.length - 1] * 0.25;
    const date = (i: number) => new Intl.DateTimeFormat(locale, {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC"}).format(new Date(times[i])) + " UTC";
    const onMove = (event: React.PointerEvent<SVGRectElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        const at = times[0] + ((event.clientX - box.left) / Math.max(box.width, 1)) * (times[times.length - 1] - times[0]);
        let nearest = 0;
        for (let i = 1; i < times.length; i++) if (Math.abs(times[i] - at) < Math.abs(times[nearest] - at)) nearest = i;
        setHover(nearest);
    };
    const last = series.total.length - 1;

    return (
        <div ref={ref} className="relative w-full">
            {width > 0 ? (
                <svg width={width} height={HEIGHT} role="img" aria-label={`${words.total}: ${series.total[last].toLocaleString(locale)}`} className="block overflow-visible">
                    {ticks.map((tick) => (
                        <g key={tick}>
                            <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-line-200" strokeWidth={1} />
                            <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-ink-300 text-[11px] [font-variant-numeric:tabular-nums]">
                                {tick.toLocaleString(locale)}
                            </text>
                        </g>
                    ))}
                    <path d={area} className="fill-primary-400/10" />
                    <path d={line} fill="none" className="stroke-primary-400" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    <circle cx={x(last)} cy={y(series.total[last])} r={4.5} className="fill-primary-400 stroke-canvas-950" strokeWidth={2} />
                    <text x={x(last) - 8} y={y(series.total[last]) - 12} textAnchor="end" className="fill-white text-[13px] font-bold [font-variant-numeric:tabular-nums]">
                        {series.total[last].toLocaleString(locale)}
                    </text>
                    {showBurst ? (
                        <g>
                            <line x1={x(burst)} x2={x(burst)} y1={y(series.total[burst]) + 6} y2={y(max * 0.42)} className="stroke-ink-400" strokeWidth={1} />
                            <text x={x(burst) - 6} y={y(max * 0.42) + 14} textAnchor="end" className="fill-ink-300 text-[12px]">
                                {words.backfill}
                            </text>
                        </g>
                    ) : null}
                    <text x={PAD.left} y={HEIGHT - 6} className="fill-ink-300 text-[11px]">{words.axisStart}</text>
                    <text x={width - PAD.right} y={HEIGHT - 6} textAnchor="end" className="fill-ink-300 text-[11px]">{words.axisNow}</text>
                    {hover !== null ? (
                        <g pointerEvents="none">
                            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} className="stroke-ink-300" strokeWidth={1} />
                            <circle cx={x(hover)} cy={y(series.total[hover])} r={4} className="fill-primary-400 stroke-canvas-950" strokeWidth={2} />
                        </g>
                    ) : null}
                    <rect
                        x={PAD.left}
                        y={PAD.top}
                        width={plotW}
                        height={plotH}
                        fill="transparent"
                        onPointerMove={onMove}
                        onPointerDown={onMove}
                        onPointerLeave={() => setHover(null)}
                    />
                </svg>
            ) : (
                <div style={{height: HEIGHT}} />
            )}
            {hover !== null && width > 0 ? (
                <div
                    className="pointer-events-none absolute top-2 z-10 min-w-[10rem] rounded-sm border border-line-200 bg-canvas-950/95 px-3 py-2 text-xs shadow-lg"
                    style={{left: Math.min(Math.max(x(hover) - 80, 0), Math.max(width - 170, 0))}}
                >
                    <p className="text-ink-300">{date(hover)}</p>
                    <p className="mt-1 font-bold text-white [font-variant-numeric:tabular-nums]">
                        {words.total}: {series.total[hover].toLocaleString(locale)}
                    </p>
                </div>
            ) : null}
        </div>
    );
}

function Spark({times, values}: {times: number[]; values: number[]}) {
    const [ref, width] = useWidth();
    const h = 44;
    const max = Math.max(...values, 1);
    const min = Math.min(...values);
    const span = Math.max(max - min, 1);
    const x = (i: number) => 2 + ((width - 8) * (times[i] - times[0])) / Math.max(times[times.length - 1] - times[0], 1);
    const y = (value: number) => 4 + (h - 8) * (1 - (value - min) / span);
    const d = values.map((value, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(value).toFixed(1)}`).join("");
    return (
        <div ref={ref} className="w-full" aria-hidden="true">
            {width > 0 ? (
                <svg width={width} height={h} className="block overflow-visible">
                    <path d={d} fill="none" className="stroke-primary-400" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={4} className="fill-primary-400 stroke-canvas-950" strokeWidth={2} />
                </svg>
            ) : (
                <div style={{height: h}} />
            )}
        </div>
    );
}

export default function HomeArkPopulations({words, locale}: {words: HomeArkPopulationsWords; locale: string}) {
    const summary = useArkLanding();
    const series = summary?.series && summary.series.complete && summary.series.times.length > 1 ? summary.series : null;
    if (summary === undefined) return <div style={{height: HEIGHT + 180}} aria-hidden="true" />;
    if (!series) return <p className="text-sm text-ink-300">{words.unavailable}</p>;
    const times = series.times.map((time) => Date.parse(time));
    const changeText = (change: number) =>
        change === 0 ? words.same : words.day24.replace("{change}", `${change > 0 ? "+" : "−"}${Math.abs(change).toLocaleString(locale)}`);

    return (
        <div className="flex flex-col gap-10">
            <figure className="flex flex-col gap-3">
                <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-300">{words.total}</span>
                    <span className="text-sm text-ink-300">{changeText(dayChange(times, series.total))}</span>
                </figcaption>
                <TotalChart series={series} words={words} locale={locale} />
            </figure>
            <div className="flex flex-col gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-300">{words.legend}</p>
                <ul className="grid grid-cols-2 gap-px border-y border-line-200 bg-line-200 sm:grid-cols-3 lg:grid-cols-6">
                    {series.species.map((row, i) => (
                        <li key={row.key} className="flex flex-col gap-2 bg-canvas-950 px-3 py-4">
                            <p className="truncate text-sm font-semibold text-white" title={row.name}>{row.name}</p>
                            <p className="font-display text-3xl font-bold leading-none text-white [font-variant-numeric:tabular-nums]">{row.count.toLocaleString(locale)}</p>
                            <Spark times={times} values={series.counts[i]} />
                            <p className="text-xs text-ink-300">{changeText(dayChange(times, series.counts[i]))}</p>
                        </li>
                    ))}
                </ul>
            </div>
            <table className="sr-only">
                <caption>{words.total}</caption>
                <thead>
                    <tr>
                        <th scope="col">UTC</th>
                        <th scope="col">{words.total}</th>
                        {series.species.map((row) => <th key={row.key} scope="col">{row.name}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {series.times.map((time, i) => (
                        <tr key={time}>
                            <th scope="row">{time.slice(0, 16).replace("T", " ")}</th>
                            <td>{series.total[i]}</td>
                            {series.counts.map((values, j) => <td key={series.species[j].key}>{values[i]}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
