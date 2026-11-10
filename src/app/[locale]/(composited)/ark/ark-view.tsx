"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {useHeaderAuth} from "@/app/[locale]/(composited)/_components/header-auth-provider";
import ArkPopulationHud from "@/app/[locale]/(composited)/ark/ark-population-hud";
import type {ArkAnimal, ArkRegion, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkFocusAnimals, arkPickAnimal, arkSpeciesKey, type ArkSpeciesRow} from "@/lib/ark-population";
import {isAwake, localHours, sunElevation} from "@/lib/ark-daylight";
import {arkJoinLabels, arkSinceWhen, decodeArkEvents, decodeArkLife, isQuietArkReplay, planArkReplay, readArkLastVisit, writeArkLastVisit, type ArkAct, type ArkLife, type ArkReplaySummary} from "@/lib/ark-life";
import {fixtureArkStory} from "@/lib/ark-story";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";
import ArkSpeciesIcon from "@/app/[locale]/(composited)/ark/ark-species-icon";

export type {ArkWords} from "@/lib/ark-words";

/** Development's fixture: the event log and life stories as the server's reads would answer. */
export type ArkFixtureLife = {events: unknown; lives: Record<string, unknown>};

type Props = {
    locale: string;
    initial: ArkSnapshot | null;
    /** Development's `?fixture=grow`: the whole fixture, handed out a few at a time. */
    growFrom: ArkSnapshot | null;
    fixture: boolean;
    signedIn: boolean;
    words: ArkWords;
    talkTitles: {a: string; an: string};
    modelBase: string;
    /** `?focus=`: a species_profile_id or slug to fly to once the Ark is in view. */
    focus?: string | null;
    fixtureLife?: ArkFixtureLife | null;
    /** Development's `?hour=`: the light's hour pinned; otherwise the reader's clock. */
    hours?: number | null;
    /** Development's `?since=`: replay from then, instead of the last visit. */
    since?: string | null;
    /** Development: the fixture's public-debate stories let through, as the server's `public_story` flag would. */
    publicStory?: boolean;
};

/** The contract's refresh: every 45 s while the tab is in front. */
const REFRESH_MS = 45_000;
const GROW_REFRESH_MS = 8_000;
/** Under this many animals the Ark reads as just beginning. */
const BEGINNING_BELOW = 24;
/** The desktop HUD's fold, kept per reader. */
const FOLD_KEY = "ark.hud.folded";

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

/** One quiet line per act: what the server says happened. */
function actCaption(act: ArkAct, words: ArkWords, locale: string, animals: ArkAnimal[]): string {
    const w = words.replay;
    const gone = (name: string, extinct: boolean) => (extinct ? ` · ${fillArkWords(w.lastGone, {animal: name})}` : "");
    switch (act.kind) {
        case "arrival":
            return fillArkWords(w.arrival, {aAnimal: capitalised(withArticle(act.animal.name, words))});
        case "birth": {
            const fromParents = act.parents.map((id) => animals.find((animal) => animal.id === id)?.brought_by.label ?? "").filter(Boolean);
            const bringers = arkJoinLabels(act.bringers.length ? act.bringers : fromParents, locale);
            const first = act.young[0];
            return act.young.length === 1
                ? fillArkWords(w.birthOne, {aAnimal: capitalised(withArticle(first.name, words)), bringers})
                : fillArkWords(w.birthOther, {count: act.young.length.toLocaleString(locale), animal: first.name, bringers});
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
        part(summary.births, w.birthsOne, w.birthsOther),
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

export default function ArkView({locale, initial, growFrom, fixture, signedIn, words, talkTitles, modelBase, focus: focusOn = null, fixtureLife = null, hours = null, since = null, publicStory = false}: Props) {
    const {session} = useHeaderAuth();
    const mountRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<ArkSceneHandle | null>(null);
    const [snapshot, setSnapshot] = useState<ArkSnapshot | null>(initial);
    const snapshotRef = useRef(snapshot);
    const [selected, setSelected] = useState<ArkAnimal | null>(null);
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
    const [storyOpen, setStoryOpen] = useState(false);
    const [replay, setReplay] = useState<ReplayState | null>(null);
    const [summary, setSummary] = useState<string | null>(null);
    const replayRef = useRef<{skip: () => void} | null>(null);
    const replayAsked = useRef(false);
    const worldRef = useRef<HTMLDivElement | null>(null);

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
        import("@/ark-scene")
            .then(({mountArk}) => {
                if (disposed) return;
                try {
                    handle = mountArk(el, {
                        snapshot: snapshotRef.current ?? initial,
                        modelBase,
                        iconUrl: getSpeciesArtworkUrl,
                        onSelect: setSelected,
                        mineOnly: false,
                        regionLabels: words.regions,
                        reducedMotion,
                        hours,
                        onFollowEnd: () => setFollowing(false),
                        onReady: () => setReady(true)
                    });
                    sceneRef.current = handle;
                    // "See it in the Ark" (`?focus=`): straight to that species, the reader's own first.
                    const focused = arkPickAnimal(arkFocusAnimals(snapshotRef.current ?? initial, focusOn), null);
                    if (focused) handle.select(focused.id);
                    if (process.env.NODE_ENV !== "production") {
                        (window as unknown as {__arkScene?: ArkSceneHandle}).__arkScene = handle;
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
        if (!selected || !band) {
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
    }, [selected]);

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

    const toggleFollow = () => {
        const scene = sceneRef.current;
        if (!scene || !selected) return;
        const next = !following;
        scene.follow(next ? selected.id : null);
        setFollowing(next);
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
        void read.then((raw) => {
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
            setReplay({acts: plan.acts, index: 0, summary: line});
            const run = scene.play(plan.acts, {onAct: (index) => setReplay((now) => (now ? {...now, index} : now))});
            replayRef.current = run;
            void run.done.then(() => {
                replayRef.current = null;
                setReplay(null);
                setSummary(line);
            });
        });
    }, [ready, since, fixtureLife, focusOn, words, locale]);

    useEffect(() => {
        if (!summary) return;
        const timer = setTimeout(() => setSummary(null), 14000);
        return () => clearTimeout(timer);
    }, [summary]);

    // MARK: Refresh

    const apply = useCallback((next: ArkSnapshot) => {
        const before = snapshotRef.current;
        if (sameAnimals(before, next)) return;
        const known = new Set(before?.animals.map((animal) => animal.id) ?? []);
        const fresh = next.animals.filter((animal) => !known.has(animal.id));
        snapshotRef.current = next;
        setSnapshot(next);
        sceneRef.current?.update(next);
        if (before && fresh.length) setArrival(fresh[fresh.length - 1]);
    }, []);

    useEffect(() => {
        if (fixture && !growFrom) return;
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
                const body = await response.json() as {snapshot?: unknown};
                const next = decodeArkSnapshot(body.snapshot);
                if (next && !stopped) apply(next);
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
    }, [apply, fixture, growFrom]);

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
        const animal = arkPickAnimal(row.animals, selected?.id ?? null);
        if (!animal) return;
        setRegion(null);
        sceneRef.current?.select(animal.id);
        showWorld();
    };

    const beginning = Boolean(snapshot && snapshot.counts.animals < BEGINNING_BELOW);

    return (
        <div className="-mt-8">
            {/* Band 1: what this is, and how many are aboard. */}
            <section aria-labelledby="ark-title" className="border-b border-line-200 bg-canvas-950">
                <div className="mx-auto w-full max-w-[86rem] px-4 py-5 md:px-8 md:py-7">
                    <div className="flex min-h-9 items-center justify-between gap-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-300">{words.eyebrow}</p>
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
                    <h1 id="ark-title" className="mt-1 max-w-4xl font-display text-[1.65rem] font-extrabold leading-[1.05] tracking-tight text-white [text-wrap:balance] sm:text-3xl md:text-[2.5rem]">
                        {words.title}
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-ink-200 md:text-base" aria-live="polite">{status}</p>
                </div>
            </section>

            {/* Band 2: the world, edge to edge, and who is aboard (beside it on a desktop, under it on a phone). */}
            <div className="w-full md:flex md:h-[max(30rem,min(calc(100svh-18.5rem),56rem))]">
            <section ref={worldRef} aria-label={words.eyebrow} className="relative h-[max(26rem,min(66svh,48rem))] w-full overflow-hidden bg-[#ecdcc4] md:h-full md:min-w-0 md:flex-1">
                {snapshot && !failed ? <div ref={mountRef} className="absolute inset-0" /> : null}

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
                        <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                            {snapshot.animals.map((animal) => (
                                <li key={animal.id} className="flex items-baseline justify-between gap-3 border-b border-line-300 py-2 text-sm">
                                    <span className="font-bold text-white">{animal.name}</span>
                                    <span className="text-ink-400">{words.zones[animal.zone]}</span>
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
                                <p key={replay.index} className="rows-in mt-0.5 text-sm font-semibold leading-snug text-white [text-wrap:balance]">{actCaption(replay.acts[replay.index], words, locale, snapshot?.animals ?? [])}</p>
                            </div>
                            <button type="button" onClick={() => replayRef.current?.skip()} className={`${pill} min-h-9 shrink-0 border border-line-100 px-4 text-[13px] text-ink-100 hover:border-primary-400`}>
                                {words.replay.skip}
                            </button>
                        </div>
                    </div>
                ) : null}

                {summary && !replay && !selected ? (
                    <div role="status" className="rows-in absolute inset-x-0 top-0 z-[1] border-b border-line-200 bg-canvas-950/[0.9] backdrop-blur-xl">
                        <div className="mx-auto flex w-full max-w-[86rem] items-center gap-3 px-4 py-2.5 md:px-8">
                            <p className="min-w-0 flex-1 text-sm leading-snug text-ink-100">
                                <span className="mr-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-300">{words.replay.title}</span>
                                <span className="font-semibold text-white">{summary}</span>
                            </p>
                            <button type="button" onClick={() => setSummary(null)} aria-label={words.replay.dismiss} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-200 hover:bg-white/10 hover:text-white">
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                            </button>
                        </div>
                    </div>
                ) : null}

                {arrival && !selected && !replay && !summary ? (
                    <div role="status" className="rows-in absolute inset-x-0 top-0 border-b border-line-200 bg-canvas-950/[0.92] backdrop-blur-xl">
                        <div className="mx-auto flex w-full max-w-[86rem] items-center justify-between gap-3 px-4 py-2.5 md:px-8">
                            <p className="min-w-0 truncate text-sm font-semibold text-white">{words.newArrival.replace("{animal}", arrival.name)}</p>
                            <button type="button" onClick={() => sceneRef.current?.select(arrival.id)} className="shrink-0 text-sm font-bold text-primary-300 underline-offset-4 hover:underline">
                                {words.showMe}
                            </button>
                        </div>
                    </div>
                ) : null}

                {selected ? (
                    <ArkAnimalBand
                        bandRef={bandRef}
                        animal={selected}
                        words={words}
                        locale={locale}
                        talk={talkTitle(selected.name, talkTitles)}
                        arrived={dateFormat.format(new Date(selected.arrived_at))}
                        life={life?.id === selected.id ? life : null}
                        arkDay={snapshot?.ark_day ?? null}
                        asleep={!isAwake(selected.activity ?? null, sunElevation(hours ?? localHours(new Date())))}
                        following={following}
                        onFollow={toggleFollow}
                        storyOpen={storyOpen}
                        onStory={() => setStoryOpen((open) => !open)}
                        onClose={() => sceneRef.current?.select(null)}
                    />
                ) : null}
            </section>

            {snapshot ? (
                <ArkPopulationHud
                    snapshot={snapshot}
                    words={words}
                    locale={locale}
                    selectedKey={selected ? arkSpeciesKey(selected) : null}
                    arrivalKey={arrival ? arkSpeciesKey(arrival) : null}
                    region={region}
                    folded={folded}
                    onFold={fold}
                    expanded={expanded}
                    onExpand={setExpanded}
                    beginning={beginning}
                    onSpecies={pickSpecies}
                    onRegion={focus}
                />
            ) : null}
            </div>

            {/* Band 3: how an animal comes aboard, and the way to start. */}
            <section aria-labelledby="ark-how" className="border-b border-line-200">
                <div className="mx-auto grid w-full max-w-[86rem] grid-cols-1 items-center gap-6 px-4 py-10 md:grid-cols-[minmax(0,1fr)_auto] md:px-8 md:py-14">
                    <div className="max-w-2xl">
                        <h2 id="ark-how" className="font-display text-2xl font-extrabold tracking-tight text-white md:text-3xl">{words.howTitle}</h2>
                        <p className="mt-3 text-base leading-relaxed text-ink-200">{words.howBody}</p>
                        <p className="mt-3 text-[13px] text-ink-400">{words.founderNote}</p>
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
    arkDay: number | null;
    asleep: boolean;
    following: boolean;
    onFollow: () => void;
    storyOpen: boolean;
    onStory: () => void;
    onClose: () => void;
};

/** What the band knows about an animal's life: the life story when the server sent one, else the snapshot's v2 fields. */
function lifeFacts(animal: ArkAnimal, life: ArkLife | null, arkDay: number | null, locale: string) {
    const born = life ? life.origin.kind === "born" : animal.origin === "born";
    const parentsBy = life?.origin.kind === "born" ? life.origin.born_to : animal.bringers?.map((b) => b.label) ?? [];
    const ageDays = life?.ark_age_days ?? (arkDay !== null && typeof animal.born_ark_day === "number" ? Math.max(arkDay - animal.born_ark_day, 0) : null);
    return {
        born,
        bringers: arkJoinLabels(born ? parentsBy : [life?.origin.kind === "arrived" ? life.origin.brought_by ?? animal.brought_by.label : animal.brought_by.label], locale),
        generation: life ? life.generation : animal.generation ?? null,
        ageDays,
        condition: life?.condition ?? animal.condition ?? null
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
function ArkAnimalBand({bandRef, animal, words, locale, talk, arrived, life: state, arkDay, asleep, following, onFollow, storyOpen, onStory, onClose}: BandProps) {
    const life = state?.life ?? null;
    const facts = lifeFacts(animal, life, arkDay, locale);
    const chips = [
        facts.generation !== null && facts.generation > 0 ? fillArkWords(words.life.generationShort, {n: facts.generation}) : null,
        facts.ageDays !== null ? ageText(facts.ageDays, words, locale) : null,
        facts.condition ? words.life[facts.condition] : null,
        asleep ? words.life.asleep : null
    ].filter((chip): chip is string => Boolean(chip));
    const hasLife = Boolean(life) || animal.origin !== undefined;
    return (
        <div ref={bandRef} className="rows-in absolute inset-x-0 bottom-0 border-t border-line-200 bg-canvas-950/[0.95] backdrop-blur-xl" role="region" aria-label={animal.name}>
            <div className="mx-auto w-full max-w-[86rem] px-4 py-3.5 md:px-8 md:py-4">
                <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-start gap-x-3 md:grid-cols-[4rem_minmax(0,1fr)_auto] md:gap-x-5">
                    <span className="flex h-[3.25rem] w-[3.25rem] items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7] md:h-16 md:w-16">
                        <ArkSpeciesIcon src={getSpeciesArtworkUrl(animal.model_slug)} size={64} className="h-[82%] w-[82%] object-contain" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="truncate font-display text-lg font-extrabold leading-tight text-white md:text-xl">{animal.name}</h2>
                        {/* On a phone the open life story needs the room: the name in Latin and the chips (said again below) step aside. */}
                        {animal.scientific_name ? <p className={`truncate text-[13px] italic text-ink-400 ${storyOpen ? "hidden md:block" : ""}`}>{animal.scientific_name}</p> : null}
                        <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px]">
                            <div className="flex gap-1.5"><dt className="text-ink-400">{words.lives}</dt><dd className="font-semibold text-ink-100">{words.zones[animal.zone]}</dd></div>
                            {facts.born ? (
                                <div className="flex min-w-0 gap-1.5"><dt className="shrink-0 text-ink-400">{words.life.bornTo}</dt><dd className="min-w-0 font-semibold text-ink-100">{fillArkWords(words.life.bornToValue, {bringers: facts.bringers})}</dd></div>
                            ) : (
                                <div className="flex gap-1.5"><dt className="text-ink-400">{words.broughtBy}</dt><dd className="font-semibold text-ink-100">{facts.bringers}</dd></div>
                            )}
                            <div className="flex gap-1.5"><dt className="text-ink-400">{facts.born ? words.life.born : words.arrived}</dt><dd className="font-semibold text-ink-100">{arrived}</dd></div>
                        </dl>
                        {chips.length ? (
                            <p className={`mt-1.5 flex-wrap gap-1.5 ${storyOpen ? "hidden md:flex" : "flex"}`}>
                                {chips.map((chip) => (
                                    <span key={chip} className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${chip === words.life.hungry ? "bg-[#5a3a1e] text-[#ffd8a8]" : chip === words.life.asleep ? "bg-[#26304a] text-[#c9d6ff]" : "bg-white/[0.08] text-ink-100"}`}>{chip}</span>
                                ))}
                            </p>
                        ) : null}
                        <ArkStoryLine state={state} born={facts.born} words={words} />
                    </div>
                    <button type="button" onClick={onClose} aria-label={words.close} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-200 hover:bg-white/10 hover:text-white">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                </div>

                {storyOpen ? <ArkLifeStory animal={animal} life={life} facts={facts} words={words} locale={locale} /> : null}

                <div className="mt-3 flex flex-wrap items-center gap-2 md:pl-[5.25rem]">
                    <Link href={`/talk/${animal.model_slug}`} className={`${pill} w-full bg-primary-400 text-canvas-950 hover:bg-primary-100 sm:w-auto`}>
                        {talk}
                        <span aria-hidden="true">→</span>
                    </Link>
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
                </div>
            </div>
        </div>
    );
}

/** The life story in full, inside the band: every line from the server's log. */
function ArkLifeStory({animal, life, facts, words, locale}: {animal: ArkAnimal; life: ArkLife | null; facts: ReturnType<typeof lifeFacts>; words: ArkWords; locale: string}) {
    const w = words.life;
    const rows: Array<[string, string]> = [];
    if (facts.generation !== null) rows.push([w.generation, facts.generation > 0 ? fillArkWords(w.generationBorn, {n: facts.generation}) : w.generationArrived]);
    if (facts.ageDays !== null) rows.push([w.age, ageText(facts.ageDays, words, locale)]);
    if (facts.condition) rows.push([w.condition, w[facts.condition]]);
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
    if (life) rows.push([w.young, life.young_raised > 0 ? life.young_raised.toLocaleString(locale) : w.noYoung]);
    if (life && life.milestones.count > 0) rows.push([w.milestones, fillArkWords(w.milestonesValue, {count: life.milestones.count.toLocaleString(locale)})]);
    // Its line, further back than its parents (the third generation on).
    if (facts.born && (facts.generation ?? 0) >= 2 && life?.ancestor_brought_by) rows.push([w.line, fillArkWords(w.lineValue, {bringer: life.ancestor_brought_by})]);
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
            <p className="mt-2 text-[12px] text-ink-400">{w.anonymous}</p>
        </div>
    );
}

/**
 * How it got aboard: "Came aboard after a step that worked", the same for
 * everyone (or "Born on the Ark"). The public debate's problem and the way
 * that worked only when the life story carries `story_public`, which the
 * server sends only while its `public_story` flag is on. Never anything private.
 */
function ArkStoryLine({state, born, words}: {state: LifeState | null; born: boolean; words: ArkWords}) {
    if (!state || state.loading) return <p aria-hidden="true" className="mt-1.5 h-[1.125rem]" />;
    const told = state.life?.story_public ?? null;
    return (
        <p className="rows-in mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-ink-200">
            <svg viewBox="0 0 16 16" className="mt-[3px] h-3 w-3 shrink-0 text-primary-300" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg>
            <span className="min-w-0">
                {told ? fillArkWords(words.story.debate, {problem: told.problem, animal: told.way.animal, power: told.way.power}) : born ? words.life.bornAboard : words.story.generic}
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
