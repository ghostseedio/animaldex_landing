"use client";

import {ReactNode, useEffect, useRef, useState} from "react";

export type FeaturesOverviewProps = {
    features: {
        name: string;
        content: ReactNode;
    }[];
    className?: string;
    nextDelay?: number;
    smoothnessCoefficient?: number;
    leftOffset?: number;
    /** "Show {name}, {index} of {count}", for the dots. */
    showLabel?: string;
}

/**
 * The home page's feature carousel.
 *
 * Performance (WEB-17): it glides to a slide and then stops, rather than
 * reading layout every frame forever, and it only advances on its own while
 * it is on screen and the reader has not asked for reduced motion (then it
 * jumps instead of gliding, and never advances by itself).
 */
export default function FeaturesOverview({
    features,
    className,
    smoothnessCoefficient = 0.86,
    leftOffset = 0,
    nextDelay = 5000,
    showLabel = "Show {name}, {index} of {count}"
}: FeaturesOverviewProps) {
    const [slide, setSlide] = useState(0);
    const [onScreen, setOnScreen] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const titles = useRef<HTMLDivElement>(null);
    const contents = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReducedMotion(media.matches);
        update();
        media.addEventListener("change", update);
        const element = root.current;
        const observer = element ? new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {threshold: 0.25}) : null;
        if (element && observer) observer.observe(element);
        return () => {
            media.removeEventListener("change", update);
            observer?.disconnect();
        };
    }, []);

    // Advance on its own only while it can be seen.
    useEffect(() => {
        if (!onScreen || reducedMotion) return;
        const timer = window.setTimeout(() => setSlide((current) => (current + 1) % features.length), nextDelay);
        return () => window.clearTimeout(timer);
    }, [features.length, nextDelay, onScreen, reducedMotion, slide]);

    // Glide to the slide, then stop.
    useEffect(() => {
        const titlesRef = titles.current;
        const contentsRef = contents.current;
        if (!titlesRef || !contentsRef) return;

        const targetOf = (element: HTMLDivElement) =>
            (element.children[slide] as HTMLElement | undefined)?.offsetLeft ?? 0;
        const titlesTarget = Math.max(0, targetOf(titlesRef) - leftOffset);
        const contentsTarget = Math.max(0, targetOf(contentsRef) - leftOffset);

        if (reducedMotion) {
            titlesRef.scrollLeft = titlesTarget;
            contentsRef.scrollLeft = contentsTarget;
            return;
        }

        let frame = 0;
        const animate = () => {
            titlesRef.scrollLeft = titlesRef.scrollLeft * smoothnessCoefficient + titlesTarget * (1 - smoothnessCoefficient);
            contentsRef.scrollLeft = contentsRef.scrollLeft * smoothnessCoefficient + contentsTarget * (1 - smoothnessCoefficient);
            const done = Math.abs(titlesRef.scrollLeft - titlesTarget) < 1 && Math.abs(contentsRef.scrollLeft - contentsTarget) < 1;
            if (done) {
                titlesRef.scrollLeft = titlesTarget;
                contentsRef.scrollLeft = contentsTarget;
                return;
            }
            frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frame);
    }, [leftOffset, reducedMotion, slide, smoothnessCoefficient]);

    const labelOf = (name: string) => {
        const parts = name.split("|");
        return parts.slice(1).join(" ").trim() || name;
    };

    return (
        <div ref={root} className={"relative flex h-full min-h-0 flex-col gap-2 pt-3 lg:gap-2.5 lg:pt-4 " + (className || "")}>
            <div className="pl-10 lg:pl-12">
                <div
                    className="relative flex shrink-0 flex-row flex-nowrap gap-x-5 overflow-hidden pr-10 text-xl font-display font-bold lg:gap-x-7 lg:pr-12 lg:text-2xl"
                    ref={titles}
                >
                {features.map(({name}, i) => {
                    const parts = name.split("|");
                    const eyebrow = parts[0]?.trim();
                    const label = parts.slice(1).join("|").trim();
                    const isActive = slide === i;

                    return (
                        <button
                            type="button"
                            onClick={() => setSlide(i)}
                            aria-current={isActive ? "true" : undefined}
                            className="min-w-max max-h-20 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300"
                            key={i}
                        >
                            {label ? (
                                <span className="flex flex-col leading-tight">
                                    <span className="text-[0.55em] font-black uppercase tracking-[0.16em] text-primary-200">{eyebrow}</span>
                                    <span className={isActive ? "text-white" : "text-ink-400"}>{label}</span>
                                </span>
                            ) : (
                                <span className={isActive ? "text-white" : "text-ink-400"}>{name}</span>
                            )}
                        </button>
                    );
                })}
                <div className="min-w-full h-full" aria-hidden="true" />
                </div>
            </div>
            <div className="relative min-h-0 flex-1">
                <div className="relative flex h-full min-h-0 flex-row overflow-hidden" ref={contents}>
                    {features.map(({content}, i) => (
                        // Slides out of view are inert: hidden from screen readers and out of the tab order.
                        <div key={i} className="box-border h-full min-w-full px-10 lg:px-12" {...(slide === i ? {} : {inert: ""} as Record<string, string>)}>
                            {content}
                        </div>
                    ))}
                </div>
                <div className="pointer-events-none absolute inset-x-0 top-[62%] z-20 flex -translate-y-1/2 justify-center">
                    <div className="pointer-events-auto flex w-fit flex-row gap-0.5 rounded-full border border-line-300 bg-canvas-900 px-1.5 py-1">
                        {features.map(({name}, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={showLabel.replace("{name}", labelOf(name)).replace("{index}", String(i + 1)).replace("{count}", String(features.length))}
                                aria-current={slide === i ? "true" : undefined}
                                className="grid h-6 w-6 cursor-pointer place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300"
                                onClick={() => setSlide(i)}
                            >
                                <span aria-hidden="true" className={"h-2 w-2 rounded-full transition-colors duration-200 " + (slide === i ? "bg-primary-200" : "bg-line-300")} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            {/* The band below has a hard edge: the cards fade out above it (WEB-28). */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-auto h-24 rounded-b-3xl bg-gradient-to-t from-canvas-950 via-canvas-950/90 to-transparent lg:h-28" />
        </div>
    )
}
