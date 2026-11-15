"use client";

import {useEffect, useRef, useState, type ReactNode} from "react";
import {readArkProgressMessage, type ArkLoadStage} from "@/lib/ark-loading";

/**
 * The home page's hero (landing lane S2): the live Ark, the real 3D scene, behind the tagline.
 *
 * A frame of the real Ark paints first and is the page's largest paint (`HomeArkPoster`, server-rendered). The world
 * itself loads only after that frame has painted and the browser is idle, and only on a large screen with a fine
 * pointer and no data saver; elsewhere (phones) it waits for a tap on "See it live", so a phone on a cell connection
 * never downloads it unasked. It mounts the way the apps' panel does, through `/ark/embed.html` and the scene's
 * public API, over the anonymous snapshot (`/api/ark/landing/snapshot`: every bringer anonymous, nothing `mine`).
 *
 * While the world loads, the caption says what it is doing in a few words (the embed's `ark:progress`: reading who is
 * aboard, building the island) over a thin bar that moves only with its real steps (`lib/ark-loading.ts`); the embed
 * shows no loading screen of its own here (`loader=0`). Then the world fades in over the poster, which stays fully
 * there under it until the world covers it (a poster fading out at the same time let the dark page through: a dip).
 *
 * Before the Ark, the real animal (owner, 2026-11-15: the low-poly world first read as a kids' game). The hero opens
 * on a real Komodo dragon, a frame of the owner's own footage from Komodo National Park (14 October 2026), drifting
 * slowly; its capture card slides in (the app's real capture of that dragon, "Photographed {date}"); then the frame
 * pushes away into the Ark, where the card turns to the same dragon aboard; then the card goes and the hero rests on
 * the Ark (its poster, then the live world, as before). About 7.5 s, once a session (`sessionStorage`, read before the
 * first paint by a small inline script, so a second visit opens on the Ark without a flash), with a replay button.
 * The real frame is the page's largest paint; the Ark poster and the cards load at low priority behind it. Reduced
 * motion, Save-Data or a 2G/3G connection: the same steps as plain cross-fades, with no drift and no slide.
 *
 * The world never takes the page's scroll: a glass layer lies over it until the reader clicks "Click to explore"
 * (then the wheel and drags are the world's) and comes back on "Done exploring" or when the pointer leaves. Out of
 * view, the world stops drawing (`ark:visible`, docs/ark/runtime-bridge.md).
 */

type Phase = "poster" | "loading" | "live";
/** The opening, step by step: the real frame, its capture card, the push into the Ark, the rest on the Ark. */
type Step = "real" | "card" | "ark" | "rest";

/** When each step begins, from the hero's first moment on the client. */
const STEP_AT = {card: 2500, ark: 4000, rest: 7000} as const;
const PLAYED_KEY = "adx-hero-opening";

export type HomeArkHeroWords = {
    seeLive: string;
    loading: string;
    interact: string;
    interactDone: string;
    poster: string;
    /** "Live, {time} on the island". */
    live: string;
    sceneLabel: string;
    /** The loading stages (the Ark's `loader` words): until who is aboard is read, until the world's first frame. */
    stages: {data: string; world: string};
    /** The caption over the real frame ("A real Komodo dragon, Komodo National Park"). */
    real: string;
    /** The replay button's label. */
    replay: string;
};

/** The capture card's two faces: the real capture, then the same animal aboard. */
export type HomeArkHeroCard = {name: string; latin: string; catchLine: string; aboardLine: string; catchArt: ReactNode; aboardArt: ReactNode};

/**
 * Read before the first paint (an inline script in the hero): a second visit this session opens on the Ark, and a
 * data saver or a 2G/3G connection drops the drift. Both are attributes on <html> that `globals.css` reads.
 */
export const HERO_OPENING_SCRIPT = `try{var d=document.documentElement;d.setAttribute("data-hero-armed","");if(sessionStorage.getItem(${JSON.stringify(PLAYED_KEY)}))d.setAttribute("data-hero-played","");var c=navigator.connection;if(c&&(c.saveData||/(^|-)(2g|3g)$/.test(c.effectiveType||"")))d.setAttribute("data-hero-lite","")}catch(e){}`;

function readPlayed(): boolean {
    try {
        return window.sessionStorage.getItem(PLAYED_KEY) !== null;
    } catch {
        return false;
    }
}

function markPlayed() {
    try {
        window.sessionStorage.setItem(PLAYED_KEY, "1");
    } catch {
        // (Storage refused, a private window: the opening plays again next time, nothing else changes.)
    }
}

/** The world's fade over the poster; the poster is let go once it is covered. */
const FADE_MS = 1000;
/** Without the embed's stage (an older page), the fade starts this long after `ark:ready`. */
const SETTLE_FALLBACK_MS = 1500;

/** The island's clock is UTC (`ark-clock.ts` islandHours, offset 0). */
function islandTime(now: Date, locale: string): string {
    return new Intl.DateTimeFormat(locale, {hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC"}).format(now);
}

function idle(callback: () => void): () => void {
    const w = window as Window & {requestIdleCallback?: (cb: () => void, options?: {timeout: number}) => number; cancelIdleCallback?: (id: number) => void};
    if (w.requestIdleCallback) {
        const id = w.requestIdleCallback(callback, {timeout: 4000});
        return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(callback, 1500);
    return () => window.clearTimeout(id);
}

export default function HomeArkHero({locale, lang, words, poster, real, card, children}: {locale: string; lang: string; words: HomeArkHeroWords; poster: ReactNode; real: ReactNode; card: HomeArkHeroCard; children: ReactNode}) {
    const sectionRef = useRef<HTMLElement | null>(null);
    const frameRef = useRef<HTMLIFrameElement | null>(null);
    const [phase, setPhase] = useState<Phase>("poster");
    const [exploring, setExploring] = useState(false);
    const [clock, setClock] = useState<string | null>(null);
    // The embed's load as it goes (its real steps), and the poster let go once the world covers it.
    const [progress, setProgress] = useState<{stage: ArkLoadStage; progress: number} | null>(null);
    const [covered, setCovered] = useState(false);
    // The opening: its step, and a count of runs (a replay starts the drift again).
    const [step, setStep] = useState<Step>("real");
    const [run, setRun] = useState(0);

    // Once a session: a second visit rests on the Ark at once; the first runs the steps and marks the session.
    // (Started once here, it keeps playing through a development remount, which would otherwise read its own mark.)
    const startedRef = useRef(false);
    useEffect(() => {
        if (!startedRef.current && readPlayed()) {
            setStep("rest");
            return;
        }
        startedRef.current = true;
        markPlayed();
        setStep("real");
        const timers = (Object.keys(STEP_AT) as Array<keyof typeof STEP_AT>).map((key) => window.setTimeout(() => setStep(key), STEP_AT[key]));
        return () => timers.forEach((id) => window.clearTimeout(id));
    }, [run]);

    const replay = () => {
        document.documentElement.removeAttribute("data-hero-played");
        startedRef.current = true;
        setExploring(false);
        setRun((value) => value + 1);
    };

    // The world after the opening: by itself on a large screen with a mouse and no data saver or slow connection, once
    // the hero rests on the Ark's poster and the browser is idle.
    const resting = step === "rest";
    useEffect(() => {
        if (!resting) return;
        const connection = (navigator as Navigator & {connection?: {saveData?: boolean; effectiveType?: string}}).connection;
        const large = window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches;
        if (!large || connection?.saveData || /(^|-)(2g|3g)$/.test(connection?.effectiveType ?? "")) return;
        let cancelIdle: (() => void) | null = null;
        const start = () => {
            cancelIdle = idle(() => setPhase((current) => (current === "poster" ? "loading" : current)));
        };
        const image = sectionRef.current?.querySelector<HTMLImageElement>("img[data-ark-poster]");
        if (image && !image.complete) {
            image.addEventListener("load", start, {once: true});
            image.addEventListener("error", start, {once: true});
        } else {
            // Two frames: the poster is on screen before the idle wait begins.
            requestAnimationFrame(() => requestAnimationFrame(start));
        }
        return () => {
            cancelIdle?.();
            image?.removeEventListener("load", start);
            image?.removeEventListener("error", start);
        };
    }, [resting]);

    // The world says when its first frame is drawn (`ark:ready`); then it fades in over the poster.
    useEffect(() => {
        if (phase === "poster") return;
        let settleTimer: number | null = null;
        const onMessage = (event: MessageEvent) => {
            if (event.source !== frameRef.current?.contentWindow) return;
            const data = event.data as {type?: string} | null;
            // The world fades in at its first good frame (the embed's stage "animals": the frame after `ark:ready`,
            // which is a fog wash), or a moment after `ark:ready` if no stage comes.
            if (data?.type === "ark:ready" && settleTimer === null) settleTimer = window.setTimeout(() => setPhase("live"), SETTLE_FALLBACK_MS);
            const step = readArkProgressMessage(data);
            if (step) setProgress(step);
            if (step && (step.stage === "animals" || step.stage === "done")) setPhase("live");
        };
        window.addEventListener("message", onMessage);
        return () => {
            window.removeEventListener("message", onMessage);
            if (settleTimer !== null) window.clearTimeout(settleTimer);
        };
    }, [phase]);

    // Nothing is drawn while the hero is out of view.
    useEffect(() => {
        if (phase === "poster" || !sectionRef.current) return;
        const observer = new IntersectionObserver(([entry]) => {
            frameRef.current?.contentWindow?.postMessage({type: "ark:visible", visible: entry.isIntersecting}, window.location.origin);
            if (!entry.isIntersecting) setExploring(false);
        });
        observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, [phase]);

    // The reader still here (a scroll, a key, a tap anywhere on the page): told to the world at most once a minute.
    useEffect(() => {
        if (phase === "poster") return;
        let last = 0;
        const onActivity = () => {
            const now = Date.now();
            if (now - last < 60_000) return;
            last = now;
            frameRef.current?.contentWindow?.postMessage({type: "ark:activity"}, window.location.origin);
        };
        const kinds = ["scroll", "pointerdown", "keydown", "wheel", "touchstart"] as const;
        kinds.forEach((kind) => window.addEventListener(kind, onActivity, {passive: true}));
        return () => kinds.forEach((kind) => window.removeEventListener(kind, onActivity));
    }, [phase]);

    useEffect(() => {
        if (phase !== "live") return;
        const id = window.setTimeout(() => setCovered(true), FADE_MS + 200);
        return () => window.clearTimeout(id);
    }, [phase]);

    // The island's time, once the world is live.
    useEffect(() => {
        if (phase !== "live") return;
        const tick = () => setClock(islandTime(new Date(), locale));
        tick();
        const id = window.setInterval(tick, 30_000);
        return () => window.clearInterval(id);
    }, [phase, locale]);

    // The world reads the Ark again every 10 minutes at most, and not at all after 15 minutes with nobody here
    // (decision 258: egress); between reads the animals keep to the scene's own schedule.
    const embedSrc = `/ark/embed.html?${new URLSearchParams({snapshot: "/api/ark/landing/snapshot.bin", lang, label: words.sceneLabel, refresh: "600", idle: "900", loader: "0"}).toString()}`;
    const stageText = !progress ? words.loading : progress.stage === "data" ? words.stages.data : words.stages.world;
    const percent = Math.round((progress?.progress ?? 0) * 100);
    const onReal = step === "real" || step === "card";
    const cardShown = step === "card" || step === "ark";

    return (
        <section
            ref={sectionRef}
            id="top"
            data-phase={phase}
            data-step={step}
            data-exploring={exploring ? "true" : "false"}
            onPointerLeave={(event) => {
                // (A finger lifting "leaves" too: only a mouse moving away ends exploring.)
                if (event.pointerType === "mouse") setExploring(false);
            }}
            className="theme-dark relative isolate -mt-8 flex min-h-[34rem] w-full flex-col justify-end overflow-hidden bg-[#0b1d2e] text-white [height:calc(100svh-4rem)] max-h-[60rem] sm:min-h-[38rem]"
        >
            {/* The real Ark, a frame of it: the page's largest paint. */}
            <div aria-hidden="true" className={`absolute inset-0 -z-20 ${covered ? "invisible" : ""}`}>
                {poster}
            </div>
            {phase !== "poster" ? (
                <iframe
                    ref={frameRef}
                    src={embedSrc}
                    title={words.sceneLabel}
                    loading="eager"
                    allow="autoplay"
                    className={`absolute inset-0 -z-10 h-full w-full border-0 transition-opacity duration-1000 ease-out motion-reduce:transition-none ${phase === "live" ? "opacity-100" : "opacity-0"} ${exploring ? "" : "pointer-events-none"}`}
                />
            ) : null}
            {/* The real animal, a frame of the owner's footage: the page's largest paint. It drifts, then pushes away into the Ark. */}
            <div
                key={`real-${run}`}
                aria-hidden="true"
                data-hero-opening=""
                className={`hero-motion absolute inset-0 -z-10 overflow-hidden bg-[#0b1d2e] transition-[opacity,transform] ease-in motion-reduce:scale-100 ${onReal ? "opacity-100 duration-0" : "pointer-events-none scale-110 opacity-0 duration-1000"}`}
            >
                <div className="hero-real-drift h-full w-full">{real}</div>
            </div>
            {/* The scrim the words sit on: only along the foot and the start side, so the world stays the picture. */}
            <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(4,10,8,0.9)_0%,rgba(4,10,8,0.55)_32%,rgba(4,10,8,0)_62%),linear-gradient(to_right,rgba(4,10,8,0.55)_0%,rgba(4,10,8,0)_55%)] transition-opacity duration-500 ${exploring ? "opacity-0" : "opacity-100"}`}
            />

            {/* The capture card: the real capture, then the same dragon aboard the Ark. (Decorative here: the steps below say it in words.) */}
            <div
                key={`card-${run}`}
                aria-hidden="true"
                data-hero-opening=""
                className={`pointer-events-none absolute right-4 top-[4.25rem] w-[8.75rem] sm:w-[11rem] md:right-8 md:top-1/2 md:w-[14rem] md:-translate-y-1/2 lg:right-[max(2rem,calc((100vw-86rem)/2+2rem))] lg:w-[16rem] ${exploring ? "invisible" : ""}`}
            >
                <div className={`hero-motion overflow-hidden rounded-sm bg-[#f4f1e8] shadow-[0_18px_50px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-700 ease-out motion-reduce:translate-x-0 ${cardShown ? "opacity-100" : "translate-x-8 opacity-0"}`}>
                    <div className="relative aspect-[4/5] bg-surface-900">
                        <div className="absolute inset-0">{card.catchArt}</div>
                        <div className={`absolute inset-0 transition-opacity duration-1000 ${step === "ark" ? "opacity-100" : "opacity-0"}`}>{card.aboardArt}</div>
                    </div>
                    <div className="px-2.5 py-2 text-[#13221a] md:px-3 md:py-2.5">
                        <p className="font-display text-sm font-bold leading-none md:text-lg">{card.name}</p>
                        <p className="mt-1 text-[11px] italic leading-tight text-[#13221a]/75 md:text-[13px]">{card.latin}</p>
                        <p className="relative mt-1.5 border-t border-[#13221a]/15 pt-1 text-[9px] font-semibold uppercase leading-snug tracking-[0.1em] text-[#13221a]/70 md:mt-2 md:pt-1.5 md:text-[11px] md:tracking-[0.12em]">
                            <span className={`block transition-opacity duration-500 ${step === "ark" ? "opacity-0" : "opacity-100"}`}>{card.catchLine}</span>
                            <span className={`absolute inset-x-0 bottom-0 transition-opacity duration-500 ${step === "ark" ? "opacity-100" : "opacity-0"}`}>{card.aboardLine}</span>
                        </p>
                    </div>
                </div>
            </div>

            <div className={`relative mx-auto w-full max-w-[86rem] px-4 pb-10 transition-opacity duration-500 md:px-8 md:pb-14 lg:pb-16 ${exploring ? "pointer-events-none opacity-0" : "opacity-100"}`}>
                {children}
            </div>

            {/* The figure's caption, and the world's own controls: one corner, one voice. */}
            <div className="absolute inset-x-0 top-0 mx-auto flex w-full max-w-[86rem] items-start justify-between gap-3 px-4 pt-5 md:px-8 md:pt-6">
                <p className="relative flex min-h-8 min-w-0 items-center gap-2 overflow-hidden rounded-sm bg-black/35 px-2.5 py-1.5 text-[10px] font-bold uppercase leading-tight tracking-[0.14em] text-white/85 backdrop-blur-md sm:text-[11px] sm:tracking-[0.16em]">
                    {onReal ? (
                        words.real
                    ) : phase === "live" ? (
                        <>
                            <span aria-hidden="true" className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-70 motion-safe:animate-ping" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-400" />
                            </span>
                            {clock ? words.live.replace("{time}", clock) : words.live.replace("{time}", "")}
                        </>
                    ) : phase === "loading" ? (
                        <>
                            <span aria-hidden="true" className="h-2 w-2 rounded-full border border-white/70 motion-safe:animate-pulse" />
                            <span role="status" aria-live="polite">{stageText}</span>
                            {/* The bar along the caption's foot: the embed's real steps only (never a timer). */}
                            <span
                                role="progressbar"
                                aria-label={words.loading}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={percent}
                                aria-valuetext={stageText}
                                className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-white/15"
                            >
                                <span className="absolute inset-y-0 bg-primary-400 transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{insetInlineStart: 0, width: `${percent}%`}} />
                            </span>
                        </>
                    ) : (
                        words.poster
                    )}
                </p>
                <div className="me-12 flex shrink-0 items-center gap-2">
                    {phase === "poster" ? (
                        <button
                            type="button"
                            onClick={() => setPhase("loading")}
                            className="inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-sm bg-white/90 px-3.5 text-sm font-bold text-[#06110b] shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition-colors hover:bg-white"
                        >
                            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z" /></svg>
                            {words.seeLive}
                        </button>
                    ) : null}
                    {phase === "live" && !onReal ? (
                        <button
                            type="button"
                            aria-pressed={exploring}
                            onClick={() => setExploring((value) => !value)}
                            className="inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-sm bg-white/90 px-3.5 text-sm font-bold text-[#06110b] shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition-colors hover:bg-white"
                        >
                            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                {exploring ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M5 3l14 8-6 1.5L10 19z" />}
                            </svg>
                            {exploring ? words.interactDone : words.interact}
                        </button>
                    ) : null}
                </div>
                {/* Replay: pinned to the corner on its own (hidden until the hero rests), so nothing beside it ever moves. */}
                <button
                    type="button"
                    onClick={replay}
                    aria-label={words.replay}
                    title={words.replay}
                    className={`absolute right-4 top-5 inline-flex h-10 w-10 md:right-8 md:top-6 shrink-0 items-center justify-center rounded-sm bg-black/35 text-white/90 backdrop-blur-md transition-colors hover:bg-black/55 hover:text-white ${resting && !exploring ? "" : "invisible"}`}
                >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
                </button>
            </div>
        </section>
    );
}
