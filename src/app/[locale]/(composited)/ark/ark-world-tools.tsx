"use client";

import React, {useEffect, useId, useState} from "react";
import type {ArkIsland, ArkIslandCounts} from "@/ark-scene/types";
import type {ArkWords} from "@/lib/ark-words";
import {ARK_POSTER, ARK_POSTER_BLURRED} from "@/lib/ark-poster";

/**
 * What sits over the world's top start corner on /ark (decision 239; owner, 2026-11-12: "the ark needs to be as
 * fullscreen as possible", "these could be icon buttons: Lighter view / Sound"): the island switch, compact, then the
 * lighter view and sound as icon buttons, each with its name for a screen reader and a tooltip. And `ArkToast`, the
 * glass notice under them ("While you were away", a new arrival).
 *
 * Fixed dark glass, like the scene's own chips (the live log's, the reset button), so it reads over the world in
 * either site theme. 44 px targets on a phone, 36 px on a desktop.
 */

const GLASS = "border border-white/[0.14] bg-[rgba(14,20,14,0.72)] text-[#fffcf4] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl";
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c8fa63]";

type Props = {
    words: ArkWords;
    locale: string;
    /** Part C: the two islands (the one loaded, their counts, a crossing under way); null with one island. */
    islands: {island: ArkIsland; counts: ArkIslandCounts; crossing: boolean; names: Record<ArkIsland, string> & {label: string}; onCross: (island: ArkIsland) => void} | null;
    /** The lighter view (A18): on now, and whether the device chose it (the reader didn't). */
    lite: {on: boolean; auto: boolean; onToggle: () => void};
    sound: {on: boolean; onToggle: () => void};
};

function LiteIcon() {
    // A feather: fewer details, a lighter Ark.
    return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.2 3.8c-5.6-.5-10.6 2.4-12.6 7.6-.9 2.3-1.1 4.9-.9 7.4" />
            <path d="M20.2 3.8c.4 5.7-2.8 10.4-8.3 11.9-1.6.4-3.3.6-5 .4" />
            <path d="M4 20l6.5-6.5" />
        </svg>
    );
}

function SoundIcon({on}: {on: boolean}) {
    return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
            {on ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 5 6m0-6-5 6" />}
        </svg>
    );
}

/** An icon switch with a tooltip: its name and what it does (`title` too, for a long press or a hover elsewhere). */
function IconSwitch({on, label, hint, onClick, children, badge = false}: {on: boolean; label: string; hint: string; onClick: () => void; children: React.ReactNode; badge?: boolean}) {
    const tip = useId();
    return (
        <span className="group relative inline-flex shrink-0">
            <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={label}
                aria-describedby={tip}
                title={`${label}: ${hint}`}
                onClick={onClick}
                className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-200 motion-reduce:transition-none md:h-9 md:w-9 ${FOCUS} ${on ? "border border-[#c8fa63]/70 bg-[#c8fa63]/[0.18] text-[#e4ffb0] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl" : `${GLASS} hover:bg-[rgba(24,32,24,0.82)]`}`}
            >
                {children}
                {badge ? <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#c8fa63] md:right-1 md:top-1" /> : null}
            </button>
            <span id={tip} role="tooltip" className="pointer-events-none absolute left-0 top-full z-10 mt-2 hidden w-max max-w-[15rem] rounded-lg border border-white/10 bg-[rgba(14,20,14,0.94)] px-2.5 py-1.5 text-[11.5px] font-medium leading-snug text-white/80 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 rtl:left-auto rtl:right-0 md:block">
                <span className="font-bold text-white">{label}</span> · {hint}
            </span>
        </span>
    );
}

export function ArkWorldTools({words, locale, islands, lite, sound}: Props) {
    return (
        <div className="pointer-events-none col-span-2 row-start-1 flex min-w-0 items-center gap-1.5 md:col-span-1">
            {islands ? (
                <div role="group" aria-label={islands.names.label} className={`${GLASS} pointer-events-auto flex min-w-0 shrink items-center rounded-full p-0.5`}>
                    {(["wild", "town"] as const).map((id) => (
                        <button
                            key={id}
                            type="button"
                            aria-pressed={islands.island === id}
                            disabled={islands.crossing}
                            onClick={() => islands.onCross(id)}
                            className={`flex h-10 min-w-0 items-center gap-1 rounded-full px-2.5 font-sans text-[12.5px] font-bold leading-none transition-colors duration-200 motion-reduce:transition-none disabled:cursor-wait md:h-8 md:px-3 ${FOCUS} ${islands.island === id ? "bg-[#a7f432] text-canvas-950" : "text-[#fffcf4]/90 hover:bg-white/10"}`}
                        >
                            <span className="truncate">{islands.names[id]}</span>
                            {/* (Under 380 px the names keep the room; the counts are in who is aboard: `.ark-island-count`, globals.css.) */}
                            <span className="ark-island-count shrink-0 font-semibold tabular-nums opacity-70">{(id === "wild" ? islands.counts.wild : islands.counts.town).toLocaleString(locale)}</span>
                        </button>
                    ))}
                </div>
            ) : null}
            <span className="pointer-events-auto flex shrink-0 items-center gap-1.5">
                <IconSwitch on={lite.on} label={words.lite.label} hint={lite.auto ? `${words.lite.hint} (${words.lite.auto})` : words.lite.hint} onClick={lite.onToggle} badge={lite.auto}>
                    <LiteIcon />
                </IconSwitch>
                <IconSwitch on={sound.on} label={words.sound.label} hint={words.sound.hint} onClick={sound.onToggle}>
                    <SoundIcon on={sound.on} />
                </IconSwitch>
            </span>
        </div>
    );
}

/** A notice over the world, under the toolbar: glass, a line or two, its action at the end. */
export function ArkToast({children, className = "", ...rest}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div {...rest} className={`${GLASS} rows-in pointer-events-auto flex w-full max-w-[34rem] items-center gap-3 rounded-2xl py-2 pl-3.5 pr-2 ${className}`}>
            {children}
        </div>
    );
}

export const ARK_GLASS = GLASS;

// The poster frames and their placeholders (decision 246; `lib/ark-poster.ts`).
export {ARK_POSTER, ARK_POSTER_PLACEHOLDER} from "@/lib/ark-poster";

/** The placeholder, blurred by its own SVG (a still picture: no CSS filter redone each frame). */
function PosterPlaceholder({src, className}: {src: string; className: string}) {
    return <span aria-hidden="true" className={`absolute inset-0 bg-cover bg-center ${className}`} style={{backgroundImage: `url("${src}")`}} />;
}

/**
 * The poster over the world until the scene is up: the page's largest paint, in the server's HTML (no JavaScript
 * needed), then faded out as the live world takes over (instantly with reduced motion). Under it, the placeholder
 * frame, so even the first paint shows the Ark. The loading card (`ark-loader.tsx`) sits over the world beside it.
 */
export function ArkPoster({ready}: {ready: boolean}) {
    const [gone, setGone] = useState(false);
    useEffect(() => {
        if (!ready) return;
        const timer = setTimeout(() => setGone(true), 800);
        return () => clearTimeout(timer);
    }, [ready]);
    if (gone) return null;
    return (
        <div data-ark-poster="" aria-hidden="true" className={`pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-[#476260] transition-opacity duration-700 ease-out motion-reduce:transition-none ${ready ? "opacity-0" : "opacity-100"}`}>
            <PosterPlaceholder src={ARK_POSTER_BLURRED.tall} className="md:hidden" />
            <PosterPlaceholder src={ARK_POSTER_BLURRED.wide} className="hidden md:block" />
            <picture>
                <source media="(max-width: 767px)" srcSet={ARK_POSTER.tall} type="image/webp" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ARK_POSTER.wide} alt="" width={1600} height={900} decoding="async" {...({fetchPriority: "high"} as React.ImgHTMLAttributes<HTMLImageElement>)} className="absolute inset-0 h-full w-full object-cover" />
            </picture>
        </div>
    );
}
