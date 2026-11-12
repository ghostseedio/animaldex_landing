"use client";

import React, {useEffect, useMemo, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import ArkShareButton from "@/app/[locale]/(composited)/ark/ark-share";
import ArkSpeciesIcon from "@/app/[locale]/(composited)/ark/ark-species-icon";
import type {ArkAnimal, ArkSceneHandle} from "@/ark-scene/types";
import {arkIconUrl, isArkPlaceholderSlug} from "@/ark-scene/placeholder-icon";
import {arkRestIsSleep, arkRestWords} from "@/lib/ark-rest-words";
import {arkBringerLabel, arkJoinLabels, type ArkLife} from "@/lib/ark-life";
import type {ArkAnimalFounders, ArkFounder, ArkFounderStory} from "@/lib/ark-founders";
import {ArkBringerNames, ArkBroughtByFounder, ArkFounderLink, ArkFounderStoryBlock, type ArkBringerEntry} from "@/components/ark/ark-founder-bits";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";
import {arkLineageHasAny, arkLineageLine, arkThriveWords} from "@/lib/ark-thrive";
import {arkRecordNoteFromLife, arkStatusSignature, arkStatusText, type ArkAnimalStatus, type ArkRecordNote} from "@/lib/ark-animal-status";

/**
 * The tapped animal's card along the world's foot (decision 240, owner 2026-11-12: "should be showing all the animals
 * logs and what its doing or goal ... make things compact"): who it is and who brought it in a line, its age, how fed
 * it is and its condition as chips, what it is doing now and its next goal (its behaviour schedule's, the same for
 * every viewer: `ArkSceneHandle.animalStatus`), its short log (the server's record of it and its last slots), and the
 * next moves as a compact row. The life story in full opens inside it. On a phone it covers about a third of the
 * screen at most, the Ark above it.
 */

/** A tapped animal's life story (`voyage_animal_life_v1`), as ark-view reads it. */
export type ArkCardLife = {id: string; life: ArkLife | null; loading: boolean};

const pill = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-sans text-sm font-bold leading-none transition-colors duration-200 [transition-timing-function:cubic-bezier(.2,.8,.2,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none";
const iconButton = `${pill} h-10 w-10 shrink-0 border`;

/** "a Plains Zebra", "an Arctic Fox", as the Talk titles do it. */
function withArticle(name: string, words: ArkWords): string {
    const an = /^[aeiou]/i.test(name) && !/^(uni|eu|one|use|usu|ura)/i.test(name);
    return (an ? words.replay.an : words.replay.a).replace("{animal}", name);
}

/** A card's heading takes focus when it opened from the keyboard; Escape inside the card closes it (A18). */
export function useCardFocus(key: string, focusOnOpen: boolean, onClose: () => void) {
    const headingRef = useRef<HTMLHeadingElement | null>(null);
    useEffect(() => {
        if (focusOnOpen) headingRef.current?.focus({preventScroll: true});
        // Only when another card opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onClose();
    };
    return {headingRef, onKeyDown};
}

/** A template with `{name}` filled by a node (a linked name), the words around it as the reader's language has them. */
export function ArkFilled({template, name, children}: {template: string; name: string; children: React.ReactNode}) {
    const at = template.indexOf(`{${name}}`);
    if (at < 0) return <>{template}</>;
    return <>{template.slice(0, at)}{children}{template.slice(at + name.length + 2)}</>;
}

/** What the card knows about an animal's life: the life story when the server sent one, else the snapshot's v2 fields. */
function lifeFacts(animal: ArkAnimal, life: ArkLife | null, arkDay: number | null, locale: string, former: string, named: ArkAnimalFounders | null = null) {
    const born = life ? life.origin.kind === "born" : animal.origin === "born";
    const parentsBy = life?.origin.kind === "born" ? life.origin.born_to : animal.bringers?.map((b) => b.label) ?? [];
    // Founders: the life story's when it carries them (names on), else the snapshot's.
    const fromLife = Boolean(life?.founders.names);
    const broughtByLabel = life?.origin.kind === "arrived" ? life.origin.brought_by ?? animal.brought_by.label : animal.brought_by.label;
    const founder: ArkFounder | null = born ? null : fromLife ? life?.founders.brought_by ?? null : named?.brought_by ?? null;
    const parentFounders: Array<ArkFounder | null> = fromLife ? life?.founders.born_to ?? [] : named?.bringers ?? [];
    const bringerEntries: ArkBringerEntry[] = born
        ? parentsBy.map((label, index) => ({label, founder: parentFounders[index] ?? null}))
        : [{label: broughtByLabel, founder}];
    const story: ArkFounderStory | null = born ? null : fromLife ? life?.founder_story ?? null : named?.story ?? null;
    const ageDays = life?.ark_age_days ?? (arkDay !== null && typeof animal.born_ark_day === "number" ? Math.max(arkDay - animal.born_ark_day, 0) : null);
    // Captures + thrive: how well kept it is (the life story's once read; it has none once it has died), and how it came aboard.
    const thrive = life ? life.thrive : animal.thrive ?? null;
    const source = life?.origin.kind === "arrived" ? life.origin.source ?? animal.source ?? null : animal.source ?? null;
    return {
        thrive,
        source,
        lineage: life?.lineage ?? null,
        born,
        hatched: life?.origin.kind === "born" && life.origin.from_egg,
        bringers: arkJoinLabels(born ? parentsBy : [broughtByLabel], locale, former),
        generation: life ? life.generation : animal.generation ?? null,
        ageDays,
        condition: life?.condition ?? animal.condition ?? null,
        founder,
        bringerEntries,
        anyFounder: bringerEntries.some((entry) => entry.founder !== null),
        ancestorFounder: life?.founders.ancestor ?? null,
        story
    };
}

function ageText(days: number, words: ArkWords, locale: string): string {
    if (days < 365) {
        const whole = Math.max(Math.round(days), 0);
        return whole === 1 ? words.life.ageDay : fillArkWords(words.life.ageDays, {days: whole.toLocaleString(locale)});
    }
    const years = days / 365;
    if (Math.abs(years - 1) < 0.05) return words.life.ageYear;
    return fillArkWords(words.life.ageYears, {years: years.toLocaleString(locale, {maximumFractionDigits: years < 10 ? 1 : 0})});
}

/**
 * The selected animal's status from the scene (`animalStatus`), read again about once a second: the scene works it
 * out from the same schedule it animates, so the card never says something the animal isn't doing.
 */
function useAnimalStatus(scene: () => ArkSceneHandle | null, id: string): ArkAnimalStatus | null {
    const [status, setStatus] = useState<ArkAnimalStatus | null>(null);
    useEffect(() => {
        let last = "";
        const read = () => {
            let next: ArkAnimalStatus | null = null;
            try {
                next = scene()?.animalStatus?.(id) ?? null;
            } catch {
                next = null;
            }
            const signature = arkStatusSignature(next);
            if (signature === last) return;
            last = signature;
            setStatus(next);
        };
        read();
        const timer = window.setInterval(read, 1000);
        return () => window.clearInterval(timer);
    }, [scene, id]);
    return status?.id === id ? status : null;
}

type CardProps = {
    bandRef: React.Ref<HTMLDivElement>;
    animal: ArkAnimal;
    words: ArkWords;
    locale: string;
    talk: string;
    /** When it came aboard (or was born), in the reader's words: its first log line's tooltip. */
    arrived: string;
    life: ArkCardLife | null;
    /** This animal's founders from the snapshot (shown before its life story reads). */
    founders: ArkAnimalFounders | null;
    arkDay: number | null;
    /** The voyage's start (the snapshot's), for the Ark day of a meal its life story names. */
    voyageStart: string | null;
    /** The scene: the animal's status (`animalStatus`), and where its life story's record lines go (`noteRecord`). */
    scene: () => ArkSceneHandle | null;
    asleep: boolean;
    /** How it rests now (`sleep.ts` restStatus), shown in plain words under "Right now" in its life story. */
    rest: string | null;
    following: boolean;
    onFollow: () => void;
    storyOpen: boolean;
    onStory: () => void;
    onClose: () => void;
    /** Opened from the keyboard (the panel's row): focus moves to the card's heading. */
    focusOnOpen: boolean;
    /** Share this animal's kind on the Ark: the page's path and the words that go with the link. */
    share: {localePath: string; text: string};
};

export function ArkAnimalCard({bandRef, animal, words, locale, talk, arrived, life: state, founders: named, arkDay, voyageStart, scene, asleep, rest, following, onFollow, storyOpen, onStory, onClose, focusOnOpen, share}: CardProps) {
    const life = state?.life ?? null;
    const {headingRef, onKeyDown} = useCardFocus(animal.id, focusOnOpen, onClose);
    // A species with no Ark model (A13): the stand-in figure, said so, and no Talk page to send to.
    const placeholder = animal.placeholder === true || isArkPlaceholderSlug(animal.model_slug);
    const facts = lifeFacts(animal, life, arkDay, locale, words.formerVoyager, named);
    const status = useAnimalStatus(scene, animal.id);
    const text = useMemo(() => (status ? arkStatusText(status, {activity: words.activity, card: words.card, story: words.story, life: words.life, replay: words.replay}, locale) : null), [status, words, locale]);

    // Its life story's record for its log: its last meal (an Ark day from the voyage's start), and a hatching.
    useEffect(() => {
        if (!life) return;
        const notes: ArkRecordNote[] = [];
        const start = voyageStart ? Date.parse(voyageStart) : NaN;
        const meal = arkRecordNoteFromLife(animal.id, life, Number.isFinite(start) ? start : null);
        if (meal) notes.push(meal);
        if (life.origin.kind === "born" && life.origin.from_egg) notes.push({animalId: animal.id, id: `hatched:${animal.id}`, kind: "hatched", at: Date.parse(life.origin.at ?? animal.arrived_at), day: null});
        if (notes.length) scene()?.noteRecord?.(notes);
    }, [life, animal.id, animal.arrived_at, voyageStart, scene]);

    const fedBar = text?.bars.find((bar) => bar.key === "fed") ?? null;
    const healthBar = text?.bars.find((bar) => bar.key === "health") ?? null;
    const thriveChip = facts.thrive ? arkThriveWords(facts.thrive, words.life) : null;
    // Chips: its age, how fed it is (the bars' words when the scene has them), its condition; old, and its generation.
    const chips: Array<{key: string; text: string; tone: "plain" | "good" | "warn" | "bad" | "thrive"}> = [];
    if (facts.ageDays !== null) chips.push({key: "age", text: ageText(facts.ageDays, words, locale), tone: "plain"});
    const fedText = fedBar?.text ?? (facts.condition && facts.condition !== "old" ? words.life[facts.condition] : facts.condition === "old" ? words.life.well_fed : null);
    if (fedText) chips.push({key: "fed", text: fedText, tone: fedBar?.tone === "bad" || facts.condition === "hungry" ? "bad" : fedBar?.tone === "warn" ? "warn" : "plain"});
    if (thriveChip) chips.push({key: "thrive", text: thriveChip, tone: facts.thrive !== "ordinary" ? "thrive" : "plain"});
    if (facts.condition === "old" || healthBar?.tone === "bad") chips.push({key: "old", text: healthBar?.text ?? words.life.old, tone: "warn"});
    if (facts.generation !== null && facts.generation > 0) chips.push({key: "generation", text: fillArkWords(words.life.generationShort, {n: facts.generation}), tone: "plain"});

    // Now: the schedule's activity; until the scene has it, asleep or nothing.
    const nowLine = text?.now ?? (asleep ? fillArkWords(words.card.now, {activity: words.activity.sleeping}) : null);
    const hasLife = Boolean(life) || animal.origin !== undefined;
    const restWords = arkRestWords(rest, words.life.rest);
    const asleepNow = status?.activity === "sleeping" || (!status && asleep) || arkRestIsSleep(rest);
    // The next moves: talk to it, and as icons follow it, its life story, share (in the header row on a desktop, under the
    // status on a phone; the one not shown is out of the page, so each control is there once).
    const moves = (
        <>
                {placeholder ? null : (
                    <Link href={`/talk/${animal.model_slug}`} className={`${pill} h-10 min-w-0 flex-1 bg-primary-400 px-4 text-[13.5px] text-canvas-950 hover:bg-primary-100 sm:flex-none md:max-w-[17rem]`}>
                        <span className="truncate">{talk}</span>
                        <span aria-hidden="true">→</span>
                    </Link>
                )}
                <button
                    type="button"
                    aria-pressed={following}
                    onClick={onFollow}
                    aria-label={words.life.follow}
                    title={following ? words.life.followHint : words.life.follow}
                    className={`${iconButton} ${following ? "border-primary-400 bg-primary-400/15 text-primary-100" : "border-line-100 text-ink-100 hover:border-primary-400"}`}
                >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                        <circle cx="10" cy="10" r="3" fill={following ? "currentColor" : "none"} />
                        <path d="M10 1.8v3M10 15.2v3M1.8 10h3M15.2 10h3" />
                    </svg>
                </button>
                {hasLife ? (
                    <button type="button" aria-expanded={storyOpen} onClick={onStory} aria-label={storyOpen ? words.life.hideStory : words.life.showStory} title={storyOpen ? words.life.hideStory : words.life.showStory} className={`${iconButton} ${storyOpen ? "border-primary-400 bg-primary-400/15 text-primary-100" : "border-line-100 text-ink-100 hover:border-primary-400"}`}>
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 3.5h9.5a2 2 0 0 1 2 2v11H6a2 2 0 0 1-2-2v-11z" /><path d="M7 7.5h5.5M7 10.5h5.5M7 13.5h3" /></svg>
                    </button>
                ) : null}
                <ArkShareButton
                    target="tap_card"
                    look="icon"
                    localePath={share.localePath}
                    slug={animal.model_slug}
                    title={animal.name}
                    text={share.text}
                    label={words.share.shareAnimal}
                    copied={words.share.copied}
                    className={`${iconButton} border-line-100 text-ink-100 hover:border-primary-400 disabled:opacity-60`}
                />
        </>
    );
    return (
        <div ref={bandRef} onKeyDown={onKeyDown} data-testid="ark-animal-card" className="rows-in absolute inset-x-0 bottom-0 border-t border-line-200 bg-canvas-950/[0.95] backdrop-blur-xl" role="region" aria-labelledby={`ark-card-${animal.id}`}>
            <div className="mx-auto w-full max-w-[86rem] px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 md:px-8 md:py-3">
                {/* Who: icon, name and kind, who brought it. */}
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7] md:h-12 md:w-12">
                        <ArkSpeciesIcon src={arkIconUrl(animal.model_slug)} size={48} className="h-[82%] w-[82%] object-contain" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-baseline gap-2">
                            <h2 id={`ark-card-${animal.id}`} ref={headingRef} tabIndex={-1} className="min-w-0 shrink truncate font-display text-base font-extrabold leading-tight text-white outline-none focus-visible:underline md:text-lg">{animal.name}</h2>
                            <p className="min-w-0 truncate text-[12px] text-ink-400">
                                {animal.scientific_name ? <span className="italic">{animal.scientific_name}</span> : null}
                                {animal.scientific_name ? " · " : null}
                                <span title={words.lives}>{words.zones[animal.zone]}</span>
                            </p>
                        </div>
                        <p className="mt-0.5 min-w-0 truncate text-[12.5px] leading-snug text-ink-200" data-testid="ark-card-by">
                            {facts.born && facts.anyFounder ? (
                                <><span className="text-ink-400">{words.life.bornTo}</span>{" "}<ArkFilled template={words.life.bornToValue} name="bringers"><ArkBringerNames entries={facts.bringerEntries} locale={locale} former={words.formerVoyager} /></ArkFilled></>
                            ) : facts.born ? (
                                <><span className="text-ink-400">{words.life.bornTo}</span> {fillArkWords(words.life.bornToValue, {bringers: facts.bringers})}</>
                            ) : facts.founder ? (
                                // A named founder (founders contract, section 5): "Brought by {name}", linked to their profile, with their photo.
                                <ArkBroughtByFounder template={words.founders.card.broughtBy} founder={facts.founder} />
                            ) : (
                                <><span className="text-ink-400">{words.broughtBy}</span> <span className="font-semibold text-ink-100">{facts.bringers}</span></>
                            )}
                        </p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-2 md:flex">{moves}</div>
                    <button type="button" onClick={onClose} aria-label={words.close} className="-mr-1 -mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-200 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                </div>

                {/* Its status: chips, what it is doing now and next (left), its log (right on a desktop, under on a phone). */}
                <div className={`mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:pl-[3.75rem] ${storyOpen ? "hidden md:grid" : ""}`}>
                    <div className="min-w-0">
                        {chips.length ? (
                            <p className="flex flex-wrap gap-1.5">
                                {chips.map((chip) => (
                                    <span key={chip.key} data-testid={chip.key === "thrive" ? "ark-card-thrive" : `ark-card-${chip.key}`} data-thrive={chip.key === "thrive" ? facts.thrive ?? undefined : undefined} className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${chip.tone === "thrive" ? "bg-primary-400/15 text-primary-200" : chip.tone === "bad" ? "bg-[#5a2a1e] text-[#ffc9b8]" : chip.tone === "warn" ? "bg-[#5a461e] text-[#ffe2a8]" : "bg-white/[0.08] text-ink-100"}`}>{chip.text}</span>
                                ))}
                            </p>
                        ) : null}
                        <div aria-live="polite">
                            {nowLine ? <p data-testid="ark-card-now" data-activity={status?.activity ?? undefined} className={`mt-1.5 text-[14px] font-semibold italic leading-snug md:text-[15px] ${asleepNow ? "text-[#c9d6ff]" : "text-white"}`}>{nowLine}</p> : null}
                            {text?.next ? <p data-testid="ark-card-next" className="mt-0.5 text-[12.5px] italic leading-snug text-ink-300">{text.next}</p> : null}
                        </div>
                        {placeholder ? <p className="mt-1 text-[11.5px] leading-snug text-ink-400">{words.life.placeholder}</p> : null}
                    </div>
                    {text?.log.length ? (
                        <div className="min-w-0">
                            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400">{words.card.logTitle}</p>
                            <ol data-testid="ark-card-log" aria-label={words.card.logTitle} tabIndex={0} className="mt-0.5 max-h-[3.9rem] overflow-y-auto overscroll-contain pr-1 outline-none focus-visible:ring-1 focus-visible:ring-primary-300 md:max-h-[5.4rem]">
                                {text.log.map((line) => (
                                    <li key={line.id} data-source={line.source} className="flex min-w-0 items-baseline gap-2 py-[1px] text-[12px] leading-snug">
                                        <span className={`w-[4.6rem] shrink-0 whitespace-nowrap tabular-nums ${line.source === "record" ? "text-ink-300" : "text-ink-400"}`} title={line.id.startsWith("origin:") ? arrived : undefined}>{line.stamp}</span>
                                        <span aria-hidden="true" className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${line.source === "record" ? "bg-primary-300" : "border border-ink-400"}`} />
                                        <span className={`min-w-0 truncate ${line.source === "record" ? "font-semibold text-ink-100" : "text-ink-200"}`}>{line.text}</span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    ) : null}
                </div>

                {storyOpen ? <ArkLifeStory animal={animal} life={life} state={state} facts={facts} words={words} locale={locale} rest={restWords} /> : null}

                <div className="mt-2 flex items-center gap-2 md:hidden">{moves}</div>
            </div>
        </div>
    );
}

/** The life story in full, inside the card: how it got aboard, then every line from the server's record. */
function ArkLifeStory({animal, life, state, facts, words, locale, rest = null}: {animal: ArkAnimal; life: ArkLife | null; state: ArkCardLife | null; facts: ReturnType<typeof lifeFacts>; words: ArkWords; locale: string; /** How it rests now, in words (the sleep lane): first in "Right now". */ rest?: string | null}) {
    const w = words.life;
    const rows: Array<[string, React.ReactNode]> = [];
    if (facts.generation !== null) rows.push([w.generation, facts.generation > 0 ? fillArkWords(w.generationBorn, {n: facts.generation}) : w.generationArrived]);
    if (facts.ageDays !== null) rows.push([w.age, ageText(facts.ageDays, words, locale)]);
    // "Condition" is how well kept it is (its thrive band); its hunger and age now go under "Right now".
    if (facts.thrive) rows.push([w.condition, arkThriveWords(facts.thrive, w)]);
    // Right now: how it rests (the sleep lane: "Asleep in its den"), then its hunger and age ("Asleep in its den · Well-fed").
    const now = [rest, facts.condition ? w[facts.condition] : null].filter((part): part is string => Boolean(part));
    if (now.length) rows.push([w.now, now.join(" · ")]);
    if (life?.died) rows.push([w.ended, life.died.kind === "starved" ? w.starved : life.died.kind === "eaten" ? w.endedEaten : w.endedOld]);
    // A young one whose breeding the server estimated (its record gives none, or only part): said so.
    if (life?.origin.kind === "born" && (life.origin.breeding_source === "estimate" || life.origin.breeding_source === "partial")) {
        rows.push([w.breeding, life.origin.breeding_source === "estimate" ? w.breedingEstimated : w.breedingPartial]);
    }
    if (life && life.meals > 0) {
        const last = life.last_meal;
        const detail = last ? ` · ${fillArkWords(w.lastMeal, {prey: withArticle(last.prey, words)})}${last.phrase ? ` (${fillArkWords(w.dietSays, {phrase: last.phrase})})` : ""}` : "";
        rows.push([w.meals, `${life.meals.toLocaleString(locale)}${detail}`]);
    }
    // Its family line by generation when the server counts it (captures + thrive), else the young it raised.
    if (life?.lineage) rows.push([w.lineage, arkLineageLine(life.lineage, w, locale)]);
    else if (life) rows.push([w.young, life.young_raised > 0 ? life.young_raised.toLocaleString(locale) : w.noYoung]);
    if (life && life.milestones.count > 0) rows.push([w.milestones, fillArkWords(w.milestonesValue, {count: life.milestones.count.toLocaleString(locale)})]);
    // Its line, further back than its parents (the third generation on).
    if (facts.born && (facts.generation ?? 0) >= 2 && life?.ancestor_brought_by) {
        // Its first ancestor's bringer: their @username linked when named, else their Voyager label.
        rows.push([w.line, facts.ancestorFounder
            ? <ArkFilled template={w.lineValue} name="bringer"><ArkFounderLink founder={facts.ancestorFounder} /></ArkFilled>
            : fillArkWords(w.lineValue, {bringer: arkBringerLabel(life.ancestor_brought_by, words.formerVoyager)})]);
    }
    // A3: the step that brought it was revised after it arrived; it stays aboard.
    if (life?.revision) rows.push([w.revised, life.revision.worked ? w.revisedWorked : w.revisedNot]);
    return (
        <div className="rows-in mt-2 max-h-[30svh] overflow-y-auto overscroll-contain border-t border-line-300 pt-2 md:max-h-[30svh] md:pl-[3.75rem]" aria-label={`${w.showStory}: ${animal.name}`}>
            <ArkStoryLine state={state} born={facts.born} hatched={facts.hatched} story={facts.story} capture={facts.source === "capture"} founder={facts.founder} words={words} />
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2 xl:grid-cols-4" data-testid={arkLineageHasAny(facts.lineage) ? "ark-card-lineage" : undefined}>
                {rows.map(([label, value]) => (
                    <div key={label} className="flex min-w-0 gap-2 border-b border-line-300/60 pb-1.5">
                        <dt className="w-[6.5rem] shrink-0 text-ink-400">{label}</dt>
                        <dd className="min-w-0 font-semibold text-ink-100">{value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

/**
 * How it got aboard: the founder's own story when they shared it (founders
 * contract); otherwise "Came aboard with a capture" (captures + thrive), or
 * "Came aboard after a step that worked" for one a step brought before
 * captures did (or a server that doesn't say), the same for everyone (or
 * "Born on the Ark"). Never where or when it was captured. The public debate's problem and the way
 * that worked only when the life story carries `story_public`, which the
 * server sends only while its `public_story` flag is on. Never anything private.
 */
function ArkStoryLine({state, born, hatched, story, capture, founder, words}: {state: ArkCardLife | null; born: boolean; hatched: boolean; story: ArkFounderStory | null; capture: boolean; founder: ArkFounder | null; words: ArkWords}) {
    // Founders: the story its founder chose to share, in their words (shown whether or not the founder is named), their @username beside its header.
    // D6: on an animal a capture brought, the shared story is of a step that keeps it thriving.
    if (story) return <ArkFounderStoryBlock story={story} founder={founder} title={capture ? words.founders.card.howThriving : words.founders.card.howAboard} className="rows-in" />;
    if (!state || state.loading) return <p aria-hidden="true" className="h-[1.125rem]" />;
    const told = state.life?.story_public ?? null;
    return (
        <p className="rows-in flex items-start gap-1.5 text-[13px] leading-snug text-ink-200">
            <svg viewBox="0 0 16 16" className="mt-[3px] h-3 w-3 shrink-0 text-primary-300" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg>
            <span className="min-w-0">
                {told ? fillArkWords(words.story.debate, {problem: told.problem, animal: told.way.animal, power: told.way.power}) : hatched ? words.life.hatchedAboard : born ? words.life.bornAboard : capture ? words.story.capture : words.story.generic}
                {told?.debate_id ? (
                    <>
                        {" "}
                        <Link href={`/app/debates/${encodeURIComponent(told.debate_id)}`} className="whitespace-nowrap font-bold text-primary-300 underline-offset-4 hover:underline">
                            {words.story.openDebate}
                        </Link>
                    </>
                ) : null}
            </span>
        </p>
    );
}
