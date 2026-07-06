"use client";

import {useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import ContentImageFigure from "@/app/[locale]/(composited)/_components/content-image-figure";
import {
    beastMatchesHubFilter,
    LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH,
    legendaryEarthBeastHubFilters,
    type LegendaryEarthBeast,
    type LegendaryEarthBeastHubFilterId
} from "@/data/legendary-earth-beasts";

type LegendaryEarthBeastsHubGridProps = {
    beasts: LegendaryEarthBeast[];
};

function FilterChip({
    label,
    selected,
    onClick
}: {
    label: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={selected
                ? "rounded-full border border-primary-400/50 bg-primary-500/15 px-4 py-2 text-sm font-medium text-primary-100 transition-colors"
                : "rounded-full border border-line-300 bg-surface-800/70 px-4 py-2 text-sm text-ink-200 hover:border-primary-500/30 hover:text-white transition-colors"}
        >
            {label}
        </button>
    );
}

export default function LegendaryEarthBeastsHubGrid({beasts}: LegendaryEarthBeastsHubGridProps) {
    const [activeFilter, setActiveFilter] = useState<LegendaryEarthBeastHubFilterId>("all");

    const filteredBeasts = useMemo(
        () => beasts.filter((beast) => beastMatchesHubFilter(beast, activeFilter)),
        [activeFilter, beasts]
    );

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap gap-2">
                {legendaryEarthBeastHubFilters.map((filter) => (
                    <FilterChip
                        key={filter.id}
                        label={filter.label}
                        selected={activeFilter === filter.id}
                        onClick={() => setActiveFilter(filter.id)}
                    />
                ))}
            </div>

            <p className="text-ink-300 text-sm md:text-base">
                Showing {filteredBeasts.length} of {beasts.length} Legendary Earth Beasts
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredBeasts.map((beast) => (
                    <Link
                        key={beast.slug}
                        href={`${LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH}/${beast.slug}`}
                        className="group overflow-hidden rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur hover:border-primary-500/50 transition-colors"
                    >
                        <div className="border-b border-line-300/80">
                            <ContentImageFigure
                                image={beast.featuredImage}
                                sizes="(min-width: 1280px) 28vw, (min-width: 768px) 45vw, 100vw"
                            />
                        </div>
                        <div className="p-5 md:p-6 flex flex-col gap-3">
                            <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-primary-500/25 bg-primary-500/5 px-3 py-1 text-primary-200 text-xs">
                                    {beast.legendaryType}
                                </span>
                                <span className="rounded-full border border-line-300 px-3 py-1 text-ink-300 text-xs">
                                    Tier {beast.tier}
                                </span>
                                {beast.respectfulCaptureNote ? (
                                    <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-200 text-xs">
                                        Respectful capture
                                    </span>
                                ) : null}
                            </div>
                            <h3 className="font-display font-bold text-3xl text-white group-hover:text-primary-100 transition-colors">
                                {beast.legendaryFormName}
                            </h3>
                            <p className="text-ink-300 text-sm uppercase tracking-[0.16em]">
                                {beast.displayName} · {beast.scientificName}
                            </p>
                            <p className="text-ink-200 text-base leading-7">
                                {beast.captureSite.split(",")[0]}
                            </p>
                            <p className="text-ink-300 text-sm md:text-base leading-7">
                                Power: <span className="text-white">{beast.power}</span>
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
