"use client";

import {useCallback, useEffect, useState} from "react";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import PickAnimalStep from "@/app/[locale]/(authenticated)/app/matchups/_components/steps/pick-animal-step";
import PreviewMatchupStep from "@/app/[locale]/(authenticated)/app/matchups/_components/steps/preview-matchup-step";
import MatchupRevealStep from "@/app/[locale]/(authenticated)/app/matchups/_components/steps/matchup-reveal-step";
import ResultStep from "@/app/[locale]/(authenticated)/app/matchups/_components/steps/result-step";
import type {MatchupOpponent, MatchupResolveResult, MatchupRosterCapture} from "@/data/matchups-types";
import {friendlyChallengeError} from "@/lib/matchup-stats";
import {unlockMatchupAudio} from "@/lib/matchup-sounds";

type WizardStep = "pick" | "preview" | "resolving" | "result";

export default function ChallengeWizardSheet({
    opponent,
    roster,
    viewerUserId,
    onClose,
    onComplete,
    onViewHistory
}: {
    opponent: MatchupOpponent;
    roster: MatchupRosterCapture[];
    viewerUserId: string;
    onClose: () => void;
    onComplete: (result: MatchupResolveResult) => void;
    onViewHistory: () => void;
}) {
    const [step, setStep] = useState<WizardStep>("pick");
    const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
    const [result, setResult] = useState<MatchupResolveResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const attacker = roster.find((capture) => capture.captureId === selectedCaptureId) ?? null;

    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, []);

    async function runMatchup() {
        if (!attacker) return;
        unlockMatchupAudio();
        setStep("resolving");
        setError(null);
        setResult(null);

        try {
            const response = await fetch("/api/app/resolve-challenge", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    attackerCaptureId: attacker.captureId,
                    defenderCaptureId: opponent.captureId
                })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error ?? "Matchup failed.");
            }
            setResult(payload.result as MatchupResolveResult);
        } catch (resolveError) {
            setError(friendlyChallengeError(resolveError instanceof Error ? resolveError.message : "Matchup failed."));
            setStep("preview");
        }
    }

    const handleRevealComplete = useCallback(() => {
        if (!result) return;
        onComplete(result);
        setStep("result");
    }, [onComplete, result]);

    const title = step === "pick"
        ? "Pick your animal"
        : step === "preview"
            ? "Preview matchup"
            : step === "resolving"
                ? "Resolving"
                : "Matchup result";

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <button type="button" aria-label="Close challenge wizard" className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
            <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.75rem] border border-white/10 bg-[#0d0d0d] shadow-2xl sm:rounded-[1.75rem]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div>
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-primary-200">Scenario Arena</p>
                        <h2 className="font-display text-2xl font-bold text-white">{title}</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-full border border-white/10 p-2 text-white/45">
                        <AppIcon name="close" className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                    {step === "pick" ? (
                        <PickAnimalStep
                            opponent={opponent}
                            roster={roster}
                            selectedCaptureId={selectedCaptureId}
                            onSelect={setSelectedCaptureId}
                        />
                    ) : null}
                    {step === "preview" && attacker ? (
                        <>
                            <PreviewMatchupStep opponent={opponent} attacker={attacker} />
                            {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
                        </>
                    ) : null}
                    {step === "resolving" && attacker ? (
                        <MatchupRevealStep
                            attacker={attacker}
                            opponent={opponent}
                            result={result}
                            viewerUserId={viewerUserId}
                            onRevealComplete={handleRevealComplete}
                        />
                    ) : null}
                    {step === "result" && attacker && result ? (
                        <ResultStep
                            result={result}
                            opponent={opponent}
                            attacker={attacker}
                            viewerUserId={viewerUserId}
                            onFindAnother={onClose}
                            onViewHistory={() => {
                                onClose();
                                onViewHistory();
                            }}
                        />
                    ) : null}
                </div>

                {step === "pick" ? (
                    <div className="border-t border-white/10 p-5">
                        <button
                            type="button"
                            disabled={!selectedCaptureId}
                            onClick={() => setStep("preview")}
                            className={`w-full rounded-2xl px-4 py-3 text-sm font-black ${selectedCaptureId ? "bg-primary-400 text-black" : "cursor-not-allowed bg-white/5 text-white/30"}`}
                        >
                            Continue to preview
                        </button>
                    </div>
                ) : null}

                {step === "preview" && attacker ? (
                    <div className="grid grid-cols-2 gap-3 border-t border-white/10 p-5">
                        <button type="button" onClick={() => setStep("pick")} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white/70">
                            Back
                        </button>
                        <button type="button" onClick={runMatchup} className="rounded-2xl bg-primary-400 px-4 py-3 text-sm font-black text-black">
                            Run matchup
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
