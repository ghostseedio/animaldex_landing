"use client";

import React, {Suspense, lazy, useEffect, useMemo, useState} from "react";
import type SiteLink from "@/app/[locale]/_components/link";
import {isArkPlaceholderSlug} from "@/ark-scene/placeholder-icon";
import type {ArkAnimal, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import {ARK_LIFE_HELP_ENGLISH, ARK_SIMPLE_ENGLISH, fillArkWords, type ArkLifeHelpWords, type ArkWords} from "@/lib/ark-words";
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
    // Carers (AnimalDex decision 418): who feeds a kept animal (a pet its owner, a farm animal the farmer, a zoo animal a
    // keeper), under its status; here, in the card's lazy block, because the page's static JavaScript is budgeted. Only
    // while the carers are drawn (the server's switch): with it off the card is exactly as before.
    const {animal, words} = rest;
    const card = words.card;
    const cared = scene?.()?.carersOn?.() === true && animal.area && animal.model_slug !== "human" ? (animal.area === "house" ? card.caredOwner ?? "Cared for by its owner" : animal.area === "farm" ? card.caredFarmer ?? "Cared for by the farmer" : card.caredKeeper ?? "Cared for by a keeper") : null;
    return (
        <>
            {cared ? <p data-testid="ark-card-carer" className="mt-1 text-[11.5px] leading-snug text-ink-300">{cared}</p> : null}
            <ArkRelease animal={animal} words={words} locale={rest.locale} day={day ?? null} link={release} />
            {scene ? <Suspense fallback={null}><ArkRelations key={animal.id} animal={animal} snapshot={snapshot} scene={scene} words={words} locale={rest.locale} /></Suspense> : null}
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
function ArkTimeLeftPanel({animal, snapshot, words, locale, fetchJson = arkTimeLeftFetch}: {animal: ArkAnimal; snapshot: ArkSnapshot | null; words: ArkWords; locale: string; fetchJson?: ArkTimeLeftFetch; link?: typeof SiteLink}) {
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
    const hungry = animal.condition === "hungry";
    const left = text.left;
    const chance = text.chance;
    const simple = {...ARK_SIMPLE_ENGLISH, ...(words.simple ?? {})};
    // The bar's colour says how it is (owner 2026-11-20: condition as a colour, not a word): green well, amber old or at
    // risk, red hungry. Why, in the tooltip only (no paragraphs on the card).
    const tone: LifeTone = hungry ? "bad" : warm ? "warn" : "good";
    const why = [hungry ? words.life.hungry : null, ...(left?.reasons ?? [])].filter((line): line is string => Boolean(line)).filter((line) => !/\{|Ark day/.test(line));
    const leftValue = left ? fillArkWords(simple.left, {time: lowerFirst(left.value, locale)}) : null;
    const help = {...ARK_LIFE_HELP_ENGLISH, ...(words.lifeHelp ?? {})};
    return (
        <section data-testid="ark-card-time-left" data-tone={outlook.tone} aria-label={text.label} className="min-w-0">
            {outlook.bar || (chance && outlook.chance) ? (
                // No lifespan read (no bar) and no chance: no empty track, the age line alone.
                <ArkLifeHelp words={help} bar={Boolean(outlook.bar)} chance={Boolean(chance && outlook.chance)}>
                    {outlook.bar ? <ArkLifeBarMarks bar={outlook.bar} tone={tone} /> : <span className="flex-1" />}
                    {chance && outlook.chance ? <ArkChanceHeart percent={outlook.chance.percent} label={`${chance.title}: ${chance.value}`} tone={tone} locale={locale} /> : null}
                </ArkLifeHelp>
            ) : null}
            <p className="flex min-w-0 items-center justify-between gap-3 text-[12.5px] font-semibold leading-tight text-ink-100">
                {text.age ? (
                    <span data-testid="ark-card-life-age" title={simple.age} className="flex min-w-0 items-center gap-1.5">
                        <LifeIcon kind="age" />
                        <span className="truncate">{text.age}</span>
                    </span>
                ) : <span />}
                {leftValue ? (
                    <span data-testid="ark-card-time-left-value" title={[left?.title, ...why].filter(Boolean).join(" · ")} className={`flex min-w-0 shrink-0 items-center gap-1.5 ${tone === "good" ? "text-ink-100" : tone === "warn" ? "text-[#ffd28a]" : "text-[#ffb3a3]"}`}>
                        <LifeIcon kind={hungry ? "hungry" : "left"} />
                        <span className="truncate">{leftValue}</span>
                    </span>
                ) : null}
            </p>
        </section>
    );
}

/**
 * The life row with its "?" (owner 2026-11-21): a small square button beside the heart that opens, under the row, one
 * line each for what the bar, the tick, the striped end and the heart say. A tap or a click (no hover-only), Escape or a
 * tap elsewhere closes it; the button says whether it is open (`aria-expanded`) and which block it opens.
 */
function ArkLifeHelp({words, bar, chance, children}: {words: ArkLifeHelpWords; bar: boolean; chance: boolean; children: React.ReactNode}) {
    const [open, setOpen] = useState(false);
    const id = React.useId();
    const box = React.useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const away = (event: PointerEvent) => {
            if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", away);
        return () => document.removeEventListener("pointerdown", away);
    }, [open]);
    const lines: Array<[string, React.ReactNode]> = [
        ...(bar ? [
            ["bar", <span key="s" className="mt-[3px] h-2 w-4 shrink-0 rounded-full" style={{background: TONE.good}} />],
            ["now", <span key="n" className="mt-[1px] h-3 w-[2px] shrink-0 bg-white" />],
            ["end", <span key="e" className="mt-[3px] h-2 w-4 shrink-0 rounded-full" style={{background: `repeating-linear-gradient(135deg, ${TONE.good}88 0 3px, ${TONE.good}33 3px 6px)`}} />]
        ] as Array<[string, React.ReactNode]> : []),
        ...(chance ? [["heart", <svg key="h" viewBox="0 0 16 16" className="mt-[1px] h-3 w-3 shrink-0" aria-hidden="true"><path d="M8 14.2S1.6 10.4 1.6 5.8A3.4 3.4 0 0 1 8 4.2a3.4 3.4 0 0 1 6.4 1.6C14.4 10.4 8 14.2 8 14.2z" fill={TONE.good} /></svg>]] as Array<[string, React.ReactNode]> : [])
    ];
    return (
        <div ref={box} className="mb-1.5" onKeyDown={(event) => {
            if (event.key !== "Escape" || !open) return;
            event.stopPropagation();
            setOpen(false);
        }}>
            <div className="flex items-center gap-3">
                {children}
                <button
                    type="button"
                    data-testid="ark-card-life-help"
                    aria-expanded={open}
                    aria-controls={id}
                    aria-label={words.button}
                    title={words.button}
                    onClick={() => setOpen((was) => !was)}
                    className={`-my-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none ${open ? "border-primary-400 bg-primary-400/15 text-primary-100" : "border-line-100 text-ink-200 hover:border-primary-400 hover:text-white"}`}
                >
                    <span aria-hidden="true">?</span>
                </button>
            </div>
            {open ? (
                <div id={id} role="note" aria-label={words.button} data-testid="ark-card-life-help-box" className="rows-in mt-1.5 rounded-md border border-line-200 bg-canvas-950/90 px-2.5 py-2">
                    <ul className="space-y-1">
                        {lines.map(([key, mark]) => (
                            <li key={key} className="flex items-start gap-2 text-[11.5px] leading-snug text-ink-200">
                                {mark}
                                <span>{words[key as "bar" | "now" | "end" | "heart"]}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

type LifeTone = "good" | "warn" | "bad";
const TONE: Record<LifeTone, string> = {good: "#a7f432", warn: "#ffb454", bad: "#ff7a6b"};

function lowerFirst(text: string, locale: string): string {
    // "About 2 days" inside "{time} left" reads "about 2 days left" (only where the language has cases).
    return text ? text.charAt(0).toLocaleLowerCase(locale) + text.slice(1) : text;
}

/** The age's seedling, the time left's hourglass, a hungry one's empty bowl: drawn, the words beside them. */
function LifeIcon({kind}: {kind: "age" | "left" | "hungry"}) {
    return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 opacity-80" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {kind === "age" ? <path d="M8 14V7.5M8 7.5C8 4.8 6 3 3 3c0 2.8 2 4.5 5 4.5zM8 9.5c0-2.4 1.8-4 4.8-4 0 2.5-1.8 4-4.8 4z" /> : kind === "left" ? <path d="M4 1.8h8M4 14.2h8M5 1.8c0 3.2 3 4.2 3 6.2s-3 3-3 6.2M11 1.8c0 3.2-3 4.2-3 6.2s3 3 3 6.2" /> : <path d="M2 8h12a6 6 0 0 1-12 0zM5 5.5c0-1 1-1 1-2M8.5 5.5c0-1 1-1 1-2" />}
        </svg>
    );
}

/** The chance to live another Ark year (two real weeks) as a heart that fills from the bottom, its number beside it. */
function ArkChanceHeart({percent, label, tone, locale}: {percent: number; label: string; tone: LifeTone; locale: string}) {
    const id = React.useId();
    const fill = Math.max(0.06, Math.min(1, percent / 100));
    const color = percent >= 50 ? TONE.good : percent >= 20 ? TONE.warn : TONE.bad;
    let said = `${percent}%`;
    try {
        said = new Intl.NumberFormat(locale, {style: "percent", maximumFractionDigits: 0}).format(percent / 100);
    } catch {
        // As is.
    }
    return (
        <span role="img" aria-label={label} title={label} data-testid="ark-card-chance" data-tone={tone} className="flex shrink-0 items-center gap-1">
            <svg viewBox="0 0 16 16" className="h-[18px] w-[18px]" aria-hidden="true">
                <defs>
                    <clipPath id={`${id}-h`}><path d="M8 14.2S1.6 10.4 1.6 5.8A3.4 3.4 0 0 1 8 4.2a3.4 3.4 0 0 1 6.4 1.6C14.4 10.4 8 14.2 8 14.2z" /></clipPath>
                </defs>
                <rect x="0" y="0" width="16" height="16" fill="rgba(255,255,255,0.14)" clipPath={`url(#${id}-h)`} />
                <rect x="0" y={16 - 16 * fill} width="16" height={16 * fill} fill={color} clipPath={`url(#${id}-h)`} />
            </svg>
            <span data-testid="ark-card-chance-value" className="text-[12.5px] font-bold tabular-nums text-white">{said}</span>
        </span>
    );
}

/**
 * The life bar: born at its start, the life lived so far in its tone (green well, amber old or at risk, red hungry), a
 * tick for now, the likely end as a faded stretch at its far end (the estimate's range, never a promise). Drawn only: the
 * section's label says it in words. A flex row, so a right-to-left page mirrors it.
 */
function ArkLifeBarMarks({bar, tone}: {bar: ArkLifeBar; tone: LifeTone}) {
    const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
    const color = TONE[tone];
    return (
        <div aria-hidden="true" data-testid="ark-card-life-bar" data-now={bar.now.toFixed(3)} data-from={bar.from.toFixed(3)} className="relative flex h-2.5 min-w-0 flex-1 items-stretch overflow-hidden rounded-full bg-white/[0.09]">
            <span className="rounded-full" style={{width: pct(bar.now), minWidth: 6, background: `linear-gradient(90deg, ${color}99, ${color})`}} />
            <span className="w-[2px] shrink-0 bg-white" />
            <span className="min-w-0 flex-1" />
            <span className="rounded-full" style={{width: pct(1 - bar.from), minWidth: 6, background: `repeating-linear-gradient(135deg, ${color}55 0 3px, ${color}22 3px 6px)`}} />
        </div>
    );
}
