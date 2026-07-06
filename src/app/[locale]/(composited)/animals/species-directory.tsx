"use client";

import {useEffect, useState} from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AnimalDexNumberBadge from "@/app/[locale]/(composited)/animals/animaldex-number-badge";
import SpeciesImage from "@/app/[locale]/(composited)/animals/species-image";
import {getSpeciesImageAltText} from "@/data/species-images";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {getSpeciesRarityStatusKey, SpeciesEntry, SpeciesRarityStatusKey} from "@/data/species";
import SpeciesRegionMap from "./species-region-map";
import {getNativeRangeRegionLabel, NativeRangeRegionKey, resolveNativeRangePresentation} from "@/data/native-range";

type SpeciesDirectoryCopy = {
    readSpecies: string;
    filtersButton: string;
    closeFiltersButton: string;
    locationLabel: string;
    locationDescription: string;
    allRegions: string;
    mapAriaLabel: string;
    mapActiveLabel: string;
    openLocationFilter: string;
    closeLocationFilter: string;
    statusLabel: string;
    alphabetLabel: string;
    filterAll: string;
    resultsSummary: string;
    noResultsTitle: string;
    noResultsDescription: string;
    clearFilters: string;
    previousPage: string;
    nextPage: string;
    pageLabel: string;
    rarityStatuses: Record<SpeciesRarityStatusKey, string>;
};

type SpeciesDirectoryProps = {
    locale: string;
    speciesEntries: SpeciesEntry[];
    currentPage: number;
    totalPages: number;
    currentQuery: string;
    currentLetter: string;
    currentRegion: NativeRangeRegionKey | "all";
    currentLocation: string | "all";
    currentStatus: SpeciesRarityStatusKey | "all";
    copy: SpeciesDirectoryCopy;
};

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const rarityOrder: SpeciesRarityStatusKey[] = ["relatively-common", "uncommon", "rare", "very-rare"];
const SCROLL_RESTORE_KEY = "animaldex-animals-scroll-y";

function formatPageLabel(template: string, page: number, totalPages: number) {
    return template.replace("{page}", String(page)).replace("{totalPages}", String(totalPages));
}

function getLocationChipLabel(entry: SpeciesEntry) {
    const presentation = resolveNativeRangePresentation(entry);

    if (presentation.kind === "hidden") {
        return null;
    }

    if (presentation.kind === "textOnly") {
        return presentation.title;
    }

    const [firstRegion, ...restRegions] = presentation.descriptor.regions;

    if (!firstRegion) {
        return null;
    }

    return restRegions.length > 0
        ? `${getNativeRangeRegionLabel(firstRegion)} +${restRegions.length}`
        : getNativeRangeRegionLabel(firstRegion);
}

export default function SpeciesDirectory({
    locale,
    speciesEntries,
    currentPage,
    totalPages,
    currentQuery,
    currentLetter,
    currentRegion,
    currentLocation,
    currentStatus,
    copy
}: SpeciesDirectoryProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [locationFilterOpen, setLocationFilterOpen] = useState(currentRegion !== "all");
    const [filtersOpen, setFiltersOpen] = useState(
        currentLetter !== "all" || currentRegion !== "all" || currentLocation !== "all" || currentStatus !== "all"
    );

    useEffect(() => {
        if (currentRegion !== "all") {
            setLocationFilterOpen(true);
        }
    }, [currentRegion]);

    useEffect(() => {
        const savedScrollY = window.sessionStorage.getItem(SCROLL_RESTORE_KEY);

        if (!savedScrollY) {
            return;
        }

        window.sessionStorage.removeItem(SCROLL_RESTORE_KEY);
        window.scrollTo({top: Number(savedScrollY)});
    }, [searchParams]);

    function pushFilters({
        nextQuery = currentQuery,
        nextLetter = currentLetter,
        nextRegion = currentRegion,
        nextLocation = currentLocation,
        nextStatus = currentStatus,
        nextPage = 1
    }: {
        nextQuery?: string;
        nextLetter?: string;
        nextRegion?: NativeRangeRegionKey | "all";
        nextLocation?: string | "all";
        nextStatus?: SpeciesRarityStatusKey | "all";
        nextPage?: number;
    }) {
        const params = new URLSearchParams();

        if (nextQuery.trim()) {
            params.set("q", nextQuery.trim());
        }

        if (nextLetter !== "all") {
            params.set("letter", nextLetter);
        }

        if (nextRegion !== "all") {
            params.set("region", nextRegion);
        }

        if (nextLocation !== "all") {
            params.set("location", nextLocation);
        }

        if (nextStatus !== "all") {
            params.set("status", nextStatus);
        }

        if (nextPage > 1) {
            params.set("page", String(nextPage));
        }

        const queryString = params.toString();
        const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
        window.sessionStorage.setItem(SCROLL_RESTORE_KEY, String(window.scrollY));
        router.push(nextUrl);
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between gap-4 border-y border-line-300 py-4">
                <p className="text-sm md:text-base text-ink-300">
                    {copy.resultsSummary}
                </p>
                <div className="flex items-center gap-4">
                    {(currentQuery || currentLetter !== "all" || currentRegion !== "all" || currentLocation !== "all" || currentStatus !== "all") ? (
                        <button
                            type="button"
                            onClick={() => pushFilters({nextQuery: "", nextLetter: "all", nextRegion: "all", nextLocation: "all", nextStatus: "all", nextPage: 1})}
                            className="text-sm text-primary-200 hover:text-primary-100 transition-colors"
                        >
                            {copy.clearFilters}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => setFiltersOpen((open) => !open)}
                        aria-expanded={filtersOpen}
                        className="rounded-full border border-line-300 px-4 py-2 text-sm font-semibold text-white hover:border-primary-400 transition-colors"
                    >
                        {filtersOpen ? copy.closeFiltersButton : copy.filtersButton}
                    </button>
                </div>
            </div>

            {filtersOpen ? (
                <div className="rounded-3xl bg-surface-900/65 p-5 md:p-6 flex flex-col gap-6">
                    <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                                <p className="text-sm uppercase tracking-[0.16em] font-medium text-primary-200">{copy.locationLabel}</p>
                                <p className="text-sm text-ink-300">{copy.locationDescription}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLocationFilterOpen((open) => !open)}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-line-300 bg-surface-950 px-4 py-3 text-left transition-colors hover:border-primary-400"
                            >
                                <span className="text-white font-medium">
                                    {locationFilterOpen ? copy.closeLocationFilter : copy.openLocationFilter}
                                </span>
                                <span className="text-sm text-ink-300">
                                    {currentRegion === "all" ? copy.allRegions : getNativeRangeRegionLabel(currentRegion)}
                                </span>
                            </button>
                        </div>

                        <div className="flex flex-col gap-3">
                            <p className="text-sm uppercase tracking-[0.16em] font-medium text-primary-200">{copy.statusLabel}</p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => pushFilters({nextStatus: "all", nextPage: 1})}
                                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                        currentStatus === "all"
                                            ? "border-primary-400 bg-primary-500/20 text-white"
                                            : "border-line-300 text-ink-300 hover:border-primary-400 hover:text-white"
                                    }`}
                                >
                                    {copy.filterAll}
                                </button>
                                {rarityOrder.map((statusKey) => (
                                    <button
                                        key={statusKey}
                                        type="button"
                                        onClick={() => pushFilters({nextStatus: statusKey, nextPage: 1})}
                                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                            currentStatus === statusKey
                                                ? "border-primary-400 bg-primary-500/20 text-white"
                                                : "border-line-300 text-ink-300 hover:border-primary-400 hover:text-white"
                                        }`}
                                    >
                                        {copy.rarityStatuses[statusKey]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {locationFilterOpen ? (
                        <SpeciesRegionMap
                            currentRegion={currentRegion}
                            onSelectRegion={(region) => pushFilters({nextRegion: region, nextPage: 1})}
                            allLabel={copy.allRegions}
                            mapAriaLabel={copy.mapAriaLabel}
                            mapActiveLabel={copy.mapActiveLabel}
                        />
                    ) : null}

                    <div className="flex flex-col gap-3">
                        <p className="text-sm uppercase tracking-[0.16em] font-medium text-primary-200">{copy.alphabetLabel}</p>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            <button
                                type="button"
                                onClick={() => pushFilters({nextLetter: "all", nextPage: 1})}
                                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                    currentLetter === "all"
                                        ? "border-primary-400 bg-primary-500/20 text-white"
                                        : "border-line-300 text-ink-300 hover:border-primary-400 hover:text-white"
                                }`}
                            >
                                {copy.filterAll}
                            </button>
                            {alphabet.map((letter) => (
                                <button
                                    key={letter}
                                    type="button"
                                    onClick={() => pushFilters({nextLetter: letter, nextPage: 1})}
                                    className={`h-9 min-w-9 shrink-0 rounded-full border px-3 text-sm transition-colors ${
                                        currentLetter === letter
                                            ? "border-primary-400 bg-primary-500/20 text-white"
                                            : "border-line-300 text-ink-300 hover:border-primary-400 hover:text-white"
                                    }`}
                                >
                                    {letter}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}

            {speciesEntries.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6">
                    {speciesEntries.map((entry) => {
                        const animalDexNumber = getAnimalDexNumberFromEntry(entry);

                        return (
                        <article key={entry.slug} className="group overflow-hidden rounded-3xl bg-surface-900/70 flex flex-col">
                            <div className="relative">
                                <SpeciesImage
                                    slug={entry.slug}
                                    alt={getSpeciesImageAltText(entry, "thumbnail")}
                                    className="aspect-[16/10] transition-transform duration-500 group-hover:scale-[1.02]"
                                    sizes="(min-width: 1280px) 28vw, (min-width: 768px) 44vw, 100vw"
                                />
                                {animalDexNumber ? (
                                    <div className="absolute right-3 top-3">
                                        <AnimalDexNumberBadge number={animalDexNumber} compact />
                                    </div>
                                ) : null}
                            </div>
                            <div className="p-5 flex flex-col gap-3 flex-1">
                                <div className="flex flex-wrap gap-2">
                                    <span className="rounded-full bg-primary-500/10 px-2.5 py-1 text-primary-200 text-xs font-semibold">
                                        {entry.analysis.category}
                                    </span>
                                    {getLocationChipLabel(entry) ? (
                                        <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-ink-200 text-xs font-semibold">
                                            {getLocationChipLabel(entry)}
                                        </span>
                                    ) : null}
                                    <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-ink-200 text-xs font-semibold">
                                        {copy.rarityStatuses[getSpeciesRarityStatusKey(entry.analysis.rarityScore)]}
                                    </span>
                                </div>
                                <div>
                                    <h2 className="font-display font-bold text-2xl text-white">{entry.name}</h2>
                                    <p className="text-sm italic text-ink-400">{entry.analysis.scientificName}</p>
                                </div>
                                <p className="text-ink-300 leading-6 max-h-12 overflow-hidden">{entry.analysis.summary}</p>
                                <Link
                                    href={`/animals/${entry.slug}`}
                                    className="mt-auto pt-1 text-primary-200 font-semibold hover:text-primary-100 transition-colors"
                                >
                                    {copy.readSpecies} →
                                </Link>
                            </div>
                        </article>
                        );
                    })}
                </div>
            ) : (
                <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-8 md:p-10 text-center flex flex-col gap-3">
                    <h2 className="font-display font-bold text-3xl text-white">{copy.noResultsTitle}</h2>
                    <p className="text-ink-200 text-lg">{copy.noResultsDescription}</p>
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={() => {
                                pushFilters({nextQuery: "", nextLetter: "all", nextRegion: "all", nextLocation: "all", nextStatus: "all", nextPage: 1});
                            }}
                            className="text-primary-200 text-lg hover:text-primary-100 transition-colors"
                        >
                            {copy.clearFilters}
                        </button>
                    </div>
                </div>
            )}

            {totalPages > 1 ? (
                <div className="flex items-center justify-between gap-4 flex-wrap rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-5 py-4 md:px-6">
                    <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => pushFilters({nextPage: currentPage - 1})}
                        className="rounded-full border border-line-300 px-4 py-2 text-sm text-ink-200 transition-colors hover:border-primary-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {copy.previousPage}
                    </button>
                    <p className="text-sm text-ink-300">
                        {formatPageLabel(copy.pageLabel, currentPage, totalPages)}
                    </p>
                    <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => pushFilters({nextPage: currentPage + 1})}
                        className="rounded-full border border-line-300 px-4 py-2 text-sm text-ink-200 transition-colors hover:border-primary-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {copy.nextPage}
                    </button>
                </div>
            ) : null}
        </div>
    );
}
