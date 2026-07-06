"use client";

import Link from "@/app/[locale]/_components/link";
import MatchupResultDetails, {toResultPresentation} from "@/app/[locale]/(authenticated)/app/matchups/_components/matchup-result-details";
import type {MatchupOpponent, MatchupResolveResult, MatchupRosterCapture} from "@/data/matchups-types";

export default function ResultStep({
    result,
    opponent,
    attacker,
    viewerUserId,
    onFindAnother,
    onViewHistory
}: {
    result: MatchupResolveResult;
    opponent: MatchupOpponent;
    attacker: MatchupRosterCapture;
    viewerUserId: string;
    onFindAnother: () => void;
    onViewHistory: () => void;
}) {
    const viewerWon = result.winnerUserId === viewerUserId;
    const winnerName = result.winnerCaptureId === attacker.captureId ? attacker.animalName : opponent.animalName;
    const creditsDelta = viewerWon ? result.payoutAmount - result.stakeAmount : -result.stakeAmount;

    return (
        <div className="space-y-5">
            <div className={`rounded-[1.25rem] border px-4 py-4 ${viewerWon ? "border-primary-400/35 bg-primary-400/10" : "border-rose-400/25 bg-rose-400/10"}`}>
                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">Outcome</p>
                <p className="mt-2 font-display text-3xl font-bold text-white">{viewerWon ? "You won" : "You lost"}</p>
                <p className="mt-1 text-sm text-white/55">{winnerName} won the scenario.</p>
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
                    defenderStats: opponent.gameStats
                })}
            />

            <div className="flex flex-wrap gap-2">
                <Link
                    href={`/app/capture/${result.winnerCaptureId}`}
                    className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white transition hover:border-white/20"
                >
                    View capture
                </Link>
                <button type="button" onClick={onFindAnother} className="rounded-2xl bg-primary-400 px-4 py-3 text-sm font-black text-black">
                    Find another matchup
                </button>
                <button type="button" onClick={onViewHistory} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white/70">
                    View history
                </button>
            </div>
        </div>
    );
}
