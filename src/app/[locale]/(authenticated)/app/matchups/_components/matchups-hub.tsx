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
import type {MatchupHistoryItem, MatchupOpponent, MatchupResolveResult, MatchupRosterCapture} from "@/data/matchups-types";
import type {SpeciesComparisonSummary} from "@/data/species-comparisons";

type Segment = "arena" | "history";

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
    const [segment, setSegment] = useState<Segment>("arena");
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
        const creditsDelta = result.winnerUserId === viewerUserId
            ? result.payoutAmount - result.stakeAmount
            : -result.stakeAmount;
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
                viewerWon: result.winnerUserId === viewerUserId,
                creditsDelta
            };
            return [next, ...current.filter((item) => item.id !== next.id)];
        });
        setArena((current) => current.filter((item) => item.captureId !== result.defenderCaptureId));
    }

    const winCount = history.filter((item) => item.viewerWon).length;
    const netCredits = history.reduce((total, item) => total + item.creditsDelta, 0);
    const netCreditsLabel = netCredits >= 0 ? `+${netCredits}` : `${netCredits}`;

    return (
        <AppPage>
            <div className="space-y-3">
                <TrainBackLink />
                <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                        <h1 className="font-display text-[28px] font-black leading-none text-white md:text-[34px]">
                            Comparisons
                        </h1>
                        <p className="text-sm text-white/55 md:text-base">
                            Pick an animal to compare
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

            <AppSegmentedControl
                value={segment}
                options={[
                    {id: "arena", label: "Find"},
                    {id: "history", label: "History"}
                ]}
                onChange={setSegment}
                fullWidth
            />

            {targetError ? (
                <div className="rounded-[1.15rem] border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                    {targetError}
                </div>
            ) : null}

            {segment === "arena" ? (
                <MatchupsArenaTab
                    opponents={arena}
                    roster={roster}
                    popularBreakdowns={initialPopularBreakdowns}
                    onOpenSettings={() => setSettingsOpen(true)}
                    onChallenge={handleChallenge}
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
                    onViewHistory={() => setSegment("history")}
                />
            ) : null}
        </AppPage>
    );
}
