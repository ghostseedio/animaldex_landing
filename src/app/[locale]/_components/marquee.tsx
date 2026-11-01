"use client";

import {useEffect, useRef} from "react";

export type MarqueeProps = {
    children: string,
    baseVelocity?: number,
    rotation?: number,
    className?: string,
    repeatCount?: number,
    scrollBoost?: number
}

export default function Marquee(
    {children, baseVelocity = 1, rotation = 0, repeatCount = 1, scrollBoost = 0, className}: MarqueeProps
) {
    const previousPageScroll = useRef(0);
    const marqueeScroll = useRef(0);
    const marquee = useRef<HTMLDivElement>(null);
    const reference = useRef<HTMLSpanElement>(null);
    const currentVelocity = useRef(baseVelocity);

    // Runs only while on screen, and not at all under reduced motion (WEB-17):
    // the band then sits still at its rotation.
    useEffect(() => {
        const element = marquee.current;
        if (!element) return;
        element.style.transform = `rotate(${rotation}deg) translateX(${-marqueeScroll.current}px)`;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        let currentFrame = 0;
        let visible = false;
        const update = () => {
            currentFrame = 0;
            if (!visible) return;
            if (marquee.current && reference.current) {
                const pageScroll = window.scrollY;
                const pageScrollDelta = (pageScroll - previousPageScroll.current) * scrollBoost;
                previousPageScroll.current = pageScroll;

                if (pageScrollDelta < 0) {
                    currentVelocity.current = -baseVelocity;
                } else if (pageScrollDelta > 0) {
                    currentVelocity.current = baseVelocity;
                }

                marqueeScroll.current += currentVelocity.current + pageScrollDelta * baseVelocity;

                const width = reference.current.offsetWidth;
                if (marqueeScroll.current > width) {
                    marqueeScroll.current = 0;
                } else if (marqueeScroll.current < 0) {
                    marqueeScroll.current = width;
                }

                marquee.current.style.transform = `rotate(${rotation}deg) translateX(${-marqueeScroll.current}px)`;
            }
            currentFrame = requestAnimationFrame(update);
        };
        const observer = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible) {
                previousPageScroll.current = window.scrollY;
                if (!currentFrame) currentFrame = requestAnimationFrame(update);
            }
        });
        observer.observe(element);

        return () => {
            observer.disconnect();
            cancelAnimationFrame(currentFrame);
        };
    }, [baseVelocity, scrollBoost, rotation]);

    return (
        <div className={`whitespace-nowrap ${className}`} ref={marquee}>
            <span ref={reference}>{children}{' '}</span>
            <span aria-hidden="true">{(children + ' ').repeat(repeatCount)}</span>
        </div>
    )
}