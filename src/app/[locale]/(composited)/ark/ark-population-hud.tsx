"use client";

import React, {useCallback, useEffect, useId, useMemo, useRef, useState} from "react";
import ArkShareButton from "@/app/[locale]/(composited)/ark/ark-share";
import ArkSpeciesIcon from "@/app/[locale]/(composited)/ark/ark-species-icon";
import type {ArkSnapshot} from "@/ark-scene/types";
import {arkIconUrl} from "@/ark-scene/placeholder-icon";
import {arkBarCeiling, arkBarShare} from "@/lib/ark-live-bars";
import {arkChangeOf, arkChangeText, arkRankedSpecies, arkTotalChange, type ArkChange, type ArkChangeScope, type ArkPopulationThen} from "@/lib/ark-population-change";
import type {ArkSpeciesRow} from "@/lib/ark-population";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";
import {arkPerfCountRender} from "@/ark-scene/runtime/perf";

/**
 * Who is aboard, over the Ark (decision 239; owner, 2026-11-12: "much more minimal - and maybe overlaying the ark
 * instead of a sidebar, it should represent populations only in order of biggest first"). A small glass panel in the
 * world's top end corner: the total and its 24-hour change, the island filter, then every species biggest first as a
 * thin bar with its icon, name, count and 24-hour change (green ▲ / red ▼, nothing when the same). About a dozen
 * show; the rest scroll inside. A row flies to one of that species' animals, as before.
 *
 * It folds to a chip ("3,152 aboard ▾"): folded at first on a phone, open on a desktop, then as the reader left it
 * on this device. It sits in the page's overlay grid (`ark-view.tsx`): beside the toolbar on a desktop, under it on a
 * phone (the whole width when open there).
 *
 * For a screen reader (A18) it is a list of buttons, each saying the species, its count and its change; a herd (A14)
 * and the reader's own say so.
 */

/** The reader's fold, per device: "1" open, "0" folded; absent: by the screen. */
export const ARK_HUD_OPEN_KEY = "ark.hud.open";
const PHONE = "(max-width: 767px)";
/** Rows rendered at a time. */
const ROWS_STEP = 40;

const GLASS = "border border-white/[0.14] bg-[rgba(14,20,14,0.72)] text-[#fffcf4] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl";
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#c8fa63]";
const UP = "text-[#86e08f]";
const DOWN = "text-[#ff8a7a]";

type Props = {
    /** The whole Ark (the total's change); null until the client has read it (decision 246). */
    snapshot: ArkSnapshot | null;
    /** The total, its species and founders: the Ark's, else the page's summary before it is read. */
    counts: ArkSnapshot["counts"];
    /** What the rows list: the island shown, both islands, or the reader's own animals; null until read (placeholders). */
    listed: ArkSnapshot | null;
    /** The rows' scope, for their 24-hour change. */
    scope: ArkChangeScope;
    /** Each species' count 24 hours ago; null: not read (yet), or not to be said (the reader's own). */
    then: ArkPopulationThen | null;
    /** The same for the total (whole Ark), so the reader's own list can still show the Ark's change. */
    totalThen: ArkPopulationThen | null;
    words: ArkWords;
    locale: string;
    /** The species of the selected animal (or herd), highlighted. */
    selectedKey: string | null;
    /** Species drawn as a herd (A14). */
    herdKeys: ReadonlySet<string>;
    /** The species of the newest arrival, while its notice shows. */
    arrivalKey: string | null;
    onSpecies: (row: ArkSpeciesRow) => void;
    /** The island filter and "My animals", over the rows. */
    filters?: React.ReactNode;
    /** The page's own path ("/ark", "/id/ark"): where a share link points. */
    shareLocalePath?: string;
};

function counted(count: number, one: string, other: string, locale: string): string {
    return count === 1 ? one : other.replace("{count}", count.toLocaleString(locale));
}

/** "▲ +12%" in green, "▼ −3%" in red; nothing when the count is the same or the log was not read. */
export function ArkChangeBadge({change, words, locale, className = ""}: {change: ArkChange | null; words: ArkWords; locale: string; className?: string}) {
    const said = arkChangeText(change, locale);
    if (!said) return null;
    const label = fillArkWords(words.hud.change24h, {change: said.text});
    return (
        <span title={label} className={`shrink-0 whitespace-nowrap text-[11px] font-bold tabular-nums leading-none ${said.up ? UP : DOWN} ${className}`}>
            <span aria-hidden="true">
                <span className="text-[8px]">{said.up ? "▲" : "▼"}</span> {said.text}
            </span>
            <span className="sr-only">{label}</span>
        </span>
    );
}

function Caret({up}: {up: boolean}) {
    return (
        <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 shrink-0 opacity-75 transition-transform duration-200 motion-reduce:transition-none ${up ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 7.5l5 5 5-5" />
        </svg>
    );
}

export default function ArkPopulationHud({snapshot, counts, listed, scope, then, totalThen, words, locale, selectedKey, herdKeys, arrivalKey, onSpecies, filters = null, shareLocalePath = "/ark"}: Props) {
    arkPerfCountRender();
    const hud = words.hud;
    const panelId = useId();
    const listRef = useRef<HTMLUListElement | null>(null);
    const headingRef = useRef<HTMLHeadingElement | null>(null);
    // Null: as the screen has it (a phone folded, a desktop open) with no flash before the reader's choice is read.
    const [open, setOpenState] = useState<boolean | null>(null);
    const setOpen = useCallback((next: boolean, remember = true) => {
        setOpenState(next);
        if (!remember) return;
        try {
            window.localStorage.setItem(ARK_HUD_OPEN_KEY, next ? "1" : "0");
        } catch {
            // For this visit.
        }
    }, []);
    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(ARK_HUD_OPEN_KEY);
            if (stored === "1" || stored === "0") setOpenState(stored === "1");
        } catch {
            // No storage: by the screen.
        }
        // "#ark-aboard" (the skip link, About's link): open, and its heading takes focus.
        const asked = () => {
            if (window.location.hash !== "#ark-aboard") return;
            setOpenState(true);
            window.setTimeout(() => headingRef.current?.focus({preventScroll: true}), 0);
        };
        asked();
        window.addEventListener("hashchange", asked);
        return () => window.removeEventListener("hashchange", asked);
    }, []);
    const isOpen = () => open ?? !window.matchMedia(PHONE).matches;

    const rows = useMemo(() => arkRankedSpecies(listed), [listed]);
    // Rows are rendered a step at a time (decision 246: never hundreds of buttons at once), more as the end scrolls in.
    const [limit, setLimit] = useState(ROWS_STEP);
    const moreRef = useRef<HTMLLIElement | null>(null);
    const selectedIndex = selectedKey ? rows.findIndex((row) => row.key === selectedKey) : -1;
    const shownRows = rows.slice(0, Math.max(limit, selectedIndex + 1));
    useEffect(() => {
        const sentinel = moreRef.current;
        const list = listRef.current;
        if (!sentinel || !list || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) setLimit((now) => now + ROWS_STEP);
        }, {root: list, rootMargin: "0px 0px 240px 0px"});
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [shownRows.length, rows.length]);
    const ceiling = useMemo(() => arkBarCeiling(rows[0]?.count ?? 0), [rows]);
    const number = (value: number) => value.toLocaleString(locale);
    const total = snapshot ? arkTotalChange(snapshot.animals.length, totalThen, "both") : null;
    const totalSaid = arkChangeText(total, locale);
    const totalLine = fillArkWords(hud.chip, {count: number(counts.animals)});
    const subline = `${counted(counts.species, words.speciesOne, words.speciesOther, locale)} · ${counted(counts.founders, words.foundersOne, words.foundersOther, locale)}`;

    // An animal tapped in the world: its species' row comes into the panel's view (the page never scrolls for it).
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

    // A card opening on a phone (a tap in the world) folds the open panel too: the card and the animal need the room.
    useEffect(() => {
        if (selectedKey && window.matchMedia(PHONE).matches) setOpen(false, false);
    }, [selectedKey, setOpen]);

    const pick = (row: ArkSpeciesRow) => {
        onSpecies(row);
        // On a phone the open panel would cover the animal it flies to: it folds (not remembered as the reader's choice).
        if (window.matchMedia(PHONE).matches) setOpen(false, false);
    };

    // Folded: the chip. Open: the panel. Before the reader's choice is read, the screen decides (CSS only, no shift).
    const chipShown = open === null ? "flex md:hidden" : open ? "hidden" : "flex";
    const panelShown = open === null ? "hidden md:flex" : open ? "flex" : "hidden";
    // In the overlay grid: under the toolbar on a phone (the whole width when open), beside it on a desktop.
    const place = open ? "col-span-2 justify-self-stretch" : "col-span-2 justify-self-end";

    return (
        <section id="ark-aboard" aria-labelledby={`${panelId}-title`} tabIndex={-1} className={`pointer-events-none row-start-2 scroll-mt-[8rem] md:scroll-mt-[4.8rem] flex min-h-0 min-w-0 flex-col self-start outline-none md:col-span-1 md:col-start-2 md:row-span-2 md:row-start-1 md:max-h-full md:justify-self-end ${place}`}>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-expanded={false}
                aria-controls={panelId}
                aria-label={[totalLine, totalSaid ? fillArkWords(hud.change24h, {change: totalSaid.text}) : null, hud.show].filter(Boolean).join(", ")}
                title={hud.show}
                className={`${chipShown} ${GLASS} ${FOCUS} pointer-events-auto h-11 items-center gap-2 rounded-full pl-3.5 pr-3 text-[13px] font-bold tabular-nums transition-colors hover:bg-[rgba(24,32,24,0.82)] md:h-9`}
            >
                <span className="whitespace-nowrap">{totalLine}</span>
                <ArkChangeBadge change={total} words={words} locale={locale} />
                <Caret up={false} />
            </button>

            <div id={panelId} className={`${panelShown} ${GLASS} pointer-events-auto min-h-0 w-full flex-col overflow-hidden rounded-2xl md:w-[19rem]`}>
                <div className="flex items-start gap-1 pb-2 pl-3.5 pr-1.5 pt-2.5">
                    <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <h2 id={`${panelId}-title`} ref={headingRef} tabIndex={-1} className="font-sans text-[15px] font-bold leading-tight tabular-nums outline-none focus-visible:underline">
                                <span className="sr-only">{hud.label}: </span>
                                {totalLine}
                            </h2>
                            {totalSaid ? (
                                <span className="flex items-baseline gap-1">
                                    <ArkChangeBadge change={total} words={words} locale={locale} />
                                    <span aria-hidden="true" className="text-[10.5px] font-semibold text-white/40">{hud.changeWindow}</span>
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[11.5px] text-white/55">{subline}</p>
                    </div>
                    <ArkShareButton
                        target="population"
                        look="icon"
                        localePath={shareLocalePath}
                        slug={null}
                        title={words.eyebrow}
                        text={fillArkWords(words.share.textArk, {
                            animals: counted(counts.animals, words.animalsOne, words.animalsOther, locale),
                            species: counted(counts.species, words.speciesOne, words.speciesOther, locale)
                        })}
                        label={words.share.shareArk}
                        copied={words.share.copied}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60 md:h-8 md:w-8 ${FOCUS}`}
                    />
                    <button
                        type="button"
                        onClick={() => setOpen(!isOpen())}
                        aria-expanded
                        aria-controls={panelId}
                        aria-label={hud.hide}
                        title={hud.hide}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white md:h-8 md:w-8 ${FOCUS}`}
                    >
                        <Caret up />
                    </button>
                </div>

                {filters ? <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-2.5">{filters}</div> : null}

                {/* Every species, biggest first: about a dozen in view, the rest scroll inside the panel. */}
                <ul ref={listRef} aria-label={hud.listLabel} className="relative max-h-[46svh] min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-white/[0.08] py-1 [scrollbar-width:thin] md:max-h-[28rem]">
                    {listed ? null : Array.from({length: 8}, (_, i) => (
                        // Before the Ark is read: quiet placeholders at the rows' size (no shift when they come).
                        <li key={`wait-${i}`} aria-hidden="true" className="flex min-h-11 items-center gap-2.5 px-3.5 py-1 md:min-h-[2.375rem]">
                            <span className="h-6 w-6 shrink-0 rounded-full bg-white/[0.08]" />
                            <span className="min-w-0 flex-1">
                                <span className="block h-2.5 rounded-full bg-white/[0.08]" style={{width: `${72 - i * 5}%`}} />
                                <span className="mt-[7px] block h-[3px] rounded-full bg-white/[0.06]" style={{width: `${86 - i * 7}%`}} />
                            </span>
                            <span className="h-2.5 w-6 rounded-full bg-white/[0.08]" />
                        </li>
                    ))}
                    {shownRows.map((row, index) => {
                        const selected = row.key === selectedKey;
                        const fresh = row.key === arrivalKey;
                        const isHerd = herdKeys.has(row.key) || row.breeds.some((breed) => herdKeys.has(breed.key));
                        const change = arkChangeOf(row.count, then, row.key, scope);
                        const said = arkChangeText(change, locale);
                        const label = [
                            fillArkWords(hud.rowCount, {animal: row.name, count: number(row.count)}),
                            said ? fillArkWords(hud.change24h, {change: said.text}) : null,
                            row.mine ? hud.yours : null,
                            isHerd ? hud.herdTag : null,
                            row.breeds.length ? fillArkWords(hud.breeds, {breeds: row.breeds.map((breed) => `${breed.name} ${number(breed.count)}`).join(", ")}) : null
                        ].filter(Boolean).join(", ");
                        return (
                            // Its place in the whole list ("12 of 779"), though only the first rows are rendered yet.
                            <li key={row.key} data-species={row.key} aria-setsize={rows.length} aria-posinset={index + 1}>
                                <button
                                    type="button"
                                    onClick={() => pick(row)}
                                    aria-current={selected ? "true" : undefined}
                                    aria-label={label}
                                    className={`relative flex min-h-11 w-full items-center gap-2.5 px-3.5 py-1 text-left transition-colors duration-200 md:min-h-[2.375rem] ${FOCUS} ${selected ? "bg-white/[0.10]" : fresh ? "bg-[#c8fa63]/[0.10]" : "hover:bg-white/[0.06]"}`}
                                >
                                    {selected ? <span aria-hidden="true" className="absolute inset-y-1 left-0 w-[3px] rtl:left-auto rtl:right-0 rounded-full bg-[#c8fa63]" /> : null}
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7]">
                                        <ArkSpeciesIcon src={arkIconUrl(row.slug)} size={24} className="h-[84%] w-[84%] object-contain" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-1.5">
                                            <span className="truncate text-[13px] font-semibold leading-tight">{row.name}</span>
                                            {row.mine ? <span aria-hidden="true" title={hud.yours} className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c8fa63]" /> : null}
                                        </span>
                                        {/* Its count against the biggest (log scale: one animal and three hundred both read); it glides as it changes. */}
                                        <span aria-hidden="true" className="mt-[5px] block h-[3px] w-full rounded-full bg-white/[0.09]">
                                            <span
                                                className={`block h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${selected ? "bg-[#c8fa63]" : "bg-white/60"}`}
                                                style={{width: `${(arkBarShare(row.count, ceiling) * 100).toFixed(1)}%`}}
                                            />
                                        </span>
                                    </span>
                                    <ArkChangeBadge change={change} words={words} locale={locale} />
                                    <span className="min-w-[2rem] text-right text-[13px] font-bold tabular-nums">{number(row.count)}</span>
                                </button>
                            </li>
                        );
                    })}
                    {shownRows.length < rows.length ? <li ref={moreRef} aria-hidden="true" className="h-px" /> : null}
                </ul>
            </div>
        </section>
    );
}
