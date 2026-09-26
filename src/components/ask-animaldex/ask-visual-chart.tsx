"use client";

/**
 * The chart medium: a relationship between two quantities across a range.
 *
 * Deliberately axis-label-only, with no numeric ticks. The model is told to use
 * conceptual values and never to invent measured numbers, so printing those
 * numbers on an axis would dress a shape up as a measurement. The shape is the
 * claim; the hover layer and the table view name each point qualitatively
 * instead.
 *
 * Marks follow the house data-viz rules: one y axis for every series, 2px
 * strokes, markers only where they carry information, a recessive grid, 4px
 * rounded bar ends anchored to the baseline with a 2px surface gap, a legend
 * whenever there are two or more series plus direct labels, and text in ink
 * tokens rather than the series colour. Series hues are assigned in fixed order
 * from the validated dark palette and are never cycled.
 */

import {useMemo, useState} from "react";
import type {AskChartSpec} from "@/lib/ask-animaldex/visuals";

const WIDTH = 320;
const HEIGHT = 168;
const PAD = {top: 14, right: 14, bottom: 30, left: 34};

const PLOT_WIDTH = WIDTH - PAD.left - PAD.right;
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;

/** Fixed categorical order. A fourth series is not a generated hue — the decoder caps at three. */
const SERIES_VARS = ["var(--ask-series-1)", "var(--ask-series-2)", "var(--ask-series-3)"] as const;

const BANDS = ["lowest", "low", "middling", "high", "highest"] as const;

function qualitativeBand(value: number, min: number, max: number): string {
    if (max <= min) return "flat";
    const position = (value - min) / (max - min);
    const index = Math.min(BANDS.length - 1, Math.floor(position * BANDS.length));
    return BANDS[index];
}

type Scaled = {
    points: Array<{x: number; y: number; rawX: number; rawY: number}>;
    label: string | null;
    color: string;
};

export default function AskVisualChart({spec, summary}: {spec: AskChartSpec; summary: string}) {
    const [hover, setHover] = useState<{index: number; x: number; y: number} | null>(null);

    const model = useMemo(() => {
        const allX = spec.series.flatMap((series) => series.points.map((point) => point.x));
        const allY = spec.series.flatMap((series) => series.points.map((point) => point.y));
        const minX = Math.min(...allX);
        const maxX = Math.max(...allX);
        const rawMinY = Math.min(...allY);
        const rawMaxY = Math.max(...allY);
        // Bars read from zero; lines get a little air so a flat series is not
        // pinned to the frame.
        const padY = (rawMaxY - rawMinY) * 0.08 || 1;
        const minY = spec.type === "bar" ? Math.min(0, rawMinY) : rawMinY - padY;
        const maxY = rawMaxY + (spec.type === "bar" ? padY : padY);

        const scaleX = (value: number) => maxX === minX
            ? PAD.left + PLOT_WIDTH / 2
            : PAD.left + ((value - minX) / (maxX - minX)) * PLOT_WIDTH;
        const scaleY = (value: number) => maxY === minY
            ? PAD.top + PLOT_HEIGHT / 2
            : PAD.top + PLOT_HEIGHT - ((value - minY) / (maxY - minY)) * PLOT_HEIGHT;

        const scaled: Scaled[] = spec.series.map((series, index) => ({
            label: series.label,
            color: SERIES_VARS[index] ?? SERIES_VARS[SERIES_VARS.length - 1],
            points: series.points.map((point) => ({
                x: scaleX(point.x),
                y: scaleY(point.y),
                rawX: point.x,
                rawY: point.y
            }))
        }));

        // A threshold chart marks where the series actually turns over, which is
        // read off the data rather than chosen: the largest step between
        // consecutive points is the switch the answer is about.
        let thresholdY: number | null = null;
        if (spec.type === "threshold") {
            const primary = spec.series[0]?.points ?? [];
            let widest = 0;
            for (let index = 1; index < primary.length; index += 1) {
                const jump = Math.abs(primary[index].y - primary[index - 1].y);
                if (jump > widest) {
                    widest = jump;
                    thresholdY = scaleY((primary[index].y + primary[index - 1].y) / 2);
                }
            }
        }

        return {scaled, rawMinY, rawMaxY, thresholdY, columns: Math.max(...spec.series.map((s) => s.points.length))};
    }, [spec]);

    const multiSeries = model.scaled.length > 1;
    const hovered = hover === null ? null : model.scaled.map((series) => series.points[hover.index]).filter(Boolean);

    return (
        <figure className="ask-chart rounded-2xl border border-white/10 bg-white/[0.035] p-4" aria-label={summary}>
            {spec.title ? (
                <figcaption className="mb-1 text-[13px] font-semibold leading-5 text-white">{spec.title}</figcaption>
            ) : null}
            {spec.yAxisLabel ? (
                <p className="text-[11px] uppercase tracking-[0.14em] text-ink-400">{spec.yAxisLabel}</p>
            ) : null}

            {multiSeries ? (
                <ul className="mb-2 mt-2 flex flex-wrap gap-x-3.5 gap-y-1">
                    {model.scaled.map((series, index) => (
                        <li key={index} className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-200">
                            <span
                                aria-hidden="true"
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{background: series.color}}
                            />
                            {series.label ?? `Series ${index + 1}`}
                        </li>
                    ))}
                </ul>
            ) : null}

            <div className="relative mt-1.5">
                <svg
                    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    className="h-auto w-full touch-none"
                    role="img"
                    aria-label={summary}
                    onPointerLeave={() => setHover(null)}
                    onPointerMove={(event) => {
                        const bounds = event.currentTarget.getBoundingClientRect();
                        const ratio = (event.clientX - bounds.left) / bounds.width;
                        const svgX = ratio * WIDTH;
                        const primary = model.scaled[0]?.points ?? [];
                        if (primary.length === 0) return;
                        let nearest = 0;
                        for (let index = 1; index < primary.length; index += 1) {
                            if (Math.abs(primary[index].x - svgX) < Math.abs(primary[nearest].x - svgX)) {
                                nearest = index;
                            }
                        }
                        setHover({
                            index: nearest,
                            x: (primary[nearest].x / WIDTH) * 100,
                            y: (primary[nearest].y / HEIGHT) * 100
                        });
                    }}
                >
                    {/* Recessive grid: three rules, no numbers. */}
                    {[0, 0.5, 1].map((fraction) => (
                        <line
                            key={fraction}
                            x1={PAD.left}
                            x2={WIDTH - PAD.right}
                            y1={PAD.top + PLOT_HEIGHT * fraction}
                            y2={PAD.top + PLOT_HEIGHT * fraction}
                            stroke="var(--ask-chart-grid)"
                            strokeWidth={1}
                        />
                    ))}
                    <line
                        x1={PAD.left}
                        x2={PAD.left}
                        y1={PAD.top}
                        y2={PAD.top + PLOT_HEIGHT}
                        stroke="var(--ask-chart-axis)"
                        strokeWidth={1}
                    />
                    <line
                        x1={PAD.left}
                        x2={WIDTH - PAD.right}
                        y1={PAD.top + PLOT_HEIGHT}
                        y2={PAD.top + PLOT_HEIGHT}
                        stroke="var(--ask-chart-axis)"
                        strokeWidth={1}
                    />

                    {model.thresholdY !== null ? (
                        <g>
                            <line
                                x1={PAD.left}
                                x2={WIDTH - PAD.right}
                                y1={model.thresholdY}
                                y2={model.thresholdY}
                                stroke="var(--ask-chart-threshold)"
                                strokeWidth={1.5}
                                strokeDasharray="4 3"
                            />
                            <text
                                x={WIDTH - PAD.right}
                                y={model.thresholdY - 4}
                                textAnchor="end"
                                className="fill-[var(--ask-chart-ink-muted)] text-[8px] font-semibold uppercase tracking-[0.1em]"
                            >
                                {spec.annotations[0] ?? "switch"}
                            </text>
                        </g>
                    ) : null}

                    {spec.type === "bar"
                        ? model.scaled.map((series, seriesIndex) => {
                            const groupWidth = PLOT_WIDTH / Math.max(model.columns, 1);
                            // 2px of surface between adjacent bars, and between
                            // the grouped bars of one column.
                            const barWidth = Math.max(
                                3,
                                (groupWidth - 6) / model.scaled.length - 2
                            );
                            const baseline = PAD.top + PLOT_HEIGHT;
                            return (
                                <g key={seriesIndex}>
                                    {series.points.map((point, pointIndex) => {
                                        const left = PAD.left
                                            + pointIndex * groupWidth
                                            + 3
                                            + seriesIndex * (barWidth + 2);
                                        const height = Math.max(2, baseline - point.y);
                                        return (
                                            <rect
                                                key={pointIndex}
                                                x={left}
                                                y={baseline - height}
                                                width={barWidth}
                                                height={height}
                                                rx={4}
                                                fill={series.color}
                                                opacity={hover && hover.index !== pointIndex ? 0.55 : 1}
                                            />
                                        );
                                    })}
                                </g>
                            );
                        })
                        : model.scaled.map((series, seriesIndex) => {
                            const path = series.points
                                .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
                                .join(" ");
                            const last = series.points[series.points.length - 1];
                            return (
                                <g key={seriesIndex}>
                                    {spec.type === "area" ? (
                                        <path
                                            d={`${path} L${last.x.toFixed(1)},${PAD.top + PLOT_HEIGHT} L${series.points[0].x.toFixed(1)},${PAD.top + PLOT_HEIGHT} Z`}
                                            fill={series.color}
                                            opacity={0.16}
                                        />
                                    ) : null}
                                    <path
                                        d={path}
                                        fill="none"
                                        stroke={series.color}
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    {/* A marker only where it says something: the end of the run. */}
                                    <circle
                                        cx={last.x}
                                        cy={last.y}
                                        r={4}
                                        fill={series.color}
                                        stroke="var(--ask-chart-surface)"
                                        strokeWidth={2}
                                    />
                                </g>
                            );
                        })}

                    {hover && spec.type !== "bar" ? (
                        <g>
                            <line
                                x1={model.scaled[0].points[hover.index].x}
                                x2={model.scaled[0].points[hover.index].x}
                                y1={PAD.top}
                                y2={PAD.top + PLOT_HEIGHT}
                                stroke="var(--ask-chart-axis)"
                                strokeWidth={1}
                            />
                            {model.scaled.map((series, index) => {
                                const point = series.points[hover.index];
                                if (!point) return null;
                                return (
                                    <circle
                                        key={index}
                                        cx={point.x}
                                        cy={point.y}
                                        r={4.5}
                                        fill={series.color}
                                        stroke="var(--ask-chart-surface)"
                                        strokeWidth={2}
                                    />
                                );
                            })}
                        </g>
                    ) : null}

                    {spec.xAxisLabel ? (
                        <text
                            x={PAD.left + PLOT_WIDTH / 2}
                            y={HEIGHT - 8}
                            textAnchor="middle"
                            className="fill-[var(--ask-chart-ink-muted)] text-[9px] uppercase tracking-[0.14em]"
                        >
                            {spec.xAxisLabel}
                        </text>
                    ) : null}
                </svg>

                {hover && hovered ? (
                    <div
                        className="pointer-events-none absolute z-10 min-w-[7rem] -translate-x-1/2 -translate-y-full rounded-lg border border-white/15 bg-canvas-950/95 px-2.5 py-1.5 text-[11px] leading-4 shadow-lg"
                        style={{left: `${hover.x}%`, top: `${Math.max(hover.y, 14)}%`}}
                    >
                        {model.scaled.map((series, index) => {
                            const point = series.points[hover.index];
                            if (!point) return null;
                            return (
                                <p key={index} className="flex items-center gap-1.5 text-ink-100">
                                    <span
                                        aria-hidden="true"
                                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                                        style={{background: series.color}}
                                    />
                                    <span className="font-semibold">{series.label ?? spec.yAxisLabel ?? "Value"}</span>
                                    <span className="text-ink-300">
                                        {qualitativeBand(point.rawY, model.rawMinY, model.rawMaxY)}
                                    </span>
                                </p>
                            );
                        })}
                    </div>
                ) : null}
            </div>

            {spec.annotations.length > 0 ? (
                <ul className="mt-2.5 flex flex-col gap-1">
                    {spec.annotations.map((annotation) => (
                        <li key={annotation} className="flex gap-1.5 text-[11px] leading-5 text-ink-300">
                            <span aria-hidden="true" className="text-primary-300">·</span>
                            {annotation}
                        </li>
                    ))}
                </ul>
            ) : null}

            {/* Identity and position are available without colour, and without a pointer. */}
            <details className="group mt-2.5">
                <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 transition-colors hover:text-ink-200">
                    Read as a table
                </summary>
                <table className="mt-2 w-full border-collapse text-left text-[11px]">
                    <thead>
                        <tr>
                            <th scope="col" className="border-b border-white/15 pb-1.5 pr-3 font-bold uppercase tracking-[0.1em] text-ink-400">
                                {spec.xAxisLabel ?? "Step"}
                            </th>
                            {model.scaled.map((series, index) => (
                                <th
                                    key={index}
                                    scope="col"
                                    className="border-b border-white/15 pb-1.5 pr-3 font-bold uppercase tracking-[0.1em] text-ink-400"
                                >
                                    {series.label ?? spec.yAxisLabel ?? `Series ${index + 1}`}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({length: model.columns}).map((_, rowIndex) => (
                            <tr key={rowIndex}>
                                <td className="border-b border-white/[0.06] py-1.5 pr-3 text-ink-300">{rowIndex + 1}</td>
                                {model.scaled.map((series, index) => {
                                    const point = series.points[rowIndex];
                                    return (
                                        <td key={index} className="border-b border-white/[0.06] py-1.5 pr-3 text-ink-100">
                                            {point ? qualitativeBand(point.rawY, model.rawMinY, model.rawMaxY) : "—"}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </figure>
    );
}
