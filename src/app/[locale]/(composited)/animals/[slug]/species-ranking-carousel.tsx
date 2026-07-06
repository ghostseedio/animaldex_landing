"use client";

import Link from "@/app/[locale]/_components/link";
import type {SpeciesRankingItem} from "@/data/species-rankings";
import {getSpeciesImageRoute} from "@/lib/species-image-public";

type SpeciesRankingCarouselProps = {
    speciesSlug: string;
    speciesName: string;
    items: SpeciesRankingItem[];
    labels: {
        title: string;
        description: string;
        empty: string;
        rankLabel: string;
        scoreLabel: string;
        byPhotographer: string;
    };
};

export default function SpeciesRankingCarousel({
    speciesSlug,
    speciesName,
    items,
    labels
}: SpeciesRankingCarouselProps) {
    if (items.length === 0) {
        return (
            <section className="rounded-[1.75rem] border border-white/10 bg-surface-900/55 px-5 py-8 md:px-8">
                <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{labels.title}</h2>
                <p className="mt-3 text-lg text-ink-200">{labels.empty}</p>
            </section>
        );
    }

    return (
        <section className="flex flex-col gap-5">
            <div>
                <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{labels.title}</h2>
                <p className="mt-3 max-w-3xl text-lg leading-8 text-ink-200">
                    {labels.description.replace("{count}", String(items.length)).replace("{animal}", speciesName)}
                </p>
            </div>

            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
                {items.map((item) => (
                    <article
                        key={item.captureId}
                        className="w-[15.5rem] shrink-0 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(40,70,49,0.18),rgba(255,255,255,0.03))] shadow-lg shadow-black/20"
                    >
                        <div className="relative aspect-[4/5] overflow-hidden bg-black/30">
                            <img
                                src={getSpeciesImageRoute(speciesSlug, item.captureId)}
                                alt={`${item.animalName} capture by ${item.username ?? "collector"}`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                            />
                            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent p-3">
                                <span className="rounded-full bg-amber-200/15 px-2.5 py-1 text-xs font-bold text-amber-100">
                                    {labels.rankLabel.replace("{rank}", String(item.rank))}
                                </span>
                                {item.battleTier ? (
                                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white">
                                        {item.battleTier}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <div className="space-y-2 p-4">
                            <p className="text-sm font-semibold text-white">
                                {item.displayName ?? item.username ?? labels.byPhotographer}
                            </p>
                            {item.username ? (
                                <Link href={`/u/${encodeURIComponent(item.username)}`} className="block w-fit text-xs font-semibold text-primary-200 hover:text-primary-100">
                                    @{item.username}
                                </Link>
                            ) : null}
                            {item.contextLabel || item.locationDisplayLabel ? (
                                <p className="text-xs leading-5 text-ink-300">
                                    {[item.contextLabel, item.locationDisplayLabel].filter(Boolean).join(" · ")}
                                </p>
                            ) : null}
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-100">
                                {labels.scoreLabel.replace("{score}", String(item.score))}
                            </p>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
