"use client";

import {useCallback, useEffect, useState} from "react";
import {
    type AnimalTrial,
    NOT_YET_CAPTURED_NOTE,
    NOT_YET_CAPTURED_TITLE,
    frequencyAccent,
    frequencyBadge,
    instructionsPreview,
    isComplete,
    isTimed,
    primaryActionTitle,
    rewardCreditsDisplay,
    rewardXP,
    socialProofText,
    trialId,
    trialProgress
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
 * Trials need no Pro. They DO need the animal: a Trial is per person per
 * species, and the server refuses one for an animal the viewer has not caught.
 * The cards still show for everyone — knowing what an animal teaches is what
 * makes someone want to catch it — but start and submit do not.
 */
export default function AnimalTrialsSection({
    speciesProfileId,
    showsHeader = true,
    canAttempt = true,
    onTrialCompleted,
    onUpdated,
    onApplyYourWay,
    isApplying = false
}: {
    speciesProfileId: string | null | undefined;
    /**
     * False when this is mounted as the Trial arm of the earn fork, which has
     * already said you are on the Trial path — a second heading underneath it
     * just repeats the choice back.
     */
    showsHeader?: boolean;
    /** False when the viewer has not unlocked this animal. Cards stay visible; start and submit do not. */
    canAttempt?: boolean;
    /** Completing a Trial earns the animal's Power, so the caller re-reads it. */
    onTrialCompleted?: (trial: AnimalTrial) => void;
    /** Any change the sheet wrote, so a parent list can stay in step. */
    onUpdated?: (trial: AnimalTrial) => void;
    /** Offered beside each Trial when set: the written route to the same Power. */
    onApplyYourWay?: (trial: AnimalTrial) => void;
    isApplying?: boolean;
}) {
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
        const previous = trials.find((item) => trialId(item) === trialId(updated));
        setTrials((current) => current.map((item) => (trialId(item) === trialId(updated) ? updated : item)));
        onUpdated?.(updated);
        if (previous && !isComplete(previous) && isComplete(updated)) onTrialCompleted?.(updated);
    }, [onTrialCompleted, onUpdated, trials]);

    if (!trials.length) return null;

    const openTrial = trials.find((item) => trialId(item) === openTrialId) ?? null;
    const progress = trialProgress(trials);

    return (
        <section className="flex flex-col">
            {showsHeader ? (
                <header className="flex items-center gap-2 px-5 pb-3.5 pt-5">
                    <span aria-hidden="true" className="text-[13px]" style={{color: "rgb(var(--c-primary-text-400))"}}>◉</span>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white">Animal Trials</h3>
                    <span className="ml-auto text-[10px] text-white/40">What this animal teaches you to do</span>
                </header>
            ) : null}

            {/* The Power stays locked until every frequency is finished, so an
                animal with more than one Trial says how far along it is. */}
            {trials.length > 1 ? (
                <div
                    className={`flex flex-col gap-2 px-5 pb-3.5 ${showsHeader ? "pt-0" : "pt-4"}`}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={progress.total}
                    aria-valuenow={progress.done}
                    aria-label={`${progress.done} of ${progress.total} Trials complete`}
                >
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-black uppercase tracking-[0.11em]" style={{color: progress.done === progress.total ? "rgb(var(--c-primary-text-400))" : "rgb(var(--c-white) / 0.85)"}}>
                            {progress.label}
                        </span>
                        <span className="text-[10px] font-bold text-white/40">{progress.percent}%</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                        <div className="h-full rounded-full" style={{width: `${progress.fraction * 100}%`, backgroundColor: "#A7F432"}} />
                    </div>
                </div>
            ) : null}

            {trials.map((trial) => (
                <TrialCard
                    key={trialId(trial)}
                    trial={trial}
                    canAttempt={canAttempt}
                    onOpen={() => {
                        if (!canAttempt && !isComplete(trial)) return;
                        setOpenTrialId(trialId(trial));
                    }}
                    onApplyYourWay={onApplyYourWay ? () => onApplyYourWay(trial) : null}
                    isApplying={isApplying}
                />
            ))}

            {openTrial ? (
                <AnimalTrialDetail
                    trial={openTrial}
                    canAttempt={canAttempt}
                    onChange={applyUpdate}
                    onClose={() => setOpenTrialId(null)}
                />
            ) : null}
        </section>
    );
}

function lifecycleLabel(trial: AnimalTrial) {
    switch (trial.status) {
        case "completed":
            return trial.completedAt
                ? `✓ COMPLETE · ${new Date(trial.completedAt).toLocaleDateString(undefined, {day: "numeric", month: "short", year: "numeric"})}`
                : "✓ COMPLETE";
        case "pending_activation": return "◷ ARMED";
        case "active":
        case "proof_submitted": return "⚡ ACTIVE";
        case "expired":
        case "abandoned": return "↺ MISSED";
        default: return null;
    }
}

/**
 * One Trial, full width, no inset. Ported from iOS `AnimalTrialCard`.
 *
 * State, the action, what to do, the reward, the button — and nothing else. A
 * card is a decision, and every extra sentence on it is read instead of the
 * button being pressed. The card now leads with what to DO rather than what you
 * get: the benefit is the sheet's job, the action is what a person scans for.
 *
 * When the Arena offers the written route beside the Trial, the single button
 * becomes two halves of one control: both earn the same Power.
 */
export function TrialCard({
    trial,
    canAttempt = true,
    onOpen,
    onApplyYourWay = null,
    isApplying = false
}: {
    trial: AnimalTrial;
    canAttempt?: boolean;
    onOpen: () => void;
    onApplyYourWay?: (() => void) | null;
    isApplying?: boolean;
}) {
    const accent = frequencyAccent(trial.frequency);
    const complete = isComplete(trial);
    const state = lifecycleLabel(trial);
    const social = socialProofText(trial);
    const isLocked = !canAttempt && !complete;
    const showsTwoPaths = Boolean(onApplyYourWay) && !complete && !isLocked;
    const preview = instructionsPreview(trial.instructions);

    const body = (
        <>
            <h4 className="font-display text-2xl font-black leading-tight text-white">{trial.title}</h4>

            {preview ? (
                <p className="line-clamp-2 text-sm leading-6 text-white/60">{preview}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
                <RewardChip accent={accent}>+{rewardXP(trial)} XP</RewardChip>
                {rewardCreditsDisplay(trial) > 0 ? (
                    <RewardChip accent={accent}>+{rewardCreditsDisplay(trial)} Credits</RewardChip>
                ) : null}
                <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-bold text-white/60">
                    {isTimed(trial)
                        ? `${trial.completionWindowMinutes ?? 0} min window`
                        : `~${trial.estimatedMinutes} min`}
                </span>
            </div>

            {!showsTwoPaths && (!complete || social) ? (
                <>
                    {!complete ? (
                        isLocked ? (
                            <span className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-white/[0.08] text-sm font-black text-white/60">
                                🔒 {NOT_YET_CAPTURED_TITLE}
                            </span>
                        ) : (
                            <span
                                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-sm font-black text-black/90"
                                style={{backgroundColor: accent}}
                            >
                                {primaryActionTitle(trial)} <span aria-hidden="true">→</span>
                            </span>
                        )
                    ) : null}
                    {isLocked ? <p className="text-center text-[10px] text-white/40">{NOT_YET_CAPTURED_NOTE}</p> : null}
                    {social ? <p className="text-center text-[10px] text-white/40">{social}</p> : null}
                </>
            ) : null}
        </>
    );

    return (
        <div className="flex w-full flex-col border-b border-white/[0.08] bg-white/[0.02] text-left">
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

            <button
                type="button"
                onClick={onOpen}
                disabled={isLocked}
                aria-label={showsTwoPaths ? trial.title : `${trial.frequency} Trial. ${trial.title}. ${trial.instructions}`}
                title={showsTwoPaths
                    ? "Do the Trial, or Apply It Your Way."
                    : isLocked ? `Not yet captured. ${NOT_YET_CAPTURED_NOTE}` : "Opens the Trial"}
                className="flex w-full flex-col gap-3 px-5 pb-[18px] pt-3.5 text-left disabled:cursor-not-allowed"
                style={{backgroundImage: `linear-gradient(to bottom, ${accent}${complete ? "1A" : "2E"}, transparent 60%)`}}
            >
                {body}
            </button>

            {showsTwoPaths ? (
                <div className="flex flex-col gap-2 px-5 pb-[18px]">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/40">Earn the Power</p>
                    <div className="flex h-10 overflow-hidden rounded-xl border border-white/10">
                        <button
                            type="button"
                            onClick={onOpen}
                            aria-label={`Do the Trial. ${trial.title}`}
                            className="flex-1 text-sm font-black text-black/90"
                            style={{backgroundColor: accent}}
                        >
                            Do the Trial
                        </button>
                        <span aria-hidden="true" className="w-px bg-white/10" />
                        <button
                            type="button"
                            onClick={() => onApplyYourWay?.()}
                            disabled={isApplying}
                            aria-label={`Apply It Your Way for ${trial.title}`}
                            className="flex-1 bg-white/[0.04] text-sm font-black disabled:opacity-60"
                            style={{color: "rgb(var(--c-primary-text-400))"}}
                        >
                            {isApplying ? "…" : "Your Way"}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function RewardChip({accent, children}: {accent: string; children: React.ReactNode}) {
    return (
        <span
            className="inline-flex items-center rounded-full border px-2.5 py-1.5 text-[10px] font-black"
            style={{color: `color-mix(in srgb, ${accent} var(--accent-ink-mix, 100%), black)`, backgroundColor: `${accent}24`, borderColor: `${accent}59`}}
        >
            {children}
        </span>
    );
}
