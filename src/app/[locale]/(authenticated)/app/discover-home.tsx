"use client";

import Link from "@/app/[locale]/_components/link";
import {AppEmpty, AppPage, AppPrimaryLink, AppSegmentedControl} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {DiscoverTimelineCard} from "@/app/[locale]/(authenticated)/app/discover-timeline-cards";
import type {DiscoverCollectorItem} from "@/data/discover-collectors";
import type {DiscoverFeaturedItem, DiscoverTimelineCursor, DiscoverTimelineItem} from "@/data/discover-timeline";
import {discoverPostPath} from "@/lib/discover-post";
import {getLocalePath} from "@/lib/site";
import {type TouchEvent, useCallback, useEffect, useLayoutEffect, useRef, useState, type WheelEvent} from "react";
import {useRouter} from "next/navigation";

type DiscoverSegment = "discover" | "collectors";

const DISCOVER_PAGE_SIZE = 4;
const COLLECTOR_PAGE_SIZE = 24;
const TIMELINE_PREFETCH_REMAINING = 2;

function scrollScrollerToPost(scroller: HTMLElement, postId: string, behavior: ScrollBehavior = "auto") {
    const target = scroller.querySelector<HTMLElement>(`[data-post-id="${CSS.escape(postId)}"]`);
    if (!target) return false;
    scroller.scrollTo({top: target.offsetTop, behavior});
    return true;
}

function FeaturedPanel({items}: {items: DiscoverFeaturedItem[]}) {
    return (
        <aside className="hidden h-[90svh] min-h-[42rem] overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#121212]/90 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.95)] lg:flex lg:flex-col">
            <div className="space-y-3 border-b border-white/[0.06] p-3">
                <AppPrimaryLink href="/app/capture" icon="camera" className="w-full">Scan an animal</AppPrimaryLink>
            </div>
            <div className="border-b border-white/[0.06] px-4 py-3">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white/45">Recent top captures</h2>
                <p className="mt-1 text-xs text-white/30">Select a top capture</p>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {items.length ? (
                    items.map((item) => (
                        <Link
                            key={`${item.kind}-${item.captureId}`}
                            href={item.href}
                            className="group grid grid-cols-[4.5rem_1fr] gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-2 transition hover:border-primary-400/25 hover:bg-white/[0.05]"
                        >
                            <div className="aspect-square overflow-hidden rounded-xl bg-black">
                                <img
                                    src={item.imageSrc}
                                    alt={item.animalName}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                />
                            </div>
                            <div className="min-w-0 self-center">
                                <p className="line-clamp-2 text-sm font-bold leading-5 text-white">{item.animalName}</p>
                                <p className={`mt-1 text-[0.62rem] font-black uppercase tracking-[0.12em] ${item.kind === "endorsed" ? "text-cyan-200/80" : "text-amber-200/80"}`}>
                                    {item.kind === "endorsed" ? "Top endorsed" : "Rare capture"}
                                </p>
                            </div>
                        </Link>
                    ))
                ) : (
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 text-sm leading-6 text-white/40">
                        No featured captures yet.
                    </div>
                )}
            </div>
        </aside>
    );
}

function TimelineLoadingPreview() {
    return (
        <div
            aria-live="polite"
            aria-label="Loading more posts"
            className="flex shrink-0 items-center justify-center gap-2 py-5"
        >
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-white/25" />
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-white/25 [animation-delay:120ms]" />
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-white/25 [animation-delay:240ms]" />
        </div>
    );
}

function CollectorLoadingSkeleton() {
    return (
        <div aria-live="polite" aria-label="Loading more collectors" className="space-y-3">
            {[0, 1].map((item) => (
                <article
                    key={item}
                    className="flex gap-4 rounded-[1.35rem] border border-white/[0.08] bg-[#121212]/90 p-4 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.95)] md:p-5"
                >
                    <div className="h-16 w-16 shrink-0 animate-pulse rounded-2xl bg-white/10 ring-1 ring-white/10" />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-2">
                                <div className="h-6 w-36 animate-pulse rounded-full bg-white/12" />
                                <div className="h-4 w-24 animate-pulse rounded-full bg-white/[0.07]" />
                                <div className="h-3 w-28 animate-pulse rounded-full bg-white/[0.055]" />
                            </div>
                            <div className="h-8 w-16 shrink-0 animate-pulse rounded-full bg-primary-400/20" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <div className="h-6 w-20 animate-pulse rounded-full bg-white/[0.06]" />
                            <div className="h-6 w-28 animate-pulse rounded-full bg-white/[0.06]" />
                            <div className="h-6 w-16 animate-pulse rounded-full bg-amber-400/10" />
                        </div>
                        <div className="mt-3 space-y-2">
                            <div className="h-3.5 w-full animate-pulse rounded-full bg-white/[0.055]" />
                            <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-white/[0.055]" />
                        </div>
                    </div>
                    <div className="hidden w-20 shrink-0 animate-pulse rounded-2xl border border-white/10 bg-white/[0.06] sm:block" />
                </article>
            ))}
        </div>
    );
}

function CollectorCard({collector}: {collector: DiscoverCollectorItem}) {
    const content = (
        <article className="flex gap-4 rounded-[1.35rem] border border-white/[0.08] bg-[#121212]/90 p-4 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.95)] transition hover:border-primary-400/25 hover:bg-[#161616] md:p-5">
            {collector.avatarUrl
                ? <img src={collector.avatarUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-white/10" />
                : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-lg font-black text-white/35 ring-1 ring-white/10">{(collector.displayName || "C").slice(0, 1)}</div>}
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-display text-xl font-bold text-white">{collector.displayName}</h3>
                            {collector.isPro ? <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-amber-100">Pro</span> : null}
                        </div>
                        {collector.username ? <p className="text-sm text-white/40">@{collector.username}</p> : null}
                        <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white/35">{collector.scoreTierLabel}</p>
                    </div>
                    <span className="rounded-full bg-primary-400 px-3 py-1 text-sm font-black tabular-nums text-black">{collector.collectorScore.toLocaleString()}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem] font-bold text-white/50">
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1">{collector.captureCount} captures</span>
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1">{collector.indexedSpeciesCount}/{collector.catalogSpeciesCount} indexed</span>
                    {collector.rareFinds > 0 ? <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-amber-200">{collector.rareFinds} rare</span> : null}
                </div>
                {collector.bio ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/40">{collector.bio}</p> : null}
            </div>
            {collector.bestFindImageSrc ? (
                <div className="hidden w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:block">
                    <img src={collector.bestFindImageSrc} alt={collector.bestFindAnimalName ?? "Best find"} loading="lazy" className="aspect-square h-full w-full object-cover" />
                </div>
            ) : null}
        </article>
    );

    if (collector.href) {
        return <Link href={collector.href} className="block">{content}</Link>;
    }

    return content;
}

export default function DiscoverHome({
    locale,
    timeline,
    timelineCursor,
    featured,
    collectors,
    initialSegment = "discover",
    initialFocusPostId = null,
    syncPostUrls = true,
    viewerUserId = null
}: {
    locale: string;
    timeline: DiscoverTimelineItem[];
    timelineCursor: DiscoverTimelineCursor | null;
    featured: DiscoverFeaturedItem[];
    collectors: DiscoverCollectorItem[];
    initialSegment?: DiscoverSegment;
    initialFocusPostId?: string | null;
    syncPostUrls?: boolean;
    viewerUserId?: string | null;
}) {
    const router = useRouter();
    const [segment, setSegment] = useState<DiscoverSegment>(initialSegment);
    const [timelineItems, setTimelineItems] = useState(timeline);
    const [nextTimelineCursor, setNextTimelineCursor] = useState<DiscoverTimelineCursor | null>(timelineCursor);
    const [collectorItems, setCollectorItems] = useState(collectors);
    const [hasMoreTimeline, setHasMoreTimeline] = useState(Boolean(timelineCursor));
    const [hasMoreCollectors, setHasMoreCollectors] = useState(collectors.length >= COLLECTOR_PAGE_SIZE);
    const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
    const [isLoadingCollectors, setIsLoadingCollectors] = useState(false);
    const timelineScrollerRef = useRef<HTMLElement | null>(null);
    const timelineSentinelRef = useRef<HTMLDivElement | null>(null);
    const collectorSentinelRef = useRef<HTMLDivElement | null>(null);
    const timelineSnapLockUntilRef = useRef(0);
    const timelineTouchStartYRef = useRef<number | null>(null);
    const activePostIdRef = useRef<string | null>(initialFocusPostId ?? timeline[0]?.id ?? null);
    const didFocusScrollRef = useRef(false);
    const timelineRequestIdRef = useRef(0);
    const hasPaginatedTimelineRef = useRef(false);
    const seedTimelineKey = `${timeline.map((item) => item.id).join("|")}|${timelineCursor?.id ?? ""}`;
    const seedTimelineKeyRef = useRef(seedTimelineKey);

    function handleSegmentChange(next: DiscoverSegment) {
        setSegment(next);
        if (next === "collectors") {
            router.replace(getLocalePath(locale, "/app?view=collectors"));
            return;
        }
        const activePostId = activePostIdRef.current ?? timelineItems[0]?.id ?? null;
        router.replace(getLocalePath(locale, activePostId ? discoverPostPath(activePostId) : "/app"));
    }

    const syncUrlToPost = useCallback((postId: string) => {
        if (!syncPostUrls) return;
        if (activePostIdRef.current === postId) return;
        activePostIdRef.current = postId;
        const nextPath = getLocalePath(locale, discoverPostPath(postId));
        if (typeof window !== "undefined" && window.location.pathname !== nextPath) {
            window.history.replaceState(window.history.state, "", nextPath);
        }
    }, [locale, syncPostUrls]);

    useEffect(() => {
        // Only resync from server props when the seed itself changes (new post page),
        // never after the user has already paginated the client feed.
        if (seedTimelineKeyRef.current === seedTimelineKey && hasPaginatedTimelineRef.current) {
            return;
        }
        seedTimelineKeyRef.current = seedTimelineKey;
        hasPaginatedTimelineRef.current = false;
        didFocusScrollRef.current = false;
        setTimelineItems(timeline);
        setNextTimelineCursor(timelineCursor);
        setHasMoreTimeline(Boolean(timelineCursor));
        activePostIdRef.current = initialFocusPostId ?? timeline[0]?.id ?? null;
    }, [seedTimelineKey, timeline, timelineCursor, initialFocusPostId]);

    useEffect(() => {
        setCollectorItems(collectors);
        setHasMoreCollectors(collectors.length >= COLLECTOR_PAGE_SIZE);
    }, [collectors]);

    const loadNextCollectorPage = useCallback(async () => {
        if (isLoadingCollectors || !hasMoreCollectors) return;
        setIsLoadingCollectors(true);
        try {
            const params = new URLSearchParams({
                offset: String(collectorItems.length),
                limit: String(COLLECTOR_PAGE_SIZE)
            });
            const response = await fetch(`/api/app/collectors?${params.toString()}`, {
                headers: {Accept: "application/json"}
            });
            if (!response.ok) {
                setHasMoreCollectors(false);
                return;
            }
            const payload = await response.json() as {collectors?: DiscoverCollectorItem[]; hasMore?: boolean};
            const nextItems = payload.collectors ?? [];
            setCollectorItems((current) => {
                const seen = new Set(current.map((item) => item.userId));
                const merged = [...current];
                for (const item of nextItems) {
                    if (seen.has(item.userId)) continue;
                    seen.add(item.userId);
                    merged.push(item);
                }
                return merged;
            });
            setHasMoreCollectors(Boolean(payload.hasMore) && nextItems.length > 0);
        } finally {
            setIsLoadingCollectors(false);
        }
    }, [collectorItems.length, hasMoreCollectors, isLoadingCollectors]);

    const loadNextTimelinePage = useCallback(async () => {
        if (isLoadingTimeline || !hasMoreTimeline) return;
        const requestId = ++timelineRequestIdRef.current;
        const cursor = nextTimelineCursor;
        setIsLoadingTimeline(true);
        try {
            const params = new URLSearchParams({
                limit: String(DISCOVER_PAGE_SIZE)
            });
            if (cursor) {
                params.set("cursorDate", cursor.date);
                params.set("cursorRank", String(cursor.sortRank));
                params.set("cursorId", cursor.id);
            }
            const response = await fetch(`/api/app/discover?${params.toString()}`, {
                headers: {Accept: "application/json"}
            });
            if (requestId !== timelineRequestIdRef.current) return;
            if (!response.ok) {
                setHasMoreTimeline(false);
                return;
            }
            const payload = await response.json() as {timeline?: DiscoverTimelineItem[]; nextCursor?: DiscoverTimelineCursor | null; hasMore?: boolean};
            const nextItems = payload.timeline ?? [];
            hasPaginatedTimelineRef.current = true;
            setTimelineItems((current) => {
                const seen = new Set(current.map((item) => item.id));
                const merged = [...current];
                for (const item of nextItems) {
                    if (seen.has(item.id)) continue;
                    seen.add(item.id);
                    merged.push(item);
                }
                return merged;
            });
            setNextTimelineCursor(payload.nextCursor ?? null);
            setHasMoreTimeline(Boolean(payload.nextCursor) && nextItems.length > 0);
        } finally {
            if (requestId === timelineRequestIdRef.current) {
                setIsLoadingTimeline(false);
            }
        }
    }, [hasMoreTimeline, isLoadingTimeline, nextTimelineCursor]);

    const snapTimeline = useCallback((direction: 1 | -1) => {
        const scroller = timelineScrollerRef.current;
        if (!scroller) return false;

        const items = Array.from(scroller.querySelectorAll<HTMLElement>("[data-timeline-snap-item]"));
        if (!items.length) return false;

        const currentTop = scroller.scrollTop;
        let currentIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;

        items.forEach((item, index) => {
            const distance = Math.abs(item.offsetTop - currentTop);
            if (distance < closestDistance) {
                closestDistance = distance;
                currentIndex = index;
            }
        });

        const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + direction));
        if (nextIndex === currentIndex) return false;

        const nextItem = items[nextIndex];
        if (!nextItem) return false;

        scroller.scrollTo({top: nextItem.offsetTop, behavior: "smooth"});
        const postId = nextItem.getAttribute("data-post-id");
        if (postId) syncUrlToPost(postId);

        if (direction > 0 && items.length - nextIndex <= TIMELINE_PREFETCH_REMAINING) {
            void loadNextTimelinePage();
        }

        return true;
    }, [loadNextTimelinePage, syncUrlToPost]);

    const handleTimelineWheel = useCallback((event: WheelEvent<HTMLElement>) => {
        const verticalDelta = event.deltaY;
        if (Math.abs(verticalDelta) < Math.max(6, Math.abs(event.deltaX))) return;

        event.preventDefault();

        const now = Date.now();
        if (now < timelineSnapLockUntilRef.current) return;

        timelineSnapLockUntilRef.current = now + 420;
        const direction = verticalDelta > 0 ? 1 : -1;
        const didMove = snapTimeline(direction);
        if (!didMove && direction > 0 && hasMoreTimeline) {
            void loadNextTimelinePage();
        }
    }, [hasMoreTimeline, loadNextTimelinePage, snapTimeline]);

    const handleTimelineTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
        timelineTouchStartYRef.current = event.touches[0]?.clientY ?? null;
    }, []);

    const handleTimelineTouchEnd = useCallback((event: TouchEvent<HTMLElement>) => {
        const startY = timelineTouchStartYRef.current;
        timelineTouchStartYRef.current = null;
        const endY = event.changedTouches[0]?.clientY;
        if (startY == null || endY == null) return;

        const delta = startY - endY;
        if (Math.abs(delta) < 18) return;

        const now = Date.now();
        if (now < timelineSnapLockUntilRef.current) return;

        timelineSnapLockUntilRef.current = now + 420;
        const direction = delta > 0 ? 1 : -1;
        const didMove = snapTimeline(direction);
        if (!didMove && direction > 0 && hasMoreTimeline) {
            void loadNextTimelinePage();
        }
    }, [hasMoreTimeline, loadNextTimelinePage, snapTimeline]);

    useEffect(() => {
        if (segment !== "discover" || !hasMoreTimeline) return undefined;
        const scroller = timelineScrollerRef.current;
        const node = timelineSentinelRef.current;
        if (!scroller || !node) return undefined;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                void loadNextTimelinePage();
            }
        }, {root: scroller, rootMargin: "240px 0px"});
        observer.observe(node);
        return () => observer.disconnect();
    }, [segment, hasMoreTimeline, loadNextTimelinePage, timelineItems.length]);

    useEffect(() => {
        if (segment !== "collectors" || !hasMoreCollectors) return undefined;
        const node = collectorSentinelRef.current;
        if (!node) return undefined;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                void loadNextCollectorPage();
            }
        }, {rootMargin: "500px 0px"});
        observer.observe(node);
        return () => observer.disconnect();
    }, [segment, hasMoreCollectors, loadNextCollectorPage]);

    useLayoutEffect(() => {
        if (segment !== "discover") return;
        const scroller = timelineScrollerRef.current;
        if (!scroller) return;

        const focusId = initialFocusPostId;
        if (focusId && !didFocusScrollRef.current) {
            if (scrollScrollerToPost(scroller, focusId, "auto")) {
                didFocusScrollRef.current = true;
                activePostIdRef.current = focusId;
                syncUrlToPost(focusId);
            }
            return;
        }

        const activeId = activePostIdRef.current;
        if (!activeId) return;
        const target = scroller.querySelector<HTMLElement>(`[data-post-id="${CSS.escape(activeId)}"]`);
        if (!target) return;
        if (Math.abs(scroller.scrollTop - target.offsetTop) > 48) {
            scroller.scrollTo({top: target.offsetTop, behavior: "auto"});
        }
    }, [segment, initialFocusPostId, timelineItems, isLoadingTimeline, syncUrlToPost]);

    useEffect(() => {
        if (segment !== "discover" || !syncPostUrls) return undefined;
        const scroller = timelineScrollerRef.current;
        if (!scroller) return undefined;

        const items = Array.from(scroller.querySelectorAll<HTMLElement>("[data-post-id]"));
        if (!items.length) return undefined;

        const observer = new IntersectionObserver((entries) => {
            const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
            const postId = visible?.target.getAttribute("data-post-id");
            if (postId) syncUrlToPost(postId);
        }, {
            root: scroller,
            threshold: [0.55, 0.7, 0.85]
        });

        for (const item of items) observer.observe(item);
        if (!activePostIdRef.current && items[0]) {
            const firstId = items[0].getAttribute("data-post-id");
            if (firstId) syncUrlToPost(firstId);
        }

        return () => observer.disconnect();
    }, [segment, syncPostUrls, timelineItems, syncUrlToPost]);

    return (
        <AppPage>
            <div className="relative">
                <div className="pointer-events-none fixed left-1/2 top-[4.75rem] z-40 -translate-x-1/2 lg:left-[calc(17rem+2.5rem)] lg:top-6 lg:translate-x-0">
                    <div className="pointer-events-auto rounded-[1.25rem] border border-white/10 bg-black/70 p-1 shadow-[0_18px_45px_-24px_rgba(0,0,0,0.95)] backdrop-blur-xl">
                        <AppSegmentedControl
                            value={segment}
                            options={[
                                {id: "discover", label: "Discover"},
                                {id: "collectors", label: "Collectors"}
                            ]}
                            onChange={handleSegmentChange}
                        />
                    </div>
                </div>

                {segment === "discover" ? (
                    <div className="grid w-full gap-4 lg:grid-cols-[10rem_minmax(0,42rem)_20rem] lg:items-start lg:justify-between xl:grid-cols-[12rem_minmax(0,42rem)_20rem]">
                        <div aria-hidden="true" className="hidden lg:block" />
                        <div className="min-w-0">
                            {timelineItems.length ? (
                                <section
                                    ref={timelineScrollerRef}
                                    onWheel={handleTimelineWheel}
                                    onTouchStart={handleTimelineTouchStart}
                                    onTouchEnd={handleTimelineTouchEnd}
                                    className="h-[calc(100svh-7.5rem)] min-h-[34rem] snap-y snap-mandatory space-y-4 overflow-y-auto overscroll-contain scroll-smooth pr-1 [scrollbar-width:none] md:h-[90svh] md:min-h-[42rem] [&::-webkit-scrollbar]:hidden"
                                >
                                    {timelineItems.map((item) => (
                                        <div
                                            key={item.id}
                                            data-timeline-snap-item
                                            data-post-id={item.id}
                                            className="h-full min-h-0 snap-start snap-always"
                                        >
                                            <DiscoverTimelineCard item={item} locale={locale} viewerUserId={viewerUserId} />
                                        </div>
                                    ))}
                                    {isLoadingTimeline ? <TimelineLoadingPreview /> : null}
                                    {hasMoreTimeline ? (
                                        <div ref={timelineSentinelRef} aria-hidden="true" className="h-px" />
                                    ) : null}
                                </section>
                            ) : (
                                <AppEmpty
                                    icon="home"
                                    title="Timeline is quiet"
                                    detail="Check back soon, or make one of your animals public and comparison-ready."
                                    action={<AppPrimaryLink href="/app/capture" icon="camera" className="hidden md:inline-flex">Scan an animal</AppPrimaryLink>}
                                />
                            )}
                        </div>
                        <FeaturedPanel items={featured} />
                    </div>
                ) : collectorItems.length ? (
                    <section className="mx-auto max-w-3xl space-y-3">
                        {collectorItems.map((collector) => <CollectorCard key={collector.userId} collector={collector} />)}
                        {isLoadingCollectors ? (
                            <CollectorLoadingSkeleton />
                        ) : null}
                        {hasMoreCollectors ? (
                            <div ref={collectorSentinelRef} aria-hidden="true" className="h-px" />
                        ) : null}
                    </section>
                ) : (
                    <AppEmpty icon="collection" title="No collectors yet" detail="Public collector profiles will appear here as the community grows." />
                )}
            </div>
        </AppPage>
    );
}
