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
    currentCaptureId?: string | null;
    currentCaptureGrade?: number | null;
    layout?: "compact" | "wide";
};

function getGradeTint(grade: number) {
    if (grade >= 9) return "rgb(249 115 22)";
    if (grade >= 7) return "rgb(34 211 238)";
    if (grade >= 5) return "rgb(56 250 71)";
    if (grade >= 3) return "rgb(255 255 255)";
    return "rgb(248 113 113)";
}

function GradeBadge({grade}: {grade: number}) {
    const tint = getGradeTint(grade);

    return (
        <span
            className="inline-flex h-[31px] w-fit shrink-0 items-center gap-1.5 rounded-full bg-black/35 px-2.5"
            style={{
                border: `1px solid color-mix(in srgb, ${tint} 38%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${tint} 18%, rgb(0 0 0 / 0.36))`
            }}
            aria-label={`Grade ${grade}`}
        >
            <span
                className="text-[9px] font-black leading-none"
                style={{color: `color-mix(in srgb, ${tint} 72%, transparent)`}}
            >
                GRADE
            </span>
            <span className="font-display text-[13px] font-black leading-none text-white">
                {grade}
            </span>
        </span>
    );
}

export default function SpeciesRankingCarousel({
    speciesSlug,
    items,
    currentCaptureId = null,
    currentCaptureGrade = null,
    layout = "compact"
}: SpeciesRankingCarouselProps) {
    const wide = layout === "wide";
    const currentItem = currentCaptureId
        ? items.find((item) => item.captureId === currentCaptureId)
        : null;
    const summary = currentItem
        ? `You’re #${currentItem.rank} of ${items.length}`
        : items.length > 0
            ? `${items.length} ranked ${items.length === 1 ? "capture" : "captures"} in this group.`
            : "No captures yet";

    return (
        <section className={`-mx-5 border-y border-white/10 bg-[#121212]/95 py-[18px] ${
            wide ? "lg:mx-0 lg:rounded-[22px] lg:border lg:px-1 lg:py-6" : ""
        }`}>
            <h2 className={`px-5 text-[17px] font-semibold leading-[1.25] text-white ${wide ? "lg:px-6 lg:text-xl" : ""}`}>
                {summary}
            </h2>

            {items.length > 0 ? (
                <div className={`mt-3.5 flex gap-3 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                    wide ? "lg:mt-5 lg:gap-4 lg:px-6" : ""
                }`}>
                    {items.map((item) => {
                        const isCurrentCapture = item.captureId === currentCaptureId;
                        const captureGrade = isCurrentCapture && currentCaptureGrade != null
                            ? currentCaptureGrade
                            : item.captureGrade;
                        const handle = item.username?.trim() || "collector";

                        return (
                            <article
                                key={item.captureId}
                                className={`w-[136px] shrink-0 overflow-hidden rounded-2xl border bg-[#171a18] shadow-[0_8px_22px_rgba(0,0,0,0.28)] ${
                                    wide ? "lg:w-[164px]" : ""
                                } ${
                                    isCurrentCapture
                                        ? "border-[#A7F432]/80 ring-1 ring-[#A7F432]/80"
                                        : "border-white/10"
                                }`}
                            >
                                <div className={`relative h-[148px] w-[136px] overflow-hidden bg-black/30 ${wide ? "lg:h-[178px] lg:w-[164px]" : ""}`}>
                                    <img
                                        src={`${getSpeciesImageRoute(speciesSlug, item.captureId)}&thumbnail=1`}
                                        alt={`${item.animalName} capture by ${handle}`}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                    />
                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/65" />
                                    <span
                                        className={`absolute left-2 top-2 rounded-full px-2 py-[5px] text-[10px] font-bold leading-none text-black/90 ${
                                            isCurrentCapture ? "bg-[#A7F432]" : "bg-[#d5ddd6]"
                                        }`}
                                    >
                                        #{item.rank}
                                    </span>
                                </div>

                                <div className="min-h-[66px] space-y-1.5 border-t border-white/[0.08] bg-[linear-gradient(145deg,#202421,#151716)] px-2 py-[9px]">
                                    {item.username ? (
                                        <Link
                                            href={`/u/${encodeURIComponent(item.username)}`}
                                            className="block truncate text-[11px] font-medium leading-[13px] text-white hover:text-[#A7F432]"
                                        >
                                            @{handle}
                                        </Link>
                                    ) : (
                                        <p className="truncate text-[11px] font-medium leading-[13px] text-white">
                                            @{handle}
                                        </p>
                                    )}
                                    {captureGrade != null ? <GradeBadge grade={captureGrade} /> : null}
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div className="h-24" aria-hidden="true" />
            )}
        </section>
    );
}
