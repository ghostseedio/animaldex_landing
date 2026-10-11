"use client";

import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import ExplainerShell from "@/components/explainers/explainer-shell";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";

export type FusionExplainerItem = {
    slug: string;
    href: string;
    receiver: {slug: string; name: string; principle: string};
    donor: {slug: string; name: string; principle: string};
    /** The learned power. */
    name: string;
    expression: string;
    /** "+1 Intelligence" etc. */
    boosts: string[];
};

const STEP_SECONDS = 8;

/**
 * The /animal-hybrids opening explainer: how a fusion works, shown on real
 * published fusions. The two animals come together, then the power the first
 * learns from the second appears with its stat boost.
 */
export default function FusionExplainer({items}: {items: FusionExplainerItem[]}) {
    return (
        <ExplainerShell
            id="fusion-explainer"
            eyebrow="How a fusion works"
            title="One animal keeps its lesson and learns another's."
            description="A hybrid imagines two animals as one creature. A fusion keeps both real: the first animal keeps its own power and learns a new one from the second."
            pauseLabel="Pause"
            playLabel="Play"
            seconds={STEP_SECONDS}
            tabs={items.map((item) => ({key: item.slug, label: item.name.toUpperCase(), sublabel: `${item.receiver.name} + ${item.donor.name}`, tint: "#A7F432"}))}
        >
            {({index, motion}) => <FusionPanel item={items[index]} motion={motion} />}
        </ExplainerShell>
    );
}

function AnimalTile({animal, role, side, entered, motion}: {
    animal: {slug: string; name: string; principle: string};
    role: string;
    side: "left" | "right";
    entered: boolean;
    motion: boolean;
}) {
    return (
        <Link
            href={`/animals/${animal.slug}`}
            className="group flex min-w-0 flex-col items-center gap-2 text-center"
            style={{
                opacity: entered ? 1 : 0,
                transform: entered ? "none" : `translateX(${side === "left" ? -40 : 40}px)`,
                transition: motion ? "opacity 450ms ease, transform 600ms cubic-bezier(.2,.9,.3,1.1)" : "none"
            }}
        >
            <span className="grid h-24 w-24 place-items-center border border-line-300 bg-black/40 transition-colors group-hover:border-primary-400 md:h-32 md:w-32">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getSpeciesArtworkRoute(animal.slug)} alt="" className="h-full w-full object-contain p-2" loading="lazy" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">{role}</span>
            <span className="font-display text-lg font-bold leading-tight text-white group-hover:text-primary-100">{animal.name}</span>
            <span className="text-xs text-ink-300">{animal.principle}</span>
        </Link>
    );
}

function FusionPanel({item, motion}: {item: FusionExplainerItem; motion: boolean}) {
    /** 0 apart, 1 together, 2 the learned power shows. Reduced motion starts at 2. */
    const [stage, setStage] = useState(motion ? 0 : 2);

    useEffect(() => {
        if (!motion) return;
        const timers = [window.setTimeout(() => setStage(1), 80), window.setTimeout(() => setStage(2), 1500)];
        return () => timers.forEach((timer) => window.clearTimeout(timer));
    }, [motion]);

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 md:gap-8">
                <AnimalTile animal={item.receiver} role="Keeps its power" side="left" entered={stage >= 1} motion={motion} />
                <span
                    aria-hidden="true"
                    className="mt-9 grid h-10 w-10 place-items-center border font-display text-2xl font-bold md:mt-12"
                    style={{
                        color: stage >= 2 ? "#070A08" : "#A7F432",
                        backgroundColor: stage >= 2 ? "#A7F432" : "transparent",
                        borderColor: "#A7F432",
                        boxShadow: stage >= 2 && motion ? "0 0 24px rgba(167,244,50,0.55)" : "none",
                        transition: motion ? "all 400ms ease" : "none"
                    }}
                >
                    +
                </span>
                <AnimalTile animal={item.donor} role="Teaches its power" side="right" entered={stage >= 1} motion={motion} />
            </div>

            <div
                className="border border-primary-500/40 bg-primary-400/[0.06] p-5"
                style={{
                    opacity: stage >= 2 ? 1 : 0,
                    transform: stage >= 2 ? "none" : "translateY(8px)",
                    transition: motion ? "opacity 450ms ease, transform 450ms ease" : "none"
                }}
            >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-300">Learned power</p>
                <p className="mt-1 font-display text-2xl font-bold text-white md:text-3xl">{item.name}</p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-200 md:text-base md:leading-7">{item.expression}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    {item.boosts.map((boost) => (
                        <span key={boost} className="border border-primary-500/40 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-primary-200">
                            {boost}
                        </span>
                    ))}
                    <Link href={item.href} className="ml-auto text-sm font-semibold text-primary-200 underline-offset-4 hover:text-primary-100 hover:underline">
                        See the fusion
                    </Link>
                </div>
            </div>
        </div>
    );
}
