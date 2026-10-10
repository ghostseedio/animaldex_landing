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

/**
 * The Training quiz, full screen like the Trial and Apply It Your Way sheets.
 *
 * One question at a time; choosing advances, Back changes an earlier answer,
 * and the last answer submits on its own. A fail says how many were right and
 * which were wrong — never which answer was right. Retries are unlimited.
 */

const NEON = "#A7F432";
const ORANGE = "#FB923C";

type Phase =
    | {kind: "answering"}
    | {kind: "submitting"}
    | {kind: "result"; result: SpeciesTrainingResult}
    | {kind: "error"; message: string};

export default function TrainingQuiz({
    training,
    powerName,
    onPassed,
    onReadPower,
    onClose
}: {
    training: SpeciesTraining;
    powerName: string | null | undefined;
    /** A pass, the moment it lands, so the Play area can unlock before Continue. */
    onPassed: (result: SpeciesTrainingResult) => void;
    /** "Read the Power again": the quiz closes and the Power is shown. */
    onReadPower: () => void;
    /** Closing, by Continue or ✕. The caller re-reads the Play area. */
    onClose: () => void;
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
            if (result.passed) onPassed(result);
        } catch {
            setPhase({kind: "error", message: trainingRefusalMessage("")});
        }
    }, [onPassed, training.speciesProfileId]);

    const choose = (choice: number) => {
        if (phase.kind !== "answering") return;
        const next = chooseTrainingAnswer(quiz, choice);
        setQuiz(next);
        // The last answer submits on its own.
        const isLast = quiz.position === questions.length - 1;
        const answers = trainingSubmission(next);
        if (isLast && answers) void submit(answers);
    };

    const restart = () => {
        setQuiz(startTrainingQuiz(questions.length));
        setPhase({kind: "answering"});
    };

    const title = powerName?.trim() || TRAINING_COPY.title;
    const question = questions[quiz.position];
    const showsProgress = phase.kind === "answering" || phase.kind === "submitting";

    return (
        <div role="dialog" aria-modal="true" aria-label={TRAINING_COPY.title} className="fixed inset-0 z-[59] flex flex-col bg-black">
            <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-3">
                <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[10px] font-black uppercase tracking-[0.13em]" style={{color: NEON}}>{title}</span>
                    {showsProgress ? (
                        <span className="text-[10px] font-bold text-white/55">
                            {trainingQuestionProgress(quiz.position + 1, questions.length)}
                        </span>
                    ) : null}
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
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
                                            className={`flex min-h-[56px] w-full items-center rounded-2xl border px-4 py-3 text-left text-base font-semibold transition disabled:opacity-60 ${selected ? "text-black" : "border-white/10 bg-white/[0.04] text-white hover:border-white/25"}`}
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

                    {phase.kind === "result" && phase.result.passed ? (
                        <PassedView training={training} result={phase.result} />
                    ) : null}

                    {phase.kind === "result" && !phase.result.passed ? (
                        <FailedView training={training} result={phase.result} />
                    ) : null}
                </div>
            </div>

            {phase.kind === "result" || phase.kind === "error" ? (
                <div className="border-t border-white/[0.08] bg-black/80 px-[18px] py-3 backdrop-blur">
                    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
                        {phase.kind === "result" && phase.result.passed ? (
                            <PrimaryButton onClick={onClose}>{TRAINING_COPY.continue}</PrimaryButton>
                        ) : phase.kind === "result" ? (
                            <>
                                <PrimaryButton onClick={restart}>{TRAINING_COPY.tryAgain}</PrimaryButton>
                                <SecondaryButton onClick={onReadPower}>{TRAINING_COPY.readPowerAgain}</SecondaryButton>
                            </>
                        ) : (
                            <PrimaryButton
                                onClick={() => {
                                    const answers = trainingSubmission(quiz);
                                    if (answers) void submit(answers);
                                    else restart();
                                }}
                            >
                                {TRAINING_COPY.tryAgain}
                            </PrimaryButton>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function PassedView({training, result}: {training: SpeciesTraining; result: SpeciesTrainingResult}) {
    const reward = trainingRewardLine(result.rewardXP, result.rewardCredits);
    return (
        <>
            <section className="flex flex-col gap-2 border-b border-white/[0.08] bg-primary-400/10 px-5 py-6">
                <span aria-hidden="true" className="text-3xl font-bold" style={{color: NEON}}>✓</span>
                <h2 className="font-display text-3xl font-black leading-tight text-white">{TRAINING_COPY.complete}</h2>
                {reward ? <p className="text-sm font-black" style={{color: NEON}}>{reward}</p> : null}
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

function FailedView({training, result}: {training: SpeciesTraining; result: SpeciesTrainingResult}) {
    return (
        <>
            <section className="flex flex-col gap-2 border-b border-white/[0.08] bg-white/[0.03] px-5 py-6" style={{boxShadow: `inset 3px 0 0 ${ORANGE}8C`}}>
                <p className="text-base font-bold leading-6 text-white">{trainingFailSummary(result.correct)}</p>
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
