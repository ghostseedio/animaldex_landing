"use client";

import {useEffect, useId, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import ExplainerShell from "@/components/explainers/explainer-shell";
import {FrequencyStateChip} from "@/components/animal-detail/system-dynamics/frequency-chip";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import type {FrequencyLesson} from "@/lib/frequency-lessons";
import {domainDisplayTitle, frequencyColor} from "@/lib/system-dynamics";

/** A lesson with its species' real snapshot row, looked up on the server. */
export type FrequencyExplainerItem = FrequencyLesson & {
    name: string;
    archetype: string;
    pathD: string | null;
    viewBox: string;
    waveDescription: string | null;
};

const STEP_SECONDS = 7.5;
const NO_DOMAINS: NonNullable<FrequencyLesson["seenIn"]> = [];

/**
 * The /animal-frequencies opening explainer: low, mid, high and two-speed
 * frequencies, one real animal each. The species' own waveform draws on, then
 * what that tempo means for its lesson; the two-speed card also steps through
 * where the same pattern turns up outside nature.
 */
export default function FrequencyExplainer({items}: {items: FrequencyExplainerItem[]}) {
    return (
        <ExplainerShell
            id="frequency-explainer"
            eyebrow="Frequency, read as a lesson"
            title="Every animal runs at a tempo. The tempo tells you how to live its lesson."
            description="How often an animal commits effort, and how long each commitment lasts, is its frequency. Here are four, each traced from a real species' behaviour."
            pauseLabel="Pause"
            playLabel="Play"
            seconds={STEP_SECONDS}
            tabs={items.map((item) => ({
                key: item.key,
                label: item.label,
                sublabel: item.sublabel,
                tint: frequencyColor(item.frequencies[item.frequencies.length - 1])
            }))}
        >
            {({index, motion}) => <FrequencyPanel item={items[index]} motion={motion} />}
        </ExplainerShell>
    );
}

function FrequencyPanel({item, motion}: {item: FrequencyExplainerItem; motion: boolean}) {
    const gradientId = useId();
    const [seen, setSeen] = useState(motion ? -1 : 0);
    const domains = item.seenIn ?? NO_DOMAINS;

    // The "seen in" lines step through once the wave has drawn.
    useEffect(() => {
        if (!domains.length || !motion) return;
        const timers = domains.map((_, i) => window.setTimeout(() => setSeen(i), 1600 + i * 1800));
        return () => timers.forEach((timer) => window.clearTimeout(timer));
    }, [domains, motion]);

    const colors = item.frequencies.map(frequencyColor);
    const line = domains[seen];

    return (
        <div className="grid gap-6 md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] md:gap-8">
            <Link href={`/animals/${item.slug}`} className="group flex items-center gap-4 md:flex-col md:items-start">
                <span className="grid h-24 w-24 shrink-0 place-items-center border border-line-300 bg-black/40 transition-colors group-hover:border-primary-400 md:h-40 md:w-40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getSpeciesArtworkRoute(item.slug)} alt="" className="h-full w-full object-contain p-2" loading="lazy" />
                </span>
                <span className="flex flex-col">
                    <span className="font-display text-xl font-bold leading-tight text-white group-hover:text-primary-100">{item.name}</span>
                    <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">{item.archetype}</span>
                </span>
            </Link>

            <div className="flex min-w-0 flex-col gap-4">
                <div className="flex flex-wrap items-center gap-1.5">
                    {item.frequencies.map((frequency, i) => (
                        <span key={`${frequency}-${i}`} className="flex items-center gap-1.5">
                            {i > 0 ? <span aria-hidden="true" className="text-xs font-bold text-white/40">→</span> : null}
                            <FrequencyStateChip frequency={frequency} size="regular" />
                        </span>
                    ))}
                </div>

                {item.pathD ? (
                    // Drawn on left to right with a clip reveal (welcome-wave-draw): a dash
                    // animation can't work with non-scaling strokes.
                    <svg viewBox={item.viewBox} preserveAspectRatio="none" className={`h-24 w-full md:h-28 ${motion ? "welcome-wave-draw" : ""}`} role="img" aria-label={item.waveDescription ?? `${item.name} behaviour rhythm`}>
                        {colors.length > 1 ? (
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                                    {colors.map((color, i) => (
                                        <stop key={`${color}-${i}`} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={color} />
                                    ))}
                                </linearGradient>
                            </defs>
                        ) : null}
                        <path
                            d={item.pathD}
                            fill="none"
                            stroke={colors.length > 1 ? `url(#${gradientId})` : colors[0]}
                            strokeWidth={2.2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                        />
                    </svg>
                ) : null}

                <div>
                    <p className="font-display text-2xl font-bold text-white md:text-3xl">{item.title}</p>
                    <p className="mt-2 max-w-2xl text-base leading-7 text-ink-200">{item.lesson}</p>
                </div>

                {domains.length ? (
                    <div className="flex min-h-[4.5rem] flex-col gap-2 border-t border-line-300 pt-4">
                        {/* One at a time while moving; all three at once for reduced motion. */}
                        {(motion ? (line ? [line] : []) : domains).map((shown) => (
                            <div key={`${seen}-${shown.domain}`} className={motion ? "welcome-rise-in" : ""}>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-300">Seen in {domainDisplayTitle(shown.domain)}</p>
                                <p className="mt-1 text-base font-semibold text-white">{shown.text}</p>
                            </div>
                        ))}
                        <div className="mt-auto flex gap-1">
                            {domains.map((domain, i) => (
                                <span key={domain.domain} className="h-0.5 w-5" style={{backgroundColor: i <= seen || !motion ? "#A7F432" : "rgba(255,255,255,0.18)"}} />
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
