/**
 * The web Ark's own panel and card in the apps' Ark (`public/ark/embed.html`; lane ARK-SIMPLE, decision 446: "clean up
 * android and ios too to match the web"). The 3.3 apps show the embed in their Ark panel, so the panel and card here are
 * /ark's components (`ark-population-hud.tsx`, `ark-animal-card.tsx`, `ark-world-tools.tsx`, the ticker), not copies:
 * who is aboard (folded to its chip on a phone), the thriving / declining ticker, the sound and lines switches, and the
 * tapped animal's card (index number, Power, life bar, its age in human time).
 *
 * Packed on its own (`public/ark/ark-ui.js` + `ark-ui.css`, scripts/build-ark-bundle.mjs) and loaded by the embed once
 * the world is up, so the scene's first frame never waits for React. The app keeps what it does natively: Talk and a
 * founder's profile go to the host (`ark:talk`, `ark:open-profile`), and the capture photo stays the app's own card.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import {createRoot, type Root} from "react-dom/client";
import ArkPopulationHud from "@/app/[locale]/(composited)/ark/ark-population-hud";
import {ArkAnimalCard, type ArkCardLife} from "@/app/[locale]/(composited)/ark/ark-animal-card";
import {ArkWorldTools} from "@/app/[locale]/(composited)/ark/ark-world-tools";
import {ARK_TICKER_SLOT} from "@/app/[locale]/(composited)/ark/ark-population-hud";
import type {ArkAnimal, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import {cardSaysAsleep} from "@/ark-scene/behaviour-card";
import {arkPickAnimal, arkSpeciesKey, type ArkSpeciesRow} from "@/lib/ark-population";
import {readArkPopulationThen, type ArkPopulationThen} from "@/lib/ark-population-change";
import {decodeArkLife, type ArkLife} from "@/lib/ark-life";
import {ARK_NO_FOUNDERS, type ArkFounders} from "@/lib/ark-founders";
import {arkRelationLinesOn, arkSetRelationLinesOn, ARK_RELATION_LINES_EVENT} from "@/lib/ark-relations";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";
import {setArkEmbedLinkHandler} from "@/ark-scene/embed-ui/link-shim";

export type ArkEmbedUiOptions = {
    scene: () => ArkSceneHandle | null;
    words: ArkWords;
    locale: string;
    /** "Talk to a {animal}" / "Talk to an {animal}", in the app's language. */
    talkTitles: {a: string; an: string};
    founders: () => ArkFounders | null;
    /** The event log (24-hour change) and the population record (the lines and the ticker); null: none (fixtures). */
    eventsUrl: string | null;
    populationUrl: string | null;
    /** `/api/ark/life/<id>` base; null: no life story (fixtures). */
    lifeUrl: string | null;
    /** Sound: the page's own switch (the scene's audio), told here so the button shows it. */
    sound: {on: () => boolean; set: (on: boolean) => void};
    /** A link the panel or card opens: true when the host took it (Talk, a profile). */
    onLink: (href: string, animal: ArkAnimal | null) => boolean;
};

type State = {snapshot: ArkSnapshot | null; selected: ArkAnimal | null; words: ArkWords; locale: string; soundOn: boolean};

function storage(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function talkTitle(name: string, titles: {a: string; an: string}): string {
    const template = /^[aeiou]/i.test(name) && !/^(uni|eu|one|use|usu|ura)/i.test(name) ? titles.an : titles.a;
    return template.replace("{animal}", name);
}

/** Where the overlays at the world's top end (the ticker, the switches, the folded chip), in CSS pixels from the top. */
function overlaysBottom(): number {
    let bottom = 0;
    document.querySelectorAll<HTMLElement>(`#${ARK_TICKER_SLOT}, #ark-aboard > button, #ark-ui [role="switch"]`).forEach((element) => {
        const box = element.getBoundingClientRect();
        if (box.height > 0) bottom = Math.max(bottom, box.bottom);
    });
    return bottom;
}

function EmbedUi({store, options}: {store: Store; options: ArkEmbedUiOptions}) {
    const state = useSyncExternalStore(store.subscribe, store.get);
    const {snapshot, selected, words, locale, soundOn} = state;
    const scene = options.scene;

    // The 24-hour change (the total's badge): the event log read once, a moment after the Ark is read.
    const [then, setThen] = useState<ArkPopulationThen | null>(null);
    const thenAsked = useRef(false);
    useEffect(() => {
        if (!snapshot || thenAsked.current || !options.eventsUrl) return;
        thenAsked.current = true;
        const url = options.eventsUrl;
        const timer = window.setTimeout(() => {
            void readArkPopulationThen(url, snapshot, {fetch: (u) => fetch(u), storage: storage()}).then(setThen).catch(() => undefined);
        }, 1500);
        return () => window.clearTimeout(timer);
    }, [snapshot, options.eventsUrl]);

    // Herds (A14): a row of a herded kind selects its herd, as on /ark.
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

    // The lines switch (shown with a card, as on /ark), kept with the site's own preference.
    const [linesOn, setLinesOn] = useState(() => arkRelationLinesOn());
    useEffect(() => {
        const sync = () => setLinesOn(arkRelationLinesOn());
        window.addEventListener(ARK_RELATION_LINES_EVENT, sync);
        return () => window.removeEventListener(ARK_RELATION_LINES_EVENT, sync);
    }, []);

    // The tapped animal's life story (`/api/ark/life/<id>`), once per animal per visit.
    const lives = useRef(new Map<string, ArkLife | null>());
    const [life, setLife] = useState<ArkCardLife | null>(null);
    useEffect(() => {
        if (!selected) {
            setLife(null);
            return;
        }
        const id = selected.id;
        if (!options.lifeUrl) {
            setLife({id, life: null, loading: false});
            return;
        }
        if (lives.current.has(id)) {
            setLife({id, life: lives.current.get(id) ?? null, loading: false});
            return;
        }
        setLife({id, life: null, loading: true});
        const controller = new AbortController();
        fetch(`${options.lifeUrl}/${encodeURIComponent(id)}`, {signal: controller.signal})
            .then((response) => (response.ok ? response.json() : {life: null}))
            .then((body: {life?: unknown}) => {
                const told = decodeArkLife(body.life);
                lives.current.set(id, told);
                setLife({id, life: told, loading: false});
            })
            .catch(() => {
                if (!controller.signal.aborted) setLife({id, life: null, loading: false});
            });
        return () => controller.abort();
    }, [selected, options.lifeUrl]);

    // What it is doing and how it rests: the scene's, read while the card is open.
    const [tick, setTick] = useState(0);
    useEffect(() => {
        if (!selected) return;
        const timer = window.setInterval(() => setTick((n) => n + 1), 1000);
        return () => window.clearInterval(timer);
    }, [selected]);
    const live = scene();
    const asleep = selected && live ? cardSaysAsleep(live.behaviour(selected.id)) : false;
    const rest = selected && live ? live.rest(selected.id) ?? null : null;
    void tick;

    const [following, setFollowing] = useState(false);
    const [storyOpen, setStoryOpen] = useState(false);
    useEffect(() => {
        setFollowing(false);
        setStoryOpen(false);
    }, [selected?.id]);

    // The card's band: the world's view moves up over it, and the page's own notices step aside (`data-ark-card`).
    const bandRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const root = document.documentElement;
        const band = bandRef.current;
        const set = (height: number) => {
            root.style.setProperty("--ark-card-h", `${Math.round(height)}px`);
            // The scene centres the animal over the card; here the ticker, the switches and the chip hold the world's top
            // too (the app's own bar above them), so the centre is the free band between those and the card.
            const top = height > 0 ? overlaysBottom() : 0;
            scene()?.setViewInset(Math.max(height - top, 0));
        };
        if (!selected || !band) {
            delete root.dataset.arkCard;
            set(0);
            return;
        }
        root.dataset.arkCard = "1";
        const apply = () => set(band.getBoundingClientRect().height);
        apply();
        const observer = new ResizeObserver(apply);
        observer.observe(band);
        return () => observer.disconnect();
    }, [selected, scene]);

    // Its links: Talk and a profile go to the app when there is one.
    const selectedRef = useRef(selected);
    selectedRef.current = selected;
    useEffect(() => {
        setArkEmbedLinkHandler((href) => options.onLink(href, selectedRef.current));
        return () => setArkEmbedLinkHandler(null);
    }, [options]);

    const pick = useCallback((row: ArkSpeciesRow) => {
        const handle = scene();
        if (!handle) return;
        const herdKey = [row.key, ...row.breeds.map((breed) => breed.key)].find((key) => herdKeys.has(key));
        if (herdKey && handle.selectHerd(herdKey)) return;
        const animal = arkPickAnimal(row.animals, selectedRef.current?.id ?? null);
        if (animal) handle.select(animal.id);
    }, [scene, herdKeys]);

    const founders = options.founders() ?? ARK_NO_FOUNDERS;
    const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, {day: "numeric", month: "long", year: "numeric"}), [locale]);
    const counts = snapshot?.counts ?? {animals: 0, species: 0, founders: 0};
    const selectedKey = selected ? arkSpeciesKey(selected) : null;

    return (
        <>
            {/* The thriving / declining ticker: on /ark it runs under the Ark's name; here, across the top of the world. */}
            <div className="pointer-events-auto absolute inset-x-3 top-[calc(var(--ark-inset-top,0px)+env(safe-area-inset-top,0px)+0.5rem)] z-[3]">
                <div id={ARK_TICKER_SLOT} className="ark-glass flex h-8 min-w-0 items-center overflow-hidden rounded-full px-1" />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[calc(var(--ark-inset-top,0px)+env(safe-area-inset-top,0px)+2.75rem)] z-[2] grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto_minmax(0,1fr)] gap-2 p-3 pb-[calc(4rem+var(--ark-card-h,0px))] md:grid-rows-[auto_minmax(0,1fr)] md:gap-x-3">
                <ArkWorldTools
                    words={words}
                    locale={locale}
                    islands={null}
                    lite={null}
                    sound={{on: soundOn, onToggle: () => options.sound.set(!soundOn)}}
                    lines={selected ? {on: linesOn, onToggle: () => arkSetRelationLinesOn(!linesOn), label: `${words.relations?.title ?? "Around it"}: ${words.relations?.lines ?? "Lines"}`, hint: words.relations?.note ?? "Shows who could, never who will."} : null}
                />
                <ArkPopulationHud
                    snapshot={snapshot}
                    counts={counts}
                    listed={snapshot}
                    scope="both"
                    then={then}
                    totalThen={then}
                    words={words}
                    locale={locale}
                    selectedKey={selectedKey}
                    selectedId={selected?.id}
                    herdKeys={herdKeys}
                    arrivalKey={null}
                    onSpecies={pick}
                    populationUrl={options.populationUrl}
                />
            </div>
            {selected ? (
                <ArkAnimalCard
                    bandRef={bandRef}
                    animal={selected}
                    words={words}
                    locale={locale}
                    talk={talkTitle(selected.name, options.talkTitles)}
                    arrived={dateFormat.format(new Date(selected.arrived_at))}
                    life={life?.id === selected.id ? life : null}
                    founders={founders.animals[selected.id] ?? null}
                    // The capture photo is the app's own card (ark:selected), not a second one here.
                    photo={null}
                    arkDay={snapshot?.ark_day ?? null}
                    voyageStart={snapshot?.voyage.started_at ?? null}
                    scene={scene}
                    asleep={asleep}
                    rest={rest}
                    following={following}
                    onFollow={() => {
                        const next = !following;
                        scene()?.follow(next ? selected.id : null);
                        setFollowing(next);
                    }}
                    storyOpen={storyOpen}
                    onStory={() => setStoryOpen((open) => !open)}
                    onClose={() => scene()?.select(null)}
                    focusOnOpen={false}
                    share={{
                        localePath: "/ark",
                        text: fillArkWords(words.share.textAnimal, {animal: selected.name, count: (snapshot?.animals.filter((animal) => arkSpeciesKey(animal) === selectedKey).length ?? 1).toLocaleString(locale)})
                    }}
                    lives={null}
                    snapshot={snapshot}
                />
            ) : null}
        </>
    );
}

type Store = {get: () => State; set: (patch: Partial<State>) => void; subscribe: (listener: () => void) => () => void};

function createStore(initial: State): Store {
    let state = initial;
    const listeners = new Set<() => void>();
    return {
        get: () => state,
        set: (patch) => {
            state = {...state, ...patch};
            listeners.forEach((listener) => listener());
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
}

export type ArkEmbedUi = {
    snapshot: (snapshot: ArkSnapshot) => void;
    setSelected: (animal: ArkAnimal | null) => void;
    setWords: (words: ArkWords, locale: string) => void;
    setSound: (on: boolean) => void;
    dispose: () => void;
};

/** Mounts the panel and card over the world (`host`: the embed's overlay layer). */
export function mountArkEmbedUi(host: HTMLElement, options: ArkEmbedUiOptions): ArkEmbedUi {
    const store = createStore({snapshot: null, selected: null, words: options.words, locale: options.locale, soundOn: options.sound.on()});
    const root: Root = createRoot(host);
    root.render(<EmbedUi store={store} options={options} />);
    return {
        snapshot: (snapshot) => store.set({snapshot}),
        setSelected: (animal) => {
            if ((store.get().selected?.id ?? null) !== (animal?.id ?? null)) store.set({selected: animal});
        },
        setWords: (words, locale) => store.set({words, locale}),
        setSound: (on) => store.set({soundOn: on}),
        dispose: () => root.unmount()
    };
}

declare global {
    interface Window {
        AnimalDexArkUi?: {mountArkEmbedUi: typeof mountArkEmbedUi};
    }
}

window.AnimalDexArkUi = {mountArkEmbedUi};
