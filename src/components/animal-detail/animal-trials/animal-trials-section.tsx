"use client";

import {useCallback, useEffect, useState} from "react";
import {
    type AnimalTrial,
    collapsedAnimalHook,
    frequencyAccent,
    frequencyBadge,
    isComplete,
    isTimed,
    primaryActionTitle,
    rewardCreditsDisplay,
    rewardXP,
    socialProofText,
    trialId
} from "@/lib/animal-trials";
import AnimalTrialDetail from "@/components/animal-detail/animal-trials/animal-trial-detail";

/**
 * The Animal Trials entry point on a species. One card per frequency the animal
 * actually has, because frequency is the character of the task and a LOW+HIGH
 * animal genuinely teaches two different things.
 *
 * Both the public species page and the owned capture card mount this with the
 * same canonical `speciesProfileId`, which is the whole reason there is one
 * Trials implementation rather than two.
 *
 * Trials need no Pro and no capture unlock, so this sits above any premium gate.
 * A species with no Trial shows nothing at all — no empty state, no "coming soon".
 */
export default function AnimalTrialsSection({speciesProfileId}: {speciesProfileId: string | null | undefined}) {
    const [trials, setTrials] = useState<AnimalTrial[]>([]);
    const [openTrialId, setOpenTrialId] = useState<string | null>(null);

    const load = useCallback(async (signal: AbortSignal) => {
        if (!speciesProfileId) {
            setTrials([]);
            return;
        }
        try {
            const response = await fetch(
                `/api/app/animal-trials?speciesProfileId=${encodeURIComponent(speciesProfileId)}`,
                {headers: {Accept: "application/json"}, signal}
            );
            if (!response.ok) {
                setTrials([]);
                return;
            }
            const payload = await response.json();
            setTrials(Array.isArray(payload.trials) ? payload.trials : []);
        } catch {
            // An aborted or failed load leaves the section blank, exactly as a
            // species with no Trials does.
            if (!signal.aborted) setTrials([]);
        }
    }, [speciesProfileId]);

    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [load]);

    const applyUpdate = useCallback((updated: AnimalTrial) => {
        setTrials((current) => current.map((item) => (trialId(item) === trialId(updated) ? updated : item)));
    }, []);

    if (!trials.length) return null;

    const openTrial = trials.find((item) => trialId(item) === openTrialId) ?? null;

    return (
        <section className="flex flex-col">
            <header className="flex items-center gap-2 px-5 pb-3.5 pt-5">
                <span aria-hidden="true" className="text-[13px]" style={{color: "#A7F432"}}>◉</span>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white">Animal Trials</h3>
                <span className="ml-auto text-[10px] text-white/40">What this animal teaches you to do</span>
            </header>

            {trials.map((trial) => (
                <TrialCard key={trialId(trial)} trial={trial} onOpen={() => setOpenTrialId(trialId(trial))} />
            ))}

            {openTrial ? (
                <AnimalTrialDetail
                    trial={openTrial}
                    onChange={applyUpdate}
                    onClose={() => setOpenTrialId(null)}
                />
            ) : null}
        </section>
    );
}

function lifecycleLabel(trial: AnimalTrial) {
    switch (trial.status) {
        case "completed": return "✓ COMPLETE";
        case "pending_activation": return "◷ ARMED";
        case "active":
        case "proof_submitted": return "⚡ ACTIVE";
        case "expired":
        case "abandoned": return "↺ MISSED";
        default: return null;
    }
}

/**
 * One Trial, full width, no inset.
 *
 * The reading order is deliberate and is NOT the order the data is stored in:
 * state → what you do → what you get → why this animal → reward → act. People
 * decide whether to do something from the benefit, not the biology, so the
 * benefit sits above the fold and the mechanism sits under it.
 */
function TrialCard({trial, onOpen}: {trial: AnimalTrial; onOpen: () => void}) {
    const accent = frequencyAccent(trial.frequency);
    const complete = isComplete(trial);
    const state = lifecycleLabel(trial);
    const hook = collapsedAnimalHook(trial);
    const social = socialProofText(trial);

    return (
        <button
            type="button"
            onClick={onOpen}
            aria-label={`${trial.frequency} Trial. ${trial.title}. ${trial.userBenefit}`}
            className="flex w-full flex-col border-b border-white/[0.08] bg-white/[0.02] text-left"
        >
            {/* The coloured rail: frequency on the left, lifecycle on the right. */}
            <div
                className="flex w-full items-center gap-2 px-5 py-2"
                style={{backgroundColor: complete ? `${accent}8C` : accent}}
            >
                <span className="text-[10px] font-black uppercase tracking-[0.11em] text-black/85">
                    {frequencyBadge(trial.frequency)}
                </span>
                {state ? (
                    <span className="ml-auto text-[10px] font-black text-black/85">{state}</span>
                ) : null}
            </div>

            <div
                className="flex w-full flex-col gap-3.5 px-5 pb-5 pt-4"
                style={{backgroundImage: `linear-gradient(to bottom, ${accent}${complete ? "1A" : "2E"}, transparent 60%)`}}
            >
                <h4 className="font-display text-2xl font-black leading-tight text-white">{trial.title}</h4>

                {/* The conversion line. This is why someone taps. */}
                {trial.userBenefit ? (
                    <p className="text-sm leading-6 text-white/90">{trial.userBenefit}</p>
                ) : null}

                <div className="flex gap-2">
                    <span aria-hidden="true" className="w-0.5 shrink-0 rounded" style={{backgroundColor: `${accent}CC`}} />
                    <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{color: accent}}>
                            {trial.principleName}
                        </span>
                        {hook ? <p className="text-xs leading-5 text-white/55">{hook}</p> : null}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <RewardChip accent={accent}>+{rewardXP(trial)} XP</RewardChip>
                    {rewardCreditsDisplay(trial) > 0 ? (
                        <RewardChip accent={accent}>+{rewardCreditsDisplay(trial)} Credits</RewardChip>
                    ) : null}
                    {/* Only HIGH runs against a clock. Saying so on the calm modes is
                        the difference between an invitation and an obligation. */}
                    <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-bold text-white/60">
                        {isTimed(trial) ? `${trial.completionWindowMinutes ?? 0} min window` : "∞ No time limit"}
                    </span>
                </div>

                {complete && trial.completedAt ? (
                    <p className="text-sm font-bold" style={{color: "#A7F432"}}>
                        ✓ Completed {new Date(trial.completedAt).toLocaleDateString()}
                    </p>
                ) : (
                    <span
                        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-sm font-black text-black/90"
                        style={{backgroundColor: accent}}
                    >
                        {primaryActionTitle(trial)} <span aria-hidden="true">→</span>
                    </span>
                )}

                {social ? <p className="text-center text-[10px] text-white/40">{social}</p> : null}
            </div>
        </button>
    );
}

function RewardChip({accent, children}: {accent: string; children: React.ReactNode}) {
    return (
        <span
            className="inline-flex items-center rounded-full border px-2.5 py-1.5 text-[10px] font-black"
            style={{color: accent, backgroundColor: `${accent}24`, borderColor: `${accent}59`}}
        >
            {children}
        </span>
    );
}
