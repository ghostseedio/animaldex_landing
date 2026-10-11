"use client";

import {type ReactNode, useEffect, useState} from "react";

export type ExplainerTab = {
    key: string;
    /** Short label, always shown (e.g. "SPD", "LOW"). */
    label: string;
    /** Longer label, shown from the sm breakpoint. */
    sublabel?: string;
    tint: string;
};

/**
 * The motion explainer frame shared by the hub pages (/tier-list,
 * /animal-hybrids, /animal-frequencies): a header, one tab per step with a
 * progress line while it plays, and the step's panel.
 *
 * Server-rendered on the first step, so its words are in the HTML. It plays on
 * its own, pauses on request or when a step is picked, and never moves for a
 * visitor who prefers reduced motion. Panels animate in with `welcome-rise-in`
 * (globals.css).
 */
export default function ExplainerShell({
    id,
    eyebrow,
    title,
    description,
    pauseLabel,
    playLabel,
    tabs,
    seconds,
    children
}: {
    /** Prefix for element ids; one shell per page section. */
    id: string;
    eyebrow: string;
    title: string;
    description: string;
    pauseLabel: string;
    playLabel: string;
    tabs: ExplainerTab[];
    /** How long each step stays on screen while playing. */
    seconds: number;
    children: (state: {index: number; motion: boolean}) => ReactNode;
}) {
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => {
            setReducedMotion(query.matches);
            if (query.matches) setPlaying(false);
        };
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);

    useEffect(() => {
        if (!playing) return;
        const timer = window.setTimeout(() => setIndex((value) => (value + 1) % tabs.length), seconds * 1000);
        return () => window.clearTimeout(timer);
    }, [playing, index, seconds, tabs.length]);

    const motion = !reducedMotion;
    const titleId = `${id}-title`;
    const panelId = `${id}-panel`;

    return (
        <section
            aria-labelledby={titleId}
            className="theme-dark w-[calc(100vw-2rem)] max-w-full overflow-hidden border border-line-300 bg-[radial-gradient(circle_at_85%_0%,rgba(167,244,50,0.12),transparent_40%),linear-gradient(180deg,#0d140e,#070a08)] md:w-auto"
        >
            <div className="flex flex-col gap-2 border-b border-line-300 px-5 py-5 md:flex-row md:items-end md:justify-between md:gap-8 md:px-8">
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-300">{eyebrow}</p>
                    <h2 id={titleId} className="mt-2 max-w-3xl font-display text-2xl font-bold leading-tight text-white md:text-3xl">
                        {title}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-300 md:text-base">{description}</p>
                </div>
                <button
                    type="button"
                    onClick={() => setPlaying((value) => !value)}
                    className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-[2px] border border-line-300 px-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-200 transition-colors hover:border-primary-400 hover:text-white"
                >
                    <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
                    {playing ? pauseLabel : playLabel}
                </button>
            </div>

            <div role="tablist" aria-label={eyebrow} className="grid border-b border-line-300" style={{gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`}}>
                {tabs.map((tab, i) => {
                    const selected = i === index;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            aria-controls={panelId}
                            onClick={() => {
                                setIndex(i);
                                setPlaying(false);
                            }}
                            className={`relative flex min-w-0 flex-col items-center gap-0.5 border-r border-line-300 px-1 py-3 last:border-r-0 transition-colors ${selected ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}
                        >
                            <span className="block max-w-full truncate text-[10px] font-black tracking-[0.14em]" style={{color: selected ? tab.tint : "rgba(255,255,255,0.45)"}}>
                                {tab.label}
                            </span>
                            {tab.sublabel ? (
                                <span className={`hidden max-w-full truncate text-xs font-semibold sm:block ${selected ? "text-white" : "text-ink-400"}`}>
                                    {tab.sublabel}
                                </span>
                            ) : null}
                            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden">
                                {selected ? (
                                    <span
                                        key={`${index}-${playing}`}
                                        className={`absolute inset-y-0 left-0 ${playing && motion ? "welcome-beat-fill" : "w-full"}`}
                                        style={{backgroundColor: tab.tint, animationDuration: `${seconds}s`}}
                                    />
                                ) : i < index ? (
                                    <span className="absolute inset-0 bg-white/20" />
                                ) : null}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div id={panelId} role="tabpanel" aria-live="polite" className="px-5 py-6 md:px-8 md:py-8">
                <div key={index} className={motion ? "welcome-rise-in" : ""}>
                    {children({index, motion})}
                </div>
            </div>
        </section>
    );
}
