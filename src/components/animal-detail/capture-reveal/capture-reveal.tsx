"use client";

import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {CONTINUATION_NOTE, type RewardShowcaseItem, newSpeciesMessage} from "@/lib/capture-reveal";

/**
 * What a newly identified capture opens with: the discovery, the reward, and
 * where to go next. Ported from iOS `ScanResultView.newSpeciesCard`, the reward
 * showcase and `ScanResultActionBar`'s continuation actions.
 */

const NEON = "#A7F432";

const SETTING_TINT: Record<string, string> = {
    wild: "56,250,71",
    zoo: "250,219,71",
    domestic: "140,199,255",
    farm: "209,166,89",
    unknown: "158,158,173"
};

export function NewSpeciesCard({animalName, settingTag}: {animalName: string; settingTag?: string | null}) {
    const tint = SETTING_TINT[settingTag?.trim().toLowerCase() ?? "unknown"] ?? SETTING_TINT.unknown;

    return (
        <section
            className="flex items-center gap-3 border-b px-5 py-4 font-sans"
            style={{backgroundColor: `rgba(${tint},0.14)`, borderColor: `rgba(${tint},0.32)`}}
        >
            <span aria-hidden="true" className="text-lg font-bold" style={{color: NEON}}>✦</span>
            <div className="flex min-w-0 flex-col gap-1">
                <h3 className="text-base font-bold text-white">New species discovered</h3>
                <p className="text-sm leading-6 text-white/60">{newSpeciesMessage(animalName)}</p>
            </div>
        </section>
    );
}

/** How long each reward card holds the screen before the next one takes it. */
const REWARD_CARD_MS = 3400;

/**
 * The reward cards, played once and then gone. A tap moves on, so nobody has
 * to wait out a card they have already read.
 */
export function RewardShowcase({items, onFinished}: {items: RewardShowcaseItem[]; onFinished: () => void}) {
    const [index, setIndex] = useState(0);
    const item = items[index] ?? null;

    useEffect(() => {
        if (!item) {
            onFinished();
            return undefined;
        }
        const timer = window.setTimeout(() => setIndex((current) => current + 1), REWARD_CARD_MS);
        return () => window.clearTimeout(timer);
    }, [item, onFinished]);

    if (!item) return null;

    return (
        <button
            type="button"
            onClick={() => setIndex((current) => current + 1)}
            aria-label={`${item.title}. ${item.totalLabel} ${item.totalValueText}. ${item.subtitle}. Tap to continue.`}
            className="fixed inset-0 z-[62] flex items-center justify-center bg-black/70 px-6 font-sans"
        >
            <span
                key={index}
                role="status"
                className="flex w-full max-w-xs flex-col gap-3 rounded-[1.5rem] border border-[#A7F432]/40 bg-gradient-to-b from-[#A7F432]/25 to-[#A7F432]/5 px-5 py-6 text-left shadow-2xl"
            >
                <span className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/60">
                    <span aria-hidden="true" style={{color: NEON}}>✦</span>
                    {item.title}
                </span>
                <span className="flex flex-col gap-1.5">
                    {item.lines.map((line) => (
                        <span key={line.title} className="flex items-baseline justify-between gap-3 text-sm text-white/75">
                            <span>{line.title}</span>
                            <span className="font-mono font-bold tabular-nums text-white">
                                {line.points >= 0 ? `+${line.points}` : line.points}
                            </span>
                        </span>
                    ))}
                </span>
                <span className="flex items-baseline justify-between gap-3 border-t border-white/15 pt-3">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">{item.totalLabel}</span>
                    <span className="font-display text-3xl font-bold text-white">{item.totalValueText}</span>
                </span>
                <span className="text-sm text-white/60">{item.subtitle}</span>
                {item.educationChip ? (
                    <span className="w-fit rounded-full bg-black/35 px-3 py-1.5 text-[11px] font-semibold" style={{color: NEON}}>
                        {item.educationChip}
                    </span>
                ) : null}
            </span>
        </button>
    );
}

/**
 * The closing beat of the reveal: saved, then where next. The capture is
 * already in the collection — the pipeline saved it — so this offers where to
 * go, never another save.
 */
export function CaptureContinuationBar() {
    return (
        // Above the floating Ask AnimalDex pill, which on a capture card sits
        // just over the tab bar and would otherwise cover "Scan Another".
        <div className="pointer-events-none fixed inset-x-0 bottom-[9.5rem] z-30 flex justify-center px-4 font-sans lg:bottom-6">
            <div className="pointer-events-auto flex w-full max-w-md flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-black/85 p-4 shadow-2xl backdrop-blur">
                <p className="flex items-center gap-2 text-sm text-white">
                    <span aria-hidden="true" className="text-[13px] font-bold" style={{color: NEON}}>✓</span>
                    {CONTINUATION_NOTE}
                </p>
                <div className="flex gap-2">
                    <Link
                        href="/app/collection"
                        className="flex min-h-12 flex-1 items-center justify-center rounded-[1.1rem] text-sm font-black text-black/90"
                        style={{backgroundColor: NEON}}
                    >
                        View in My Dex
                    </Link>
                    <Link
                        href="/app/capture"
                        className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[1.1rem] border border-white/10 bg-white/[0.06] text-sm font-black"
                        style={{color: NEON}}
                    >
                        Scan Another
                    </Link>
                </div>
            </div>
        </div>
    );
}
