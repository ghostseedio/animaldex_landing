"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    type AnimalPower,
    type PowerApplicationEvidenceType,
    type PowerApplicationResult,
    OFFERED_APPLICATION_DOMAINS,
    POWER_APPLICATION_EVIDENCE,
    POWER_APPLICATION_LIMITS,
    applicationDomainShortlist,
    powerRefusalMessage
} from "@/lib/animal-powers";
import {extractTrialFrames} from "@/lib/animal-trial-frames";
import {type SystemDynamicsDomain, domainDisplayTitle} from "@/lib/system-dynamics";
import type {AnimalTrial} from "@/lib/animal-trials";
import {journalAskBrief, journalAskKey, journalAskSuggestions} from "@/lib/animal-trial-ask";
import {AskTrialBridge, useAskAnimalDex} from "@/components/ask-animaldex/ask-animaldex-provider";

/**
 * The written route to an Animal Power, ported from iOS `ApplyItYourWayView`:
 * pick where in your life it applies, say what you actually did, and a reviewer
 * decides whether that is this Power's pattern.
 *
 * This route exists for two reasons, and the second is the stronger one. The
 * first is that a person can love a Power and have no interest in a
 * manufactured challenge. The second is arithmetic: 729 species have a Power
 * and no authored Trial, so for those animals this is not an alternative — it
 * is the only way in.
 */

const NEON = "#A7F432";
const ORANGE = "#FB923C";

function Band({accent = NEON, children}: {accent?: string; children: React.ReactNode}) {
    return (
        <section
            className="relative flex flex-col gap-2.5 border-b border-white/[0.08] bg-white/[0.03] px-5 py-5"
            style={{boxShadow: `inset 3px 0 0 ${accent}8C`}}
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

/** What is attached: one photo, or the frames sampled from a video. */
type AttachedEvidence = {
    type: PowerApplicationEvidenceType;
    files: File[];
    /** Object URL of the photo, or of the first sampled frame of a video. */
    previewUrl: string;
};

/**
 * Turns a picked file into evidence. Only frames of a video are kept; the clip
 * itself is never uploaded. Throws with the copy to show when it cannot be used.
 */
async function prepareEvidence(file: File): Promise<AttachedEvidence> {
    if (file.type.startsWith("video/")) {
        const frames = await extractTrialFrames(file, POWER_APPLICATION_EVIDENCE.frameCount, {
            firstFraction: POWER_APPLICATION_EVIDENCE.firstFrameFraction,
            lastFraction: POWER_APPLICATION_EVIDENCE.lastFrameFraction,
            maxLongEdge: POWER_APPLICATION_EVIDENCE.maxLongEdge,
            quality: POWER_APPLICATION_EVIDENCE.jpegQuality
        }).catch(() => [] as File[]);
        if (frames.length < POWER_APPLICATION_EVIDENCE.minFrames) {
            throw new Error(powerRefusalMessage("video_frames_required"));
        }
        return {type: "video", files: frames, previewUrl: URL.createObjectURL(frames[0])};
    }
    // The bucket takes JPEG, PNG and WebP only.
    if (!POWER_APPLICATION_EVIDENCE.photoTypes.includes(file.type)) {
        throw new Error(powerRefusalMessage("evidence_download_failed"));
    }
    return {type: "photo", files: [file], previewUrl: URL.createObjectURL(file)};
}

export default function ApplyItYourWay({
    power,
    trial = null,
    onFinished,
    onClose
}: {
    power: AnimalPower;
    /** The Arena Trial this writing stands in for; null on the Power page. */
    trial?: AnimalTrial | null;
    /**
     * Called with the result once the reviewer has answered, so the caller can
     * refresh the earned state it is showing.
     */
    onFinished: (result: PowerApplicationResult, power: AnimalPower | null) => void;
    onClose: () => void;
}) {
    const [selectedDomain, setSelectedDomain] = useState<SystemDynamicsDomain | null>(null);
    const [account, setAccount] = useState("");
    const [isWorking, setIsWorking] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [result, setResult] = useState<PowerApplicationResult | null>(null);
    const [showsAllDomains, setShowsAllDomains] = useState(false);
    /** The server said this Power is already held, so another write-up is not accepted. */
    const [earnedLocally, setEarnedLocally] = useState(false);
    const {open: openAsk} = useAskAnimalDex();
    const [evidence, setEvidence] = useState<AttachedEvidence | null>(null);
    const [isPreparingEvidence, setIsPreparingEvidence] = useState(false);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const libraryInputRef = useRef<HTMLInputElement>(null);

    // Each preview is an object URL; release it once it is replaced or the sheet closes.
    useEffect(() => {
        const url = evidence?.previewUrl;
        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [evidence]);

    const attachEvidence = useCallback(async (file: File) => {
        setIsPreparingEvidence(true);
        setErrorMessage(null);
        try {
            setEvidence(await prepareEvidence(file));
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : powerRefusalMessage("evidence_download_failed"));
        } finally {
            setIsPreparingEvidence(false);
        }
    }, []);

    const trimmed = account.trim();
    const hasEnough = trimmed.length >= POWER_APPLICATION_LIMITS.minCharacters;
    const isApproved = result?.verdict === "approved";
    const isRevisable = result?.verdict === "needs_more";
    const holdsPower = power.isEarned || earnedLocally || isApproved;
    const journalDomain = selectedDomain ?? power.suggestedDomains[0] ?? "HUMAN_BEHAVIOR";
    const journalDomainTitle = domainDisplayTitle(journalDomain);

    // The shortlist, then everything, once More is tapped. A domain the person
    // already picked is always visible, so collapsing cannot hide their choice.
    const visibleDomains = useMemo(() => {
        if (showsAllDomains) return OFFERED_APPLICATION_DOMAINS;
        const shortlist = applicationDomainShortlist(power);
        if (selectedDomain && !shortlist.includes(selectedDomain)) shortlist.push(selectedDomain);
        return shortlist;
    }, [power, selectedDomain, showsAllDomains]);

    const submit = useCallback(async () => {
        if (!selectedDomain) return;
        if (!evidence) {
            setErrorMessage(powerRefusalMessage("evidence_required"));
            return;
        }
        setIsWorking(true);
        setErrorMessage(null);
        try {
            const form = new FormData();
            form.set("speciesProfileId", power.speciesProfileId);
            form.set("domain", selectedDomain);
            form.set("account", trimmed);
            form.set("evidenceType", evidence.type);
            if (evidence.type === "photo") form.set("evidence", evidence.files[0]);
            else for (const frame of evidence.files) form.append("frames", frame);

            const response = await fetch("/api/app/animal-powers/application", {method: "POST", body: form});
            const payload = await response.json().catch(() => ({}));

            if (response.status === 401) {
                // Reading a Power is open to everyone; earning one is the point an
                // account is needed, so send them to sign in and back again.
                const next = `${window.location.pathname}${window.location.search}`;
                window.location.assign(`/account?next=${encodeURIComponent(next)}`);
                return;
            }

            if (!response.ok) {
                // Already held: nothing to send again, and nothing was spent.
                if (payload.code === "already_earned") {
                    setEarnedLocally(true);
                    setErrorMessage(null);
                    return;
                }
                setErrorMessage(payload.error ?? "Could not send that for review. Try again in a moment.");
                return;
            }

            const outcome = payload.result as PowerApplicationResult;
            setResult(outcome);
            onFinished(outcome, payload.power ?? null);
        } catch {
            setErrorMessage("Could not send that for review. Try again in a moment.");
        } finally {
            setIsWorking(false);
        }
    }, [evidence, onFinished, power.speciesProfileId, selectedDomain, trimmed]);

    const actionTitle = holdsPower
        ? "DONE"
        : !selectedDomain
            ? "PICK AN AREA"
            : result ? "SEND AGAIN" : "SEND FOR REVIEW";
    const isDisabled = holdsPower
        ? false
        : isWorking || isPreparingEvidence || !selectedDomain || !hasEnough || !evidence;
    const needsEvidenceHint = !holdsPower && Boolean(selectedDomain) && hasEnough && !evidence;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Apply It Your Way"
            className="fixed inset-0 z-[59] flex flex-col bg-black"
        >
            <header className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3">
                <span className="text-[10px] font-black uppercase tracking-[0.13em] text-white/55">Apply It Your Way</span>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white"
                >
                    ✕
                </button>
            </header>

            {/* While this sheet is open, Ask AnimalDex helps with the writing. */}
            <AskTrialBridge
                trialContext={journalAskBrief({power, trial, domainTitle: journalDomainTitle})}
                trialKey={journalAskKey(power.speciesProfileId, trial)}
                name={trial?.speciesDisplayName ?? power.speciesDisplayName}
            />

            <div className="min-h-0 flex-1 overflow-y-auto">
                <section className="flex flex-col gap-2 border-b border-white/[0.08] bg-white/[0.025] px-5 pb-[22px] pt-[18px]">
                    <Eyebrow color={NEON}>{power.speciesDisplayName}</Eyebrow>
                    <h2 className="font-display text-3xl font-black leading-tight text-white">{power.principleName}</h2>
                    {power.coreLesson ? (
                        <p className="text-sm leading-6 text-white/60">{power.coreLesson}</p>
                    ) : null}
                    {trial ? (
                        <>
                            <p className="mt-1 text-sm font-semibold leading-6 text-white">{trial.title}</p>
                            <p className="text-[10px] text-white/40">Write what you did, instead of doing the Trial.</p>
                        </>
                    ) : null}
                </section>

                {holdsPower && !(isApproved && result) ? (
                    <Band>
                        <span aria-hidden="true" className="text-3xl" style={{color: NEON}}>✓</span>
                        <Eyebrow color={NEON}>Already earned</Eyebrow>
                        <p className="text-sm leading-6 text-white">You have already earned this Power. Another write-up is not accepted.</p>
                    </Band>
                ) : isApproved && result ? (
                    <Band>
                        <span aria-hidden="true" className="text-3xl" style={{color: NEON}}>✓</span>
                        <Eyebrow color={NEON}>Power earned</Eyebrow>
                        <p className="text-2xl font-bold text-white">{power.principleName}</p>
                        {/* The grader's own quote, handed back. Being told the
                            specific thing you did is the whole reward; "approved"
                            is not. */}
                        {result.quotedAction ? (
                            <p className="text-sm font-semibold leading-6 text-white">“{result.quotedAction}”</p>
                        ) : null}
                        <p className="text-xs leading-5 text-white/60">{result.reason}</p>
                        <p className="text-[10px] text-white/40">
                            You discovered it from the {power.speciesDisplayName}. Now you have used it.
                        </p>
                    </Band>
                ) : (
                    <>
                        {/* Six choices and a More, not a wall of eighteen. */}
                        <Band>
                            <Eyebrow>Where did you use this Power?</Eyebrow>
                            <div className="flex flex-wrap gap-2">
                                {visibleDomains.map((domain) => {
                                    const selected = selectedDomain === domain;
                                    return (
                                        <button
                                            key={domain}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => setSelectedDomain(selected ? null : domain)}
                                            className={`min-h-9 rounded-full px-3 text-xs ${selected ? "font-bold text-black" : "bg-black/25 font-medium text-white/60"}`}
                                            style={selected ? {backgroundColor: NEON} : undefined}
                                        >
                                            {domainDisplayTitle(domain)}
                                        </button>
                                    );
                                })}
                            </div>
                            {!showsAllDomains ? (
                                <button
                                    type="button"
                                    onClick={() => setShowsAllDomains(true)}
                                    aria-label="Show all areas"
                                    className="inline-flex min-h-8 w-fit items-center gap-1.5 text-xs font-bold"
                                    style={{color: NEON}}
                                >
                                    More <span aria-hidden="true">▾</span>
                                </button>
                            ) : null}
                        </Band>

                        {/* Help with the writing itself: how to journal it, what
                            to include, an example in the chosen area. */}
                        <section className="relative flex flex-col gap-3 border-b border-white/[0.08] bg-white/[0.03] px-5 py-5" style={{boxShadow: `inset 3px 0 0 ${NEON}8C`}}>
                            <div className="flex items-center gap-2">
                                <span aria-hidden="true" className="text-xs" style={{color: NEON}}>✦</span>
                                <Eyebrow color={NEON}>Ask AnimalDex</Eyebrow>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {journalAskSuggestions(journalDomainTitle, trial).map((suggestion) => (
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
                                Ask how to write this…
                                <span aria-hidden="true" className="font-black" style={{color: NEON}}>→</span>
                            </button>
                        </section>

                        {selectedDomain ? (
                            <Band>
                                <Eyebrow>What did you do?</Eyebrow>
                                {/* The prompt asks for the one thing, not for
                                    reflection. People write what they are asked for,
                                    and an account with no action in it cannot be
                                    approved however sincere it is. */}
                                <p className="text-sm leading-6 text-white">One thing you actually did, and what changed after.</p>
                                <textarea
                                    value={account}
                                    onChange={(event) => setAccount(event.target.value.slice(0, POWER_APPLICATION_LIMITS.maxCharacters))}
                                    maxLength={POWER_APPLICATION_LIMITS.maxCharacters}
                                    rows={7}
                                    aria-label="What did you do?"
                                    className="min-h-[160px] w-full resize-y rounded-[14px] border border-primary-400/30 bg-black/25 p-2.5 text-sm leading-6 text-white outline-none"
                                />
                                <div className="flex items-center justify-between gap-3">
                                    <span className={`text-[10px] ${hasEnough ? "text-white/40" : "text-orange-400"}`}>
                                        {hasEnough
                                            ? `${trimmed.length} characters`
                                            : `At least ${POWER_APPLICATION_LIMITS.minCharacters} characters`}
                                    </span>
                                    <span className="text-[10px] text-white/40">📡 Accepted or rejected, this posts to Discover</span>
                                </div>
                            </Band>
                        ) : null}

                        {selectedDomain ? (
                            <Band>
                                <Eyebrow>Add a photo or video</Eyebrow>
                                <p className="text-sm leading-6 text-white">
                                    Show what you did, what you did it to, or how it turned out. A screenshot works if it happened on a screen.
                                </p>
                                {evidence ? (
                                    <div className="flex items-center gap-3">
                                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[14px] border border-white/10 bg-black/25">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={evidence.previewUrl}
                                                alt={evidence.type === "video" ? "Video attached" : "Photo attached"}
                                                className="h-full w-full object-cover"
                                            />
                                            {evidence.type === "video" ? (
                                                <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white">
                                                    Video
                                                </span>
                                            ) : null}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setEvidence(null)}
                                            disabled={isWorking}
                                            className="min-h-9 rounded-full border border-white/10 bg-black/25 px-3 text-xs font-semibold text-white/80 transition hover:border-white/25 hover:text-white disabled:opacity-50"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : null}
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        {title: "Take photo", ref: photoInputRef},
                                        {title: "Record video", ref: videoInputRef},
                                        {title: "Choose from library", ref: libraryInputRef}
                                    ].map((action) => (
                                        <button
                                            key={action.title}
                                            type="button"
                                            onClick={() => action.ref.current?.click()}
                                            disabled={isWorking || isPreparingEvidence}
                                            className="min-h-9 rounded-full border border-white/10 bg-black/25 px-3 text-xs font-semibold text-white/80 transition hover:border-white/25 hover:text-white disabled:opacity-50"
                                        >
                                            {action.title}
                                        </button>
                                    ))}
                                    {isPreparingEvidence ? (
                                        <span aria-live="polite" className="self-center text-[10px] text-white/40">…</span>
                                    ) : null}
                                </div>
                                {[
                                    {ref: photoInputRef, accept: "image/*", capture: true},
                                    {ref: videoInputRef, accept: "video/*", capture: true},
                                    {ref: libraryInputRef, accept: "image/*,video/*", capture: false}
                                ].map((input) => (
                                    <input
                                        key={input.accept}
                                        ref={input.ref}
                                        type="file"
                                        accept={input.accept}
                                        capture={input.capture ? "environment" : undefined}
                                        className="hidden"
                                        onChange={(event) => {
                                            const file = event.target.files?.[0];
                                            event.target.value = "";
                                            if (file) void attachEvidence(file);
                                        }}
                                    />
                                ))}
                            </Band>
                        ) : null}

                        {result ? (
                            <Band accent={isRevisable ? NEON : ORANGE}>
                                <Eyebrow color={isRevisable ? NEON : ORANGE}>{isRevisable ? "Almost" : "Not yet"}</Eyebrow>
                                <p className="text-sm leading-6 text-white">{result.reason}</p>
                                {/* Only a real refusal costs an attempt. A revision
                                    is free, and saying so is what stops people
                                    writing defensively. */}
                                <p className="text-[10px] text-white/60">
                                    {isRevisable
                                        ? "↺ Editing and sending again costs nothing."
                                        : result.rejectionsRemaining === 1
                                            ? "1 more try on this Power"
                                            : `${result.rejectionsRemaining} more tries on this Power`}
                                </p>
                            </Band>
                        ) : null}
                    </>
                )}

                <div className="h-6" />
            </div>

            <div className="border-t border-white/[0.08] bg-black/80 px-[18px] py-3 backdrop-blur">
                {errorMessage ? (
                    <p className="mb-2 text-center text-[10px] text-orange-400">{errorMessage}</p>
                ) : needsEvidenceHint ? (
                    <p className="mb-2 text-center text-[10px] text-white/60">Add a photo or video to submit.</p>
                ) : null}
                <button
                    type="button"
                    onClick={() => {
                        if (holdsPower) onClose();
                        else void submit();
                    }}
                    disabled={isDisabled}
                    className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full text-base font-black text-black/90 disabled:cursor-not-allowed"
                    style={{backgroundColor: isDisabled ? "rgba(255,255,255,0.14)" : NEON}}
                >
                    {isWorking ? "…" : null}
                    {actionTitle}
                </button>
            </div>
        </div>
    );
}
