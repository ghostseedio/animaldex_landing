"use client";

import {useEffect, useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import ChallengeHearts from "@/app/[locale]/(authenticated)/app/matchups/_components/challenge-hearts";
import MatchupResultDetails, {toResultPresentation} from "@/app/[locale]/(authenticated)/app/matchups/_components/matchup-result-details";
import RewardShowcaseOverlay, {type RewardShowcaseItem} from "@/app/[locale]/(authenticated)/app/matchups/_components/reward-showcase-overlay";
import SpeciesComparisonSheet from "@/app/[locale]/(authenticated)/app/matchups/_components/species-comparison-sheet";
import type {MatchupOpponent, MatchupResolveResult, MatchupRosterCapture} from "@/data/matchups-types";
import {isAnimalSurvivalScenario} from "@/lib/matchup-result-copy";
import {playRewardCredits, playRewardPoints} from "@/lib/matchup-sounds";

const MAX_HEARTS = 3;

function clampHealth(value: number) {
    return Math.max(0, Math.min(MAX_HEARTS, value));
}

function SideCard({
    title,
    name,
    imageSrc,
    power,
    health,
    isWinner,
    isLoser
}: {
    title: string;
    name: string;
    imageSrc: string;
    power: number;
    health: number;
    isWinner: boolean;
    isLoser: boolean;
}) {
    return (
        <div className={`rounded-[1.15rem] border px-3.5 py-3.5 ${isWinner ? "border-primary-400/35 bg-primary-400/10" : "border-white/10 bg-white/[0.03]"}`}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-white/35">{title}</p>
                {isWinner ? (
                    <span className="rounded-full bg-primary-400/15 px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.12em] text-primary-200">
                        Edge
                    </span>
                ) : null}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc} alt="" className="mt-3 aspect-[4/3] w-full rounded-xl object-cover" />
            <p className="mt-2.5 line-clamp-2 text-sm font-bold text-white">{name}</p>
            <p className="mt-1 text-[0.68rem] font-black uppercase tracking-[0.1em] text-white/40">Power {power}</p>
            <div className={`mt-2.5 ${isLoser && health === 0 ? "text-orange-300" : ""}`}>
                <ChallengeHearts challengeHealth={health} maxHealth={MAX_HEARTS} size="sm" />
            </div>
        </div>
    );
}

export default function ResultStep({
    result,
    opponent,
    attacker,
    viewerUserId,
    attackerHealth,
    opponentHealth,
    baselineAttackerHealth,
    baselineOpponentHealth,
    rematchEnabled,
    rematchSubtitle,
    isRematching,
    onRematch,
    onFindAnother,
    onViewHistory
}: {
    result: MatchupResolveResult;
    opponent: MatchupOpponent;
    attacker: MatchupRosterCapture;
    viewerUserId: string;
    attackerHealth: number;
    opponentHealth: number;
    baselineAttackerHealth: number;
    baselineOpponentHealth: number;
    rematchEnabled: boolean;
    rematchSubtitle: string | null;
    isRematching: boolean;
    onRematch: () => void;
    onFindAnother: () => void;
    onViewHistory: () => void;
}) {
    const viewerWon = result.winnerUserId === viewerUserId;
    const attackerWon = result.winnerCaptureId === attacker.captureId;
    const winnerName = attackerWon ? attacker.animalName : opponent.animalName;
    const creditsDelta = viewerWon ? result.payoutAmount - result.stakeAmount : -result.stakeAmount;
    const loserHealth = attackerWon ? opponentHealth : attackerHealth;
    const baselineLoserHealth = attackerWon ? baselineOpponentHealth : baselineAttackerHealth;
    const damageTaken = Math.max(0, clampHealth(baselineLoserHealth) - loserHealth);
    const survival = isAnimalSurvivalScenario(result.scenarioDomain);
    const stakeLabel = `${opponent.challengeStake} credit${opponent.challengeStake === 1 ? "" : "s"}`;
    const [comparisonOpen, setComparisonOpen] = useState(false);
    const [showcaseItem, setShowcaseItem] = useState<RewardShowcaseItem | null>(null);
    const [showcaseVisible, setShowcaseVisible] = useState(false);

    const canOpenComparison = Boolean(attacker.speciesSlug && opponent.speciesSlug);

    const rewardItems = useMemo(() => {
        if (!viewerWon) return [] as RewardShowcaseItem[];
        const items: RewardShowcaseItem[] = [];
        if (result.pointsAwarded > 0) {
            items.push({
                id: "points",
                title: "Points earned",
                totalValueText: `+${result.pointsAwarded}`,
                subtitle: "Competitive score boosted",
                accent: "points"
            });
        }
        if (result.payoutAmount > 0) {
            items.push({
                id: "credits",
                title: "Credits won",
                totalValueText: `+${result.payoutAmount}`,
                subtitle: "Paid from the escrow pot",
                accent: "credits"
            });
        }
        return items;
    }, [result.payoutAmount, result.pointsAwarded, viewerWon]);

    useEffect(() => {
        if (!rewardItems.length) return;

        let cancelled = false;
        const timers: number[] = [];

        const run = async () => {
            await new Promise((resolve) => {
                timers.push(window.setTimeout(resolve, 480));
            });
            for (const item of rewardItems) {
                if (cancelled) return;
                setShowcaseItem(item);
                setShowcaseVisible(true);
                if (item.accent === "points") playRewardPoints();
                else playRewardCredits();
                await new Promise((resolve) => {
                    timers.push(window.setTimeout(resolve, 1400));
                });
                if (cancelled) return;
                setShowcaseVisible(false);
                await new Promise((resolve) => {
                    timers.push(window.setTimeout(resolve, 280));
                });
            }
            if (!cancelled) setShowcaseItem(null);
        };

        void run();
        return () => {
            cancelled = true;
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [rewardItems, result.id]);

    return (
        <div className="relative space-y-5">
            {showcaseItem ? (
                <RewardShowcaseOverlay item={showcaseItem} visible={showcaseVisible} />
            ) : null}

            <div className={`relative overflow-hidden rounded-[1.35rem] border px-4 py-5 ${viewerWon ? "border-primary-400/35 bg-primary-400/10" : "border-rose-400/25 bg-rose-400/10"}`}>
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(163,230,53,0.16),transparent_55%)]" />
                <p className="relative text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/40">
                    {survival ? "Best adapted" : "Scenario fit resolved"}
                </p>
                <p className="relative mt-2 font-display text-3xl font-bold text-white">
                    {viewerWon ? "You won" : "You lost"}
                </p>
                <p className="relative mt-1 text-sm text-white/55">{winnerName} won the scenario.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <SideCard
                    title="Your animal"
                    name={attacker.animalName}
                    imageSrc={attacker.imageSrc}
                    power={result.attackerBattlePower}
                    health={attackerHealth}
                    isWinner={attackerWon}
                    isLoser={!attackerWon}
                />
                <SideCard
                    title="Opponent"
                    name={opponent.animalName}
                    imageSrc={opponent.imageSrc}
                    power={result.defenderBattlePower}
                    health={opponentHealth}
                    isWinner={!attackerWon}
                    isLoser={attackerWon}
                />
            </div>

            <MatchupResultDetails
                result={toResultPresentation({
                    scenarioTitle: result.scenarioTitle,
                    scenarioDomain: result.scenarioDomain,
                    scenarioFamily: result.scenarioFamily,
                    scenarioDescription: result.scenarioDescription,
                    chosenStat: result.chosenStat,
                    decidingEdgeLabel: result.decidingEdgeLabel,
                    winnerExplanation: result.winnerExplanation,
                    strategicInsight: result.strategicInsight,
                    resolutionRule: result.resolutionRule,
                    pointsAwarded: result.pointsAwarded,
                    rewarded: result.rewarded,
                    stakeAmount: result.stakeAmount,
                    escrowAmount: result.escrowAmount,
                    payoutAmount: result.payoutAmount,
                    burnAmount: result.burnAmount,
                    attackerContextScore: result.attackerContextScore,
                    defenderContextScore: result.defenderContextScore,
                    attackerStatValue: result.attackerStatValue,
                    defenderStatValue: result.defenderStatValue,
                    viewerWon,
                    creditsDelta,
                    attackerStats: attacker.gameStats,
                    defenderStats: opponent.gameStats,
                    damageTaken,
                    loserRemainingHearts: loserHealth,
                    maxHearts: MAX_HEARTS
                })}
            />

            {canOpenComparison ? (
                <button
                    type="button"
                    onClick={() => setComparisonOpen(true)}
                    className="flex w-full items-center justify-between gap-3 rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition hover:border-primary-400/30"
                >
                    <div>
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-primary-200">Species comparison</p>
                        <p className="mt-1 text-sm font-bold text-white">
                            {attacker.animalName} vs {opponent.animalName}
                        </p>
                        <p className="mt-1 text-xs text-white/45">Open the full evergreen breakdown.</p>
                    </div>
                    <span className="text-xs font-black text-white/35">Open</span>
                </button>
            ) : null}

            <div className="space-y-2">
                <button
                    type="button"
                    disabled={!rematchEnabled || isRematching}
                    onClick={onRematch}
                    className={`w-full rounded-2xl px-4 py-3 text-sm font-black transition ${rematchEnabled && !isRematching ? "bg-primary-400 text-black" : "cursor-not-allowed bg-white/5 text-white/30"}`}
                >
                    {isRematching ? "Running rematch..." : `Rematch for ${stakeLabel}`}
                </button>
                {rematchSubtitle ? (
                    <p className="text-xs leading-5 text-white/40">{rematchSubtitle}</p>
                ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
                <Link
                    href={`/app/capture/${result.winnerCaptureId}`}
                    className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white transition hover:border-white/20"
                >
                    View capture
                </Link>
                <button type="button" onClick={onFindAnother} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white/70">
                    Done
                </button>
                <button type="button" onClick={onViewHistory} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white/70">
                    View history
                </button>
            </div>

            {comparisonOpen && canOpenComparison ? (
                <SpeciesComparisonSheet
                    animalASlug={attacker.speciesSlug}
                    animalBSlug={opponent.speciesSlug}
                    animalAFallbackName={attacker.animalName}
                    animalBFallbackName={opponent.animalName}
                    onClose={() => setComparisonOpen(false)}
                />
            ) : null}
        </div>
    );
}
