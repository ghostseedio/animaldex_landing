"use client";

import {useEffect, useRef} from "react";
import Image from "next/image";
import {evaluate} from "mathjs";

export type PhoneElement = {
    id: string,
    src: string,
    alt: string,
    width: number,
    height: number,
    z?: number,
    rotate?: string,
    rotateX?: string,
    rotateY?: string,
    translateX?: string,
    translateY?: string,
    translateZ?: string,
    top?: number,
    opacity?: string
}

export type PhoneProps = {
    data: PhoneElement[],
    phone: {
        src: string,
        alt: string,
        width?: number,
        height?: number,
        className?: string,
    }
}

const PHONE_DEPTH = 52;
const PHONE_RADIUS = 64;

function PhoneChassis({
    src,
    alt,
    width,
    height,
    className
}: {
    src: string;
    alt: string;
    width: number;
    height: number;
    className?: string;
}) {
    const half = PHONE_DEPTH / 2;
    const bodyWidth = width - 28;
    const bodyHeight = height - 16;

    return (
        <div className="relative mx-auto [transform-style:preserve-3d]" style={{width, height}}>
            <Image
                className={className ?? "mx-auto"}
                src={src}
                alt={alt}
                width={width}
                height={height}
                unoptimized
                style={{position: "relative", transform: `translateZ(${half}px)`}}
            />
            {Array.from({length: 6}, (_, index) => (
                <div
                    key={index}
                    aria-hidden="true"
                    className="absolute"
                    style={{
                        top: 8 + PHONE_RADIUS,
                        left: 14 + bodyWidth - 18,
                        width: 22,
                        height: bodyHeight - PHONE_RADIUS * 2,
                        borderRadius: 8,
                        transform: `translateZ(${half - (index + 1) * (PHONE_DEPTH / 6)}px)`,
                        background: "linear-gradient(180deg, #8A9A88 0%, #2A3830 35%, #0C1410 100%)"
                    }}
                />
            ))}
            <div
                aria-hidden="true"
                className="absolute"
                style={{
                    top: 8 + PHONE_RADIUS,
                    left: "50%",
                    width: PHONE_DEPTH,
                    height: bodyHeight - PHONE_RADIUS * 2,
                    marginLeft: -half,
                    transform: `rotateY(90deg) translateZ(${bodyWidth / 2}px)`,
                    background: "linear-gradient(90deg, #E8EEE8 0%, #A7B0A8 10%, #3A4A44 36%, #121A16 100%)",
                    borderRadius: 10,
                    boxShadow: "inset 2px 0 0 rgba(255,255,255,0.22), inset -2px 0 0 rgba(0,0,0,0.65)"
                }}
            />
            <div
                aria-hidden="true"
                className="absolute"
                style={{
                    top: "28%",
                    left: "50%",
                    width: 7,
                    height: 44,
                    marginLeft: -3.5,
                    transform: `rotateY(90deg) translateZ(${bodyWidth / 2 + 3}px)`,
                    background: "linear-gradient(90deg, #F4F4F0 0%, #6A746C 42%, #1A221C 100%)",
                    borderRadius: 3
                }}
            />
            <div
                aria-hidden="true"
                className="absolute"
                style={{
                    top: "36%",
                    left: "50%",
                    width: 7,
                    height: 72,
                    marginLeft: -3.5,
                    transform: `rotateY(90deg) translateZ(${bodyWidth / 2 + 3}px)`,
                    background: "linear-gradient(90deg, #F4F4F0 0%, #6A746C 42%, #1A221C 100%)",
                    borderRadius: 3
                }}
            />
        </div>
    );
}

export default function Phone({data, phone: {src, alt, width = 288, height = 616, className}}: PhoneProps) {
    const progress = useRef(-1);
    const root = useRef<HTMLDivElement>(null);
    const scene = useRef<HTMLDivElement>(null);
    const elements = useRef<HTMLImageElement[]>([]);

    useEffect(() => {
        let currentFrame = 0;
        const calculate = (s: string): number => {
            const input = s.replaceAll("{p}", String(progress.current));
            return evaluate(input);
        }
        const render = () => {
            if (root.current) {
                const rect = root.current.getBoundingClientRect();
                const newProgress = 1 - Math.min(1, window.scrollY / Math.max(rect.height, 1) * 1.25)
                if (newProgress !== progress.current) {
                    progress.current = newProgress;
                    if (scene.current) {
                        scene.current.style.transform =
                            `rotateY(${-20 - newProgress * 10}deg) rotateX(${8 + newProgress * 6}deg) rotateZ(8deg)`;
                    }
                    elements.current.forEach((element, i) => {
                        const item = data[i];
                        if (element) {
                            element.style.opacity = calculate(item.opacity || "1").toString();
                            element.style.transform =
                                `translateX(-50%) translate3d(${calculate(item.translateX || "0")}px, ${calculate(item.translateY || "0")}px, ${calculate(item.translateZ || "0")}px) ` +
                                `rotateX(${calculate(item.rotateX || "0")}deg) ` +
                                `rotateY(${calculate(item.rotateY || "0")}deg) ` +
                                `rotateZ(${calculate(item.rotate || "0")}deg)`;
                        }
                    })
                }
            }
            currentFrame = requestAnimationFrame(render);
        }
        currentFrame = requestAnimationFrame(render);

        return () => cancelAnimationFrame(currentFrame);
    }, [data])

    return (
        <div ref={root} className="relative mx-auto [transform-style:preserve-3d]" style={{width, height, perspective: 1400}}>
            <div
                ref={scene}
                className="absolute inset-0 origin-center [transform-style:preserve-3d]"
                style={{transform: "rotateY(-30deg) rotateX(14deg) rotateZ(8deg)"}}
            >
                <div className="hidden md:block absolute inset-0 [transform-style:preserve-3d]">
                    {data.map((item, i) =>
                        <Image
                            src={item.src}
                            alt={item.alt}
                            width={item.width}
                            height={item.height}
                            unoptimized
                            className="absolute max-w-none will-change-transform"
                            style={{
                                zIndex: item.z,
                                top: item.top,
                                left: "50%",
                                opacity: 1,
                                transform: "translateX(-50%)"
                            }}
                            ref={ref => {
                                if (ref) elements.current[i] = ref
                            }}
                            key={i}
                        />
                    )}
                </div>
                <PhoneChassis src={src} alt={alt} width={width} height={height} className={className} />
            </div>
        </div>
    )
}
