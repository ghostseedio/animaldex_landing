"use client";

/**
 * The Ark beside the animal chat, as an artifact sits beside a conversation
 * (the owner, 2026-11-10): the header's "Ark" opens it on the right, the
 * chat and the world side by side from 1024 px (a fixed share of the width
 * the reader can drag), full screen over the chat below that, with a back
 * control. On a phone a right-to-left swipe across the chat opens it and a
 * left-to-right swipe closes it. Open or closed is remembered per browser.
 *
 * The panel shows the live Ark (`voyage_public_v1`, read again every 45 s
 * while visible) with the camera on the chat's animal: its own kind when
 * one is aboard, else the animal itself as a visitor at the landing,
 * labelled as not aboard (never counted, never on /ark). While the animal
 * answers in the chat it talks there too: the conversation tells
 * (`animal-voice.ts`) and the scene's talking model moves its jaw with the
 * words, or with the voice when the reply is heard aloud.
 *
 * The scene is loaded only when the panel first opens, so the chat stays fast.
 *
 * Part 2 (docs/ark-next.md): when a step that worked brings one of the
 * reader's animals aboard while the chat is open (`arrival-bus`), the panel,
 * open then or opened in the next few minutes, reads the Ark again (the
 * newcomer plays its entrance) and flies to it, face to face. The chat's
 * arrival line opens the panel on it ("See it in the Ark").
 */

import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import Link from "@/app/[locale]/_components/link";
import type {ArkAnimal, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {emitAnimalVoice, onAnimalVoice, voiceIsAbout} from "@/lib/ark/animal-voice";
import {arkIconFallback, arkIconUrl} from "@/ark-scene/placeholder-icon";
import {arkBringerLabel} from "@/lib/ark-life";
import {arkFoundersOf, ARK_NO_FOUNDERS, decodeArkFounders, type ArkFounders} from "@/lib/ark-founders";
import {ArkFounderAvatar, ArkFounderLink, ArkFounderStoryBlock, arkTemplateParts} from "@/components/ark/ark-founder-bits";
import {emitArkArrival, onArkArrival, recentArkArrival, type ArkArrivalEvent} from "@/lib/ark/arrival-bus";
import {noteArkArrivalsSeen, startArkSession, trackArk} from "@/lib/ark-measure-client";
import {loadTalkingModelManifest, TALKING_MODELS_BASE_URL, talkingModelSlugFor} from "@/lib/talking-models/catalog";
import type {TalkWords} from "@/lib/ask-animaldex/talk";

const OPEN_KEY = "animaldex:ark-panel";
const WIDTH_KEY = "animaldex:ark-panel-width";
const REFRESH_MS = 45_000;
const DEFAULT_WIDTH = 45;
const MIN_WIDTH = 30;
const MAX_WIDTH = 64;

export type ArkPanelSubject = {slug: string | null; name: string | null; speciesProfileId: string | null};

type ArkPanelContext = {open: boolean; toggle: () => void; show: (animal: ArkAnimal) => void; words: TalkWords};
const PanelContext = createContext<ArkPanelContext | null>(null);

/**
 * For the chat beside the panel: whether it is open, and `show`, which opens
 * it on one of the reader's animals (the arrival line's "See it in the Ark").
 * Null in a chat without a panel.
 */
export function useArkPanelControl(): {open: boolean; show: (animal: ArkAnimal) => void} | null {
    const context = useContext(PanelContext);
    return useMemo(() => (context ? {open: context.open, show: context.show} : null), [context]);
}

function readStored(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeStored(key: string, value: string) {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // For this page, then.
    }
}

function useWide(): boolean {
    const [wide, setWide] = useState(false);
    useEffect(() => {
        const query = window.matchMedia("(min-width: 1024px)");
        const update = () => setWide(query.matches);
        update();
        query.addEventListener?.("change", update);
        return () => query.removeEventListener?.("change", update);
    }, []);
    return wide;
}

/** The header's "Ark": inside the conversation's header, beside its own buttons. */
export function ArkPanelButton() {
    const context = useContext(PanelContext);
    if (!context) return null;
    const {open, toggle, words} = context;
    return (
        <button
            type="button"
            onClick={toggle}
            aria-pressed={open}
            aria-label={open ? words.arkClose : words.arkOpenLabel}
            title={open ? words.arkClose : words.arkOpenLabel}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors ${open ? "border-primary-400/60 bg-primary-400/12 text-primary-200" : "border-white/12 text-ink-200 hover:border-white/25 hover:text-white"}`}
            data-testid="ark-panel-toggle"
        >
            <ArkGlyph />
            <span>{words.arkOpen}</span>
        </button>
    );
}

function ArkGlyph() {
    return (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.5 12.5h15l-2.2 3.2a2 2 0 0 1-1.7.8H6.4a2 2 0 0 1-1.7-.8z" />
            <path d="M6 12.5V8.8h8v3.7" />
            <path d="M10 8.8V3.5" />
            <path d="M10 4l3.2 2.2L10 7" />
        </svg>
    );
}

/**
 * The chat with the Ark beside it. `children` is the conversation; give it
 * `<ArkPanelButton />` as its header accessory.
 */
export function ArkSplit({subject, words, locale, children}: {subject: ArkPanelSubject; words: TalkWords; locale: string; children: ReactNode}) {
    const wide = useWide();
    const [open, setOpen] = useState(false);
    const [everOpened, setEverOpened] = useState(false);
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    useEffect(() => {
        const stored = readStored(OPEN_KEY) === "open";
        // Below 1024 px it opens over the chat: never on its own when the page loads.
        if (stored && window.matchMedia("(min-width: 1024px)").matches) {
            setOpen(true);
            setEverOpened(true);
        }
        const storedWidth = Number(readStored(WIDTH_KEY));
        if (Number.isFinite(storedWidth) && storedWidth >= MIN_WIDTH && storedWidth <= MAX_WIDTH) setWidth(storedWidth);
    }, []);
    const setOpenRemembered = useCallback((next: boolean) => {
        setOpen(next);
        if (next) setEverOpened(true);
        writeStored(OPEN_KEY, next ? "open" : "closed");
    }, []);
    const toggle = useCallback(() => setOpenRemembered(!open), [open, setOpenRemembered]);
    // Told as an arrival: the panel, open or opening now, flies to it.
    const show = useCallback((animal: ArkAnimal) => {
        emitArkArrival({animal, slug: subject.slug, speciesProfileId: subject.speciesProfileId});
        setOpenRemembered(true);
    }, [setOpenRemembered, subject.slug, subject.speciesProfileId]);
    const context = useMemo(() => ({open, toggle, show, words}), [open, toggle, show, words]);

    // A phone: a right-to-left swipe across the chat (not from the screen's edge, not over something that scrolls sideways) opens the Ark.
    const chatRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const element = chatRef.current;
        if (!element || wide) return;
        let start: {x: number; y: number; time: number} | null = null;
        const scrollsSideways = (target: EventTarget | null) => {
            let node = target instanceof Element ? target : null;
            while (node && node !== element) {
                const style = window.getComputedStyle(node);
                if (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 2) return true;
                if (node.matches("input, textarea, [contenteditable='true']")) return true;
                node = node.parentElement;
            }
            return false;
        };
        const onStart = (event: TouchEvent) => {
            const touch = event.touches[0];
            if (event.touches.length !== 1 || !touch) return;
            const fromEdge = touch.clientX < 24 || touch.clientX > window.innerWidth - 24;
            start = fromEdge || scrollsSideways(event.target) ? null : {x: touch.clientX, y: touch.clientY, time: performance.now()};
        };
        const onEnd = (event: TouchEvent) => {
            const touch = event.changedTouches[0];
            if (!start || !touch) return;
            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y;
            const quick = performance.now() - start.time < 700;
            start = null;
            if (quick && dx < -70 && Math.abs(dy) < Math.abs(dx) * 0.5) setOpenRemembered(true);
        };
        element.addEventListener("touchstart", onStart, {passive: true});
        element.addEventListener("touchend", onEnd, {passive: true});
        return () => {
            element.removeEventListener("touchstart", onStart);
            element.removeEventListener("touchend", onEnd);
        };
    }, [wide, setOpenRemembered]);

    // Desktop: drag the panel's edge to make it wider or narrower.
    const splitRef = useRef<HTMLDivElement | null>(null);
    const startDrag = (event: React.PointerEvent) => {
        const split = splitRef.current;
        if (!split) return;
        event.preventDefault();
        const rect = split.getBoundingClientRect();
        const move = (moveEvent: PointerEvent) => {
            const share = ((rect.right - moveEvent.clientX) / rect.width) * 100;
            setWidth(Math.min(Math.max(share, MIN_WIDTH), MAX_WIDTH));
        };
        const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            setWidth((current) => {
                writeStored(WIDTH_KEY, String(Math.round(current)));
                return current;
            });
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
    };

    const showPanel = everOpened && open;
    return (
        <PanelContext.Provider value={context}>
            <div ref={splitRef} className="flex min-h-0 min-w-0 flex-1" data-testid="ark-split">
                <div ref={chatRef} className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
                {showPanel && wide ? (
                    <aside className="relative flex min-h-0 shrink-0 flex-col border-l border-white/10 bg-canvas-950" style={{width: `${width}%`}} aria-label={words.arkTitle} data-testid="ark-panel">
                        <div
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={words.arkTitle}
                            onPointerDown={startDrag}
                            className="group absolute inset-y-0 -left-1.5 z-10 w-3 cursor-col-resize"
                        >
                            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-primary-400/50" />
                        </div>
                        <ArkChatPanel subject={subject} words={words} locale={locale} onClose={() => setOpenRemembered(false)} mobile={false} />
                    </aside>
                ) : null}
                {showPanel && !wide ? (
                    <div className="ark-panel-over fixed inset-0 z-[60] flex flex-col bg-canvas-950" aria-label={words.arkTitle} data-testid="ark-panel">
                        <ArkChatPanel subject={subject} words={words} locale={locale} onClose={() => setOpenRemembered(false)} mobile />
                    </div>
                ) : null}
            </div>
        </PanelContext.Provider>
    );
}

// MARK: - The panel

type Focus = {kind: "aboard"; animal: ArkAnimal} | {kind: "visitor"; animal: ArkAnimal} | null;

const EMPTY_SNAPSHOT: ArkSnapshot = {voyage: {slug: "first", name: "", started_at: null}, counts: {animals: 0, species: 0, founders: 0}, zones: [], animals: [], as_of: null};

/** Development's fixtures (`?arkfixture=1|early|founders`) and its talking demo (`?arktalk=1`). */
function devParam(name: string): string | null {
    if (process.env.NODE_ENV !== "development") return null;
    try {
        return new URLSearchParams(window.location.search).get(name);
    } catch {
        return null;
    }
}

/** The Ark now; `onFounders` gets the named founders and shared stories beside it (founders contract). */
async function readSnapshot(onFounders?: (founders: ArkFounders) => void): Promise<ArkSnapshot | null> {
    const fixture = devParam("arkfixture");
    if (fixture === "early") return decodeArkSnapshot((await import("@/ark-scene/fixtures/snapshot-early.json")).default);
    if (fixture === "founders") {
        // As the server answers with its founder_names switch on (made-up founders, src/lib/ark-founders-fixture.ts).
        const raw = (await import("@/lib/ark-founders-fixture")).withArkFixtureFounders((await import("@/ark-scene/fixtures/snapshot-v2.json")).default);
        onFounders?.(arkFoundersOf(raw));
        return decodeArkSnapshot(raw);
    }
    if (fixture) return decodeArkSnapshot((await import("@/ark-scene/fixtures/snapshot.json")).default);
    try {
        const response = await fetch("/api/ark/voyage", {cache: "no-store"});
        if (!response.ok) return null;
        const body = await response.json() as {snapshot?: unknown; founders?: unknown};
        const snapshot = decodeArkSnapshot(body.snapshot);
        if (snapshot) onFounders?.(decodeArkFounders(body.founders));
        return snapshot;
    } catch {
        return null;
    }
}

const DEMO_REPLY = "Patience is not waiting. It is watching closely, then moving once, when the moment is right. Try that today: one move, made at the right time.";

function ArkChatPanel({subject, words, locale, onClose, mobile}: {subject: ArkPanelSubject; words: TalkWords; locale: string; onClose: () => void; mobile: boolean}) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<ArkSceneHandle | null>(null);
    const focusIdRef = useRef<string | null>(null);
    const modelSlugRef = useRef<string | null>(null);
    const [snapshot, setSnapshot] = useState<ArkSnapshot | null>(null);
    const [founders, setFounders] = useState<ArkFounders>(ARK_NO_FOUNDERS);
    const keepFounders = useCallback((next: ArkFounders) => setFounders((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next)), []);
    const snapshotRef = useRef<ArkSnapshot | null>(null);
    snapshotRef.current = snapshot;
    const [failed, setFailed] = useState(false);
    const [ready, setReady] = useState(false);
    const [focus, setFocus] = useState<Focus>(null);
    const [selected, setSelected] = useState<ArkAnimal | null>(null);
    const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, {day: "numeric", month: "short", year: "numeric"}), [locale]);

    // Ark measurement (lib/ark-measure): the panel open is a visit, timed while it is on screen.
    useEffect(() => startArkSession("chat_panel"), []);
    // The panel's own move to the chat's animal is not a tap: only the reader's are counted.
    const autoSelecting = useRef(false);
    const onSelect = useCallback((animal: ArkAnimal | null) => {
        setSelected(animal);
        if (animal && !autoSelecting.current) trackArk("ark_animal_tap", {source: "chat_panel", species_profile_id: animal.species_profile_id || undefined, is_mine: animal.mine});
    }, []);
    // The reader's own animals aboard, once the world is on screen: their arrival seen.
    useEffect(() => {
        if (ready && snapshot) noteArkArrivalsSeen(snapshot.animals, "chat_panel");
    }, [ready, snapshot]);

    // The Ark, now and every 45 s while the tab is in front.
    useEffect(() => {
        let stopped = false;
        const read = async () => {
            const next = await readSnapshot(keepFounders);
            if (stopped) return;
            setSnapshot((current) => next ?? current ?? EMPTY_SNAPSHOT);
            if (next) sceneRef.current?.update(next);
        };
        void read();
        const timer = window.setInterval(() => {
            if (document.visibilityState === "visible") void read();
        }, REFRESH_MS);
        return () => {
            stopped = true;
            window.clearInterval(timer);
        };
    }, [keepFounders]);

    // The scene, once there is an Ark to show; focused on the chat's animal.
    const hasSnapshot = snapshot !== null;
    useEffect(() => {
        const el = mountRef.current;
        if (!el || !hasSnapshot) return;
        let disposed = false;
        let handle: ArkSceneHandle | null = null;
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        const models = (process.env.NEXT_PUBLIC_ARK_MODELS_URL?.trim() || `${TALKING_MODELS_BASE_URL}/ark`).replace(/\/+$/, "");
        Promise.all([import("@/ark-scene"), loadTalkingModelManifest()])
            .then(([{mountArk}, manifest]) => {
                if (disposed || !snapshot) return;
                const modelSlug = talkingModelSlugFor(manifest, [subject.slug, subject.name]) ?? subject.slug;
                modelSlugRef.current = modelSlug;
                try {
                    handle = mountArk(el, {
                        snapshot,
                        modelBase: models,
                        talkingBase: TALKING_MODELS_BASE_URL,
                        iconUrl: arkIconUrl,
                        onSelect,
                        reducedMotion,
                        onReady: () => setReady(true)
                    });
                } catch (error) {
                    console.warn("[ark] the panel's scene could not start", error);
                    setFailed(true);
                    return;
                }
                sceneRef.current = handle;
                if (process.env.NODE_ENV !== "production") (window as unknown as {__arkPanel?: ArkSceneHandle}).__arkPanel = handle;
                // Its own kind aboard: the newest one. Else the animal itself, visiting.
                const aboard = [...snapshot.animals]
                    .filter((animal) => animal.model_slug === modelSlug || (subject.speciesProfileId !== null && animal.species_profile_id === subject.speciesProfileId))
                    .sort((a, b) => b.arrived_at.localeCompare(a.arrived_at))[0];
                autoSelecting.current = true;
                if (aboard) {
                    focusIdRef.current = aboard.id;
                    setFocus({kind: "aboard", animal: aboard});
                    handle.select(aboard.id, true);
                } else if (modelSlug) {
                    const id = handle.setVisitor({slug: modelSlug, name: subject.name ?? modelSlug, label: words.arkVisiting});
                    focusIdRef.current = id;
                    if (id) {
                        setFocus({kind: "visitor", animal: {id, species_profile_id: "", name: subject.name ?? modelSlug, scientific_name: null, model_slug: modelSlug, zone: "seashore", arrived_at: "", brought_by: {label: "", named: false}, mine: false}});
                        handle.select(id, true);
                    }
                }
                autoSelecting.current = false;
            })
            .catch(() => setFailed(true));
        return () => {
            disposed = true;
            handle?.dispose();
            sceneRef.current = null;
        };
        // Mounted once per subject; later snapshots go through update().
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSnapshot, subject.slug, subject.speciesProfileId]);

    // The chat's animal talking: its jaw follows the words as they appear, or the voice.
    useEffect(() => onAnimalVoice((event) => {
        const scene = sceneRef.current;
        const slug = modelSlugRef.current;
        if (!scene || !slug || !voiceIsAbout(event, subject)) return;
        if (event.kind === "talking") scene.setTalking({slug, animalId: focusIdRef.current, active: event.active});
        else if (event.kind === "text") scene.talkText(event.chunk);
        else scene.talkPulse(0.9);
    }), [subject]);

    // An arrival of the reader's (a step that worked, Part 2): read the Ark again so it plays its entrance, then fly to it.
    const arrive = useCallback(async (event: ArkArrivalEvent) => {
        const scene = sceneRef.current;
        if (!scene || !voiceIsAbout(event, subject)) return;
        const read = await readSnapshot(keepFounders);
        const current = read ?? snapshotRef.current;
        if (!current || sceneRef.current !== scene) return;
        // Not in the read yet (a cached answer, or the dev fixture): it comes aboard from the chat's own read.
        const next = current.animals.some((animal) => animal.id === event.animal.id)
            ? current
            : {...current, animals: [...current.animals, event.animal], counts: {...current.counts, animals: current.counts.animals + 1}};
        setSnapshot(next);
        scene.update(next);
        focusIdRef.current = event.animal.id;
        setFocus({kind: "aboard", animal: event.animal});
        autoSelecting.current = true;
        scene.select(event.animal.id, true);
        autoSelecting.current = false;
        noteArkArrivalsSeen([event.animal], "chat_panel");
    }, [subject, keepFounders]);
    useEffect(() => onArkArrival((event) => void arrive(event)), [arrive]);
    // Opened just after one landed (or from its line): fly to it once the world is drawn.
    useEffect(() => {
        if (!ready) return;
        const recent = recentArkArrival();
        if (recent) void arrive(recent);
    }, [ready, arrive]);
    // Development: `window.__arkArrive()` plays an arrival of this chat's kind in the panel (a copy of a fixture animal, made the reader's).
    useEffect(() => {
        if (process.env.NODE_ENV === "production" || !ready) return;
        const target = window as unknown as {__arkArrive?: (id?: string) => void};
        target.__arkArrive = (id?: string) => {
            const base = snapshotRef.current?.animals.find((animal) => (id ? animal.id === id : animal.model_slug === modelSlugRef.current)) ?? snapshotRef.current?.animals[0];
            if (!base) return;
            const animal = id ? {...base, mine: true} : {...base, id: `${base.id.slice(0, -4)}${Math.floor(1000 + Math.random() * 8999)}`, mine: true, arrived_at: new Date().toISOString(), brought_by: {label: "Voyager 1", named: false}};
            emitArkArrival({animal, slug: subject.slug, speciesProfileId: subject.speciesProfileId});
        };
        return () => {
            delete target.__arkArrive;
        };
    }, [ready, subject]);

    // Development: a canned reply typed into the panel every few seconds (`?arktalk=1`), through the same path the chat uses.
    useEffect(() => {
        if (!ready || devParam("arktalk") !== "1") return;
        let cancelled = false;
        const timers: number[] = [];
        const play = () => {
            if (cancelled) return;
            emitAnimalVoice({kind: "talking", active: true, ...subject});
            const wordsOf = DEMO_REPLY.split(/(?<=\s)/u);
            wordsOf.forEach((word, index) => {
                timers.push(window.setTimeout(() => emitAnimalVoice({kind: "text", chunk: word, ...subject}), 400 + index * 140));
            });
            timers.push(window.setTimeout(() => emitAnimalVoice({kind: "talking", active: false, ...subject}), 600 + wordsOf.length * 140));
            timers.push(window.setTimeout(play, 3000 + wordsOf.length * 140));
        };
        timers.push(window.setTimeout(play, 1500));
        return () => {
            cancelled = true;
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [ready, subject]);

    const count = snapshot?.counts.animals ?? 0;
    const shown = selected ?? focus?.animal ?? null;
    const isVisitor = Boolean(shown && shown.id.startsWith("visitor:"));
    // Founders (founders contract, section 5): the named founder linked, and the story they shared.
    const named = shown && !isVisitor ? founders.animals[shown.id] ?? null : null;
    const arrivedOn = shown?.arrived_at ? dateFormat.format(new Date(shown.arrived_at)) : "";
    const [beforeFounder, afterFounder] = arkTemplateParts(words.arkBroughtBy.replace("{date}", arrivedOn), "founder");

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex h-[57px] shrink-0 items-center gap-2 border-b border-white/10 px-4">
                {mobile ? (
                    <button type="button" onClick={onClose} aria-label={words.arkBack} title={words.arkBack} className="-ml-1.5 grid h-9 w-9 place-items-center rounded-full text-ink-200 hover:bg-white/8 hover:text-white" data-testid="ark-panel-back">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
                    </button>
                ) : null}
                <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-5 text-white">{words.arkTitle}</p>
                    <p className="truncate text-[11px] leading-4 text-ink-400">{words.arkCount.replace("{animals}", count.toLocaleString(locale))}</p>
                </div>
                {mobile ? null : (
                    <button type="button" onClick={onClose} aria-label={words.arkClose} title={words.arkClose} className="grid h-8 w-8 place-items-center rounded-full text-ink-300 hover:bg-white/8 hover:text-white" data-testid="ark-panel-close">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                )}
            </header>

            <PanelSwipeBack enabled={mobile} onBack={onClose}>
                <div className="relative min-h-0 flex-1 bg-[#cfc3ae]">
                    {!failed ? <div ref={mountRef} className="absolute inset-0" /> : null}
                    {!ready && !failed ? (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#cfc3ae]">
                            <p className="animate-pulse text-sm font-semibold text-[#4d4636] motion-reduce:animate-none">{words.arkLoading}</p>
                        </div>
                    ) : null}
                    {failed ? (
                        <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
                            <p className="text-sm font-semibold text-[#3d3829]">{words.arkUnavailable}</p>
                        </div>
                    ) : null}
                </div>
            </PanelSwipeBack>

            {/* Who it is, and the way on: the full Ark. */}
            <div className="shrink-0 border-t border-white/10 bg-canvas-950 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3.5">
                {shown ? (
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={arkIconUrl(shown.model_slug)} alt="" onError={arkIconFallback} width={44} height={44} className="h-[82%] w-[82%] object-contain" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold leading-5 text-white">{shown.name}</p>
                            {isVisitor ? (
                                <>
                                    <p className="truncate text-[12px] font-semibold leading-4 text-primary-300" data-testid="ark-panel-visiting">{words.arkVisiting}</p>
                                    <p className="text-[12px] leading-4 text-ink-400">{words.arkComesAboard}</p>
                                </>
                            ) : (
                                <>
                                    <p className="truncate text-[12px] font-semibold leading-4 text-primary-300">{words.arkAboard}</p>
                                    {named?.brought_by ? (
                                        <p className="flex min-w-0 items-center gap-1 text-[12px] leading-4 text-ink-400" data-testid="ark-panel-founder">
                                            {beforeFounder.trim() ? <span className="shrink-0">{beforeFounder.trim()}</span> : null}
                                            <ArkFounderAvatar founder={named.brought_by} size={16} />
                                            <ArkFounderLink founder={named.brought_by} className="min-w-0 truncate font-semibold text-ink-200 underline decoration-white/25 underline-offset-2 hover:text-primary-200" />
                                            {afterFounder.trim() ? <span className="shrink-0 truncate">{afterFounder.trim()}</span> : null}
                                        </p>
                                    ) : (
                                        <p className="truncate text-[12px] leading-4 text-ink-400">
                                            {words.arkBroughtBy.replace("{founder}", arkBringerLabel(shown.brought_by.label, words.arkFormerVoyager)).replace("{date}", arrivedOn)}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ) : null}
                {/* D6: a capture's animal's story is of a step that keeps it thriving; one a step brought, of how it got aboard. */}
                {named?.story ? <ArkFounderStoryBlock story={named.story} founder={named.brought_by} title={shown?.source === "capture" ? words.arkHowThriving : words.arkHowAboard} className="mt-2.5 pl-14" /> : null}
                <Link href="/ark" className="mt-3 flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/14 text-[13px] font-semibold text-white transition-colors hover:border-primary-400 hover:text-primary-200" data-testid="ark-panel-full">
                    {words.arkOpenFull}
                    <span aria-hidden="true">→</span>
                </Link>
            </div>
        </div>
    );
}

/** Over the chat on a phone: a left-to-right swipe that starts on the panel's own chrome (not the world, which turns under a finger) goes back. */
function PanelSwipeBack({enabled, onBack, children}: {enabled: boolean; onBack: () => void; children: ReactNode}) {
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const element = ref.current?.parentElement;
        if (!element || !enabled) return;
        let start: {x: number; y: number; time: number} | null = null;
        const onStart = (event: TouchEvent) => {
            const touch = event.touches[0];
            // The world takes its own drags: only a swipe from the header or the foot, or from the screen's left edge.
            const onWorld = event.target instanceof Element && event.target.closest("canvas");
            start = touch && event.touches.length === 1 && (!onWorld || touch.clientX < 24) ? {x: touch.clientX, y: touch.clientY, time: performance.now()} : null;
        };
        const onEnd = (event: TouchEvent) => {
            const touch = event.changedTouches[0];
            if (!start || !touch) return;
            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y;
            const quick = performance.now() - start.time < 700;
            start = null;
            if (quick && dx > 70 && Math.abs(dy) < dx * 0.5) onBack();
        };
        element.addEventListener("touchstart", onStart, {passive: true});
        element.addEventListener("touchend", onEnd, {passive: true});
        return () => {
            element.removeEventListener("touchstart", onStart);
            element.removeEventListener("touchend", onEnd);
        };
    }, [enabled, onBack]);
    return <div ref={ref} className="relative flex min-h-0 flex-1 flex-col">{children}</div>;
}
