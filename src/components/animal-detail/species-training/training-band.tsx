"use client";

import {useState} from "react";
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
import TrainingQuiz from "@/components/animal-detail/species-training/training-quiz";

const NEON = "#A7F432";

/**
 * The Training step, first in the Play area: a full-width band, never an inset
 * card. Once passed it collapses to one "Training complete" line.
 *
 * "Read the Power again" from a failed quiz closes the quiz and opens the
 * Power's lesson right here, in the band — the same content Learn shows, so it
 * works on every surface that mounts the Play area, sheets included.
 */
export default function TrainingBand({
    training,
    power,
    onPassed,
    onClosed
}: {
    training: SpeciesTraining | null;
    power: AnimalPower | null;
    /** A pass, so the Play area unlocks immediately. */
    onPassed: (result: SpeciesTrainingResult) => void;
    /** The quiz closed; the caller re-reads Training and the Power. */
    onClosed: () => void;
}) {
    const [showsQuiz, setShowsQuiz] = useState(false);
    const [showsPower, setShowsPower] = useState(false);

    if (!training || !showsTrainingStep(training)) return null;

    // The quiz stays open over a pass: the band behind it flips to complete
    // while the person reads the explanations, and Continue closes it.
    const quiz = showsQuiz ? (
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

    if (training.completed) {
        return (
            <>
                <div className="flex items-center gap-2 border-b border-white/[0.08] bg-primary-400/10 px-5 py-3.5" style={{color: NEON}}>
                    <span aria-hidden="true" className="text-[13px] font-bold">✓</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.11em]">{TRAINING_COPY.complete}</span>
                </div>
                {quiz}
            </>
        );
    }

    const reward = trainingRewardLine(training.rewardXP, training.rewardCredits);
    const lesson = power ? [power.coreLesson, power.principleExpression].filter((text): text is string => Boolean(text)) : [];

    return (
        <>
            <section className="flex flex-col gap-3 border-b border-white/[0.08] bg-white/[0.03] px-5 py-5" style={{boxShadow: `inset 3px 0 0 ${NEON}8C`}}>
                <h3 className="font-display text-2xl font-black leading-tight text-white">{TRAINING_COPY.title}</h3>
                <p className="text-sm leading-6 text-white/70">{trainingIntroText(training.questions.length)}</p>
                {reward ? <p className="text-[11px] font-black" style={{color: NEON}}>{reward}</p> : null}

                {showsPower && power ? (
                    <div className="flex flex-col gap-1.5 border-l-2 pl-3" style={{borderColor: `${NEON}8C`}}>
                        <p className="text-sm font-bold text-white">{power.principleName}</p>
                        {lesson.map((text) => (
                            <p key={text} className="text-sm leading-6 text-white/60">{text}</p>
                        ))}
                    </div>
                ) : null}

                {training.unlocked ? (
                    <button
                        type="button"
                        onClick={() => {
                            setShowsPower(false);
                            setShowsQuiz(true);
                        }}
                        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-base font-bold text-black/90"
                        style={{backgroundColor: NEON}}
                    >
                        {TRAINING_COPY.start} <span aria-hidden="true">→</span>
                    </button>
                ) : (
                    <>
                        <button
                            type="button"
                            disabled
                            className="flex min-h-[48px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-white/[0.08] text-base font-bold text-white/60"
                        >
                            🔒 {NOT_YET_CAPTURED_TITLE}
                        </button>
                        <p className="text-center text-[10px] text-white/40">{NOT_YET_CAPTURED_NOTE}</p>
                    </>
                )}
            </section>
            {quiz}
        </>
    );
}
