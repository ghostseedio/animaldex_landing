"use client";

import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {useAppShellChrome} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";
import {AppEmpty, AppPrimaryLink, AppSegmentedControl} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {DiscoverTimelineCard} from "@/app/[locale]/(authenticated)/app/discover-timeline-cards";
import type {DiscoverCollectorItem} from "@/data/discover-collectors";
import type {DiscoverFeaturedItem, DiscoverTimelineCursor, DiscoverTimelineItem} from "@/data/discover-timeline";
import {discoverPostPath} from "@/lib/discover-post";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {getLocalePath} from "@/lib/site";
import {useCallback, useEffect, useLayoutEffect, useRef, useState, type WheelEvent} from "react";
import {useRouter} from "next/navigation";

type DiscoverSegment = "discover" | "collectors";

const DISCOVER_PAGE_SIZE = 8;
const COLLECTOR_PAGE_SIZE = 24;
const TIMELINE_PREFETCH_REMAINING = 3;
/** Same asset iOS `DiscoverTopBar.wordmark` loads. */
const DISCOVER_WORDMARK_URL = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/animaldex-text.webp";

type DiscoverHydrationPayload = {
    timeline?: DiscoverTimelineItem[];
    nextCursor?: DiscoverTimelineCursor | null;
    hasMore?: boolean;
    featured?: DiscoverFeaturedItem[];
    viewerUserId?: string | null;
};

function scrollScrollerToPost(scroller: HTMLElement, postId: string, behavior: ScrollBehavior = "auto") {
    const target = scroller.querySelector<HTMLElement>(`[data-post-id="${CSS.escape(postId)}"]`);
    if (!target) return false;
    scroller.scrollTo({top: target.offsetTop, behavior});
    return true;
}

/** Mirrors `seedTimelineWithFocusPost` so a static /p shell keeps its post first when it is not in page one. */
function seedTimelineWithFocus(timeline: DiscoverTimelineItem[], focus: DiscoverTimelineItem | null) {
    if (!focus) return timeline;
    if (timeline.some((item) => item.id === focus.id)) return timeline;
    return [focus, ...timeline];
}

function CountBadge({count}: {count: number}) {
    if (!count) return null;
    return (
        <span className="absolute -right-1.5 -top-1 rounded-full bg-primary-400 px-[5px] py-[2px] font-mono text-[9px] font-black leading-none text-black">
            {count > 99 ? "99+" : count}
        </span>
    );
}

/**
 * iOS `DiscoverTopBar`: collectors toggle + challenges on the left, wordmark in
 * the middle, notifications on the right. Sits in the flow above the snap feed
 * so nothing floats over the first post's collector chrome.
 */
function DiscoverTopBar({
    segment,
    onToggleCollectors
}: {
    segment: DiscoverSegment;
    onToggleCollectors: () => void;
}) {
    const chrome = useAppShellChrome();
    const showsCollectors = segment === "collectors";

    return (
        <div className="relative flex h-14 shrink-0 items-center justify-between px-3 lg:hidden">
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={onToggleCollectors}
                    aria-label={showsCollectors ? "Back to timeline" : "Collectors"}
                    className="grid h-11 w-11 place-items-center text-white"
                >
                    {showsCollectors ? (
                        <AppIcon name="back" className="h-[1.35rem] w-[1.35rem]" />
                    ) : (
                        <svg viewBox="0 0 24 24" className="h-[1.3rem] w-[1.3rem]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
                            <path d="M7 6H4.5a1 1 0 0 0-1 1 4 4 0 0 0 3.7 4M17 6h2.5a1 1 0 0 1 1 1 4 4 0 0 1-3.7 4" />
                            <path d="M12 14v3m-3 3h6m-3-3v3" />
                        </svg>
                    )}
                </button>
                <Link href="/challenges" aria-label="Challenges" className="grid h-11 w-11 place-items-center text-white">
                    <svg viewBox="0 0 24 24" className="h-[1.3rem] w-[1.3rem]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 21V4" />
                        <path d="M5 4h13l-2.5 4L18 12H5" />
                    </svg>
                </Link>
            </div>

            <Link href="/app" aria-label="AnimalDex" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <img src={DISCOVER_WORDMARK_URL} alt="AnimalDex" className="h-7 w-auto max-w-[9.5rem] object-contain" />
            </Link>

            <div className="flex items-center gap-1">
                <Link
                    href={chrome.isAuthenticated ? "/app/notifications" : "/account"}
                    aria-label="Notifications"
                    className="relative grid h-11 w-11 place-items-center text-white"
                >
                    <AppIcon name="bell" className="h-[1.35rem] w-[1.35rem]" />
                    {chrome.isAuthenticated ? <CountBadge count={chrome.unreadCount} /> : null}
                </Link>
                <button
                    type="button"
                    onClick={chrome.toggleMenu}
                    aria-label={chrome.menuOpen ? "Close menu" : "Open menu"}
                    className="grid h-11 w-11 place-items-center text-white"
                >
                    <AppIcon name={chrome.menuOpen ? "close" : "menu"} className="h-[1.35rem] w-[1.35rem]" />
                </button>
            </div>
        </div>
    );
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

/**
 * iOS gives an in-flight page a real snap slot ("paginationLoadingSnap") so an
 * upward swipe lands on a loading post instead of feeling frozen at the end.
 */
function TimelineLoadingSnap() {
    return (
        <div
            data-timeline-snap-item
            aria-live="polite"
            aria-label="Loading more posts"
            className="flex h-full min-h-0 shrink-0 snap-start snap-always items-center justify-center gap-2 bg-black"
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
    viewerUserId: initialViewerUserId = null,
    hydrateSignedInFeed = false
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
    /**
     * Set by the static /p/[postId] shell. That page is cached for crawlers
     * with exactly one post and no viewer, so a browser session has to turn
     * it into the live feed itself: immediately when a Supabase auth cookie
     * is present, otherwise on the first scroll intent (never for a bot that
     * only renders the page).
     */
    hydrateSignedInFeed?: boolean;
}) {
    const router = useRouter();
    const [segment, setSegment] = useState<DiscoverSegment>(initialSegment);
    const [timelineItems, setTimelineItems] = useState(timeline);
    const [nextTimelineCursor, setNextTimelineCursor] = useState<DiscoverTimelineCursor | null>(timelineCursor);
    const [featuredItems, setFeaturedItems] = useState(featured);
    const [viewerUserId, setViewerUserId] = useState(initialViewerUserId);
    const [collectorItems, setCollectorItems] = useState(collectors);
    const [hasMoreTimeline, setHasMoreTimeline] = useState(Boolean(timelineCursor));
    const [hasMoreCollectors, setHasMoreCollectors] = useState(collectors.length >= COLLECTOR_PAGE_SIZE);
    const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
    const [isLoadingCollectors, setIsLoadingCollectors] = useState(false);
    const timelineScrollerRef = useRef<HTMLElement | null>(null);
    const timelineSentinelRef = useRef<HTMLDivElement | null>(null);
    const collectorSentinelRef = useRef<HTMLDivElement | null>(null);
    const timelineSnapLockUntilRef = useRef(0);
    const activePostIdRef = useRef<string | null>(initialFocusPostId ?? timeline[0]?.id ?? null);
    const didFocusScrollRef = useRef(false);
    const timelineRequestIdRef = useRef(0);
    const hasPaginatedTimelineRef = useRef(false);
    /** "pending" = static shell waiting for a reason to fetch the live feed. */
    const feedHydrationRef = useRef<"idle" | "pending" | "loading" | "done">(hydrateSignedInFeed ? "pending" : "idle");
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
        feedHydrationRef.current = hydrateSignedInFeed ? "pending" : "idle";
        const signedIn = hydrateSignedInFeed
            && typeof document !== "undefined"
            && requestHasSupabaseAuthCookie(document.cookie);
        setTimelineItems(timeline);
        setNextTimelineCursor(timelineCursor);
        setFeaturedItems(featured);
        setViewerUserId(initialViewerUserId);
        setHasMoreTimeline(Boolean(timelineCursor) || signedIn);
        activePostIdRef.current = initialFocusPostId ?? timeline[0]?.id ?? null;
    }, [hydrateSignedInFeed, seedTimelineKey, timeline, timelineCursor, featured, initialViewerUserId, initialFocusPostId]);

    useEffect(() => {
        const signedIn = hydrateSignedInFeed
            && typeof document !== "undefined"
            && requestHasSupabaseAuthCookie(document.cookie);
        setCollectorItems(collectors);
        setHasMoreCollectors(collectors.length >= COLLECTOR_PAGE_SIZE || signedIn);
    }, [collectors, hydrateSignedInFeed]);

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

    /**
     * Turn the one-post static shell into the live feed positioned on that
     * post — the web equivalent of iOS `pendingDiscoverPostDeepLink`, which
     * loads the normal timeline and scrolls it to the linked post.
     */
    const hydrateLiveFeed = useCallback(async () => {
        if (feedHydrationRef.current !== "pending") return;
        feedHydrationRef.current = "loading";
        const requestId = ++timelineRequestIdRef.current;
        const focusId = initialFocusPostId ?? timeline[0]?.id ?? null;
        setIsLoadingTimeline(true);
        try {
            const params = new URLSearchParams({limit: String(DISCOVER_PAGE_SIZE), hydrate: "1"});
            if (focusId) params.set("focusPostId", focusId);
            const response = await fetch(`/api/app/discover?${params.toString()}`, {
                headers: {Accept: "application/json"}
            });
            if (requestId !== timelineRequestIdRef.current) return;
            if (!response.ok) {
                feedHydrationRef.current = "pending";
                setHasMoreTimeline(false);
                return;
            }
            const payload = await response.json() as DiscoverHydrationPayload;
            const focusPost = timeline.find((item) => item.id === focusId) ?? null;
            const page = seedTimelineWithFocus(payload.timeline ?? [], focusPost);
            feedHydrationRef.current = "done";
            hasPaginatedTimelineRef.current = true;
            if (page.length) setTimelineItems(page);
            setNextTimelineCursor(payload.nextCursor ?? null);
            setHasMoreTimeline(Boolean(payload.nextCursor));
            if (payload.featured?.length) setFeaturedItems(payload.featured);
            if (payload.viewerUserId) setViewerUserId(payload.viewerUserId);
        } catch {
            if (requestId === timelineRequestIdRef.current) feedHydrationRef.current = "pending";
        } finally {
            if (requestId === timelineRequestIdRef.current) {
                setIsLoadingTimeline(false);
            }
        }
    }, [initialFocusPostId, timeline]);

    const loadNextTimelinePage = useCallback(async () => {
        if (feedHydrationRef.current === "pending") {
            await hydrateLiveFeed();
            return;
        }
        if (feedHydrationRef.current === "loading") return;
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
    }, [hasMoreTimeline, hydrateLiveFeed, isLoadingTimeline, nextTimelineCursor]);

    // Signed-in readers get the live feed straight away; anonymous readers on
    // the first swipe/scroll. Both keep the shared post in view.
    useEffect(() => {
        if (segment !== "discover" || feedHydrationRef.current !== "pending") return undefined;
        if (typeof document !== "undefined" && requestHasSupabaseAuthCookie(document.cookie)) {
            void hydrateLiveFeed();
            return undefined;
        }
        const scroller = timelineScrollerRef.current;
        if (!scroller) return undefined;
        const onIntent = () => {
            void hydrateLiveFeed();
        };
        const options: AddEventListenerOptions = {passive: true, once: true};
        scroller.addEventListener("touchstart", onIntent, options);
        scroller.addEventListener("wheel", onIntent, options);
        scroller.addEventListener("pointerdown", onIntent, options);
        window.addEventListener("keydown", onIntent, options);
        return () => {
            scroller.removeEventListener("touchstart", onIntent);
            scroller.removeEventListener("wheel", onIntent);
            scroller.removeEventListener("pointerdown", onIntent);
            window.removeEventListener("keydown", onIntent);
        };
    }, [segment, hydrateLiveFeed, seedTimelineKey]);

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

    // Mouse wheels / trackpads: one notch = one post, like a swipe. Touch is
    // left to native scroll-snap (snap-mandatory + snap-always), which already
    // behaves like iOS `.viewAligned(limitBehavior: .always)`; fighting it with
    // scrollTo() on touchend is what made the feed feel stuck on phones.
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

    useEffect(() => {
        if (segment !== "discover" || !hasMoreTimeline) return undefined;
        const scroller = timelineScrollerRef.current;
        const node = timelineSentinelRef.current;
        if (!scroller || !node) return undefined;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                void loadNextTimelinePage();
            }
        // Two viewports of runway so fast swipes never land on a loading slot.
        }, {root: scroller, rootMargin: "200% 0px"});
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
        <div className="flex h-full min-h-0 flex-col lg:block lg:h-auto lg:space-y-8">
            <DiscoverTopBar
                segment={segment}
                onToggleCollectors={() => handleSegmentChange(segment === "collectors" ? "discover" : "collectors")}
            />

            {/* Desktop keeps the floating segment toggle beside the feed column. */}
            <div className="pointer-events-none fixed left-[calc(17rem+2.5rem)] top-6 z-40 hidden lg:block">
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
                <div className="min-h-0 flex-1 lg:grid lg:w-full lg:grid-cols-[10rem_minmax(0,42rem)_20rem] lg:items-start lg:justify-between lg:gap-4 xl:grid-cols-[12rem_minmax(0,42rem)_20rem]">
                    <div aria-hidden="true" className="hidden lg:block" />
                    <div className="h-full min-h-0 min-w-0">
                        {timelineItems.length ? (
                            <section
                                ref={timelineScrollerRef}
                                onWheel={handleTimelineWheel}
                                // Phones: the feed is the whole area between the top bar and the tab
                                // bar (iOS `feedViewportHeight`), one post per snap slot.
                                className="h-full min-h-0 snap-y snap-mandatory overflow-y-auto overscroll-contain bg-black [scrollbar-width:none] lg:h-[90svh] lg:min-h-[42rem] lg:rounded-[1.35rem] lg:border lg:border-white/[0.08] [&::-webkit-scrollbar]:hidden"
                            >
                                {/* Flush stacking: iOS uses VStack(spacing: 0) so one
                                    swipe always lands on exactly one post. */}
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
                                {isLoadingTimeline ? <TimelineLoadingSnap /> : null}
                                {hasMoreTimeline ? (
                                    <div ref={timelineSentinelRef} aria-hidden="true" className="h-px" />
                                ) : null}
                            </section>
                        ) : (
                            <div className="px-4 py-6 lg:p-0">
                                <AppEmpty
                                    icon="home"
                                    title="Timeline is quiet"
                                    detail="Check back soon, or make one of your animals public and comparison-ready."
                                    action={<AppPrimaryLink href="/app/capture" icon="camera" className="hidden md:inline-flex">Scan an animal</AppPrimaryLink>}
                                />
                            </div>
                        )}
                    </div>
                    <FeaturedPanel items={featuredItems} />
                </div>
            ) : collectorItems.length ? (
                // iOS keeps the last collector row and pagination spinner above
                // the floating tab bar (padding.bottom 124) — same here.
                <section className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-8 pt-2 [scrollbar-width:none] lg:mx-auto lg:h-auto lg:max-w-3xl lg:overflow-visible lg:px-0 lg:pb-0 lg:pt-0 [&::-webkit-scrollbar]:hidden">
                    {collectorItems.map((collector) => <CollectorCard key={collector.userId} collector={collector} />)}
                    {isLoadingCollectors ? (
                        <CollectorLoadingSkeleton />
                    ) : null}
                    {hasMoreCollectors ? (
                        <div ref={collectorSentinelRef} aria-hidden="true" className="h-px" />
                    ) : null}
                </section>
            ) : (
                <div className="px-4 py-6 lg:p-0">
                    <AppEmpty icon="collection" title="No collectors yet" detail="Public collector profiles will appear here as the community grows." />
                </div>
            )}
        </div>
    );
}
