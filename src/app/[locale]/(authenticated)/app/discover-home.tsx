"use client";

import Link from "@/app/[locale]/_components/link";
import {AppEmpty, AppPage, AppPrimaryLink, AppSegmentedControl} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {DiscoverTimelineCard} from "@/app/[locale]/(authenticated)/app/discover-timeline-cards";
import type {DiscoverCollectorItem} from "@/data/discover-collectors";
import type {DiscoverFeaturedItem, DiscoverTimelineItem} from "@/data/discover-timeline";
import {useState} from "react";
import {useRouter} from "next/navigation";

type DiscoverSegment = "discover" | "collectors";

const WORDMARK_SRC = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/animaldex-text.webp";

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

    function handleSegmentChange(next: DiscoverSegment) {
        setSegment(next);
        router.replace(next === "collectors" ? "/app?view=collectors" : "/app");
    }

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
                    {timeline.length ? (
                        <section className="space-y-4">
                            {timeline.map((item) => <DiscoverTimelineCard key={item.id} item={item} locale={locale} />)}
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
                    {collectors.map((collector) => <CollectorCard key={collector.userId} collector={collector} />)}
                </section>
            ) : (
                <AppEmpty icon="collection" title="No collectors yet" detail="Public collector profiles will appear here as the community grows." />
            )}
        </AppPage>
    );
}
