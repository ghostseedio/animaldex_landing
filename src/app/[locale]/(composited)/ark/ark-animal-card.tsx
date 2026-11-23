"use client";

import {arkIsHuman} from "@/lib/ark-human";
import {ARK_KEPT_OFF, arkKeptLines, isArkLeftKind, readArkKeptFlags, type ArkKeptFlags} from "@/lib/ark-kept";
import React, {Suspense, lazy, useEffect, useMemo, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import ArkShareButton from "@/app/[locale]/(composited)/ark/ark-share";
import ArkSpeciesIcon from "@/app/[locale]/(composited)/ark/ark-species-icon";
import type {ArkAnimal, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import {arkIconUrl, isArkPlaceholderSlug} from "@/ark-scene/placeholder-icon";
import {arkRestIsSleep, arkRestWords} from "@/lib/ark-rest-words";
import {arkBringerLabel, arkJoinLabels, type ArkLife} from "@/lib/ark-life";
import type {ArkAnimalFounders, ArkFounder, ArkFounderStory} from "@/lib/ark-founders";
import {ArkBringerNames, ArkBroughtByFounder, ArkFounderLink, ArkFounderStoryBlock, type ArkBringerEntry} from "@/components/ark/ark-founder-bits";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";
import {arkLineageHasAny, arkLineageLine, arkThriveWords} from "@/lib/ark-thrive";
import {ARK_ACTIVITY_ENGLISH, ARK_CARD_ENGLISH, arkRecordNoteFromLife, arkStatusSignature, arkStatusText, type ArkAnimalStatus, type ArkRecordNote} from "@/lib/ark-animal-status";
import {arkHumanDays} from "@/lib/ark-human-time";
import {arkIndexNumber, decodeArkSpeciesCard, type ArkSpeciesCard} from "@/lib/ark-species-card";
import {arkPerfCountRender} from "@/ark-scene/runtime/perf";
import type {ArkCapturePhoto} from "@/lib/ark-capture-photo";
import {arkPhotoShownOn} from "@/lib/ark-photo-label";
import {arkGrewWords, arkStatGainNotes, decodeArkStatGains} from "@/lib/ark-stat-gains";
import {ArkLivesRow} from "@/app/[locale]/(composited)/ark/ark-lives";
import {ArkCaptureBadges} from "@/app/[locale]/(composited)/ark/ark-capture-badges";
import {ArkFilled, useCardFocus} from "@/app/[locale]/(composited)/ark/ark-card-focus";
import type {ArkAnimalHearts, ArkHeartsWords} from "@/lib/ark-hearts";
import {arkCycleKey, arkCycleOf, arkCycleStep, type ArkCycle} from "@/lib/ark-cycle";

/**
 * The tapped animal's card along the world's foot (decision 240, owner 2026-11-12: "should be showing all the animals
 * logs and what its doing or goal ... make things compact"): who it is and who brought it in a line, its age, how fed
 * it is and its condition as chips, what it is doing now and its next goal (its behaviour schedule's, the same for
 * every viewer: `ArkSceneHandle.animalStatus`), its short log (the server's record of it and its last slots), and the
 * next moves as a compact row. The life story in full opens inside it. On a phone it covers about a third of the
 * screen at most, the Ark above it.
 */

/**
 * The photo block (the thumb beside who it is, and for an ancestor's photo the line saying whose it is): lazy, so the
 * Ark page's static JavaScript stays inside its budget (ark-page-weight.test.ts); it only matters once a card has a photo.
 */
const ArkCardPhoto = lazy(() => import("@/app/[locale]/(composited)/ark/ark-card-photo"));

/**
 * The life block (decision 389, `lib/ark-time-left.ts`; owner 2026-11-20: every animal): its age and life stage in Ark
 * time, a life bar, and "Estimated time left" with its reasons. Lazy, as the photo block is.
 */
const ArkTimeLeft = lazy(() => import("@/app/[locale]/(composited)/ark/ark-time-left"));

/** Powers you can see (decision 420): its Power's line, with its table, loaded with the card. */
const ArkCardPower = lazy(() => import("@/app/[locale]/(composited)/ark/ark-card-power"));

/** Its day (lane ark-its-day): loaded only when opened. */
const ArkItsDay = lazy(() => import("@/app/[locale]/(composited)/ark/ark-its-day"));
/** Care from visitors (GIFTS-CARE, decision 387): what was given and what the reader could give; lazy, nothing while the server's switch is off. */
const ArkCardCare = lazy(() => import("@/app/[locale]/(composited)/ark/ark-card-care"));

/** A tapped animal's life story (`voyage_animal_life_v1`), as ark-view reads it. */
export {ArkFilled, useCardFocus};

export type ArkCardLife = {id: string; life: ArkLife | null; loading: boolean};

const pill = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-sans text-sm font-bold leading-none transition-colors duration-200 [transition-timing-function:cubic-bezier(.2,.8,.2,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none";
const iconButton = `${pill} h-10 w-10 shrink-0 border`;

function capitalise(text: string): string {
    return text ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : text;
}

/** "a Plains Zebra", "an Arctic Fox", as the Talk titles do it. */
function withArticle(name: string, words: ArkWords): string {
    const an = /^[aeiou]/i.test(name) && !/^(uni|eu|one|use|usu|ura)/i.test(name);
    return (an ? words.replay.an : words.replay.a).replace("{animal}", name);
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

/** Its age in the visitor's own time ("3 hours", "2 days"): never Ark days (lane ARK-SIMPLE). */
function ageText(days: number, _words: ArkWords, locale: string): string {
    return arkHumanDays(Math.max(days, 0), Math.max(days, 0), locale);
}

/**
 * Its kind's AnimalDex index number and Animal Power (`/api/ark/species-card`, the catalog's row): read once per species
 * per visit, kept for the next card of the same kind. Null until read, or when the catalog has neither.
 */
const speciesCards = new Map<string, Promise<ArkSpeciesCard | null>>();
function useSpeciesCard(animal: ArkAnimal, placeholder: boolean): ArkSpeciesCard | null {
    const key = animal.species_profile_id || animal.model_slug;
    const [card, setCard] = useState<{key: string; card: ArkSpeciesCard | null} | null>(null);
    useEffect(() => {
        if (placeholder && !animal.species_profile_id) return;
        let read = speciesCards.get(key);
        if (!read) {
            const query = new URLSearchParams();
            if (animal.species_profile_id) query.set("id", animal.species_profile_id);
            if (!placeholder) query.set("slug", animal.model_slug);
            read = fetch(`/api/ark/species-card?${query}`).then((response) => (response.ok ? response.json() : null)).then(decodeArkSpeciesCard, () => null);
            speciesCards.set(key, read);
        }
        let live = true;
        void read.then((value) => {
            if (live) setCard({key, card: value});
        });
        return () => {
            live = false;
        };
    }, [key, animal.species_profile_id, animal.model_slug, placeholder]);
    return card?.key === key ? card.card : null;
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
    /**
     * The photo (`/api/ark/photo/<id>`), or null: no block at all. The animal's own (it arrived with that capture) or, for
     * one born on the Ark, its recorded ancestor's, which the card always says is not this animal's (section 2.6).
     */
    photo?: ArkCapturePhoto | null;
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
    /**
     * Hearts are lives (behind the server's `ark_hearts`): the owner's own animal's hearts and the restore, or null
     * (someone else's animal, hearts off, the read absent): the card is as it was.
     */
    lives?: {entry: ArkAnimalHearts; words: ArkHeartsWords; cost: number; onRestored: (captureId: string, hearts: number) => void} | null;
    /** The public snapshot, for "Estimated time left" (the animals around it, the Ark day): read only, never changed. */
    snapshot?: ArkSnapshot | null;
    /** "My animals" is on: the chevrons page through the reader's own of its kind only (the others are hidden). */
    mineOnly?: boolean;
};

/**
 * Toggle through a species (lane ARK-CYCLE, owner 2026-11-21): "‹ 1 of 2 ›" when more than one of the focused animal's
 * kind is aboard (`lib/ark-cycle.ts`, from the live animals the scene was given), on either island. A chevron selects the
 * next through the scene's own `select`, the same flight as a tap or the HUD's list (across the strait when it is on the
 * other island). Square, as the card's Power box; 44 px targets on a phone.
 */
function ArkCycler({cycle, words, locale, onStep, wide}: {cycle: ArkCycle; words: ArkWords; locale: string; onStep: (step: 1 | -1) => void; wide: boolean}) {
    const card = words.card;
    const prev = card.cyclePrev || ARK_CARD_ENGLISH.cyclePrev;
    const next = card.cycleNext || ARK_CARD_ENGLISH.cycleNext;
    const count = fillArkWords(card.cycleCount || ARK_CARD_ENGLISH.cycleCount, {n: (cycle.index + 1).toLocaleString(locale), total: cycle.count.toLocaleString(locale)});
    const button = `flex shrink-0 items-center justify-center rounded-none border border-line-100 text-ink-100 transition-colors hover:border-primary-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 ${wide ? "h-11 w-14" : "h-9 w-9"}`;
    const chevron = (d: string) => <svg viewBox="0 0 20 20" className="h-4 w-4 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
    return (
        <div role="group" aria-label={count} data-testid="ark-card-cycle" data-index={cycle.index + 1} data-count={cycle.count} className={wide ? "mt-2 flex items-center justify-between gap-2" : "flex shrink-0 items-center"}>
            <button type="button" onClick={() => onStep(-1)} aria-label={prev} title={prev} data-testid="ark-card-cycle-prev" className={button}>{chevron("M12.5 4.5 7 10l5.5 5.5")}</button>
            <span aria-live="polite" className={`whitespace-nowrap text-center font-sans text-[12.5px] font-bold tabular-nums text-ink-100 ${wide ? "flex-1" : "min-w-[3.75rem] px-2"}`}>{count}</span>
            <button type="button" onClick={() => onStep(1)} aria-label={next} title={next} data-testid="ark-card-cycle-next" className={button}>{chevron("M7.5 4.5 13 10l-5.5 5.5")}</button>
        </div>
    );
}

/**
 * "Talk to a Plains Zebra" when it fits, else the chat icon and the short word (owner 2026-11-20: never an animal's name cut
 * mid-word). A hidden copy of the full label is measured against the room the button has, again on every resize.
 */
function ArkTalkLabel({full, short}: {full: string; short: string}) {
    const boxRef = useRef<HTMLSpanElement | null>(null);
    const fullRef = useRef<HTMLSpanElement | null>(null);
    const [fits, setFits] = useState(true);
    useEffect(() => {
        const box = boxRef.current;
        const measure = fullRef.current;
        if (!box || !measure) return;
        const check = () => setFits(measure.scrollWidth <= box.clientWidth + 1);
        check();
        const observer = typeof ResizeObserver === "function" ? new ResizeObserver(check) : null;
        observer?.observe(box);
        return () => observer?.disconnect();
    }, [full]);
    return (
        <span ref={boxRef} className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden">
            <span ref={fullRef} aria-hidden="true" className="invisible absolute start-0 top-0 whitespace-nowrap">{full}</span>
            {fits ? (
                <span aria-hidden="true" className="whitespace-nowrap">{full}</span>
            ) : (
                <span aria-hidden="true" className="flex items-center gap-1.5 whitespace-nowrap">
                    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 16 14H9l-4 3v-3H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5z" /></svg>
                    {short}
                </span>
            )}
        </span>
    );
}

export function ArkAnimalCard({bandRef, animal, words, locale, talk, arrived, life: state, founders: named, photo = null, arkDay, voyageStart, scene, asleep, rest, following, onFollow, storyOpen, onStory, onClose, focusOnOpen, share, lives = null, snapshot = null, mineOnly = false}: CardProps) {
    arkPerfCountRender();
    const life = state?.life ?? null;
    const {headingRef, onKeyDown} = useCardFocus(animal.id, focusOnOpen, onClose);
    // A species with no Ark model (A13): the stand-in figure, said so, and no Talk page to send to.
    const placeholder = animal.placeholder === true || isArkPlaceholderSlug(animal.model_slug);
    const facts = lifeFacts(animal, life, arkDay, locale, words.formerVoyager, named);
    // An ancestor's photo only on an animal born on the Ark, its own only on one that arrived; never one unlabelled.
    const shownPhoto = arkPhotoShownOn(photo, facts.born);
    // The "whose photo" line only once the photo itself has loaded: the server's photo can be refused at the signing
    // route (an original, a failed read), and a line about a photo that is not there would be wrong.
    const [loadedPhoto, setLoadedPhoto] = useState<string | null>(null);
    // (Behaviour flows, pilot: the card's flow lines in the reader's words; English names the food.)
    useEffect(() => {
        scene()?.setFlowWords?.(locale.startsWith("en") ? null : words.flow ?? null);
    }, [scene, locale, words.flow]);
    const status = useAnimalStatus(scene, animal.id);
    const [dayOpen, setDayOpen] = useState<string | null>(null);
    const dayShown = dayOpen === animal.id;
    // Its rhythm against System Dynamics is not on the card (owner 2026-11-20: jargon a new visitor cannot read).
    // Its log in the visitor's own time ("2 h ago"), said again each minute.
    const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000));
    useEffect(() => {
        const timer = window.setInterval(() => setMinute(Math.floor(Date.now() / 60_000)), 30_000);
        return () => window.clearInterval(timer);
    }, []);
    const text = useMemo(() => (status ? arkStatusText(status, {activity: words.activity, card: words.card, story: words.story, life: words.life, replay: words.replay}, locale, minute * 60_000 + 59_999) : null), [status, words, locale, minute]);

    // Its life story's record for its log: its last meal (an Ark day from the voyage's start), and a hatching.
    useEffect(() => {
        if (!life) return;
        const notes: ArkRecordNote[] = [];
        const start = voyageStart ? Date.parse(voyageStart) : NaN;
        const meal = arkRecordNoteFromLife(animal.id, life, Number.isFinite(start) ? start : null);
        if (meal) notes.push(meal);
        // Stats grow from Ark life (STATS-GROW): "Grew stronger: +1 dominance from a hunt", one line per point.
        notes.push(...arkStatGainNotes(animal.id, decodeArkStatGains(life.stat_gains), arkGrewWords(words.grew), locale));
        if (life.origin.kind === "born" && life.origin.from_egg) notes.push({animalId: animal.id, id: `hatched:${animal.id}`, kind: "hatched", at: Date.parse(life.origin.at ?? animal.arrived_at), day: null});
        if (notes.length) scene()?.noteRecord?.(notes);
    }, [life, animal.id, animal.arrived_at, voyageStart, scene, words.grew, locale]);

    const species = useSpeciesCard(animal, placeholder);
    // The others of its kind aboard (real animals only: the snapshot the scene draws), and ← → to page through them.
    const cycle = useMemo(() => arkCycleOf(snapshot, animal.id, {mineOnly}), [snapshot, animal.id, mineOnly]);
    const stepCycle = useMemo(() => (cycle ? (step: 1 | -1) => scene()?.select(arkCycleStep(cycle, step)) : null), [cycle, scene]);
    useEffect(() => {
        if (!stepCycle) return;
        const onKey = (event: KeyboardEvent) => {
            const step = arkCycleKey(event, document.documentElement.dir === "rtl");
            if (!step) return;
            // (Before the world's own arrow-key panning, `controls.listenToKeyEvents(canvas)`: with a card of a kind
            // of several open, ← → page through them; ↑ ↓ still pan, and with one of a kind ← → pan as before.)
            event.preventDefault();
            event.stopPropagation();
            stepCycle(step);
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [stepCycle]);
    // What it is doing now, in a word or two (no "Now:"): the schedule's activity; until the scene has it, asleep or nothing.
    const activityKey = status?.activity ?? (asleep ? "sleeping" : null);
    const activity = status?.line ?? (activityKey ? words.activity[activityKey] ?? ARK_ACTIVITY_ENGLISH[activityKey] : null);
    // Condition as a sign, not a chip (owner 2026-11-20): a star for a thriving one (good or prime), its band in the tooltip.
    const thriving = facts.thrive === "prime" || facts.thrive === "good" ? arkThriveWords(facts.thrive, words.life) : null;
    const hasLife = Boolean(life) || animal.origin !== undefined;
    const restWords = arkRestWords(rest, words.life.rest);
    const asleepNow = status?.activity === "sleeping" || (!status && asleep) || arkRestIsSleep(rest);
    const simple = words.simple;
    // The next moves: talk to it, and as icons follow it, its life story, share (in the header row on a desktop, under the
    // status on a phone; the one not shown is out of the page, so each control is there once).
    const moves = (
        <>
                {placeholder ? null : (
                    <Link href={`/talk/${animal.model_slug}`} aria-label={talk} title={talk} className={`${pill} h-10 min-w-0 flex-1 bg-primary-400 px-3 text-[13.5px] sm:px-4 text-canvas-950 hover:bg-primary-100 sm:flex-none md:max-w-[17rem]`}>
                        <ArkTalkLabel full={talk} short={simple?.talk ?? "Talk"} />
                        <span aria-hidden="true" className="rtl:rotate-180">→</span>
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
                <button type="button" aria-expanded={dayShown} onClick={() => setDayOpen(dayShown ? null : animal.id)} aria-label={words.card.itsDay} title={words.card.itsDay} data-testid="ark-card-its-day" className={`${iconButton} ${dayShown ? "border-primary-400 bg-primary-400/15 text-primary-100" : "border-line-100 text-ink-100 hover:border-primary-400"}`}>
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="7.2" /><path d="M10 5.6V10l3 1.8" /></svg>
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
        <div ref={bandRef} onKeyDown={onKeyDown} data-testid="ark-animal-card" className="ark-card-glass rows-in pointer-events-auto absolute inset-x-0 bottom-0 border-t border-white/[0.12]" role="region" aria-labelledby={`ark-card-${animal.id}`}>
            <div className="mx-auto w-full max-w-[86rem] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:px-8 md:pb-4 md:pt-3.5">
                {/* Who: icon, name, its sex and index number, what it is doing; who brought it under. */}
                <div className="flex items-center gap-3">
                    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7] ring-1 ring-white/20 md:h-12 md:w-12">
                        <ArkSpeciesIcon src={arkIconUrl(animal.model_slug)} size={48} className="h-[82%] w-[82%] object-contain" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                            <h2 id={`ark-card-${animal.id}`} ref={headingRef} tabIndex={-1} className="min-w-0 shrink truncate font-display text-[17px] font-extrabold leading-tight text-white outline-none focus-visible:underline md:text-[19px]">{animal.name}</h2>
                            {/* Male or female beside its name (`ark.sex`): the lazy block's other face, while the server's `sexes` switch is on. */}
                            <Suspense fallback={null}><ArkTimeLeft sex animal={animal} words={words} locale={locale} /></Suspense>
                            {thriving ? (
                                <span role="img" aria-label={thriving} title={thriving} data-testid="ark-card-thrive" data-thrive={facts.thrive ?? undefined} className="shrink-0 text-primary-300">
                                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true"><path d="M8 1.2l1.9 4.2 4.6.5-3.4 3.1 1 4.5L8 11.2l-4.1 2.3 1-4.5L1.5 5.9l4.6-.5z" /></svg>
                                </span>
                            ) : null}
                            {species?.number ? (
                                <span data-testid="ark-card-index" title={simple?.number ?? "AnimalDex number"} className="shrink-0 rounded-md bg-white/[0.08] px-1.5 py-[3px] font-mono text-[11px] font-bold leading-none tabular-nums tracking-wide text-ink-200">
                                    <span className="sr-only">{simple?.number ?? "AnimalDex number"} </span>{arkIndexNumber(species.number)}
                                </span>
                            ) : null}
                            {/* Its capture's battle tier and hearts (owner 2026-11-21), from its life story: the server's
                                `capture_tier_for_capture` and `challenge_health`, only for an animal that arrived with its own capture. */}
                            <ArkCaptureBadges life={life} words={words} ownHearts={lives && animal.mine ? lives.entry.hearts : null} />
                            {activity ? (
                                <span data-testid="ark-card-now" data-activity={activityKey ?? undefined} aria-live="polite" className={`hidden min-w-0 shrink items-center gap-1.5 truncate rounded-full px-2 py-[3px] text-[11.5px] font-semibold leading-none sm:inline-flex ${asleepNow ? "bg-[#7c8cff]/15 text-[#c9d6ff]" : "bg-primary-400/[0.12] text-primary-100"}`}>
                                    <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${asleepNow ? "bg-[#9fb0ff]" : "bg-primary-300 motion-safe:animate-pulse"}`} />
                                    <span className="truncate">{capitalise(activity)}</span>
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-0.5 min-w-0 truncate text-[12.5px] leading-snug text-ink-300" data-testid="ark-card-by">
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
                            <span className="text-ink-500"> · </span>
                            <span title={words.lives}>{words.zones[animal.zone]}</span>
                        </p>
                    </div>
                    {shownPhoto ? <Suspense fallback={null}><ArkCardPhoto key={animal.id} part="thumb" photo={shownPhoto} species={animal.name} words={words} onLoaded={() => setLoadedPhoto(animal.id)} /></Suspense> : null}
                    {cycle && stepCycle ? <div className="hidden md:flex"><ArkCycler cycle={cycle} words={words} locale={locale} onStep={stepCycle} wide={false} /></div> : null}
                    <div className="hidden shrink-0 items-center gap-2 md:flex">{moves}</div>
                    <button type="button" onClick={onClose} aria-label={words.close} className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                </div>

                {cycle && stepCycle ? <div className="md:hidden"><ArkCycler cycle={cycle} words={words} locale={locale} onStep={stepCycle} wide /></div> : null}

                {/* Whose photo, when it is not this animal's: "Born on the Ark · Photo of its parent, brought aboard by @ada". */}
                {shownPhoto && shownPhoto.brought_by && loadedPhoto === animal.id ? <Suspense fallback={null}><ArkCardPhoto part="line" photo={shownPhoto} species={animal.name} words={words} /></Suspense> : null}

                {/*
                  * Three columns on a desktop (one under another on a phone): its life (age, time left, chance as a heart) with who is
                  * around it as icons; its Animal Power; its log, in the visitor's own time.
                  */}
                <div className={`mt-2.5 grid grid-cols-1 gap-x-6 gap-y-2.5 md:mt-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.85fr)] md:pl-[3.75rem] ${storyOpen || dayShown ? "hidden md:grid" : ""}`}>
                    <div className="min-w-0 space-y-2">
                        {snapshot ? <Suspense fallback={<div className="h-[2.6rem]" />}><ArkTimeLeft animal={animal} snapshot={snapshot} words={words} locale={locale} /></Suspense> : null}
                        {/* Release to the Wild (P1-8, behind the server's switch) and carers (decision 418), then who is around it: what it eats, what could hunt it, its mates, as icons (lane ark-relation-lines; no fallback is React 18's null). */}
                        <Suspense><ArkTimeLeft release={Link} animal={animal} words={words} locale={locale} day={arkDay} scene={scene} snapshot={snapshot} /></Suspense>
                        {placeholder ? null : <Suspense fallback={null}><ArkCardCare animalId={animal.id} words={words.care} locale={locale} /></Suspense>}
                        {lives && animal.mine ? <ArkLivesRow entry={lives.entry} words={lives.words} locale={locale} cost={lives.cost} onRestored={lives.onRestored} heartsInHeader /> : null}
                        {placeholder ? <p className="text-[11.5px] leading-snug text-ink-400">{words.life.placeholder}</p> : null}
                        {/* The last of its kind aboard (the server's last_of_kind), or a lone founder (decision 389): it ages out honestly unless another is caught. */}
                        {animal.last_of_kind || animal.lone ? <p data-testid="ark-card-last-of-kind" className="text-[12px] font-semibold leading-snug text-[#ffe2a8]">{animal.last_of_kind ? words.life.lastOfKind : words.life.lone ?? "Lone founder"}</p> : null}
                    </div>
                    {/* Its Animal Power: the catalog's name and one-line lesson; whether its survival Power is working shows as a tick. */}
                    <Suspense fallback={null}><ArkCardPower animal={animal} band={facts.thrive} words={words.life.power} power={species?.power ?? null} label={simple?.power} href={placeholder ? null : `/talk/${animal.model_slug}`} link={Link} /></Suspense>
                    {text?.log.length ? (
                        <div className="min-w-0">
                            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">{words.card.logTitle}</p>
                            <ol data-testid="ark-card-log" aria-label={words.card.logTitle} tabIndex={0} className="mt-1 max-h-[2.9rem] overflow-y-auto overscroll-contain pr-1 outline-none focus-visible:ring-1 focus-visible:ring-primary-300 md:max-h-[6.2rem]">
                                {text.log.map((line) => (
                                    <li key={line.id} data-source={line.source} className="flex min-w-0 items-center gap-2 py-[2px] text-[12.5px] leading-snug">
                                        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${line.source === "record" ? "bg-primary-300" : "bg-white/25"}`} />
                                        <span className={`min-w-0 flex-1 truncate ${line.source === "record" ? "font-semibold text-ink-100" : "text-ink-200"}`}>{line.text}</span>
                                        <span className="shrink-0 whitespace-nowrap text-[11.5px] tabular-nums text-ink-400" title={line.id.startsWith("origin:") ? arrived : undefined}>{line.stamp}</span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    ) : null}
                </div>

                {dayShown ? (
                    <Suspense fallback={<p className="mt-2 h-24 text-[11.5px] italic text-ink-400 md:pl-[3.75rem]">{words.card.dayWorking}</p>}>
                        <ArkItsDay id={animal.id} scene={scene} words={words} locale={locale} onClose={() => setDayOpen(null)} />
                    </Suspense>
                ) : null}
                {storyOpen ? <ArkLifeStory animal={animal} life={life} state={state} facts={facts} words={words} locale={locale} rest={restWords} /> : null}

                <div className="mt-2.5 flex items-center gap-1.5 sm:gap-2 md:hidden">{moves}</div>
            </div>
        </div>
    );
}

/** The life story in full, inside the card: how it got aboard, then every line from the server's record. */
function ArkLifeStory({animal, life, state, facts, words, locale, rest = null}: {animal: ArkAnimal; life: ArkLife | null; state: ArkCardLife | null; facts: ReturnType<typeof lifeFacts>; words: ArkWords; locale: string; /** How it rests now, in words (the sleep lane): first in "Right now". */ rest?: string | null}) {
    const w = words.life;
    const [keptFlags, setKeptFlags] = useState<ArkKeptFlags>(ARK_KEPT_OFF);
    const keptPlace = animal.area === "zoo" || animal.area === "house" || animal.area === "farm";
    useEffect(() => {
        if (!keptPlace) return;
        let live = true;
        void readArkKeptFlags().then((flags) => live && setKeptFlags(flags));
        return () => {
            live = false;
        };
    }, [keptPlace]);
    const kept = arkKeptLines(animal, keptFlags, facts.born);
    const rows: Array<[string, React.ReactNode]> = [];
    if (facts.generation !== null) rows.push([w.generation, facts.generation > 0 ? fillArkWords(w.generationBorn, {n: facts.generation}) : w.generationArrived]);
    // (An arrival's days aboard are not its age: the life block says that, from its lifespan.)
    if (facts.ageDays !== null && facts.born) rows.push([w.age, ageText(facts.ageDays, words, locale)]);
    // "Condition" is how well kept it is (its thrive band); its hunger and age now go under "Right now".
    if (facts.thrive) rows.push([w.condition, arkThriveWords(facts.thrive, w)]);
    // Right now: how it rests (the sleep lane: "Asleep in its den"), then its hunger and age ("Asleep in its den · Well-fed").
    const now = [rest, facts.condition ? w[facts.condition] : null].filter((part): part is string => Boolean(part));
    if (now.length) rows.push([w.now, now.join(" · ")]);
    // Kept populations (decision 444): what its keeping says (born in a zoo, neutered, eggs collected).
    if (kept.length) rows.push([w.kept, kept.map((line) => w[line]).join(" · ")]);
    if (life?.died) {
        const k = life.died.kind;
        rows.push(isArkLeftKind(k)
            ? [w.left, k === "rehomed" ? w.endedRehomed : k === "to_market" ? w.endedMarket : w.endedMovedZoo]
            : [w.ended, k === "starved" ? w.starved : k === "eaten" ? w.endedEaten : arkIsHuman(animal) ? w.endedOldPeaceful ?? "Died peacefully of old age" : w.endedOld]);
    }
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
