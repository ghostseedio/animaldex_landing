"use client";

import type {MatchupHistoryItem} from "@/data/matchups-types";
import MatchupResultDetails, {toResultPresentation} from "@/app/[locale]/(authenticated)/app/matchups/_components/matchup-result-details";

function isBestOfThree(item: MatchupHistoryItem) {
    return item.challengeFormat === "best_of_3_v2";
}

function isComplete(item: MatchupHistoryItem) {
    return !isBestOfThree(item) || item.battleStatus === "completed";
}

function finalScore(item: MatchupHistoryItem) {
    if (!isBestOfThree(item) || !isComplete(item)) return null;
    if (item.roundsWonAttacker == null || item.roundsWonDefender == null) return null;
    return `${item.roundsWonAttacker}-${item.roundsWonDefender}`;
}

export default function MatchupResultDetailSheet({
    item,
    onClose
}: {
    item: MatchupHistoryItem;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
            <button type="button" aria-label="Close result" className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" onClick={onClose} />
            <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[#101010] p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">Matchup result</p>
                        <h3 className="mt-1 font-display text-2xl font-bold text-white">{item.scenarioTitle ?? "Scenario Arena"}</h3>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${!isComplete(item) || item.viewerWon ? "bg-primary-400 text-black" : "bg-rose-400/15 text-rose-200"}`}>
                        {!isComplete(item) ? "Live" : item.viewerWon ? "Won" : "Lost"}
                    </span>
                </div>

                <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="text-center">
                        <img src={item.attackerImageSrc} alt="" className="mx-auto h-16 w-16 rounded-xl object-cover" />
                        <p className="mt-2 text-xs font-bold text-white">{item.attackerAnimalName}</p>
                    </div>
                    <span className="text-xs font-black text-white/35">VS</span>
                    <div className="text-center">
                        <img src={item.defenderImageSrc} alt="" className="mx-auto h-16 w-16 rounded-xl object-cover" />
                        <p className="mt-2 text-xs font-bold text-white">{item.defenderAnimalName}</p>
                    </div>
                </div>

                <div className="mt-5">
                    <MatchupResultDetails
                        showStatBars={false}
                        result={toResultPresentation({
                            scenarioTitle: item.scenarioTitle ?? "Scenario Arena",
                            scenarioDomain: item.scenarioDomain,
                            scenarioFamily: item.scenarioFamily,
                            scenarioDescription: item.scenarioDescription,
                            chosenStat: item.chosenStat ?? "dominance",
                            decidingEdgeLabel: item.decidingEdgeLabel,
                            winnerExplanation: item.winnerExplanation,
                            strategicInsight: item.strategicInsight,
                            resolutionRule: item.resolutionRule,
                            pointsAwarded: item.pointsAwarded,
                            rewarded: item.rewarded,
                            stakeAmount: item.stakeAmount,
                            escrowAmount: item.escrowAmount,
                            payoutAmount: item.payoutAmount,
                            burnAmount: item.burnAmount,
                            attackerContextScore: item.attackerContextScore,
                            defenderContextScore: item.defenderContextScore,
                            attackerStatValue: item.attackerStatValue,
                            defenderStatValue: item.defenderStatValue,
                            viewerWon: item.viewerWon,
                            creditsDelta: item.creditsDelta,
                            challengeFormat: item.challengeFormat,
                            battleStatus: item.battleStatus,
                            requiredVotes: item.requiredVotes,
                            votesCount: item.votesCount,
                            settlementReason: item.settlementReason,
                            finalScore: finalScore(item)
                        })}
                    />
                </div>
            </div>
        </div>
    );
}
