"use client";

/**
 * Stats-tab panels ported 1:1 from the iOS `ProfileScreenView` stats stack.
 *
 * iOS stacks these flush: full-bleed `AnimalDexTheme.chrome` panels with square
 * corners and a hairline bottom separator, no gaps between them. `StatsPanel`
 * is the web spelling of `profileStatsFlushChrome()`, so the panels have to be
 * rendered inside a zero-gap, edge-to-edge column.
 */

import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import IdentityKindChip from "@/app/[locale]/(composited)/animals/identity-kind-chip";
import type {
    ProfileBattleTierCounts,
    ProfileBestForTag,
    ProfileInsight,
    PublicProfileCapture
} from "@/data/public-profiles";
import type {AnimalBattleTier} from "@/lib/battle-tier";
import {collectorScoreAccent, getCollectorScoreBand} from "@/lib/collector-score";
import {getSpeciesImageRoute} from "@/lib/species-image-public";

/** `AnimalDexTheme` tokens, resolved to sRGB. */
export const THEME = {
    neon: "#38FA47",
    violet: "#9454FA",
    chrome: "#1F1F1F",
    outline: "rgba(255,255,255,0.10)",
    textSecondary: "rgba(255,255,255,0.62)",
    textTertiary: "rgba(255,255,255,0.42)",
    mint: "#00C7BE",
    cyan: "#32ADE6",
    orange: "#FF9500",
    red: "#FF3B30",
    green: "#34C759",
    domestic: "#8CC7FF",
    farm: "#D1A659"
} as const;

/** iOS `profileStatsFlushChrome()`. */
export function StatsPanel({
    children,
    className = ""
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section
            className={`relative w-full bg-[#1F1F1F] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-white/10 ${className}`}
        >
            {children}
        </section>
    );
}

function PanelTitle({children}: {children: React.ReactNode}) {
    return <p className="text-[11px] font-semibold text-white/40">{children}</p>;
}

function PanelCaption({children}: {children: React.ReactNode}) {
    return <p className="text-xs font-medium text-white/[0.62]">{children}</p>;
}

/* ------------------------------------------------------------------ *
 * Overall score — iOS `CollectorScoreCardView`
 * ------------------------------------------------------------------ */

function CatalogCompletionRing({
    completed,
    total,
    accent
}: {
    completed: number;
    total: number;
    accent: string;
}) {
    const clamped = Math.min(Math.max(completed, 0), Math.max(total, 0));
    const ratio = total > 0 ? Math.min(Math.max(clamped / total, 0), 1) : 0;
    const radius = 27.5;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="flex w-[74px] shrink-0 flex-col items-center gap-1.5">
            <div className="relative h-[62px] w-[62px]">
                <svg viewBox="0 0 62 62" className="h-[62px] w-[62px] -rotate-90">
                    <circle cx="31" cy="31" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
                    <circle
                        cx="31"
                        cy="31"
                        r={radius}
                        fill="none"
                        stroke={accent}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={`${circumference * ratio} ${circumference}`}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
                    <span className="text-[15px] font-extrabold leading-none text-white">
                        {total > 0 ? `${Math.round(ratio * 100)}%` : "0%"}
                    </span>
                    <span className="text-[7px] font-black leading-none text-white/40">CATALOG</span>
                </div>
            </div>
            <p className="text-[9px] font-extrabold text-white/[0.62]">
                {clamped}/{total}
            </p>
        </div>
    );
}

export function CollectorScoreCard({
    score,
    archetype,
    catalogCompletion,
    tradeUnlock
}: {
    score: number;
    archetype: string;
    catalogCompletion: {completed: number; total: number} | null;
    tradeUnlock: {verifiedOverallScore: number; requiredScore: number; tradeUnlocked: boolean} | null;
}) {
    const band = getCollectorScoreBand(score);
    const accent = collectorScoreAccent(band);
    const showsTradeUnlock = Boolean(tradeUnlock && !tradeUnlock.tradeUnlocked);
    const tradeRatio = tradeUnlock && tradeUnlock.requiredScore > 0
        ? Math.min(Math.max(tradeUnlock.verifiedOverallScore / tradeUnlock.requiredScore, 0), 1)
        : 0;

    return (
        <section
            className="relative w-full p-5 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-white/10"
            style={{
                background: [
                    `radial-gradient(220px 220px at 18px 18px, ${collectorScoreAccent(band, 0.16)}, transparent)`,
                    "linear-gradient(135deg, rgba(255,255,255,0.04), transparent 50%, rgba(0,0,0,0.18))",
                    THEME.chrome
                ].join(", ")
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-white/40">Overall Score</p>
                <span
                    className="rounded-full border px-2.5 py-[7px] text-[11px] font-semibold uppercase leading-none"
                    style={{
                        color: accent,
                        backgroundColor: collectorScoreAccent(band, 0.14),
                        borderColor: collectorScoreAccent(band, 0.3)
                    }}
                >
                    {band.tierLabel}
                </span>
            </div>

            <div className="mt-[18px] flex items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <p className="truncate text-[44px] font-extrabold leading-none text-white">{score}</p>
                    <p className="truncate text-lg font-semibold text-white/[0.62]">{archetype}</p>
                </div>
                {catalogCompletion ? (
                    <CatalogCompletionRing
                        completed={catalogCompletion.completed}
                        total={catalogCompletion.total}
                        accent={accent}
                    />
                ) : null}
            </div>

            {showsTradeUnlock && tradeUnlock ? (
                <div className="mt-[18px] flex flex-col gap-2">
                    <p className="text-xs font-medium text-white/40">Trade unlock</p>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                            className="h-full rounded-full"
                            style={{width: `max(18px, ${tradeRatio * 100}%)`, backgroundColor: accent}}
                        />
                    </div>
                    <p className="text-xs font-medium text-white/[0.62]">
                        {tradeUnlock.verifiedOverallScore} / {tradeUnlock.requiredScore} Overall Score
                    </p>
                </div>
            ) : null}
        </section>
    );
}

/* ------------------------------------------------------------------ *
 * Wild vs zoo vs domestic vs farm — iOS `settingComparisonCard`
 * ------------------------------------------------------------------ */

const SETTING_LABEL_ALIGNMENT = {
    start: "items-start",
    center: "items-center",
    end: "items-end"
} as const;

function SettingComparisonLabel({
    title,
    count,
    align
}: {
    title: string;
    count: number;
    align: keyof typeof SETTING_LABEL_ALIGNMENT;
}) {
    return (
        <div className={`flex flex-1 flex-col gap-[3px] text-black/[0.82] ${SETTING_LABEL_ALIGNMENT[align]}`}>
            <span className="text-[9px] font-bold leading-none">{title}</span>
            <span className="text-[17px] font-extrabold leading-none">{count}</span>
        </div>
    );
}

export function SettingComparisonCard({
    wild,
    zoo,
    domestic,
    farm
}: {
    wild: number;
    zoo: number;
    domestic: number;
    farm: number;
}) {
    const total = wild + zoo + domestic + farm;
    const share = (value: number) => (total > 0 ? (value / total) * 100 : 25);

    return (
        <StatsPanel className="p-4">
            <PanelTitle>WILD VS ZOO VS DOMESTIC VS FARM</PanelTitle>
            <div className="relative mt-3 h-[72px] w-full overflow-hidden bg-white/[0.04]">
                <div className="absolute inset-0 flex">
                    <div style={{width: `${share(wild)}%`, backgroundColor: THEME.cyan, opacity: 0.92}} />
                    <div style={{width: `${share(zoo)}%`, backgroundColor: THEME.orange, opacity: 0.92}} />
                    <div style={{width: `${share(domestic)}%`, backgroundColor: THEME.domestic, opacity: 0.96}} />
                    <div style={{width: `${share(farm)}%`, backgroundColor: THEME.farm, opacity: 0.96}} />
                </div>
                <div className="absolute inset-0 flex items-center px-2.5">
                    <SettingComparisonLabel title="Wild" count={wild} align="start" />
                    <SettingComparisonLabel title="Zoo" count={zoo} align="center" />
                    <SettingComparisonLabel title="Domestic" count={domestic} align="center" />
                    <SettingComparisonLabel title="Farm" count={farm} align="end" />
                </div>
            </div>
        </StatsPanel>
    );
}

/* ------------------------------------------------------------------ *
 * Battle tier spread — iOS `TierDistributionCard`
 * ------------------------------------------------------------------ */

const ORDERED_TIERS: AnimalBattleTier[] = ["S", "A", "B", "C", "D", "E"];

/**
 * Chart-only tier colours. The tier-chip palette collapses under adjacency
 * (S/A are the same green, C sits on top of B under protanopia), so the chart
 * re-steps A to a deeper green and C to the app violet.
 */
const TIER_CHART_COLORS: Record<AnimalBattleTier, string> = {
    S: "rgb(77,242,92)",
    A: "rgb(18,166,61)",
    B: "rgb(33,194,224)",
    C: "rgb(176,125,240)",
    D: "rgb(240,153,31)",
    E: "rgb(214,54,46)"
};

function tierPercentLabel(ratio: number) {
    if (ratio <= 0) return "0%";
    const percent = ratio * 100;
    // Never round a present tier away to "0%".
    return percent < 1 ? "<1%" : `${Math.round(percent)}%`;
}

export type TierDistributionRow = {
    label: string;
    counts: ProfileBattleTierCounts;
};

export function TierDistributionCard({
    title,
    rows,
    showsRowLabels = false,
    flush = true
}: {
    title: string;
    rows: TierDistributionRow[];
    showsRowLabels?: boolean;
    flush?: boolean;
}) {
    const legendCounts = rows[0]?.counts;
    const legendTotal = legendCounts ? ORDERED_TIERS.reduce((sum, tier) => sum + legendCounts[tier], 0) : 0;

    const content = (
        <>
            <PanelTitle>{title}</PanelTitle>

            {rows.map((row) => {
                const total = ORDERED_TIERS.reduce((sum, tier) => sum + row.counts[tier], 0);
                const present = ORDERED_TIERS.filter((tier) => row.counts[tier] > 0);

                return (
                    <div key={row.label} className="mt-3 flex flex-col gap-1.5">
                        {showsRowLabels ? (
                            <div className="flex items-center gap-2">
                                <span className="truncate text-xs font-extrabold text-white">{row.label}</span>
                                <span className="ml-auto text-[11px] font-semibold tabular-nums text-white/40">{total}</span>
                            </div>
                        ) : null}
                        <div className="flex h-[26px] w-full items-stretch overflow-hidden rounded-full bg-white/[0.05]">
                            {total === 0 ? (
                                <span className="flex items-center pl-2.5 text-[11px] font-semibold text-white/40">
                                    No ranked captures yet
                                </span>
                            ) : (
                                present.map((tier, index) => (
                                    <div
                                        key={tier}
                                        className="grid min-w-[3px] place-items-center"
                                        style={{
                                            width: `calc(${(row.counts[tier] / total) * 100}% - ${
                                                (2 * Math.max(present.length - 1, 0)) / present.length
                                            }px)`,
                                            backgroundColor: TIER_CHART_COLORS[tier],
                                            marginLeft: index === 0 ? 0 : 2
                                        }}
                                    >
                                        <span className="text-[10px] font-black text-black/75">{tier}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );
            })}

            <div className="mt-3 grid grid-cols-3 gap-2">
                {ORDERED_TIERS.map((tier) => (
                    <div key={tier} className="flex items-center gap-1.5">
                        <span
                            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                            style={{backgroundColor: TIER_CHART_COLORS[tier]}}
                        />
                        <span className="text-[11px] font-black text-white/[0.62]">{tier}</span>
                        <span className="text-[11px] font-semibold tabular-nums text-white/40">
                            {legendTotal > 0 && legendCounts
                                ? tierPercentLabel(legendCounts[tier] / legendTotal)
                                : "—"}
                        </span>
                    </div>
                ))}
            </div>
        </>
    );

    if (!flush) {
        return <section className="w-full rounded-[1.1rem] border border-white/10 bg-[#1F1F1F] p-4">{content}</section>;
    }

    return <StatsPanel className="p-4">{content}</StatsPanel>;
}

/* ------------------------------------------------------------------ *
 * Stat chips — iOS `profileStatChipScroller`
 * ------------------------------------------------------------------ */

export type ProfileStatChip = {
    title: string;
    value: string;
    tint: string;
    denominator?: string;
};

export function StatChipScroller({items}: {items: ProfileStatChip[]}) {
    return (
        <StatsPanel>
            <div className="flex gap-2 overflow-x-auto px-4 py-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {items.map((item) => (
                    <div
                        key={item.title}
                        className="flex h-[66px] w-[116px] shrink-0 flex-col justify-between rounded-[14px] border border-white/10 bg-[#1F1F1F] px-2.5 py-[9px]"
                    >
                        <p className="truncate text-[8px] font-extrabold uppercase text-white/40">{item.title}</p>
                        <p className="flex items-baseline gap-px">
                            <span className="truncate text-[20px] font-extrabold leading-none text-white">{item.value}</span>
                            {item.denominator ? (
                                <span className="text-[8px] font-bold text-white/40">{item.denominator}</span>
                            ) : null}
                        </p>
                        <span className="block h-0.5 w-full rounded-[2px]" style={{backgroundColor: item.tint}} />
                    </div>
                ))}
            </div>
        </StatsPanel>
    );
}

/* ------------------------------------------------------------------ *
 * Net worth — iOS `profileStatTile`
 * ------------------------------------------------------------------ */

export function StatTile({
    title,
    value,
    tint,
    footerText
}: {
    title: string;
    value: string;
    tint: string;
    footerText?: string;
}) {
    return (
        <StatsPanel className="flex flex-col gap-2 p-4">
            <p className="text-[11px] font-semibold uppercase text-white/40">{title}</p>
            <p className="truncate text-[28px] font-extrabold leading-none text-white">{value}</p>
            {footerText ? <p className="text-[11px] font-semibold text-white/40">{footerText}</p> : null}
            <span className="block h-[3px] w-full rounded-[3px]" style={{backgroundColor: tint}} />
        </StatsPanel>
    );
}

/* ------------------------------------------------------------------ *
 * Qualities — iOS `bestForTagsChartCard` + `ProfileBestForTagBar`
 * ------------------------------------------------------------------ */

export function BestForTagsChartCard({
    scores,
    title
}: {
    scores: ProfileBestForTag[];
    title: string;
}) {
    const sorted = [...scores].sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (right.captureCount !== left.captureCount) return right.captureCount - left.captureCount;
        return left.tagLabel.localeCompare(right.tagLabel);
    });
    const maxScore = Math.max(...sorted.map((score) => score.score), 1);

    return (
        <StatsPanel className="flex flex-col gap-3.5 p-4">
            <div className="flex items-center gap-3">
                <PanelTitle>{title}</PanelTitle>
                <span className="ml-auto shrink-0">
                    <PanelCaption>{sorted.length === 0 ? "No data yet" : "Top 25"}</PanelCaption>
                </span>
            </div>

            {sorted.length === 0 ? (
                <p className="py-2.5 text-[15px] font-medium text-white/[0.62]">
                    Discover animals with indexed principles or learned sub-principles to build this chart.
                </p>
            ) : (
                <div className="flex items-start gap-2">
                    <div className="flex h-32 w-7 shrink-0 flex-col justify-between pt-[22px] text-right text-[11px] font-semibold text-white/40">
                        <span>{maxScore}</span>
                        <span>0</span>
                    </div>
                    <div className="h-[280px] flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <div className="flex h-[274px] items-end gap-[9px] px-0.5">
                            {sorted.map((score) => (
                                <div key={score.tagKey} className="flex w-[34px] shrink-0 flex-col items-center gap-2">
                                    <span className="h-3.5 text-[11px] font-semibold leading-none text-white/[0.62]">
                                        {score.score}
                                    </span>
                                    <div className="relative flex h-32 w-6 items-end rounded-[5px] bg-white/[0.045]">
                                        <div
                                            className="w-full rounded-[5px] border border-white/[0.18] shadow-[0_0_8px_rgba(56,250,71,0.16)]"
                                            style={{
                                                height: `${Math.max(10, (score.score / maxScore) * 128)}px`,
                                                background: `linear-gradient(to bottom, ${THEME.neon}F2, ${THEME.violet}C7, rgba(50,173,230,0.62))`
                                            }}
                                        />
                                    </div>
                                    <div className="grid h-28 w-[26px] place-items-center">
                                        <span className="w-28 -rotate-90 truncate text-center text-[9px] font-extrabold uppercase leading-[18px] text-white/[0.62]">
                                            {score.tagLabel}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </StatsPanel>
    );
}

/* ------------------------------------------------------------------ *
 * Average traits — iOS `averageTraitsCard` + `ProfileRadarChart`
 * ------------------------------------------------------------------ */

export type ProfileAverageStats = {
    dominance: number;
    speed: number;
    size: number;
    intelligence: number;
    rarity: number;
};

const RADAR_LABELS = ["DOM", "SPD", "SIZE", "INT", "RAR"];

function radarPoint(center: number, radius: number, index: number, total: number) {
    const angle = -Math.PI / 2 + index * ((Math.PI * 2) / total);
    return {x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius};
}

function ProfileRadarChart({stats}: {stats: ProfileAverageStats}) {
    const size = 150;
    const center = size / 2;
    const radius = size * 0.34;
    const values = [stats.dominance, stats.speed, stats.size, stats.intelligence, stats.rarity];
    const total = values.length;
    const polygon = (ringRadius: number) =>
        Array.from({length: total}, (_, index) => {
            const point = radarPoint(center, ringRadius, index, total);
            return `${point.x},${point.y}`;
        }).join(" ");
    const valuePolygon = values
        .map((value, index) => {
            const point = radarPoint(center, (radius * Math.min(Math.max(value, 0), 100)) / 100, index, total);
            return `${point.x},${point.y}`;
        })
        .join(" ");

    return (
        <svg viewBox={`0 0 ${size} ${size}`} className="h-[150px] w-[150px] shrink-0" aria-hidden="true">
            <defs>
                <linearGradient id="profile-radar-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={THEME.neon} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={THEME.violet} stopOpacity="0.22" />
                </linearGradient>
            </defs>
            {[1, 2, 3, 4].map((step) => (
                <polygon
                    key={step}
                    points={polygon((radius * step) / 4)}
                    fill="none"
                    stroke={step === 4 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}
                    strokeWidth="1"
                />
            ))}
            {Array.from({length: total}, (_, index) => {
                const point = radarPoint(center, radius, index, total);
                return (
                    <line
                        key={index}
                        x1={center}
                        y1={center}
                        x2={point.x}
                        y2={point.y}
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="1"
                    />
                );
            })}
            <polygon
                points={valuePolygon}
                fill="url(#profile-radar-fill)"
                stroke={THEME.neon}
                strokeOpacity="0.82"
                strokeWidth="2"
            />
            {values.map((value, index) => {
                const point = radarPoint(center, (radius * Math.min(Math.max(value, 0), 100)) / 100, index, total);
                return <circle key={index} cx={point.x} cy={point.y} r="4" fill="#ffffff" />;
            })}
            {RADAR_LABELS.map((label, index) => {
                const point = radarPoint(center, radius + 18, index, total);
                return (
                    <text
                        key={label}
                        x={point.x}
                        y={point.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="11"
                        fontWeight="600"
                        fill="rgba(255,255,255,0.42)"
                    >
                        {label}
                    </text>
                );
            })}
        </svg>
    );
}

export function AverageTraitsCard({stats}: {stats: ProfileAverageStats}) {
    const legend: Array<[string, number, string]> = [
        ["Dominance", stats.dominance, "rgba(255,59,48,0.88)"],
        ["Speed", stats.speed, "rgba(50,173,230,0.9)"],
        ["Size", stats.size, "rgba(148,84,250,0.95)"],
        ["Intelligence", stats.intelligence, "rgba(50,173,230,0.92)"],
        ["Rarity", stats.rarity, "rgba(255,149,0,0.92)"]
    ];
    const isEmpty = legend.every(([, value]) => value === 0);

    return (
        <StatsPanel className="flex flex-col gap-3.5 p-4">
            <div className="flex items-center gap-3">
                <PanelTitle>AVERAGE TRAITS</PanelTitle>
                <span className="ml-auto">
                    <PanelCaption>{isEmpty ? "Not enough data" : "Collection profile"}</PanelCaption>
                </span>
            </div>
            <div className="flex items-center gap-4">
                <ProfileRadarChart stats={stats} />
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    {legend.map(([label, value, tint]) => (
                        <div key={label} className="flex items-center gap-2.5">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor: tint}} />
                            <span className="truncate text-xs font-medium text-white/[0.62]">{label}</span>
                            <span className="ml-auto text-[17px] font-semibold text-white">{Math.round(value)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </StatsPanel>
    );
}

/* ------------------------------------------------------------------ *
 * Insights — iOS `profileInsightsSection`
 * ------------------------------------------------------------------ */

function InsightCaptureIcon({capture}: {capture: PublicProfileCapture}) {
    const iconSrc = capture.speciesSlug ? getSpeciesImageRoute(capture.speciesSlug) : capture.imageSrc;

    return (
        <Image
            src={iconSrc}
            alt=""
            width={34}
            height={34}
            unoptimized
            className="h-[34px] w-[34px] shrink-0 rounded-lg border border-white/10 object-cover"
        />
    );
}

function SparklesIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden="true">
            <path d="M12 2.5 13.6 8 19 9.6 13.6 11.2 12 16.7 10.4 11.2 5 9.6 10.4 8z" />
            <path d="M18.5 14.2l.85 2.9 2.9.85-2.9.85-.85 2.9-.85-2.9-2.9-.85 2.9-.85z" />
            <path d="M5.4 15.1l.6 2.05 2.05.6-2.05.6-.6 2.05-.6-2.05L2.75 17.75l2.05-.6z" />
        </svg>
    );
}

function InsightRow({insight}: {insight: ProfileInsight}) {
    const body = (
        <div className="flex items-center gap-3 p-3.5">
            <p className="text-xs font-medium text-white/40">{insight.title}</p>
            <div className="ml-auto flex min-w-0 items-center gap-2.5">
                {insight.capture ? <InsightCaptureIcon capture={insight.capture} /> : null}
                <div className="flex min-w-0 flex-col items-end gap-1">
                    <span className="truncate text-[17px] font-semibold text-white">
                        {insight.capture?.animalName ?? "Keep scanning"}
                    </span>
                    {insight.capture?.identityKind ? (
                        <IdentityKindChip
                            identityKind={insight.capture.identityKind}
                            animalName={insight.capture.animalName}
                            compact
                            showsInfoIcon={false}
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );

    return (
        <StatsPanel>
            {insight.capture ? (
                <Link href={insight.capture.href} className="block transition hover:bg-white/[0.03]">
                    {body}
                </Link>
            ) : (
                body
            )}
        </StatsPanel>
    );
}

export function ProfileInsightsSection({
    insights,
    isWildScope,
    onToggleWildScope
}: {
    insights: ProfileInsight[];
    isWildScope: boolean;
    onToggleWildScope: (isWild: boolean) => void;
}) {
    return (
        <>
            <StatsPanel className="px-[18px] py-3">
                <div className="flex items-center gap-2.5">
                    <span style={{color: THEME.neon}}>
                        <SparklesIcon />
                    </span>
                    <p className="text-xs font-medium uppercase tracking-[0.09em] text-white">Insights</p>
                    <div className="ml-auto flex items-center gap-1.5">
                        <span className={`text-xs font-medium ${isWildScope ? "text-white" : "text-white/[0.62]"}`}>
                            Wild
                        </span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={isWildScope}
                            aria-label="Wild insights"
                            onClick={() => onToggleWildScope(!isWildScope)}
                            className="relative h-[24px] w-[40px] shrink-0 rounded-full transition-colors duration-200"
                            style={{backgroundColor: isWildScope ? THEME.neon : "rgba(255,255,255,0.16)"}}
                        >
                            <span
                                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200"
                                style={{left: isWildScope ? 18 : 2}}
                            />
                        </button>
                    </div>
                </div>
            </StatsPanel>
            {insights.map((insight) => (
                <InsightRow key={insight.title} insight={insight} />
            ))}
        </>
    );
}

/* ------------------------------------------------------------------ *
 * Completed binders — iOS `completedSetsSection`
 * ------------------------------------------------------------------ */

export type ProfileBinder = {
    key: string;
    title: string;
    found: number;
    total: number;
    tier: string;
};

const BINDER_TIER_ACCENTS: Record<string, string> = {
    Gold: "#FFCC00",
    Silver: "#C7C9CC",
    Bronze: "#CD7F32"
};

function SealCheckIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden="true">
            <path d="M12 1.8l2.4 1.9 3-.35 1.2 2.8 2.75 1.35-.7 2.95.7 2.95-2.75 1.35-1.2 2.8-3-.35L12 22.2l-2.4-1.9-3 .35-1.2-2.8L2.65 16.5l.7-2.95-.7-2.95L5.4 9.25l1.2-2.8 3 .35z" />
            <path d="M10.6 15.4 7.4 12.2l1.4-1.4 1.8 1.8 4.6-4.6 1.4 1.4z" fill="#1F1F1F" />
        </svg>
    );
}

export function CompletedBindersSection({
    binders,
    href
}: {
    binders: ProfileBinder[];
    href: string;
}) {
    if (binders.length === 0) return null;

    return (
        <>
            <StatsPanel className="px-[18px] py-3">
                <div className="flex items-baseline gap-2.5">
                    <span style={{color: THEME.neon}}>
                        <SealCheckIcon />
                    </span>
                    <p className="text-xs font-medium uppercase tracking-[0.09em] text-white">Completed binders</p>
                    <span className="ml-auto text-xs font-medium text-white/[0.62]">{binders.length}</span>
                </div>
            </StatsPanel>
            <StatsPanel>
                <div className="flex gap-3.5 overflow-x-auto px-[18px] py-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {binders.map((binder) => {
                        const accent = BINDER_TIER_ACCENTS[binder.tier] ?? "#CD7F32";
                        return (
                            <Link
                                key={binder.key}
                                href={href}
                                className="flex w-[148px] shrink-0 flex-col gap-2"
                            >
                                <div
                                    className="flex aspect-[3/4] flex-col justify-between rounded-[14px] border p-3"
                                    style={{
                                        borderColor: `${accent}59`,
                                        background: `linear-gradient(150deg, ${accent}2E, rgba(0,0,0,0.35))`
                                    }}
                                >
                                    <span
                                        className="self-start rounded-full px-2 py-1 text-[9px] font-black uppercase leading-none"
                                        style={{color: accent, backgroundColor: `${accent}24`}}
                                    >
                                        {binder.tier}
                                    </span>
                                    <span className="text-[11px] font-extrabold text-white/[0.62]">
                                        {binder.found}/{binder.total}
                                    </span>
                                </div>
                                <p className="line-clamp-2 text-xs font-extrabold text-white">{binder.title}</p>
                            </Link>
                        );
                    })}
                </div>
            </StatsPanel>
        </>
    );
}
