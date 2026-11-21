"use client";

import React, {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import ArkSpeciesIcon from "@/app/[locale]/(composited)/ark/ark-species-icon";
import {arkIconUrl} from "@/ark-scene/placeholder-icon";
import {healHeart} from "@/components/debates/use-debates";
import {ARK_HEARTS_MAX, arkCanRestoreHeart, arkLivesText, arkRecoveringText, type ArkAnimalHearts, type ArkHeartsWords} from "@/lib/ark-hearts";
import {fillArkWords} from "@/lib/ark-words";
import {ArkHeartIcons} from "@/app/[locale]/(composited)/ark/ark-heart-icons";

export {ArkHeartIcons};

/**
 * Hearts are lives (AnimalDex docs/ark/HEARTS-LIVES-DESIGN.md, section 6, "Card UI"), on the owner's own card only:
 * ♥♥♡ with "2 lives in the Ark", "Recovering · returns tomorrow" while it is away, and "Restore a heart · 5 Credits"
 * whenever the card is below 3 (the existing path: `/api/app/hearts`, `heal_capture_heart_v1`), with "Each heart is one
 * more life for your animal in the Ark." under it. Out of Credits, a link to the site's Credits page.
 */

type LivesProps = {
    entry: ArkAnimalHearts;
    words: ArkHeartsWords;
    locale: string;
    cost: number;
    /** A heart restored: the card's new count (the page updates every animal that card brought). */
    onRestored: (captureId: string, hearts: number) => void;
};

/** The lives row and its restore button. */
export function ArkLivesRow({entry, words, locale, cost, onRestored}: LivesProps) {
    const [restoring, setRestoring] = useState(false);
    const [problem, setProblem] = useState<{text: string; credits: boolean} | null>(null);
    const now = useNow(entry.status === "recovering");
    useEffect(() => setProblem(null), [entry.captureId]);
    const restore = () => {
        if (restoring) return;
        setRestoring(true);
        setProblem(null);
        void healHeart(entry.captureId).then((result) => {
            setRestoring(false);
            if (result.ok) return onRestored(entry.captureId, result.value.hearts);
            if (result.code === "hearts_full") return onRestored(entry.captureId, ARK_HEARTS_MAX);
            const credits = result.code === "insufficient_credits";
            setProblem({text: credits ? fillArkWords(words.noCredits, {credits: cost}) : words.failed, credits});
        });
    };
    return (
        <div className="mt-1.5" data-testid="ark-card-lives" data-hearts={entry.hearts} data-status={entry.status}>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] leading-snug">
                <ArkHeartIcons hearts={entry.hearts} />
                <span className="sr-only">{fillArkWords(words.label, {n: entry.hearts})}</span>
                <span className="font-semibold text-ink-100">{arkLivesText(entry.hearts, words, locale)}</span>
                {entry.status === "recovering" ? (
                    <span data-testid="ark-card-recovering" className="rounded-full bg-[#2a3350] px-2 py-0.5 text-[11.5px] font-semibold text-[#c9d6ff]">{arkRecoveringText(entry, now, words, locale)}</span>
                ) : null}
            </p>
            {arkCanRestoreHeart(entry) ? (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                        type="button"
                        onClick={restore}
                        disabled={restoring}
                        data-testid="ark-card-restore"
                        className="inline-flex h-8 items-center rounded-full border border-[#ff8f8f]/50 bg-[#ff8f8f]/10 px-3 text-[12px] font-bold text-[#ffd0d0] transition-colors hover:bg-[#ff8f8f]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 disabled:opacity-60 motion-reduce:transition-none"
                    >
                        {restoring ? words.restoring : fillArkWords(words.restore, {credits: cost})}
                    </button>
                    <span className="text-[11.5px] leading-snug text-ink-400">{words.note}</span>
                </div>
            ) : null}
            {problem ? (
                <p role="alert" className="mt-1 text-[11.5px] leading-snug text-[#ffc9b8]">
                    {problem.text}
                    {problem.credits ? (
                        <> <Link href="/app/credits#credits" className="font-bold text-primary-300 underline-offset-2 hover:underline">{words.getCredits}</Link></>
                    ) : null}
                </p>
            ) : null}
        </div>
    );
}

/** The time, a minute at a time while it matters ("in about 5 hours" keeps true). */
function useNow(ticking: boolean): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!ticking) return;
        setNow(Date.now());
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, [ticking]);
    return now;
}

/**
 * One of the owner's animals away recovering: not in the scene, so its own small card at the world's foot (opened from
 * the "1 recovering" chip, or from a notice's `?focus=`): who it is, its lives, when it returns, and the restore.
 */
export function ArkRecoveringCard({entries, words, locale, cost, onRestored, onClose, closeLabel, bandRef}: {bandRef?: React.Ref<HTMLDivElement>; entries: ArkAnimalHearts[]; words: ArkHeartsWords; locale: string; cost: number; onRestored: LivesProps["onRestored"]; onClose: () => void; closeLabel: string}) {
    return (
        <div ref={bandRef} data-testid="ark-recovering-card" role="region" aria-label={entries.length === 1 ? words.recoveringOne : fillArkWords(words.recoveringOther, {count: entries.length})} onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            onClose();
        }} className="rows-in absolute inset-x-0 bottom-0 border-t border-line-200 bg-canvas-950/[0.95] backdrop-blur-xl">
            <div className="mx-auto max-h-[40svh] w-full max-w-[86rem] overflow-y-auto overscroll-contain px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 md:px-8 md:py-3">
                {entries.map((entry, index) => (
                    <div key={entry.id} className={`flex items-start gap-3 ${index > 0 ? "mt-2.5 border-t border-line-300/60 pt-2.5" : ""}`}>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7] opacity-80 grayscale-[35%] md:h-12 md:w-12">
                            {entry.modelSlug ? <ArkSpeciesIcon src={arkIconUrl(entry.modelSlug)} size={48} className="h-[82%] w-[82%] object-contain" /> : null}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-display text-base font-extrabold leading-tight text-white md:text-lg">{entry.name ?? ""}</p>
                            <p className="mt-0.5 text-[12px] leading-snug text-ink-300">{words.away}</p>
                            <ArkLivesRow entry={entry} words={words} locale={locale} cost={cost} onRestored={onRestored} />
                        </div>
                        {index === 0 ? (
                            <button type="button" onClick={onClose} aria-label={closeLabel} className="-mr-1 -mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-200 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300">
                                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                            </button>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}
