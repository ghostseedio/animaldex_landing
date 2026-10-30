"use client";

/**
 * The bond screen (docs/companion-loop/SPEC.md, phase 2; 3.2 "Your step",
 * docs/your-step/SPEC.md section 5): the card's Bond tab, and the sheet the
 * chat's bond chip opens. One animal, one level: how well you know, practise
 * and live its lesson, what the two of you are working on, the step it set
 * you, your private record of every step you finished together, its Trials
 * and its Power.
 *
 * The step's buttons are the chat's: "I'll do it" / "A different step", then
 * "I did it", which opens the chat for the report. A Trial row's "Make this
 * my step" makes it the step. Nothing here is a lesson check or a lock.
 *
 * Edge-to-edge bands, as everywhere on the card. Every part fails quietly:
 * without `animal_bond_v1` the screen still shows its actions and Trials.
 */

import {useCallback, useEffect, useState} from "react";
import Image from "next/image";
import {StepCard, StepRecordEntry, StepRecordList, TrialRows} from "@/components/companions/step-views";
import {acceptStep, dropStep, stepFromTrial, useStepRecords} from "@/components/companions/use-steps";
import {useTrialMotionCaptionLanguage} from "@/components/trial-motion/use-trial-motion-storyboard";
import {
    COMPANION_WORDS_EN,
    bondLevelXpText,
    bondStageText,
    bondLevelProgress,
    bondPowerLine,
    fillWords,
    type AnimalBond,
    type CompanionWords
} from "@/lib/companion-bond";
import {type AnimalTrial} from "@/lib/animal-trials";
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";
import {stepCardState, type AnimalStep, type StepFrequency, type StepRecordWithMedia} from "@/lib/your-step";
import {stepProblemText, warmupOfferText} from "@/lib/your-step-words";

const NEON = "#A7F432";

function BandHeader({children}: {children: React.ReactNode}) {
    return <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">{children}</h3>;
}

function StrandBar({label, value}: {label: string; value: number}) {
    return (
        <div className="flex flex-col gap-1.5" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-white">{label}</span>
                <span className="text-xs font-bold text-white/55">{value}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full" style={{width: `${value}%`, backgroundColor: NEON}} />
            </div>
        </div>
    );
}

/** The Warmup on the Bond tab: offered while it can be taken, "Warmup done" once passed. */
export type BondWarmup = {
    /** Null: passed, or not offered. */
    onTake: (() => void) | null;
    passed: boolean;
    questionCount: number;
};

export default function BondPanel({
    bond,
    didLoad,
    speciesProfileId,
    slug,
    name,
    powerName,
    openStep,
    onStepChange,
    onTalk,
    onDidIt,
    onDropped,
    onTrialPicked,
    warmup = null,
    onDebate = null,
    onBondChanged,
    locale = null,
    closeLabel = "Close",
    words = COMPANION_WORDS_EN
}: {
    bond: AnimalBond | null;
    didLoad: boolean;
    speciesProfileId: string | null;
    /** The species' icon-art slug: the animal is shown as its art, never a capture photo. */
    slug: string | null;
    /** "Leo the African Lion", or the animal. */
    name: string;
    /** The Power's name when the bond has not said it. */
    powerName: string | null;
    /** The open step, as the caller keeps it in step with the chat. */
    openStep: AnimalStep | null;
    /** The step changed here (accepted, dropped, a Trial made it): the caller tells the other surfaces. */
    onStepChange: (step: AnimalStep | null) => void;
    onTalk: () => void;
    /** "I did it": the chat opens on the report composer. */
    onDidIt: () => void;
    /** "A different step" dropped the step: the chat asks for a different one. */
    onDropped: () => void;
    /** A Trial is their step now: the chat tells the animal. */
    onTrialPicked: (frequency: StepFrequency) => void;
    warmup?: BondWarmup | null;
    /**
     * 3.2 Debates: "Compare with other animals", once its Power is earned and
     * while the server has Debates on; null hides it.
     */
    onDebate?: (() => void) | null;
    /** The focus was cleared: re-read the bond. */
    onBondChanged: (next: AnimalBond | null) => void;
    /** The site's locale, for grouping thousands in the XP and writing dates. */
    locale?: string | null;
    /** The record entry's and the loop's close button, for screen readers. */
    closeLabel?: string;
    /** The bond screen's words, in the reader's language. */
    words?: CompanionWords;
}) {
    const [trials, setTrials] = useState<AnimalTrial[]>([]);
    const [artFailed, setArtFailed] = useState(false);
    const [stepBusy, setStepBusy] = useState(false);
    /** Why the last step button did not go through, in words. */
    const [stepProblem, setStepProblem] = useState<string | null>(null);
    const [trialBusy, setTrialBusy] = useState<StepFrequency | null>(null);
    const [openRecord, setOpenRecord] = useState<StepRecordWithMedia | null>(null);
    const record = useStepRecords(speciesProfileId);
    /** `id` on /id pages: the Trial Loops' captions arrive translated. */
    const captionLanguage = useTrialMotionCaptionLanguage();

    useEffect(() => {
        if (!speciesProfileId) return;
        const controller = new AbortController();
        void fetch(`/api/app/animal-trials?speciesProfileId=${encodeURIComponent(speciesProfileId)}${captionLanguage ? `&lang=${captionLanguage}` : ""}`, {
            headers: {Accept: "application/json"},
            signal: controller.signal
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: {trials?: AnimalTrial[]} | null) => {
                const loaded = payload?.trials;
                setTrials(Array.isArray(loaded) ? loaded : []);
            })
            .catch(() => undefined);
        return () => controller.abort();
    }, [captionLanguage, speciesProfileId]);

    // A step finished in the chat joins the record.
    const doneCount = bond?.yourTrialsDone ?? 0;
    const reloadRecord = record.reload;
    useEffect(() => {
        if (doneCount > 0) void reloadRecord();
    }, [doneCount, reloadRecord]);

    /** "Not this any more": cleared at once, put back if the clear fails. */
    const clearFocus = useCallback(() => {
        if (!bond || !speciesProfileId) return;
        const previous = bond;
        onBondChanged({...bond, focus: null, openTrial: null, openStep: null});
        onStepChange(null);
        void fetch("/api/ask/companion", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action: "clear", speciesProfileId})
        })
            .then((response) => {
                if (!response.ok) throw new Error(String(response.status));
            })
            .catch(() => {
                onBondChanged(previous);
                onStepChange(previous.openStep);
            });
    }, [bond, onBondChanged, onStepChange, speciesProfileId]);

    const primary = (step: AnimalStep) => {
        if (stepCardState(step) !== "offered") {
            onDidIt();
            return;
        }
        setStepBusy(true);
        setStepProblem(null);
        void acceptStep(step).then((result) => {
            setStepBusy(false);
            if (result.ok) onStepChange(result.value);
            else setStepProblem(stepProblemText(result.code, words));
        });
    };

    const other = (step: AnimalStep) => {
        setStepBusy(true);
        setStepProblem(null);
        void dropStep(step).then((result) => {
            setStepBusy(false);
            if (!result.ok) {
                setStepProblem(stepProblemText(result.code, words));
                return;
            }
            onStepChange(null);
            onDropped();
        });
    };

    const makeStep = (trial: AnimalTrial) => {
        if (!speciesProfileId) return;
        setTrialBusy(trial.frequency);
        setStepProblem(null);
        void stepFromTrial(speciesProfileId, trial.frequency).then((result) => {
            setTrialBusy(null);
            if (!result.ok) {
                setStepProblem(stepProblemText(result.code, words));
                return;
            }
            onStepChange(result.value);
            onTrialPicked(trial.frequency);
        });
    };

    const power = bond?.power.name ?? powerName;
    const artUrl = slug && !artFailed ? getSpeciesArtworkUrl(slug) : null;

    return (
        <div className="flex flex-col" data-testid="bond-panel">
            {/* 1. The animal, its level and the bar through it. */}
            <section className="flex items-center gap-4 border-b border-white/[0.08] px-5 py-5">
                {artUrl ? (
                    <span className="relative h-16 w-16 shrink-0">
                        <Image src={artUrl} alt="" fill sizes="64px" unoptimized className="object-contain" onError={() => setArtFailed(true)} />
                    </span>
                ) : null}
                <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-2xl font-black leading-tight text-white">{name}</p>
                    {bond ? (
                        <>
                            <p className="mt-0.5 text-sm font-semibold" style={{color: bond.mastered ? NEON : "rgb(255 255 255 / 0.7)"}}>{bondStageText(bond, words)}</p>
                            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
                                <div className="h-full rounded-full" style={{width: `${bondLevelProgress(bond) * 100}%`, backgroundColor: NEON}} />
                            </div>
                            {/* The one place the level and XP show (newcomer UX vet, P1-2). */}
                            <p className="mt-1.5 text-[11px] font-semibold text-white/45">{bondLevelXpText(bond, locale, words)}</p>
                        </>
                    ) : !didLoad ? (
                        <p className="mt-1 text-sm text-white/40">…</p>
                    ) : null}
                </div>
            </section>

            {/* 2. Mastered: the stage above says it; this says what it means. */}
            {bond?.mastered ? (
                <section className="border-b border-white/[0.08] px-5 py-4">
                    <span className="text-sm font-semibold text-white">{words.bond.livesItsLesson}</span>
                </section>
            ) : null}

            {/* 3. The three strands. */}
            {bond ? (
                <section className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-5">
                    <StrandBar label={words.bond.knowsTheLesson} value={bond.strands.lesson} />
                    <StrandBar label={words.bond.putsItIntoPractice} value={bond.strands.practice} />
                    <StrandBar label={words.bond.changedYourLife} value={bond.strands.life} />
                </section>
            ) : null}

            {/* 4. Working on. */}
            {bond ? (
                <section className="flex flex-col gap-2 border-b border-white/[0.08] px-5 py-5">
                    <BandHeader>{words.bond.workingOnTitle}</BandHeader>
                    {bond.focus ? (
                        <div className="flex items-start gap-3">
                            <p className="min-w-0 flex-1 text-[15px] font-semibold leading-6 text-white">{bond.focus}</p>
                            <button
                                type="button"
                                onClick={clearFocus}
                                className="shrink-0 text-xs font-semibold text-white/50 underline-offset-2 transition-colors hover:text-white hover:underline"
                            >
                                {words.bond.notThisAnyMore}
                            </button>
                        </div>
                    ) : (
                        <p className="text-sm leading-6 text-white/60">{fillWords(words.bond.noFocus, {name})}</p>
                    )}
                </section>
            ) : null}

            {/* 5. The step it set you, with the chat's buttons. */}
            {openStep ? (
                <StepCard
                    step={openStep}
                    speciesProfileId={speciesProfileId}
                    name={name}
                    words={words}
                    busy={stepBusy}
                    problem={stepProblem}
                    onPrimary={() => primary(openStep)}
                    onOther={() => other(openStep)}
                />
            ) : null}

            {/* 6. Actions: Talk to it first, then the Warmup while it can be taken. */}
            <section className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] px-5 py-5">
                <button
                    type="button"
                    onClick={onTalk}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-400 px-5 text-sm font-black text-black transition-colors hover:bg-primary-300"
                >
                    {words.bond.talkToIt}
                </button>
                {onDebate ? (
                    <button
                        type="button"
                        onClick={onDebate}
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 text-sm font-bold text-white transition-colors hover:bg-white/10"
                    >
                        {words.debate.start}
                    </button>
                ) : null}
                {warmup?.passed ? (
                    <p className="flex min-h-11 items-center gap-2 text-sm font-semibold" style={{color: NEON}}>
                        <span aria-hidden="true">✓</span>
                        {words.journey.warmup.passed}
                    </p>
                ) : warmup?.onTake && power ? (
                    <div className="flex flex-col gap-1">
                        <button
                            type="button"
                            onClick={warmup.onTake}
                            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 text-sm font-bold text-white transition-colors hover:bg-white/10"
                        >
                            {words.journey.warmup.take}
                        </button>
                        <p className="text-[11px] leading-4 text-white/50">{warmupOfferText(power, warmup.questionCount, words)}</p>
                    </div>
                ) : null}
            </section>

            {/* 7. Your record with it: every done step, private to you. */}
            <StepRecordList
                records={record.records}
                didLoad={record.didLoad}
                name={name}
                words={words}
                locale={locale}
                onOpen={setOpenRecord}
            />

            {/* 8. Its Trials: one of them can be your step. */}
            <TrialRows
                trials={trials}
                name={name}
                words={words}
                openStep={openStep}
                onMakeStep={makeStep}
                busyFrequency={trialBusy}
                closeLabel={closeLabel}
            />
            {stepProblem && !openStep ? <p role="alert" className="px-5 py-3 text-xs text-white/60">{stepProblem}</p> : null}

            {/* 9. Its Power. */}
            {power ? (
                <section className="flex flex-col gap-1.5 border-b border-white/[0.08] px-5 py-5">
                    <BandHeader>{words.bond.itsPower}</BandHeader>
                    <p className="font-display text-xl font-black text-white">{power}</p>
                    <p className="text-sm leading-6" style={{color: bond?.power.earned ? NEON : "rgb(255 255 255 / 0.6)"}}>
                        {bondPowerLine(bond ?? {power: {name: power, earned: false, via: null, at: null}}, name, words)}
                    </p>
                </section>
            ) : null}

            {openRecord ? (
                <StepRecordEntry
                    record={openRecord}
                    name={name}
                    words={words}
                    locale={locale}
                    closeLabel={closeLabel}
                    onClose={() => setOpenRecord(null)}
                />
            ) : null}
        </div>
    );
}
