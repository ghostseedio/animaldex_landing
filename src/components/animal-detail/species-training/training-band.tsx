"use client";

import {useEffect, useState} from "react";
import type {AnimalPower} from "@/lib/animal-powers";
import {NOT_YET_CAPTURED_NOTE, NOT_YET_CAPTURED_TITLE} from "@/lib/animal-trials";
import {
    type SpeciesTraining,
    type SpeciesTrainingResult,
    TRAINING_COPY,
    showsTrainingStep,
    trainingIntroText,
    trainingRewardLine
} from "@/lib/species-training";
import LoopStepCard from "@/components/animal-detail/power-loop/loop-step-card";
import TrainingQuiz from "@/components/animal-detail/species-training/training-quiz";

const NEON = "#A7F432";
const NEON_TEXT = "rgb(var(--c-primary-text-400))";

/** iOS: a graduation cap, then "Training". */
function TrainingHeading() {
    return (
        <h3 className="flex items-center gap-2 font-display text-2xl font-black leading-tight text-white">
            <span aria-hidden="true" className="text-[15px]">🎓</span>
            {TRAINING_COPY.title}
        </h3>
    );
}

/**
 * The Training step, first in the Play area: a full-width band, never an inset
 * card. Once passed it keeps its heading over one "Training complete" line.
 *
 * "Read the Power again" from a failed quiz closes the quiz and opens the
 * Power's lesson right here, in the band — the same content Learn shows, so it
 * works on every surface that mounts the Play area, sheets included.
 */
export default function TrainingBand({
    training,
    power,
    onPassed,
    onClosed,
    openRequest = 0,
    isSignedIn = true,
    asLoopStep = false
}: {
    training: SpeciesTraining | null;
    power: AnimalPower | null;
    /** A pass, so the Play area unlocks immediately. */
    onPassed: (result: SpeciesTrainingResult) => void;
    /** The quiz closed; the caller re-reads Training and the Power. */
    onClosed: () => void;
    /** Bumped by the Power Loop's "Start Training"; each bump opens the quiz once. */
    openRequest?: number;
    /** False: a signed-out preview. The step and its lock show; starting goes to sign-in first. */
    isSignedIn?: boolean | null;
    /**
     * Under a Power Loop step eyebrow: drawn as a Trial card (rail over a
     * washed body), so step 1 matches the Trial cards and step 3.
     */
    asLoopStep?: boolean;
}) {
    const [showsQuiz, setShowsQuiz] = useState(false);
    const [showsPower, setShowsPower] = useState(false);
    // Playing needs an account: a signed-out reader sees the step and its
    // questions' count, and "Sign in to start Training" instead of the quiz.
    const canStart = Boolean(isSignedIn !== false && training?.available && training.unlocked && !training.completed && training.questions.length > 0);

    useEffect(() => {
        if (!openRequest || !canStart) return;
        setShowsPower(false);
        setShowsQuiz(true);
        // Only a new request opens it, not a change in what it can open.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openRequest]);

    if (!training || !showsTrainingStep(training)) return null;

    // The quiz stays open over a pass: the band behind it flips to complete
    // while the person reads the explanations, and Continue closes it.
    const quiz = showsQuiz && isSignedIn !== false && training.questions.length > 0 ? (
        <TrainingQuiz
            training={training}
            powerName={power?.principleName}
            onPassed={onPassed}
            onReadPower={() => {
                setShowsQuiz(false);
                setShowsPower(true);
            }}
            onClose={() => {
                setShowsQuiz(false);
                onClosed();
            }}
        />
    ) : null;

    if (training.completed && asLoopStep) {
        return (
            <>
                <LoopStepCard accent={NEON} tone="done" label={TRAINING_COPY.title} state="✓ Complete">
                    <h3 className="font-display text-2xl font-black leading-tight text-white">{power?.principleName ?? TRAINING_COPY.title}</h3>
                    <p className="flex items-center gap-2 text-sm font-semibold" style={{color: NEON_TEXT}}>
                        <span aria-hidden="true" className="text-[13px] font-bold">✓</span>
                        {TRAINING_COPY.complete}
                    </p>
                </LoopStepCard>
                {quiz}
            </>
        );
    }

    if (training.completed) {
        // iOS keeps the band once passed, its heading over one "Training
        // complete" line, so the step still reads as step 1 of the Play tab.
        return (
            <>
                <section
                    className="flex flex-col gap-2.5 border-b border-white/[0.08] px-5 pb-[18px] pt-4"
                    style={{backgroundImage: `linear-gradient(to bottom, ${NEON}0F, transparent)`}}
                >
                    <TrainingHeading />
                    <p className="flex items-center gap-2 text-sm font-semibold" style={{color: NEON_TEXT}}>
                        <span aria-hidden="true" className="text-[13px] font-bold">✓</span>
                        {TRAINING_COPY.complete}
                    </p>
                </section>
                {quiz}
            </>
        );
    }

    const reward = trainingRewardLine(training.rewardXP, training.rewardCredits);
    const lesson = power ? [power.coreLesson, power.principleExpression].filter((text): text is string => Boolean(text)) : [];

    // As a loop step the buttons take the Trial card's type, so steps 1 and 2 match.
    const buttonText = asLoopStep ? "text-sm font-black" : "text-base font-bold";
    const intro = <p className="text-sm leading-6 text-white/70">{trainingIntroText(training.questions.length)}</p>;
    const details = (
        <>
            {showsPower && power ? (
                <div className="flex flex-col gap-1.5 border-l-2 pl-3" style={{borderColor: `${NEON}8C`}}>
                    <p className="text-sm font-bold text-white">{power.principleName}</p>
                    {lesson.map((text) => (
                        <p key={text} className="text-sm leading-6 text-white/60">{text}</p>
                    ))}
                </div>
            ) : null}

            {isSignedIn === false ? (
                <a
                    href="/account"
                    onClick={(event) => {
                        // Back to this animal after signing in, where Training can start.
                        event.preventDefault();
                        const next = `${window.location.pathname}${window.location.search}`;
                        window.location.assign(`/account?next=${encodeURIComponent(next)}`);
                    }}
                    className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full ${buttonText} text-black/90`}
                    style={{backgroundColor: NEON}}
                >
                    {TRAINING_COPY.signInToStart} <span aria-hidden="true">→</span>
                </a>
            ) : training.unlocked ? (
                <button
                    type="button"
                    onClick={() => {
                        setShowsPower(false);
                        setShowsQuiz(true);
                    }}
                    className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full ${buttonText} text-black/90`}
                    style={{backgroundColor: NEON}}
                >
                    {TRAINING_COPY.start} <span aria-hidden="true">→</span>
                </button>
            ) : (
                <>
                    <button
                        type="button"
                        disabled
                        className={`flex min-h-[48px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-white/[0.08] ${buttonText} text-white/60`}
                    >
                        🔒 {NOT_YET_CAPTURED_TITLE}
                    </button>
                    <p className="text-center text-[10px] text-white/40">{NOT_YET_CAPTURED_NOTE}</p>
                </>
            )}
        </>
    );

    if (asLoopStep) {
        return (
            <>
                <LoopStepCard
                    accent={NEON}
                    tone={training.unlocked || isSignedIn === false ? "lit" : "quiet"}
                    label={TRAINING_COPY.title}
                    state={reward}
                >
                    <h3 className="font-display text-2xl font-black leading-tight text-white">{power?.principleName ?? TRAINING_COPY.title}</h3>
                    {intro}
                    {details}
                </LoopStepCard>
                {quiz}
            </>
        );
    }

    return (
        <>
            <section className="flex flex-col gap-3 border-b border-white/[0.08] bg-white/[0.03] px-5 py-5" style={{boxShadow: `inset 3px 0 0 ${NEON}8C`}}>
                <TrainingHeading />
                {intro}
                {reward ? <p className="text-[11px] font-black" style={{color: NEON}}>{reward}</p> : null}
                {details}
            </section>
            {quiz}
        </>
    );
}
