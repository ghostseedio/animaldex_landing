"use client";

import {useEffect, useRef, useState} from "react";
import {useArkLanding} from "@/app/[locale]/(composited)/(home)/_components/home-live-numbers";

/**
 * "A day on the Ark" (landing lane S2): one real day on the island, dawn to night as the reader scrolls. Each frame
 * is a render of the live world at that hour of 10 November 2026 (island time is UTC), its light, weather and tide
 * the shared clock's (`ark-clock.ts`); the words under each are that clock's for the same moment, worked out on the
 * server. Who is awake is today's Ark under the scene's own rule (`isAwake`), from `/api/ark/landing`.
 *
 * Pre-rendered frames rather than the live scene: eight images cost less than a second world, and the day reads the
 * same on every device. With reduced motion the frames stand in a grid instead of turning with the scroll.
 */

export type HomeArkDayFrame = {
    key: string;
    /** The island hour (0–24) the frame was drawn at. */
    hours: number;
    time: string;
    phase: string;
    weather: string;
    tide: string;
    alt: string;
    avif: string;
    webp: string;
};

export type HomeArkDayWords = {
    /** "{count} awake". */
    awake: string;
    awakeLabel: string;
    date: string;
};

function Frame({frame, active, eager}: {frame: HomeArkDayFrame; active: boolean; eager: boolean}) {
    return (
        <picture>
            <source type="image/avif" srcSet={frame.avif} sizes="100vw" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={frame.webp.split(" ")[0]}
                srcSet={frame.webp}
                sizes="100vw"
                alt={frame.alt}
                loading={eager ? "eager" : "lazy"}
                decoding="async"
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${active ? "opacity-100" : "opacity-0"}`}
            />
        </picture>
    );
}

function Readout({frame, awake, words, locale}: {frame: HomeArkDayFrame; awake: number | null; words: HomeArkDayWords; locale: string}) {
    return (
        <div className="flex flex-col gap-3">
            <p className="font-display text-7xl font-extrabold leading-none tracking-tight text-white [font-variant-numeric:tabular-nums] md:text-8xl">{frame.time}</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-white/85">
                <li>{frame.phase}</li>
                <li aria-hidden="true" className="text-white/35">/</li>
                <li>{frame.weather}</li>
                <li aria-hidden="true" className="text-white/35">/</li>
                <li>{frame.tide}</li>
            </ul>
            <p className="text-sm text-white/70" title={words.awakeLabel}>
                {awake === null ? " " : words.awake.replace("{count}", awake.toLocaleString(locale))}
            </p>
        </div>
    );
}

export default function HomeArkDay({frames, words, locale}: {frames: HomeArkDayFrame[]; words: HomeArkDayWords; locale: string}) {
    const trackRef = useRef<HTMLDivElement | null>(null);
    const [index, setIndex] = useState(0);
    const [still, setStill] = useState(false);
    const summary = useArkLanding();
    const awakeAt = (frame: HomeArkDayFrame) => (summary?.awake.length === 24 ? summary.awake[Math.floor(frame.hours) % 24] : null);

    useEffect(() => {
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        const apply = () => setStill(query.matches);
        apply();
        query.addEventListener?.("change", apply);
        return () => query.removeEventListener?.("change", apply);
    }, []);

    useEffect(() => {
        if (still) return;
        let frame = 0;
        const measure = () => {
            frame = 0;
            const track = trackRef.current;
            if (!track) return;
            const box = track.getBoundingClientRect();
            const travel = Math.max(box.height - window.innerHeight, 1);
            const progress = Math.min(Math.max(-box.top / travel, 0), 0.9999);
            setIndex(Math.floor(progress * frames.length));
        };
        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(measure);
        };
        measure();
        window.addEventListener("scroll", onScroll, {passive: true});
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [still, frames.length]);

    if (still) {
        return (
            <ol className="mx-auto grid w-full max-w-[86rem] grid-cols-1 gap-4 px-4 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
                {frames.map((frame) => (
                    <li key={frame.key} className="relative aspect-[4/3] overflow-hidden rounded-sm bg-[#0b1d2e]">
                        <Frame frame={frame} active eager={false} />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                            <Readout frame={frame} awake={awakeAt(frame)} words={words} locale={locale} />
                        </div>
                    </li>
                ))}
            </ol>
        );
    }

    const current = frames[index] ?? frames[0];
    return (
        <div ref={trackRef} className="relative" style={{height: `${frames.length * 55}vh`}}>
            <div className="theme-dark sticky top-16 h-[calc(100svh-4rem)] w-full overflow-hidden bg-[#0b1d2e]">
                {frames.map((frame, i) => (
                    <Frame key={frame.key} frame={frame} active={i === index} eager={i < 2} />
                ))}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(4,10,8,0.85)_0%,rgba(4,10,8,0.35)_30%,rgba(4,10,8,0)_55%)]" />
                <div className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-[86rem] flex-col gap-6 px-4 pb-8 md:px-8 md:pb-12">
                    <div aria-live="polite">
                        <Readout frame={current} awake={awakeAt(current)} words={words} locale={locale} />
                    </div>
                    {/* The day as a ruler: midnight to midnight, a tick at each frame, the one shown in neon. */}
                    <div className="flex flex-col gap-2">
                        <div className="relative h-6" aria-hidden="true">
                            <div className="absolute inset-x-0 top-1/2 h-px bg-white/30" />
                            {frames.map((frame, i) => (
                                <span
                                    key={frame.key}
                                    className={`absolute top-1/2 h-3 w-px -translate-y-1/2 ${i === index ? "h-5 w-[3px] bg-primary-400" : i < index ? "bg-white/80" : "bg-white/40"}`}
                                    style={{left: `${(frame.hours / 24) * 100}%`}}
                                />
                            ))}
                        </div>
                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
                            <span>00:00</span>
                            <span className="hidden sm:inline">{words.date}</span>
                            <span>24:00</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
