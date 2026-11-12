"use client";

import {useEffect, useRef, useState, type ReactNode} from "react";

/**
 * The home page's hero (landing lane S2): the live Ark, the real 3D scene, behind the tagline.
 *
 * A frame of the real Ark paints first and is the page's largest paint (`HomeArkPoster`, server-rendered). The world
 * itself loads only after that frame has painted and the browser is idle, and only on a large screen with a fine
 * pointer and no data saver; elsewhere (phones) it waits for a tap on "See it live", so a phone on a cell connection
 * never downloads it unasked. It mounts the way the apps' panel does, through `/ark/embed.html` and the scene's
 * public API, over the anonymous snapshot (`/api/ark/landing/snapshot`: every bringer anonymous, nothing `mine`).
 *
 * The world never takes the page's scroll: a glass layer lies over it until the reader clicks "Click to explore"
 * (then the wheel and drags are the world's) and comes back on "Done exploring" or when the pointer leaves. Out of
 * view, the world stops drawing (`ark:visible`, docs/ark/runtime-bridge.md).
 */

type Phase = "poster" | "loading" | "live";

export type HomeArkHeroWords = {
    seeLive: string;
    loading: string;
    interact: string;
    interactDone: string;
    poster: string;
    /** "Live, {time} on the island". */
    live: string;
    sceneLabel: string;
};

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

export default function HomeArkHero({locale, lang, words, poster, children}: {locale: string; lang: string; words: HomeArkHeroWords; poster: ReactNode; children: ReactNode}) {
    const sectionRef = useRef<HTMLElement | null>(null);
    const frameRef = useRef<HTMLIFrameElement | null>(null);
    const [phase, setPhase] = useState<Phase>("poster");
    const [exploring, setExploring] = useState(false);
    const [clock, setClock] = useState<string | null>(null);

    // The world after the poster: by itself on a large screen with a mouse, once the frame has painted and the browser is idle.
    useEffect(() => {
        const connection = (navigator as Navigator & {connection?: {saveData?: boolean}}).connection;
        const large = window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches;
        if (!large || connection?.saveData) return;
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
    }, []);

    // The world says when its first frame is drawn (`ark:ready`); then it fades in over the poster.
    useEffect(() => {
        if (phase === "poster") return;
        const onMessage = (event: MessageEvent) => {
            if (event.source !== frameRef.current?.contentWindow) return;
            const data = event.data as {type?: string} | null;
            if (data?.type === "ark:ready") setPhase("live");
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
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

    // The island's time, once the world is live.
    useEffect(() => {
        if (phase !== "live") return;
        const tick = () => setClock(islandTime(new Date(), locale));
        tick();
        const id = window.setInterval(tick, 30_000);
        return () => window.clearInterval(id);
    }, [phase, locale]);

    const embedSrc = `/ark/embed.html?${new URLSearchParams({snapshot: "/api/ark/landing/snapshot", lang, label: words.sceneLabel}).toString()}`;

    return (
        <section
            ref={sectionRef}
            id="top"
            data-phase={phase}
            data-exploring={exploring ? "true" : "false"}
            onPointerLeave={(event) => {
                // (A finger lifting "leaves" too: only a mouse moving away ends exploring.)
                if (event.pointerType === "mouse") setExploring(false);
            }}
            className="theme-dark relative isolate -mt-8 flex min-h-[34rem] w-full flex-col justify-end overflow-hidden bg-[#0b1d2e] text-white [height:calc(100svh-4rem)] max-h-[60rem] sm:min-h-[38rem]"
        >
            {/* The real Ark, a frame of it: the page's largest paint. */}
            <div aria-hidden="true" className={`absolute inset-0 -z-20 transition-opacity duration-1000 ease-out ${phase === "live" ? "opacity-0" : "opacity-100"}`}>
                {poster}
            </div>
            {phase !== "poster" ? (
                <iframe
                    ref={frameRef}
                    src={embedSrc}
                    title={words.sceneLabel}
                    loading="eager"
                    allow="autoplay"
                    className={`absolute inset-0 -z-10 h-full w-full border-0 transition-opacity duration-1000 ease-out ${phase === "live" ? "opacity-100" : "opacity-0"} ${exploring ? "" : "pointer-events-none"}`}
                />
            ) : null}
            {/* The scrim the words sit on: only along the foot and the start side, so the world stays the picture. */}
            <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(4,10,8,0.9)_0%,rgba(4,10,8,0.55)_32%,rgba(4,10,8,0)_62%),linear-gradient(to_right,rgba(4,10,8,0.55)_0%,rgba(4,10,8,0)_55%)] transition-opacity duration-500 ${exploring ? "opacity-0" : "opacity-100"}`}
            />

            <div className={`relative mx-auto w-full max-w-[86rem] px-4 pb-10 transition-opacity duration-500 md:px-8 md:pb-14 lg:pb-16 ${exploring ? "pointer-events-none opacity-0" : "opacity-100"}`}>
                {children}
            </div>

            {/* The figure's caption, and the world's own controls: one corner, one voice. */}
            <div className="absolute inset-x-0 top-0 mx-auto flex w-full max-w-[86rem] items-start justify-between gap-3 px-4 pt-5 md:px-8 md:pt-6">
                <p className="flex min-h-8 min-w-0 items-center gap-2 rounded-sm bg-black/35 px-2.5 py-1.5 text-[10px] font-bold uppercase leading-tight tracking-[0.14em] text-white/85 backdrop-blur-md sm:text-[11px] sm:tracking-[0.16em]">
                    {phase === "live" ? (
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
                            {words.loading}
                        </>
                    ) : (
                        words.poster
                    )}
                </p>
                <div className="flex shrink-0 items-center gap-2">
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
                    {phase === "live" ? (
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
            </div>
        </section>
    );
}
