"use client";

import {useState} from "react";
import type {SpeciesComparisonSummary} from "@/data/species-comparisons";
import SpeciesComparisonSheet from "@/app/[locale]/(authenticated)/app/matchups/_components/species-comparison-sheet";

function fightTitle(summary: SpeciesComparisonSummary) {
    return `${summary.animalADisplayName} vs ${summary.animalBDisplayName}`;
}

export default function PopularBreakdownsRail({
    items
}: {
    items: SpeciesComparisonSummary[];
}) {
    const [openSlug, setOpenSlug] = useState<string | null>(null);
    const openItem = items.find((item) => item.slug === openSlug) ?? null;

    if (!items.length) return null;

    return (
        <>
            <section className="space-y-2.5">
                <h2 className="text-[0.72rem] font-black uppercase tracking-[0.12em] text-white/75">
                    Popular breakdowns
                </h2>
                <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {items.slice(0, 8).map((summary) => {
                        const title = fightTitle(summary);
                        return (
                            <button
                                key={summary.id}
                                type="button"
                                onClick={() => setOpenSlug(summary.slug)}
                                className="group relative h-[196px] w-[148px] shrink-0 overflow-hidden rounded-[18px] border border-white/10 bg-[#171a17] text-left transition hover:border-primary-400/40"
                                aria-label={title}
                            >
                                {summary.featuredImageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={summary.featuredImageUrl}
                                        alt=""
                                        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[#1b221c] text-primary-300/80">
                                        <span className="text-2xl" aria-hidden="true">⚡</span>
                                        <span className="text-[0.68rem] font-black tracking-[0.16em] text-white/35">VS</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                                <p className="absolute inset-x-0 bottom-0 p-2.5 text-[0.82rem] font-black leading-snug text-white line-clamp-2">
                                    {title}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </section>

            {openItem ? (
                <SpeciesComparisonSheet
                    slug={openItem.slug}
                    animalASlug={openItem.animalASlug}
                    animalBSlug={openItem.animalBSlug}
                    animalAFallbackName={openItem.animalADisplayName}
                    animalBFallbackName={openItem.animalBDisplayName}
                    onClose={() => setOpenSlug(null)}
                />
            ) : null}
        </>
    );
}
