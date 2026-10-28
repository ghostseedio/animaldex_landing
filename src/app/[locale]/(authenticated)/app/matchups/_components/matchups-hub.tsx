"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {useAppCredits} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import {AppPage} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import ChallengeWizardSheet from "@/app/[locale]/(authenticated)/app/matchups/_components/challenge-wizard-sheet";
import ChallengeSettingsSheet from "@/app/[locale]/(authenticated)/app/matchups/_components/challenge-settings-sheet";
import MatchupsArenaTab from "@/app/[locale]/(authenticated)/app/matchups/_components/matchups-arena-tab";
import MatchupsHistoryTab from "@/app/[locale]/(authenticated)/app/matchups/_components/matchups-history-tab";
import {TrialHistoryList, useArenaTrials} from "@/app/[locale]/(authenticated)/app/matchups/_components/arena-trials";
import {PlayPowersPage, PowerHistoryList} from "@/app/[locale]/(authenticated)/app/matchups/_components/play-powers-page";
import type {MatchupHistoryItem, MatchupOpponent, MatchupResolveResult, MatchupRosterCapture} from "@/data/matchups-types";
import type {SpeciesComparisonSummary} from "@/data/species-comparisons";
import {completedTrialHistory, failedTrialHistory, isComplete} from "@/lib/animal-trials";
import {isOverallDraw} from "@/lib/matchup-battle-rules";
import {
    EMPTY_PLAY_JOURNEY,
    type PlayJourneyCard,
    type PlayJourneyFused,
    type PlayJourneyStepFailure,
    type PlayPowerHistoryItem,
    buildPlayJourney,
    sortPowerHistory
} from "@/lib/play-journey";

/**
 * The Play tab — iOS `MatchupsHubView` embedded in `IdentityHomeView`. Three
 * pages: Powers (every caught animal by the Power Loop step it waits on),
 * Comparisons (the arena), and History (Powers, Trials or Comparisons, set by
 * the last live page opened and by the chips on the page itself).
 */
export type PlayHubSegment = "powers" | "comparisons" | "history";
type HistorySubject = "powers" | "trials" | "comparisons";

const SEGMENTS: Array<{id: PlayHubSegment; label: string}> = [
    {id: "powers", label: "Powers"},
    {id: "comparisons", label: "Comparisons"},
    {id: "history", label: "History"}
];

const HISTORY_SUBJECTS: Array<{id: HistorySubject; label: string}> = [
    {id: "powers", label: "Powers"},
    {id: "trials", label: "Trials"},
    {id: "comparisons", label: "Comparisons"}
];

const NEON = "#A7F432";
const VIOLET = "#8B5CF6";
const GOLD = "rgb(250,184,61)";
const FAIL = "rgb(250,115,133)";

type JourneyPayload = {
    loaded?: boolean;
    cards?: PlayJourneyCard[];
    trainedSpecies?: string[] | null;
    failures?: PlayJourneyStepFailure[] | null;
    fused?: PlayJourneyFused[] | null;
    earnedPowers?: Array<{speciesProfileId: string; speciesDisplayName: string; powerName: string; route: string | null; earnedAt: string | null}> | null;
    summary?: {wins: number; losses: number; netCredits: number};
};

/** iOS's two-figure strip over a history page. */
function StatsStrip({figures}: {figures: Array<{value: string | number; label: string; tint: string}>}) {
    return (
        <div className="flex items-center border border-white/[0.08] bg-[#141414] py-2">
            {figures.map((figure, index) => (
                <div key={figure.label} className="flex flex-1 items-center">
                    {index > 0 ? <span className="h-3.5 w-px bg-white/[0.08]" aria-hidden="true" /> : null}
                    <span className="flex flex-1 items-baseline justify-center gap-[5px]">
                        <span className="truncate text-sm font-black tabular-nums" style={{color: figure.tint}}>{figure.value}</span>
                        <span className="text-[9px] font-black uppercase text-white/40">{figure.label}</span>
                    </span>
                </div>
            ))}
        </div>
    );
}

export default function MatchupsHub({
    locale,
    viewerUserId,
    initialArena,
    initialRoster,
    initialHistory,
    initialPopularBreakdowns,
    initialTargetId,
    initialSegment = "powers"
}: {
    locale: string;
    viewerUserId: string;
    initialArena: MatchupOpponent[];
    initialRoster: MatchupRosterCapture[];
    initialHistory: MatchupHistoryItem[];
    initialPopularBreakdowns: SpeciesComparisonSummary[];
    initialTargetId: string | null;
    initialSegment?: PlayHubSegment;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const {applyDelta} = useAppCredits();
    // A target always opens on Comparisons, where its picker lives.
    const [segment, setSegment] = useState<PlayHubSegment>(initialTargetId ? "comparisons" : initialSegment);
    const [historySubject, setHistorySubject] = useState<HistorySubject>(initialTargetId || initialSegment === "comparisons" ? "comparisons" : "powers");
    const trials = useArenaTrials(true);
    const [arena, setArena] = useState(initialArena);
    const [history, setHistory] = useState(initialHistory);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [activeOpponent, setActiveOpponent] = useState<MatchupOpponent | null>(null);
    const [targetError, setTargetError] = useState<string | null>(null);
    const [journeyInputs, setJourneyInputs] = useState<{[K in keyof Omit<JourneyPayload, "loaded" | "summary">]-?: NonNullable<JourneyPayload[K]>}>({
        cards: [],
        trainedSpecies: [],
        failures: [],
        fused: [],
        earnedPowers: []
    });
    const [journeyLoaded, setJourneyLoaded] = useState(false);
    const [summary, setSummary] = useState<{wins: number; netCredits: number} | null>(null);

    const roster = useMemo(() => initialRoster, [initialRoster]);

    const refreshJourney = useCallback(async () => {
        try {
            const response = await fetch("/api/app/play-journey", {cache: "no-store"});
            if (!response.ok) return;
            const payload = await response.json() as JourneyPayload;
            // A failed read keeps what the page already had.
            setJourneyInputs((current) => ({
                cards: payload.loaded && Array.isArray(payload.cards) ? payload.cards : current.cards,
                trainedSpecies: payload.trainedSpecies ?? current.trainedSpecies,
                failures: payload.failures ?? current.failures,
                fused: payload.fused ?? current.fused,
                earnedPowers: payload.earnedPowers ?? current.earnedPowers
            }));
            if (payload.loaded) setJourneyLoaded(true);
            if (payload.summary) setSummary({wins: payload.summary.wins, netCredits: payload.summary.netCredits});
        } catch {
            // Keep the last known page.
        }
    }, []);

    useEffect(() => {
        void refreshJourney();
    }, [refreshJourney]);

    // Back on the tab after a card's Play tab: the steps may have moved.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== "visible") return;
            void refreshJourney();
            void trials.refresh();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [refreshJourney, trials]);

    const journey = useMemo(() => {
        if (!journeyLoaded) return EMPTY_PLAY_JOURNEY;
        const allTrials = [...trials.history, ...trials.openTrials];
        return buildPlayJourney({
            cards: journeyInputs.cards,
            trainedSpecies: journeyInputs.trainedSpecies,
            failures: journeyInputs.failures,
            earnedSpecies: journeyInputs.earnedPowers.map((power) => power.speciesProfileId),
            openTrials: trials.openTrials,
            completedTrialSpecies: allTrials.filter(isComplete).map((trial) => trial.speciesProfileId),
            fused: journeyInputs.fused
        });
    }, [journeyInputs, journeyLoaded, trials.history, trials.openTrials]);

    const earnedFused = useMemo(() => journeyInputs.fused.filter((power) => power.earnedAt), [journeyInputs.fused]);

    /** Every Power earned, newest first: the animals' own and fused ones. */
    const powerHistory = useMemo<PlayPowerHistoryItem[]>(() => {
        const cardsById = new Map(journeyInputs.cards.map((card) => [card.captureId.toLowerCase(), card]));
        const newestCard = (speciesProfileId: string) => journeyInputs.cards
            .filter((card) => card.speciesProfileId?.toLowerCase() === speciesProfileId.toLowerCase())
            .sort((left, right) => Date.parse(right.capturedAt ?? "") - Date.parse(left.capturedAt ?? ""))[0] ?? null;
        const own = journeyInputs.earnedPowers.map((power): PlayPowerHistoryItem => {
            const card = newestCard(power.speciesProfileId);
            return {
                id: `power-${power.speciesProfileId}`,
                speciesProfileId: power.speciesProfileId,
                captureId: card?.captureId ?? null,
                animalName: power.speciesDisplayName,
                imageSrc: card?.imageSrc ?? null,
                powerName: power.powerName,
                isFused: false,
                route: power.route,
                earnedAt: power.earnedAt
            };
        });
        const fused = earnedFused.map((power): PlayPowerHistoryItem => {
            const card = cardsById.get(power.captureId.toLowerCase());
            return {
                id: `fused-${power.id}`,
                speciesProfileId: card?.speciesProfileId ?? power.captureId,
                captureId: power.captureId,
                animalName: card?.animalName ?? "Animal",
                imageSrc: card?.imageSrc ?? null,
                powerName: power.name,
                isFused: true,
                route: null,
                earnedAt: power.earnedAt
            };
        });
        return sortPowerHistory([...own, ...fused]);
    }, [earnedFused, journeyInputs.cards, journeyInputs.earnedPowers]);

    useEffect(() => {
        if (!initialTargetId) return;
        const opponent = arena.find((item) => item.captureId === initialTargetId);
        if (opponent) {
            setActiveOpponent(opponent);
            setTargetError(null);
            return;
        }
        setTargetError("That comparison target is no longer available.");
    }, [arena, initialTargetId]);

    function clearTargetParam() {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("target");
        const next = params.toString();
        router.replace(next ? `/app/arena?${next}` : "/app/arena");
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

    function selectSegment(next: PlayHubSegment) {
        setSegment(next);
        if (next === "powers") setHistorySubject("powers");
        if (next === "comparisons") setHistorySubject("comparisons");
        if (next === "history") void trials.refresh();
    }

    const winCount = summary?.wins ?? 0;
    const netCredits = summary?.netCredits ?? 0;
    const netCreditsLabel = netCredits >= 0 ? `+${netCredits}` : `${netCredits}`;

    return (
        <AppPage narrow>
            <div className="sticky top-16 z-20 -mx-4 space-y-4 bg-black px-4 pb-3 pt-1.5 lg:top-0 md:mx-0 md:px-0">
                <div className="flex items-center gap-3">
                    <div role="tablist" aria-label="Battles" className="flex min-w-0 flex-1 border border-white/10 bg-white/[0.04] p-[3px]">
                        {SEGMENTS.map((item) => {
                            const isOn = segment === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={isOn}
                                    onClick={() => selectSegment(item.id)}
                                    className={`min-w-0 flex-1 truncate px-1 py-[9px] text-[13px] font-black transition ${isOn ? "bg-primary-400 text-black/90" : "text-white/60 hover:text-white"}`}
                                >
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        aria-label="Healing Station"
                        title="Comparison settings"
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-[#141414] text-white transition hover:bg-white/[0.08]"
                    >
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                            <path d="M3 6h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <circle cx="7" cy="6" r="2" fill="#141414" stroke="currentColor" strokeWidth="1.8" />
                            <circle cx="13" cy="14" r="2" fill="#141414" stroke="currentColor" strokeWidth="1.8" />
                        </svg>
                    </button>
                </div>

                {segment === "history" ? (
                    <>
                        <div role="tablist" aria-label="Which history" className="flex gap-2">
                            {HISTORY_SUBJECTS.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={historySubject === option.id}
                                    onClick={() => setHistorySubject(option.id)}
                                    className={`rounded-full border px-3 py-2 text-xs font-bold transition ${historySubject === option.id ? "border-transparent bg-primary-400 text-black/90" : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white"}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        {historySubject === "powers" ? (
                            <StatsStrip figures={[
                                {value: journeyInputs.earnedPowers.length, label: "Earned", tint: NEON},
                                {value: earnedFused.length, label: "Fused", tint: VIOLET}
                            ]} />
                        ) : historySubject === "comparisons" ? (
                            <StatsStrip figures={[
                                {value: winCount, label: "Wins", tint: VIOLET},
                                {value: netCreditsLabel, label: "Net", tint: GOLD}
                            ]} />
                        ) : (
                            <StatsStrip figures={[
                                {value: completedTrialHistory(trials.history).length, label: "Completed", tint: NEON},
                                {value: failedTrialHistory(trials.history).length, label: "Failed", tint: FAIL}
                            ]} />
                        )}
                    </>
                ) : null}

                {targetError ? (
                    <div className="border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                        {targetError}
                    </div>
                ) : null}
            </div>

            <div className="!mt-0">
                {segment === "powers" ? (
                    <PlayPowersPage journey={journey} loaded={journeyLoaded} onFindBattle={() => selectSegment("comparisons")} />
                ) : segment === "comparisons" ? (
                    <MatchupsArenaTab
                        opponents={arena}
                        roster={roster}
                        popularBreakdowns={initialPopularBreakdowns}
                        onOpenSettings={() => setSettingsOpen(true)}
                        onChallenge={handleChallenge}
                    />
                ) : historySubject === "powers" ? (
                    <PowerHistoryList items={powerHistory} loaded={journeyLoaded} />
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
            </div>

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
                        void refreshJourney();
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
