"use client";

/**
 * Everything inline in the conversation (docs/your-step/INLINE.md, owner,
 * 2026-10-30): what a special message carries, drawn inside the animal's own
 * bubble (`AskReplyBubbles`' `special`), never as a card under it and never
 * in a window. Laid out as iOS draws them (AnimalSpecialMessageViews,
 * AnimalStepSection, AnimalPowerEarnedSection, AnimalTrialsPickerSection,
 * AnimalWarmupOfferSection, AnimalWarmupQuestionMessage, DebateOfferSection):
 *
 *   - the step: "YOUR STEP" with the walking figure (and the Trial's
 *     difficulty), the step in bold, its loop, then [I'll do it] / [I did it]
 *     and [A different step]; once finished, "DONE TOGETHER"; dropped or
 *     replaced, the words alone, dimmed;
 *   - done: "DONE TOGETHER · +5 XP", the step, Share; on the first done step
 *     the Power earned: its name large, "{name}'s Power is yours · Earned in
 *     your own life", their photo and their own words, about a second of
 *     sparkles in place (none under Reduce Motion), and Share;
 *   - "{name}'s Trials": Easy, Medium and Hard, each with its loop (a tap
 *     enlarges it in place) and "Make this my step";
 *   - the Warmup offer: what it is, then [Take the warmup (+5 XP)] [Skip];
 *     each question its own special message, "WARMUP · 1 OF 2", its choices as
 *     chips, the result line on the last;
 *   - the debate offer: [Yes, compare] [Not now].
 *
 * The label is UI; the words above it stay the animal's own. Every word here
 * is the SPEC's, in the reader's language.
 */

import {useState, type CSSProperties, type ReactNode} from "react";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import TrialMotion from "@/components/trial-motion/trial-motion";
import {useTrialMotionStoryboard} from "@/components/trial-motion/use-trial-motion-storyboard";
import AnimalPowerIcon from "@/components/animal-detail/animal-powers/animal-power-icon";
import {AskSpecialBubble, AskSpecialLabel, AskWalkIcon} from "@/components/ask-animaldex/ask-messenger";
import {type AnimalTrial, frequencyAccent, instructionsPreview, sortTrials, trialFirstInstruction} from "@/lib/animal-trials";
import {fillWords, trialDifficultyText, trialDifficulty, type CompanionWords} from "@/lib/companion-bond";
import {askWarmupChoiceMark, type AskStepResolution} from "@/lib/ask-animaldex/special-messages";
import type {AskWarmupItem} from "@/lib/ask-animaldex/thread";
import type {StepFrequency} from "@/lib/your-step";
import {
    stepDoneLabel,
    stepProofBonusLine,
    stepEarnedLine,
    stepPrimaryLabel,
    warmupOfferText,
    warmupQuestionLabel,
    warmupResultLine
} from "@/lib/your-step-words";

const CHIP = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-[14px] py-1.5 text-left text-xs leading-4 transition-colors disabled:opacity-50";
const PRIMARY = `${CHIP} bg-primary-400 font-black text-black hover:bg-primary-300`;
const SECONDARY = `${CHIP} border border-white/12 bg-white/[0.07] font-bold text-white hover:bg-white/10`;
/** Media inside a bubble keeps the bubble's softness (iOS 12 pt). */
const MEDIA_RADIUS: CSSProperties = {borderRadius: 12};

function Problem({children}: {children: ReactNode}) {
    return <p role="alert" className="text-[11px] leading-4 text-white/60">{children}</p>;
}

function Working() {
    return <p aria-live="polite" className="text-sm leading-6 text-white/40">…</p>;
}

/** "Easy", in its Trial's colour, after a label. */
function difficultyTrailing(frequency: StepFrequency | null | undefined, words: CompanionWords) {
    const difficulty = trialDifficulty(frequency);
    return difficulty && frequency ? {text: trialDifficultyText(difficulty, words), color: frequencyAccent(frequency)} : null;
}

/** A Trial's loop, compact; a tap shows it large right where it is, and another tap makes it small again. */
function LoopInPlace({storyboard, captions, label}: {storyboard: unknown; captions: string[] | null; label: string}) {
    const [large, setLarge] = useState(false);
    return (
        <button
            type="button"
            onClick={() => setLarge((current) => !current)}
            aria-expanded={large}
            aria-label={label}
            className="block w-full overflow-hidden text-left"
            style={MEDIA_RADIUS}
            data-testid={large ? "trial-loop-large" : "trial-loop-compact"}
        >
            {/* Small, it shows the step being drawn without "STEP n OF m"; large, every step. */}
            <TrialMotion storyboard={storyboard} captions={captions} variant={large ? "full" : "compact"} showsStepCount={false} />
        </button>
    );
}

/** Share on a step done or a Power earned. */
function ShareChip({label, onShare}: {label: string; onShare: () => void}) {
    return (
        <div>
            <button type="button" onClick={onShare} className={`${SECONDARY} font-semibold text-white/80`}>
                <ShareIcon />
                {label}
            </button>
        </div>
    );
}

// MARK: - The step

/**
 * The last section of the bubble that set the step. Live, not accepted: [I'll
 * do it] [A different step]; accepted: [I did it] [A different step], which puts
 * the message bar in report mode; reported: "Tell {name} more". A step
 * picked from a Trial shows that Trial's loop and its difficulty. When no
 * reply in the thread carries the open step (set in an earlier conversation,
 * or the thread cleared), this section is the whole of one more animal
 * message, with no words above it.
 */
export function AskStepSection({
    text,
    resolution,
    trialFrequency,
    speciesProfileId,
    name,
    words,
    busy,
    problem,
    onPrimary,
    onOther
}: {
    /** The step's words as the reply set them (the open step's while live). */
    text: string;
    resolution: AskStepResolution;
    trialFrequency: StepFrequency | null;
    speciesProfileId: string | null;
    name: string;
    words: CompanionWords;
    busy: boolean;
    problem: string | null;
    onPrimary: () => void;
    onOther: () => void;
}) {
    const live = resolution.kind === "live" ? resolution.step : null;
    const frequency = live?.trialFrequency ?? trialFrequency;
    const closed = resolution.kind === "closed";
    const loop = useTrialMotionStoryboard(speciesProfileId, frequency, !closed);
    return (
        <section
            className={`flex flex-col gap-2.5 ${closed ? "opacity-75" : ""}`}
            aria-label={words.journey.step.pinnedLabel}
            data-testid={`special-step-${resolution.kind}`}
        >
            <AskSpecialLabel icon={<AskWalkIcon />} trailing={difficultyTrailing(frequency, words)}>{words.journey.step.pinnedLabel}</AskSpecialLabel>
            <p className={`text-[15px] font-bold leading-6 ${closed ? "text-white/60" : "text-white"}`}>{live?.step ?? text}</p>
            {loop.storyboard && !closed ? <LoopInPlace storyboard={loop.storyboard} captions={loop.captions} label={live?.step ?? text} /> : null}
            {live ? (
                busy ? <Working /> : (
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={onPrimary} className={PRIMARY}>
                            {stepPrimaryLabel(live, name, words)}
                        </button>
                        <button type="button" onClick={onOther} className={SECONDARY}>
                            {words.journey.step.other}
                        </button>
                    </div>
                )
            ) : resolution.kind === "done" ? (
                <p className="flex items-center gap-1.5 text-[11px] font-bold leading-4 text-primary-300">
                    <SealIcon />
                    {words.journey.done.chip}
                </p>
            ) : null}
            {live && problem ? <Problem>{problem}</Problem> : null}
        </section>
    );
}

// MARK: - Done, and the Power earned

/** Under the done label: "+5 XP for your proof", when the photo or video showed the step. */
function ProofBonusLine({bonus, words}: {bonus: number; words: CompanionWords}) {
    const line = stepProofBonusLine(bonus, words);
    return line ? <p className="-mt-1 text-[12px] font-semibold leading-4 text-primary-300/80" data-testid="proof-bonus">{line}</p> : null;
}

/** "DONE TOGETHER · +10 XP", "+5 XP for your proof" when it earned it, the step, and Share. */
export function AskDoneSection({
    xp,
    proofBonus = 0,
    step,
    words,
    shareLabel,
    onShare
}: {
    xp: number;
    /** Of `xp`, the proof bonus (0 or 5). */
    proofBonus?: number;
    step: string;
    words: CompanionWords;
    shareLabel: string;
    onShare: () => void;
}) {
    return (
        <section className="flex flex-col gap-2" data-testid="special-done">
            <AskSpecialLabel icon={<SealIcon />}>{stepDoneLabel(xp, words)}</AskSpecialLabel>
            <ProofBonusLine bonus={proofBonus} words={words} />
            <p className="line-clamp-3 text-[13px] leading-5 text-white/65">{step}</p>
            <ShareChip label={shareLabel} onShare={onShare} />
        </section>
    );
}

/** The burst's sparkles: their angle round the Power, how far they fly (of the reach), their size and delay. */
const BURST = Array.from({length: 16}, (_, index) => {
    const angle = (index / 16) * 2 * Math.PI + (index % 2 === 0 ? 0 : 0.19);
    const distance = index % 3 === 0 ? 1 : index % 2 === 0 ? 0.78 : 0.6;
    const size = index % 4 === 0 ? 15 : index % 3 === 0 ? 11 : 8;
    return {angle, distance, size, delay: (index % 4) * 50};
});
const BURST_REACH = 92;

/** About a second of sparkles in place, once, and a soft flash behind the Power; the caller leaves it out under Reduce Motion. */
function SparkleBurst({onEnd}: {onEnd: () => void}) {
    return (
        <span aria-hidden="true" className="ask-special-burst pointer-events-none absolute left-1/2 top-[42%] z-10 h-0 w-0" data-testid="earned-burst">
            <span className="ask-special-flash absolute rounded-full" style={{width: BURST_REACH * 2, height: BURST_REACH * 2, left: -BURST_REACH, top: -BURST_REACH}} />
            {BURST.map((ray, index) => (
                <span
                    key={index}
                    className="ask-special-spark absolute text-primary-300"
                    style={{
                        width: ray.size,
                        height: ray.size,
                        left: -ray.size / 2,
                        top: -ray.size / 2,
                        "--burst-x": `${Math.round(Math.cos(ray.angle) * BURST_REACH * ray.distance)}px`,
                        "--burst-y": `${Math.round(Math.sin(ray.angle) * BURST_REACH * ray.distance)}px`,
                        animationDelay: `${ray.delay}ms`
                    } as CSSProperties}
                    onAnimationEnd={index === BURST.length - 1 ? onEnd : undefined}
                >
                    <svg viewBox="0 0 16 16" className="h-full w-full" fill="currentColor">
                        <path d="M8 0.8c.5 3.6 2.1 5.9 6.9 7.2-4.8 1.3-6.4 3.6-6.9 7.2C7.5 11.6 5.9 9.3 1.1 8 5.9 6.7 7.5 4.4 8 .8Z" />
                    </svg>
                </span>
            ))}
        </span>
    );
}

/**
 * The first done step: the same reply, now the Power earned. Its name large,
 * that it is theirs and earned in their own life, their photo and their own
 * words, a brief burst in place (`burst`), and Share. No window.
 */
export function AskEarnedSection({
    powerName,
    speciesProfileId,
    name,
    xp,
    proofBonus = 0,
    words,
    report,
    burst,
    onBurstEnd,
    shareLabel,
    onShare
}: {
    powerName: string;
    /** Whose Power it is: its icon. */
    speciesProfileId: string | null;
    name: string;
    xp: number;
    /** Of `xp`, the proof bonus (0 or 5). */
    proofBonus?: number;
    words: CompanionWords;
    /** The report it answered: their words, and the thumbnail of what they added. */
    report: {text: string; thumb: string | null; isVideo: boolean} | null;
    /** The reply has just arrived here, and Reduce Motion is off. */
    burst: boolean;
    onBurstEnd: () => void;
    shareLabel: string;
    onShare: () => void;
}) {
    const said = report?.text.trim() ?? "";
    return (
        <section className="relative flex flex-col gap-3" aria-label={powerName} data-testid="special-earned">
            {burst ? <SparkleBurst onEnd={onBurstEnd} /> : null}
            <AskSpecialLabel icon={<SealIcon />}>{stepDoneLabel(xp, words)}</AskSpecialLabel>
            <ProofBonusLine bonus={proofBonus} words={words} />
            <div className="flex items-center gap-3">
                <span aria-hidden="true" className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border-[1.5px] border-primary-400/55 bg-primary-400/[0.14] text-primary-300">
                    <AnimalPowerIcon speciesProfileId={speciesProfileId} size={30} gap={0} fallback={<BoltIcon />} />
                </span>
                <p role="heading" aria-level={3} className="min-w-0 font-display text-[28px] font-black leading-[1.1] text-white">
                    {fillWords(words.journey.earned.title, {power: powerName})}
                </p>
            </div>
            <p className="text-[13px] font-semibold leading-5 text-primary-300">{stepEarnedLine(name, words)}</p>
            {report?.thumb ? (
                <span className="relative block h-[150px] w-full overflow-hidden bg-black/20" style={MEDIA_RADIUS}>
                    <Image src={report.thumb} alt="" fill sizes="320px" unoptimized className="object-cover" />
                    {report.isVideo ? <VideoBadge /> : null}
                </span>
            ) : null}
            {said ? (
                <blockquote className="flex items-stretch gap-2.5">
                    <span aria-hidden="true" className="w-0.5 shrink-0 bg-primary-400/50" />
                    <p className="line-clamp-6 min-w-0 text-[14px] italic leading-6 text-white">“{said}”</p>
                </blockquote>
            ) : null}
            <ShareChip label={shareLabel} onShare={onShare} />
        </section>
    );
}

// MARK: - The Trials

/**
 * "{name}'s Trials" inside the animal's message: Easy, Medium and Hard, each
 * with its loop (compact; a tap enlarges it in place) and "Make this my step".
 * Picking one makes it their step, which this message then carries instead.
 */
export function AskTrialsSection({
    name,
    words,
    trials,
    currentFrequency,
    working,
    problem,
    disabled,
    onPick,
    publicAction = null
}: {
    name: string;
    words: CompanionWords;
    /** Null while they load. */
    trials: AnimalTrial[] | null;
    /** The open step's Trial, when it is one. */
    currentFrequency: StepFrequency | null;
    working: StepFrequency | null;
    problem: string | null;
    disabled: boolean;
    onPick: (frequency: StepFrequency) => void;
    /**
     * The public Talk chat (docs/rich-chat/SPEC.md, section 4.4): no card, so
     * no step to make; each Trial offers the account action instead ("Do
     * this Trial" → sign up), or a line saying to catch one in the app.
     */
    publicAction?: {label: string; href: string; note: string | null} | null;
}) {
    const title = fillWords(words.journey.trial.sectionTitle, {name});
    return (
        <section className="flex flex-col gap-3" aria-label={title} data-testid="special-trials">
            <AskSpecialLabel icon={<FlagIcon />}>{title}</AskSpecialLabel>
            {trials === null ? <Working /> : null}
            {(trials ? sortTrials(trials) : []).map((trial, index) => {
                const difficulty = trialDifficulty(trial.frequency);
                // With a loop, the first instruction in plain words before it; without one, the instructions themselves (as iOS).
                const whatToDo = trial.motionStoryboard ? trialFirstInstruction(trial.instructions) : instructionsPreview(trial.instructions);
                return (
                    <div key={trial.frequency} className={`flex flex-col gap-2.5 ${index > 0 ? "border-t border-white/[0.08] pt-3" : ""}`} data-testid={`special-trial-${trial.frequency}`}>
                        <p className="flex items-baseline gap-2">
                            {difficulty ? (
                                <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.1em]" style={{color: frequencyAccent(trial.frequency)}}>
                                    {trialDifficultyText(difficulty, words)}
                                </span>
                            ) : null}
                            <span className="min-w-0 text-[14px] font-semibold leading-5 text-white">{trial.title}</span>
                        </p>
                        {/* What to do, plainly, under the title; then its loop. */}
                        {whatToDo ? <p className="-mt-1 line-clamp-4 text-[13px] leading-5 text-white/65">{whatToDo}</p> : null}
                        {trial.motionStoryboard ? (
                            <LoopInPlace storyboard={trial.motionStoryboard} captions={trial.motionCaptions ?? null} label={trial.title} />
                        ) : null}
                        {publicAction ? (
                            <div className="flex flex-col items-start gap-1.5">
                                {publicAction.note ? <p className="text-[12px] leading-4 text-white/60">{publicAction.note}</p> : null}
                                <Link href={publicAction.href} className={`${CHIP} border border-primary-400/45 font-semibold text-primary-300 hover:bg-primary-400/10`}>
                                    {publicAction.label}
                                </Link>
                            </div>
                        ) : currentFrequency === trial.frequency ? (
                            <p className="flex items-center gap-1.5 text-xs font-bold text-primary-300"><CheckIcon /> {words.journey.step.pinnedLabel}</p>
                        ) : working === trial.frequency ? (
                            <Working />
                        ) : (
                            <div>
                                <button
                                    type="button"
                                    onClick={() => onPick(trial.frequency)}
                                    disabled={disabled || working !== null}
                                    className={`${CHIP} border border-primary-400/45 font-semibold text-primary-300 hover:bg-primary-400/10`}
                                >
                                    {words.journey.trial.makeStep}
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
            {problem ? <Problem>{problem}</Problem> : null}
        </section>
    );
}

// MARK: - The Warmup

/**
 * The Warmup offer, inside the animal's message that made it: what it is,
 * then [Take the warmup (+5 XP)] [Skip]; "Warmup done" once passed. Taking it
 * puts the chips away, and the questions follow as the animal's messages.
 */
export function AskWarmupOfferSection({
    words,
    powerName,
    questionCount,
    state,
    disabled,
    onTake,
    onSkip
}: {
    words: CompanionWords;
    powerName: string | null;
    questionCount: number;
    state: "loading" | "offer" | "passed";
    disabled: boolean;
    onTake: () => void;
    onSkip: () => void;
}) {
    return (
        <section className="flex flex-col gap-2.5" aria-label={words.journey.warmup.title} data-testid="special-warmup-offer">
            <AskSpecialLabel icon={<BoltIcon />}>{words.journey.warmup.title}</AskSpecialLabel>
            {state === "loading" ? <Working /> : state === "passed" ? (
                <p className="flex items-center gap-1.5 text-xs font-bold text-primary-300"><SealIcon /> {words.journey.warmup.passed}</p>
            ) : (
                <>
                    {powerName ? <p className="text-[14px] font-semibold leading-5 text-white">{warmupOfferText(powerName, questionCount, words)}</p> : null}
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={onTake} disabled={disabled} className={PRIMARY} data-testid="warmup-take">
                            {words.journey.warmup.take}
                        </button>
                        <button type="button" onClick={onSkip} className={SECONDARY}>
                            {words.journey.warmup.skip}
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}

const CHOICE_RADIUS: CSSProperties = {borderRadius: 14};

/**
 * A Warmup question, as the animal's message: "WARMUP · 1 OF 2", the
 * question, its choices as chips (their answer marked, and once checked right
 * or wrong; never which one was right). On the last question, once checked:
 * "Warmup done · +5 XP", or the miss.
 */
export function AskWarmupQuestion({
    item,
    avatarUrl,
    showsFace,
    name,
    words,
    checking,
    problem,
    tryAgainLabel,
    onChoose,
    onRetry
}: {
    item: AskWarmupItem;
    avatarUrl: string | null;
    /** The run's next question follows: the face sits by the newest only. */
    showsFace: boolean;
    name: string;
    words: CompanionWords;
    /** The answers are being checked (the last question). */
    checking: boolean;
    /** Checking failed: the line, and Try again. */
    problem: string | null;
    tryAgainLabel: string;
    onChoose: (choice: number) => void;
    onRetry: () => void;
}) {
    return (
        <AskSpecialBubble avatarUrl={avatarUrl} showsFace={showsFace} testId={`warmup-question-${item.index + 1}`}>
            <AskSpecialLabel icon={<BoltIcon />}>{warmupQuestionLabel(item.index + 1, item.total, words)}</AskSpecialLabel>
            <p role="heading" aria-level={3} className="text-[15px] font-semibold leading-6 text-white">{item.prompt}</p>
            <div className="flex flex-col gap-[7px]" role="group" aria-label={item.prompt}>
                {item.choices.map((choice, index) => {
                    const mark = askWarmupChoiceMark(item, index);
                    return (
                        <button
                            key={index}
                            type="button"
                            onClick={() => onChoose(index)}
                            disabled={checking || mark !== "open"}
                            aria-pressed={mark === "chosen" || mark === "right" || mark === "wrong"}
                            className={`flex w-full items-center gap-2.5 border px-[13px] py-2.5 text-left text-[14px] leading-5 transition-colors ${CHOICE_CLASS[mark]}`}
                            style={CHOICE_RADIUS}
                            data-testid={`warmup-choice-${item.index}-${index}`}
                        >
                            <span className="min-w-0 flex-1">{choice}</span>
                            {mark === "chosen" || mark === "right" ? <span className="shrink-0 text-primary-300"><CheckCircleIcon filled={mark === "right"} /></span> : null}
                            {mark === "wrong" ? <span className="shrink-0 text-amber-300"><CrossCircleIcon /></span> : null}
                        </button>
                    );
                })}
            </div>
            {checking ? <Working /> : problem ? (
                <div className="flex flex-col items-start gap-2">
                    <Problem>{problem}</Problem>
                    <button type="button" onClick={onRetry} className={SECONDARY}>
                        <RetryIcon />
                        {tryAgainLabel}
                    </button>
                </div>
            ) : typeof item.passed === "boolean" ? (
                <p
                    aria-live="polite"
                    className={`flex items-start gap-1.5 pt-1 text-[13px] leading-5 ${item.passed ? "font-bold text-primary-300" : "font-semibold text-white"}`}
                    data-testid="warmup-result"
                >
                    <span className={`mt-0.5 shrink-0 ${item.passed ? "" : "text-white/60"}`}>{item.passed ? <SealIcon /> : <TalkIcon />}</span>
                    <span>{warmupResultLine({passed: item.passed, rewardXP: item.rewardXP ?? 0, alreadyCompleted: false}, name, words)}</span>
                </p>
            ) : null}
        </AskSpecialBubble>
    );
}

const CHOICE_CLASS: Record<ReturnType<typeof askWarmupChoiceMark>, string> = {
    open: "border-white/12 bg-white/[0.06] font-normal text-white hover:bg-white/10",
    chosen: "border-primary-400/60 bg-primary-400/[0.16] font-semibold text-white",
    right: "border-primary-400/60 bg-primary-400/[0.16] font-semibold text-white",
    wrong: "border-amber-300/50 bg-amber-300/[0.12] font-semibold text-white",
    faded: "border-white/[0.06] bg-white/[0.02] font-normal text-white/45"
};

// MARK: - The debate offer

/**
 * The animal asked in its own words (docs/debates/SPEC.md section 6): its
 * message carries [Yes, compare] [Not now]. "Not now" puts them away; the
 * server will not offer again for this problem.
 */
export function AskDebateOfferSection({words, disabled, onYes, onNotNow}: {
    words: CompanionWords;
    disabled: boolean;
    onYes: () => void;
    onNotNow: () => void;
}) {
    return (
        <section className="flex flex-col gap-2.5" aria-label={words.debate.start} data-testid="debate-quick-replies">
            <AskSpecialLabel icon={<GroupIcon />}>{words.debate.start}</AskSpecialLabel>
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onYes} disabled={disabled} className={PRIMARY}>
                    {words.debate.yes}
                </button>
                <button type="button" onClick={onNotNow} className={SECONDARY}>
                    {words.debate.notNow}
                </button>
            </div>
        </section>
    );
}

// MARK: - Icons

function VideoBadge() {
    return (
        <span aria-hidden="true" className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white">
            <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor"><path d="M3 6.2A1.7 1.7 0 0 1 4.7 4.5h6.6A1.7 1.7 0 0 1 13 6.2v7.6a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 13.8Zm11 2.1 3-2v7.4l-3-2Z" /></svg>
        </span>
    );
}

function icon(path: ReactNode, strokeWidth = 2) {
    return (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {path}
        </svg>
    );
}

const CheckIcon = () => icon(<path d="M4.5 10.5l3.5 3.5 7.5-8" />, 2.4);
const SealIcon = () => icon(<path d="M10 2.8l1.7 1.3 2.1-.2.6 2 1.8 1.1-.7 2 .7 2-1.8 1.1-.6 2-2.1-.2L10 15.2l-1.7-1.3-2.1.2-.6-2-1.8-1.1.7-2-.7-2 1.8-1.1.6-2 2.1.2Zm-2.6 6.4 1.8 1.8 3.4-3.6" />, 1.8);
const BoltIcon = () => icon(<path d="M11 2.5 4.5 11h5l-1 6.5L15.5 9h-5Z" />);
const FlagIcon = () => icon(<path d="M5 17.5V3m0 1h9l-1.6 3.2L14 10.5H5" />);
const GroupIcon = () => icon(<path d="M7 9a2.3 2.3 0 1 0 0-4.6A2.3 2.3 0 0 0 7 9Zm6.5-.6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM2.8 15.5a4.2 4.2 0 0 1 8.4 0m1-4.6a3.7 3.7 0 0 1 5 3.6" />);
const ShareIcon = () => icon(<path d="M10 13V4m0 0L6.5 7.5M10 4l3.5 3.5M4.5 12v2.8A1.2 1.2 0 0 0 5.7 16h8.6a1.2 1.2 0 0 0 1.2-1.2V12" />);
const RetryIcon = () => icon(<path d="M15.5 10a5.5 5.5 0 1 1-1.9-4.2M15.5 4v3h-3" />);
const TalkIcon = () => icon(<path d="M3.5 5.5h8v5.5h-4.5L4.5 13v-2h-1Zm4.5 7.5v1.5h4.5l2.5 2v-2h1.5V8.5h-3.5" />);
const CrossCircleIcon = () => icon(<path d="M7.5 7.5l5 5m0-5-5 5M3.5 10a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />, 2.2);
function CheckCircleIcon({filled}: {filled: boolean}) {
    return filled ? (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
            <circle cx="10" cy="10" r="7.5" fill="currentColor" />
            <path d="M6.8 10.2l2.2 2.2 4.2-4.6" fill="none" stroke="#000" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ) : icon(<path d="M6.8 10.2l2.2 2.2 4.2-4.6M3.5 10a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />);
}
