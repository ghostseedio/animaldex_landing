"use client";

import React, {lazy, useEffect, useMemo, useState} from "react";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import type {ArkWords} from "@/lib/ark-words";
import {ARK_TIME_LEFT_HOOKS, arkNeedsFacts, arkTimeLeft, arkTimeLeftText, arkTimeLeftWordsFrom, arkTimeLeftWorldOf, type ArkTimeLeftFacts} from "@/lib/ark-time-left";
import {arkTimeLeftFetch, readArkTimeLeftFacts, type ArkTimeLeftFetch} from "@/lib/ark-time-left-facts";
import {arkReleasedEntry, useArkReleased} from "@/lib/ark-release-read";
import {arkReleaseTimeLeftHook} from "@/lib/ark-release-time-left";
import ArkSex from "@/app/[locale]/(composited)/ark/ark-sex";

/**
 * Release to the Wild (AnimalDex P1-8, behind the server's `release_to_wild`): a released animal's wild skill, and on the
 * reader's own zoo animal the button and its sheet. Its own chunk, fetched only when a card asks for that part: neither
 * the page's static JavaScript nor the estimate's chunk holds the sheet.
 */
const ArkRelease = lazy(() => import("@/app/[locale]/(composited)/ark/ark-release"));

type Props = {
    animal: ArkAnimal;
    /** The estimate reads it; the release block does not. */
    snapshot?: ArkSnapshot | null;
    words: ArkWords;
    locale: string;
    fetchJson?: ArkTimeLeftFetch;
    /** Release to the Wild's block instead of the estimate: the site's link component (the card has it; see `ark-release.tsx`). */
    release?: React.ComponentProps<typeof ArkRelease>["link"];
    /** The snapshot's Ark day (the release block). */
    day?: number | null;
    /** Male or female beside the card's name (or its kind's note), instead of the estimate: `ark-sex.tsx`. */
    sex?: boolean;
};

/**
 * The card's lazily loaded blocks, behind the card's one dynamic import (each further `lazy()` in the card costs the Ark
 * page's static JavaScript, which is budgeted): the estimate, or with `release` the Release to the Wild block. The card
 * wraps each in its own Suspense.
 */
export default function ArkTimeLeft({release, day, snapshot = null, sex, ...rest}: Props) {
    if (sex) return <ArkSex animals={[rest.animal]} words={rest.words.sex} locale={rest.locale} />;
    return release ? <ArkRelease animal={rest.animal} words={rest.words} locale={rest.locale} day={day ?? null} link={release} /> : <ArkTimeLeftPanel snapshot={snapshot} {...rest} />;
}

/**
 * "Estimated time left" on the tapped animal's card (owner decision 389; `lib/ark-time-left.ts` says what it is made of
 * and who is at risk): a range of Ark days or years and the reasons behind it, only for an animal at risk. Loaded lazily
 * (`ark-animal-card.tsx`), so the Ark page's static JavaScript stays inside its budget, and it reads its species facts
 * (`/api/ark/food-chain`) only when the animal's risk could depend on them. Nothing here is a promise: it says so.
 */
function ArkTimeLeftPanel({animal, snapshot, words, locale, fetchJson = arkTimeLeftFetch}: {animal: ArkAnimal; snapshot: ArkSnapshot | null; words: ArkWords; locale: string; fetchJson?: ArkTimeLeftFetch}) {
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
    // Release to the Wild: a released animal still learning to find food is at risk too (its public release: the day, its skill).
    const released = useArkReleased();
    const release = useMemo(() => arkReleasedEntry(animal, released), [animal, released]);
    const result = useMemo(() => (world ? arkTimeLeft(animal, world, facts, release ? [...ARK_TIME_LEFT_HOOKS, arkReleaseTimeLeftHook(release)] : ARK_TIME_LEFT_HOOKS) : null), [animal, world, facts, release]);
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
