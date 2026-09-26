"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {
    type AnimalTrial,
    type AnimalTrialVerificationResult,
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
    primaryActionTitle,
    remainingProofAttempts,
    remainingSeconds,
    requiresVideo,
    rewardCreditsDisplay,
    rewardXP,
    safetyNote,
    socialProofText,
    wasRejected
} from "@/lib/animal-trials";
import {extractTrialFrames} from "@/lib/animal-trial-frames";

/**
 * One Trial, full screen. Ported from iOS `AnimalTrialDetailView`.
 *
 * Every section is a full-bleed band divided by a hairline, not a rounded card
 * in a gutter: this is a page about one thing, not a list of widgets.
 */

const NEON = "#A7F432";

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

export default function AnimalTrialDetail({
    trial,
    onChange,
    onClose
}: {
    trial: AnimalTrial;
    onChange: (trial: AnimalTrial) => void;
    onClose: () => void;
}) {
    const [current, setCurrent] = useState(trial);
    const [isWorking, setIsWorking] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [verification, setVerification] = useState<AnimalTrialVerificationResult | null>(null);
    const [showsWhy, setShowsWhy] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const libraryInputRef = useRef<HTMLInputElement>(null);

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

    const apply = useCallback((updated: AnimalTrial | null) => {
        if (!updated) return;
        setCurrent(updated);
        onChange(updated);
    }, [onChange]);

    const runLifecycle = useCallback(async (action: "start" | "restart") => {
        setIsWorking(true);
        setErrorMessage(null);
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
                setErrorMessage(payload.error ?? "That could not be completed. Try again in a moment.");
                return;
            }
            apply(payload.trial);
        } catch {
            setErrorMessage("That could not be completed. Try again in a moment.");
        } finally {
            setIsWorking(false);
        }
    }, [apply, current.frequency, current.speciesProfileId]);

    const submitEvidence = useCallback(async (file: File) => {
        setIsWorking(true);
        setErrorMessage(null);
        setVerification(null);
        try {
            const video = requiresVideo(current);
            const form = new FormData();
            form.set("speciesProfileId", current.speciesProfileId);
            form.set("frequency", current.frequency);
            form.set("proofType", video ? "video" : "photo");
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

            setVerification(payload.verification ?? null);
            apply(payload.trial);
        } catch {
            setErrorMessage("Could not check that evidence. Try again in a moment.");
        } finally {
            setIsWorking(false);
        }
    }, [apply, current]);

    const outOfAttempts = !complete && canSubmitEvidence(current) && !hasProofAttemptsLeft(current);
    const actionTitle = outOfAttempts ? "NO CHECKS LEFT" : primaryActionTitle(current);
    const actionDisabled = isWorking || current.status === "pending_activation" || outOfAttempts;

    const primaryAction = () => {
        switch (current.status) {
            case "notStarted":
                void runLifecycle("start");
                break;
            case "active":
            case "proof_submitted":
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

    const whyBand = (
        <section className="relative border-b border-white/[0.08] bg-white/[0.03] px-5 py-5" style={{boxShadow: `inset 3px 0 0 ${accent}8C`}}>
            <div className="flex items-center justify-between gap-3">
                <Eyebrow>Why this Trial</Eyebrow>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em]" style={{color: accent, backgroundColor: `${accent}29`}}>
                    {current.principleName}
                </span>
            </div>
            {current.principleLink ? (
                <p className="mt-3 text-sm leading-6 text-white">{current.principleLink}</p>
            ) : null}
            <button
                type="button"
                onClick={() => setShowsWhy((value) => !value)}
                aria-expanded={showsWhy}
                className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-[10px] font-bold"
                style={{color: accent}}
            >
                {showsWhy ? "Hide the biology" : "What the animal actually does"}
                <span aria-hidden="true">{showsWhy ? "▴" : "▾"}</span>
            </button>
            {showsWhy ? <p className="mt-2 text-xs leading-5 text-white/55">{current.whyThisAnimal}</p> : null}
        </section>
    );

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Animal Trial"
            className="fixed inset-0 z-50 flex flex-col bg-black"
        >
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
                    <p className="mt-2 text-xs text-white/55">
                        {current.speciesDisplayName} · {current.principleName}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {/* An ESTIMATE, never a limit. Only HIGH has a limit, and it says so in its own band. */}
                        <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-white/70">
                            ~{current.estimatedMinutes} min to do
                        </span>
                        <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-white/70">
                            {requiresVideo(current) ? "Video proof" : "Photo proof"}
                        </span>
                    </div>
                </section>

                {complete ? (
                    <>
                        <section className="border-b border-white/[0.08] bg-white/[0.03] px-5 py-6">
                            <p className="text-[10px] font-black uppercase tracking-[0.13em]" style={{color: NEON}}>Trial complete</p>
                            <p className="mt-2 text-xl font-bold uppercase text-white">{current.speciesDisplayName}</p>
                            <p className="mt-1 text-xs text-white/55">{frequencyBadge(current.frequency)} · {current.title}</p>
                            <p className="mt-3 text-3xl font-black" style={{color: NEON}}>+{current.rewardXPAwarded} XP</p>
                            {current.completedAt ? (
                                <p className="mt-2 text-[10px] text-white/40">
                                    Completed {new Date(current.completedAt).toLocaleString()}
                                </p>
                            ) : null}
                            <p className="mt-1 text-[10px] text-white/40">You can only earn this one once.</p>
                        </section>
                        {whyBand}
                    </>
                ) : (
                    <>
                        {/* The reason to do it at all, in the person's own terms. */}
                        {current.userBenefit ? (
                            <Band accent={NEON}>
                                <Eyebrow>What you get</Eyebrow>
                                <p className="text-sm leading-6 text-white">{current.userBenefit}</p>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    <Pill color={NEON}>+{rewardXP(current)} XP</Pill>
                                    {rewardCreditsDisplay(current) > 0 ? (
                                        <Pill color={NEON}>+{rewardCreditsDisplay(current)} Credits</Pill>
                                    ) : null}
                                    {!timed ? <Pill color={NEON}>No time limit</Pill> : null}
                                </div>
                            </Band>
                        ) : null}

                        {whyBand}

                        {/* State */}
                        <Band accent={accent}>
                            {current.status === "pending_activation" ? (
                                <>
                                    <Eyebrow color={accent}>Armed</Eyebrow>
                                    <p className="text-sm text-white">
                                        This Trial will go live at a random moment in the next {current.activationWindowHours ?? 24} hours.
                                    </p>
                                    <p className="text-xs text-white/55">
                                        You&rsquo;ll get a notification. Miss it and nothing happens — no penalty, nothing lost.
                                    </p>
                                </>
                            ) : current.status === "expired" ? (
                                <>
                                    <p className="text-sm font-bold text-white">Trial window ended.</p>
                                    <p className="text-xs text-white/55">
                                        Nothing lost — no XP, no streak, nothing. Start it again whenever you like.
                                    </p>
                                </>
                            ) : canSubmitEvidence(current) && timed ? (
                                <>
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
                                    {current.verificationReason && current.verificationStatus !== "approved" ? (
                                        <p className="text-xs text-orange-400">{current.verificationReason}</p>
                                    ) : null}
                                </>
                            ) : canSubmitEvidence(current) ? (
                                <>
                                    {/* Untimed and under way. No clock, and it says so. */}
                                    <div className="flex items-center justify-between gap-3">
                                        <Eyebrow color={accent}>Trial active</Eyebrow>
                                        <span className="text-[10px] font-bold text-white/55">∞ No time limit</span>
                                    </div>
                                    <p className="text-xs text-white/55">
                                        Take as long as you need. Nothing expires and nothing is lost if you leave it.
                                    </p>
                                    {current.verificationReason && current.verificationStatus !== "approved" ? (
                                        <p className="text-xs text-orange-400">{current.verificationReason}</p>
                                    ) : null}
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-white">{frequencyCharacter(current.frequency)}</p>
                                    {isRandomlyActivated(current) ? (
                                        <p className="text-xs text-white/55">
                                            Activate it, then carry on with your day. It goes live at a moment you won&rsquo;t see coming.
                                        </p>
                                    ) : null}
                                </>
                            )}
                        </Band>

                        <Band accent={accent}>
                            <Eyebrow>Do</Eyebrow>
                            <p className="text-base font-bold leading-6 text-white">{current.instructions}</p>
                        </Band>

                        <Band accent={accent}>
                            <Eyebrow color={accent}>The rule</Eyebrow>
                            <p className="text-sm leading-6 text-white">{current.animalRule}</p>
                            {safetyNote(current) ? (
                                <p className="text-[10px] text-orange-400">✋ {safetyNote(current)}</p>
                            ) : null}
                        </Band>

                        {/* Proof */}
                        <Band accent={accent}>
                            <Eyebrow>Proof</Eyebrow>
                            <p className="text-sm leading-6 text-white">{current.proofPrompt}</p>
                            {current.successCriteria.map((criterion) => (
                                <p key={criterion} className="text-[10px] text-white/55">✓ {criterion}</p>
                            ))}
                            {/* Completing a Trial is public. Saying that here, before anyone
                                uploads anything, is the only honest place to say it. */}
                            <p className="text-[10px] text-white/40">🌐 Completing this shares it to Discover.</p>
                            {socialProofText(current) ? (
                                <p className="text-[10px]" style={{color: NEON}}>{socialProofText(current)}</p>
                            ) : null}

                            {/* The checker's verdict and the budget, both of which used to be invisible. */}
                            {current.proofAttemptCount > 0 || wasRejected(current) ? (
                                <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.08] pt-3">
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
                        </Band>
                    </>
                )}

                <div className="h-6" />
            </div>

            {/* Action bar */}
            {!complete ? (
                <div className="border-t border-white/[0.08] bg-black/80 px-4 py-3 backdrop-blur">
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
                        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full text-base font-black text-black/90 disabled:cursor-not-allowed"
                        style={{backgroundColor: actionDisabled ? "rgba(255,255,255,0.14)" : accent}}
                    >
                        {isWorking ? "…" : null}
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
