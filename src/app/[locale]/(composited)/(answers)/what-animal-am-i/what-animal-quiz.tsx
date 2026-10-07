"use client";

import {FormEvent, RefObject, useEffect, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import {QuizAnimal, QuizResult, quizQuestions, scoreQuiz} from "@/data/what-animal-am-i-quiz";
import type {whatAnimalAmIPage} from "@/data/what-animal-am-i-page";

type QuizCopy = typeof whatAnimalAmIPage.quiz;

const STORAGE_KEY = "animaldex:what-animal-quiz:v1";

function readStoredAnswers(): Record<string, string> | null {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        const answers = parsed as Record<string, string>;
        const complete = quizQuestions.every((question) =>
            question.answers.some((answer) => answer.id === answers[question.id])
        );
        return complete ? answers : null;
    } catch {
        return null;
    }
}

function writeStoredAnswers(answers: Record<string, string> | null) {
    try {
        if (answers) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
        } else {
            window.localStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // Storage is a convenience only; the quiz works without it.
    }
}

function AnimalLinks({animal, copy}: {animal: QuizAnimal; copy: QuizCopy}) {
    return (
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm md:text-base">
            <Link href={`/animals/${animal.slug}`} underline className="text-primary-200 hover:text-primary-100">
                {copy.speciesLinkLabel}: {animal.name}
            </Link>
            <Link href={`/animal-lessons/${animal.slug}`} underline className="text-primary-200 hover:text-primary-100">
                {copy.lessonLinkLabel}
            </Link>
        </div>
    );
}

function ResultCard({
    result,
    copy,
    onRetake,
    headingRef
}: {
    result: QuizResult;
    copy: QuizCopy;
    onRetake: () => void;
    headingRef: RefObject<HTMLHeadingElement>;
}) {
    const {primary, secondary} = result;

    return (
        <div className="flex flex-col gap-5" aria-live="polite">
            <article className="overflow-hidden rounded-lg border border-primary-300/40 bg-surface-900/80">
                <div className="grid gap-0 md:grid-cols-[minmax(0,18rem)_1fr]">
                    <SpeciesArtworkImage
                        slug={primary.slug}
                        alt={`${primary.name} artwork`}
                        className="aspect-[4/3] w-full border-b border-line-300 md:aspect-auto md:min-h-[18rem] md:border-b-0 md:border-r"
                        sizes="(min-width: 768px) 18rem, 100vw"
                    />
                    <div className="flex flex-col gap-4 p-5 md:p-8">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">{copy.resultEyebrow}</p>
                        <h3
                            ref={headingRef}
                            tabIndex={-1}
                            className="font-display text-3xl font-bold leading-tight text-white focus:outline-none md:text-5xl"
                        >
                            You are {/^[AEIOU]/.test(primary.name) ? "an" : "a"} {primary.name}
                        </h3>
                        <p className="text-base font-semibold text-primary-100 md:text-lg">{primary.archetype}</p>
                        <p className="text-base leading-7 text-ink-200 md:text-lg md:leading-8">{primary.read}</p>
                        <AnimalLinks animal={primary} copy={copy} />
                    </div>
                </div>
            </article>

            <article className="flex flex-col gap-4 rounded-lg border border-line-300 bg-surface-900/70 p-5 sm:flex-row sm:items-start md:p-6">
                <SpeciesArtworkImage
                    slug={secondary.slug}
                    alt={`${secondary.name} artwork`}
                    className="h-20 w-20 shrink-0 rounded-md border border-line-300"
                    sizes="80px"
                />
                <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">{copy.secondaryLabel}</p>
                    <h4 className="font-display text-2xl font-bold text-white">{secondary.name}</h4>
                    <p className="text-base leading-7 text-ink-300">{secondary.oneLiner}</p>
                    <AnimalLinks animal={secondary} copy={copy} />
                </div>
            </article>

            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={onRetake}
                    className="inline-flex min-h-[3rem] items-center justify-center rounded-full border border-primary-200/30 px-6 font-display text-sm font-bold uppercase tracking-[0.12em] text-primary-200 transition-colors hover:border-primary-200/60 hover:bg-primary-400/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200"
                >
                    {copy.retakeLabel}
                </button>
            </div>

            <div className="rounded-lg border border-line-300 bg-gradient-to-br from-primary-500/14 via-surface-900 to-canvas-900 p-5 text-center md:p-8">
                <h3 className="font-display text-2xl font-bold text-white md:text-3xl">{copy.fullProfileTitle}</h3>
                <p className="mx-auto mt-3 max-w-3xl text-base leading-7 text-ink-200 md:text-lg">{copy.fullProfileDescription}</p>
                <StoreLinks className="mt-6" />
            </div>
        </div>
    );
}

export default function WhatAnimalQuiz({copy}: {copy: QuizCopy}) {
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [result, setResult] = useState<QuizResult | null>(null);
    const [showHint, setShowHint] = useState(false);
    // "result" moves focus to the result heading, "quiz" back to the quiz
    // heading; restoring a saved result on load moves nothing.
    const [focusTarget, setFocusTarget] = useState<"result" | "quiz" | null>(null);
    const resultHeadingRef = useRef<HTMLHeadingElement>(null);
    const quizHeadingRef = useRef<HTMLHeadingElement>(null);

    const answeredCount = quizQuestions.filter((question) => answers[question.id]).length;
    const total = quizQuestions.length;

    useEffect(() => {
        const stored = readStoredAnswers();
        if (stored) {
            setAnswers(stored);
            setResult(scoreQuiz(stored));
        }
    }, []);

    useEffect(() => {
        const target = focusTarget === "result" ? resultHeadingRef.current : focusTarget === "quiz" ? quizHeadingRef.current : null;
        if (!target) {
            return;
        }
        const reduceMotion = typeof window.matchMedia === "function"
            && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({behavior: reduceMotion ? "auto" : "smooth", block: "start"});
        target.focus({preventScroll: true});
        setFocusTarget(null);
    }, [focusTarget, result]);

    function choose(questionId: string, answerId: string) {
        setAnswers((current) => ({...current, [questionId]: answerId}));
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const firstMissing = quizQuestions.find((question) => !answers[question.id]);
        if (firstMissing) {
            setShowHint(true);
            const input = document.getElementById(`quiz-${firstMissing.id}-${firstMissing.answers[0].id}`);
            input?.focus();
            return;
        }
        setShowHint(false);
        setResult(scoreQuiz(answers));
        writeStoredAnswers(answers);
        setFocusTarget("result");
    }

    function retake() {
        setAnswers({});
        setResult(null);
        setShowHint(false);
        writeStoredAnswers(null);
        setFocusTarget("quiz");
    }

    return (
        <section id="quiz" aria-labelledby="quiz-title" className="scroll-mt-24 border-t border-line-300 pt-8">
            <div className="mb-6 max-w-4xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">{copy.eyebrow}</p>
                <h2
                    id="quiz-title"
                    ref={quizHeadingRef}
                    tabIndex={-1}
                    className="mt-2 scroll-mt-24 font-display text-3xl font-bold text-white focus:outline-none md:text-5xl"
                >
                    {copy.title}
                </h2>
                <p className="mt-3 text-lg leading-8 text-ink-200 md:text-xl">{copy.description}</p>
            </div>

            {result ? (
                <ResultCard result={result} copy={copy} onRetake={retake} headingRef={resultHeadingRef} />
            ) : (
                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                    <ol className="flex flex-col gap-4">
                        {quizQuestions.map((question, questionIndex) => {
                            const missing = showHint && !answers[question.id];
                            return (
                                <li key={question.id}>
                                    <fieldset
                                        className={`rounded-lg border bg-surface-900/70 p-4 md:p-6 ${missing ? "border-primary-300/70" : "border-line-300"}`}
                                    >
                                        <legend className="sr-only">
                                            Question {questionIndex + 1} of {total}: {question.prompt}
                                        </legend>
                                        <p aria-hidden="true" className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">
                                            Question {questionIndex + 1} of {total}
                                        </p>
                                        <h3 aria-hidden="true" className="mt-2 font-display text-xl font-bold text-white md:text-2xl">
                                            {question.prompt}
                                        </h3>
                                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                            {question.answers.map((answer) => {
                                                const inputId = `quiz-${question.id}-${answer.id}`;
                                                return (
                                                    <label key={answer.id} htmlFor={inputId} className="block cursor-pointer">
                                                        <input
                                                            id={inputId}
                                                            type="radio"
                                                            name={question.id}
                                                            value={answer.id}
                                                            checked={answers[question.id] === answer.id}
                                                            onChange={() => choose(question.id, answer.id)}
                                                            className="peer sr-only"
                                                        />
                                                        <span className="flex h-full min-h-[3rem] items-center gap-3 rounded-md border border-line-300 bg-canvas-950/35 px-4 py-3 text-base leading-6 text-ink-200 transition-colors hover:border-primary-200/50 hover:text-white peer-checked:border-primary-300 peer-checked:bg-primary-500/15 peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-200">
                                                            <span
                                                                aria-hidden="true"
                                                                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${answers[question.id] === answer.id ? "border-primary-300" : "border-line-300"}`}
                                                            >
                                                                {answers[question.id] === answer.id ? <span className="h-2.5 w-2.5 rounded-full bg-primary-300" /> : null}
                                                            </span>
                                                            {answer.label}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </fieldset>
                                </li>
                            );
                        })}
                    </ol>

                    {/* Clear of the floating Ask AnimalDex launcher (bottom-5, ~3rem tall). */}
                    <div className="sticky bottom-[5.25rem] z-10 flex flex-col gap-3 rounded-lg border border-line-300 bg-canvas-950 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <p className="text-sm text-ink-200">
                                <strong className="text-white">{answeredCount}/{total}</strong> {copy.answeredLabel}
                            </p>
                            <div
                                role="progressbar"
                                aria-label={copy.progressLabel}
                                aria-valuemin={0}
                                aria-valuemax={total}
                                aria-valuenow={answeredCount}
                                className="h-1.5 w-full overflow-hidden rounded-full bg-surface-800"
                            >
                                <div
                                    className="h-full rounded-full bg-primary-400 transition-[width] duration-300"
                                    style={{width: `${(answeredCount / total) * 100}%`}}
                                />
                            </div>
                            {showHint && answeredCount < total ? (
                                <p role="alert" className="text-sm text-primary-100">{copy.incompleteHint}</p>
                            ) : null}
                        </div>
                        <button
                            type="submit"
                            className="inline-flex min-h-[3rem] shrink-0 items-center justify-center rounded-full bg-primary-400 px-6 font-display text-sm font-bold uppercase tracking-[0.12em] text-canvas-950 transition-colors hover:bg-primary-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200"
                        >
                            {copy.submitLabel}
                        </button>
                    </div>
                </form>
            )}
        </section>
    );
}
