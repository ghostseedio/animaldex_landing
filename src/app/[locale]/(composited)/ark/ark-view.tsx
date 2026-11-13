"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {useHeaderAuth} from "@/app/[locale]/(composited)/_components/header-auth-provider";
import ArkPopulationHud from "@/app/[locale]/(composited)/ark/ark-population-hud";
import {ArkPoster, ArkToast, ArkWorldTools, ARK_GLASS} from "@/app/[locale]/(composited)/ark/ark-world-tools";
import {useArkLive} from "@/app/[locale]/(composited)/ark/use-ark-live";
import {readArkPopulationThen, type ArkPopulationThen} from "@/lib/ark-population-change";
import type {ArkPageSummary} from "@/lib/ark-page-summary";
import {arkNewArrivals} from "@/lib/ark-live-log";
import {fetchArkHunting} from "@/lib/ark-hunting";
import {ArkAnimalCard, ArkFilled, useCardFocus} from "@/app/[locale]/(composited)/ark/ark-animal-card";
import type {ArkAnimal, ArkHerdInfo, ArkIsland, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import type {ArkArchipelagoHandle} from "@/ark-scene/islands/archipelago";
import {arkIslandCounts, arkIslandSnapshot, arkOpeningIsland, arkTwoIslands} from "@/lib/ark-islands";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIconFallback, arkIconUrl, isArkPlaceholderSlug, noteArkIconless} from "@/ark-scene/placeholder-icon";
import {arkFocusAnimals, arkLookKey, arkPairStatus, arkPickAnimal, arkSpeciesKey, type ArkSpeciesRow} from "@/lib/ark-population";
import {arkRankedSpecies} from "@/lib/ark-population-change";
import type {ArkBehaviourState} from "@/ark-scene/behaviour-state";
import {cardSaysAsleep} from "@/ark-scene/behaviour-card";
import {arkJoinLabels, arkSinceWhen, decodeArkEvents, decodeArkLife, isQuietArkReplay, planArkReplay, readArkLastVisit, writeArkLastVisit, type ArkAct, type ArkLife, type ArkReplaySummary} from "@/lib/ark-life";
import {fixtureArkStory} from "@/lib/ark-story";
import {ARK_NO_FOUNDERS, decodeArkFounders, type ArkFounders} from "@/lib/ark-founders";
import {ArkBringerNames, type ArkBringerEntry} from "@/components/ark/ark-founder-bits";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";
import ArkAgeAsk from "@/components/ark/ark-age-ask";
import {ARK_SOUND_STORAGE_KEY, initialSoundPreference, storedSoundPreference} from "@/lib/ark-sound";
import ArkLoaderCard, {type ArkLoaderNewest} from "@/app/[locale]/(composited)/ark/ark-loader";
import {ARK_LOAD_START, arkAnimalsShare, arkLoadAnimals, arkLoadStage, arkLoadStep, arkNewestArrival, arkWhenSettled, markArkLoad, type ArkLoadState, type ArkLoadStep} from "@/lib/ark-loading";
import {arkPageSource, type ArkSource} from "@/lib/ark-measure";
import {noteArkArrivalsSeen, startArkSession, trackArk} from "@/lib/ark-measure-client";

export type {ArkWords} from "@/lib/ark-words";

/** Development's fixture: the event log and life stories as the server's reads would answer. */
export type ArkFixtureLife = {events: unknown; lives: Record<string, unknown>};

type Props = {
    locale: string;
    /**
     * The Ark handed over as props: development's modes only (fixtures, `?snapshot=`, the recorder). Otherwise null,
     * and the client reads the live Ark itself after the first paint (decision 246: it was 4 MB of inline payload).
     */
    initial: ArkSnapshot | null;
    /** The counts and the islands' sizes for the first paint, before the Ark is read (`lib/ark-page-summary.ts`). */
    summary?: ArkPageSummary | null;
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
    /** `?focus=`: an animal's id, a species_profile_id or slug to fly to once the Ark is in view (on its island). */
    focus?: string | null;
    /** Part C, `?island=wild|town`: the island to open on (else decision 26: the one with most of the viewer's animals). */
    island?: string | null;
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
    /** The newest arrival (the server's "Latest aboard", first): the loading card's line from the first paint. */
    newest?: ArkLoaderNewest | null;
};

/** The contract's refresh: every 45 s while the tab is in front. */
const REFRESH_MS = 45_000;
const GROW_REFRESH_MS = 8_000;
/** Under this many animals the Ark reads as just beginning. */
const BEGINNING_BELOW = 24;
/** The 24-hour change is worked out this long after the world is up, so its read never competes with the scene's. */
const CHANGE_READ_AFTER_MS = 1500;
/** ...and this long after the page opened when the world is slow to come up (a slow device). */
const CHANGE_READ_ANYWAY_MS = 8000;
/** The lighter view (A18), when the reader chose: "1" on, "0" off; absent: decided by the device. */
const LITE_KEY = "ark.lite";
/** The loading card asks the scene how the opening view's models are coming this often, after the first frame... */
const ANIMALS_POLL_MS = 300;
/** ...and stops waiting for them after this long (the scene's own quiet bar at the foot takes over then). */
const ANIMALS_WAIT_MS = 30_000;

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

export default function ArkView({locale, initial, summary: pageSummary = null, founders: initialFounders = ARK_NO_FOUNDERS, growFrom, fixture, local = false, signedIn, words, talkTitles, modelBase, rigBase, focus: focusOn = null, island: islandAsked = null, fixtureLife = null, hours = null, since = null, publicStory = false, shareLocalePath = "/ark", liveFeed = false, newest: newestAboard = null}: Props) {
    const {session} = useHeaderAuth();
    const mountRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<ArkSceneHandle | null>(null);
    const sceneOf = useCallback(() => sceneRef.current, []);
    const [snapshot, setSnapshot] = useState<ArkSnapshot | null>(initial);
    const [founders, setFounders] = useState<ArkFounders>(initialFounders);
    const snapshotRef = useRef(snapshot);
    const hasSnapshot = Boolean(snapshot);
    /** The client's read of the live Ark failed (or the Ark is not there yet): "opens soon". */
    const [unavailable, setUnavailable] = useState(false);
    const [selected, setSelected] = useState<ArkAnimal | null>(null);
    /** What the selected animal is doing now, as the scene animates it (never worked out here from a clock of the page's own). */
    const [selectedState, setSelectedState] = useState<{id: string; state: ArkBehaviourState} | null>(null);
    const onBehaviour = useCallback((id: string, state: ArkBehaviourState) => setSelectedState({id, state}), []);
    /** How the selected animal rests now (the sleep lane's status: "Asleep in its den"), as the scene draws it. */
    const [selectedRest, setSelectedRest] = useState<{id: string; rest: string | null} | null>(null);
    const onRest = useCallback((id: string, rest: string | null) => setSelectedRest({id, rest}), []);
    const [mineOnly, setMineOnly] = useState(false);
    // Part C: the island loaded now, and whether a crossing is under way (one island at a time; `islands/archipelago.ts`).
    const [island, setIsland] = useState<ArkIsland>("wild");
    const [crossing, setCrossing] = useState(false);
    /** Part C: the panel shows the island loaded, or both islands (counts from data; a species on the other island crosses to it). */
    const [panelScope, setPanelScope] = useState<"island" | "both">("island");
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    // The loading card (lib/ark-loading.ts): the load's real steps as they happen, each marked once for a trace.
    const [load, setLoad] = useState<ArkLoadState>(() => (initial ? arkLoadStep(ARK_LOAD_START, "data") : ARK_LOAD_START));
    const [loadGaveUp, setLoadGaveUp] = useState(false);
    /** The world's first good frame (the second drawn: `arkWhenSettled`): the poster gives way to it. */
    const [settled, setSettled] = useState(false);
    const marked = useRef(new Set<string>());
    const stepLoad = useCallback((step: ArkLoadStep | "animals") => {
        if (!marked.current.has(step)) {
            marked.current.add(step);
            markArkLoad(step);
        }
        if (step !== "animals") setLoad((state) => arkLoadStep(state, step));
    }, []);
    const [arrival, setArrival] = useState<ArkAnimal | null>(null);
    /** Each species' count 24 hours ago, from the event log (decision 239); null until read, or when it can't be. */
    const [then, setThen] = useState<ArkPopulationThen | null>(null);
    const [life, setLife] = useState<LifeState | null>(null);
    const livesRef = useRef(new Map<string, ArkLife | null>());
    const [following, setFollowing] = useState(false);
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
    // The species drawn as herds (A14), worked out by the scene's own rule, loaded with it (not in the page's first JavaScript).
    const [herdKeys, setHerdKeys] = useState<ReadonlySet<string>>(() => new Set());
    useEffect(() => {
        const animals = snapshot?.animals;
        if (!animals?.length) return;
        let stale = false;
        void import("@/ark-scene/herds").then(({arkHerdKeys}) => {
            if (!stale) setHerdKeys(arkHerdKeys(animals));
        });
        return () => {
            stale = true;
        };
    }, [snapshot]);
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
        if (hasSnapshot) stepLoad("data");
    }, [hasSnapshot, stepLoad]);
    useEffect(() => {
        // Only a real Ark is a visit: not the "opens soon" page before the migration.
        if (!hasSnapshot) return;
        try {
            sourceRef.current = arkPageSource(new URLSearchParams(window.location.search).get("from"));
        } catch {
            sourceRef.current = "ark_page";
        }
        return startArkSession(sourceRef.current);
        // One visit per page (from the moment the Ark is read).
    }, [hasSnapshot]);

    const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, {day: "numeric", month: "long", year: "numeric"}), [locale]);
    const hasMine = Boolean(snapshot?.animals.some((animal) => animal.mine));
    // Part C: two islands once the server's switch is on; the panel shows the island loaded (its own slice of the read).
    // (Before the Ark is read, the page's summary says: decision 246.)
    const twoIslands = snapshot ? arkTwoIslands(snapshot) : Boolean(pageSummary?.islands);
    const islandCounts = useMemo(() => (snapshot ? (twoIslands ? arkIslandCounts(snapshot) : null) : pageSummary?.islands ?? null), [snapshot, twoIslands, pageSummary]);
    const shown = useMemo(() => (snapshot && twoIslands ? arkIslandSnapshot(snapshot, island) : snapshot), [snapshot, twoIslands, island]);
    const crossTo = (next: ArkIsland) => {
        const scene = sceneRef.current as ArkArchipelagoHandle | null;
        if (!scene?.crossTo || next === island || crossing) return;
        void scene.crossTo(next);
    };
    const islandWords = {wild: words.islands?.wild ?? "Wild island", town: words.islands?.town ?? "Town and zoo", label: words.islands?.label ?? "Islands"};
    const showMineToggle = hasMine && (signedIn || Boolean(session.user) || fixture);
    // The population overlay lists the island shown or both (biggest first), or with "My animals" on only the reader's own.
    const listedAll = panelScope === "both" || !twoIslands ? snapshot : shown;
    const listed = useMemo(() => (listedAll && mineOnly ? {...listedAll, animals: listedAll.animals.filter((animal) => animal.mine)} : listedAll), [listedAll, mineOnly]);

    // MARK: The scene

    useEffect(() => {
        const el = mountRef.current;
        const first = snapshotRef.current;
        if (!el || !first) return;
        let disposed = false;
        let handle: ArkSceneHandle | null = null;
        let settleCancel: (() => void) | null = null;
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        let storedLite: boolean | null = null;
        try {
            const stored = window.localStorage.getItem(LITE_KEY);
            if (stored === "1" || stored === "0") storedLite = stored === "1";
        } catch {
            // The device decides.
        }
        // Behind the poster (decision 246): the scene's code is fetched and run once the browser is idle after the first
        // paint, never in the page's first JavaScript.
        const start = () => import("@/ark-scene/islands/archipelago")
            .then(async ({mountArchipelago}) => {
                if (disposed) return;
                stepLoad("code");
                // (The mount's heavy seeded work runs in the runtime's worker first, inside the archipelago: docs/ark/runtime.md §7.)
                const opening = snapshotRef.current ?? first;
                const focusedFirst = arkPickAnimal(arkFocusAnimals(opening, focusOn), null);
                try {
                    handle = mountArchipelago(el, {
                        // Part C: the island to open on (decision 26), the island shown as it changes.
                        openOn: arkOpeningIsland(opening, {asked: islandAsked, focus: focusedFirst}),
                        onIsland: (next, moving) => {
                            setIsland(next);
                            setCrossing(moving);
                        },
                        snapshot: snapshotRef.current ?? first,
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
                        wildIslandRegionLabels: words.wildIslandRegions,
                        reducedMotion,
                        hours,
                        onFollowEnd: () => setFollowing(false),
                        onSoundCredits: () => setCredits(sceneRef.current?.sound().credits ?? []),
                        onReady: () => {
                            setReady(true);
                            settleCancel = arkWhenSettled(sceneRef.current, () => {
                                if (disposed) return;
                                stepLoad("frame");
                                setSettled(true);
                            });
                        }
                    });
                    sceneRef.current = handle;
                    // The island's seeded work done in its worker and the scene made (before its first frame).
                    void (handle as ArkArchipelagoHandle).mounted?.().then(() => {
                        if (!disposed) stepLoad("prepared");
                    });
                    // "See it in the Ark" (`?focus=`): straight to that animal or species, the reader's own first, on its island.
                    const focused = arkPickAnimal(arkFocusAnimals(snapshotRef.current ?? first, focusOn), null);
                    if (focused) {
                        // The page's own flight to `?focus=` is not a tap.
                        autoSelecting.current = true;
                        handle.select(focused.id);
                        autoSelecting.current = false;
                    }
                    if (process.env.NODE_ENV !== "production") {
                        (window as unknown as {__arkScene?: ArkSceneHandle}).__arkScene = handle;
                        (window as unknown as {__arkSnapshot?: ArkSnapshot | null}).__arkSnapshot = snapshotRef.current ?? first;
                        // Development: every act in the fixture's log, to play one by hand (`__arkScene.play([__arkActs[i]])`).
                        if (fixtureLife) (window as unknown as {__arkActs?: ArkAct[]}).__arkActs = planArkReplay(decodeArkEvents(fixtureLife.events, snapshotRef.current ?? first), 1000).acts;
                    }
                } catch (error) {
                    console.warn("[ark] the scene could not start", error);
                    setFailed(true);
                }
            })
            .catch(() => setFailed(true));
        const idle = window.requestIdleCallback ? window.requestIdleCallback(() => void start(), {timeout: 1500}) : null;
        const timer = idle === null ? window.setTimeout(() => void start(), 150) : null;
        return () => {
            disposed = true;
            settleCancel?.();
            if (idle !== null) window.cancelIdleCallback?.(idle);
            if (timer !== null) clearTimeout(timer);
            handle?.dispose();
            sceneRef.current = null;
        };
        // The scene is built once, when the Ark is first read; later snapshots go through update().
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSnapshot]);

    useEffect(() => {
        sceneRef.current?.setMineOnly(mineOnly);
    }, [mineOnly]);

    // After the first frame, the opening view's models as they come (the runtime's numbers): the card's last stage.
    // Done when the runtime says the view is complete, or once something was asked for and nothing has been pending
    // for about a second.
    useEffect(() => {
        if (!settled) return;
        let most = 0;
        let quiet = 0;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const since = performance.now();
        const tick = () => {
            const stats = sceneRef.current?.runtime?.();
            if (stats) {
                most = Math.max(most, stats.pending);
                quiet = stats.pending === 0 ? quiet + 1 : 0;
                const done = stats.viewComplete || (most > 0 && quiet >= 3);
                setLoad((state) => arkLoadAnimals(state, arkAnimalsShare(stats.pending, most), done));
                if (done) {
                    stepLoad("animals");
                    return;
                }
            }
            if (performance.now() - since > ANIMALS_WAIT_MS) {
                setLoadGaveUp(true);
                return;
            }
            timer = setTimeout(tick, ANIMALS_POLL_MS);
        };
        timer = setTimeout(tick, ANIMALS_POLL_MS);
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [settled, stepLoad]);

    // The tap card covers the foot of the world: the view moves up so the animal (and its bars) stay above it (on a
    // desktop too since decision 240: the world there is short enough for the card to cover the animal).
    // (And the overlays over the world keep clear of it: `--ark-card-h`, decision 239.)
    const bandRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const band = bandRef.current;
        const scene = sceneRef.current;
        const card = (height: number) => worldRef.current?.style.setProperty("--ark-card-h", `${Math.round(height)}px`);
        if (!(selected || herd) || !band) {
            card(0);
            scene?.setViewInset(0);
            return;
        }
        if (!scene) return;
        const phone = window.matchMedia("(max-width: 767px)");
        const apply = () => {
            const height = band.getBoundingClientRect().height;
            card(height);
            scene.setViewInset(height);
        };
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

    // The population overlay's 24-hour change (decision 239): the event log read once per page load (kept a few minutes
    // per device), a moment after the world is up, or a while after the page opened if the world is slow to come up.
    // Development's fixtures: their own log, whatever its times.
    const changeAsked = useRef(false);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    useEffect(() => {
        if (changeAsked.current || !hasSnapshot) return;
        const timer = setTimeout(() => {
            const now = snapshotRef.current;
            if (!now || changeAsked.current) return;
            changeAsked.current = true;
            const done = (read: ArkPopulationThen | null) => {
                if (mounted.current) setThen(read);
            };
            if (fixtureLife) {
                void import("@/lib/ark-population-change").then(({arkPopulationThen}) => done(arkPopulationThen(now, fixtureLife.events, Date.now(), "")));
                return;
            }
            if (fixture) return;
            void readArkPopulationThen("/api/ark/events", now, {fetch: (url) => fetch(url), storage: storage()}).then(done);
        }, ready ? CHANGE_READ_AFTER_MS : CHANGE_READ_ANYWAY_MS);
        return () => clearTimeout(timer);
    }, [ready, hasSnapshot, fixture, fixtureLife]);

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

    // The live Ark, read by the client after the first paint (decision 246), as the visitor (their own come back `mine`):
    // never handed over as props in production.
    useEffect(() => {
        if (initial) return;
        let stopped = false;
        const read = () => fetch("/api/ark/voyage")
            .then((response) => (response.ok ? response.json() : null))
            .then((body: {snapshot?: unknown; founders?: unknown; noIcon?: unknown} | null) => {
                const next = decodeArkSnapshot(body?.snapshot);
                if (stopped) return;
                if (!next) {
                    if (!snapshotRef.current) setUnavailable(true);
                    return;
                }
                setFounders(decodeArkFounders(body?.founders));
                // (Before the rows and the scene ask for icons: the species with no icon art show the generic figure.)
                noteArkIconless(body?.noIcon);
                apply(next);
            })
            .catch(() => {
                if (!stopped && !snapshotRef.current) setUnavailable(true);
            });
        // Once the page has loaded (the poster painted) and the browser is idle: the read's parse (thousands of animals)
        // never holds up the first paint.
        let idle: number | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const whenIdle = () => {
            if (window.requestIdleCallback) idle = window.requestIdleCallback(() => void read(), {timeout: 1000});
            else timer = setTimeout(() => void read(), 50);
        };
        if (document.readyState === "complete") whenIdle();
        else window.addEventListener("load", whenIdle, {once: true});
        return () => {
            stopped = true;
            window.removeEventListener("load", whenIdle);
            if (idle !== null) window.cancelIdleCallback?.(idle);
            if (timer) clearTimeout(timer);
        };
        // Once per page; the refresh below keeps it current.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                const body = await response.json() as {snapshot?: unknown; founders?: unknown; noIcon?: unknown};
                const next = decodeArkSnapshot(body.snapshot);
                if (next && !stopped) {
                    noteArkIconless(body.noIcon);
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

    // Encounter hunting (`voyage_hunting_v1`): the server's read at the refresh's pace, from the moment the world is up.
    // Nothing (the pool, the read missing, development's fixtures) leaves every animal on its schedule as before.
    useEffect(() => {
        if (!ready || fixture || liveFeed || local) return;
        let stopped = false;
        const run = () => {
            if (document.visibilityState !== "visible") return;
            void fetchArkHunting().then((read) => {
                if (!stopped) sceneRef.current?.setHunting?.(read);
            });
        };
        run();
        const timer = setInterval(run, REFRESH_MS);
        return () => {
            stopped = true;
            clearInterval(timer);
        };
    }, [ready, fixture, liveFeed, local]);

    useEffect(() => {
        if (!arrival) return;
        const timer = setTimeout(() => setArrival(null), 9000);
        return () => clearTimeout(timer);
    }, [arrival]);

    // MARK: Words

    const status = (() => {
        const counts = snapshot?.counts ?? pageSummary?.counts ?? null;
        if (!counts) return unavailable ? words.unavailable : words.loading;
        const {animals, species, founders} = counts;
        if (animals === 0) return words.empty;
        const values = {
            animals: counted(animals, words.animalsOne, words.animalsOther, locale),
            species: counted(species, words.speciesOne, words.speciesOther, locale),
            founders: counted(founders, words.foundersOne, words.foundersOther, locale)
        };
        const template = animals < BEGINNING_BELOW ? words.beginning : words.aboard;
        return template.replace(/\{(\w+)\}/g, (match, key: keyof typeof values) => values[key] ?? match);
    })();

    // The loading card's newest arrival: the server's, else the Ark's own once read (real data either way).
    const newestFromArk = useMemo(() => {
        if (newestAboard || !snapshot) return null;
        const animal = arkNewestArrival(snapshot.animals);
        return animal ? {name: animal.name, slug: animal.model_slug, at: animal.arrived_at} : null;
    }, [newestAboard, snapshot]);
    const loadStage = arkLoadStage(load);
    const loaderShown = !failed && !(unavailable && !snapshot) && !loadGaveUp && loadStage !== "done";

    // A tap in a list off the world (the reader scrolled down): the world comes back into view.
    const showWorld = () => {
        const world = worldRef.current;
        if (!world || !window.matchMedia("(max-width: 767px)").matches) return;
        const top = world.getBoundingClientRect().top;
        if (top < 0 || top > window.innerHeight * 0.4) window.scrollTo({top: window.scrollY + top - 64, behavior: "smooth"});
    };

    const pickSpecies = (row: ArkSpeciesRow) => {
        // From the panel: focus comes back to its row when the card closes.
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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

    return (
        <div className="-mt-8">
            {/* The world fills the screen under the site's header (decision 239): the title and the counts line stay for a
                screen reader (the counts are also the overlay's heading). */}
            <h1 id="ark-title" className="sr-only">{words.eyebrow}</h1>
            <p className="sr-only" aria-live="polite">{status}</p>

            {/* What a screen reader hears as it happens (A18): arrivals, a card opening, the replay's summary. */}
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
            {snapshot || pageSummary ? (
                <a href="#ark-aboard" className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:m-2 focus:rounded-full focus:bg-primary-400 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-canvas-950">
                    {words.a11y.skipToList}
                </a>
            ) : null}

            {/* The world, edge to edge and as tall as the screen under the header; who is aboard over it. */}
            <section ref={worldRef} aria-label={words.eyebrow} data-ark-loading={loaderShown ? "" : undefined} className="relative h-[calc(100svh-4.0625rem)] min-h-[30rem] w-full overflow-hidden bg-[#ecdcc4]">
                {snapshot && !failed ? <div ref={mountRef} className="absolute inset-0" onPointerUp={worldTapped} /> : null}
                {snapshot && !failed ? <div ref={liveHostRef} className="pointer-events-none absolute inset-0" /> : null}

                {/* A real render of the Ark's opening view until the world is up (decision 246): the page's largest paint. */}
                {!failed && !(unavailable && !snapshot) ? <ArkPoster ready={settled} /> : null}

                {!snapshot && unavailable ? (
                    <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
                        <p className="max-w-md font-display text-xl font-bold text-[#3d3829]">{words.unavailable}</p>
                    </div>
                ) : null}

                {failed && snapshot ? (
                    <div className="absolute inset-0 overflow-y-auto bg-canvas-950 px-4 py-6 md:px-8">
                        <p className="text-sm text-ink-200">{words.noWebgl}</p>
                        {/* By species with its count (a thousand of one kind is one row, A14). */}
                        <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                            {arkRankedSpecies(snapshot).map((row) => (
                                <li key={row.key} className="flex items-baseline justify-between gap-3 border-b border-line-300 py-2 text-sm">
                                    <span className="min-w-0"><span className="font-bold text-white">{row.name}</span> <span className="text-ink-400">· {words.zones[row.zone]}</span></span>
                                    <span className="shrink-0 tabular-nums text-ink-200">{fillArkWords(words.hud.countStatus, {count: row.count.toLocaleString(locale), status: words.hud[row.status]})}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}

                {/* Over the world (decision 239): the toolbar (top start), the notices under it, who is aboard (top end; under
                    the toolbar on a phone). Clear of the live log and the reset button at the foot, and of an open card
                    (`--ark-card-h`, from the band's height). */}
                {(snapshot || pageSummary) && !failed ? (
                    <div className="pointer-events-none absolute inset-0 z-[2] grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto_minmax(0,1fr)] gap-2 p-3 pb-[calc(4rem+var(--ark-card-h,0px))] md:grid-rows-[auto_minmax(0,1fr)] md:gap-x-3">
                        <ArkWorldTools
                            words={words}
                            locale={locale}
                            islands={twoIslands && islandCounts ? {island, counts: islandCounts, crossing, names: islandWords, onCross: crossTo} : null}
                            lite={{on: liteChoice ?? liteOn, auto: liteChoice === null && liteOn, onToggle: toggleLite}}
                            sound={{on: soundOn, onToggle: () => setSound(!soundOn)}}
                        />

                        <div className="pointer-events-none col-span-2 row-start-3 flex min-w-0 flex-col items-start gap-2 self-start md:col-span-1 md:row-start-2">
                            {/* The loading card (decision rows, loading lane): the load's stages, the bar, the newest arrival. */}
                            {!failed && !(unavailable && !snapshot) && !loadGaveUp ? <ArkLoaderCard state={load} words={words} newest={newestAboard ?? newestFromArk} locale={locale} /> : null}
                            {replay ? (
                                <ArkToast role="status" aria-live="polite">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#c8fa63]">
                                            {words.replay.title}
                                            <span className="ml-2 font-semibold normal-case tracking-normal text-white/50">{fillArkWords(words.replay.progress, {n: replay.index + 1, total: replay.acts.length})}</span>
                                        </p>
                                        <p key={replay.index} className="rows-in mt-0.5 text-[13px] font-semibold leading-snug [text-wrap:balance]">{actCaption(replay.acts[replay.index], words, locale, snapshot?.animals ?? [], founders)}</p>
                                    </div>
                                    <button type="button" onClick={() => {
                                        replaySkipped.current = true;
                                        replayRef.current?.skip();
                                    }} className="inline-flex h-9 shrink-0 items-center rounded-full border border-white/20 px-3.5 text-[12.5px] font-bold transition-colors hover:border-[#c8fa63] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8fa63]">
                                        {words.replay.skip}
                                    </button>
                                </ArkToast>
                            ) : null}

                            {summary && !replay && !selected && !herd ? (
                                <ArkToast>
                                    <p className="min-w-0 flex-1 text-[13px] leading-snug">
                                        <span className="mr-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#c8fa63]">{words.replay.title}</span>
                                        <span className="font-semibold">{summary}</span>
                                        {reducedMotion ? <span className="mt-0.5 block text-[12px] text-white/55">{words.a11y.motionReduced}</span> : null}
                                    </p>
                                    <button type="button" onClick={() => setSummary(null)} aria-label={words.replay.dismiss} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8fa63]">
                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                                    </button>
                                </ArkToast>
                            ) : null}

                            {arrival && !selected && !herd && !replay && !summary ? (
                                <ArkToast className="!w-auto">
                                    <p className="min-w-0 truncate text-[13px] font-semibold">{words.newArrival.replace("{animal}", arrival.name)}</p>
                                    <button type="button" onClick={() => sceneRef.current?.select(arrival.id)} className="inline-flex h-9 shrink-0 items-center rounded-full px-2.5 text-[13px] font-bold text-[#c8fa63] underline-offset-4 hover:underline">
                                        {words.showMe}
                                    </button>
                                </ArkToast>
                            ) : null}

                            {soundOn ? (
                                <div className="pointer-events-auto flex max-w-[22rem] flex-col items-start gap-1.5">
                                    <button type="button" aria-expanded={creditsOpen} aria-controls="ark-sound-credits" onClick={() => setCreditsOpen((open) => !open)} className={`${ARK_GLASS} inline-flex h-9 items-center rounded-full px-3 text-[12px] font-semibold text-white/80 hover:text-white md:h-8`}>
                                        {words.sound.credits}
                                    </button>
                                    {creditsOpen ? (
                                        <div id="ark-sound-credits" className={`${ARK_GLASS} max-h-40 overflow-y-auto rounded-xl px-3 py-2 text-[12px] leading-relaxed text-white/80`}>
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
                                </div>
                            ) : null}

                            {/* "Name now, ask age after": once, for someone signed in whose @username shows and whose year isn't stored. */}
                            <div className="pointer-events-auto w-full max-w-[26rem] overflow-hidden rounded-2xl bg-[rgba(14,20,14,0.9)] backdrop-blur-xl">
                                {signedIn || Boolean(session.user) ? <ArkAgeAsk words={words.age} className="rounded-2xl" /> : <ArkAgeAskDev words={words.age} />}
                            </div>
                        </div>

                        <ArkPopulationHud
                            snapshot={snapshot}
                            counts={snapshot?.counts ?? pageSummary?.counts ?? {animals: 0, species: 0, founders: 0}}
                            listed={listed}
                            scope={panelScope === "both" || !twoIslands ? "both" : island}
                            then={mineOnly ? null : then}
                            totalThen={then}
                            words={words}
                            locale={locale}
                            selectedKey={selected ? arkSpeciesKey(selected) : herdSpeciesKey}
                            herdKeys={herdKeys}
                            arrivalKey={arrival ? arkSpeciesKey(arrival) : null}
                            onSpecies={pickSpecies}
                            shareLocalePath={shareLocalePath}
                            filters={twoIslands || showMineToggle ? (
                                <>
                                    {twoIslands ? (
                                        <div role="group" aria-label={islandWords.label} className="flex rounded-full bg-white/[0.07] p-0.5">
                                            {(["island", "both"] as const).map((id) => (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    aria-pressed={panelScope === id}
                                                    onClick={() => setPanelScope(id)}
                                                    className={`inline-flex h-10 items-center rounded-full px-3 text-[12px] font-semibold transition-colors motion-reduce:transition-none md:h-7 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8fa63] ${panelScope === id ? "bg-white/[0.16] text-white" : "text-white/60 hover:text-white"}`}
                                                >
                                                    {id === "both" ? words.islands?.both ?? "Both islands" : islandWords[island]}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                    {showMineToggle ? (
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={mineOnly}
                                            onClick={() => setMineOnly((value) => !value)}
                                            className={`inline-flex h-11 items-center rounded-full px-3 text-[12px] font-semibold transition-colors motion-reduce:transition-none md:h-8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8fa63] ${mineOnly ? "bg-[#a7f432] text-canvas-950" : "bg-white/[0.07] text-white/70 hover:text-white"}`}
                                        >
                                            {words.myAnimals}
                                        </button>
                                    ) : null}
                                </>
                            ) : null}
                        />
                    </div>
                ) : null}

                {selected ? (
                    <ArkAnimalCard
                        bandRef={bandRef}
                        animal={selected}
                        words={words}
                        locale={locale}
                        talk={talkTitle(selected.name, talkTitles)}
                        arrived={dateFormat.format(new Date(selected.arrived_at))}
                        life={life?.id === selected.id ? life : null}
                        founders={founders.animals[selected.id] ?? null}
                        arkDay={snapshot?.ark_day ?? null}
                        voyageStart={snapshot?.voyage.started_at ?? null}
                        scene={sceneOf}
                        asleep={cardSaysAsleep(selectedState?.id === selected.id ? selectedState.state : sceneRef.current?.behaviour(selected.id))}
                        rest={selectedRest?.id === selected.id ? selectedRest.rest : sceneRef.current?.rest(selected.id) ?? null}
                        following={following}
                        onFollow={toggleFollow}
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

/** Development's `?arkage=1` without a session: the same question, nothing sent (the component shows only then). */
function ArkAgeAskDev({words}: {words: ArkWords["age"]}) {
    if (process.env.NODE_ENV !== "development") return null;
    return <ArkAgeAsk words={words} className="rounded-2xl" />;
}
