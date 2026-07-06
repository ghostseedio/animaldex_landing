"use client";

import Link from "@/app/[locale]/_components/link";
import {AppEmpty, AppPage, AppPrimaryLink, AppSegmentedControl} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {DiscoverTimelineCard} from "@/app/[locale]/(authenticated)/app/discover-timeline-cards";
import type {DiscoverCollectorItem} from "@/data/discover-collectors";
import type {DiscoverFeaturedItem, DiscoverTimelineItem} from "@/data/discover-timeline";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useRouter} from "next/navigation";

type DiscoverSegment = "discover" | "collectors";

const WORDMARK_SRC = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/animaldex-text.webp";
const DISCOVER_PAGE_SIZE = 12;
const COLLECTOR_BATCH_SIZE = 8;

function FeaturedStrip({items}: {items: DiscoverFeaturedItem[]}) {
    if (!items.length) return null;

    return (
        <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white/45">Featured</h2>
                    <p className="mt-1 text-xs text-white/30">Endorsed and rare finds from the community</p>
                </div>
            </div>
            <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {items.map((item) => (
                    <Link key={`${item.kind}-${item.captureId}`} href={item.href} className="group w-[7.75rem] shrink-0 snap-start">
                        <div className={`rounded-[1.2rem] p-[2px] ${item.kind === "endorsed" ? "bg-gradient-to-br from-cyan-300/80 to-cyan-500/30" : "bg-gradient-to-br from-amber-300/80 to-amber-500/30"}`}>
                            <div className="overflow-hidden rounded-[1.05rem] bg-[#121212]">
                                <div className="aspect-square overflow-hidden">
                                    <img src={item.imageSrc} alt={item.animalName} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                                </div>
                                <div className="px-2.5 py-2">
                                    <p className="truncate text-xs font-bold text-white">{item.animalName}</p>
                                    <p className="mt-0.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white/40">{item.kind === "endorsed" ? "Top endorsed" : "Rare capture"}</p>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
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
                        <h3 className="truncate font-display text-xl font-bold text-white">{collector.displayName}</h3>
                        {collector.username ? <p className="text-sm text-white/40">@{collector.username}</p> : null}
                    </div>
                    <span className="rounded-full bg-primary-400 px-3 py-1 text-sm font-black tabular-nums text-black">{collector.overallScore}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem] font-bold text-white/50">
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1">{collector.captureCount} captures</span>
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1">{collector.uniqueSpecies} species</span>
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
    featured,
    collectors,
    initialSegment = "discover"
}: {
    locale: string;
    timeline: DiscoverTimelineItem[];
    featured: DiscoverFeaturedItem[];
    collectors: DiscoverCollectorItem[];
    initialSegment?: DiscoverSegment;
}) {
    const router = useRouter();
    const [segment, setSegment] = useState<DiscoverSegment>(initialSegment);
    const [timelineItems, setTimelineItems] = useState(timeline);
    const [hasMoreTimeline, setHasMoreTimeline] = useState(timeline.length >= DISCOVER_PAGE_SIZE);
    const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
    const [visibleCollectorCount, setVisibleCollectorCount] = useState(COLLECTOR_BATCH_SIZE);
    const timelineSentinelRef = useRef<HTMLDivElement | null>(null);
    const collectorSentinelRef = useRef<HTMLDivElement | null>(null);
    const visibleCollectors = useMemo(() => collectors.slice(0, visibleCollectorCount), [collectors, visibleCollectorCount]);
    const hasMoreCollectors = visibleCollectorCount < collectors.length;

    function handleSegmentChange(next: DiscoverSegment) {
        setSegment(next);
        router.replace(next === "collectors" ? "/app?view=collectors" : "/app");
    }

    useEffect(() => {
        setTimelineItems(timeline);
        setHasMoreTimeline(timeline.length >= DISCOVER_PAGE_SIZE);
    }, [timeline]);

    useEffect(() => {
        setVisibleCollectorCount(COLLECTOR_BATCH_SIZE);
    }, [collectors]);

    const loadNextTimelinePage = useCallback(async () => {
        if (isLoadingTimeline || !hasMoreTimeline) return;
        setIsLoadingTimeline(true);
        try {
            const params = new URLSearchParams({
                offset: String(timelineItems.length),
                limit: String(DISCOVER_PAGE_SIZE)
            });
            const response = await fetch(`/api/app/discover?${params.toString()}`, {
                headers: {Accept: "application/json"}
            });
            if (!response.ok) {
                setHasMoreTimeline(false);
                return;
            }
            const payload = await response.json() as {timeline?: DiscoverTimelineItem[]; hasMore?: boolean};
            const nextItems = payload.timeline ?? [];
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
            setHasMoreTimeline(Boolean(payload.hasMore) && nextItems.length > 0);
        } finally {
            setIsLoadingTimeline(false);
        }
    }, [hasMoreTimeline, isLoadingTimeline, timelineItems.length]);

    useEffect(() => {
        if (segment !== "discover" || !hasMoreTimeline) return undefined;
        const node = timelineSentinelRef.current;
        if (!node) return undefined;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                void loadNextTimelinePage();
            }
        }, {rootMargin: "500px 0px"});
        observer.observe(node);
        return () => observer.disconnect();
    }, [segment, hasMoreTimeline, loadNextTimelinePage]);

    useEffect(() => {
        if (segment !== "collectors" || !hasMoreCollectors) return undefined;
        const node = collectorSentinelRef.current;
        if (!node) return undefined;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setVisibleCollectorCount((current) => Math.min(current + COLLECTOR_BATCH_SIZE, collectors.length));
            }
        }, {rootMargin: "500px 0px"});
        observer.observe(node);
        return () => observer.disconnect();
    }, [segment, hasMoreCollectors, collectors.length]);

    return (
        <AppPage>
            <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="space-y-4">
                    <img src={WORDMARK_SRC} alt="AnimalDex" className="h-7 w-auto max-w-[11.5rem] object-contain object-left" />
                    <AppSegmentedControl
                        value={segment}
                        options={[
                            {id: "discover", label: "Discover"},
                            {id: "collectors", label: "Collectors"}
                        ]}
                        onChange={handleSegmentChange}
                    />
                </div>
                <AppPrimaryLink href="/app/capture" icon="camera">Scan an animal</AppPrimaryLink>
            </header>

            {segment === "discover" ? (
                <div className="mx-auto max-w-2xl space-y-6">
                    <FeaturedStrip items={featured} />
                    {timelineItems.length ? (
                        <section className="space-y-4">
                            {timelineItems.map((item) => <DiscoverTimelineCard key={item.id} item={item} locale={locale} />)}
                            {hasMoreTimeline ? (
                                <div ref={timelineSentinelRef} aria-hidden="true" className="h-8" />
                            ) : null}
                        </section>
                    ) : (
                        <AppEmpty
                            icon="home"
                            title="Timeline is quiet"
                            detail="Check back soon, or make one of your animals public and comparison-ready."
                            action={<AppPrimaryLink href="/app/capture" icon="camera">Scan an animal</AppPrimaryLink>}
                        />
                    )}
                </div>
            ) : collectors.length ? (
                <section className="mx-auto max-w-3xl space-y-3">
                    {visibleCollectors.map((collector) => <CollectorCard key={collector.userId} collector={collector} />)}
                    {hasMoreCollectors ? (
                        <div ref={collectorSentinelRef} aria-hidden="true" className="h-px" />
                    ) : null}
                </section>
            ) : (
                <AppEmpty icon="collection" title="No collectors yet" detail="Public collector profiles will appear here as the community grows." />
            )}
        </AppPage>
    );
}
