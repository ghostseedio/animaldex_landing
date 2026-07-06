import type {SpeciesStats} from "@/data/species-stats";

export type SpeciesRadarMetric = {
    id: keyof SpeciesStats | "total";
    title: string;
    shortTitle: string;
    value: number;
    tint: string;
    valueSuffix?: string;
};

const STAT_ORDER: Array<{
    key: keyof SpeciesStats;
    shortTitle: string;
    tint: string;
    valueSuffix?: string;
}> = [
    {key: "dominance", shortTitle: "DOM", tint: "rgba(239, 68, 68, 0.92)"},
    {key: "speed", shortTitle: "SPD", tint: "#38fa47"},
    {key: "size", shortTitle: "SIZE", tint: "#a78bfa"},
    {key: "intelligence", shortTitle: "INT", tint: "rgba(34, 211, 238, 0.92)"},
    {key: "rarity", shortTitle: "RAR", tint: "rgba(251, 146, 60, 0.92)", valueSuffix: "%"}
];

const RING_LEVELS = 5;
const CHART_WIDTH = 400;
const CHART_HEIGHT = 320;
const CENTER_X = CHART_WIDTH / 2;
const CENTER_Y = CHART_HEIGHT / 2;
const CHART_RADIUS = 128;

function angleForIndex(index: number, total: number) {
    const base = -Math.PI / 2;

    return base + index * ((2 * Math.PI) / total);
}

function axisPoint(centerX: number, centerY: number, radius: number, index: number, total: number) {
    const angle = angleForIndex(index, total);

    return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
    };
}

function polygonPath(centerX: number, centerY: number, radius: number, sides: number, scale: number) {
    const scaledRadius = radius * scale;
    const points = Array.from({length: sides}, (_, index) =>
        axisPoint(centerX, centerY, scaledRadius, index, sides)
    );

    return points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ")
        .concat(" Z");
}

function radarPlotPath(centerX: number, centerY: number, radius: number, values: number[]) {
    const points = values.map((value, index) => {
        const normalized = Math.max(0, Math.min(100, value)) / 100;

        return axisPoint(centerX, centerY, radius * normalized, index, values.length);
    });

    if (points.length === 0) {
        return "";
    }

    return points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ")
        .concat(" Z");
}

function buildMetrics(stats: SpeciesStats, labels: Record<keyof SpeciesStats, string>): SpeciesRadarMetric[] {
    const statMetrics = STAT_ORDER.map((stat) => ({
        id: stat.key,
        title: labels[stat.key],
        shortTitle: stat.shortTitle,
        value: stats[stat.key],
        tint: stat.tint,
        valueSuffix: stat.valueSuffix
    }));

    const totalValue = statMetrics.reduce((sum, metric) => sum + metric.value, 0);

    return [
        ...statMetrics,
        {
            id: "total",
            title: "Total",
            shortTitle: "TOT",
            value: totalValue,
            tint: "rgba(255, 255, 255, 0.92)"
        }
    ];
}

function SpeciesRadarLegendChip({metric}: {metric: SpeciesRadarMetric}) {
    return (
        <div className="flex min-w-[88px] items-center gap-2 rounded-[14px] border border-white/[0.06] bg-white/[0.025] px-2.5 py-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{backgroundColor: metric.tint}} />
            <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{metric.title}</p>
                <p className="text-[15px] font-extrabold leading-tight text-white tabular-nums">
                    {metric.value}
                    {metric.valueSuffix ?? ""}
                </p>
            </div>
        </div>
    );
}

export default function SpeciesRadarStats({
    stats,
    labels
}: {
    stats: SpeciesStats;
    labels: Record<keyof SpeciesStats, string>;
}) {
    const chartMetrics = STAT_ORDER.map((stat) => ({
        ...stat,
        title: labels[stat.key],
        value: stats[stat.key]
    }));
    const legendMetrics = buildMetrics(stats, labels);
    const plotValues = chartMetrics.map((metric) => metric.value);
    const plotPath = radarPlotPath(CENTER_X, CENTER_Y, CHART_RADIUS, plotValues);
    const plotPoints = plotValues.map((value, index) => {
        const normalized = Math.max(0, Math.min(100, value)) / 100;

        return axisPoint(CENTER_X, CENTER_Y, CHART_RADIUS * normalized, index, plotValues.length);
    });

    return (
        <div className="flex flex-col gap-2.5">
            <div className="overflow-hidden rounded-[24px] border border-white/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(31,31,31,0.9),rgba(167,139,250,0.08))] px-2 py-1.5">
                <svg
                    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                    className="mx-auto h-[320px] w-full max-w-[420px]"
                    role="img"
                    aria-label="Canonical species stats radar chart"
                >
                    <defs>
                        <radialGradient id="species-radar-glow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#38fa47" stopOpacity="0.16" />
                            <stop offset="55%" stopColor="#a78bfa" stopOpacity="0.1" />
                            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                        </radialGradient>
                        <linearGradient id="species-radar-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#38fa47" stopOpacity="0.24" />
                            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.18" />
                        </linearGradient>
                        <linearGradient id="species-radar-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#38fa47" />
                            <stop offset="100%" stopColor="#a78bfa" />
                        </linearGradient>
                    </defs>

                    <circle cx={CENTER_X} cy={CENTER_Y} r={CHART_RADIUS * 0.95} fill="url(#species-radar-glow)" />

                    {Array.from({length: RING_LEVELS}, (_, index) => {
                        const level = index + 1;

                        return (
                            <path
                                key={level}
                                d={polygonPath(CENTER_X, CENTER_Y, CHART_RADIUS, chartMetrics.length, level / RING_LEVELS)}
                                fill="none"
                                stroke={level === RING_LEVELS ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)"}
                                strokeWidth="1"
                            />
                        );
                    })}

                    {chartMetrics.map((metric, index) => {
                        const outerPoint = axisPoint(CENTER_X, CENTER_Y, CHART_RADIUS, index, chartMetrics.length);
                        const labelPoint = axisPoint(CENTER_X, CENTER_Y, CHART_RADIUS + 18, index, chartMetrics.length);

                        return (
                            <g key={metric.key}>
                                <line
                                    x1={CENTER_X}
                                    y1={CENTER_Y}
                                    x2={outerPoint.x}
                                    y2={outerPoint.y}
                                    stroke="rgba(255,255,255,0.1)"
                                    strokeWidth="1"
                                />
                                <text
                                    x={labelPoint.x}
                                    y={labelPoint.y}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="rgba(255, 255, 255, 0.62)"
                                    stroke="rgba(0, 0, 0, 0.55)"
                                    strokeWidth="2"
                                    paintOrder="stroke"
                                    style={{fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase"}}
                                >
                                    {metric.shortTitle}
                                </text>
                            </g>
                        );
                    })}

                    <path d={plotPath} fill="url(#species-radar-fill)" />
                    <path
                        d={plotPath}
                        fill="none"
                        stroke="url(#species-radar-stroke)"
                        strokeWidth="2.8"
                        strokeLinejoin="round"
                        style={{filter: "drop-shadow(0 0 12px rgba(56, 250, 71, 0.2))"}}
                    />

                    {plotPoints.map((point, index) => {
                        const metric = chartMetrics[index];

                        return (
                            <g key={`${metric.key}-point`}>
                                <circle cx={point.x} cy={point.y} r="10" fill={metric.tint} fillOpacity="0.24" />
                                <circle cx={point.x} cy={point.y} r="4.5" fill={metric.tint} />
                            </g>
                        );
                    })}
                </svg>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(88px,1fr))] gap-2">
                {legendMetrics.map((metric) => (
                    <SpeciesRadarLegendChip key={metric.id} metric={metric} />
                ))}
            </div>
        </div>
    );
}
