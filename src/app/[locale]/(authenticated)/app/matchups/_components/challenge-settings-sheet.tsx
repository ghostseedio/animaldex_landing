"use client";

import {useState} from "react";
import type {MatchupRosterCapture} from "@/data/matchups-types";
import ChallengeHearts from "@/app/[locale]/(authenticated)/app/matchups/_components/challenge-hearts";

export default function ChallengeSettingsSheet({
    roster,
    onClose
}: {
    roster: MatchupRosterCapture[];
    onClose: () => void;
}) {
    const [message, setMessage] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    async function toggleReady(capture: MatchupRosterCapture) {
        setBusyId(capture.captureId);
        setMessage(null);

        try {
            const response = await fetch("/api/app/comparison-settings", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    captureId: capture.captureId,
                    action: "update",
                    isChallengeReady: !capture.isChallengeReady,
                    challengeStake: capture.challengeStake
                })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error ?? "Could not update challenge settings.");
            setMessage(`${capture.animalName} is now ${capture.isChallengeReady ? "hidden from" : "ready for"} matchups. Refresh to see arena changes.`);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not update challenge settings.");
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
            <button type="button" aria-label="Close settings" className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" onClick={onClose} />
            <div className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[#101010] p-5 shadow-2xl">
                <h3 className="font-display text-2xl font-bold text-white">Challenge settings</h3>
                <p className="mt-2 text-sm text-white/45">
                    Toggle which of your public animals are ready for Scenario Arena matchups and review their stake.
                </p>
                {message ? <p className="mt-4 text-sm text-primary-200">{message}</p> : null}
                <div className="mt-5 space-y-2">
                    {roster.length ? roster.map((capture) => (
                        <div key={capture.captureId} className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                            <div className="min-w-0">
                                <p className="truncate font-bold text-white">{capture.animalName}</p>
                                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/35">
                                    <span>{capture.isChallengeReady ? "Challenge-ready" : "Hidden"}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{capture.challengeStake} credits</span>
                                    <span aria-hidden="true">·</span>
                                    <ChallengeHearts challengeHealth={capture.challengeHealth} />
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={busyId === capture.captureId}
                                onClick={() => toggleReady(capture)}
                                className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white/70"
                            >
                                {capture.isChallengeReady ? "Hide" : "Ready"}
                            </button>
                        </div>
                    )) : (
                        <p className="text-sm text-white/45">No public captures with comparison stats yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
