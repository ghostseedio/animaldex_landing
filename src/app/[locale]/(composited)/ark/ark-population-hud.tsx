"use client";

import React, {useEffect, useMemo, useRef} from "react";
import Link from "@/app/[locale]/_components/link";
import ArkShareButton from "@/app/[locale]/(composited)/ark/ark-share";
import {REGION_ZONES, type ArkRegion, type ArkSnapshot} from "@/ark-scene/types";
import {arkPopulation, type ArkPairStatus, type ArkSpeciesRow} from "@/lib/ark-population";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";
import {arkIconUrl} from "@/ark-scene/placeholder";
import ArkSpeciesIcon from "@/app/[locale]/(composited)/ark/ark-species-icon";

/**
 * Who is aboard the Ark, species by species: the totals, then every species
 * grouped by region with its live count against the ideal of two. A species
 * flies the camera to one of its animals; a region to the region.
 *
 * Desktop: a column beside the world, folded to a rail on request. Phone: a
 * band under the world, edge to edge, its first rows open and the rest one
 * tap away.
 *
 * For a screen reader (A18) it is a list per region under a heading, each
 * row a button saying the species, its count and its pair status; a herd
 * (A14) says so, and opens the species' card rather than one animal's.
 */

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-300";

/** Rows shown on a phone before "Show all". */
const PHONE_ROWS = 6;

const STATUS_TONE: Record<ArkPairStatus, {text: string; dot: string}> = {
    single: {text: "text-[#e9c77b]", dot: "bg-[#e9c77b]"},
    pair: {text: "text-primary-300", dot: "bg-primary-300"},
    more: {text: "text-primary-200", dot: "bg-primary-200"},
    crowded: {text: "text-[#ee9f6c]", dot: "bg-[#ee9f6c]"}
};

type Props = {
    snapshot: ArkSnapshot;
    words: ArkWords;
    locale: string;
    /** The species of the selected animal (or herd), highlighted. */
    selectedKey: string | null;
    /** Species drawn as a herd (A14). */
    herdKeys: ReadonlySet<string>;
    /** The species of the newest arrival, while its notice shows. */
    arrivalKey: string | null;
    region: ArkRegion | null;
    /** Desktop only: folded to a rail. */
    folded: boolean;
    onFold: (folded: boolean) => void;
    expanded: boolean;
    onExpand: (expanded: boolean) => void;
    beginning: boolean;
    onSpecies: (row: ArkSpeciesRow) => void;
    onRegion: (region: ArkRegion | null) => void;
    /** The page's own path ("/ark", "/id/ark"): where a share link points. */
    shareLocalePath?: string;
};

function counted(count: number, one: string, other: string, locale: string): string {
    return count === 1 ? one : other.replace("{count}", count.toLocaleString(locale));
}

function PairMeter({count, status}: {count: number; status: ArkPairStatus}) {
    const tone = STATUS_TONE[status].dot;
    return (
        <span aria-hidden="true" className="flex items-center gap-[3px]">
            <span className={`h-2 w-2 rounded-full ${tone}`} />
            <span className={`h-2 w-2 rounded-full ${count >= 2 ? tone : "border border-white/25"}`} />
        </span>
    );
}

export default function ArkPopulationHud({snapshot, words, locale, selectedKey, herdKeys, arrivalKey, region, folded, onFold, expanded, onExpand, beginning, onSpecies, onRegion, shareLocalePath = "/ark"}: Props) {
    const hud = words.hud;
    const listRef = useRef<HTMLDivElement | null>(null);
    // An animal tapped in the world: its species' row comes into the column's view (desktop; the page never scrolls for it).
    useEffect(() => {
        const list = listRef.current;
        if (!list || !selectedKey || list.scrollHeight <= list.clientHeight) return;
        const row = list.querySelector<HTMLElement>(`[data-species="${CSS.escape(selectedKey)}"]`);
        if (!row) return;
        const top = row.offsetTop;
        if (top < list.scrollTop || top + row.offsetHeight > list.scrollTop + list.clientHeight) {
            list.scrollTo({top: Math.max(top - list.clientHeight / 3, 0), behavior: "smooth"});
        }
    }, [selectedKey]);
    const population = useMemo(() => arkPopulation(snapshot), [snapshot]);
    const number = (value: number) => value.toLocaleString(locale);
    const status = (value: ArkPairStatus) => hud[value];
    let index = 0;

    if (folded) {
        return (
            <aside id="ark-aboard" aria-label={hud.label} className="hidden border-l border-line-200 bg-canvas-950 md:flex md:w-14 md:flex-col md:items-center">
                <button
                    type="button"
                    onClick={() => onFold(false)}
                    aria-expanded={false}
                    aria-label={hud.show}
                    title={hud.show}
                    className={`flex h-full w-full flex-col items-center gap-3 pt-4 text-ink-200 transition-colors hover:bg-white/[0.04] hover:text-white ${FOCUS}`}
                >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
                    <span className="font-display text-lg font-extrabold tabular-nums text-white">{number(snapshot.counts.animals)}</span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400 [writing-mode:vertical-rl]">{hud.title}</span>
                </button>
            </aside>
        );
    }

    return (
        <aside id="ark-aboard" aria-labelledby="ark-aboard-title" tabIndex={-1} className="flex flex-col outline-none border-t border-line-200 bg-canvas-950 md:h-full md:w-[21rem] md:shrink-0 md:border-l md:border-t-0 lg:w-[23rem]">
            {/* The totals. */}
            <div className="border-b border-line-200 px-4 pb-4 pt-4 md:px-5">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="ark-aboard-title" className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-300"><span className="sr-only">{hud.label}</span><span aria-hidden="true">{hud.title}</span></h2>
                    <div className="flex items-center gap-1">
                        <ArkShareButton
                            target="population"
                            look="icon"
                            localePath={shareLocalePath}
                            slug={null}
                            title={words.eyebrow}
                            text={fillArkWords(words.share.textArk, {
                                animals: counted(snapshot.counts.animals, words.animalsOne, words.animalsOther, locale),
                                species: counted(snapshot.counts.species, words.speciesOne, words.speciesOther, locale)
                            })}
                            label={words.share.shareArk}
                            copied={words.share.copied}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
                        />
                        <button
                            type="button"
                            aria-pressed={region === null}
                            onClick={() => onRegion(null)}
                            className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold transition-colors ${FOCUS} ${region === null ? "border-primary-400 text-white" : "border-line-200 text-ink-200 hover:border-line-100 hover:text-white"}`}
                        >
                            {words.wholeWorld}
                        </button>
                        <button
                            type="button"
                            onClick={() => onFold(true)}
                            aria-expanded
                            aria-label={hud.hide}
                            title={hud.hide}
                            className={`hidden h-8 w-8 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-white/10 hover:text-white md:flex ${FOCUS}`}
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                        </button>
                    </div>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-3">
                    {([["statAnimals", snapshot.counts.animals], ["statSpecies", snapshot.counts.species], ["statFounders", snapshot.counts.founders]] as const).map(([key, value]) => (
                        <div key={key} className="flex flex-col-reverse">
                            <dt className="text-[12px] text-ink-400">{hud[key]}</dt>
                            <dd className="font-display text-[1.75rem] font-extrabold leading-none tabular-nums text-white">{number(value)}</dd>
                        </div>
                    ))}
                </dl>
                {population.species > 0 ? (
                    <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-200">
                        <PairMeter count={population.paired ? 2 : 1} status={population.paired ? "pair" : "single"} />
                        {fillArkWords(hud.pairsLine, {paired: number(population.paired), species: number(population.species)})}
                    </p>
                ) : null}
            </div>

            {/* Every species, by region. */}
            <div ref={listRef} className="relative min-h-0 flex-1 md:overflow-y-auto md:overscroll-contain" role="group" aria-label={words.a11y.list}>
                {population.regions.map((group) => (
                    <section key={group.region} aria-labelledby={`ark-region-${group.region}`}>
                        <h3 className="m-0">
                        <button
                            type="button"
                            onClick={() => onRegion(group.region)}
                            aria-pressed={region === group.region}
                            aria-label={fillArkWords(hud.flyTo, {region: words.regions[group.region]})}
                            title={REGION_ZONES[group.region].map((zone) => words.zones[zone]).join(" · ")}
                            className={`${index >= PHONE_ROWS && !expanded ? "hidden md:flex" : "flex"} min-h-10 w-full items-center justify-between gap-3 border-b border-line-300 px-4 pt-3 pb-1.5 text-left transition-colors hover:text-white md:px-5 ${FOCUS} ${region === group.region ? "text-white" : "text-ink-300"}`}
                        >
                            <span id={`ark-region-${group.region}`} className="text-[11px] font-bold uppercase tracking-[0.14em]">{words.regions[group.region]}</span>
                            <span className="text-[12px] tabular-nums text-ink-400">{number(group.animals)}</span>
                        </button>
                        </h3>
                        <ul aria-label={fillArkWords(words.a11y.regionCount, {region: words.regions[group.region], count: number(group.animals)})}>
                            {group.species.map((row) => {
                                const hidden = index++ >= PHONE_ROWS && !expanded;
                                const selected = row.key === selectedKey;
                                const fresh = row.key === arrivalKey;
                                const isHerd = herdKeys.has(row.key) || row.breeds.some((breed) => herdKeys.has(breed.key));
                                const label = fillArkWords(hud.rowLabel, {animal: row.name, count: number(row.count), status: status(row.status)}) + (row.breeds.length ? `; ${fillArkWords(hud.breeds, {breeds: row.breeds.map((breed) => `${breed.name} ${number(breed.count)}`).join(", ")})}` : "");
                                return (
                                    <li key={row.key} data-species={row.key} className={hidden ? "hidden md:block" : undefined}>
                                        <button
                                            type="button"
                                            onClick={() => onSpecies(row)}
                                            aria-current={selected ? "true" : undefined}
                                            aria-label={isHerd ? `${label}, ${hud.herdTag}` : label}
                                            className={`group relative flex min-h-[3.25rem] w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-200 md:px-5 ${FOCUS} ${selected ? "bg-white/[0.07]" : fresh ? "bg-primary-400/[0.10]" : "hover:bg-white/[0.04]"}`}
                                        >
                                            {selected ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-primary-400" /> : null}
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7]">
                                                <ArkSpeciesIcon src={arkIconUrl(row.slug)} size={36} className="h-[82%] w-[82%] object-contain" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-2">
                                                    <span className="truncate text-[14px] font-bold text-white">{row.name}</span>
                                                    {row.mine ? <span className="shrink-0 rounded-full bg-primary-400/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.08em] text-primary-200">{hud.yours}</span> : null}
                                                </span>
                                                <span className={`block text-[12px] ${STATUS_TONE[row.status].text}`}>{status(row.status)}{isHerd ? <span className="text-ink-400"> · {hud.herdTag}</span> : null}</span>
                                                {/* A kind with breeds aboard (A1): one row, its breeds named. */}
                                                {row.breeds.length ? (
                                                    <span className="block truncate text-[11px] text-ink-400">
                                                        {row.breeds.map((breed) => `${breed.name} ${number(breed.count)}`).join(" · ")}
                                                    </span>
                                                ) : null}
                                            </span>
                                            <span className="flex shrink-0 items-center gap-2.5">
                                                <PairMeter count={row.count} status={row.status} />
                                                <span className="min-w-6 text-right font-display text-base font-extrabold tabular-nums text-white">{number(row.count)}</span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}

                {index > PHONE_ROWS ? (
                    <button
                        type="button"
                        onClick={() => onExpand(!expanded)}
                        aria-expanded={expanded}
                        className={`flex min-h-12 w-full items-center justify-center gap-2 border-t border-line-300 text-sm font-bold text-primary-300 md:hidden ${FOCUS}`}
                    >
                        {expanded ? hud.showFewer : fillArkWords(hud.showAll, {count: number(population.species)})}
                        <span aria-hidden="true" className={`text-xs transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
                    </button>
                ) : null}

                {/* A beginning Ark: what the few rows mean, and the way to add one. */}
                {beginning ? (
                    <div className="border-t border-line-300 px-4 py-5 md:px-5">
                        {/* On a phone the page's "How an animal comes aboard" follows at once, with the same move. */}
                        <p className="font-display text-base font-extrabold text-white">{hud.earlyTitle}</p>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-200">{hud.earlyBody}</p>
                        <Link href="/talk" className="mt-4 hidden min-h-10 md:inline-flex items-center gap-2 rounded-full bg-primary-400 px-4 text-[13px] font-bold text-canvas-950 transition-colors hover:bg-primary-100">
                            {hud.bring}
                            <span aria-hidden="true">→</span>
                        </Link>
                    </div>
                ) : null}
            </div>

            <p className="border-t border-line-300 px-4 py-3 text-[12px] leading-snug text-ink-400 md:px-5">{words.hint}</p>
        </aside>
    );
}
