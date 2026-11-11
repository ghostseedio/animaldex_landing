"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {useHeaderAuth} from "@/app/[locale]/(composited)/_components/header-auth-provider";
import ArkPopulationHud from "@/app/[locale]/(composited)/ark/ark-population-hud";
import {useArkLive} from "@/app/[locale]/(composited)/ark/use-ark-live";
import {arkNewArrivals} from "@/lib/ark-live-log";
import ArkShareButton from "@/app/[locale]/(composited)/ark/ark-share";
import type {ArkAnimal, ArkHerdInfo, ArkRegion, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import type {PlayerControlEvent} from "@/ark-scene/control";
import {ARK_CONTROL_SCENE_WORDS, ARK_CONTROL_WORDS} from "@/lib/ark-control-words";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkHerdKeys} from "@/ark-scene/herds";
import {arkIconFallback, arkIconUrl, isArkPlaceholderSlug} from "@/ark-scene/placeholder";
import {arkFocusAnimals, arkLookKey, arkPairStatus, arkPickAnimal, arkPopulation, arkSpeciesKey, type ArkSpeciesRow} from "@/lib/ark-population";
import {cardSaysAsleep, type ArkBehaviourState} from "@/ark-scene/behaviour-state";
import {arkRestIsSleep, arkRestWords} from "@/lib/ark-rest-words";
import {arkBringerLabel, arkJoinLabels, arkSinceWhen, decodeArkEvents, decodeArkLife, isQuietArkReplay, planArkReplay, readArkLastVisit, writeArkLastVisit, type ArkAct, type ArkLife, type ArkReplaySummary} from "@/lib/ark-life";
import {fixtureArkStory} from "@/lib/ark-story";
import {ARK_NO_FOUNDERS, decodeArkFounders, type ArkAnimalFounders, type ArkFounder, type ArkFounders, type ArkFounderStory} from "@/lib/ark-founders";
import {ArkBringerNames, ArkBroughtByFounder, ArkFounderLink, ArkFounderStoryBlock, type ArkBringerEntry} from "@/components/ark/ark-founder-bits";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";
import {arkLineageHasAny, arkLineageLine, arkThriveWords} from "@/lib/ark-thrive";
import ArkAgeAsk from "@/components/ark/ark-age-ask";
import {ARK_SOUND_STORAGE_KEY, initialSoundPreference, storedSoundPreference} from "@/lib/ark-sound";
import ArkSpeciesIcon from "@/app/[locale]/(composited)/ark/ark-species-icon";
import {arkPageSource, type ArkSource} from "@/lib/ark-measure";
import {noteArkArrivalsSeen, startArkSession, trackArk} from "@/lib/ark-measure-client";

export type {ArkWords} from "@/lib/ark-words";

/** Development's fixture: the event log and life stories as the server's reads would answer. */
export type ArkFixtureLife = {events: unknown; lives: Record<string, unknown>};

type Props = {
    locale: string;
    initial: ArkSnapshot | null;
    /**
     * The named founders and shared stories beside the snapshot (founders
     * contract): none while the server's `founder_names` switch is off.
     */
    founders?: ArkFounders;
    /** Development's `?fixture=grow`: the whole fixture, handed out a few at a time. */
    growFrom: ArkSnapshot | null;
    fixture: boolean;
    /**
     * Development's `?snapshot=`: a local file read as the Ark's answer (real data). It stays as read: the 45 s
     * refresh from the live Ark would replace it. The live log still reads the real event log.
     */
    local?: boolean;
    signedIn: boolean;
    words: ArkWords;
    talkTitles: {a: string; an: string};
    modelBase: string;
    /** Development's `?rig=`: another rig folder, or null for no rigs; absent: beside the model set. */
    rigBase?: string | null;
    /** `?focus=`: a species_profile_id or slug to fly to once the Ark is in view. */
    focus?: string | null;
    fixtureLife?: ArkFixtureLife | null;
    /** Development's `?hour=`: the light's hour pinned; otherwise the reader's clock. */
    hours?: number | null;
    /** Development's `?since=`: replay from then, instead of the last visit. */
    since?: string | null;
    /** Development: the fixture's public-debate stories let through, as the server's `public_story` flag would. */
    publicStory?: boolean;
    /** The page's own path ("/ark", "/id/ark"): where a share link points. */
    shareLocalePath?: string;
    /** Development's live feed for the live log and bars (`?fixture=1&feed=1`, `?fixture=live`, `?fixture=grow`). */
    liveFeed?: boolean;
};

/** The contract's refresh: every 45 s while the tab is in front. */
const REFRESH_MS = 45_000;
const GROW_REFRESH_MS = 8_000;
/** Under this many animals the Ark reads as just beginning. */
const BEGINNING_BELOW = 24;
/** The desktop HUD's fold, kept per reader. */
const FOLD_KEY = "ark.hud.folded";
/** The lighter view (A18), when the reader chose: "1" on, "0" off; absent: decided by the device. */
const LITE_KEY = "ark.lite";

/** A tapped animal's life story (`voyage_animal_life_v1`): fetched once per animal per visit. */
type LifeState = {id: string; life: ArkLife | null; loading: boolean};

/** The replay playing now: its acts, which one, and the summary to show after. */
type ReplayState = {acts: ArkAct[]; index: number; summary: string};

function storage(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

/** "a Plains Zebra", "an Arctic Fox", as the Talk titles do it. */
function withArticle(name: string, words: ArkWords): string {
    const an = /^[aeiou]/i.test(name) && !/^(uni|eu|one|use|usu|ura)/i.test(name);
    return (an ? words.replay.an : words.replay.a).replace("{animal}", name);
}

function capitalised(text: string): string {
    return text ? text[0].toLocaleUpperCase() + text.slice(1) : text;
}

/**
 * One quiet line per act: what the server says happened. A birth names its bringers as their @usernames, linked
 * to their profiles (owner, 2026-11-11), or their Voyager labels.
 */
function actCaption(act: ArkAct, words: ArkWords, locale: string, animals: ArkAnimal[], founders: ArkFounders = ARK_NO_FOUNDERS): React.ReactNode {
    const w = words.replay;
    const gone = (name: string, extinct: boolean) => (extinct ? ` · ${fillArkWords(w.lastGone, {animal: name})}` : "");
    switch (act.kind) {
        case "arrival":
            return fillArkWords(w.arrival, {aAnimal: capitalised(withArticle(act.animal.name, words))});
        case "birth": {
            // The event's bringers, else the parents' (the snapshot's labels, and their founders beside it).
            const entries: ArkBringerEntry[] = act.bringers.length
                ? act.bringers.map((label, index) => ({label, founder: act.bringerFounders?.[index] ?? null}))
                : act.parents.flatMap((id) => {
                    const parent = animals.find((animal) => animal.id === id);
                    return parent ? [{label: parent.brought_by.label, founder: founders.animals[id]?.brought_by ?? null}] : [];
                });
            const first = act.young[0];
            // Hatched from a clutch (A9).
            const template = act.fromEgg
                ? act.young.length === 1 ? w.hatchedOne : w.hatchedOther
                : act.young.length === 1 ? w.birthOne : w.birthOther;
            const filled = fillArkWords(template, act.young.length === 1
                ? {aAnimal: capitalised(withArticle(first.name, words))}
                : {count: act.young.length.toLocaleString(locale), animal: first.name});
            if (!entries.some((entry) => entry.founder)) return fillArkWords(filled, {bringers: arkJoinLabels(entries.map((entry) => entry.label), locale, words.formerVoyager)});
            return <ArkFilled template={filled} name="bringers"><ArkBringerNames entries={entries} locale={locale} former={words.formerVoyager} /></ArkFilled>;
        }
        case "laid": {
            const aAnimal = capitalised(withArticle(act.animal.name, words));
            if (act.eggs === 1) return fillArkWords(w.laidOne, {aAnimal});
            return act.eggs ? fillArkWords(w.laidOther, {aAnimal, count: act.eggs.toLocaleString(locale)}) : fillArkWords(w.laidSome, {aAnimal});
        }
        case "meal":
            return fillArkWords(w.meal, {predator: act.predator.name, aPrey: withArticle(act.prey.name, words)})
                + (act.phrase ? ` · ${fillArkWords(w.mealPhrase, {phrase: act.phrase})}` : "")
                + gone(act.prey.name, act.extinct);
        case "death":
            return fillArkWords(act.cause === "starved" ? w.starved : w.death, {animal: act.animal.name}) + gone(act.animal.name, act.extinct);
        case "extinction":
            return fillArkWords(w.extinction, {animal: act.species});
    }
}

/** "3 arrivals, 1 meal, 2 births since Tuesday". */
function replaySummary(summary: ArkReplaySummary, since: Date, words: ArkWords, locale: string): string {
    const w = words.replay;
    const part = (count: number, one: string, other: string) => (count ? counted(count, one, other, locale) : null);
    const parts = [
        part(summary.arrivals, w.arrivalsOne, w.arrivalsOther),
        part(summary.laid, w.laidCountOne, w.laidCountOther),
        part(summary.hatched, w.hatchedCountOne, w.hatchedCountOther),
        part(summary.births - summary.hatched, w.birthsOne, w.birthsOther),
        part(summary.meals, w.mealsOne, w.mealsOther),
        part(summary.deaths, w.deathsOne, w.deathsOther),
        part(summary.starved, w.starvedOne, w.starvedOther),
        part(summary.extinctions, w.extinctionsOne, w.extinctionsOther)
    ].filter((p): p is string => Boolean(p));
    const when = arkSinceWhen(since, new Date(), locale, {today: w.today, yesterday: w.yesterday, weekday: w.weekday, date: w.date});
    return capitalised(fillArkWords(w.summary, {parts: parts.join(", "), when}));
}

const pill = "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 font-sans text-sm font-bold leading-none transition-colors duration-200 [transition-timing-function:cubic-bezier(.2,.8,.2,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none";

function counted(count: number, one: string, other: string, locale: string): string {
    return count === 1 ? one : other.replace("{count}", count.toLocaleString(locale));
}

/** "Talk to a Komodo Dragon", "Talk to an Arctic Fox", as the Talk pages say it. */
function talkTitle(name: string, titles: {a: string; an: string}): string {
    const template = /^[aeiou]/i.test(name) && !/^(uni|eu|one|use|usu|ura)/i.test(name) ? titles.an : titles.a;
    return template.replace("{animal}", name);
}

function sameAnimals(a: ArkSnapshot | null, b: ArkSnapshot | null): boolean {
    if (!a || !b || a.animals.length !== b.animals.length) return false;
    return a.animals.every((animal, i) => animal.id === b.animals[i].id && animal.mine === b.animals[i].mine);
}

export default function ArkView({locale, initial, founders: initialFounders = ARK_NO_FOUNDERS, growFrom, fixture, local = false, signedIn, words, talkTitles, modelBase, rigBase, focus: focusOn = null, fixtureLife = null, hours = null, since = null, publicStory = false, shareLocalePath = "/ark", liveFeed = false}: Props) {
    const {session} = useHeaderAuth();
    const mountRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<ArkSceneHandle | null>(null);
    const [snapshot, setSnapshot] = useState<ArkSnapshot | null>(initial);
    const [founders, setFounders] = useState<ArkFounders>(initialFounders);
    const snapshotRef = useRef(snapshot);
    const [selected, setSelected] = useState<ArkAnimal | null>(null);
    /** What the selected animal is doing now, as the scene animates it (never worked out here from a clock of the page's own). */
    const [selectedState, setSelectedState] = useState<{id: string; state: ArkBehaviourState} | null>(null);
    const onBehaviour = useCallback((id: string, state: ArkBehaviourState) => setSelectedState({id, state}), []);
    /** How the selected animal rests now (the sleep lane's status: "Asleep in its den"), as the scene draws it. */
    const [selectedRest, setSelectedRest] = useState<{id: string; rest: string | null} | null>(null);
    const onRest = useCallback((id: string, rest: string | null) => setSelectedRest({id, rest}), []);
    const [mineOnly, setMineOnly] = useState(false);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    const [arrival, setArrival] = useState<ArkAnimal | null>(null);
    const [region, setRegion] = useState<ArkRegion | null>(null);
    const [folded, setFolded] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [life, setLife] = useState<LifeState | null>(null);
    const livesRef = useRef(new Map<string, ArkLife | null>());
    const [following, setFollowing] = useState(false);
    // Player control (docs/ark/player-control-contract.md): a live server reachable, the animal this viewer controls,
    // the animals anyone controls now (the card's "Exploring now"), a starting request, and the last outcome's line.
    const [liveOn, setLiveOn] = useState(false);
    const [controlling, setControlling] = useState<string | null>(null);
    const [exploringNow, setExploringNow] = useState<ReadonlySet<string>>(new Set());
    const [controlStarting, setControlStarting] = useState(false);
    const [controlNote, setControlNote] = useState<string | null>(null);
    const liveRef = useRef<{url: string; devTickets: boolean} | null>(null);
    const [storyOpen, setStoryOpen] = useState(false);
    const [replay, setReplay] = useState<ReplayState | null>(null);
    const [summary, setSummary] = useState<string | null>(null);
    const replayRef = useRef<{skip: () => void} | null>(null);
    const replayAsked = useRef(false);
    const worldRef = useRef<HTMLDivElement | null>(null);
    // A herd (A14): a species so popular it is drawn as representatives and a count; tapping it gives the species.
    const [herd, setHerd] = useState<ArkHerdInfo | null>(null);
    // The lighter view (A18): the reader's choice (null: the device decides) and whether it is on now.
    const [liteChoice, setLiteChoice] = useState<boolean | null>(null);
    const [liteOn, setLiteOn] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    // Sound (liveliness): always off until a tap. A remembered "on" only means the first tap on the world turns it on.
    const [soundOn, setSoundOn] = useState(false);
    const soundRemembered = useRef(false);
    const [creditsOpen, setCreditsOpen] = useState(false);
    const [credits, setCredits] = useState<Array<{text: string; page: string | null; license: string}>>([]);
    // What a screen reader hears: arrivals, what was selected, the replay's summary.
    const [announcement, setAnnouncement] = useState("");
    // Where focus goes back to when a card opened from the keyboard (the panel's row) closes.
    const returnFocusRef = useRef<HTMLElement | null>(null);
    const lastMetRef = useRef<string | null>(null);
    const herdKeys = useMemo(() => arkHerdKeys(snapshot?.animals ?? []), [snapshot]);
    // The selected herd's row in the panel: its kind's (A1).
    const herdAnimal = herd ? snapshot?.animals.find((animal) => arkLookKey(animal) === herd.key) ?? null : null;
    const herdSpeciesKey = herdAnimal ? arkSpeciesKey(herdAnimal) : null;
    // The live log over the world (owner, 2026-11-11): the Ark's record as it happens, and what is seen near the camera.
    const {hostRef: liveHostRef, observe: observeLive} = useArkLive({sceneRef, snapshotRef, setSnapshot, ready, words, locale, fixture, feed: liveFeed, growFrom, covered: Boolean(selected || herd), reducedMotion});

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(LITE_KEY);
            if (stored === "1" || stored === "0") setLiteChoice(stored === "1");
        } catch {
            // No storage: the device decides.
        }
        const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        if (!query) return;
        setReducedMotion(query.matches);
        const changed = () => {
            setReducedMotion(query.matches);
            sceneRef.current?.setReducedMotion(query.matches);
        };
        query.addEventListener?.("change", changed);
        return () => query.removeEventListener?.("change", changed);
    }, []);

    // Ark measurement (lib/ark-measure): how the reader got here (`?from=capture` from a capture card, `?from=share` from a shared link).
    const sourceRef = useRef<ArkSource>("ark_page");
    const autoSelecting = useRef(false);
    const replaySkipped = useRef(false);
    const onSelect = useCallback((animal: ArkAnimal | null) => {
        setSelected(animal);
        if (animal && !autoSelecting.current) trackArk("ark_animal_tap", {source: sourceRef.current, species_profile_id: animal.species_profile_id, is_mine: animal.mine});
    }, []);
    useEffect(() => {
        // Only a real Ark is a visit: not the "opens soon" page before the migration.
        if (!initial) return;
        try {
            sourceRef.current = arkPageSource(new URLSearchParams(window.location.search).get("from"));
        } catch {
            sourceRef.current = "ark_page";
        }
        return startArkSession(sourceRef.current);
        // One visit per page.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        try {
            if (window.localStorage.getItem(FOLD_KEY) === "1") setFolded(true);
        } catch {
            // No storage (a private window): the HUD starts open.
        }
    }, []);
    const fold = useCallback((next: boolean) => {
        setFolded(next);
        try {
            window.localStorage.setItem(FOLD_KEY, next ? "1" : "0");
        } catch {
            // Remembered for this visit only.
        }
    }, []);

    const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, {day: "numeric", month: "long", year: "numeric"}), [locale]);
    const hasMine = Boolean(snapshot?.animals.some((animal) => animal.mine));
    const showMineToggle = hasMine && (signedIn || Boolean(session.user) || fixture);

    // MARK: The scene

    useEffect(() => {
        const el = mountRef.current;
        if (!el || !initial) return;
        let disposed = false;
        let handle: ArkSceneHandle | null = null;
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        let storedLite: boolean | null = null;
        try {
            const stored = window.localStorage.getItem(LITE_KEY);
            if (stored === "1" || stored === "0") storedLite = stored === "1";
        } catch {
            // The device decides.
        }
        Promise.all([import("@/ark-scene"), import("@/ark-scene/runtime/prebuild")])
            .then(async ([{mountArk}, {prepareArk}]) => {
                if (disposed) return;
                // Runtime: the mount's heavy seeded work (decor, forest, grass, places) in a worker first (docs/ark/runtime.md §7).
                await prepareArk({snapshot: snapshotRef.current ?? initial});
                if (disposed) return;
                // Player control: the live server's address (`?live=` in development; the build's NEXT_PUBLIC_ARK_LIVE_URL),
                // and development's own tickets (`?devticket=1`, ark-live's /dev/ticket) for local runs only.
                const params = new URLSearchParams(window.location.search);
                const devLive = process.env.NODE_ENV !== "production" ? params.get("live") : null;
                const liveUrl = devLive ?? process.env.NEXT_PUBLIC_ARK_LIVE_URL ?? null;
                liveRef.current = liveUrl ? {url: liveUrl, devTickets: Boolean(devLive) && params.get("devticket") === "1"} : null;
                try {
                    handle = mountArk(el, {
                        snapshot: snapshotRef.current ?? initial,
                        ...(liveUrl ? {live: {url: liveUrl, client: "web", words: ARK_CONTROL_SCENE_WORDS}, onControl: onControlEvent} : {}),
                        modelBase,
                        ...(rigBase !== undefined ? {rigBase} : {}),
                        // Development: `?behaviour=0` turns the behaviour schedule off (the placed spots, as before).
                        ...(process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("behaviour") === "0" ? {behaviour: false} : {}),
                        iconUrl: arkIconUrl,
                        onSelect,
                        onBehaviour,
                        onRest,
                        onHerd: setHerd,
                        herdBadge: (count) => fillArkWords(words.herd.badge, {count: count.toLocaleString(locale)}),
                        canvasLabel: words.a11y.scene,
                        resetLabel: words.a11y.resetView,
                        lite: storedLite,
                        onTier: (_tier, lite) => setLiteOn(lite),
                        mineOnly: false,
                        regionLabels: words.regions,
                        reducedMotion,
                        hours,
                        onFollowEnd: () => setFollowing(false),
                        onSoundCredits: () => setCredits(sceneRef.current?.sound().credits ?? []),
                        onReady: () => setReady(true)
                    });
                    sceneRef.current = handle;
                    // "See it in the Ark" (`?focus=`): straight to that species, the reader's own first.
                    const focused = arkPickAnimal(arkFocusAnimals(snapshotRef.current ?? initial, focusOn), null);
                    if (focused) {
                        // The page's own flight to `?focus=` is not a tap.
                        autoSelecting.current = true;
                        handle.select(focused.id);
                        autoSelecting.current = false;
                    }
                    if (process.env.NODE_ENV !== "production") {
                        (window as unknown as {__arkScene?: ArkSceneHandle}).__arkScene = handle;
                        (window as unknown as {__arkSnapshot?: ArkSnapshot | null}).__arkSnapshot = snapshotRef.current ?? initial;
                        // Development: every act in the fixture's log, to play one by hand (`__arkScene.play([__arkActs[i]])`).
                        if (fixtureLife) (window as unknown as {__arkActs?: ArkAct[]}).__arkActs = planArkReplay(decodeArkEvents(fixtureLife.events, snapshotRef.current ?? initial), 1000).acts;
                    }
                } catch (error) {
                    console.warn("[ark] the scene could not start", error);
                    setFailed(true);
                }
            })
            .catch(() => setFailed(true));
        return () => {
            disposed = true;
            handle?.dispose();
            sceneRef.current = null;
        };
        // The scene is built once; later snapshots go through update().
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        sceneRef.current?.setMineOnly(mineOnly);
    }, [mineOnly]);

    // On a phone the tap band covers the foot of the world: the view moves up so the animal stays above it.
    const bandRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const band = bandRef.current;
        const scene = sceneRef.current;
        if (!scene) return;
        if (!(selected || herd) || !band) {
            scene.setViewInset(0);
            return;
        }
        const phone = window.matchMedia("(max-width: 767px)");
        const apply = () => scene.setViewInset(phone.matches ? band.getBoundingClientRect().height : 0);
        apply();
        const observer = new ResizeObserver(apply);
        observer.observe(band);
        phone.addEventListener?.("change", apply);
        return () => {
            observer.disconnect();
            phone.removeEventListener?.("change", apply);
        };
    }, [selected, herd]);

    // MARK: Its life story

    useEffect(() => {
        setStoryOpen(false);
        setFollowing(false);
        if (!selected) {
            setLife(null);
            return;
        }
        const id = selected.id;
        if (fixture) {
            const told = decodeArkLife(fixtureLife?.lives[id]);
            // The fixture's public stories only when asked, as the server's flag would let them through.
            const story = publicStory ? fixtureArkStory(selected, snapshotRef.current?.animals ?? []) : null;
            setLife({id, life: told ? {...told, story_public: story} : null, loading: false});
            return;
        }
        const known = livesRef.current;
        if (known.has(id)) {
            setLife({id, life: known.get(id) ?? null, loading: false});
            return;
        }
        setLife({id, life: null, loading: true});
        const controller = new AbortController();
        fetch(`/api/ark/life/${encodeURIComponent(id)}`, {signal: controller.signal})
            .then((response) => (response.ok ? response.json() : {life: null}))
            .then((body: {life?: unknown}) => {
                // The route decodes it already; decoded again here, as nothing from the network is trusted.
                const told = decodeArkLife(body.life);
                known.set(id, told);
                setLife({id, life: told, loading: false});
            })
            .catch(() => {
                if (!controller.signal.aborted) setLife({id, life: null, loading: false});
            });
        return () => controller.abort();
    }, [selected, fixture, fixtureLife, publicStory]);

    // What a screen reader hears when a card opens (A18).
    useEffect(() => {
        if (selected) setAnnouncement(fillArkWords(words.a11y.selected, {animal: selected.name}));
    }, [selected, words]);
    useEffect(() => {
        if (herd) setAnnouncement(fillArkWords(words.a11y.herdSelected, {animal: herd.name, count: herd.count.toLocaleString(locale)}));
    }, [herd, words, locale]);
    useEffect(() => {
        if (arrival) setAnnouncement(words.newArrival.replace("{animal}", arrival.name));
    }, [arrival, words]);
    useEffect(() => {
        if (summary) setAnnouncement(summary);
    }, [summary]);

    /** A card closed: focus back where it came from (the panel's row), else the world. */
    const closeCard = useCallback(() => {
        const scene = sceneRef.current;
        if (selected) scene?.select(null);
        if (herd) scene?.selectHerd(null);
        setAnnouncement(words.a11y.closed);
        const back = returnFocusRef.current;
        returnFocusRef.current = null;
        if (back && document.contains(back)) back.focus();
        else if (back) mountRef.current?.querySelector("canvas")?.focus();
    }, [selected, herd, words]);

    useEffect(() => {
        try {
            soundRemembered.current = initialSoundPreference(window.localStorage.getItem(ARK_SOUND_STORAGE_KEY), false).remembered;
        } catch {
            // No storage: off, and nothing remembered.
        }
    }, []);
    /** Sound on or off: only ever from this tap (the audio is made inside it). */
    const setSound = (next: boolean) => {
        const scene = sceneRef.current;
        if (!scene) return;
        const ok = scene.setSound(next);
        setSoundOn(next && ok);
        setCredits(scene.sound().credits);
        if (!next) setCreditsOpen(false);
        try {
            window.localStorage.setItem(ARK_SOUND_STORAGE_KEY, storedSoundPreference({on: next && ok, volume: 0.7}));
        } catch {
            // For this visit.
        }
        soundRemembered.current = false;
    };
    /** The first tap on the world, when sound was left on last time: it comes back on with that tap. */
    const worldTapped = () => {
        if (soundRemembered.current && !soundOn) setSound(true);
    };

    const toggleLite = () => {
        const next = !(liteChoice ?? liteOn);
        setLiteChoice(next);
        try {
            window.localStorage.setItem(LITE_KEY, next ? "1" : "0");
        } catch {
            // For this visit.
        }
        sceneRef.current?.setLite(next);
    };

    // MARK: Player control

    const onControlEvent = useCallback((event: PlayerControlEvent) => {
        if (event.kind === "live") setLiveOn(event.available);
        else if (event.kind === "started") {
            setControlStarting(false);
            setControlling(event.animalId);
            setControlNote(null);
        } else if (event.kind === "denied") {
            setControlStarting(false);
            setControlNote(ARK_CONTROL_WORDS.denied[event.reason] ?? ARK_CONTROL_WORDS.denied.other);
        } else if (event.kind === "talk") {
            // Talk (phase 2): that animal's own chat, the server deciding from its Ark id whose it is (visitor rules).
            if (event.slug) window.open(`/talk/${encodeURIComponent(event.slug)}?ark=${encodeURIComponent(event.animalId)}`, "_blank", "noopener");
        } else if (event.kind === "ended") {
            setControlling(null);
            setControlNote(ARK_CONTROL_WORDS.ended[event.reason] ?? ARK_CONTROL_WORDS.ended.player);
        }
    }, []);

    // The card's "Exploring now", while a card is open.
    useEffect(() => {
        if (!selected || !liveOn) return;
        const read = () => setExploringNow(new Set(sceneRef.current?.controlledNow() ?? []));
        read();
        const timer = window.setInterval(read, 2000);
        return () => window.clearInterval(timer);
    }, [selected, liveOn]);

    // Released animals' stored records (the hand-back): read every 30 s and right after this viewer lets go.
    const readReleased = useCallback(async () => {
        const live = liveRef.current;
        if (!live || !sceneRef.current) return;
        try {
            const url = live.devTickets ? `${live.url.replace(/^ws/, "http")}/dev/states?island=wild` : "/api/ark/control-states?island=wild";
            const body = (await (await fetch(url)).json()) as {states?: unknown};
            if (Array.isArray(body.states)) sceneRef.current?.setReleased(body.states as Parameters<ArkSceneHandle["setReleased"]>[0]);
        } catch {
            // (Next time.)
        }
    }, []);
    useEffect(() => {
        if (!ready || !liveRef.current) return;
        void readReleased();
        const timer = window.setInterval(() => void readReleased(), 30_000);
        return () => window.clearInterval(timer);
    }, [ready, readReleased]);
    useEffect(() => {
        if (!controlling) void readReleased();
    }, [controlling, readReleased]);

    useEffect(() => {
        if (!controlNote) return;
        const timer = window.setTimeout(() => setControlNote(null), 5000);
        return () => window.clearTimeout(timer);
    }, [controlNote]);

    /** Control: a ticket for this animal (the database checks it is theirs and within the limits), then the scene starts. */
    const startControl = async (animal: ArkAnimal) => {
        const scene = sceneRef.current;
        const live = liveRef.current;
        if (!scene || !live || controlStarting) return;
        setControlStarting(true);
        setControlNote(null);
        try {
            let result: {ok: boolean; ticket?: string; reason?: string};
            if (live.devTickets) {
                const http = live.url.replace(/^ws/, "http");
                result = await (await fetch(`${http}/dev/ticket?animal=${encodeURIComponent(animal.id)}`)).json();
            } else {
                result = await (await fetch("/api/ark/control-ticket", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({animal_id: animal.id})})).json();
            }
            if (!result.ok || !result.ticket) {
                setControlStarting(false);
                setControlNote(ARK_CONTROL_WORDS.denied[result.reason ?? "other"] ?? ARK_CONTROL_WORDS.denied.other);
                return;
            }
            closeCard();
            if (!scene.startControl(animal.id, result.ticket)) {
                setControlStarting(false);
                setControlNote(ARK_CONTROL_WORDS.denied.other);
            }
        } catch {
            setControlStarting(false);
            setControlNote(ARK_CONTROL_WORDS.denied.network);
        }
    };

    const toggleFollow = () => {
        const scene = sceneRef.current;
        if (!scene || !selected) return;
        const next = !following;
        scene.follow(next ? selected.id : null);
        setFollowing(next);
        if (next) trackArk("ark_follow_animal", {source: sourceRef.current, species_profile_id: selected.species_profile_id});
    };

    // MARK: While you were away

    useEffect(() => {
        if (!ready || replayAsked.current) return;
        replayAsked.current = true;
        const store = storage();
        const last = since ?? readArkLastVisit(store);
        writeArkLastVisit(store, new Date());
        // A first visit shows the Ark as it is, with no replay.
        if (!last) return;
        const from = Date.parse(last);
        const read: Promise<unknown> = fixtureLife
            ? Promise.resolve(fixtureLife.events)
            : fetch(`/api/ark/events?since=${encodeURIComponent(new Date(from).toISOString())}`, {cache: "no-store"})
                .then((response) => (response.ok ? response.json() : {events: []}))
                .then((body: {events?: unknown}) => body.events ?? [])
                .catch(() => []);
        void read.then(async (raw) => {
            const events = decodeArkEvents(raw, snapshotRef.current).filter((event) => Date.parse(event.at) > from);
            const plan = planArkReplay(events);
            if (isQuietArkReplay(plan.summary)) return;
            const line = replaySummary(plan.summary, new Date(from), words, locale);
            const scene = sceneRef.current;
            // `?focus=` (the capture page's link) goes straight to its animal, and reduced motion means no acting out: just the line.
            const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
            if (!scene || focusOn || still || !plan.acts.length) {
                setSummary(line);
                return;
            }
            // Runtime: the departed animals placed in the places worker first, so the replay's start does not build the
            // map's sampler on the main thread (~1 s on a phone).
            await scene.prepareReplay?.(plan.acts);
            if (sceneRef.current !== scene) return;
            setReplay({acts: plan.acts, index: 0, summary: line});
            replaySkipped.current = false;
            const run = scene.play(plan.acts, {onAct: (index) => setReplay((now) => (now ? {...now, index} : now))});
            replayRef.current = run;
            void run.done.then(() => {
                trackArk("ark_replay_viewed", {events_count: events.length, skipped: replaySkipped.current});
                replayRef.current = null;
                setReplay(null);
                setSummary(line);
            });
        });
    }, [ready, since, fixtureLife, focusOn, words, locale]);

    // The reader's own animals aboard, once the world is on screen: their arrival seen (and again after a refresh brings one).
    useEffect(() => {
        if (ready && snapshot && !fixture) noteArkArrivalsSeen(snapshot.animals, sourceRef.current);
    }, [ready, snapshot, fixture]);

    useEffect(() => {
        if (!summary) return;
        const timer = setTimeout(() => setSummary(null), 14000);
        return () => clearTimeout(timer);
    }, [summary]);

    // MARK: Refresh

    const apply = useCallback((next: ArkSnapshot) => {
        observeLive(next);
        const before = snapshotRef.current;
        if (sameAnimals(before, next)) return;
        // The notice is for arrivals only: the young born on the Ark are the live log's (`arkNewArrivals`).
        const fresh = arkNewArrivals(before?.animals ?? [], next.animals);
        snapshotRef.current = next;
        setSnapshot(next);
        sceneRef.current?.update(next);
        if (before && fresh.length) setArrival(fresh[fresh.length - 1]);
    }, [observeLive]);

    useEffect(() => {
        if ((fixture && !growFrom) || liveFeed || local) return;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let lastRead = Date.now();
        let stopped = false;
        const every = growFrom ? GROW_REFRESH_MS : REFRESH_MS;

        const read = async () => {
            lastRead = Date.now();
            if (growFrom) {
                const current = snapshotRef.current?.animals.length ?? 0;
                if (current >= growFrom.animals.length) return;
                const animals = growFrom.animals.slice(0, current + 6);
                apply({
                    ...growFrom,
                    animals,
                    counts: {animals: animals.length, species: new Set(animals.map((a) => a.species_profile_id)).size, founders: new Set(animals.map((a) => a.brought_by.label)).size}
                });
                return;
            }
            try {
                const response = await fetch("/api/ark/voyage", {cache: "no-store"});
                if (!response.ok) return;
                const body = await response.json() as {snapshot?: unknown; founders?: unknown};
                const next = decodeArkSnapshot(body.snapshot);
                if (next && !stopped) {
                    apply(next);
                    // A story shared (or a name shown) can change with the same animals aboard.
                    const named = decodeArkFounders(body.founders);
                    setFounders((current) => (JSON.stringify(current) === JSON.stringify(named) ? current : named));
                }
            } catch {
                // Offline: the Ark stays as it was until the next refresh.
            }
        };
        const schedule = () => {
            if (stopped) return;
            timer = setTimeout(async () => {
                if (document.visibilityState === "visible") await read();
                schedule();
            }, every);
        };
        const onVisible = () => {
            if (document.visibilityState === "visible" && Date.now() - lastRead >= every) void read();
        };
        document.addEventListener("visibilitychange", onVisible);
        schedule();
        return () => {
            stopped = true;
            if (timer) clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [apply, fixture, growFrom, liveFeed, local]);

    useEffect(() => {
        if (!arrival) return;
        const timer = setTimeout(() => setArrival(null), 9000);
        return () => clearTimeout(timer);
    }, [arrival]);

    // MARK: Words

    const status = (() => {
        if (!snapshot) return words.unavailable;
        const {animals, species, founders} = snapshot.counts;
        if (animals === 0) return words.empty;
        const values = {
            animals: counted(animals, words.animalsOne, words.animalsOther, locale),
            species: counted(species, words.speciesOne, words.speciesOther, locale),
            founders: counted(founders, words.foundersOne, words.foundersOther, locale)
        };
        const template = animals < BEGINNING_BELOW ? words.beginning : words.aboard;
        return template.replace(/\{(\w+)\}/g, (match, key: keyof typeof values) => values[key] ?? match);
    })();

    // On a phone the HUD sits under the world: a tap there brings the world back into view.
    const showWorld = () => {
        const world = worldRef.current;
        if (!world || !window.matchMedia("(max-width: 767px)").matches) return;
        const top = world.getBoundingClientRect().top;
        if (top < 0 || top > window.innerHeight * 0.4) window.scrollTo({top: window.scrollY + top - 64, behavior: "smooth"});
    };

    const focus = (next: ArkRegion | null) => {
        setRegion(next);
        sceneRef.current?.focusRegion(next);
        showWorld();
    };

    const pickSpecies = (row: ArkSpeciesRow) => {
        // From the panel: focus comes back to its row when the card closes.
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setRegion(null);
        // A herd (A14): the species, with its count (a kind's row: its herd of a breed, A1).
        const herdKey = [row.key, ...row.breeds.map((breed) => breed.key)].find((key) => herdKeys.has(key));
        if (herdKey && sceneRef.current?.selectHerd(herdKey)) {
            showWorld();
            return;
        }
        const animal = arkPickAnimal(row.animals, selected?.id ?? null);
        if (!animal) return;
        sceneRef.current?.select(animal.id);
        showWorld();
    };

    /** "Meet one" on a herd's card: the next of its animals, the reader's own first. */
    const meetOne = () => {
        if (!herd || !snapshot) return;
        const members = snapshot.animals.filter((animal) => arkLookKey(animal) === herd.key).sort((a, b) => b.arrived_at.localeCompare(a.arrived_at));
        const animal = arkPickAnimal(members, lastMetRef.current);
        if (!animal) return;
        lastMetRef.current = animal.id;
        sceneRef.current?.select(animal.id);
    };

    const beginning = Boolean(snapshot && snapshot.counts.animals < BEGINNING_BELOW);

    return (
        <div className="-mt-8">
            {/* Band 1: what this is, and how many are aboard. */}
            <section aria-labelledby="ark-title" className="border-b border-line-200 bg-canvas-950">
                <div className="mx-auto w-full max-w-[86rem] px-4 py-5 md:px-8 md:py-7">
                    <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <p className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.16em] text-primary-300">{words.eyebrow}</p>
                        <div className="ml-auto flex shrink-0 items-center gap-2">
                        {snapshot ? (
                            <button
                                type="button"
                                role="switch"
                                aria-checked={liteChoice ?? liteOn}
                                aria-describedby="ark-lite-hint"
                                onClick={toggleLite}
                                title={words.lite.hint}
                                className={`${pill} min-h-9 shrink-0 border px-3 text-[13px] ${(liteChoice ?? liteOn) ? "border-primary-400/70 text-primary-100" : "border-line-100 text-ink-200 hover:border-primary-400"}`}
                            >
                                <span aria-hidden="true" className={`relative inline-block h-4 w-7 rounded-full transition-colors motion-reduce:transition-none ${(liteChoice ?? liteOn) ? "bg-primary-400/80" : "bg-white/20"}`}>
                                    <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-[left] duration-200 motion-reduce:transition-none ${(liteChoice ?? liteOn) ? "left-[0.875rem]" : "left-0.5"}`} />
                                </span>
                                {words.lite.label}
                                {liteChoice === null && liteOn ? <span className="hidden text-[11px] font-semibold text-ink-400 sm:inline">· {words.lite.auto}</span> : null}
                                <span id="ark-lite-hint" className="sr-only">{words.lite.hint}</span>
                            </button>
                        ) : null}
                        {snapshot ? (
                            <button
                                type="button"
                                role="switch"
                                aria-checked={soundOn}
                                aria-describedby="ark-sound-hint"
                                onClick={() => setSound(!soundOn)}
                                title={words.sound.hint}
                                className={`${pill} min-h-9 shrink-0 border px-3 text-[13px] ${soundOn ? "border-primary-400/70 text-primary-100" : "border-line-100 text-ink-200 hover:border-primary-400"}`}
                            >
                                <span aria-hidden="true" className={`relative inline-block h-4 w-7 rounded-full transition-colors motion-reduce:transition-none ${soundOn ? "bg-primary-400/80" : "bg-white/20"}`}>
                                    <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-[left] duration-200 motion-reduce:transition-none ${soundOn ? "left-[0.875rem]" : "left-0.5"}`} />
                                </span>
                                {words.sound.label}
                                <span id="ark-sound-hint" className="sr-only">{words.sound.hint}</span>
                            </button>
                        ) : null}
                        {soundOn ? (
                            <button type="button" aria-expanded={creditsOpen} aria-controls="ark-sound-credits" onClick={() => setCreditsOpen((open) => !open)} className="min-h-9 shrink-0 px-1 text-[12px] font-semibold text-ink-300 underline-offset-4 hover:text-white hover:underline">
                                {words.sound.credits}
                            </button>
                        ) : null}
                        {showMineToggle ? (
                            <button
                                type="button"
                                role="switch"
                                aria-checked={mineOnly}
                                onClick={() => setMineOnly((value) => !value)}
                                className={`${pill} min-h-9 shrink-0 border px-4 text-[13px] ${mineOnly ? "border-primary-400 bg-primary-400 text-canvas-950 hover:bg-primary-100" : "border-line-100 text-ink-100 hover:border-primary-400"}`}
                            >
                                <span aria-hidden="true" className={`relative inline-block h-4 w-7 rounded-full transition-colors ${mineOnly ? "bg-canvas-950/80" : "bg-white/20"}`}>
                                    <span className={`absolute top-0.5 h-3 w-3 rounded-full transition-[left] duration-200 ${mineOnly ? "left-[0.875rem] bg-primary-400" : "left-0.5 bg-white"}`} />
                                </span>
                                {words.myAnimals}
                            </button>
                        ) : null}
                        </div>
                    </div>
                    {soundOn && creditsOpen ? (
                        <div id="ark-sound-credits" className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-line-200 bg-canvas-900/80 px-3 py-2 text-[12px] leading-relaxed text-ink-200">
                            {credits.length ? (
                                <ul>
                                    {credits.map((line) => (
                                        <li key={line.text}>{line.page ? <a href={line.page} target="_blank" rel="noreferrer noopener" className="underline-offset-2 hover:underline">{line.text}</a> : line.text}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p>{words.sound.empty}</p>
                            )}
                        </div>
                    ) : null}
                    <h1 id="ark-title" className="mt-1 max-w-4xl font-display text-[1.65rem] font-extrabold leading-[1.05] tracking-tight text-white [text-wrap:balance] sm:text-3xl md:text-[2.5rem]">
                        {words.title}
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-ink-200 md:text-base" aria-live="polite">{status}</p>
                    {/* "Name now, ask age after": once, inline, for someone signed in whose @username shows and whose year isn't stored. */}
                    {signedIn || Boolean(session.user) ? <ArkAgeAsk words={words.age} className="mt-4 max-w-xl" /> : <ArkAgeAskDev words={words.age} />}
                </div>
            </section>

            {/* What a screen reader hears as it happens (A18): arrivals, a card opening, the replay's summary. */}
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
            {snapshot ? (
                <a href="#ark-aboard" className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:m-2 focus:rounded-full focus:bg-primary-400 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-canvas-950">
                    {words.a11y.skipToList}
                </a>
            ) : null}

            {/* Band 2: the world, edge to edge, and who is aboard (beside it on a desktop, under it on a phone). */}
            <div className="w-full md:flex md:h-[max(30rem,min(calc(100svh-18.5rem),56rem))]">
            <section ref={worldRef} aria-label={words.eyebrow} className="relative h-[max(26rem,min(66svh,48rem))] w-full overflow-hidden bg-[#ecdcc4] md:h-full md:min-w-0 md:flex-1">
                {snapshot && !failed ? <div ref={mountRef} className="absolute inset-0" onPointerUp={worldTapped} /> : null}
                {snapshot && !failed ? <div ref={liveHostRef} className="pointer-events-none absolute inset-0" /> : null}

                {snapshot && !failed && !ready ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#ecdcc4]">
                        <p className="animate-pulse text-sm font-semibold text-[#5b5340] motion-reduce:animate-none">{words.loading}</p>
                    </div>
                ) : null}

                {!snapshot ? (
                    <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
                        <p className="max-w-md font-display text-xl font-bold text-[#3d3829]">{words.unavailable}</p>
                    </div>
                ) : null}

                {failed && snapshot ? (
                    <div className="absolute inset-0 overflow-y-auto bg-canvas-950 px-4 py-6 md:px-8">
                        <p className="text-sm text-ink-200">{words.noWebgl}</p>
                        {/* By species with its count (a thousand of one kind is one row, A14). */}
                        <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                            {arkPopulation(snapshot).regions.flatMap((group) => group.species).map((row) => (
                                <li key={row.key} className="flex items-baseline justify-between gap-3 border-b border-line-300 py-2 text-sm">
                                    <span className="min-w-0"><span className="font-bold text-white">{row.name}</span> <span className="text-ink-400">· {words.zones[row.zone]}</span></span>
                                    <span className="shrink-0 tabular-nums text-ink-200">{fillArkWords(words.hud.countStatus, {count: row.count.toLocaleString(locale), status: words.hud[row.status]})}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}

                {replay ? (
                    <div role="status" aria-live="polite" className="rows-in absolute inset-x-0 top-0 z-[1] border-b border-line-200 bg-canvas-950/[0.9] backdrop-blur-xl">
                        <div className="mx-auto flex w-full max-w-[86rem] items-center gap-3 px-4 py-2.5 md:px-8">
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-300">
                                    {words.replay.title}
                                    <span className="ml-2 font-semibold normal-case tracking-normal text-ink-400">{fillArkWords(words.replay.progress, {n: replay.index + 1, total: replay.acts.length})}</span>
                                </p>
                                <p key={replay.index} className="rows-in mt-0.5 text-sm font-semibold leading-snug text-white [text-wrap:balance]">{actCaption(replay.acts[replay.index], words, locale, snapshot?.animals ?? [], founders)}</p>
                            </div>
                            <button type="button" onClick={() => {
                                replaySkipped.current = true;
                                replayRef.current?.skip();
                            }} className={`${pill} min-h-9 shrink-0 border border-line-100 px-4 text-[13px] text-ink-100 hover:border-primary-400`}>
                                {words.replay.skip}
                            </button>
                        </div>
                    </div>
                ) : null}

                {summary && !replay && !selected && !herd ? (
                    <div className="rows-in absolute inset-x-0 top-0 z-[1] border-b border-line-200 bg-canvas-950/[0.9] backdrop-blur-xl">
                        <div className="mx-auto flex w-full max-w-[86rem] items-center gap-3 px-4 py-2.5 md:px-8">
                            <p className="min-w-0 flex-1 text-sm leading-snug text-ink-100">
                                <span className="mr-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-300">{words.replay.title}</span>
                                <span className="font-semibold text-white">{summary}</span>
                                {reducedMotion ? <span className="mt-0.5 block text-[12px] text-ink-400">{words.a11y.motionReduced}</span> : null}
                            </p>
                            <button type="button" onClick={() => setSummary(null)} aria-label={words.replay.dismiss} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-200 hover:bg-white/10 hover:text-white">
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                            </button>
                        </div>
                    </div>
                ) : null}

                {arrival && !selected && !herd && !replay && !summary ? (
                    <div className="rows-in absolute inset-x-0 top-0 border-b border-line-200 bg-canvas-950/[0.92] backdrop-blur-xl">
                        <div className="mx-auto flex w-full max-w-[86rem] items-center justify-between gap-3 px-4 py-2.5 md:px-8">
                            <p className="min-w-0 truncate text-sm font-semibold text-white">{words.newArrival.replace("{animal}", arrival.name)}</p>
                            <button type="button" onClick={() => sceneRef.current?.select(arrival.id)} className="shrink-0 text-sm font-bold text-primary-300 underline-offset-4 hover:underline">
                                {words.showMe}
                            </button>
                        </div>
                    </div>
                ) : null}

                {controlNote ? (
                    <p role="status" className="pointer-events-none absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-full bg-canvas-950/80 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur" data-testid="ark-control-note">
                        {controlNote}
                    </p>
                ) : null}
                {selected && !controlling ? (
                    <ArkAnimalBand
                        bandRef={bandRef}
                        animal={selected}
                        words={words}
                        locale={locale}
                        talk={talkTitle(selected.name, talkTitles)}
                        arrived={dateFormat.format(new Date(selected.arrived_at))}
                        life={life?.id === selected.id ? life : null}
                        founders={founders.animals[selected.id] ?? null}
                        arkDay={snapshot?.ark_day ?? null}
                        asleep={cardSaysAsleep(selectedState?.id === selected.id ? selectedState.state : sceneRef.current?.behaviour(selected.id))}
                        rest={selectedRest?.id === selected.id ? selectedRest.rest : sceneRef.current?.rest(selected.id) ?? null}
                        following={following}
                        onFollow={toggleFollow}
                        control={
                            liveOn && selected.mine && !controlling && sceneRef.current?.canControl(selected.id)
                                ? {label: controlStarting ? ARK_CONTROL_WORDS.starting : ARK_CONTROL_WORDS.control, busy: controlStarting, onControl: () => void startControl(selected)}
                                : null
                        }
                        exploringNow={exploringNow.has(selected.id) && selected.brought_by.named ? ARK_CONTROL_WORDS.exploringNow : null}
                        storyOpen={storyOpen}
                        onStory={() => setStoryOpen((open) => !open)}
                        onClose={closeCard}
                        focusOnOpen={Boolean(returnFocusRef.current)}
                        share={{
                            localePath: shareLocalePath,
                            text: fillArkWords(words.share.textAnimal, {animal: selected.name, count: (snapshot?.animals.filter((animal) => arkSpeciesKey(animal) === arkSpeciesKey(selected)).length ?? 1).toLocaleString(locale)})
                        }}
                    />
                ) : null}

                {herd && !selected ? (
                    <ArkHerdBand
                        bandRef={bandRef}
                        herd={herd}
                        zone={snapshot?.animals.find((animal) => arkLookKey(animal) === herd.key)?.zone ?? null}
                        words={words}
                        locale={locale}
                        talk={isArkPlaceholderSlug(herd.slug) ? null : talkTitle(herd.name, talkTitles)}
                        onMeet={meetOne}
                        onClose={closeCard}
                        focusOnOpen={Boolean(returnFocusRef.current)}
                    />
                ) : null}
            </section>

            {snapshot ? (
                <ArkPopulationHud
                    snapshot={snapshot}
                    words={words}
                    locale={locale}
                    selectedKey={selected ? arkSpeciesKey(selected) : herdSpeciesKey}
                    herdKeys={herdKeys}
                    arrivalKey={arrival ? arkSpeciesKey(arrival) : null}
                    region={region}
                    folded={folded}
                    onFold={fold}
                    expanded={expanded}
                    onExpand={setExpanded}
                    beginning={beginning}
                    onSpecies={pickSpecies}
                    onRegion={focus}
                    shareLocalePath={shareLocalePath}
                />
            ) : null}
            </div>

            {/* Band 3: how an animal comes aboard, and the way to start. */}
            <section aria-labelledby="ark-how" className="border-b border-line-200">
                <div className="mx-auto grid w-full max-w-[86rem] grid-cols-1 items-center gap-6 px-4 py-10 md:grid-cols-[minmax(0,1fr)_auto] md:px-8 md:py-14">
                    <div className="max-w-2xl">
                        <h2 id="ark-how" className="font-display text-2xl font-extrabold tracking-tight text-white md:text-3xl">{words.howTitle}</h2>
                        <p className="mt-3 text-base leading-relaxed text-ink-200">{words.howBody}</p>
                    </div>
                    <Link href="/talk" className={`${pill} bg-primary-400 text-canvas-950 hover:bg-primary-100 md:min-h-12 md:px-7 md:text-base`}>
                        {words.howCta}
                        <span aria-hidden="true">→</span>
                    </Link>
                </div>
            </section>
        </div>
    );
}

type BandProps = {
    bandRef: React.Ref<HTMLDivElement>;
    animal: ArkAnimal;
    words: ArkWords;
    locale: string;
    talk: string;
    arrived: string;
    life: LifeState | null;
    /** This animal's founders from the snapshot (shown before its life story reads). */
    founders: ArkAnimalFounders | null;
    arkDay: number | null;
    asleep: boolean;
    /** How it rests now (`sleep.ts` restStatus), shown in plain words in its state chip. */
    rest: string | null;
    following: boolean;
    onFollow: () => void;
    /** Player control: the Control button on the viewer's own animal while a live server is reachable (else null). */
    control: {label: string; busy: boolean; onControl: () => void} | null;
    /**
     * "Exploring now" (D11): only on the card, only for a named founder's animal (it says a named person is online);
     * the name switch, teens and no-handle accounts are never named, so it never shows for them.
     */
    exploringNow: string | null;
    storyOpen: boolean;
    onStory: () => void;
    onClose: () => void;
    /** Opened from the keyboard (the panel's row): focus moves to the card's heading. */
    focusOnOpen: boolean;
    /** Share this animal's kind on the Ark: the page's path and the words that go with the link. */
    share: {localePath: string; text: string};
};

/** A card's heading takes focus when it opened from the keyboard; Escape inside the card closes it (A18). */
function useCardFocus(key: string, focusOnOpen: boolean, onClose: () => void) {
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

/** What the band knows about an animal's life: the life story when the server sent one, else the snapshot's v2 fields. */
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
        bringers: arkJoinLabels(born ? parentsBy : [life?.origin.kind === "arrived" ? life.origin.brought_by ?? animal.brought_by.label : animal.brought_by.label], locale, former),
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
 * The tapped animal, as a band along the scene's foot: who it is, its life
 * in a line (and in full under "Life story", in the band itself), and the
 * next moves: talking to it, or following it.
 */
function ArkAnimalBand({bandRef, animal, words, locale, talk, arrived, life: state, founders: named, arkDay, asleep, rest, following, onFollow, control, exploringNow, storyOpen, onStory, onClose, focusOnOpen, share}: BandProps) {
    const life = state?.life ?? null;
    const {headingRef, onKeyDown} = useCardFocus(animal.id, focusOnOpen, onClose);
    // A species with no Ark model (A13): the stand-in figure, said so, and no Talk page to send to.
    const placeholder = animal.placeholder === true || isArkPlaceholderSlug(animal.model_slug);
    const facts = lifeFacts(animal, life, arkDay, locale, words.formerVoyager, named);
    const restChip = arkRestWords(rest, words.life.rest) ?? (asleep ? words.life.asleep : null);
    const restNight = Boolean(restChip) && (arkRestIsSleep(rest) || (!rest && asleep));
    // Its condition in plain words first ("In prime condition", "In good condition", "Ordinary"): the only place a band shows as text.
    const thriveChip = facts.thrive ? arkThriveWords(facts.thrive, words.life) : null;
    const chips = [
        thriveChip,
        facts.generation !== null && facts.generation > 0 ? fillArkWords(words.life.generationShort, {n: facts.generation}) : null,
        facts.ageDays !== null ? ageText(facts.ageDays, words, locale) : null,
        facts.condition ? words.life[facts.condition] : null,
        // Right now: how it rests in plain words ("Asleep in its den", "Keeping watch"), else "Asleep now" or nothing.
        restChip,
        exploringNow
    ].filter((chip): chip is string => Boolean(chip));
    const hasLife = Boolean(life) || animal.origin !== undefined;
    return (
        <div ref={bandRef} onKeyDown={onKeyDown} className="rows-in absolute inset-x-0 bottom-0 border-t border-line-200 bg-canvas-950/[0.95] backdrop-blur-xl" role="region" aria-labelledby={`ark-card-${animal.id}`}>
            <div className="mx-auto w-full max-w-[86rem] px-4 py-3.5 md:px-8 md:py-4">
                <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-start gap-x-3 md:grid-cols-[4rem_minmax(0,1fr)_auto] md:gap-x-5">
                    <span className="flex h-[3.25rem] w-[3.25rem] items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7] md:h-16 md:w-16">
                        <ArkSpeciesIcon src={arkIconUrl(animal.model_slug)} size={64} className="h-[82%] w-[82%] object-contain" />
                    </span>
                    <div className="min-w-0">
                        <h2 id={`ark-card-${animal.id}`} ref={headingRef} tabIndex={-1} className="truncate font-display text-lg font-extrabold leading-tight text-white outline-none focus-visible:underline md:text-xl">{animal.name}</h2>
                        {/* On a phone the open life story needs the room: the name in Latin and the chips (said again below) step aside. */}
                        {animal.scientific_name ? <p className={`truncate text-[13px] italic text-ink-400 ${storyOpen ? "hidden md:block" : ""}`}>{animal.scientific_name}</p> : null}
                        <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px]">
                            <div className="flex gap-1.5"><dt className="text-ink-400">{words.lives}</dt><dd className="font-semibold text-ink-100">{words.zones[animal.zone]}</dd></div>
                            {facts.born && facts.anyFounder ? (
                                <div className="flex min-w-0 gap-1.5"><dt className="shrink-0 text-ink-400">{words.life.bornTo}</dt><dd className="min-w-0 font-semibold text-ink-100"><ArkFilled template={words.life.bornToValue} name="bringers"><ArkBringerNames entries={facts.bringerEntries} locale={locale} former={words.formerVoyager} /></ArkFilled></dd></div>
                            ) : facts.born ? (
                                <div className="flex min-w-0 gap-1.5"><dt className="shrink-0 text-ink-400">{words.life.bornTo}</dt><dd className="min-w-0 font-semibold text-ink-100">{fillArkWords(words.life.bornToValue, {bringers: facts.bringers})}</dd></div>
                            ) : facts.founder ? (
                                // A named founder (founders contract, section 5): "Brought by {name}", linked to their profile, with their photo.
                                <div className="flex min-w-0 gap-1.5"><dt className="sr-only">{words.broughtBy}</dt><dd className="min-w-0"><ArkBroughtByFounder template={words.founders.card.broughtBy} founder={facts.founder} /></dd></div>
                            ) : (
                                <div className="flex gap-1.5"><dt className="text-ink-400">{words.broughtBy}</dt><dd className="font-semibold text-ink-100">{facts.bringers}</dd></div>
                            )}
                            <div className="flex gap-1.5"><dt className="text-ink-400">{facts.hatched ? words.life.hatched : facts.born ? words.life.born : words.arrived}</dt><dd className="font-semibold text-ink-100">{arrived}</dd></div>
                            {/* Its family line, credited to its bringers (anonymous by default): "2 young, 1 grandchild". */}
                            {arkLineageHasAny(facts.lineage) ? (
                                <div className="flex min-w-0 gap-1.5" data-testid="ark-card-lineage"><dt className="shrink-0 text-ink-400">{words.life.lineage}</dt><dd className="min-w-0 font-semibold text-ink-100">{arkLineageLine(facts.lineage, words.life, locale)}</dd></div>
                            ) : null}
                        </dl>
                        {chips.length ? (
                            <p className={`mt-1.5 flex-wrap gap-1.5 ${storyOpen ? "hidden md:flex" : "flex"}`}>
                                {chips.map((chip) => (
                                    <span key={chip} data-testid={chip === thriveChip ? "ark-card-thrive" : undefined} data-thrive={chip === thriveChip ? facts.thrive ?? undefined : undefined} className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${chip === thriveChip && facts.thrive !== "ordinary" ? "bg-primary-400/15 text-primary-200" : chip === words.life.hungry ? "bg-[#5a3a1e] text-[#ffd8a8]" : chip === restChip && restNight ? "bg-[#26304a] text-[#c9d6ff]" : "bg-white/[0.08] text-ink-100"}`}>{chip}</span>
                                ))}
                            </p>
                        ) : null}
                        <ArkStoryLine state={state} born={facts.born} hatched={facts.hatched} story={facts.story} capture={facts.source === "capture"} founder={facts.founder} words={words} />
                        {placeholder ? <p className="mt-1 text-[12px] leading-snug text-ink-400">{words.life.placeholder}</p> : null}
                    </div>
                    <button type="button" onClick={onClose} aria-label={words.close} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-200 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                </div>

                {storyOpen ? <ArkLifeStory animal={animal} life={life} facts={facts} words={words} locale={locale} rest={arkRestWords(rest, words.life.rest)} /> : null}

                <div className="mt-3 flex flex-wrap items-center gap-2 md:pl-[5.25rem]">
                    {placeholder ? null : (
                        <Link href={`/talk/${animal.model_slug}`} className={`${pill} w-full bg-primary-400 text-canvas-950 hover:bg-primary-100 sm:w-auto`}>
                            {talk}
                            <span aria-hidden="true">→</span>
                        </Link>
                    )}
                    {control ? (
                        <button type="button" onClick={control.onControl} disabled={control.busy} data-testid="ark-card-control" className={`${pill} flex-1 border border-primary-400 px-4 text-primary-100 hover:bg-primary-400/15 disabled:opacity-60 sm:flex-none`}>
                            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="10" cy="10" r="7.2" />
                                <path d="M10 6.2v7.6M6.2 10h7.6" />
                            </svg>
                            {control.label}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        aria-pressed={following}
                        onClick={onFollow}
                        title={following ? words.life.followHint : undefined}
                        className={`${pill} flex-1 border px-4 sm:flex-none ${following ? "border-primary-400 bg-primary-400/15 text-primary-100" : "border-line-100 text-ink-100 hover:border-primary-400"}`}
                    >
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                            <circle cx="10" cy="10" r="3" fill={following ? "currentColor" : "none"} />
                            <path d="M10 1.8v3M10 15.2v3M1.8 10h3M15.2 10h3" />
                        </svg>
                        {words.life.follow}
                    </button>
                    {hasLife ? (
                        <button type="button" aria-expanded={storyOpen} onClick={onStory} className={`${pill} flex-1 border border-line-100 px-4 text-ink-100 hover:border-primary-400 sm:flex-none`}>
                            {storyOpen ? words.life.hideStory : words.life.showStory}
                            <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${storyOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l5-5 5 5" /></svg>
                        </button>
                    ) : null}
                    <ArkShareButton
                        target="tap_card"
                        look="pill"
                        localePath={share.localePath}
                        slug={animal.model_slug}
                        title={animal.name}
                        text={share.text}
                        label={words.share.shareAnimal}
                        copied={words.share.copied}
                        className={`${pill} w-11 shrink-0 border border-line-100 !px-0 text-ink-100 hover:border-primary-400 disabled:opacity-60 sm:w-auto sm:!px-4`}
                    />
                </div>
            </div>
        </div>
    );
}

/**
 * A herd's card (A14): the species, how many are aboard and how many are
 * the reader's, its pair status, and the way to meet one of them.
 */
function ArkHerdBand({bandRef, herd, zone, words, locale, talk, onMeet, onClose, focusOnOpen}: {bandRef: React.Ref<HTMLDivElement>; herd: ArkHerdInfo; zone: ArkAnimal["zone"] | null; words: ArkWords; locale: string; talk: string | null; onMeet: () => void; onClose: () => void; focusOnOpen: boolean}) {
    const {headingRef, onKeyDown} = useCardFocus(herd.key, focusOnOpen, onClose);
    const count = herd.count.toLocaleString(locale);
    const status = arkPairStatus(herd.count);
    return (
        <div ref={bandRef} onKeyDown={onKeyDown} className="rows-in absolute inset-x-0 bottom-0 border-t border-line-200 bg-canvas-950/[0.95] backdrop-blur-xl" role="region" aria-labelledby="ark-herd-title">
            <div className="mx-auto w-full max-w-[86rem] px-4 py-3.5 md:px-8 md:py-4">
                <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-start gap-x-3 md:grid-cols-[4rem_minmax(0,1fr)_auto] md:gap-x-5">
                    <span className="flex h-[3.25rem] w-[3.25rem] items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7] md:h-16 md:w-16">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={arkIconUrl(herd.slug)} alt="" onError={arkIconFallback} width={64} height={64} className="h-[82%] w-[82%] object-contain" />
                    </span>
                    <div className="min-w-0">
                        <h2 id="ark-herd-title" ref={headingRef} tabIndex={-1} className="truncate font-display text-lg font-extrabold leading-tight text-white outline-none focus-visible:underline md:text-xl">{fillArkWords(words.herd.title, {animal: herd.name})}</h2>
                        <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px]">
                            <div className="flex gap-1.5"><dt className="sr-only">{words.hud.statAnimals}</dt><dd className="font-display text-base font-extrabold tabular-nums text-white">{fillArkWords(words.herd.count, {count})}</dd></div>
                            {zone ? <div className="flex gap-1.5"><dt className="text-ink-400">{words.lives}</dt><dd className="font-semibold text-ink-100">{words.zones[zone]}</dd></div> : null}
                        </dl>
                        <p className="mt-1.5 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[12px] font-semibold text-ink-100">{words.hud[status]}</span>
                            {herd.mine > 0 ? <span className="rounded-full bg-primary-400/15 px-2 py-0.5 text-[12px] font-semibold text-primary-200">{herd.mine === 1 ? words.herd.mineOne : fillArkWords(words.herd.mineOther, {count: herd.mine.toLocaleString(locale)})}</span> : null}
                        </p>
                        <p className="mt-1.5 text-[13px] leading-snug text-ink-200">{words.herd.note}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label={words.close} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-200 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 md:pl-[5.25rem]">
                    <button type="button" onClick={onMeet} className={`${pill} flex-1 bg-primary-400 text-canvas-950 hover:bg-primary-100 sm:flex-none`}>
                        {words.herd.meet}
                    </button>
                    {talk ? (
                        <Link href={`/talk/${herd.slug}`} className={`${pill} flex-1 border border-line-100 px-4 text-ink-100 hover:border-primary-400 sm:flex-none`}>
                            {talk}
                            <span aria-hidden="true">→</span>
                        </Link>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

/** The life story in full, inside the band: every line from the server's log. */
function ArkLifeStory({animal, life, facts, words, locale, rest = null}: {animal: ArkAnimal; life: ArkLife | null; facts: ReturnType<typeof lifeFacts>; words: ArkWords; locale: string; /** How it rests now, in words (the sleep lane): first in "Right now". */ rest?: string | null}) {
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
        <div className="rows-in mt-3 max-h-[24svh] overflow-y-auto overscroll-contain border-t border-line-300 pt-2.5 md:max-h-[30svh] md:pl-[5.25rem]" aria-label={`${w.showStory}: ${animal.name}`}>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2 xl:grid-cols-4">
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
function ArkStoryLine({state, born, hatched, story, capture, founder, words}: {state: LifeState | null; born: boolean; hatched: boolean; story: ArkFounderStory | null; capture: boolean; founder: ArkFounder | null; words: ArkWords}) {
    // Founders: the story its founder chose to share, in their words (shown whether or not the founder is named), their @username beside its header.
    // D6: on an animal a capture brought, the shared story is of a step that keeps it thriving.
    if (story) return <ArkFounderStoryBlock story={story} founder={founder} title={capture ? words.founders.card.howThriving : words.founders.card.howAboard} className="rows-in mt-1.5" />;
    if (!state || state.loading) return <p aria-hidden="true" className="mt-1.5 h-[1.125rem]" />;
    const told = state.life?.story_public ?? null;
    return (
        <p className="rows-in mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-ink-200">
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

/** Development's `?arkage=1` without a session: the same question, nothing sent (the component shows only then). */
function ArkAgeAskDev({words}: {words: ArkWords["age"]}) {
    if (process.env.NODE_ENV !== "development") return null;
    return <ArkAgeAsk words={words} className="mt-4 max-w-xl" />;
}

/** A template with `{name}` filled by a node (a linked name), the words around it as the reader's language has them. */
function ArkFilled({template, name, children}: {template: string; name: string; children: React.ReactNode}) {
    const at = template.indexOf(`{${name}}`);
    if (at < 0) return <>{template}</>;
    return <>{template.slice(0, at)}{children}{template.slice(at + name.length + 2)}</>;
}
