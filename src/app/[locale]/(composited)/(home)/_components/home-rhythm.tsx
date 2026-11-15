"use client";

import {useEffect, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {intensityPath, type SdRhythmState} from "@/lib/ark-sd-rhythm";

/**
 * "In rhythm with its nature" (lane ark-sd-align, owner 2026-11-15: "show on the homepage the System Dynamics frequency
 * alignment, steps rule, as visually as possible"). One real animal aboard (a named founder's, picked by the day on the
 * server: `page.tsx` homeRhythmPick), drawn as two lines over one box: its species' System Dynamics waveform and its day
 * in the Ark, coloured by its rhythm (green in rhythm, amber slightly off, red out). Its own last 24 hours when the
 * hero's live world is up (the embed's `ark:rhythm-of` → `ark:rhythm`, with a "now" mark); until then its kind's sample
 * day from the shared schedule (`/api/ark/sd-day`), said so. Under it the loop, from the same schedule: its kind not
 * kept by steps (ordinary) → a step that works → kept well (prime), each line in its own state's colour.
 *
 * Lazy: nothing is fetched until the box nears the view; the box's size is fixed up front (no layout shift); with
 * reduced motion the lines are drawn at once.
 */

const TONE: Record<SdRhythmState, string> = {in: "#8fd694", slightly: "#f2c14e", out: "#ef6f5c"};
const SD_STROKE = "#A7F432";

export type HomeRhythmDay = {line: number[]; state: SdRhythmState; score: number};
export type HomeRhythmPick = {
    animalId: string;
    name: string;
    latin: string | null;
    bringer: string;
    speciesProfileId: string;
    kind: HomeRhythmDay;
    ordinary: HomeRhythmDay | null;
};
export type HomeRhythmWords = {eyebrow: string; title: string; line: string; sd: string; ark: string; live: string; kind: string; step: string; see: string; by: string};

type Live = {line: number[]; state: SdRhythmState; score: number};

function Lines({sd, line, tone, now, draw, className}: {sd: string | null; line: readonly number[]; tone: string; now: boolean; draw: boolean; className: string}) {
    return (
        <svg viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true" className={className}>
            {sd ? <path d={sd} fill="none" stroke={SD_STROKE} strokeOpacity="0.8" strokeWidth="1.6" strokeDasharray="3 2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : null}
            <path d={intensityPath(line)} fill="none" stroke={tone} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className={draw ? "home-rhythm-draw" : undefined} />
            {now ? <line x1="99.6" x2="99.6" y1="2" y2="48" stroke="white" strokeOpacity="0.6" strokeWidth="1" vectorEffect="non-scaling-stroke" /> : null}
        </svg>
    );
}

export default function HomeRhythm({pick, words}: {pick: HomeRhythmPick; words: HomeRhythmWords}) {
    const box = useRef<HTMLDivElement>(null);
    const [near, setNear] = useState(false);
    const [sd, setSd] = useState<string | null>(null);
    const [live, setLive] = useState<Live | null>(null);
    const [draw, setDraw] = useState(false);

    // Near the view: then, and only then, its SD waveform and the live world's word on it.
    useEffect(() => {
        const el = box.current;
        if (!el || typeof IntersectionObserver === "undefined") return undefined;
        const seen = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                setNear(true);
                seen.disconnect();
            }
        }, {rootMargin: "300px 0px"});
        seen.observe(el);
        return () => seen.disconnect();
    }, []);

    useEffect(() => {
        if (!near) return undefined;
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        setDraw(!reduced);
        const controller = new AbortController();
        void fetch(`/api/app/system-dynamics?speciesProfileId=${encodeURIComponent(pick.speciesProfileId)}`, {headers: {Accept: "application/json"}, signal: controller.signal})
            .then((r) => (r.ok ? r.json() : null))
            .then((payload) => setSd(typeof payload?.dynamics?.waveform?.pathD === "string" ? payload.dynamics.waveform.pathD : null))
            .catch(() => undefined);
        // Its own day, from the hero's live world when it is up (desktops load it after the first paint).
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            const data = event.data as {type?: string; id?: string; rhythm?: {line?: number[]; agreement?: {state?: SdRhythmState; score?: number}} | null};
            if (data?.type !== "ark:rhythm" || data.id !== pick.animalId || !data.rhythm?.line?.length || !data.rhythm.agreement?.state) return;
            setLive({line: data.rhythm.line, state: data.rhythm.agreement.state, score: data.rhythm.agreement.score ?? 0});
        };
        window.addEventListener("message", onMessage);
        let tries = 0;
        const ask = () => {
            const frame = document.querySelector<HTMLIFrameElement>('iframe[src^="/ark/embed.html"]');
            frame?.contentWindow?.postMessage({type: "ark:rhythm-of", id: pick.animalId}, window.location.origin);
        };
        ask();
        const timer = window.setInterval(() => {
            if (++tries > 40) window.clearInterval(timer);
            ask();
        }, 4000);
        return () => {
            controller.abort();
            window.removeEventListener("message", onMessage);
            window.clearInterval(timer);
        };
    }, [near, pick.animalId, pick.speciesProfileId]);

    const shown: Live = live ?? pick.kind;
    // (The loop only where it is true of its kind: not kept by steps it is off its rhythm, kept well it is back in it.)
    const RANK: Record<SdRhythmState, number> = {out: 0, slightly: 1, in: 2};
    const loop = pick.ordinary && RANK[pick.kind.state] > RANK[pick.ordinary.state] ? pick.ordinary : null;
    return (
        <div ref={box} data-testid="home-rhythm" data-state={shown.state} data-source={live ? "live" : "kind"}>
            <div className="relative aspect-[2/1] w-full overflow-hidden rounded-sm bg-[#0b130e] md:aspect-[3/1]">
                <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 md:p-5">
                    <p className="min-w-0">
                        <span className="block truncate font-display text-xl font-bold leading-none text-white md:text-2xl">{pick.name}</span>
                        <span className="mt-1 block truncate text-[12px] text-white/60">
                            {pick.latin ? <i>{pick.latin}</i> : null}
                            {pick.latin ? " · " : null}
                            {words.by.replace("{name}", pick.bringer)}
                        </span>
                    </p>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em]" style={{color: TONE[shown.state]}}>
                        <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{background: TONE[shown.state]}} />
                        {live ? words.live : words.kind}
                    </span>
                </div>
                <Lines sd={sd} line={shown.line} tone={TONE[shown.state]} now={Boolean(live)} draw={draw} className="absolute inset-x-4 bottom-8 top-16 h-[calc(100%-6rem)] w-[calc(100%-2rem)] md:inset-x-5 md:top-20 md:h-[calc(100%-7rem)] md:w-[calc(100%-2.5rem)]" />
                <p className="absolute inset-x-4 bottom-2.5 flex items-center gap-4 text-[11px] font-semibold text-white/60 md:inset-x-5">
                    <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed" style={{borderColor: SD_STROKE}} />{words.sd}</span>
                    <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block w-4 border-t-2" style={{borderColor: TONE[shown.state]}} />{words.ark}</span>
                    <Link href={`/ark?focus=${encodeURIComponent(pick.animalId)}`} className="ml-auto font-bold text-white underline decoration-white/30 underline-offset-4 hover:decoration-primary-400">{words.see} →</Link>
                </p>
            </div>
            {loop ? (
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3" aria-label={words.line}>
                    <div className="h-14 rounded-sm bg-[#0b130e] p-2 md:h-20"><Lines sd={null} line={loop.line} tone={TONE[loop.state]} now={false} draw={false} className="h-full w-full" /></div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-400 px-3 py-1.5 text-[12px] font-black text-canvas-950">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h12M13 6l6 6-6 6" /></svg>
                        {words.step}
                    </span>
                    <div className="h-14 rounded-sm bg-[#0b130e] p-2 md:h-20"><Lines sd={null} line={pick.kind.line} tone={TONE[pick.kind.state]} now={false} draw={false} className="h-full w-full" /></div>
                </div>
            ) : null}
            <style>{`.home-rhythm-draw{animation:home-rhythm-in 1.2s ease-out both}@keyframes home-rhythm-in{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion: reduce){.home-rhythm-draw{animation:none}}`}</style>
        </div>
    );
}
