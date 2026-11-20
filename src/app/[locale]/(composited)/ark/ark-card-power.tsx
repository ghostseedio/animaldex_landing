"use client";

import React from "react";
import type SiteLink from "@/app/[locale]/_components/link";
import {arkPowerOf} from "@/ark-scene/power-table";
import type {ArkAnimal, ArkThrive} from "@/ark-scene/types";
import {ARK_POWER_ENGLISH, fillArkWords, type ArkPowerWords} from "@/lib/ark-words";

/**
 * The tapped card's Animal Power tile (lane ARK-SIMPLE, owner 2026-11-20: "add the animal's lesson / power"): its kind's
 * Animal Power, the catalog's name and one-line lesson (English only in the catalog today, so marked lang="en") (`/api/ark/species-card`, the row the apps and Talk read), linked
 * to its Talk page, where a Power is earned. Powers you can see (decision 420) ride on it as a sign, not a sentence: a
 * tick when its survival Power (`power-table.ts`) is working (prime) or partly (good), its words in the tooltip. Lazy
 * (the table loads with the first card that asks), so /ark's static JavaScript stays inside its budget.
 */
export default function ArkCardPower({animal, band, words, power, label = "Animal Power", href = null, link: Link}: {
    animal: ArkAnimal;
    band: ArkThrive | null | undefined;
    words?: Partial<ArkPowerWords> | null;
    /** The catalog's Power (name and lesson), or null until read or where it has none. */
    power?: {name: string; lesson: string | null} | null;
    label?: string;
    /** Its Talk page (none for a species with no model). */
    href?: string | null;
    link?: typeof SiteLink;
}) {
    const survival = arkPowerOf(animal);
    const w: ArkPowerWords = {...ARK_POWER_ENGLISH, ...(words ?? {})};
    const working = survival && (band === "prime" || band === "good");
    const state = survival ? (band === "prime" ? fillArkWords(w.working, {power: w[survival.mechanism]}) : band === "good" ? fillArkWords(w.partly, {power: w[survival.mechanism]}) : w.earn) : null;
    if (!power) {
        // No catalog Power read (yet): the survival line alone, quietly, as before.
        return state ? <p data-testid="ark-card-power" data-power={survival?.mechanism} data-band={band ?? "ordinary"} className="self-start text-[12px] leading-snug text-ink-300">{state}</p> : <div aria-hidden="true" />;
    }
    const body = (
        <>
            <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary-300">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden="true"><path d="M9.2 1 3 9h4.2l-1 6L13 6.8H8.7z" /></svg>
                <span className="min-w-0 truncate">{label}</span>
                {working ? (
                    <span role="img" aria-label={state ?? undefined} title={state ?? undefined} className="ms-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-400 text-canvas-950">
                        <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>
                    </span>
                ) : null}
            </span>
            <span lang="en" dir="auto" className="mt-1 block truncate font-display text-[16px] font-extrabold leading-tight text-white md:text-[17px]">{power.name}</span>
            {power.lesson ? <span lang="en" dir="auto" className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-ink-200">{power.lesson}</span> : null}
        </>
    );
    const className = "group block min-w-0 self-start rounded-none border border-primary-300/25 bg-[linear-gradient(135deg,rgba(200,250,99,0.13),rgba(255,255,255,0.03)_60%)] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
    const title = state && !working ? state : undefined;
    return href && Link ? (
        <Link href={href} data-testid="ark-card-power" data-power={survival?.mechanism} data-band={band ?? "ordinary"} title={title} className={`${className} transition-colors hover:border-primary-300/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300`}>
            {body}
        </Link>
    ) : (
        <div data-testid="ark-card-power" data-power={survival?.mechanism} data-band={band ?? "ordinary"} title={title} className={className}>
            {body}
        </div>
    );
}
