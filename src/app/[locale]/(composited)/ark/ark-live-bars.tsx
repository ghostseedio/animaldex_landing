"use client";

import React, {useEffect, useRef, useState} from "react";
import {arkBars, arkDeltaText, ARK_TREND_MS, type ArkBars} from "@/lib/ark-live-bars";
import type {ArkPairStatus, ArkPopulation} from "@/lib/ark-population";
import {ARK_LIVE_ENGLISH} from "@/lib/ark-live-words";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";

/**
 * The population column's bars (owner, 2026-11-11): each species' count as a bar against the biggest of its
 * region, each region's total against the biggest region (`lib/ark-live-bars.ts`, log scale), the pair line
 * marked, the pair status as the bar's colour. A change glides the bar to its new length and flashes an arrow
 * by the count ("▲+2", "▼−1"). Hooked into `ark-population-hud.tsx`; the numbers and the rows' accessible
 * labels stay the HUD's own.
 */

const FILL: Record<ArkPairStatus, string> = {
    single: "bg-[#e9c77b]",
    pair: "bg-primary-300",
    more: "bg-primary-200",
    crowded: "bg-[#ee9f6c]"
};

const UP = "rgba(200, 250, 99, 0.75)";
const DOWN = "rgba(238, 159, 108, 0.8)";

/** Every bar's length, looked up by species key and by region. */
export type ArkBarIndex = {species: (key: string) => {share: number; pairShare: number}; region: (region: string) => number};

export function arkBarIndex(population: Pick<ArkPopulation, "regions">): ArkBarIndex {
    const bars: ArkBars = arkBars(population);
    const species = new Map<string, {share: number; pairShare: number}>();
    const regions = new Map<string, number>();
    for (const region of bars.regions) {
        regions.set(region.region, region.share);
        for (const row of region.rows) species.set(row.key, {share: row.share, pairShare: region.pairShare});
    }
    return {species: (key) => species.get(key) ?? {share: 0, pairShare: 0}, region: (region) => regions.get(region) ?? 0};
}

/** The change since the last count, held for a moment after it happens (0 when none). */
function useTrend(count: number): number {
    const last = useRef<number | null>(null);
    const [trend, setTrend] = useState<{delta: number; at: number} | null>(null);
    useEffect(() => {
        const before = last.current;
        last.current = count;
        if (before === null || before === count) return;
        const now = Date.now();
        setTrend((held) => ({delta: (held && now - held.at < ARK_TREND_MS ? held.delta : 0) + count - before, at: now}));
        const timer = setTimeout(() => setTrend(null), ARK_TREND_MS);
        return () => clearTimeout(timer);
    }, [count]);
    return trend?.delta ?? 0;
}

type LiveWords = Pick<ArkWords, "live">;

function liveOf(words: LiveWords) {
    return {...ARK_LIVE_ENGLISH, ...(words.live ?? {})};
}

/** A species' bar, under its name: its share of its region's scale, the pair line, its status' colour. */
export function ArkSpeciesBar({count, share, pairShare, status, words}: {count: number; share: number; pairShare: number; status: ArkPairStatus; words: LiveWords}) {
    const delta = useTrend(count);
    return (
        <span aria-hidden="true" title={liveOf(words).barsNote} className="relative mt-1.5 block h-1.5 w-full max-w-[13rem] rounded-full bg-white/[0.09]">
            <span
                className={`absolute inset-y-0 left-0 rounded-full transition-[width,box-shadow] duration-700 ease-out motion-reduce:transition-none rtl:left-auto rtl:right-0 ${FILL[status]}`}
                style={{width: `${(share * 100).toFixed(1)}%`, boxShadow: delta ? `0 0 9px ${delta > 0 ? UP : DOWN}` : "none"}}
            />
            {pairShare > 0 ? <span className="absolute -inset-y-0.5 w-px rounded-full bg-white/50" style={{insetInlineStart: `${(pairShare * 100).toFixed(1)}%`}} /> : null}
        </span>
    );
}

/** A region's bar along the foot of its heading: its total against the biggest region. */
export function ArkRegionBar({share, words}: {share: number; words: LiveWords}) {
    return (
        <span aria-hidden="true" title={liveOf(words).barsNote} className="pointer-events-none absolute inset-x-4 bottom-0 block h-[3px] rounded-full bg-white/[0.06] md:inset-x-5">
            <span className="absolute inset-y-0 left-0 rounded-full bg-white/45 transition-[width] duration-700 ease-out motion-reduce:transition-none rtl:left-auto rtl:right-0" style={{width: `${(share * 100).toFixed(1)}%`}} />
        </span>
    );
}

/** "▲+2" / "▼−1" beside a count that just changed; nothing otherwise. */
export function ArkCountTrend({count, locale, words}: {count: number; locale: string; words: LiveWords}) {
    const delta = useTrend(count);
    const live = liveOf(words);
    if (!delta) return null;
    const label = fillArkWords(delta > 0 ? live.up : live.down, {count: Math.abs(delta).toLocaleString(locale)});
    return (
        <span title={label} aria-hidden="true" className={`rows-in text-[11px] font-extrabold tabular-nums ${delta > 0 ? "text-primary-300" : "text-[#ee9f6c]"}`}>
            {delta > 0 ? "▲" : "▼"}
            {arkDeltaText(delta, locale)}
        </span>
    );
}
