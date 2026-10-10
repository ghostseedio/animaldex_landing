"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {
    type AnimalTrial,
    type AnimalTrialVerificationResult,
    MAX_TEXT_PROOF_CHARACTERS,
    MIN_TEXT_PROOF_CHARACTERS,
    NOT_YET_CAPTURED_NOTE,
    NOT_YET_CAPTURED_TITLE,
    allowsLibraryEvidence,
    canSubmitEvidence,
    countdownLabel,
    frequencyAccent,
    frequencyBadge,
    frequencyCharacter,
    hasProofAttemptsLeft,
    isApproved,
    isComplete,
    isRandomlyActivated,
    isTimed,
    notingApproval,
    primaryActionTitle,
    remainingProofAttempts,
    remainingSeconds,
    requiresText,
    requiresVideo,
    rewardCreditsDisplay,
    rewardXP,
    safetyNote,
    socialProofText,
    stillProofType,
    trialStartErrorMessage,
    wasRejected
} from "@/lib/animal-trials";
import {extractTrialFrames} from "@/lib/animal-trial-frames";
import {TRIAL_ASK_SUGGESTIONS, trialAskBrief, trialAskKey} from "@/lib/animal-trial-ask";
import type {DiscoverAnimalTrialItem} from "@/data/discover-timeline";
import {AskTrialBridge, useAskAnimalDex} from "@/components/ask-animaldex/ask-animaldex-provider";
import {AnimalTrialEvidence} from "@/app/[locale]/(authenticated)/app/_components/discover-animal-trial-card";
import {discoverPostPath} from "@/lib/discover-post";
import Link from "@/app/[locale]/_components/link";

/**
 * One Trial, full screen. Ported from iOS `AnimalTrialDetailView`.
 *
 * Every section is a full-bleed band divided by a hairline, not a rounded card
 * in a gutter: this is a page about one thing, not a list of widgets.
 *
 * DISCLOSURE IS KEYED TO THE LIFECYCLE, not to a fixed layout. Before a Trial
 * is started the screen answers two questions and nothing else — what do I get,
 * and what do I do — because the only thing to decide at that point is whether
 * to press one button. The evidence rules open themselves the moment the Trial
 * is actually active and they become the task. The constraint sits behind an ⓘ
 * and the biology behind one row, both one tap away, neither in the way.
 *
 * Below the Trial itself: Ask AnimalDex about it, and what other people
 * submitted — so a person who is unsure what "counts" can see, and ask.
 */

const NEON = "#A7F432";

type Submission = {image: string | null; text: string | null};

function Band({accent, children}: {accent?: string; children: React.ReactNode}) {
    return (
        <section
            className="relative flex flex-col gap-2.5 border-b border-white/[0.08] bg-white/[0.02] px-5 py-5"
            style={accent ? {boxShadow: `inset 3px 0 0 ${accent}8C`} : undefined}
        >
            {children}
        </section>
    );
}

function Eyebrow({children, color}: {children: React.ReactNode; color?: string}) {
    return (
        <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{color: color ?? "rgba(255,255,255,0.4)"}}>
            {children}
        </p>
    );
}

function Pill({children, color}: {children: React.ReactNode; color: string}) {
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-black"
            style={{color, backgroundColor: `${color}24`}}
        >
            {children}
        </span>
    );
}

/** The still and/or the words this person handed in. */
function SubmittedEvidence({submission}: {submission: Submission}) {
    if (!submission.image && !submission.text) return null;
    return (
        <div className="flex flex-col gap-2">
            {submission.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={submission.image} alt="Your evidence" className="max-h-[220px] w-full rounded-2xl object-cover" />
            ) : null}
            {submission.text ? (
                <p className="whitespace-pre-line rounded-2xl bg-black/30 p-3 text-sm leading-6 text-white/85">{submission.text}</p>
            ) : null}
        </div>
    );
}

export default function AnimalTrialDetail({
    trial,
    canAttempt = true,
    onChange,
    onClose
}: {
    trial: AnimalTrial;
    /** False when the viewer has not unlocked this animal: the Trial reads, but cannot be started or submitted. */
    canAttempt?: boolean;
    onChange: (trial: AnimalTrial) => void;
    onClose: () => void;
}) {
    const [current, setCurrent] = useState(trial);
    const [isWorking, setIsWorking] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [verification, setVerification] = useState<AnimalTrialVerificationResult | null>(null);
    const [showsWhy, setShowsWhy] = useState(false);
    /** PROOF opens itself once the Trial is active; before that it is one row the reader may open. */
    const [showsProof, setShowsProof] = useState(false);
    const [showsRule, setShowsRule] = useState(false);
    /** WHAT YOU GET starts open before a Trial is under way, and folds to one row once it is. */
    const [showsBenefit, setShowsBenefit] = useState(() => !canSubmitEvidence(trial) && !isComplete(trial));
    /** The written answer, for the Trials whose evidence IS words. */
    const [textAnswer, setTextAnswer] = useState("");
    const [now, setNow] = useState(() => Date.now());
    const [submission, setSubmission] = useState<Submission>({image: null, text: null});
    const [otherAttempts, setOtherAttempts] = useState<DiscoverAnimalTrialItem[] | null>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const libraryInputRef = useRef<HTMLInputElement>(null);
    const {open: openAsk} = useAskAnimalDex();

    const accent = frequencyAccent(current.frequency);
    const timed = isTimed(current);
    const complete = isComplete(current);

    useEffect(() => setCurrent(trial), [trial]);

    // Only a timed Trial needs a ticking clock; the calm modes never show one.
    useEffect(() => {
        if (!timed || complete) return undefined;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [complete, timed]);

    /** What this person already handed in, once there is anything to show. */
    const loadSubmission = useCallback(async () => {
        if (!(isComplete(current) || wasRejected(current) || current.proofAttemptCount > 0)) return;
        try {
            const response = await fetch(
                `/api/app/animal-trials/submission?speciesProfileId=${encodeURIComponent(current.speciesProfileId)}&frequency=${encodeURIComponent(current.frequency)}`,
                {cache: "no-store"}
            );
            if (!response.ok) return;
            const payload = await response.json() as Submission;
            setSubmission({image: payload.image ?? null, text: payload.text ?? null});
        } catch {
            // The verdict still reads without the picture.
        }
    }, [current]);

    useEffect(() => {
        void loadSubmission();
    }, [loadSubmission]);

    // Other people's attempts at THIS Trial: completions and evidence that
    // failed both checks. A rejection with a check left is not a post yet.
    useEffect(() => {
        let cancelled = false;
        void fetch(
            `/api/discover/animal-trial-cohort?species=${encodeURIComponent(current.speciesProfileId)}&frequency=${encodeURIComponent(current.frequency)}&limit=24&scope=attempts`
        )
            .then((response) => (response.ok ? response.json() : {items: []}))
            .then((payload: {items?: DiscoverAnimalTrialItem[]}) => {
                if (!cancelled) setOtherAttempts(Array.isArray(payload.items) ? payload.items : []);
            })
            .catch(() => {
                if (!cancelled) setOtherAttempts([]);
            });
        return () => {
            cancelled = true;
        };
    }, [current.frequency, current.speciesProfileId]);

    const apply = useCallback((updated: AnimalTrial | null) => {
        if (!updated) return;
        setCurrent(updated);
        onChange(updated);
    }, [onChange]);

    const runLifecycle = useCallback(async (action: "start" | "restart") => {
        if (!canAttempt) return;
        setIsWorking(true);
        setErrorMessage(null);
        const fallback = action === "start"
            ? "Could not start this Trial. Check your connection and try again."
            : "Could not restart this Trial.";
        try {
            const response = await fetch("/api/app/animal-trials", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    action,
                    speciesProfileId: current.speciesProfileId,
                    frequency: current.frequency,
                    utcOffsetMinutes: -new Date().getTimezoneOffset()
                })
            });
            const payload = await response.json().catch(() => ({}));
            if (response.status === 401) {
                // Reading a Trial is open to everyone; committing to one is the point
                // an account is needed, so send them to sign in and back again rather
                // than surfacing "Authentication required" as an error.
                const next = `${window.location.pathname}${window.location.search}`;
                window.location.assign(`/account?next=${encodeURIComponent(next)}`);
                return;
            }
            if (!response.ok) {
                setErrorMessage(trialStartErrorMessage(payload.error ?? "", payload.error ?? fallback));
                return;
            }
            apply(payload.trial);
        } catch {
            setErrorMessage(fallback);
        } finally {
            setIsWorking(false);
        }
    }, [apply, canAttempt, current.frequency, current.speciesProfileId]);

    /**
     * After a verdict: an approval is shown at once and the server's row is
     * re-read; a stale re-read that still says "active" is discarded so an
     * older cached row can never put the button back.
     */
    const settleVerification = useCallback((payload: {verification?: AnimalTrialVerificationResult; trial?: AnimalTrial | null}) => {
        const result = payload.verification ?? null;
        setVerification(result);
        if (result && isApproved(result)) {
            const optimistic = notingApproval(current, {reason: result.reason, rewardXP: result.rewardXP});
            const refreshed = payload.trial ?? null;
            apply(refreshed && isComplete(refreshed) ? refreshed : optimistic);
            return;
        }
        apply(payload.trial ?? null);
    }, [apply, current]);

    const submitEvidence = useCallback(async (file: File) => {
        if (!canAttempt) return;
        setIsWorking(true);
        setErrorMessage(null);
        setVerification(null);
        try {
            const video = requiresVideo(current);
            const form = new FormData();
            form.set("speciesProfileId", current.speciesProfileId);
            form.set("frequency", current.frequency);
            // A screenshot Trial accepts only "screenshot"; sending the same
            // image as "photo" is refused before it is looked at.
            form.set("proofType", video ? "video" : stillProofType(current));
            form.set("proof", file);

            if (video) {
                const frames = await extractTrialFrames(file, 4);
                if (frames.length < 2) {
                    setErrorMessage("That recording could not be read. Try recording it again.");
                    return;
                }
                for (const frame of frames) form.append("frames", frame);
            }

            const response = await fetch("/api/app/animal-trials/proof", {method: "POST", body: form});
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                setErrorMessage(payload.error ?? "Could not check that evidence. Try again in a moment.");
                // A refusal still moves the server's attempt budget, so take the
                // fresh row when the route managed to return one.
                apply(payload.trial ?? null);
                return;
            }

            settleVerification(payload);
        } catch {
            setErrorMessage("Could not check that evidence. Try again in a moment.");
        } finally {
            setIsWorking(false);
        }
    }, [apply, canAttempt, current, settleVerification]);

    const written = requiresText(current);
    const submittable = canSubmitEvidence(current);
    const trimmedAnswer = textAnswer.trim();
    const hasEnoughAnswer = trimmedAnswer.length >= MIN_TEXT_PROOF_CHARACTERS;

    /**
     * A written answer. No upload: the words ARE the evidence, so they go
     * straight to the verifier rather than through storage.
     */
    const submitText = useCallback(async () => {
        if (!canAttempt) return;
        setIsWorking(true);
        setErrorMessage(null);
        setVerification(null);
        try {
            const form = new FormData();
            form.set("speciesProfileId", current.speciesProfileId);
            form.set("frequency", current.frequency);
            form.set("proofType", "text");
            form.set("proofText", trimmedAnswer.slice(0, MAX_TEXT_PROOF_CHARACTERS));

            const response = await fetch("/api/app/animal-trials/proof", {method: "POST", body: form});
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                setErrorMessage(payload.error ?? "Could not check that answer. Try again in a moment.");
                // A refusal still spends server state, so take the fresh row
                // rather than leaving a stale attempt budget on screen.
                apply(payload.trial ?? null);
                return;
            }

            settleVerification(payload);
        } catch {
            setErrorMessage("Could not check that answer. Try again in a moment.");
        } finally {
            setIsWorking(false);
        }
    }, [apply, canAttempt, current.frequency, current.speciesProfileId, settleVerification, trimmedAnswer]);

    const outOfAttempts = !complete && submittable && !hasProofAttemptsLeft(current);
    const actionTitle = !canAttempt ? NOT_YET_CAPTURED_TITLE : outOfAttempts ? "NO CHECKS LEFT" : primaryActionTitle(current);
    const actionDisabled = !canAttempt
        || isWorking
        || current.status === "pending_activation"
        || outOfAttempts
        // Never let a text Trial spend one of its two checks on an empty box.
        || (written && submittable && !hasEnoughAnswer);

    const primaryAction = () => {
        if (!canAttempt) return;
        switch (current.status) {
            case "notStarted":
                void runLifecycle("start");
                break;
            case "active":
            case "proof_submitted":
                if (written) {
                    void submitText();
                    break;
                }
                // A Trial is something you just did, so the evidence is captured
                // live. The library is offered only for a Trial whose proof is by
                // definition already on the device — a screenshot.
                if (allowsLibraryEvidence(current)) libraryInputRef.current?.click();
                else cameraInputRef.current?.click();
                break;
            case "expired":
            case "abandoned":
                void runLifecycle("restart");
                break;
            default:
                break;
        }
    };

    const seconds = remainingSeconds(current, now);

    const rewardSummary = [
        `+${rewardXP(current)} XP`,
        rewardCreditsDisplay(current) > 0 ? `+${rewardCreditsDisplay(current)} Credits` : null
    ].filter(Boolean).join(" · ");

    const proofSummaryLine = written
        ? "Finish by writing your answer"
        : requiresVideo(current) ? "Finish with a short video" : "Finish with one photo";

    const proofHeadline = (
        <span className="flex items-center gap-2">
            <span aria-hidden="true" className="text-xs" style={{color: accent}}>
                {written ? "✎" : requiresVideo(current) ? "▶" : "◉"}
            </span>
            <span className="text-base font-bold text-white">{proofSummaryLine}</span>
            {!submittable ? (
                <span aria-hidden="true" className="ml-auto text-[10px] font-bold text-white/40">{showsProof ? "▴" : "▾"}</span>
            ) : null}
        </span>
    );

    const proofDetail = (
        <>
            <p className="text-sm leading-6 text-white/60">{current.proofPrompt}</p>
            {current.successCriteria.map((criterion, index) => (
                <p key={`${index}-${criterion}`} className="text-[10px] text-white/55">✓ {criterion}</p>
            ))}
            {/* Completing a Trial is public — and so is evidence that fails
                both checks. Saying that here, before anyone uploads anything,
                is the only honest place to say it. */}
            <p className="text-[10px] text-white/40">🌐 Accepted or not, this posts to Discover.</p>
            {socialProofText(current) ? (
                <p className="text-[10px]" style={{color: NEON}}>{socialProofText(current)}</p>
            ) : null}

            {/* The checker's verdict and the budget, both of which used to be invisible. */}
            {current.proofAttemptCount > 0 || wasRejected(current) ? (
                <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.08] pt-3">
                    <SubmittedEvidence submission={submission} />
                    {wasRejected(current) && current.verificationReason ? (
                        <div>
                            <Eyebrow color="#FB923C">Not accepted</Eyebrow>
                            <p className="mt-1 text-xs leading-5 text-white">{current.verificationReason}</p>
                        </div>
                    ) : null}
                    {hasProofAttemptsLeft(current) ? (
                        <p className="text-[10px] font-semibold text-white/55">
                            {remainingProofAttempts(current) === 1
                                ? "1 check left on this Trial"
                                : `${remainingProofAttempts(current)} checks left on this Trial`}
                        </p>
                    ) : (
                        <p className="text-[10px] font-semibold text-orange-400">
                            No checks left. This Trial cannot be submitted again.
                        </p>
                    )}
                </div>
            ) : null}
        </>
    );

    /** WHAT YOU GET — the reason to do it, folded to one row once it is under way. */
    const benefitBand = current.userBenefit.trim() ? (
        <Band accent={NEON}>
            <button
                type="button"
                onClick={() => setShowsBenefit((value) => !value)}
                aria-expanded={showsBenefit}
                aria-label={showsBenefit ? "Hide what you get" : "Show what you get"}
                className="flex min-h-8 w-full items-center gap-2 text-left"
            >
                <Eyebrow>What you get</Eyebrow>
                <span aria-hidden="true" className="ml-auto text-[10px] font-bold text-white/40">{showsBenefit ? "▴" : "▾"}</span>
            </button>
            {showsBenefit ? <p className="text-sm leading-6 text-white">{current.userBenefit}</p> : null}
        </Band>
    ) : null;

    /**
     * WHY THIS TRIAL — one row, closed.
     *
     * This is the most interesting part of the product and the least urgent
     * part of the screen: nobody needs the bridge from the Principle, or the
     * biology behind it, in order to do the thing.
     */
    const whyBand = (
        <section className="relative border-b border-white/[0.08] bg-white/[0.03] px-5 py-5" style={{boxShadow: `inset 3px 0 0 ${accent}8C`}}>
            <button
                type="button"
                onClick={() => setShowsWhy((value) => !value)}
                aria-expanded={showsWhy}
                className="flex min-h-8 w-full items-center gap-2 text-left"
            >
                <Eyebrow>Why this Trial</Eyebrow>
                <span className="ml-auto rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em]" style={{color: accent, backgroundColor: `${accent}29`}}>
                    {current.speciesDisplayName}
                </span>
                <span aria-hidden="true" className="text-[10px] font-bold text-white/40">{showsWhy ? "▴" : "▾"}</span>
            </button>
            {showsWhy ? (
                <>
                    {current.principleLink ? (
                        <p className="mt-3 text-sm leading-6 text-white">{current.principleLink}</p>
                    ) : null}
                    <p className="mt-2 text-xs leading-5 text-white/55">{current.whyThisAnimal}</p>
                </>
            ) : null}
        </section>
    );

    /** Ask AnimalDex about this Trial: its meaning, an example, how to start. */
    const askBand = (
        <section className="relative flex flex-col gap-3 border-b border-white/[0.08] bg-white/[0.03] px-5 py-5" style={{boxShadow: `inset 3px 0 0 ${NEON}8C`}}>
            <div className="flex items-center gap-2">
                <span aria-hidden="true" className="text-xs" style={{color: NEON}}>✦</span>
                <Eyebrow color={NEON}>Ask AnimalDex</Eyebrow>
            </div>
            <p className="text-sm leading-6 text-white/70">Ask what this Trial means and for examples.</p>
            <div className="flex flex-wrap gap-2">
                {TRIAL_ASK_SUGGESTIONS.map((suggestion) => (
                    <button
                        key={suggestion.title}
                        type="button"
                        onClick={() => openAsk(suggestion.prompt)}
                        className="min-h-9 rounded-full border border-white/10 bg-black/25 px-3 text-xs font-semibold text-white/80 transition hover:border-white/25 hover:text-white"
                    >
                        {suggestion.title}
                    </button>
                ))}
            </div>
            <button
                type="button"
                onClick={() => openAsk()}
                className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 text-left text-sm text-white/55"
            >
                Ask about this Trial…
                <span aria-hidden="true" className="font-black" style={{color: NEON}}>→</span>
            </button>
        </section>
    );

    const viewerHasPostedThisTrial = complete
        || (!hasProofAttemptsLeft(current) && (current.status === "active" || current.status === "proof_submitted"));

    /** What other people submitted for this exact Trial. */
    const otherAttemptsBand = (
        <section className="relative flex flex-col gap-3 border-b border-white/[0.08] bg-white/[0.02] px-5 py-5" style={{boxShadow: `inset 3px 0 0 ${accent}8C`}}>
            <div className="flex items-center gap-2">
                <Eyebrow>Other attempts</Eyebrow>
                {otherAttempts?.length ? (
                    <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-black text-white/70">{otherAttempts.length}</span>
                ) : null}
            </div>
            {otherAttempts == null ? (
                <p className="text-xs text-white/40">Looking for attempts…</p>
            ) : otherAttempts.length === 0 ? (
                <p className="text-xs text-white/55">
                    {viewerHasPostedThisTrial ? "No other attempts yet." : "No attempts yet. You'll be the first."}
                </p>
            ) : (
                <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {otherAttempts.map((attempt) => (
                        <Link
                            key={attempt.id}
                            href={discoverPostPath(attempt.id)}
                            aria-label={`${attempt.collector.name}. ${attempt.isFailed ? "Failed." : "Completed."}`}
                            className="flex w-[148px] shrink-0 flex-col gap-1.5"
                        >
                            <span className="relative block h-[168px] w-[148px] overflow-hidden rounded-xl bg-white/[0.04]">
                                {attempt.evidenceSrc ? (
                                    <AnimalTrialEvidence item={attempt} />
                                ) : (
                                    <span className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#0a1f0f_0%,#161616_55%,#000_100%)] text-2xl text-white/50">
                                        {attempt.proofType === "text" || attempt.proofType === "application" ? "≡" : "▣"}
                                    </span>
                                )}
                            </span>
                            <span className="truncate text-xs font-semibold text-white">{attempt.collector.name}</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.1em]" style={{color: attempt.isFailed ? "#FB923C" : NEON}}>
                                {attempt.isFailed ? "Failed" : "Completed"}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );

    return (
        // Above the floating Ask AnimalDex pill (z-55), which otherwise sits on
        // top of the action bar and covers the one button this sheet is for.
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Animal Trial"
            className="fixed inset-0 z-[58] flex flex-col bg-black"
        >
            {/* While this sheet is open, Ask AnimalDex is about this Trial. */}
            <AskTrialBridge trialContext={trialAskBrief(current)} trialKey={trialAskKey(current)} name={current.speciesDisplayName} />

            <header className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3">
                <span className="text-[10px] font-black uppercase tracking-[0.13em] text-white/55">Animal Trial</span>
                {/* Never a dead end: every presented surface closes. */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white"
                >
                    ✕
                </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {/* Hero */}
                <section className="border-b border-white/[0.08] bg-white/[0.015] px-5 pb-6 pt-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{color: accent}}>
                        {frequencyBadge(current.frequency)}
                    </p>
                    <h2 className="mt-2 font-display text-3xl font-black leading-tight text-white">{current.title}</h2>
                    <p className="mt-2 text-xs text-white/55">{frequencyCharacter(current.frequency)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Pill color={NEON}>⚡ {rewardSummary}</Pill>
                        <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-white/70">
                            ~{current.estimatedMinutes} min
                        </span>
                        {current.completionWindowMinutes != null ? (
                            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-white/70">
                                {current.completionWindowMinutes} min window
                            </span>
                        ) : null}
                    </div>
                </section>

                {complete ? (
                    <>
                        <section className="border-b border-white/[0.08] bg-white/[0.03] px-5 py-6" style={{boxShadow: `inset 3px 0 0 ${NEON}8C`}}>
                            <p className="text-[10px] font-black uppercase tracking-[0.13em]" style={{color: NEON}}>Trial complete</p>
                            <p className="mt-2 text-xl font-bold uppercase text-white">{current.speciesDisplayName}</p>
                            <p className="mt-1 text-xs text-white/55">{frequencyBadge(current.frequency)} · {current.title}</p>
                            <p className="mt-3 text-3xl font-black" style={{color: NEON}}>+{current.rewardXPAwarded} XP</p>
                            {submission.image || submission.text ? (
                                <div className="mt-4"><SubmittedEvidence submission={submission} /></div>
                            ) : null}
                            {current.verificationReason?.trim() ? (
                                <div className="mt-4">
                                    <Eyebrow color={NEON}>Why it counted</Eyebrow>
                                    <p className="mt-1 text-sm leading-6 text-white/85">{current.verificationReason}</p>
                                </div>
                            ) : null}
                            {current.completedAt ? (
                                <p className="mt-3 text-[10px] text-white/40">
                                    Completed {new Date(current.completedAt).toLocaleString()}
                                </p>
                            ) : null}
                            <p className="mt-1 text-[10px] text-white/40">You can only earn this one once.</p>
                        </section>
                        {whyBand}
                        {benefitBand}
                    </>
                ) : (
                    <>
                        {/* State first when there IS state — armed, running, missed.
                            A Trial nobody has started has no state to report. */}
                        {current.status === "pending_activation" ? (
                            <Band accent={accent}>
                                <Eyebrow color={accent}>Armed</Eyebrow>
                                <p className="text-sm text-white">
                                    This Trial will go live at a random moment in the next {current.activationWindowHours ?? 24} hours.
                                </p>
                                <p className="text-xs text-white/55">
                                    You&rsquo;ll get a notification. Miss it and nothing happens — no penalty, nothing lost.
                                </p>
                            </Band>
                        ) : current.status === "expired" || current.status === "abandoned" ? (
                            <Band accent="#FB923C">
                                <p className="text-sm font-bold text-white">Trial window ended.</p>
                                <p className="text-xs text-white/55">
                                    Nothing lost — no XP, no streak, nothing. Start it again whenever you like.
                                </p>
                            </Band>
                        ) : submittable && timed ? (
                            <Band accent={accent}>
                                <div className="flex items-center justify-between gap-3">
                                    <Eyebrow color={accent}>
                                        {current.frequency === "HIGH" ? "⚡ Trial active" : "Trial active"}
                                    </Eyebrow>
                                    {seconds != null ? (
                                        <span
                                            className="font-mono text-xl font-black tabular-nums"
                                            style={{color: seconds < 120 ? "#FB923C" : accent}}
                                        >
                                            {countdownLabel(seconds)}
                                        </span>
                                    ) : null}
                                </div>
                                <p className="text-[10px] text-white/40">remaining in your window</p>
                            </Band>
                        ) : submittable ? (
                            <Band accent={accent}>
                                <div className="flex items-center justify-between gap-3">
                                    <Eyebrow color={accent}>Trial active</Eyebrow>
                                    <span className="text-[10px] font-bold text-white/55">∞ No time limit</span>
                                </div>
                                <p className="text-xs text-white/55">
                                    Take as long as you need. Nothing expires and nothing is lost if you leave it.
                                </p>
                            </Band>
                        ) : isRandomlyActivated(current) ? (
                            <Band accent={accent}>
                                <p className="text-sm leading-6 text-white">
                                    Activate it, then carry on with your day. It goes live at a moment you won&rsquo;t see coming.
                                </p>
                            </Band>
                        ) : null}

                        {benefitBand}

                        {/* The action, and the one constraint that qualifies it. The
                            safety note is NOT behind the tap: nothing a person needs
                            in order to not hurt themselves is ever one tap away. */}
                        <Band accent={accent}>
                            <div className="flex items-center gap-1.5">
                                <Eyebrow>What to do</Eyebrow>
                                {current.animalRule.trim() ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowsRule((value) => !value)}
                                        aria-expanded={showsRule}
                                        className="ml-auto inline-flex min-h-8 items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em]"
                                        style={{color: accent}}
                                    >
                                        The rule
                                        <span aria-hidden="true" className="grid h-4 w-4 place-items-center rounded-full border text-[9px] normal-case" style={{borderColor: `${accent}8C`}}>i</span>
                                    </button>
                                ) : null}
                            </div>
                            <p className="text-base font-bold leading-6 text-white">{current.instructions}</p>
                            {showsRule ? <p className="text-sm leading-6 text-white/70">{current.animalRule}</p> : null}
                            {safetyNote(current) ? (
                                <p className="text-[10px] text-orange-400">✋ {safetyNote(current)}</p>
                            ) : null}
                        </Band>

                        {/* The answer box for a text Trial. It replaces the camera
                            entirely rather than sitting beside it: a Trial whose
                            proof_types is {text} rejects a photo server-side. */}
                        {written && submittable && canAttempt ? (
                            <Band accent={accent}>
                                <Eyebrow>Your answer</Eyebrow>
                                <textarea
                                    value={textAnswer}
                                    onChange={(event) => setTextAnswer(event.target.value.slice(0, MAX_TEXT_PROOF_CHARACTERS))}
                                    maxLength={MAX_TEXT_PROOF_CHARACTERS}
                                    rows={5}
                                    aria-label="Your answer"
                                    className="min-h-[120px] w-full resize-y rounded-[14px] border bg-black/25 p-2.5 text-sm leading-6 text-white outline-none"
                                    style={{borderColor: `${accent}4D`}}
                                />
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[10px] text-white/40">
                                        {trimmedAnswer ? `${trimmedAnswer.length} characters` : "Write what you did."}
                                    </span>
                                    {!hasEnoughAnswer && trimmedAnswer ? (
                                        <span className="text-[10px] font-bold text-orange-400">A little more</span>
                                    ) : null}
                                </div>
                            </Band>
                        ) : null}

                        {/* PROOF: one row until it is the task. */}
                        <Band accent={accent}>
                            {submittable ? (
                                <>
                                    {proofHeadline}
                                    {proofDetail}
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setShowsProof((value) => !value)}
                                        aria-expanded={showsProof}
                                        className="min-h-8 w-full text-left"
                                    >
                                        {proofHeadline}
                                    </button>
                                    {showsProof ? proofDetail : null}
                                </>
                            )}
                        </Band>

                        {whyBand}
                    </>
                )}

                {askBand}
                {otherAttemptsBand}

                <div className="h-6" />
            </div>

            {/* Action bar */}
            {!complete ? (
                <div className="border-t border-white/[0.08] bg-black/80 px-4 py-3 backdrop-blur">
                    {!canAttempt ? (
                        <p className="mb-2 text-center text-[10px] text-white/55">{NOT_YET_CAPTURED_NOTE}</p>
                    ) : null}
                    {errorMessage ? (
                        <p className="mb-2 text-center text-[10px] text-orange-400">{errorMessage}</p>
                    ) : null}
                    {verification && !isApproved(verification) ? (
                        <p className="mb-2 text-center text-xs text-orange-400">{verification.reason}</p>
                    ) : null}
                    <button
                        type="button"
                        onClick={primaryAction}
                        disabled={actionDisabled}
                        className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full text-base font-black disabled:cursor-not-allowed ${canAttempt ? "text-black/90" : "text-white/60"}`}
                        style={{backgroundColor: actionDisabled ? "rgba(255,255,255,0.14)" : accent}}
                    >
                        {isWorking ? "…" : null}
                        {!canAttempt ? <span aria-hidden="true">🔒</span> : null}
                        {actionTitle}
                    </button>
                </div>
            ) : null}

            {/* The camera input is the live-capture route; the library input is
                offered only for a screenshot Trial. */}
            <input
                ref={cameraInputRef}
                type="file"
                accept={requiresVideo(current) ? "video/*" : "image/*"}
                capture="environment"
                className="hidden"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void submitEvidence(file);
                }}
            />
            <input
                ref={libraryInputRef}
                type="file"
                accept={requiresVideo(current) ? "video/*" : "image/*"}
                className="hidden"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void submitEvidence(file);
                }}
            />
        </div>
    );
}
