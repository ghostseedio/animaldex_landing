"use client";

import Image from "next/image";
import {type ReactNode, useEffect, useRef, useState} from "react";
import type {SpeciesStoryMedia, StoryMediaItem} from "@/lib/species-story-media";

type StoryVideoProps = {
    item: StoryMediaItem;
    poster?: string;
    label: string;
    /** Above the fold: attach the source straight away instead of on scroll. */
    eager?: boolean;
    className?: string;
    /** Shown instead when the clip fails to load. */
    fallback?: ReactNode;
};

/**
 * Muted 9:16 loop. Hooks are 25–45 MB, so below-the-fold clips only get a
 * `src` once near the viewport, and any clip that fails (file gone or made
 * private) removes itself.
 */
export function StoryVideo({item, poster, label, eager = false, className = "", fallback = null}: StoryVideoProps) {
    const ref = useRef<HTMLVideoElement>(null);
    // Starts false even when eager: React's SSR drops `muted`, and an unmuted
    // server-rendered autoplay video is blocked, so the src is attached after mount.
    const [visible, setVisible] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (visible || !ref.current) return;
        if (eager) {
            setVisible(true);
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setVisible(true);
                observer.disconnect();
            }
        }, {rootMargin: "200px"});
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [eager, visible]);

    if (failed) return <>{fallback}</>;

    return (
        <video
            ref={ref}
            src={visible ? item.stable_url : undefined}
            poster={poster}
            aria-label={label}
            muted
            autoPlay
            playsInline
            loop
            preload="metadata"
            onError={() => setFailed(true)}
            className={`aspect-[9/16] w-full bg-black object-cover ${className}`}
        />
    );
}

type StoryPlayerProps = {
    item: StoryMediaItem;
    poster?: string;
    label: string;
    fallback?: ReactNode;
};

/** The narrated story video: it has audio, so it never autoplays; the viewer presses play. */
export function StoryPlayer({item, poster, label, fallback = null}: StoryPlayerProps) {
    const [failed, setFailed] = useState(false);
    if (failed) return <>{fallback}</>;
    return (
        <video
            src={item.stable_url}
            poster={poster}
            aria-label={label}
            controls
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
            className="aspect-[9/16] w-full bg-black object-cover"
        />
    );
}

function StoryStill({item, label}: {item: StoryMediaItem; label: string}) {
    const [failed, setFailed] = useState(false);
    if (failed) return null;
    return (
        <div className="relative aspect-[9/16] w-40 shrink-0 snap-start overflow-hidden border border-white/10 bg-black sm:w-48">
            <Image
                src={item.stable_url}
                alt={label}
                fill
                unoptimized
                loading="lazy"
                sizes="192px"
                onError={() => setFailed(true)}
                className="object-cover"
            />
        </div>
    );
}

type SpeciesStoryMediaSectionProps = {
    media: SpeciesStoryMedia;
    labels: {
        eyebrow: string;
        title: string;
        description: string;
        trialScene: string;
        still: string;
    };
};

/** Trial scenes and stills; the hook itself leads in the hero. */
export default function SpeciesStoryMediaSection({media, labels}: SpeciesStoryMediaSectionProps) {
    const scene = media.trialScenes[0] ?? null;
    if (!scene && media.stills.length === 0) return null;

    return (
        <section aria-label={labels.title} className="flex flex-col gap-5 border border-white/10 bg-surface-900/55 p-5 md:p-8">
            <div className="flex max-w-3xl flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/80">{labels.eyebrow}</p>
                <h2 className="font-display text-3xl font-bold text-white">{labels.title}</h2>
                <p className="text-base leading-7 text-ink-200">{labels.description}</p>
            </div>
            <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                {scene ? (
                    <div className="w-40 shrink-0 snap-start overflow-hidden border border-white/10 sm:w-48">
                        <StoryVideo item={scene} poster={media.stills[0]?.stable_url} label={labels.trialScene} />
                    </div>
                ) : null}
                {media.stills.map((still) => (
                    <StoryStill key={still.stable_url} item={still} label={labels.still} />
                ))}
            </div>
        </section>
    );
}
