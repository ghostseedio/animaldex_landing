"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {useHeaderAuth} from "@/app/[locale]/(composited)/_components/header-auth-provider";
import ArkPopulationHud from "@/app/[locale]/(composited)/ark/ark-population-hud";
import type {ArkAnimal, ArkRegion, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkFocusAnimals, arkPickAnimal, arkSpeciesKey, type ArkSpeciesRow} from "@/lib/ark-population";
import {decodeArkStory, fixtureArkStory, type ArkAnimalStory} from "@/lib/ark-story";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";

export type {ArkWords} from "@/lib/ark-words";

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
};

/** The contract's refresh: every 45 s while the tab is in front. */
const REFRESH_MS = 45_000;
const GROW_REFRESH_MS = 8_000;
/** Under this many animals the Ark reads as just beginning. */
const BEGINNING_BELOW = 24;
/** The desktop HUD's fold, kept per reader. */
const FOLD_KEY = "ark.hud.folded";

/** A tapped animal's story: fetched once per animal per visit. */
type StoryState = {id: string; story: ArkAnimalStory | null; loading: boolean};

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

export default function ArkView({locale, initial, growFrom, fixture, signedIn, words, talkTitles, modelBase, focus: focusOn = null}: Props) {
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
    const [story, setStory] = useState<StoryState | null>(null);
    const storiesRef = useRef(new Map<string, ArkAnimalStory | null>());
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
                        onReady: () => setReady(true)
                    });
                    sceneRef.current = handle;
                    // "See it in the Ark" (`?focus=`): straight to that species, the reader's own first.
                    const focused = arkPickAnimal(arkFocusAnimals(snapshotRef.current ?? initial, focusOn), null);
                    if (focused) handle.select(focused.id);
                    if (process.env.NODE_ENV !== "production") (window as unknown as {__arkScene?: ArkSceneHandle}).__arkScene = handle;
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

    // MARK: How it got aboard

    useEffect(() => {
        if (!selected) {
            setStory(null);
            return;
        }
        const id = selected.id;
        if (fixture) {
            setStory({id, story: fixtureArkStory(selected, snapshotRef.current?.animals ?? []), loading: false});
            return;
        }
        const known = storiesRef.current;
        if (known.has(id)) {
            setStory({id, story: known.get(id) ?? null, loading: false});
            return;
        }
        setStory({id, story: null, loading: true});
        const controller = new AbortController();
        fetch(`/api/ark/story/${encodeURIComponent(id)}`, {signal: controller.signal})
            .then((response) => (response.ok ? response.json() : {story: null}))
            .then((body: {story?: unknown}) => {
                const told = decodeArkStory(body.story);
                known.set(id, told);
                setStory({id, story: told, loading: false});
            })
            .catch(() => {
                if (!controller.signal.aborted) setStory({id, story: null, loading: false});
            });
        return () => controller.abort();
    }, [selected, fixture]);

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

                {arrival && !selected ? (
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
                        talk={talkTitle(selected.name, talkTitles)}
                        arrived={dateFormat.format(new Date(selected.arrived_at))}
                        story={story?.id === selected.id ? story : null}
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

/** The tapped animal, as a band along the scene's foot: who it is, and the next move — talking to it. */
function ArkAnimalBand({bandRef, animal, words, talk, arrived, story, onClose}: {bandRef: React.Ref<HTMLDivElement>; animal: ArkAnimal; words: ArkWords; talk: string; arrived: string; story: StoryState | null; onClose: () => void}) {
    return (
        <div ref={bandRef} className="rows-in absolute inset-x-0 bottom-0 border-t border-line-200 bg-canvas-950/[0.95] backdrop-blur-xl" role="region" aria-label={animal.name}>
            <div className="mx-auto grid w-full max-w-[86rem] grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-3.5 md:grid-cols-[4rem_minmax(0,1fr)_auto_auto] md:gap-x-5 md:px-8 md:py-4">
                <span className="flex h-[3.25rem] w-[3.25rem] items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7] md:h-16 md:w-16">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getSpeciesArtworkUrl(animal.model_slug)} alt="" width={64} height={64} className="h-[82%] w-[82%] object-contain" />
                </span>
                <div className="min-w-0">
                    <h2 className="truncate font-display text-lg font-extrabold leading-tight text-white md:text-xl">{animal.name}</h2>
                    {animal.scientific_name ? <p className="truncate text-[13px] italic text-ink-400">{animal.scientific_name}</p> : null}
                    <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px]">
                        <div className="flex gap-1.5"><dt className="text-ink-400">{words.lives}</dt><dd className="font-semibold text-ink-100">{words.zones[animal.zone]}</dd></div>
                        <div className="flex gap-1.5"><dt className="text-ink-400">{words.broughtBy}</dt><dd className="font-semibold text-ink-100">{animal.brought_by.label}</dd></div>
                        <div className="flex gap-1.5"><dt className="text-ink-400">{words.arrived}</dt><dd className="font-semibold text-ink-100">{arrived}</dd></div>
                    </dl>
                    <ArkStoryLine story={story} words={words} />
                </div>
                <button type="button" onClick={onClose} aria-label={words.close} className="col-start-3 row-start-1 flex h-10 w-10 items-center justify-center rounded-full text-ink-200 hover:bg-white/10 hover:text-white md:col-start-4">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
                <Link href={`/talk/${animal.model_slug}`} className={`${pill} col-span-3 bg-primary-400 text-canvas-950 hover:bg-primary-100 md:col-span-1 md:col-start-3 md:row-start-1`}>
                    {talk}
                    <span aria-hidden="true">→</span>
                </Link>
            </div>
        </div>
    );
}

/**
 * How it got aboard: the public debate's problem and the way that worked,
 * when there is one to tell (`voyage_animal_story_v1`); otherwise only that
 * a step worked. Never anything private.
 */
function ArkStoryLine({story, words}: {story: StoryState | null; words: ArkWords}) {
    if (!story || story.loading) return <p aria-hidden="true" className="mt-1.5 h-[1.125rem]" />;
    const told = story.story;
    return (
        <p className="rows-in mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-ink-200">
            <svg viewBox="0 0 16 16" className="mt-[3px] h-3 w-3 shrink-0 text-primary-300" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg>
            <span className="min-w-0">
                {told ? fillArkWords(words.story.debate, {problem: told.problem, animal: told.way.animal, power: told.way.power}) : words.story.generic}
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
