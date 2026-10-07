"use client";

import {useEffect, useMemo, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {useAppCredits} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import {AppPage, AppSegmentedControl} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import TrainBackLink from "@/app/[locale]/(authenticated)/app/train/train-back-link";
import ChallengeWizardSheet from "@/app/[locale]/(authenticated)/app/matchups/_components/challenge-wizard-sheet";
import ChallengeSettingsSheet from "@/app/[locale]/(authenticated)/app/matchups/_components/challenge-settings-sheet";
import MatchupsArenaTab from "@/app/[locale]/(authenticated)/app/matchups/_components/matchups-arena-tab";
import MatchupsHistoryTab from "@/app/[locale]/(authenticated)/app/matchups/_components/matchups-history-tab";
import {ArenaTrialsTab, TrialHistoryList, TrialStatsRow, useArenaTrials} from "@/app/[locale]/(authenticated)/app/matchups/_components/arena-trials";
import type {MatchupHistoryItem, MatchupOpponent, MatchupResolveResult, MatchupRosterCapture} from "@/data/matchups-types";
import type {SpeciesComparisonSummary} from "@/data/species-comparisons";
import {isOverallDraw} from "@/lib/matchup-battle-rules";

/** Trials, then Comparisons, then the history of whichever was last open. */
type Segment = "trials" | "arena" | "history";
/**
 * Which history the History segment is showing. Set by the last live segment
 * the person opened, and by the chips on the history page itself.
 */
type HistorySubject = "trials" | "comparisons";

export default function MatchupsHub({
    locale,
    viewerUserId,
    initialArena,
    initialRoster,
    initialHistory,
    initialPopularBreakdowns,
    initialTargetId
}: {
    locale: string;
    viewerUserId: string;
    initialArena: MatchupOpponent[];
    initialRoster: MatchupRosterCapture[];
    initialHistory: MatchupHistoryItem[];
    initialPopularBreakdowns: SpeciesComparisonSummary[];
    initialTargetId: string | null;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const {applyDelta} = useAppCredits();
    const [segment, setSegment] = useState<Segment>("trials");
    const [historySubject, setHistorySubject] = useState<HistorySubject>("trials");
    const trials = useArenaTrials(true);
    const [arena, setArena] = useState(initialArena);
    const [history, setHistory] = useState(initialHistory);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [activeOpponent, setActiveOpponent] = useState<MatchupOpponent | null>(null);
    const [targetError, setTargetError] = useState<string | null>(null);

    const roster = useMemo(() => initialRoster, [initialRoster]);

    useEffect(() => {
        if (!initialTargetId) return;
        const opponent = arena.find((item) => item.captureId === initialTargetId);
        if (opponent) {
            setActiveOpponent(opponent);
            setTargetError(null);
            return;
        }
        setTargetError("That matchup target is no longer available.");
    }, [arena, initialTargetId]);

    function clearTargetParam() {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("target");
        const next = params.toString();
        router.replace(next ? `/app/matchups?${next}` : "/app/matchups");
    }

    function handleChallenge(opponent: MatchupOpponent) {
        setActiveOpponent(opponent);
        setTargetError(null);
    }

    function handleComplete(result: MatchupResolveResult) {
        const battleComplete = result.challengeFormat !== "best_of_3_v2" || result.battleStatus === "completed";
        const battleDrawn = isOverallDraw(result);
        const viewerWon = !battleDrawn && battleComplete && result.winnerUserId === viewerUserId;
        // A draw refunds both stakes, so the viewer's balance does not move.
        const creditsDelta = battleDrawn
            ? 0
            : viewerWon ? result.payoutAmount - result.stakeAmount : -result.stakeAmount;
        applyDelta(creditsDelta);

        setHistory((current) => {
            const next: MatchupHistoryItem = {
                id: result.id,
                date: result.createdAt,
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
                attackerCaptureId: result.attackerCaptureId,
                defenderCaptureId: result.defenderCaptureId,
                attackerAnimalName: roster.find((item) => item.captureId === result.attackerCaptureId)?.animalName ?? "You",
                defenderAnimalName: activeOpponent?.animalName ?? arena.find((item) => item.captureId === result.defenderCaptureId)?.animalName ?? "Opponent",
                attackerImageSrc: roster.find((item) => item.captureId === result.attackerCaptureId)?.imageSrc ?? "",
                defenderImageSrc: activeOpponent?.imageSrc ?? arena.find((item) => item.captureId === result.defenderCaptureId)?.imageSrc ?? "",
                attackerUserId: viewerUserId,
                defenderUserId: activeOpponent?.ownerUserId ?? "",
                winnerCaptureId: result.winnerCaptureId,
                winnerUserId: result.winnerUserId,
                stakeAmount: result.stakeAmount,
                escrowAmount: result.escrowAmount,
                payoutAmount: result.payoutAmount,
                burnAmount: result.burnAmount,
                attackerStatValue: result.attackerStatValue,
                defenderStatValue: result.defenderStatValue,
                attackerContextScore: result.attackerContextScore,
                defenderContextScore: result.defenderContextScore,
                viewerWasAttacker: true,
                viewerWon,
                creditsDelta,
                challengeFormat: result.challengeFormat,
                battleStatus: result.battleStatus,
                requiredVotes: result.requiredVotes,
                votesCount: result.votesCount,
                round1WinnerCaptureId: result.round1WinnerCaptureId,
                round2WinnerCaptureId: result.round2WinnerCaptureId,
                round3WinnerCaptureId: result.round3WinnerCaptureId,
                overallWinnerCaptureId: result.overallWinnerCaptureId,
                roundsWonAttacker: result.roundsWonAttacker,
                roundsWonDefender: result.roundsWonDefender,
                speciesComparisonSlug: result.speciesComparisonSlug,
                viewerVotedCaptureId: result.viewerVotedCaptureId,
                votingDeadlineAt: result.votingDeadlineAt,
                settlementReason: result.settlementReason,
                round2Draw: result.round2Draw,
                overallDraw: result.overallDraw,
                viewerDrew: battleDrawn
            };
            return [next, ...current.filter((item) => item.id !== next.id)];
        });
        setArena((current) => current.filter((item) => item.captureId !== result.defenderCaptureId));
    }

    function selectSegment(next: Segment) {
        setSegment(next);
        if (next === "trials") setHistorySubject("trials");
        if (next === "arena") setHistorySubject("comparisons");
        if (next === "history") void trials.refresh();
    }

    const showsComparisonFigures = segment === "arena" || (segment === "history" && historySubject === "comparisons");
    const winCount = history.filter((item) => item.viewerWon && (item.challengeFormat !== "best_of_3_v2" || item.battleStatus === "completed")).length;
    const netCredits = history.reduce((total, item) => total + item.creditsDelta, 0);
    const netCreditsLabel = netCredits >= 0 ? `+${netCredits}` : `${netCredits}`;

    return (
        <AppPage>
            <div className="space-y-3">
                <TrainBackLink />
                <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                        <h1 className="font-display text-[28px] font-black leading-none text-white md:text-[34px]">
                            Play
                        </h1>
                        <p className="text-sm text-white/55 md:text-base">
                            {segment === "trials"
                                ? "Trials for the animals you've caught"
                                : segment === "arena"
                                    ? "Pick an animal to compare"
                                    : historySubject === "trials" ? "Your Trials, finished and failed" : "Your past comparisons"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        aria-label="Comparison settings"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white transition hover:border-white/20 hover:bg-white/[0.08]"
                    >
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                            <path d="M3.5 6.5h13M5.5 10h9M7.5 13.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                    </button>
                </header>
            </div>

            {segment === "history" ? (
                <div role="tablist" aria-label="Which history" className="flex gap-2">
                    {([
                        {id: "trials", label: "Trials"},
                        {id: "comparisons", label: "Comparisons"}
                    ] as Array<{id: HistorySubject; label: string}>).map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            role="tab"
                            aria-selected={historySubject === option.id}
                            onClick={() => setHistorySubject(option.id)}
                            className={`rounded-full border px-3.5 py-1.5 text-xs font-black transition ${historySubject === option.id ? "border-transparent bg-primary-400 text-black" : "border-white/10 bg-white/[0.03] text-white/70 hover:text-white"}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            ) : null}

            {showsComparisonFigures ? (
                <div className="grid grid-cols-3 gap-2.5">
                    {[
                        {label: "Ready", value: arena.length, accent: "bg-primary-400"},
                        {label: "Wins", value: winCount, accent: "bg-violet-400"},
                        {label: "Net credits", value: netCreditsLabel, accent: "bg-amber-400"}
                    ].map((metric) => (
                        <div key={metric.label} className="min-w-0 rounded-[18px] border border-white/[0.06] bg-white/[0.04] p-3">
                            <p className="truncate text-[0.62rem] font-black uppercase tracking-[0.08em] text-white/30">{metric.label}</p>
                            <p className="mt-1.5 truncate font-display text-xl font-black tabular-nums text-white">{metric.value}</p>
                            <div className={`mt-2 h-[3px] rounded-full ${metric.accent}`} />
                        </div>
                    ))}
                </div>
            ) : segment === "history" ? (
                <TrialStatsRow history={trials.history} />
            ) : null}

            <AppSegmentedControl
                value={segment}
                options={[
                    {id: "trials", label: "Trials"},
                    {id: "arena", label: "Comparisons"},
                    {id: "history", label: "History"}
                ]}
                onChange={selectSegment}
                fullWidth
            />

            {targetError ? (
                <div className="rounded-[1.15rem] border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                    {targetError}
                </div>
            ) : null}

            {segment === "trials" ? (
                <ArenaTrialsTab
                    openTrials={trials.openTrials}
                    didLoad={trials.didLoad}
                    onNote={trials.note}
                    onRefresh={trials.refresh}
                />
            ) : segment === "arena" ? (
                <MatchupsArenaTab
                    opponents={arena}
                    roster={roster}
                    popularBreakdowns={initialPopularBreakdowns}
                    onOpenSettings={() => setSettingsOpen(true)}
                    onChallenge={handleChallenge}
                />
            ) : historySubject === "trials" ? (
                <TrialHistoryList
                    history={trials.history}
                    postIds={trials.postIds}
                    didLoad={trials.didLoad}
                    onNote={trials.note}
                />
            ) : (
                <MatchupsHistoryTab history={history} locale={locale} />
            )}

            {settingsOpen ? (
                <ChallengeSettingsSheet roster={roster} onClose={() => setSettingsOpen(false)} />
            ) : null}

            {activeOpponent ? (
                <ChallengeWizardSheet
                    opponent={activeOpponent}
                    roster={roster}
                    viewerUserId={viewerUserId}
                    onClose={() => {
                        setActiveOpponent(null);
                        clearTargetParam();
                    }}
                    onComplete={handleComplete}
                    onViewHistory={() => {
                        setHistorySubject("comparisons");
                        setSegment("history");
                    }}
                />
            ) : null}
        </AppPage>
    );
}
