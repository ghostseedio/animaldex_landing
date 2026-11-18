"use client";

import React, {useEffect, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import Link from "@/app/[locale]/_components/link";
import type {ArkAnimal} from "@/ark-scene/types";
import {isArkPlaceholderSlug} from "@/ark-scene/placeholder-icon";
import {
    arkReleaseKey,
    arkReleaseReasonText,
    arkReleaseRescueText,
    arkReleaseWords,
    arkWildSkillBand,
    arkWildSkillText,
    arkReleaseQuoteFromApi,
    arkReleaseResultFromApi,
    type ArkReleaseProblem,
    type ArkReleaseQuote,
    type ArkReleaseResult,
    type ArkReleaseWords
} from "@/lib/ark-release";
import {arkReleasedEntry, noteArkReleased, useArkReleased} from "@/lib/ark-release-read";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";

/**
 * Release to the Wild on the tapped animal's card (AnimalDex docs/ark/release-p1-8.md; owner decision 389), loaded
 * lazily (`ark-animal-card.tsx`) so the Ark page's static JavaScript stays inside its budget. Behind the server's
 * `release_to_wild`: while it is off (the public read answers null) this draws nothing and asks nothing more.
 *
 * - A released animal living free: its wild skill, for everyone: a bar and plain words ("Learning to find food").
 * - The reader's own zoo animal: "Release to the wild · 25 Credits" and the sheet that confirms it (where it will live,
 *   its wild skill, that zoo-raised animals struggle at first, the price and their Credits, and when its kind is in
 *   danger in the wild, that this could save it). When it cannot go, the reason in a line.
 *
 * The price shown is the server's quote and the release sends only the animal and a retry key (`/api/ark/release`):
 * nothing here can set what is charged. Out of Credits: a link to the site's Credits page.
 */
export default function ArkRelease({animal, words: all, locale, day: arkDay}: {animal: ArkAnimal; words: ArkWords; locale: string; /** The snapshot's Ark day. */ day: number | null}) {
    const released = useArkReleased();
    const words = useMemo(() => arkReleaseWords((all as {release?: unknown}).release), [all]);
    // Off (or unread), or an animal born on the Ark (nobody's to release): nothing.
    if (released === null || animal.origin === "born") return null;
    const talkHref = animal.placeholder === true || isArkPlaceholderSlug(animal.model_slug) ? null : `/talk/${animal.model_slug}`;
    const entry = arkReleasedEntry(animal, released);
    if (entry) return <ArkWildSkillRow skill={entry.wildSkill} words={words} mine={animal.mine} talkHref={talkHref} />;
    // The offer: only the reader's own zoo animal (the server checks it again, and their card, at the quote and at the spend).
    if (!animal.mine || animal.area !== "zoo") return null;
    return (
        <ArkReleaseOffer
            animal={animal}
            zoneName={all.zones[animal.zone]}
            words={words}
            locale={locale}
            talkHref={talkHref}
            onReleased={(release) => noteArkReleased({animalId: release.animalId, releasedArkDay: arkDay ?? 0, wildSkill: release.wildSkill})}
        />
    );
}

type SkillProps = {skill: number; words: ArkReleaseWords; mine: boolean; talkHref: string | null};
type OfferProps = {
    animal: ArkAnimal;
    /** Its zone in the reader's words ("Woodland"). */
    zoneName: string;
    words: ArkReleaseWords;
    locale: string;
    /** Its Talk page (where its step is), or null for a kind with none. */
    talkHref: string | null;
    onReleased: (release: ArkReleaseResult) => void;
};

/** The wild skill as a bar with plain words; on the owner's own, the step that raises it. */
function ArkWildSkillRow({skill, words, mine, talkHref}: SkillProps) {
    const band = arkWildSkillBand(skill);
    const percent = Math.round(Math.min(Math.max(skill, 0), 1) * 100);
    return (
        <div className="mt-1.5" data-testid="ark-card-wild-skill" data-band={band}>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] leading-snug">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400">{words.skill}</span>
                <span role="meter" aria-label={words.skill} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={arkWildSkillText(skill, words)} className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.12]">
                    <span className={`block h-full rounded-full ${band === "home" ? "bg-primary-300" : band === "wary" ? "bg-[#ffe2a8]" : "bg-[#ffc9b8]"}`} style={{width: `${Math.max(percent, 4)}%`}} />
                </span>
                <span className="font-semibold text-ink-100">{arkWildSkillText(skill, words)}</span>
                {mine && band !== "home" && talkHref ? (
                    <Link href={talkHref} className="font-bold text-primary-300 underline-offset-2 hover:underline" title={words.stepHint}>{words.step}</Link>
                ) : null}
            </p>
        </div>
    );
}

function ArkReleaseOffer({animal, zoneName, words, locale, talkHref, onReleased}: OfferProps) {
    const [quote, setQuote] = useState<ArkReleaseQuote | null>(null);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState<ArkReleaseProblem | null>(null);
    const [done, setDone] = useState<ArkReleaseResult | null>(null);
    // One key for this animal while the card is open: a retry (a lost answer, a second tap) can never charge twice.
    const key = useMemo(() => arkReleaseKey(), [animal.id]); // eslint-disable-line react-hooks/exhaustive-deps
    // A release made and not yet handed to the card: handed over when the sheet closes, or the card does.
    const pending = useRef<ArkReleaseResult | null>(null);
    const handOver = () => {
        const release = pending.current;
        pending.current = null;
        if (release) onReleased(release);
    };
    const handOverRef = useRef(handOver);
    handOverRef.current = handOver;
    useEffect(() => () => handOverRef.current(), []);

    useEffect(() => {
        setProblem(null);
        setDone(null);
        setQuote(null);
        setOpen(false);
        let off = false;
        void fetch(`/api/ark/release?animal=${encodeURIComponent(animal.id)}`, {cache: "no-store"})
            .then((response) => (response.ok ? response.json() : null))
            .then((body: {quote?: unknown} | null) => {
                if (!off) setQuote(arkReleaseQuoteFromApi(body?.quote));
            })
            .catch(() => undefined);
        return () => {
            off = true;
        };
    }, [animal.id]);

    const release = () => {
        if (busy || !quote?.eligible) return;
        setBusy(true);
        setProblem(null);
        const settle = (answer: {ok: true; release: ArkReleaseResult} | {ok: false; code: ArkReleaseProblem}) => {
            setBusy(false);
            if (!answer.ok) return setProblem(answer.code);
            // Said in the sheet first; the card takes it (its wild skill row) when the sheet closes.
            setDone(answer.release);
            pending.current = answer.release;
        };
        void fetch("/api/ark/release", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({animalId: animal.id, clientKey: key})})
            .then(async (response) => {
                const body = await response.json().catch(() => null) as {ok?: boolean; release?: unknown; code?: unknown} | null;
                const made = body?.ok === true ? arkReleaseResultFromApi(body.release) : null;
                settle(made ? {ok: true, release: made} : {ok: false, code: typeof body?.code === "string" ? body.code as ArkReleaseProblem : "failed"});
            })
            .catch(() => settle({ok: false, code: "failed"}));
    };

    // Nothing while unread, off, signed out, or not theirs: the card is as it was.
    if (!quote || !quote.available || quote.reasons.includes("not_owner") || quote.reasons.includes("unavailable")) return null;
    if (!done && (!quote.eligible || quote.credits === null)) {
        const reason = quote.reasons[0];
        return reason ? <p data-testid="ark-card-release-wait" data-reason={reason} className="mt-1.5 text-[11.5px] leading-snug text-ink-400">{arkReleaseReasonText(reason, quote, words, locale)}</p> : null;
    }
    // (One place for the sheet, before and after the release: it stays up while its words change to "done".)
    return (
        <div className="mt-1.5">
            {done ? (
                <p data-testid="ark-card-released" className="text-[12.5px] font-semibold leading-snug text-primary-200">{fillArkWords(done.rescue ? words.doneRescue : words.done, {animal: animal.name})}</p>
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-haspopup="dialog"
                    data-testid="ark-card-release"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary-400/60 bg-primary-400/10 px-3 text-[12px] font-bold text-primary-100 transition-colors hover:bg-primary-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none"
                >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17V6.5L10 3l7 3.5V17" /><path d="M8 17v-5h4v5" /><path d="M12.5 8.5l3 0M14 7l1.5 1.5L14 10" /></svg>
                    {fillArkWords(words.button, {credits: quote.credits ?? 0})}
                </button>
            )}
            {open ? (
                <ReleaseSheet
                    animal={animal}
                    zoneName={zoneName}
                    quote={quote}
                    words={words}
                    locale={locale}
                    talkHref={talkHref}
                    busy={busy}
                    problem={problem}
                    done={done}
                    onConfirm={release}
                    onClose={() => {
                        if (busy) return;
                        setOpen(false);
                        handOver();
                    }}
                />
            ) : null}
        </div>
    );
}

type SheetProps = {
    animal: ArkAnimal;
    zoneName: string;
    quote: ArkReleaseQuote;
    words: ArkReleaseWords;
    locale: string;
    talkHref: string | null;
    busy: boolean;
    problem: ArkReleaseProblem | null;
    done: ArkReleaseResult | null;
    onConfirm: () => void;
    onClose: () => void;
};

/** The confirm sheet: a bottom sheet on a phone, a dialog in the middle on a desktop. Escape and the backdrop close it. */
function ReleaseSheet({animal, zoneName, quote, words, locale, talkHref, busy, problem, done, onConfirm, onClose}: SheetProps) {
    const [mounted, setMounted] = useState(false);
    const firstRef = useRef<HTMLButtonElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        setMounted(true);
        const before = document.activeElement as HTMLElement | null;
        const frame = window.requestAnimationFrame(() => firstRef.current?.focus({preventScroll: true}));
        return () => {
            window.cancelAnimationFrame(frame);
            before?.focus?.({preventScroll: true});
        };
    }, []);
    // Once it is released the button that had the focus is gone: the focus goes to "Close".
    useEffect(() => {
        if (done) firstRef.current?.focus({preventScroll: true});
    }, [done]);
    // Escape closes the sheet wherever the focus is, and only the sheet (never the card under it).
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            closeRef.current();
        };
        document.addEventListener("keydown", onKey, true);
        return () => document.removeEventListener("keydown", onKey, true);
    }, []);
    if (!mounted) return null;
    const credits = quote.credits ?? 0;
    const short = quote.balance !== null && quote.balance < credits;
    const rescue = arkReleaseRescueText(quote, words, locale);
    const skill = done?.wildSkill ?? quote.wildSkill;
    const band = arkWildSkillBand(skill);
    const titleId = `ark-release-title-${animal.id}`;
    const onKeyDown = (event: React.KeyboardEvent) => {
        // (A key pressed in the sheet is the sheet's: the card under it does not hear it.)
        event.stopPropagation();
        if (event.key !== "Tab") return;
        // Keep the focus inside the sheet while it is open.
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]");
        if (!focusable?.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };
    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 md:items-center" data-testid="ark-release-sheet" onClick={onClose} onKeyDown={onKeyDown}>
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(event) => event.stopPropagation()}
                className="rows-in max-h-[88svh] w-full overflow-y-auto overscroll-contain rounded-t-2xl border border-line-200 bg-canvas-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-ink-100 shadow-2xl md:max-w-md md:rounded-2xl md:px-6 md:pb-6 md:pt-5"
            >
                {done ? (
                    <>
                        {/* Released: the heading is no longer a question. */}
                        <h2 id={titleId} data-testid="ark-release-done" aria-live="polite" className="flex items-start gap-2 font-display text-lg font-extrabold leading-tight text-white md:text-xl">
                            <svg viewBox="0 0 16 16" className="mt-[5px] h-4 w-4 shrink-0 text-primary-300" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg>
                            <span>{fillArkWords(done.rescue ? words.doneRescue : words.done, {animal: animal.name})}</span>
                        </h2>
                        <SkillLine skill={skill} band={band} words={words} />
                        <p className="mt-2 text-[13px] leading-snug text-ink-200">{words.warn}</p>
                        <p className="mt-1 text-[11.5px] leading-snug text-ink-400">{words.stepHint}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            {talkHref ? <Link href={talkHref} data-testid="ark-release-step" className="inline-flex h-10 items-center justify-center rounded-full bg-primary-400 px-4 text-[13.5px] font-bold text-canvas-950 hover:bg-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300">{words.step} <span aria-hidden="true" className="ml-1">→</span></Link> : null}
                            <button ref={firstRef} type="button" onClick={onClose} className="inline-flex h-10 items-center justify-center rounded-full border border-line-100 px-4 text-[13.5px] font-bold text-ink-100 hover:border-primary-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300">{words.close}</button>
                        </div>
                    </>
                ) : (
                    <>
                        <h2 id={titleId} className="font-display text-lg font-extrabold leading-tight text-white md:text-xl">{fillArkWords(words.title, {animal: animal.name})}</h2>
                        {rescue ? <p data-testid="ark-release-rescue" className="mt-3 rounded-lg bg-[#5a461e] px-3 py-2 text-[13px] font-semibold leading-snug text-[#ffe2a8]">{rescue}</p> : null}
                        <p className="mt-3 text-[13.5px] leading-snug text-ink-100">{quote.island === "town" ? words.toTown : fillArkWords(words.toWild, {zone: zoneName})}</p>
                        <SkillLine skill={skill} band={band} words={words} />
                        {quote.hasPower ? <p className="mt-1 text-[11.5px] leading-snug text-ink-400">{words.skillPower}</p> : null}
                        <p data-testid="ark-release-warn" className="mt-2 text-[13px] font-semibold leading-snug text-[#ffc9b8]">{words.warn}</p>
                        <p className="mt-1.5 text-[12px] leading-snug text-ink-300">{words.hearts}</p>
                        <p className="mt-1 text-[12px] leading-snug text-ink-300">{words.rules}</p>
                        <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-line-300/60 pt-3">
                            <span data-testid="ark-release-price" className="font-display text-xl font-extrabold text-white">{fillArkWords(words.price, {credits: credits.toLocaleString(locale)})}</span>
                            {quote.tier ? <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11.5px] font-semibold text-ink-100">{quote.tier}</span> : null}
                            {quote.balance !== null ? <span data-testid="ark-release-balance" className={`text-[12.5px] ${short ? "font-semibold text-[#ffc9b8]" : "text-ink-300"}`}>{fillArkWords(words.balance, {credits: quote.balance.toLocaleString(locale)})}</span> : null}
                        </p>
                        {short || problem === "insufficient_credits" ? (
                            <p role="alert" data-testid="ark-release-short" className="mt-2 text-[12.5px] leading-snug text-[#ffc9b8]">
                                {fillArkWords(words.noCredits, {credits})}{" "}
                                <Link href="/app/credits#credits" className="font-bold text-primary-300 underline-offset-2 hover:underline">{words.getCredits}</Link>
                            </p>
                        ) : problem ? (
                            <p role="alert" data-testid="ark-release-problem" className="mt-2 text-[12.5px] leading-snug text-[#ffc9b8]">
                                {problem === "failed" || problem === "not_authenticated" ? words.failed : arkReleaseReasonText(problem, quote, words, locale)}
                            </p>
                        ) : null}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={onConfirm}
                                disabled={busy || short}
                                data-testid="ark-release-confirm"
                                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-full bg-primary-400 px-4 text-[14px] font-bold text-canvas-950 transition-colors hover:bg-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 disabled:opacity-50 motion-reduce:transition-none"
                            >
                                {busy ? words.confirming : fillArkWords(words.confirm, {credits})}
                            </button>
                            <button ref={firstRef} type="button" onClick={onClose} disabled={busy} data-testid="ark-release-cancel" className="inline-flex h-11 items-center justify-center rounded-full border border-line-100 px-4 text-[14px] font-bold text-ink-100 hover:border-primary-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 disabled:opacity-50">{words.cancel}</button>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
}

function SkillLine({skill, band, words}: {skill: number; band: ReturnType<typeof arkWildSkillBand>; words: ArkReleaseWords}) {
    const percent = Math.round(Math.min(Math.max(skill, 0), 1) * 100);
    return (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-snug">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400">{words.skill}</span>
            <span role="meter" aria-label={words.skill} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={arkWildSkillText(skill, words)} className="h-2 w-28 overflow-hidden rounded-full bg-white/[0.12]">
                <span className={`block h-full rounded-full ${band === "home" ? "bg-primary-300" : band === "wary" ? "bg-[#ffe2a8]" : "bg-[#ffc9b8]"}`} style={{width: `${Math.max(percent, 4)}%`}} />
            </span>
            <span className="font-semibold text-ink-100">{arkWildSkillText(skill, words)}</span>
        </p>
    );
}
