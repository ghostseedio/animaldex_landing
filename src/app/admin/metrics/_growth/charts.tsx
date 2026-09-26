"use client";

import { useState } from "react";
import {
  cumulativeTargetByDay,
  formatMoney,
} from "@/lib/growth-command-center";
import {
  type GrowthChartMetric,
  type GrowthDaily,
} from "./types";
import {
  format,
  dateLabel,
  progressPercent,
  rollingDailyAverage,
  perMinuteRate,
} from "./format";

export function ProgressRing({
  percent,
  lowerIsBetter = false,
}: {
  percent: number;
  lowerIsBetter?: boolean;
}) {
  const size = 18;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const visiblePercent = Math.max(0, Math.min(1, percent));
  const dashOffset = circumference * (1 - visiblePercent);
  const color = lowerIsBetter ? "#59f176" : "#74d8ff";
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="shrink-0"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,.12)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function MetricProgress({
  actual,
  target,
  lowerIsBetter = false,
  missing = false,
  money = false,
  currencyCode,
}: {
  actual: number | string;
  target: number;
  lowerIsBetter?: boolean;
  missing?: boolean;
  money?: boolean;
  currencyCode?: string | null;
}) {
  const actualNumber = typeof actual === "number" ? actual : Number(actual);
  const canShow = !missing && Number.isFinite(actualNumber) && target > 0;
  const percent = canShow
    ? progressPercent(actualNumber, target, lowerIsBetter)
    : 0;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      {canShow ? <ProgressRing percent={percent} lowerIsBetter={lowerIsBetter} /> : null}
      <span>
        {typeof actual === "number"
          ? money
            ? formatMoney(actual, currencyCode)
            : format(actual)
          : actual}
        {target > 0
          ? ` / ${money ? formatMoney(target, currencyCode) : format(target)}`
          : ""}
      </span>
    </span>
  );
}


export function GrowthVelocityChart({ rows }: { rows: GrowthDaily[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  if (!rows.length) return null;
  const usersPerDay = rollingDailyAverage(rows.map((row) => row.users));
  const capturesPerDay = rollingDailyAverage(rows.map((row) => row.captures));
  const users = usersPerDay.map(perMinuteRate);
  const captures = capturesPerDay.map(perMinuteRate);
  const userMax = Math.max(0.001, ...users);
  const captureMax = Math.max(0.001, ...captures);
  const width = 900;
  const height = 280;
  const left = 52;
  const right = 58;
  const top = 34;
  const bottom = 38;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const x = (index: number) =>
    left + index * (chartWidth / Math.max(1, rows.length - 1));
  const y = (value: number, max: number) =>
    top + chartHeight - (value / max) * chartHeight;
  const points = (values: number[], max: number) =>
    values.map((value, index) => `${x(index)},${y(value, max)}`).join(" ");
  const hoveredRow =
    hoveredIndex === null ? null : rows[hoveredIndex] ?? null;
  const hoveredPoint =
    hoveredIndex === null
      ? null
      : {
          index: hoveredIndex,
          row: hoveredRow,
          userAverage: users[hoveredIndex] ?? 0,
          captureAverage: captures[hoveredIndex] ?? 0,
          userDailyAverage: usersPerDay[hoveredIndex] ?? 0,
          captureDailyAverage: capturesPerDay[hoveredIndex] ?? 0,
        };
  const recentStart = Math.max(0, rows.length - 7);
  const recentUsers = rows
    .slice(recentStart)
    .reduce((sum, row) => sum + row.users, 0);
  const recentCaptures = rows
    .slice(recentStart)
    .reduce((sum, row) => sum + row.captures, 0);
  const recentDays = Math.max(1, rows.length - recentStart);
  const numberWithUpToThreeDecimals = (value: number) =>
    new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value);
  const hoveredTop =
    hoveredPoint && hoveredPoint.row
      ? Math.min(
          Math.max(
            12,
            Math.min(
              y(users[hoveredPoint.index], userMax),
              y(captures[hoveredPoint.index], captureMax),
            ) - 118,
          ),
          height - 138,
        )
      : 0;
  const hoveredLeft =
    hoveredPoint && hoveredPoint.row
      ? Math.min(
          Math.max(12, x(hoveredPoint.index) - 140),
          width - 296,
        )
      : 0;

  return (
    <section className="rounded-xl border border-line-300 bg-surface-900 p-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">
            Growth velocity
          </p>
          <h3 className="mt-1 font-display text-2xl text-white">
            User acquisition vs captures per minute
          </h3>
          <p className="mt-1 text-xs text-ink-400">
            Seven-day rolling averages normalized to per-minute rates from
            stored signup and qualifying capture timestamps.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-xs">
          <div>
            <p className="font-black text-sky-300">
              {numberWithUpToThreeDecimals(
                perMinuteRate(recentUsers / recentDays),
              )}
            </p>
            <p className="text-ink-500">users/min</p>
          </div>
          <div>
            <p className="font-black text-primary-200">
              {numberWithUpToThreeDecimals(
                perMinuteRate(recentCaptures / recentDays),
              )}
            </p>
            <p className="text-ink-500">captures/min</p>
          </div>
          <div>
            <p className="font-black text-white">
              {recentUsers > 0
                ? numberWithUpToThreeDecimals(recentCaptures / recentUsers)
                : "—"}
            </p>
            <p className="text-ink-500">captures/user</p>
          </div>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <div className="relative min-w-[680px] w-full">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full"
            role="img"
            aria-label="Seven-day rolling averages for per-minute user acquisitions and captures"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const gridY = top + chartHeight * ratio;
              return (
                <line
                  key={ratio}
                  x1={left}
                  x2={width - right}
                  y1={gridY}
                  y2={gridY}
                  stroke="rgba(255,255,255,.08)"
                />
              );
            })}
            <text x={left} y="16" fill="#74d8ff" fontSize="12">
              users/min · left scale 0–
              {numberWithUpToThreeDecimals(userMax)}
            </text>
            <text
              x={width - right}
              y="16"
              textAnchor="end"
              fill="#59f176"
              fontSize="12"
            >
              captures/min · right scale 0–
              {numberWithUpToThreeDecimals(captureMax)}
            </text>
            {hoveredPoint && hoveredPoint.row ? (
              <line
                x1={x(hoveredPoint.index)}
                x2={x(hoveredPoint.index)}
                y1={top}
                y2={height - bottom}
                stroke="rgba(255,255,255,.28)"
                strokeDasharray="4 4"
              />
            ) : null}
            <polyline
              points={points(users, userMax)}
              fill="none"
              stroke="#74d8ff"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points={points(captures, captureMax)}
              fill="none"
              stroke="#59f176"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {rows.map((row, index) => (
              <g key={row.date}>
                <rect
                  x={Math.max(0, x(index) - 12)}
                  y={top}
                  width={24}
                  height={chartHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                />
                <circle
                  cx={x(index)}
                  cy={y(users[index], userMax)}
                  r={hoveredIndex === index ? 8 : 4}
                  fill={hoveredIndex === index ? "#b7ecff" : "#74d8ff"}
                  stroke={hoveredIndex === index ? "#ffffff" : "#041017"}
                  strokeWidth={hoveredIndex === index ? 2.5 : 1.5}
                />
                <circle
                  cx={x(index)}
                  cy={y(captures[index], captureMax)}
                  r={hoveredIndex === index ? 8 : 4}
                  fill={hoveredIndex === index ? "#b8ffd0" : "#59f176"}
                  stroke={hoveredIndex === index ? "#ffffff" : "#041017"}
                  strokeWidth={hoveredIndex === index ? 2.5 : 1.5}
                />
                {index === 0 || index === rows.length - 1 || row.day % 5 === 0 ? (
                  <text
                    x={x(index)}
                    y={height - 12}
                    textAnchor="middle"
                    fill="#84958b"
                    fontSize="10"
                  >
                    {dateLabel(row.date)}
                  </text>
                ) : null}
              </g>
            ))}
          </svg>
          {hoveredPoint && hoveredPoint.row ? (
            <div
              className="pointer-events-none absolute z-10 rounded-xl border border-line-300 bg-canvas-950/95 px-3 py-2 text-[11px] shadow-2xl backdrop-blur"
              style={{
                left: hoveredLeft,
                top: hoveredTop,
              }}
            >
              <p className="font-black text-white">
                {dateLabel(hoveredPoint.row.date)}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sky-300">Users</p>
                  <p className="font-black text-white">
                    {hoveredPoint.row.users}
                  </p>
                  <p className="text-ink-400">
                    Daily rate {numberWithUpToThreeDecimals(hoveredPoint.row.users / (24 * 60))} / min
                    <span className="block text-ink-500">
                      7-day avg {numberWithUpToThreeDecimals(hoveredPoint.userAverage)} / min
                    </span>
                    <span className="block text-ink-500">
                      {numberWithUpToThreeDecimals(
                        hoveredPoint.userDailyAverage,
                      )} / day
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-primary-200">Captures</p>
                  <p className="font-black text-white">
                    {hoveredPoint.row.captures}
                  </p>
                  <p className="text-ink-400">
                    Daily rate {numberWithUpToThreeDecimals(hoveredPoint.row.captures / (24 * 60))} / min
                    <span className="block text-ink-500">
                      7-day avg {numberWithUpToThreeDecimals(hoveredPoint.captureAverage)} / min
                    </span>
                    <span className="block text-ink-500">
                      {numberWithUpToThreeDecimals(
                        hoveredPoint.captureDailyAverage,
                      )} / day
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function MiniChart({
  rows,
  metric,
  target,
}: {
  rows: GrowthDaily[];
  metric: GrowthChartMetric;
  target: number;
}) {
  const totalDays = rows.length || 1;
  const targetLine = target > 0 ? cumulativeTargetByDay(target, totalDays) : [];
  let running = 0;
  const actualLine = rows.map((row) => {
    running +=
      metric === "users"
        ? row.users
        : metric === "captures"
          ? row.captures
          : row.hasMarketingEntry
            ? row.marketing[metric]
            : 0;
    return running;
  });
  const max = Math.max(1, target, ...actualLine);
  const points = (values: number[]) =>
    values
      .map(
        (value, index) =>
          `${index * (900 / Math.max(1, totalDays - 1))},${220 - (value / max) * 190}`,
      )
      .join(" ");
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 900 245"
        className="max-h-44 min-w-[620px] w-full"
        role="img"
        aria-label="Target versus actual"
      >
        <line
          x1="0"
          x2="900"
          y1="220"
          y2="220"
          stroke="rgba(255,255,255,.12)"
        />
        {target > 0 ? (
          <polyline
            points={points(targetLine)}
            fill="none"
            stroke="#84958b"
            strokeWidth="4"
            strokeDasharray="8 8"
          />
        ) : null}
        <polyline
          points={points(actualLine)}
          fill="none"
          stroke="#59f176"
          strokeWidth="5"
        />
        <text x="10" y="20" fill="#59f176" fontSize="12">
          actual
        </text>
        {target > 0 ? (
          <text x="70" y="20" fill="#84958b" fontSize="12">
            target
          </text>
        ) : null}
      </svg>
      {target <= 0 ? (
        <p className="mt-2 text-xs text-ink-500">
          No operating target configured for this month.
        </p>
      ) : null}
    </div>
  );
}

