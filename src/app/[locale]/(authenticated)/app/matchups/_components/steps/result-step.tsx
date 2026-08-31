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

function isBestOfThree(result: MatchupResolveResult) {
    return result.challengeFormat === "best_of_3_v2";
}

function isBattleVoting(result: MatchupResolveResult) {
    return isBestOfThree(result) && result.battleStatus === "round_2_voting";
}

function isBattleComplete(result: MatchupResolveResult) {
    return !isBestOfThree(result) || result.battleStatus === "completed";
}

function finalScoreText(result: MatchupResolveResult) {
    if (!isBestOfThree(result) || !isBattleComplete(result)) return null;
    if (result.roundsWonAttacker == null || result.roundsWonDefender == null) return null;
    return `${result.roundsWonAttacker}-${result.roundsWonDefender}`;
}

function voteTimeRemaining(deadline: string | null) {
    if (!deadline) return null;
    const end = new Date(deadline).getTime();
    if (!Number.isFinite(end)) return null;
    const minutes = Math.max(0, Math.ceil((end - Date.now()) / 60000));
    if (minutes <= 0) return "Closing now";
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
    if (hours > 0) return `${hours}h ${remainder}m left`;
    return `${minutes}m left`;
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
    const battleComplete = isBattleComplete(result);
    const battleVoting = isBattleVoting(result);
    const battleFinalScore = finalScoreText(result);
    const creditsDelta = battleComplete
        ? viewerWon ? result.payoutAmount - result.stakeAmount : -result.stakeAmount
        : -result.stakeAmount;
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
        if (!battleComplete || !viewerWon) return [] as RewardShowcaseItem[];
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
    }, [battleComplete, result.payoutAmount, result.pointsAwarded, viewerWon]);

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

            <div className={`relative overflow-hidden rounded-[1.35rem] border px-4 py-5 ${!battleComplete || viewerWon ? "border-primary-400/35 bg-primary-400/10" : "border-rose-400/25 bg-rose-400/10"}`}>
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(163,230,53,0.16),transparent_55%)]" />
                <p className="relative text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/40">
                    {battleVoting ? "Round 1 of 3 resolved" : survival ? "Best adapted" : "Scenario fit resolved"}
                </p>
                <p className="relative mt-2 font-display text-3xl font-bold text-white">
                    {battleVoting ? "Community vote is next" : viewerWon ? "You won" : "You lost"}
                </p>
                <p className="relative mt-1 text-sm text-white/55">
                    {battleVoting
                        ? `${winnerName} won Round 1. The battle settles after Round 3.`
                        : `${winnerName} won the scenario.`}
                </p>
                {battleFinalScore ? <p className="relative mt-3 text-sm font-black text-primary-200">Final score {battleFinalScore}</p> : null}
            </div>

            {battleVoting ? (
                <div className="rounded-[1.15rem] border border-cyan-300/20 bg-cyan-300/[0.07] p-4">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-cyan-100">Round 2 of 3 - Community vote</p>
                    <p className="mt-2 font-display text-xl font-bold text-white">{result.votesCount} / {result.requiredVotes ?? 0} votes</p>
                    <p className="mt-1 text-sm leading-6 text-white/55">
                        Voting is live. If the target is not reached, the Round 1 winner takes the battle.
                    </p>
                    {voteTimeRemaining(result.votingDeadlineAt) ? (
                        <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-cyan-100">{voteTimeRemaining(result.votingDeadlineAt)} - No quorum means R1 wins</p>
                    ) : null}
                </div>
            ) : null}

            {isBestOfThree(result) && battleComplete && result.settlementReason === "voting_timeout_round1_fallback" ? (
                <div className="rounded-[1.15rem] border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm leading-6 text-amber-50/80">
                    Voting ended before the target was reached. The Round 1 winner takes the battle.
                </div>
            ) : null}

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
                    maxHearts: MAX_HEARTS,
                    challengeFormat: result.challengeFormat,
                    battleStatus: result.battleStatus,
                    requiredVotes: result.requiredVotes,
                    votesCount: result.votesCount,
                    settlementReason: result.settlementReason,
                    finalScore: battleFinalScore
                })}
            />

            {isBestOfThree(result) && battleComplete && result.settlementReason !== "voting_timeout_round1_fallback" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-primary-200">Round 2 of 3 - Community</p>
                        <p className="mt-2 text-sm font-bold text-white">
                            The community backed {(result.round2WinnerCaptureId === attacker.captureId ? attacker.animalName : opponent.animalName)}.
                        </p>
                    </div>
                    <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-primary-200">Round 3 of 3 - Species</p>
                        <p className="mt-2 text-sm font-bold text-white">
                            Species comparison favored {(result.round3WinnerCaptureId === attacker.captureId ? attacker.animalName : opponent.animalName)}.
                        </p>
                        {result.speciesComparisonSlug ? (
                            <Link href={`/challenges/${result.speciesComparisonSlug}`} className="mt-3 inline-flex text-xs font-black text-primary-200">
                                View species comparison
                            </Link>
                        ) : null}
                    </div>
                </div>
            ) : null}

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
                    disabled={!battleComplete || !rematchEnabled || isRematching}
                    onClick={onRematch}
                    className={`w-full rounded-2xl px-4 py-3 text-sm font-black transition ${battleComplete && rematchEnabled && !isRematching ? "bg-primary-400 text-black" : "cursor-not-allowed bg-white/5 text-white/30"}`}
                >
                    {battleComplete ? isRematching ? "Running rematch..." : `Rematch for ${stakeLabel}` : "Battle settling after Round 3"}
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
