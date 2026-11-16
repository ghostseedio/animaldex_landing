"use client";

import React, {useEffect, useMemo, useState} from "react";
import type {ArkSceneHandle} from "@/ark-scene/types";
import type {ArkWords} from "@/lib/ark-words";
import {ARK_DAY_BACK_MS, ARK_DAY_MAX_MS, arkDayText, arkIslandTime, type ArkActivityKey, type ArkAnimalDay} from "@/lib/ark-animal-status";

/**
 * "Its day" (lane ark-its-day, 2026-11-15): the tapped animal's last 24 hours as bands, what the card would have said
 * at every moment (the scene's `animalDay`: the same schedule and status function as the card, worked out a little a
 * frame, its latest hours first), its record lines on it as dots, a "now" marker, and a day further back at a time (a
 * week at most). Loaded only when opened (`ark-animal-card.tsx`).
 */

const DAYS_BACK = Math.round(ARK_DAY_BACK_MS / ARK_DAY_MAX_MS);

/** A band's colour by what it is: asleep, eating, moving, at rest, with others, on guard. */
const TONE: Record<ArkActivityKey, string> = {
    sleeping: "#5865c8",
    food: "#56b878",
    grazing: "#56b878",
    browsing: "#56b878",
    flowers: "#56b878",
    feeding: "#8fd16b",
    eating: "#56b878",
    scavenging: "#b88a4f",
    hunting: "#e0704f",
    fishing: "#3fb4a8",
    drinking: "#4aa8e0",
    toWater: "#4aa8e0",
    waiting: "#e0904f",
    prowling: "#e0904f",
    wary: "#e0904f",
    watching: "#c9a86a",
    resting: "#8a94a6",
    basking: "#d9b45a",
    grooming: "#a58fd6",
    bathing: "#6fc3d9",
    hiding: "#7d8794",
    nest: "#e08fb8",
    eggs: "#e08fb8",
    birthing: "#e08fb8",
    courting: "#e07aa8",
    sparring: "#d9677a",
    playing: "#e8a0c8",
    calling: "#c99ad9",
    wandering: "#e0b84f",
    about: "#e0b84f",
    home: "#c9b07a",
    flying: "#f0c86a",
    swimming: "#4f9be0",
    breathing: "#6fb0e8",
    climbing: "#b8a05a",
    digging: "#a8845a",
    light: "#e8d86a"
};

function durationText(ms: number, locale: string): string {
    const minutes = Math.max(Math.round(ms / 60_000), 1);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    try {
        const parts: string[] = [];
        if (h) parts.push(new Intl.NumberFormat(locale, {style: "unit", unit: "hour", unitDisplay: "narrow"}).format(h));
        if (m || !h) parts.push(new Intl.NumberFormat(locale, {style: "unit", unit: "minute", unitDisplay: "narrow"}).format(m));
        return parts.join(" ");
    } catch {
        return h ? `${h}h ${m}m` : `${m}m`;
    }
}

function rangeText(from: number, to: number, locale: string): string {
    try {
        const format = new Intl.DateTimeFormat(locale, {weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC"});
        return format.formatRange ? format.formatRange(new Date(from), new Date(to)) : `${format.format(new Date(from))} – ${format.format(new Date(to))}`;
    } catch {
        return `${arkIslandTime(from / 1000, locale)} – ${arkIslandTime(to / 1000, locale)}`;
    }
}

type Props = {id: string; scene: () => ArkSceneHandle | null; words: ArkWords; locale: string; onClose: () => void};

export default function ArkItsDay({id, scene, words, locale, onClose}: Props) {
    const card = words.card;
    // 0: the last 24 hours; n: n days further back (a week at most).
    const [page, setPage] = useState(0);
    const [day, setDay] = useState<ArkAnimalDay | null>(null);
    const [none, setNone] = useState(false);
    const [anchor] = useState(() => Date.now());
    useEffect(() => {
        const handle = scene();
        setDay(null);
        setNone(false);
        if (!handle?.animalDay) {
            setNone(true);
            return;
        }
        const abort = new AbortController();
        const to = anchor - page * ARK_DAY_MAX_MS;
        let shown = 0;
        handle
            .animalDay(id, to - ARK_DAY_MAX_MS, to, {
                signal: abort.signal,
                onProgress: (partial) => {
                    // (Told every frame as it goes: drawn a few times a second.)
                    const now = performance.now();
                    if (now - shown < 250) return;
                    shown = now;
                    setDay(partial);
                }
            })
            .then((whole) => {
                if (abort.signal.aborted) return;
                if (whole) setDay(whole);
                else setNone(true);
            })
            .catch(() => setNone(true));
        return () => abort.abort();
    }, [id, page, scene, anchor]);

    const statusWords = useMemo(() => ({activity: words.activity, card: words.card, story: words.story, life: words.life, replay: words.replay}), [words]);
    const text = useMemo(() => (day ? arkDayText(day, statusWords, locale) : null), [day, statusWords, locale]);
    const span = day ? day.to - day.from : ARK_DAY_MAX_MS;
    const left = (t: number) => (day ? ((t - day.from) / span) * 100 : 0);
    // Its day's totals, longest first (a few).
    const totals = useMemo(() => {
        if (!day) return [];
        const sum = new Map<ArkActivityKey, number>();
        for (const s of day.segments) sum.set(s.activity, (sum.get(s.activity) ?? 0) + (s.to - s.from));
        return Array.from(sum.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
    }, [day]);
    // The list, newest first: each stretch a minute or longer, and the record lines among them.
    const rows = useMemo(() => {
        if (!text) return [];
        const stretches = text.segments.filter((s) => s.to - s.from >= 60_000).map((s) => ({key: `s${s.from}`, at: s.from, record: false, stamp: s.stamp, text: s.text, tone: TONE[s.activity]}));
        const records = text.events.map((e) => ({key: `r${e.id}`, at: e.at, record: true, stamp: e.stamp, text: e.text, tone: ""}));
        return [...stretches, ...records].sort((a, b) => b.at - a.at);
    }, [text]);
    const ticks = day ? Array.from({length: 5}, (_, k) => day.from + (k * span) / 4) : [];
    const working = Boolean(day && !day.done);
    const label = page === 0 ? card.dayLast : day ? rangeText(day.from, day.to, locale) : "";
    const pageButton = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-100 text-ink-100 hover:border-primary-400 disabled:opacity-35 disabled:hover:border-line-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300";

    return (
        <section data-testid="ark-its-day" aria-label={card.itsDay} className="rows-in mt-2 border-t border-line-300 pt-2 md:pl-[3.75rem]">
            <div className="flex items-center gap-2">
                <h3 className="font-display text-[13.5px] font-extrabold text-white">{card.itsDay}</h3>
                <p className="min-w-0 flex-1 truncate text-[12px] text-ink-300" data-testid="ark-its-day-range">{label}</p>
                <button type="button" className={pageButton} disabled={page >= DAYS_BACK - 1} onClick={() => setPage((p) => Math.min(p + 1, DAYS_BACK - 1))} aria-label={card.dayEarlier} title={card.dayEarlier}>
                    <svg viewBox="0 0 20 20" className="h-4 w-4 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.5 4.5L7 10l5.5 5.5" /></svg>
                </button>
                <button type="button" className={pageButton} disabled={page === 0} onClick={() => setPage((p) => Math.max(p - 1, 0))} aria-label={card.dayLater} title={card.dayLater}>
                    <svg viewBox="0 0 20 20" className="h-4 w-4 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.5 4.5L13 10l-5.5 5.5" /></svg>
                </button>
                <button type="button" onClick={onClose} aria-label={card.dayClose} title={card.dayClose} className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-200 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
            </div>

            {none ? (
                <p className="mt-2 text-[12.5px] text-ink-300" data-testid="ark-its-day-none">{card.dayNone}</p>
            ) : (
                <>
                    {/* The day as bands: its record's dots above, the island's hours under, "now" at its right on the latest page. */}
                    <div className="relative mt-3 pt-2" dir="ltr">
                        <div className="relative h-7 overflow-hidden rounded-md bg-white/[0.06]" role="img" aria-label={`${card.itsDay}: ${label}`} data-testid="ark-its-day-bands">
                            {day
                                ? day.segments.map((s, i) => (
                                      <span key={s.from} data-activity={s.activity} title={text?.segments[i] ? `${text.segments[i].stamp} · ${text.segments[i].text}` : undefined} className="absolute inset-y-0" style={{left: `${left(s.from)}%`, width: `${Math.max(left(s.to) - left(s.from), 0.08)}%`, background: TONE[s.activity]}} />
                                  ))
                                : null}
                            {!day || working ? <span className="absolute inset-y-0 left-0 animate-pulse bg-white/[0.07] motion-reduce:animate-none" style={{width: `${day ? left(day.since) : 100}%`}} /> : null}
                        </div>
                        {text?.events.map((e) => (
                            <span key={e.id} title={`${e.stamp} · ${e.text}`} className="absolute top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-canvas-950 bg-primary-300" style={{left: `${left(e.at)}%`}} />
                        ))}
                        {page === 0 && day ? (
                            <span className="pointer-events-none absolute -bottom-0.5 right-0 top-1 w-0.5 rounded bg-white" aria-hidden="true">
                                <span className="absolute -top-1 right-1 whitespace-nowrap text-[9.5px] font-bold uppercase tracking-[0.1em] text-white">{card.dayNow}</span>
                            </span>
                        ) : null}
                        <div className="relative mt-1 h-3.5 text-[10.5px] tabular-nums text-ink-400">
                            {ticks.map((t, k) => (
                                <span key={t} className={`absolute whitespace-nowrap ${k === 0 ? "" : k === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`} style={{left: `${left(t)}%`}}>{arkIslandTime(t / 1000, locale)}</span>
                            ))}
                        </div>
                    </div>

                    {working || !day ? <p className="mt-1 text-[11.5px] italic text-ink-400" aria-live="polite">{card.dayWorking}</p> : null}

                    {totals.length ? (
                        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink-200" data-testid="ark-its-day-totals">
                            {totals.map(([key, ms]) => (
                                <span key={key} className="inline-flex items-center gap-1.5">
                                    <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{background: TONE[key]}} />
                                    {words.activity[key]} <span className="tabular-nums text-ink-400">{durationText(ms, locale)}</span>
                                </span>
                            ))}
                        </p>
                    ) : null}

                    {rows.length ? (
                        <ol data-testid="ark-its-day-list" aria-label={card.itsDay} tabIndex={0} className="mt-1.5 max-h-[5.6rem] overflow-y-auto overscroll-contain pr-1 outline-none focus-visible:ring-1 focus-visible:ring-primary-300 md:max-h-[7.2rem]">
                            {rows.map((row) => (
                                <li key={row.key} className="flex min-w-0 items-baseline gap-2 py-[1px] text-[12px] leading-snug">
                                    <span className="min-w-[6.6rem] shrink-0 whitespace-nowrap tabular-nums text-ink-400">{row.stamp}</span>
                                    <span aria-hidden="true" className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${row.record ? "bg-primary-300" : ""}`} style={row.record ? undefined : {background: row.tone}} />
                                    <span className={`min-w-0 truncate ${row.record ? "font-semibold text-ink-100" : "text-ink-200"}`}>
                                        {row.record ? <span className="sr-only">{card.dayRecord}: </span> : null}
                                        {row.text}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    ) : null}
                    <p className="mt-1 text-[10.5px] leading-snug text-ink-400">{card.dayHint}</p>
                </>
            )}
        </section>
    );
}
