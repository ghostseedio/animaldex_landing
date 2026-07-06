"use client";

import {useState} from "react";
import MatchupStatBars from "@/app/[locale]/(authenticated)/app/matchups/_components/matchup-stat-bars";
import type {MatchupGameStats} from "@/lib/matchup-stats";
import {
    formatScenarioDomainLabel,
    formatScenarioFamilyLabel,
    insightTitle,
    isAnimalSurvivalScenario,
    normalizeResolutionRule,
    payoutSummaryText,
    pointsRewardLabel,
    resolutionOutcomeFootnote,
    resolutionRevealSubtitle,
    scenarioScoreTitle
} from "@/lib/matchup-result-copy";

export type MatchupResultPresentation = {
    scenarioTitle: string;
    scenarioDomain: string | null;
    scenarioFamily: string | null;
    scenarioDescription: string | null;
    chosenStat: string;
    decidingEdgeLabel: string | null;
    winnerExplanation: string | null;
    strategicInsight: string | null;
    resolutionRule: string | null;
    pointsAwarded: number;
    rewarded: boolean;
    stakeAmount: number;
    escrowAmount: number;
    payoutAmount: number;
    burnAmount: number;
    attackerContextScore: number | null;
    defenderContextScore: number | null;
    attackerStatValue?: number | null;
    defenderStatValue?: number | null;
    viewerWon: boolean;
    creditsDelta: number;
    attackerStats?: MatchupGameStats;
    defenderStats?: MatchupGameStats;
    attackerLabel?: string;
    defenderLabel?: string;
};

function Metric({label, value, accent}: {label: string; value: string | number; accent?: "green" | "rose" | "neutral"}) {
    const tone = accent === "green"
        ? "text-primary-200"
        : accent === "rose"
            ? "text-rose-300"
            : "text-white";

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/35">{label}</p>
            <p className={`mt-1 text-sm font-bold ${tone}`}>{value}</p>
        </div>
    );
}

function MicroPill({children, tone = "neutral"}: {children: React.ReactNode; tone?: "green" | "cyan" | "violet" | "neutral"}) {
    const tones = {
        green: "bg-primary-400/10 text-primary-200",
        cyan: "bg-cyan-400/10 text-cyan-200",
        violet: "bg-violet-400/10 text-violet-200",
        neutral: "bg-white/5 text-white/55"
    };
    return (
        <span className={`rounded-full px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] ${tones[tone]}`}>
            {children}
        </span>
    );
}

export default function MatchupResultDetails({
    result,
    showStatBars = true,
    showMatchDetails = true
}: {
    result: MatchupResultPresentation;
    showStatBars?: boolean;
    showMatchDetails?: boolean;
}) {
    const [detailsOpen, setDetailsOpen] = useState(false);
    const resolutionRule = normalizeResolutionRule(result.resolutionRule);
    const familyLabel = formatScenarioFamilyLabel(result.scenarioFamily);
    const domainLabel = formatScenarioDomainLabel(result.scenarioDomain);
    const survival = isAnimalSurvivalScenario(result.scenarioDomain);
    const footnote = resolutionOutcomeFootnote({
        resolutionRule,
        scenarioDomain: result.scenarioDomain
    });
    const subtitle = resolutionRevealSubtitle({
        resolutionRule,
        decidingEdgeLabel: result.decidingEdgeLabel,
        scenarioDomain: result.scenarioDomain
    });
    const attackerContext = result.attackerContextScore ?? result.attackerStatValue ?? 0;
    const defenderContext = result.defenderContextScore ?? result.defenderStatValue ?? 0;

    return (
        <div className="space-y-5">
            <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                    {familyLabel ? <MicroPill tone="cyan">{familyLabel}</MicroPill> : null}
                    {domainLabel ? <MicroPill tone={survival ? "green" : "violet"}>{domainLabel}</MicroPill> : null}
                    {result.decidingEdgeLabel ? <MicroPill tone="green">{result.decidingEdgeLabel}</MicroPill> : null}
                </div>

                <div>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-primary-200">
                        {survival ? "Survival scenario" : "Scenario"}
                    </p>
                    <h3 className="mt-2 font-display text-2xl font-bold text-white">{result.scenarioTitle}</h3>
                    <p className="mt-2 text-sm text-white/45">{subtitle}</p>
                    {result.scenarioDescription ? (
                        <p className="mt-3 text-sm leading-6 text-white/55">{result.scenarioDescription}</p>
                    ) : null}
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                    label={scenarioScoreTitle(result.scenarioDomain)}
                    value={`${attackerContext} vs ${defenderContext}`}
                />
                <Metric
                    label="Credits"
                    value={`${result.creditsDelta >= 0 ? "+" : ""}${result.creditsDelta}`}
                    accent={result.creditsDelta >= 0 ? "green" : "rose"}
                />
                <Metric label="Pot paid" value={result.payoutAmount} />
                <Metric label="Points" value={pointsRewardLabel(result.pointsAwarded, result.rewarded)} />
            </div>

            {showStatBars && result.attackerStats && result.defenderStats ? (
                <MatchupStatBars
                    attackerLabel={result.attackerLabel ?? "You"}
                    defenderLabel={result.defenderLabel ?? "Them"}
                    attackerStats={result.attackerStats}
                    defenderStats={result.defenderStats}
                    highlightStat={result.chosenStat}
                />
            ) : null}

            {result.winnerExplanation ? (
                <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/35">Why it won</p>
                    <p className="mt-2 text-sm leading-6 text-white/65">{result.winnerExplanation}</p>
                </div>
            ) : null}

            {result.strategicInsight ? (
                <div className="rounded-[1.15rem] border border-violet-400/20 bg-violet-400/5 p-4">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-violet-200">
                        {insightTitle(result.scenarioDomain)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/65">{result.strategicInsight}</p>
                </div>
            ) : null}

            {showMatchDetails ? (
                <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03]">
                    <button
                        type="button"
                        onClick={() => setDetailsOpen((open) => !open)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                    >
                        <span className="text-sm font-black text-white">Match details</span>
                        <span className="text-xs font-bold text-white/35">{detailsOpen ? "Hide" : "Show"}</span>
                    </button>
                    {detailsOpen ? (
                        <div className="space-y-2 border-t border-white/10 px-4 py-4 text-sm">
                            <DetailRow label="Matched confidence" value={`${result.stakeAmount} credits`} />
                            <DetailRow label="Total pot" value={`${result.escrowAmount || result.stakeAmount * 2} credits`} />
                            <DetailRow
                                label={survival ? "Best adapted payout" : "Best-fit payout"}
                                value={`${result.payoutAmount} credits`}
                            />
                            <DetailRow label="Burned" value={`${result.burnAmount} credit${result.burnAmount === 1 ? "" : "s"}`} />
                            <DetailRow label="Deciding stat" value={result.decidingEdgeLabel ?? result.chosenStat} />
                        </div>
                    ) : null}
                </div>
            ) : null}

            <p className="text-sm leading-6 text-white/45">
                {payoutSummaryText({
                    scenarioDomain: result.scenarioDomain,
                    payoutAmount: result.payoutAmount,
                    escrowAmount: result.escrowAmount || result.stakeAmount * 2
                })}
            </p>

            {footnote ? <p className="text-xs leading-5 text-white/35">{footnote}</p> : null}
        </div>
    );
}

function DetailRow({label, value}: {label: string; value: string}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-white/45">{label}</span>
            <span className="font-bold text-white">{value}</span>
        </div>
    );
}

export function toResultPresentation(input: {
    scenarioTitle: string;
    scenarioDomain: string | null;
    scenarioFamily?: string | null;
    scenarioDescription: string | null;
    chosenStat: string;
    decidingEdgeLabel: string | null;
    winnerExplanation: string | null;
    strategicInsight: string | null;
    resolutionRule?: string | null;
    pointsAwarded?: number;
    rewarded?: boolean;
    stakeAmount: number;
    escrowAmount?: number;
    payoutAmount: number;
    burnAmount: number;
    attackerContextScore?: number | null;
    defenderContextScore?: number | null;
    attackerStatValue?: number | null;
    defenderStatValue?: number | null;
    viewerWon: boolean;
    creditsDelta: number;
    attackerStats?: MatchupGameStats;
    defenderStats?: MatchupGameStats;
    attackerLabel?: string;
    defenderLabel?: string;
}): MatchupResultPresentation {
    return {
        scenarioTitle: input.scenarioTitle,
        scenarioDomain: input.scenarioDomain,
        scenarioFamily: input.scenarioFamily ?? null,
        scenarioDescription: input.scenarioDescription,
        chosenStat: input.chosenStat,
        decidingEdgeLabel: input.decidingEdgeLabel,
        winnerExplanation: input.winnerExplanation,
        strategicInsight: input.strategicInsight,
        resolutionRule: input.resolutionRule ?? null,
        pointsAwarded: input.pointsAwarded ?? 0,
        rewarded: input.rewarded ?? false,
        stakeAmount: input.stakeAmount,
        escrowAmount: input.escrowAmount ?? input.stakeAmount * 2,
        payoutAmount: input.payoutAmount,
        burnAmount: input.burnAmount,
        attackerContextScore: input.attackerContextScore ?? null,
        defenderContextScore: input.defenderContextScore ?? null,
        attackerStatValue: input.attackerStatValue ?? null,
        defenderStatValue: input.defenderStatValue ?? null,
        viewerWon: input.viewerWon,
        creditsDelta: input.creditsDelta,
        attackerStats: input.attackerStats,
        defenderStats: input.defenderStats,
        attackerLabel: input.attackerLabel,
        defenderLabel: input.defenderLabel
    };
}
