"use client";

import { useState, type ReactNode } from "react";
import { chartAxis, chartBaseline, chartGrid, singleSeriesColor } from "./format";

export type ChartSeries = { key: string; label: string; color: string; values: Array<number | null> };
export type ChartMarker = { index: number; label: string };

/** A chart ceiling of four equal, whole-number steps (e.g. 40 → ticks 0/10/20/30/40). */
function niceMax(value: number, percent: boolean) {
  if (percent) return value <= 25 ? 25 : value <= 50 ? 50 : 100;
  const rough = Math.max(1, value) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough) ?? magnitude * 10;
  return Math.max(4, Math.ceil(step) * 4);
}

const LEFT = 40;
const TOP = 14;
const BOTTOM = 24;

/**
 * Bars (stacked when there are several series) or a line, over the period
 * buckets, with release markers and a hover tooltip per bucket. One y-axis,
 * always; two measures of different scale get two charts.
 */
export function TrendChart({
  labels,
  series,
  type = "bar",
  percent = false,
  format,
  markers = [],
  height = 240,
  partialLast = false,
  compact = false,
  label,
}: {
  labels: string[];
  series: ChartSeries[];
  type?: "bar" | "line";
  percent?: boolean;
  format: (value: number | null) => string;
  markers?: ChartMarker[];
  height?: number;
  partialLast?: boolean;
  /** For a chart in a half- or third-width card: a narrower canvas keeps its text readable. */
  compact?: boolean;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const WIDTH = compact ? 460 : 900;
  const count = labels.length;
  const totals = labels.map((_, index) =>
    type === "bar" ? series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0) : Math.max(0, ...series.map((item) => item.values[index] ?? 0)),
  );
  const max = niceMax(Math.max(0, ...totals), percent);
  const plot = height - TOP - BOTTOM;
  const slot = (WIDTH - LEFT) / Math.max(count, 1);
  const y = (value: number) => TOP + plot - (Math.min(value, max) / max) * plot;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((step) => step * max);
  const every = Math.max(1, Math.ceil(count / (compact ? 6 : 12)));
  const markerByIndex = new Map<number, string[]>();
  for (const marker of markers) markerByIndex.set(marker.index, [...(markerByIndex.get(marker.index) ?? []), marker.label]);

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full tabular-nums" role="img" aria-label={label}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={WIDTH} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? chartBaseline : chartGrid} shapeRendering="crispEdges" />
            <text x={LEFT - 6} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={chartAxis}>
              {percent ? `${Math.round(tick)}%` : new Intl.NumberFormat("en", { notation: "compact" }).format(Math.round(tick))}
            </text>
          </g>
        ))}
        {Array.from(markerByIndex.keys()).map((index) => (
          <line
            key={`m${index}`}
            x1={LEFT + index * slot + slot / 2}
            x2={LEFT + index * slot + slot / 2}
            y1={TOP - 6}
            y2={TOP + plot}
            stroke="#f6bd55"
            strokeDasharray="3 3"
            strokeWidth={1.5}
          />
        ))}
        {Array.from(markerByIndex.keys()).map((index) => (
          <rect key={`mt${index}`} x={LEFT + index * slot + slot / 2 - 3} y={TOP - 9} width={6} height={6} fill="#f6bd55" />
        ))}
        {hover != null ? <rect x={LEFT + hover * slot} y={TOP} width={slot} height={plot} fill="rgba(255,255,255,.04)" /> : null}
        {type === "bar"
          ? labels.map((_, index) => {
              let top = y(0);
              return (
                <g key={index} opacity={partialLast && index === count - 1 ? 0.55 : 1}>
                  {series.map((item) => {
                    const value = item.values[index] ?? 0;
                    if (value <= 0) return null;
                    const h = (Math.min(value, max) / max) * plot;
                    top -= h;
                    // A 1px surface gap between stacked segments keeps them apart.
                    return <rect key={item.key} x={LEFT + index * slot + slot * 0.18} y={top} width={Math.max(2, slot * 0.64)} height={Math.max(0, h - 1)} fill={item.color} shapeRendering="crispEdges" />;
                  })}
                </g>
              );
            })
          : series.map((item) => {
              const points = item.values
                .map((value, index) => (value == null ? null : `${LEFT + index * slot + slot / 2},${y(value)}`))
                .reduce<string[][]>((runs, point) => {
                  if (point == null) runs.push([]);
                  else runs[runs.length - 1].push(point);
                  return runs;
                }, [[]])
                .filter((run) => run.length);
              return (
                <g key={item.key}>
                  {points.map((run, runIndex) =>
                    run.length > 1 ? <polyline key={runIndex} points={run.join(" ")} fill="none" stroke={item.color} strokeWidth={2} strokeLinejoin="round" /> : null,
                  )}
                  {item.values.map((value, index) =>
                    value == null || (count > 40 && hover !== index) ? null : (
                      <rect key={index} x={LEFT + index * slot + slot / 2 - 3} y={y(value) - 3} width={6} height={6} fill={item.color} stroke="#0d2a16" strokeWidth={1.5} />
                    ),
                  )}
                </g>
              );
            })}
        {labels.map((text, index) =>
          index % every === 0 ? (
            <text key={index} x={LEFT + index * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize={11} fill={chartAxis}>
              {text}
            </text>
          ) : null,
        )}
        {/* Hit targets: a whole bucket column, bigger than any mark. */}
        {labels.map((_, index) => (
          <rect key={`hit${index}`} x={LEFT + index * slot} y={0} width={slot} height={height} fill="transparent" onMouseEnter={() => setHover(index)} onFocus={() => setHover(index)} />
        ))}
      </svg>
      {hover != null ? (
        <Tooltip leftPercent={((LEFT + hover * slot + slot / 2) / WIDTH) * 100}>
          <p className="font-black text-white">
            {labels[hover]}
            {partialLast && hover === count - 1 ? <span className="ml-1 font-normal text-ink-500">(so far)</span> : null}
          </p>
          {series.map((item) => (
            <p key={item.key} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-ink-300">
                <span className="h-2 w-2" style={{ background: item.color }} aria-hidden="true" />
                {item.label}
              </span>
              <span className="font-bold text-white tabular-nums">{format(item.values[hover] ?? null)}</span>
            </p>
          ))}
          {type === "bar" && series.length > 1 ? (
            <p className="mt-1 flex justify-between gap-4 border-t border-line-300 pt-1 text-ink-300">
              Total <span className="font-bold text-white tabular-nums">{format(totals[hover])}</span>
            </p>
          ) : null}
          {(markerByIndex.get(hover) ?? []).map((text) => (
            <p key={text} className="mt-1 text-amber-200">
              ◆ {text}
            </p>
          ))}
        </Tooltip>
      ) : null}
    </div>
  );
}

function Tooltip({ leftPercent, children }: { leftPercent: number; children: ReactNode }) {
  const flip = leftPercent > 65;
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 min-w-[160px] border border-line-300 bg-canvas-950 px-3 py-2 text-xs shadow-xl"
      style={flip ? { right: `${100 - leftPercent + 2}%` } : { left: `${leftPercent + 2}%` }}
    >
      {children}
    </div>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: string; value?: ReactNode }> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5" style={{ background: item.color }} aria-hidden="true" />
          {item.label}
          {item.value != null ? <span className="font-bold text-white tabular-nums">{item.value}</span> : null}
        </span>
      ))}
    </div>
  );
}

/** A trend at a glance inside a KPI tile; the last (unfinished) bucket is drawn faint. */
export function Sparkline({ values, color = singleSeriesColor }: { values: Array<number | null>; color?: string }) {
  const known = values.filter((value): value is number => value != null);
  if (known.length < 2) return <div className="h-8" aria-hidden="true" />;
  const max = Math.max(...known);
  const min = Math.min(0, ...known);
  const span = max - min || 1;
  const w = 120;
  const h = 32;
  const step = w / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => (value == null ? null : `${index * step},${h - 2 - ((value - min) / span) * (h - 4)}`)).filter(Boolean);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A labelled horizontal bar: share of a whole, with the count beside it. */
export function ShareBar({ label, value, detail, color = singleSeriesColor }: { label: ReactNode; value: number | null; detail?: ReactNode; color?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-xs">
      <span className="truncate font-bold text-white">{label}</span>
      <span className="h-3 bg-white/[.06]">
        <span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, background: color }} />
      </span>
      <span className="text-right tabular-nums text-ink-300">
        <span className="font-bold text-white">{value == null ? "—" : `${value}%`}</span>
        {detail ? <span className="ml-1.5 text-ink-500">{detail}</span> : null}
      </span>
    </div>
  );
}
