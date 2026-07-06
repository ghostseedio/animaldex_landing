"use client";

import type {MatchupOpponent, MatchupRosterCapture} from "@/data/matchups-types";
import ChallengeHearts from "@/app/[locale]/(authenticated)/app/matchups/_components/challenge-hearts";
import {allowsMatchup, tierRank} from "@/lib/matchup-stats";

function eligibilityReason(capture: MatchupRosterCapture, opponent: MatchupOpponent) {
    if (capture.challengeHealth <= 0) return "Out of hearts";
    if (!capture.isChallengeReady) return "Not challenge-ready";
    if (!capture.isDiscoverable) return "Not public";
    if (!allowsMatchup(capture.battleTier, opponent.battleTier)) return "Tier mismatch";
    if (capture.challengeStake < opponent.challengeStake) return `Need ${opponent.challengeStake} credits`;
    return null;
}

export default function PickAnimalStep({
    opponent,
    roster,
    selectedCaptureId,
    onSelect
}: {
    opponent: MatchupOpponent;
    roster: MatchupRosterCapture[];
    selectedCaptureId: string | null;
    onSelect: (captureId: string) => void;
}) {
    const ranked = [...roster].sort((left, right) => {
        const leftEligible = !eligibilityReason(left, opponent);
        const rightEligible = !eligibilityReason(right, opponent);
        if (leftEligible !== rightEligible) return leftEligible ? -1 : 1;

        const leftDelta = Math.abs(tierRank(left.battleTier) - tierRank(opponent.battleTier));
        const rightDelta = Math.abs(tierRank(right.battleTier) - tierRank(opponent.battleTier));
        if (leftDelta !== rightDelta) return leftDelta - rightDelta;

        const leftPowerDelta = Math.abs(left.battlePower - opponent.battlePower);
        const rightPowerDelta = Math.abs(right.battlePower - opponent.battlePower);
        if (leftPowerDelta !== rightPowerDelta) return leftPowerDelta - rightPowerDelta;

        return right.challengeHealth - left.challengeHealth;
    });

    const eligible = ranked.filter((capture) => !eligibilityReason(capture, opponent));
    const blocked = ranked.filter((capture) => eligibilityReason(capture, opponent));

    return (
        <div className="space-y-5">
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">Opponent</p>
                <div className="mt-3 flex items-center gap-3">
                    <img src={opponent.imageSrc} alt="" className="h-16 w-16 rounded-2xl border border-white/10 object-cover" />
                    <div>
                        <p className="font-display text-xl font-bold text-white">{opponent.animalName}</p>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/45">
                            <span>Tier {opponent.battleTier}</span>
                            <span aria-hidden="true">·</span>
                            <span>Guarding {opponent.challengeStake} credits</span>
                            <span aria-hidden="true">·</span>
                            <ChallengeHearts challengeHealth={opponent.challengeHealth} />
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <p className="text-sm font-black text-white">Pick your animal</p>
                {eligible.length ? eligible.map((capture) => {
                    const selected = selectedCaptureId === capture.captureId;
                    return (
                        <button
                            key={capture.captureId}
                            type="button"
                            onClick={() => onSelect(capture.captureId)}
                            className={`flex w-full items-center gap-3 rounded-[1.15rem] border px-3 py-3 text-left transition ${selected ? "border-primary-400 bg-primary-400/10" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}
                        >
                            <img src={capture.imageSrc} alt="" className="h-14 w-14 rounded-xl object-cover" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-display text-lg font-bold text-white">{capture.animalName}</p>
                                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/45">
                                    <span>Tier {capture.battleTier}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>Lvl {capture.level}</span>
                                    <span aria-hidden="true">·</span>
                                    <ChallengeHearts challengeHealth={capture.challengeHealth} />
                                    <span aria-hidden="true">·</span>
                                    <span>{capture.challengeStake} credits</span>
                                </p>
                            </div>
                            {selected ? <span className="text-xs font-black text-primary-300">Selected</span> : null}
                        </button>
                    );
                }) : (
                    <p className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/45">
                        No eligible challengers are ready for this matchup. Make an animal public, challenge-ready, and stocked with enough credits.
                    </p>
                )}
            </div>

            {blocked.length ? (
                <details className="rounded-[1.15rem] border border-white/10 bg-white/[0.02] px-4 py-3">
                    <summary className="cursor-pointer text-sm font-bold text-white/45">
                        {blocked.length} unavailable animal{blocked.length === 1 ? "" : "s"}
                    </summary>
                    <div className="mt-3 space-y-2">
                        {blocked.map((capture) => (
                            <div key={capture.captureId} className="flex items-center justify-between gap-3 text-sm text-white/35">
                                <span className="truncate">{capture.animalName}</span>
                                <span className="shrink-0 text-xs">{eligibilityReason(capture, opponent)}</span>
                            </div>
                        ))}
                    </div>
                </details>
            ) : null}
        </div>
    );
}
