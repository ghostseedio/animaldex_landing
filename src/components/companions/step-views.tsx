"use client";

/**
 * AnimalDex 3.2 "Your step" (docs/your-step/SPEC.md, section 5), drawn the
 * same in the chat, on the card's Bond tab and on Companions: the step card,
 * the report composer, the earned moment, "Done together", the Trials with
 * their loops, and the private record of what you did together.
 *
 * Edge-to-edge bands, never inset rounded cards. Every word is the SPEC's, in
 * the reader's language (`words.journey`); nothing here is written by the
 * model.
 */

import {useEffect, useMemo, useRef, useState} from "react";
import Image from "next/image";
import TrialMotion from "@/components/trial-motion/trial-motion";
import {useTrialMotionStoryboard} from "@/components/trial-motion/use-trial-motion-storyboard";
import {type AnimalTrial, instructionsPreview, trialId} from "@/lib/animal-trials";
import {fillWords, trialDifficulty, trialDifficultyText, type CompanionWords} from "@/lib/companion-bond";
import {
    isStepVideoFile,
    stepReportReady,
    stepRecordThumbnail,
    type AnimalStep,
    type StepFrequency,
    type StepRecordMedia,
    type StepRecordWithMedia
} from "@/lib/your-step";
import {stepPrimaryLabel} from "@/lib/your-step-words";

const NEON = "#A7F432";

function Eyebrow({children}: {children: React.ReactNode}) {
    return <p className="text-[10px] font-black uppercase tracking-[0.13em] text-primary-300">{children}</p>;
}

// MARK: - The step card

/**
 * The step: under the reply that set it (`inline`), pinned at the top of the
 * chat while open (`pinned`), or on the Bond tab (`band`). Not accepted:
 * "I'll do it" / "Something else". Accepted: "I did it" / "Something else".
 * With a report attached, "I did it" says "Tell {name}" again. A step made
 * from a Trial shows that Trial's loop.
 */
export function StepCard({
    step,
    speciesProfileId,
    name,
    words,
    variant,
    busy = false,
    problem = null,
    onPrimary,
    onOther
}: {
    step: AnimalStep;
    speciesProfileId: string | null;
    /** "Leo", or the animal. */
    name: string;
    words: CompanionWords;
    variant: "inline" | "pinned" | "band";
    busy?: boolean;
    /** Why the last button press did not go through, in words. */
    problem?: string | null;
    /** "I'll do it", or "I did it" / "Tell {name}" (which open the report). */
    onPrimary: () => void;
    onOther: () => void;
}) {
    const loop = useTrialMotionStoryboard(speciesProfileId, step.trialFrequency, variant !== "pinned");
    const eyebrow = variant === "pinned" ? words.journey.step.pinnedLabel : fillWords(words.journey.step.eyebrow, {name});
    const shell = variant === "pinned"
        ? "flex shrink-0 flex-col gap-2 border-b border-primary-400/20 bg-primary-400/[0.06] px-4 py-2.5"
        : variant === "inline"
            ? "-mx-4 mt-3 flex flex-col gap-2.5 border-y border-primary-400/20 bg-white/[0.03] px-4 py-3.5"
            : "flex flex-col gap-2.5 border-b border-white/[0.08] px-5 py-5";
    return (
        <section className={shell} aria-label={eyebrow} data-testid={`step-card-${variant}`}>
            <Eyebrow>{eyebrow}</Eyebrow>
            <p className={`${variant === "pinned" ? "line-clamp-2 text-sm" : "text-[15px]"} font-semibold leading-6 text-white`}>{step.step}</p>
            {loop.storyboard && variant !== "pinned" ? (
                <TrialMotion storyboard={loop.storyboard} captions={loop.captions} variant="compact" />
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={onPrimary}
                    disabled={busy}
                    className="inline-flex min-h-9 items-center rounded-full bg-primary-400 px-4 text-xs font-black text-black transition-colors hover:bg-primary-300 disabled:opacity-50"
                >
                    {busy ? "…" : stepPrimaryLabel(step, name, words)}
                </button>
                <button
                    type="button"
                    onClick={onOther}
                    disabled={busy}
                    className="inline-flex min-h-9 items-center rounded-full border border-white/12 bg-white/[0.05] px-4 text-xs font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                    {words.journey.step.other}
                </button>
            </div>
            {problem ? <p role="alert" className="text-[11px] leading-4 text-white/60">{problem}</p> : null}
        </section>
    );
}

// MARK: - The report composer

export type StepReportDraft = {text: string; file: File | null; previewUrl: string | null};

/**
 * "I did it": what happened, in their own words (at least three characters),
 * and at most one photo or video. Sent to the animal as their own message.
 */
export function StepReportComposer({
    name,
    words,
    sendingLabel,
    closeLabel,
    onCancel,
    onSubmit,
    layer = "chat"
}: {
    name: string;
    words: CompanionWords;
    /** Shown on the send button while it uploads. */
    sendingLabel: string;
    closeLabel: string;
    onCancel: () => void;
    /** Uploads and attaches; a problem (in words) keeps the composer open and says it. */
    onSubmit: (draft: StepReportDraft) => Promise<string | null>;
    layer?: "chat" | "page";
}) {
    const [text, setText] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [sending, setSending] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
    // The preview is handed on to the earned moment; it is revoked only if never sent.
    const sentRef = useRef(false);
    useEffect(() => () => {
        if (previewUrl && !sentRef.current) URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    const ready = stepReportReady(text) && !sending;
    const submit = async () => {
        if (!ready) return;
        setSending(true);
        setProblem(null);
        const failure = await onSubmit({text, file, previewUrl});
        if (!failure) {
            sentRef.current = true;
            return;
        }
        setSending(false);
        setProblem(failure);
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={words.journey.report.title}
            className={`fixed inset-0 flex items-end justify-center bg-black/70 md:items-center ${layer === "chat" ? "z-[72]" : "z-[60]"}`}
        >
            <div className="flex max-h-[92vh] w-full max-w-lg flex-col border-t border-white/12 bg-canvas-950 md:border">
                <header className="flex items-center gap-3 border-b border-white/10 px-5 py-3.5">
                    <h2 className="min-w-0 flex-1 font-display text-lg font-black text-white">{words.journey.report.title}</h2>
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label={closeLabel}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white"
                    >
                        ✕
                    </button>
                </header>
                <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
                    <label className="sr-only" htmlFor="step-report-text">{fillWords(words.journey.report.placeholder, {name})}</label>
                    <textarea
                        id="step-report-text"
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        rows={4}
                        maxLength={1500}
                        autoFocus
                        placeholder={fillWords(words.journey.report.placeholder, {name})}
                        className="min-h-[7rem] w-full resize-none border border-white/12 bg-white/[0.05] px-3.5 py-3 text-[15px] leading-6 text-white outline-none placeholder:text-ink-400 focus:border-primary-300/45"
                    />
                    <div className="flex flex-col gap-2">
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/*,video/*"
                            className="sr-only"
                            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                        />
                        {file && previewUrl ? (
                            <div className="flex items-center gap-3">
                                <span className="relative h-16 w-16 shrink-0 overflow-hidden bg-white/[0.05]">
                                    {isStepVideoFile(file) ? (
                                        <video src={previewUrl} muted playsInline className="h-full w-full object-cover" />
                                    ) : (
                                        <Image src={previewUrl} alt="" fill sizes="64px" unoptimized className="object-cover" />
                                    )}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-xs text-white/60">{file.name}</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFile(null);
                                        if (inputRef.current) inputRef.current.value = "";
                                    }}
                                    aria-label={closeLabel}
                                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/60 hover:text-white"
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => inputRef.current?.click()}
                                className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 text-sm font-bold text-white transition-colors hover:bg-white/10"
                            >
                                <span aria-hidden="true">＋</span>
                                {words.journey.report.attach}
                            </button>
                        )}
                        <p className="text-[11px] leading-4 text-white/50">{fillWords(words.journey.report.attachNote, {name})}</p>
                    </div>
                    {problem ? <p role="alert" className="text-xs leading-5 text-white/70">{problem}</p> : null}
                </div>
                <div className="border-t border-white/10 px-5 py-3">
                    <button
                        type="button"
                        onClick={() => void submit()}
                        disabled={!ready}
                        className="flex min-h-12 w-full items-center justify-center rounded-full bg-primary-400 text-sm font-black text-black transition-colors hover:bg-primary-300 disabled:bg-white/8 disabled:text-ink-400"
                    >
                        {sending ? sendingLabel : fillWords(words.journey.report.send, {name})}
                    </button>
                </div>
            </div>
        </div>
    );
}

// MARK: - The earned moment

/**
 * The first done step earns the Power: full screen, the Power, "Earned in
 * your own life", the person's own words and their photo or video.
 */
export function StepEarnedMoment({
    powerName,
    name,
    words,
    account,
    media,
    onContinue
}: {
    powerName: string;
    name: string;
    words: CompanionWords;
    account: string | null;
    media: {url: string; kind: "photo" | "video"} | null;
    onContinue: () => void;
}) {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onContinue();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onContinue]);
    return (
        <div role="dialog" aria-modal="true" aria-label={powerName} className="fixed inset-0 z-[74] flex flex-col bg-black">
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-10 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{color: NEON}}>{words.journey.earned.via}</p>
                <h2 className="font-display text-4xl font-black leading-tight text-white sm:text-5xl">
                    {fillWords(words.journey.earned.title, {power: powerName})}
                </h2>
                <p className="text-base font-semibold text-white/75">{fillWords(words.journey.earned.subtitle, {name})}</p>
                {media ? (
                    <div className="relative aspect-[4/3] w-full max-w-md overflow-hidden bg-white/[0.04]">
                        {media.kind === "video" ? (
                            <video src={media.url} controls playsInline className="h-full w-full object-cover" />
                        ) : (
                            <Image src={media.url} alt="" fill sizes="448px" unoptimized className="object-cover" />
                        )}
                    </div>
                ) : null}
                {account ? (
                    <blockquote className="max-w-md border-l-2 pl-4 text-left text-[15px] italic leading-7 text-white/80" style={{borderColor: NEON}}>
                        {account}
                    </blockquote>
                ) : null}
            </div>
            <div className="border-t border-white/[0.08] px-5 py-4">
                <button
                    type="button"
                    onClick={onContinue}
                    className="mx-auto flex min-h-[52px] w-full max-w-md items-center justify-center rounded-full text-base font-black text-black/90"
                    style={{backgroundColor: NEON}}
                >
                    {words.journey.earned.continue}
                </button>
            </div>
        </div>
    );
}

/** "Done together · +5 XP" under the reply where the animal counted it. */
export function StepDoneChip({xp, words, earnedLine = null}: {xp: number; words: CompanionWords; earnedLine?: string | null}) {
    const parts = [words.journey.done.chip, xp > 0 ? fillWords(words.journey.done.xp, {xp}) : null].filter(Boolean);
    return (
        <div className="flex flex-col gap-1">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary-300">
                <span aria-hidden="true">✓</span>
                {parts.join(" · ")}
            </p>
            {earnedLine ? <p className="text-[11px] font-semibold leading-4 text-white">{earnedLine}</p> : null}
        </div>
    );
}

// MARK: - The Trials

/** A Trial's loop, compact; a tap shows it large, with every step. */
function TrialLoop({trial, closeLabel}: {trial: AnimalTrial; closeLabel: string}) {
    const [large, setLarge] = useState(false);
    if (!trial.motionStoryboard) return null;
    return (
        <>
            <button type="button" onClick={() => setLarge(true)} aria-label={trial.title} className="block w-full text-left">
                <TrialMotion storyboard={trial.motionStoryboard} captions={trial.motionCaptions} variant="compact" />
            </button>
            {large ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={trial.title}
                    className="fixed inset-0 z-[76] flex flex-col bg-black"
                    onClick={() => setLarge(false)}
                >
                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-3">
                        <p className="min-w-0 truncate text-sm font-black text-white">{trial.title}</p>
                        <button type="button" aria-label={closeLabel} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white">✕</button>
                    </div>
                    <div className="mx-auto w-full max-w-2xl overflow-y-auto px-5 py-6" onClick={(event) => event.stopPropagation()}>
                        <TrialMotion storyboard={trial.motionStoryboard} captions={trial.motionCaptions} variant="full" />
                    </div>
                </div>
            ) : null}
        </>
    );
}

/**
 * "{name}'s Trials": Easy / Medium / Hard, each with its loop and, for an
 * animal of theirs, "Make this my step". The Trial that is their step says
 * so instead. Read-only (`onMakeStep` absent) on the public species page.
 */
export function TrialRows({
    trials,
    name,
    words,
    openStep = null,
    onMakeStep,
    busyFrequency = null,
    highlight = null,
    showsHeader = true,
    closeLabel = "Close"
}: {
    trials: AnimalTrial[];
    name: string;
    words: CompanionWords;
    openStep?: AnimalStep | null;
    onMakeStep?: (trial: AnimalTrial) => void;
    busyFrequency?: StepFrequency | null;
    /** The Trial the animal pointed at, first. */
    highlight?: StepFrequency | null;
    showsHeader?: boolean;
    /** The enlarged loop's close button, for screen readers. */
    closeLabel?: string;
}) {
    const ordered = highlight
        ? [...trials].sort((left, right) => Number(right.frequency === highlight) - Number(left.frequency === highlight))
        : trials;
    if (ordered.length === 0) return null;
    return (
        <section className="flex flex-col border-b border-white/[0.08]" aria-label={fillWords(words.journey.trial.sectionTitle, {name})}>
            {showsHeader ? (
                <div className="px-5 pb-2 pt-5">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">{fillWords(words.journey.trial.sectionTitle, {name})}</h3>
                </div>
            ) : null}
            {ordered.map((trial) => {
                const difficulty = trialDifficulty(trial.frequency);
                const isStep = openStep?.trialFrequency === trial.frequency;
                const preview = instructionsPreview(trial.instructions);
                return (
                    <div key={trialId(trial)} className="flex flex-col gap-2.5 border-t border-white/[0.06] px-5 py-4" data-testid={`trial-row-${trial.frequency}`}>
                        {difficulty ? <Eyebrow>{trialDifficultyText(difficulty, words)}</Eyebrow> : null}
                        <p className="font-display text-xl font-black leading-tight text-white">{trial.title}</p>
                        <TrialLoop trial={trial} closeLabel={closeLabel} />
                        {preview ? <p className="text-sm leading-6 text-white/60">{preview}</p> : null}
                        {isStep ? (
                            <p className="text-xs font-black" style={{color: NEON}}>✓ {words.journey.step.pinnedLabel}</p>
                        ) : onMakeStep ? (
                            <button
                                type="button"
                                onClick={() => onMakeStep(trial)}
                                disabled={busyFrequency !== null}
                                className="inline-flex min-h-10 w-fit items-center rounded-full bg-primary-400 px-5 text-sm font-black text-black transition-colors hover:bg-primary-300 disabled:opacity-50"
                            >
                                {busyFrequency === trial.frequency ? "…" : words.journey.trial.makeStep}
                            </button>
                        ) : null}
                    </div>
                );
            })}
        </section>
    );
}

// MARK: - The record

function recordDate(raw: string | null, locale: string | null): string | null {
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    const options: Intl.DateTimeFormatOptions = {day: "numeric", month: "short", year: "numeric"};
    try {
        return date.toLocaleDateString(locale ?? undefined, options);
    } catch {
        return date.toLocaleDateString(undefined, options);
    }
}

/** "Your record with {name}": every done step, newest first, private to them. */
export function StepRecordList({
    records,
    didLoad,
    name,
    words,
    locale,
    onOpen
}: {
    records: StepRecordWithMedia[];
    didLoad: boolean;
    name: string;
    words: CompanionWords;
    locale: string | null;
    onOpen: (record: StepRecordWithMedia) => void;
}) {
    return (
        <section className="flex flex-col border-b border-white/[0.08]" data-testid="step-record">
            <div className="px-5 pb-2 pt-5">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">{fillWords(words.journey.record.title, {name})}</h3>
            </div>
            {records.length === 0 ? (
                <p className="px-5 pb-5 text-sm leading-6 text-white/60">{didLoad ? fillWords(words.journey.record.empty, {name}) : "…"}</p>
            ) : records.map((record) => {
                const thumbnail = stepRecordThumbnail(record.media);
                const date = recordDate(record.doneAt, locale);
                return (
                    <button
                        key={record.id}
                        type="button"
                        onClick={() => onOpen(record)}
                        className="flex w-full items-start gap-3 border-t border-white/[0.06] px-5 py-3.5 text-left transition hover:bg-white/[0.03]"
                    >
                        {thumbnail ? (
                            <span className="relative h-12 w-12 shrink-0 overflow-hidden bg-white/[0.05]">
                                <Image src={thumbnail.url} alt="" fill sizes="48px" unoptimized className="object-cover" />
                            </span>
                        ) : (
                            <span aria-hidden="true" className="mt-0.5 w-5 shrink-0 text-center text-sm" style={{color: NEON}}>✓</span>
                        )}
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold leading-6 text-white">{record.step}</span>
                            {record.account ?? record.evidence ? (
                                <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-white/55">{record.account ?? record.evidence}</span>
                            ) : null}
                        </span>
                        {date ? <span className="shrink-0 text-[11px] text-white/45">{date}</span> : null}
                    </button>
                );
            })}
        </section>
    );
}

function RecordMedia({item}: {item: StepRecordMedia}) {
    return item.kind === "video" ? (
        <video src={item.url} controls playsInline className="w-full bg-black" />
    ) : (
        <span className="relative block aspect-[4/3] w-full overflow-hidden bg-white/[0.04]">
            <Image src={item.url} alt="" fill sizes="(min-width: 768px) 640px, 100vw" unoptimized className="object-contain" />
        </span>
    );
}

/** One entry of the record, with its full media: the step, the date, what they said, what the animal saw. */
export function StepRecordEntry({
    record,
    name,
    words,
    locale,
    closeLabel,
    onClose
}: {
    record: StepRecordWithMedia;
    name: string;
    words: CompanionWords;
    locale: string | null;
    closeLabel: string;
    onClose: () => void;
}) {
    const video = record.media.find((item) => item.kind === "video") ?? null;
    // A video's frames are its thumbnail; with its clip there, the clip is the media.
    const shown = video ? [video] : record.media;
    const date = recordDate(record.doneAt, locale);
    return (
        <div role="dialog" aria-modal="true" aria-label={record.step} className="fixed inset-0 z-[72] flex flex-col bg-black">
            <header className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-3">
                <span className="min-w-0 flex-1 truncate text-[10px] font-black uppercase tracking-[0.13em] text-white/55">
                    {fillWords(words.journey.record.title, {name})}
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={closeLabel}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white"
                >
                    ✕
                </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex w-full max-w-2xl flex-col">
                    {shown.map((item) => <RecordMedia key={item.path} item={item} />)}
                    <section className="flex flex-col gap-2 border-b border-white/[0.08] px-5 py-5">
                        {date ? <p className="text-[11px] font-semibold text-white/45">{date}</p> : null}
                        <p className="font-display text-xl font-black leading-tight text-white">{record.step}</p>
                        <StepDoneChip xp={record.xpAwarded} words={words} />
                    </section>
                    {record.account ? (
                        <section className="border-b border-white/[0.08] px-5 py-5">
                            <p className="text-[15px] leading-7 text-white/85">{record.account}</p>
                        </section>
                    ) : null}
                    {!record.account && record.evidence ? (
                        // Done in conversation, without "I did it": what the animal saw them do.
                        <section className="border-b border-white/[0.08] px-5 py-5">
                            <p className="text-sm italic leading-6 text-white/60">{record.evidence}</p>
                        </section>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
