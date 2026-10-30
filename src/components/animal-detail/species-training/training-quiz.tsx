"use client";

import {useCallback, useEffect, useState} from "react";
import {
    type SpeciesTraining,
    type SpeciesTrainingResult,
    TRAINING_COPY,
    chooseTrainingAnswer,
    decodeSpeciesTrainingResult,
    previousTrainingQuestion,
    startTrainingQuiz,
    trainingFailSummary,
    trainingQuestionProgress,
    trainingRefusalMessage,
    trainingRewardLine,
    trainingSubmission
} from "@/lib/species-training";
import AnimalPowerIcon from "@/components/animal-detail/animal-powers/animal-power-icon";

/**
 * The quiz on a Power, full screen.
 *
 * One question at a time; choosing advances, Back changes an earlier answer,
 * and the last answer submits on its own. A miss says which were wrong —
 * never which answer was right.
 *
 * For an animal's own Power it is the 3.2 **Warmup** (`warmup` words): no
 * warning before it, and nothing locked after it. A pass says "Warmup done"
 * and its XP; a miss says the animal will tell them how its kind sees it,
 * with Close. Either way the caller sends the result to the animal as the
 * person's own message. A fused Power's quiz (no `warmup`) keeps its Training
 * wording, and after a miss it can be taken again straight away.
 */

const NEON = "#A7F432";
const ORANGE = "#FB923C";

/**
 * Where the answers go when it is not an animal's own quiz — a fused
 * Power's. Same result shape; a refusal resolves with the copy to show.
 */
export type TrainingAnswerSubmitter = (answers: number[]) => Promise<
    | {ok: true; result: SpeciesTrainingResult}
    | {ok: false; error: string; code?: string}
>;

/** The Warmup's words, in the reader's language (the companion words' `journey.warmup`). */
export type WarmupQuizWords = {
    title: string;
    passed: string;
    /** "Not quite. {name} will tell you how its kind sees it.", with the name filled in. */
    missed: string;
    continue: string;
    close: string;
};

type Phase =
    | {kind: "answering"}
    | {kind: "submitting"}
    | {kind: "result"; result: SpeciesTrainingResult}
    | {kind: "error"; message: string};

export default function TrainingQuiz({
    training,
    powerName,
    warmup = null,
    onPassed,
    onReadPower,
    onClose,
    submitAnswers,
    layer = "page"
}: {
    training: SpeciesTraining;
    powerName: string | null | undefined;
    /** Set: the animal's own Warmup, in these words. Null: a fused Power's Training. */
    warmup?: WarmupQuizWords | null;
    /** A pass, the moment it lands, so the caller can show it before Continue. */
    onPassed?: (result: SpeciesTrainingResult) => void;
    /** "Read the Power again" (a fused Power's quiz only): the quiz closes and the Power is shown. */
    onReadPower?: () => void;
    /** Closing, by Continue, Close or ✕, with the result when there was one. */
    onClose: (result: SpeciesTrainingResult | null) => void;
    /** Set for a fused Power's Training; otherwise the animal's own quiz route. */
    submitAnswers?: TrainingAnswerSubmitter;
    /** `chat`: drawn over the chat drawer, which sits above the page. */
    layer?: "page" | "chat";
}) {
    const questions = training.questions;
    const [quiz, setQuiz] = useState(() => startTrainingQuiz(questions.length));
    const [phase, setPhase] = useState<Phase>({kind: "answering"});

    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, []);

    const submit = useCallback(async (answers: number[]) => {
        setPhase({kind: "submitting"});
        try {
            if (submitAnswers) {
                const outcome = await submitAnswers(answers);
                if (!outcome.ok) {
                    setPhase({kind: "error", message: outcome.error});
                    return;
                }
                setPhase({kind: "result", result: outcome.result});
                if (outcome.result.passed) onPassed?.(outcome.result);
                return;
            }
            const response = await fetch("/api/app/species-training", {
                method: "POST",
                headers: {"Content-Type": "application/json", Accept: "application/json"},
                body: JSON.stringify({speciesProfileId: training.speciesProfileId, answers})
            });
            const payload = await response.json().catch(() => null);
            const result = response.ok ? decodeSpeciesTrainingResult(payload?.result) : null;
            if (!result) {
                setPhase({kind: "error", message: payload?.error ?? trainingRefusalMessage(payload?.code ?? "")});
                return;
            }
            setPhase({kind: "result", result});
            if (result.passed) onPassed?.(result);
        } catch {
            setPhase({kind: "error", message: trainingRefusalMessage("")});
        }
    }, [onPassed, submitAnswers, training.speciesProfileId]);

    const choose = (choice: number) => {
        if (phase.kind !== "answering") return;
        const next = chooseTrainingAnswer(quiz, choice);
        setQuiz(next);
        // The last answer submits on its own.
        const isLast = quiz.position === questions.length - 1;
        const answers = trainingSubmission(next);
        if (isLast && answers) void submit(answers);
    };

    /** Again, from the first question: a miss locks nothing. */
    const restart = () => {
        setQuiz(startTrainingQuiz(questions.length));
        setPhase({kind: "answering"});
    };

    const result = phase.kind === "result" ? phase.result : null;
    const close = () => onClose(result);
    const kindTitle = warmup?.title ?? TRAINING_COPY.title;
    const question = questions[quiz.position];
    const showsProgress = phase.kind === "answering" || phase.kind === "submitting";

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={kindTitle}
            className={`fixed inset-0 flex flex-col bg-black ${layer === "chat" ? "z-[72]" : "z-[59]"}`}
        >
            <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-3">
                <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[10px] font-black uppercase tracking-[0.13em]" style={{color: NEON}}>
                        {/* A fused Power's Training (it submits elsewhere) has no species icon. */}
                        {powerName?.trim() && !submitAnswers ? <AnimalPowerIcon speciesProfileId={training.speciesProfileId} /> : null}
                        {warmup && powerName?.trim() ? `${warmup.title} · ${powerName.trim()}` : powerName?.trim() || kindTitle}
                    </span>
                    {showsProgress ? (
                        <span className="text-[10px] font-bold text-white/55">
                            {trainingQuestionProgress(quiz.position + 1, questions.length)}
                        </span>
                    ) : null}
                </span>
                <button
                    type="button"
                    onClick={close}
                    aria-label={warmup?.close ?? TRAINING_COPY.close}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white"
                >
                    ✕
                </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-2xl">
                    {showsProgress && question ? (
                        <section className="flex flex-col gap-4 px-5 py-6">
                            <h2 className="font-display text-2xl font-black leading-tight text-white">{question.prompt}</h2>
                            <div className="flex flex-col gap-2.5">
                                {question.choices.map((choice, index) => {
                                    const selected = quiz.answers[quiz.position] === index;
                                    return (
                                        <button
                                            key={`${question.index}-${index}`}
                                            type="button"
                                            onClick={() => choose(index)}
                                            disabled={phase.kind === "submitting"}
                                            aria-pressed={selected}
                                            className={`flex min-h-[56px] w-full items-center border px-4 py-3 text-left text-base font-semibold transition disabled:opacity-60 ${selected ? "text-black" : "border-white/10 bg-white/[0.04] text-white hover:border-white/25"}`}
                                            style={selected ? {backgroundColor: NEON, borderColor: NEON} : undefined}
                                        >
                                            {choice}
                                        </button>
                                    );
                                })}
                            </div>
                            {quiz.position > 0 && phase.kind === "answering" ? (
                                <button
                                    type="button"
                                    onClick={() => setQuiz(previousTrainingQuestion(quiz))}
                                    className="inline-flex min-h-9 w-fit items-center gap-1.5 text-sm font-bold text-white/60 hover:text-white"
                                >
                                    <span aria-hidden="true">←</span> Back
                                </button>
                            ) : null}
                            {phase.kind === "submitting" ? (
                                <p aria-live="polite" className="text-center text-sm text-white/40">…</p>
                            ) : null}
                        </section>
                    ) : null}

                    {phase.kind === "error" ? (
                        <section className="flex flex-col gap-3 border-b border-white/[0.08] bg-white/[0.03] px-5 py-6" style={{boxShadow: `inset 3px 0 0 ${ORANGE}8C`}}>
                            <p className="text-sm leading-6 text-white">{phase.message}</p>
                        </section>
                    ) : null}

                    {result?.passed ? <PassedView training={training} result={result} title={warmup?.passed ?? TRAINING_COPY.complete} /> : null}
                    {result && !result.passed ? (
                        <FailedView training={training} result={result} headline={warmup?.missed ?? trainingFailSummary(result.correct)} />
                    ) : null}
                </div>
            </div>

            {phase.kind === "result" || phase.kind === "error" ? (
                <div className="border-t border-white/[0.08] bg-black/80 px-[18px] py-3 backdrop-blur">
                    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
                        {result?.passed ? (
                            <PrimaryButton onClick={close}>{warmup?.continue ?? TRAINING_COPY.continue}</PrimaryButton>
                        ) : result && warmup ? (
                            // The animal tells them how its kind sees it; nothing is locked.
                            <PrimaryButton onClick={close}>{warmup.close}</PrimaryButton>
                        ) : result ? (
                            <>
                                <PrimaryButton onClick={restart}>{TRAINING_COPY.tryAgain}</PrimaryButton>
                                {onReadPower ? <SecondaryButton onClick={onReadPower}>{TRAINING_COPY.readPowerAgain}</SecondaryButton> : null}
                            </>
                        ) : trainingSubmission(quiz) ? (
                            // The answers never reached the grader; send the same ones again.
                            <PrimaryButton onClick={() => void submit(trainingSubmission(quiz)!)}>
                                {TRAINING_COPY.tryAgain}
                            </PrimaryButton>
                        ) : (
                            <PrimaryButton onClick={close}>{warmup?.close ?? TRAINING_COPY.close}</PrimaryButton>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function PassedView({training, result, title}: {training: SpeciesTraining; result: SpeciesTrainingResult; title: string}) {
    const reward = trainingRewardLine(result.rewardXP, result.rewardCredits);
    return (
        <>
            <section className="flex flex-col gap-2 border-b border-white/[0.08] bg-primary-400/10 px-5 py-6">
                <span aria-hidden="true" className="text-3xl font-bold" style={{color: NEON}}>✓</span>
                <h2 className="font-display text-3xl font-black leading-tight text-white">{title}</h2>
                {reward && !result.alreadyCompleted ? <p className="text-sm font-black" style={{color: NEON}}>{reward}</p> : null}
            </section>
            {result.explanations.length ? training.questions.map((question, position) => (
                <section key={question.index} className="flex flex-col gap-1.5 border-b border-white/[0.08] bg-white/[0.02] px-5 py-4">
                    <p className="text-sm font-semibold leading-6 text-white">{question.prompt}</p>
                    {result.explanations[position] ? (
                        <p className="text-sm leading-6 text-white/60">{result.explanations[position]}</p>
                    ) : null}
                </section>
            )) : null}
        </>
    );
}

function FailedView({training, result, headline}: {training: SpeciesTraining; result: SpeciesTrainingResult; headline: string}) {
    return (
        <>
            <section className="flex flex-col gap-2 border-b border-white/[0.08] bg-white/[0.03] px-5 py-6" style={{boxShadow: `inset 3px 0 0 ${ORANGE}8C`}}>
                <p className="text-base font-bold leading-6 text-white">{headline}</p>
            </section>
            {/* Which were wrong, never what was right. */}
            {training.questions.map((question, position) => {
                const right = result.correct[position] === true;
                return (
                    <section
                        key={question.index}
                        className="flex items-start gap-3 border-b border-white/[0.08] bg-white/[0.02] px-5 py-4"
                        aria-label={`${trainingQuestionProgress(position + 1, training.questions.length)}. ${right ? "Right" : "Wrong"}.`}
                    >
                        <span aria-hidden="true" className="w-5 shrink-0 text-center text-sm font-black" style={{color: right ? NEON : ORANGE}}>
                            {right ? "✓" : "✕"}
                        </span>
                        <p className={`text-sm leading-6 ${right ? "text-white/60" : "text-white"}`}>{question.prompt}</p>
                    </section>
                );
            })}
        </>
    );
}

function PrimaryButton({onClick, children}: {onClick: () => void; children: React.ReactNode}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex min-h-[52px] w-full items-center justify-center rounded-full text-base font-black text-black/90"
            style={{backgroundColor: NEON}}
        >
            {children}
        </button>
    );
}

function SecondaryButton({onClick, children}: {onClick: () => void; children: React.ReactNode}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex min-h-[48px] w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm font-bold text-white"
        >
            {children}
        </button>
    );
}
