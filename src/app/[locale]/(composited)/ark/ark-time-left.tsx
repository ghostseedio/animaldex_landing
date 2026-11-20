"use client";

import React, {Suspense, lazy, useEffect, useMemo, useState} from "react";
import type SiteLink from "@/app/[locale]/_components/link";
import {isArkPlaceholderSlug} from "@/ark-scene/placeholder-icon";
import type {ArkAnimal, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import type {ArkWords} from "@/lib/ark-words";
import {ARK_TIME_LEFT_HOOKS, arkLifeOutlook, arkLifeText, arkNeedsFacts, arkTimeLeftWordsFrom, arkTimeLeftWorldOf, type ArkLifeBar, type ArkTimeLeftFacts} from "@/lib/ark-time-left";
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

/**
 * Lane ark-relation-lines: who could hunt it, what it eats and its possible mates, with lines across the island. Its own
 * chunk, rendered beside the release block (the card's one lazy import: the Ark page's static JavaScript is at its budget).
 */
const ArkRelations = lazy(() => import("@/app/[locale]/(composited)/ark/ark-relations"));

type Props = {
    animal: ArkAnimal;
    /** The estimate reads it; the release block does not. */
    snapshot?: ArkSnapshot | null;
    words: ArkWords;
    locale: string;
    fetchJson?: ArkTimeLeftFetch;
    /** Release to the Wild's block instead of the estimate: the site's link component (the card has it; see `ark-release.tsx`). */
    release?: React.ComponentProps<typeof ArkRelease>["link"];
    /** The estimate's Power line links to how a Power is earned (the Talk page's step): the site's link component, handed in by the card. */
    link?: typeof SiteLink;
    /** The snapshot's Ark day (the release block). */
    day?: number | null;
    /** With `release`: the scene, for the relations block beside it (lane ark-relation-lines). */
    scene?: () => ArkSceneHandle | null;
    /** Male or female beside the card's name (or its kind's note), instead of the estimate: `ark-sex.tsx`. */
    sex?: boolean;
};

/**
 * The card's lazily loaded blocks, behind the card's one dynamic import (each further `lazy()` in the card costs the Ark
 * page's static JavaScript, which is budgeted): the estimate, or with `release` the Release to the Wild block. The card
 * wraps each in its own Suspense.
 */
export default function ArkTimeLeft({release, day, snapshot = null, scene, sex, ...rest}: Props) {
    if (sex) return <ArkSex animals={[rest.animal]} words={rest.words.sex} locale={rest.locale} />;
    if (!release) return <ArkTimeLeftPanel snapshot={snapshot} {...rest} />;
    return (
        <>
            <ArkRelease animal={rest.animal} words={rest.words} locale={rest.locale} day={day ?? null} link={release} />
            {scene ? <Suspense fallback={null}><ArkRelations key={rest.animal.id} animal={rest.animal} snapshot={snapshot} scene={scene} words={rest.words} locale={rest.locale} /></Suspense> : null}
        </>
    );
}

/**
 * The life block on the tapped animal's card (owner decision 389; owner 2026-11-20: every animal, with its age):
 * its life stage and age in Ark time, a life bar (born, now, the likely end), and the "Estimated time left" range with
 * the reasons behind it (`lib/ark-time-left.ts` says what it is made of and who is at risk). Loaded lazily
 * (`ark-animal-card.tsx`), so the Ark page's static JavaScript stays inside its budget, and it reads its species facts
 * (`/api/ark/food-chain`) only when a wild animal's estimate could depend on them. Nothing here is a promise: it says so.
 */
function ArkTimeLeftPanel({animal, snapshot, words, locale, fetchJson = arkTimeLeftFetch, link: Link}: {animal: ArkAnimal; snapshot: ArkSnapshot | null; words: ArkWords; locale: string; fetchJson?: ArkTimeLeftFetch; link?: typeof SiteLink}) {
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
    const outlook = useMemo(() => (world ? arkLifeOutlook(animal, world, facts, release ? [...ARK_TIME_LEFT_HOOKS, arkReleaseTimeLeftHook(release)] : ARK_TIME_LEFT_HOOKS) : null), [animal, world, facts, release]);
    const text = useMemo(() => {
        if (!outlook) return null;
        const {words: w, units} = arkTimeLeftWordsFrom(words.timeLeft, words.life);
        return arkLifeText(outlook, w, units, locale);
    }, [outlook, words.timeLeft, words.life, locale]);
    if (!outlook || !text) return null;
    const warm = outlook.tone === "risk";
    const left = text.left;
    const chance = text.chance;
    // A reason the chance's lines already say (its main reason, the cause of its change) is not said again in the list.
    const reasons = left ? left.reasons.filter((reason) => reason !== chance?.mainReason && reason !== chance?.trend?.cause) : [];
    // Open when the reasons say more than "its kind's lifespan" (it could be hunted or hungry, or it is old); a healthy animal with only
    // old age ahead folds them away, so the block stays compact on a phone.
    const open = warm || Boolean(text.power) || Boolean(outlook.left?.reasons.some((reason) => reason.kind !== "age"));
    return (
        <section data-testid="ark-card-time-left" data-tone={outlook.tone} aria-label={text.label} className="mt-1.5 rounded-lg bg-white/[0.05] px-2.5 py-1.5">
            {text.age ? (
                <p data-testid="ark-card-life-age" className="flex items-center gap-1.5 text-[12.5px] font-semibold leading-snug text-ink-100">
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-sm bg-white/50" />
                    <span className="min-w-0">{text.age}</span>
                </p>
            ) : null}
            {outlook.bar ? <ArkLifeBarMarks bar={outlook.bar} warm={warm} /> : null}
            {left ? (
                <details key={animal.id} open={open} data-testid="ark-card-time-left-details">
                    <summary className="cursor-pointer list-none rounded outline-none focus-visible:ring-1 focus-visible:ring-primary-300 [&::-webkit-details-marker]:hidden">
                        <span className="flex flex-wrap items-center gap-x-2">
                            <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400" title={left.hint}>
                                <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-sm ${warm ? "bg-[#ffb454]" : "bg-primary-400"}`} />
                                {left.title}
                            </span>
                            <span data-testid="ark-card-time-left-value" className="text-[13.5px] font-bold text-white md:text-[14px]">{left.value}</span>
                            <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2.5 w-2.5 shrink-0 text-ink-400 transition-transform [details[open]>summary_&]:rotate-180 motion-reduce:transition-none" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
                        </span>
                        {chance ? (
                            <span data-testid="ark-card-chance" className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                                <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400" title={chance.how}>{chance.title}</span>
                                <span data-testid="ark-card-chance-value" className="text-[13.5px] font-bold text-white md:text-[14px]">{chance.value}</span>
                            </span>
                        ) : null}
                        {chance?.trend ? (
                            <span data-testid="ark-card-chance-trend" data-direction={chance.trend.direction} className={`mt-0.5 flex items-start gap-1 text-[11.5px] font-semibold leading-snug ${chance.trend.direction === "up" ? "text-primary-300" : chance.trend.direction === "down" ? "text-[#ffb454]" : "text-ink-300"}`}>
                                <span aria-hidden="true" className="shrink-0 text-[9px] leading-[17px]">{chance.trend.direction === "up" ? "▲" : chance.trend.direction === "down" ? "▼" : "▬"}</span>
                                <span className="min-w-0">{chance.trend.text}</span>
                            </span>
                        ) : null}
                    </summary>
                    {chance?.main ? <p data-testid="ark-card-chance-main" className="mt-0.5 text-[11.5px] leading-snug text-ink-200">{chance.main}</p> : null}
                    {text.power ? (
                        <p data-testid="ark-card-power" data-kind={text.power.kind} className="mt-0.5 text-[11.5px] font-semibold leading-snug text-primary-200">
                            {Link && !isArkPlaceholderSlug(animal.model_slug) && animal.placeholder !== true ? (
                                <Link href={`/talk/${animal.model_slug}`} className="underline-offset-2 hover:underline">{text.power.text}</Link>
                            ) : (
                                text.power.text
                            )}
                        </p>
                    ) : null}
                    {text.thrive ? <p data-testid="ark-card-thrive-why" className="mt-0.5 text-[11.5px] leading-snug text-ink-300">{text.thrive}</p> : null}
                    {reasons.length ? (
                        <ul className="mt-0.5 text-[11.5px] leading-snug text-ink-300">
                            {reasons.map((reason) => (
                                <li key={reason} className="flex gap-1.5">
                                    <span aria-hidden="true" className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-ink-400" />
                                    <span className="min-w-0">{reason}</span>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    {chance ? <p data-testid="ark-card-chance-how" className="mt-0.5 text-[10.5px] italic leading-snug text-ink-400">{chance.how}</p> : null}
                    <p className="mt-0.5 text-[10.5px] italic leading-snug text-ink-400">{left.hint}</p>
                </details>
            ) : null}
        </section>
    );
}

/**
 * The life bar: born at its start, the days lived so far, a tick for today, the likely end at its far end (the estimate's
 * range, never a promise). Drawn only: the section's label says it in words. A flex row, so a right-to-left page mirrors it.
 */
function ArkLifeBarMarks({bar, warm}: {bar: ArkLifeBar; warm: boolean}) {
    const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
    return (
        <div aria-hidden="true" data-testid="ark-card-life-bar" data-now={bar.now.toFixed(3)} data-from={bar.from.toFixed(3)} className="my-1 flex h-2 items-stretch overflow-hidden rounded-full bg-white/[0.10]">
            <span className="bg-white/50" style={{width: pct(bar.now)}} />
            <span className="w-[2px] shrink-0 bg-white" />
            <span className="min-w-0 flex-1" />
            <span className={warm ? "bg-[#ffb454]" : "bg-primary-400"} style={{width: pct(1 - bar.from), minWidth: 6}} />
        </div>
    );
}
