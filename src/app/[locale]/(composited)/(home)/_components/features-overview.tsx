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
}

export default function FeaturesOverview({features, className, smoothnessCoefficient = 0.92, leftOffset = 0, nextDelay = 5000}: FeaturesOverviewProps) {
    const [slide, setSlide] = useState(0);
    const titles = useRef<HTMLDivElement>(null);
    const contents = useRef<HTMLDivElement>(null);
    const nextTimeout = useRef<number | null>(null);

    useEffect(() => {
        const titlesRef = titles.current;
        const contentsRef = contents.current;
        if (!titlesRef || !contentsRef) return;

        if (nextTimeout.current) clearTimeout(nextTimeout.current);
        nextTimeout.current = window.setTimeout(() => {
            setSlide((slide + 1) % features.length);
        }, nextDelay);

        const calculateTarget = (root: HTMLDivElement) =>
            root.children[slide].getBoundingClientRect().x
            - root.getBoundingClientRect().x
            + root.scrollLeft
            - leftOffset;

        let animationFrame = 0;

        const animate = () => {
            const titlesTarget = calculateTarget(titlesRef);
            const contentsTarget = calculateTarget(contentsRef);

            titlesRef.scrollLeft = titlesRef.scrollLeft * smoothnessCoefficient + titlesTarget * (1 - smoothnessCoefficient);
            contentsRef.scrollLeft = contentsRef.scrollLeft * smoothnessCoefficient + contentsTarget * (1 - smoothnessCoefficient);
            animationFrame = requestAnimationFrame(animate);
        }

        animationFrame = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrame)
        };
    }, [features.length, leftOffset, nextDelay, slide, smoothnessCoefficient]);

    return (
        <div className={"relative flex h-full min-h-0 flex-col gap-2 pt-3 lg:gap-2.5 lg:pt-4 " + className || ""}>
            <div className="pl-10 lg:pl-12">
                <div
                    className="flex shrink-0 flex-row flex-nowrap gap-x-5 overflow-hidden pr-10 text-xl font-display font-bold lg:gap-x-7 lg:pr-12 lg:text-2xl"
                    ref={titles}
                >
                {features.map(({name}, i) => {
                    const parts = name.split("|");
                    const eyebrow = parts[0]?.trim();
                    const label = parts.slice(1).join("|").trim();
                    const isActive = slide === i;

                    return (
                        <a
                            href="#"
                            onClick={e => {
                                e.preventDefault()
                                setSlide(i)
                            }}
                            className="min-w-max max-h-20"
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
                        </a>
                    );
                })}
                <div className="min-w-full h-full" aria-hidden="true" />
                </div>
            </div>
            <div className="relative min-h-0 flex-1">
                <div className="flex h-full min-h-0 flex-row overflow-hidden" ref={contents}>
                    {features.map(({content}, i) => (
                        <div key={i} className="box-border h-full min-w-full px-10 lg:px-12">
                            {content}
                        </div>
                    ))}
                </div>
                <div className="pointer-events-none absolute inset-x-0 top-[62%] z-20 flex -translate-y-1/2 justify-center">
                    <div className="pointer-events-auto flex w-fit flex-row gap-2 rounded-full border border-line-300 bg-canvas-900 p-3">
                        {features.map((_, i) => (
                            <button
                                key={i}
                                className={"h-2 w-2 rounded-full cursor-pointer " + (slide === i ? "bg-primary-200" : "bg-line-300")}
                                onClick={() => setSlide(i)}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-auto h-20 rounded-b-3xl bg-gradient-to-t from-canvas-950 via-canvas-950/85 to-transparent lg:h-24" />
        </div>
    )
}
