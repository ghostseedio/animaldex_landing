"use client";

import {useMemo, useState} from "react";
import {ChallengeScenario} from "@/data/challenges";

type ScenarioBreakdownProps = {
    title: string;
    description: string;
    items: ChallengeScenario[];
    labels: {
        winner: string;
        animalA: string;
        animalB: string;
        draw: string;
        depends: string;
        confidence: string;
        select: string;
    };
};

function getWinnerLabel(winner: ChallengeScenario["winner"], labels: ScenarioBreakdownProps["labels"]) {
    if (winner === "animalA") return labels.animalA;
    if (winner === "animalB") return labels.animalB;
    if (winner === "draw") return labels.draw;
    return labels.depends;
}

export default function ScenarioBreakdown({title, description, items, labels}: ScenarioBreakdownProps) {
    const [activeSlug, setActiveSlug] = useState(items[0]?.slug || "");
    const active = useMemo(() => items.find((item) => item.slug === activeSlug) || items[0], [activeSlug, items]);
    if (!active) return null;

    const confidence = active.winner === "draw" ? 58 : active.winner === "depends" ? 52 : 82;

    return (
        <section id="scenarios" className="scroll-mt-28 space-y-6 py-4">
            <div className="max-w-3xl">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-violet-300">{labels.select}</p>
                <h2 className="font-display text-3xl font-bold text-white md:text-5xl">{title}</h2>
                <p className="mt-3 text-base leading-7 text-ink-200 md:text-lg">{description}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
                <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
                    {items.map((item, index) => (
                        <button key={item.slug} type="button" onClick={() => setActiveSlug(item.slug)} aria-pressed={active.slug === item.slug} className={`min-w-52 rounded-2xl border p-4 text-left transition ${active.slug === item.slug ? "border-violet-400/60 bg-violet-500/15 text-white" : "border-line-300 bg-surface-900/60 text-ink-200 hover:border-line-100"}`}>
                            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-violet-300">0{index + 1}</span>
                            <span className="mt-1 block font-semibold">{item.title}</span>
                        </button>
                    ))}
                </div>

                <div className="relative overflow-hidden rounded-[2rem] border border-line-300 bg-surface-900 p-6 md:p-9">
                    <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" />
                    <div className="relative space-y-6">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-300">{labels.winner}</p>
                                <p className="font-display text-3xl font-bold text-white md:text-5xl">{getWinnerLabel(active.winner, labels)}</p>
                            </div>
                            <div className="min-w-40 text-right">
                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-300">{labels.confidence}</p>
                                <p className="text-2xl font-bold text-violet-200">{confidence}%</p>
                            </div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-surface-950"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-primary-400 transition-all duration-500" style={{width: `${confidence}%`}} /></div>
                        <p className="text-xl font-semibold text-white md:text-2xl">{active.verdict}</p>
                        <p className="max-w-3xl text-base leading-7 text-ink-200 md:text-lg">{active.explanation}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
