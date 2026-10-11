"use client";

import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import ExplainerShell from "@/components/explainers/explainer-shell";
import {STAT_LESSONS, type StatLesson, type StatLessonExample, type StatLessonKey} from "@/lib/stat-lessons";

export type StatLessonCopy = {
    name: string;
    question: string;
    high: string;
    low: string;
};

export type StatLessonExplainerLabels = {
    eyebrow: string;
    title: string;
    description: string;
    highLabel: string;
    lowLabel: string;
    pause: string;
    play: string;
    stats: Record<StatLessonKey, StatLessonCopy>;
};

/** How long each stat stays on screen while the explainer plays. */
const STAT_SECONDS = 6.5;

/**
 * The tier-list hub's opening explainer: the five AnimalDex stats, one at a
 * time. Each stat's 0–100 track shows a real low and high animal sliding to
 * their live values, then what that end of the scale means for the lesson.
 */
export default function StatLessonExplainer({labels}: {labels: StatLessonExplainerLabels}) {
    return (
        <ExplainerShell
            id="stat-lesson-explainer"
            eyebrow={labels.eyebrow}
            title={labels.title}
            description={labels.description}
            pauseLabel={labels.pause}
            playLabel={labels.play}
            seconds={STAT_SECONDS}
            tabs={STAT_LESSONS.map((lesson) => ({key: lesson.key, label: lesson.shortTitle, sublabel: labels.stats[lesson.key].name, tint: lesson.tint}))}
        >
            {({index, motion}) => <StatPanel lesson={STAT_LESSONS[index]} copy={labels.stats[STAT_LESSONS[index].key]} labels={labels} motion={motion} />}
        </ExplainerShell>
    );
}

function StatPanel({lesson, copy, labels, motion}: {lesson: StatLesson; copy: StatLessonCopy; labels: StatLessonExplainerLabels; motion: boolean}) {
    /** False for the first frames of a stat, so the markers slide in from the middle. */
    const [settled, setSettled] = useState(!motion);

    useEffect(() => {
        if (!motion) {
            setSettled(true);
            return;
        }
        let second = 0;
        const first = window.requestAnimationFrame(() => {
            second = window.requestAnimationFrame(() => setSettled(true));
        });
        return () => {
            window.cancelAnimationFrame(first);
            window.cancelAnimationFrame(second);
        };
    }, [motion]);

    return (
        <>
            <p className="font-display text-3xl font-bold leading-none md:text-4xl" style={{color: lesson.tint}}>
                {copy.name}
            </p>
            <p className="mt-2 text-base font-semibold text-white md:text-lg">{copy.question}</p>

            {/* The 0–100 scale with the low and the high animal on it. */}
            <div className="relative mt-28">
                <div className="relative h-2 bg-white/[0.08]">
                    <div
                        className="absolute inset-y-0 left-0"
                        style={{
                            width: `${settled ? lesson.high.value : 0}%`,
                            background: `linear-gradient(90deg, rgba(255,255,255,0.08), ${lesson.tint})`,
                            transition: motion && settled ? "width 900ms cubic-bezier(.2,.8,.2,1)" : "none"
                        }}
                    />
                </div>
                <div aria-hidden="true" className="mt-1.5 flex justify-between font-mono text-[10px] tabular-nums text-ink-500">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                </div>
                <ScaleMarker example={lesson.low} tint={lesson.tint} shortTitle={lesson.shortTitle} settled={settled} motion={motion} />
                <ScaleMarker example={lesson.high} tint={lesson.tint} shortTitle={lesson.shortTitle} settled={settled} motion={motion} />
            </div>

            <div className="mt-8 grid gap-px border border-line-300 bg-line-300 md:grid-cols-2">
                <ReadsAs label={labels.lowLabel} example={lesson.low} text={copy.low} tint="rgba(255,255,255,0.55)" />
                <ReadsAs label={labels.highLabel} example={lesson.high} text={copy.high} tint={lesson.tint} />
            </div>
        </>
    );
}

function ScaleMarker({
    example,
    tint,
    shortTitle,
    settled,
    motion
}: {
    example: StatLessonExample;
    tint: string;
    shortTitle: string;
    settled: boolean;
    motion: boolean;
}) {
    // Kept inside the track at the ends, so a 2 or a 100 still shows whole.
    const position = Math.min(94, Math.max(6, example.value));
    return (
        <Link
            href={`/animals/${example.slug}`}
            className="group absolute bottom-[1.4rem] flex -translate-x-1/2 flex-col items-center"
            style={{
                left: `${settled ? position : 50}%`,
                opacity: settled ? 1 : 0,
                transition: motion && settled ? "left 900ms cubic-bezier(.2,.8,.2,1), opacity 300ms ease" : "none"
            }}
            aria-label={`${example.name}: ${shortTitle} ${example.value}`}
        >
            <span className="grid h-12 w-12 place-items-center overflow-hidden border bg-black/40 transition-colors group-hover:border-white md:h-14 md:w-14" style={{borderColor: tint}}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getSpeciesArtworkRoute(example.slug)} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
            </span>
            <span className="mt-1 font-display text-sm font-bold tabular-nums text-white">{example.value}</span>
            <span aria-hidden="true" className="h-2 w-px" style={{backgroundColor: tint}} />
        </Link>
    );
}

function ReadsAs({label, example, text, tint}: {label: string; example: StatLessonExample; text: string; tint: string}) {
    return (
        <div className="flex flex-col gap-2 bg-canvas-950 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{color: tint}}>
                {label} · <Link href={`/animals/${example.slug}`} className="text-ink-200 underline-offset-4 hover:text-white hover:underline">{example.name}</Link>
            </p>
            <p className="text-sm leading-6 text-ink-100 md:text-base md:leading-7">{text}</p>
        </div>
    );
}
