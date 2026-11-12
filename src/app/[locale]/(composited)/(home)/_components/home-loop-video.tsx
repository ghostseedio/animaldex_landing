"use client";

import {useEffect, useRef} from "react";

/**
 * A short silent loop that downloads and plays only while it is on screen, and never under reduced motion (the
 * poster stands still instead).
 */
export default function HomeLoopVideo({sources, poster, label, className}: {sources: Array<{src: string; type: string}>; poster: string; label: string; className?: string}) {
    const ref = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        const video = ref.current;
        if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                if (video.preload === "none") video.preload = "auto";
                void video.play().catch(() => undefined);
            } else {
                video.pause();
            }
        }, {rootMargin: "120px"});
        observer.observe(video);
        return () => observer.disconnect();
    }, []);

    return (
        <video ref={ref} className={className} poster={poster} muted loop playsInline preload="none" aria-label={label}>
            {sources.map((source) => <source key={source.src} src={source.src} type={source.type} />)}
        </video>
    );
}
