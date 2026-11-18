"use client";

import React, {useEffect, useMemo, useState} from "react";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import type {ArkWords} from "@/lib/ark-words";
import {ARK_TIME_LEFT_HOOKS, arkNeedsFacts, arkTimeLeft, arkTimeLeftText, arkTimeLeftWordsFrom, arkTimeLeftWorldOf, type ArkTimeLeftFacts} from "@/lib/ark-time-left";
import {arkTimeLeftFetch, readArkTimeLeftFacts, type ArkTimeLeftFetch} from "@/lib/ark-time-left-facts";

/**
 * "Estimated time left" on the tapped animal's card (owner decision 389; `lib/ark-time-left.ts` says what it is made of
 * and who is at risk): a range of Ark days or years and the reasons behind it, only for an animal at risk. Loaded lazily
 * (`ark-animal-card.tsx`), so the Ark page's static JavaScript stays inside its budget, and it reads its species facts
 * (`/api/ark/food-chain`) only when the animal's risk could depend on them. Nothing here is a promise: it says so.
 */
export default function ArkTimeLeft({animal, snapshot, words, locale, fetchJson = arkTimeLeftFetch}: {animal: ArkAnimal; snapshot: ArkSnapshot | null; words: ArkWords; locale: string; fetchJson?: ArkTimeLeftFetch}) {
    const world = useMemo(() => arkTimeLeftWorldOf(snapshot), [snapshot]);
    const needs = world ? arkNeedsFacts(animal, world) : false;
    const [read, setRead] = useState<{id: string; facts: ArkTimeLeftFacts | null} | null>(null);
    useEffect(() => {
        if (!world || !needs) return;
        let off = false;
        readArkTimeLeftFacts(animal, world, fetchJson)
            .catch(() => null)
            .then((facts) => {
                if (!off) setRead({id: animal.id, facts});
            });
        return () => {
            off = true;
        };
        // The facts are the species', read again only for another animal.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [animal.id, needs, fetchJson]);
    const facts = read?.id === animal.id ? read.facts : null;
    const result = useMemo(() => (world ? arkTimeLeft(animal, world, facts, ARK_TIME_LEFT_HOOKS) : null), [animal, world, facts]);
    const text = useMemo(() => {
        if (!result) return null;
        const {words: w, units} = arkTimeLeftWordsFrom(words.timeLeft, words.life);
        return arkTimeLeftText(result, w, units, locale);
    }, [result, words.timeLeft, words.life, locale]);
    if (!text) return null;
    return (
        <section data-testid="ark-card-time-left" aria-label={text.label} className="mt-1.5 rounded-lg bg-white/[0.05] px-2.5 py-1.5">
            <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400" title={text.hint}>{text.title}</span>
                <span data-testid="ark-card-time-left-value" className="text-[13.5px] font-bold text-white md:text-[14px]">{text.value}</span>
            </p>
            {text.reasons.length ? (
                <ul className="mt-0.5 text-[11.5px] leading-snug text-ink-300">
                    {text.reasons.map((reason) => (
                        <li key={reason} className="flex gap-1.5">
                            <span aria-hidden="true" className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-ink-400" />
                            <span className="min-w-0">{reason}</span>
                        </li>
                    ))}
                </ul>
            ) : null}
            <p className="mt-0.5 text-[10.5px] italic leading-snug text-ink-400">{text.hint}</p>
        </section>
    );
}
