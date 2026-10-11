"use client";

import Link from "@/app/[locale]/_components/link";
import {type LessonVideo, type LessonVideoPage, mergeLessonVideos} from "@/lib/lesson-videos";
import {useCallback, useEffect, useRef, useState} from "react";

/** Load the next page when the video on screen is this close to the end. */
const PREFETCH_REMAINING = 2;
const WHEEL_LOCK_MS = 420;

/** iOS SF Symbol `play.rectangle` / `play.rectangle.fill`, square corners. */
export function PlayRectangleIcon({filled = false, className = "h-[1.3rem] w-[1.3rem]"}: {filled?: boolean; className?: string}) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <rect x="2.5" y="4.5" width="19" height="15" fill={filled ? "currentColor" : "none"} />
            <path d="M10 8.75v6.5L15.25 12Z" fill={filled ? "#000" : "currentColor"} stroke={filled ? "#000" : "currentColor"} strokeWidth="1.5" />
        </svg>
    );
}

function PageLoading({label}: {label: string}) {
    return (
        <div aria-label={label} className="flex h-full w-full items-center justify-center gap-2">
            <span className="h-2 w-2 animate-pulse bg-white/30" />
            <span className="h-2 w-2 animate-pulse bg-white/30 [animation-delay:120ms]" />
            <span className="h-2 w-2 animate-pulse bg-white/30 [animation-delay:240ms]" />
        </div>
    );
}

/**
 * The video on screen. iOS `StoryVideoPreviewPlayer` starts it at once and
 * loops it; here it starts muted (browsers block sound without a tap, and the
 * feed never plays sound on its own). Once the viewer turns the sound on, the
 * next videos keep it, which is their choice, not an autoplay with sound.
 */
function LessonVideoPlayer({
    video,
    soundOn,
    onSoundChange
}: {
    video: LessonVideo;
    soundOn: boolean;
    onSoundChange: (on: boolean) => void;
}) {
    const ref = useRef<HTMLVideoElement | null>(null);
    const [failed, setFailed] = useState(false);
    const soundOnRef = useRef(soundOn);
    soundOnRef.current = soundOn;

    useEffect(() => {
        const element = ref.current;
        if (!element) return undefined;
        // Set as a property: React does not reliably reflect `muted`.
        element.muted = !soundOnRef.current;
        element.play().catch(() => {
            // The browser refused sound without a fresh gesture: play muted.
            if (!element.muted) {
                element.muted = true;
                onSoundChange(false);
                void element.play().catch(() => undefined);
            }
        });
        return () => element.pause();
    }, [video.url, onSoundChange]);

    if (failed) {
        return (
            <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-white/55">
                Couldn&apos;t play this video.
            </div>
        );
    }

    return (
        <video
            ref={ref}
            src={video.url}
            aria-label={video.speciesName ? `${video.speciesName} lesson video` : "Animal lesson video"}
            controls
            playsInline
            loop
            preload="auto"
            onVolumeChange={(event) => onSoundChange(!event.currentTarget.muted && event.currentTarget.volume > 0)}
            onError={() => setFailed(true)}
            className="h-full w-full bg-black object-contain"
        />
    );
}

/**
 * iOS `DiscoverLessonVideoFeedView`: every published lesson video, newest
 * first, one per snap slot, paged through /api/app/lesson-videos. Only the
 * video on screen is mounted, so only it loads and plays. Like iOS, nothing
 * sits over the video: it carries its own title, captions and credit.
 */
export default function LessonVideoFeed({locale}: {locale: string}) {
    const [videos, setVideos] = useState<LessonVideo[]>([]);
    const [nextBefore, setNextBefore] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [didLoad, setDidLoad] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [signedOut, setSignedOut] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [soundOn, setSoundOn] = useState(false);
    const scrollerRef = useRef<HTMLElement | null>(null);
    const loadingRef = useRef(false);
    const wheelLockUntilRef = useRef(0);

    const loadPage = useCallback(async (before: string | null, replace: boolean) => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        setIsLoading(true);
        try {
            const params = new URLSearchParams({locale});
            if (before) params.set("before", before);
            const response = await fetch(`/api/app/lesson-videos?${params.toString()}`, {headers: {Accept: "application/json"}});
            if (response.status === 401) {
                setSignedOut(true);
                setNextBefore(null);
                return;
            }
            if (!response.ok) throw new Error(String(response.status));
            const page = await response.json() as LessonVideoPage;
            setLoadFailed(false);
            setVideos((current) => mergeLessonVideos(replace ? [] : current, page.items ?? []));
            setNextBefore(page.nextBefore ?? null);
        } catch {
            // A failed next page just ends the feed where it is.
            setLoadFailed(true);
            setNextBefore(null);
        } finally {
            loadingRef.current = false;
            setIsLoading(false);
            setDidLoad(true);
        }
    }, [locale]);

    useEffect(() => {
        void loadPage(null, true);
    }, [loadPage]);

    const reload = useCallback(() => {
        setVideos([]);
        setActiveId(null);
        setNextBefore(null);
        setDidLoad(false);
        void loadPage(null, true);
    }, [loadPage]);

    useEffect(() => {
        if (!activeId && videos[0]) setActiveId(videos[0].id);
    }, [activeId, videos]);

    // The page holding most of the screen is the one that plays.
    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return undefined;
        const observer = new IntersectionObserver((entries) => {
            const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
            const id = visible?.target.getAttribute("data-video-id");
            if (id) setActiveId(id);
        }, {root: scroller, threshold: [0.6, 0.85]});
        for (const node of Array.from(scroller.querySelectorAll("[data-video-id]"))) observer.observe(node);
        return () => observer.disconnect();
    }, [videos]);

    // iOS loads more when the last video appears; a little earlier here.
    useEffect(() => {
        if (!nextBefore || !activeId) return;
        const index = videos.findIndex((video) => video.id === activeId);
        if (index >= 0 && videos.length - 1 - index < PREFETCH_REMAINING) void loadPage(nextBefore, false);
    }, [activeId, loadPage, nextBefore, videos]);

    // Mouse wheels and trackpads: one notch, one video. Touch keeps native
    // snapping. Native listener, because React's wheel handler is passive.
    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return undefined;
        const onWheel = (event: globalThis.WheelEvent) => {
            if (Math.abs(event.deltaY) < Math.max(6, Math.abs(event.deltaX))) return;
            event.preventDefault();
            const now = Date.now();
            if (now < wheelLockUntilRef.current) return;
            wheelLockUntilRef.current = now + WHEEL_LOCK_MS;
            const pages = Array.from(scroller.querySelectorAll<HTMLElement>("[data-video-snap]"));
            const current = Math.round(scroller.scrollTop / Math.max(1, scroller.clientHeight));
            const target = pages[Math.max(0, Math.min(pages.length - 1, current + (event.deltaY > 0 ? 1 : -1)))];
            if (target) scroller.scrollTo({top: target.offsetTop, behavior: "smooth"});
        };
        scroller.addEventListener("wheel", onWheel, {passive: false});
        return () => scroller.removeEventListener("wheel", onWheel);
    }, [videos.length]);

    const frame = "h-full min-h-0 bg-black lg:h-[90svh] lg:min-h-[42rem] lg:border lg:border-white/[0.08]";

    if (videos.length === 0) {
        return (
            <div className={`${frame} flex flex-col items-center justify-center gap-3 px-6 text-center`}>
                {isLoading || !didLoad ? (
                    <PageLoading label="Loading lesson videos" />
                ) : signedOut ? (
                    <>
                        <PlayRectangleIcon className="h-9 w-9 text-white/35" />
                        <p className="text-sm text-white/60">Sign in to watch animal lesson videos.</p>
                        <Link href="/account" className="rounded-[2px] px-3 py-2 text-xs font-bold text-primary-400">Sign in</Link>
                    </>
                ) : (
                    <>
                        <PlayRectangleIcon className="h-9 w-9 text-white/35" />
                        <p className="text-sm text-white/60">{loadFailed ? "Couldn't load the videos." : "No animal lesson videos yet."}</p>
                        <button type="button" onClick={reload} className="rounded-[2px] px-3 py-2 text-xs font-bold text-primary-400">
                            Try again
                        </button>
                    </>
                )}
            </div>
        );
    }

    return (
        <section
            ref={scrollerRef}
            aria-label="Animal lesson videos"
            className={`${frame} snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
            {videos.map((video) => (
                <div
                    key={video.id}
                    data-video-snap
                    data-video-id={video.id}
                    className="relative h-full min-h-0 snap-start snap-always overflow-hidden bg-black"
                >
                    {activeId === video.id
                        ? <LessonVideoPlayer video={video} soundOn={soundOn} onSoundChange={setSoundOn} />
                        : <PageLoading label="Lesson video" />}
                </div>
            ))}
            {isLoading ? (
                <div data-video-snap className="h-full min-h-0 snap-start snap-always">
                    <PageLoading label="Loading more lesson videos" />
                </div>
            ) : null}
        </section>
    );
}
