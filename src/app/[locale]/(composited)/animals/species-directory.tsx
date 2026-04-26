"use client";

import {FormEvent, useEffect, useState} from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import SpeciesImage from "@/app/[locale]/(composited)/animals/species-image";
import {getSpeciesImageAltText} from "@/data/species-images";
import {getSpeciesRarityStatusKey, SpeciesEntry, SpeciesRarityStatusKey} from "@/data/species";
import SpeciesRegionMap from "./species-region-map";
import {getNativeRangeRegionLabel, NativeRangeRegionKey, resolveNativeRangePresentation} from "@/data/native-range";

type SpeciesDirectoryCopy = {
    readSpecies: string;
    searchPlaceholder: string;
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
    totalSpecies: number;
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
const SCROLL_RESTORE_KEY = "animaldex-animals-scroll-y";

function formatResultsSummary(template: string, count: number, total: number) {
    return template.replace("{count}", String(count)).replace("{total}", String(total));
}

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
    totalSpecies,
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
    const [query, setQuery] = useState(currentQuery);
    const [locationFilterOpen, setLocationFilterOpen] = useState(currentRegion !== "all");

    useEffect(() => {
        setQuery(currentQuery);
    }, [currentQuery]);

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

    function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        pushFilters({nextQuery: query, nextPage: 1});
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 md:p-6 flex flex-col gap-5">
                <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3">
                    <label htmlFor="species-search" className="text-sm uppercase tracking-[0.16em] font-medium text-primary-200">
                        {copy.searchPlaceholder}
                    </label>
                    <input
                        id="species-search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={copy.searchPlaceholder}
                        className="w-full rounded-2xl border border-line-300 bg-surface-950 px-4 py-3 text-base text-white placeholder:text-ink-400 outline-none transition-colors focus:border-primary-400"
                    />
                </form>

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
                    {locationFilterOpen ? (
                        <SpeciesRegionMap
                            currentRegion={currentRegion}
                            onSelectRegion={(region) => pushFilters({nextRegion: region, nextPage: 1})}
                            allLabel={copy.allRegions}
                            mapAriaLabel={copy.mapAriaLabel}
                            mapActiveLabel={copy.mapActiveLabel}
                        />
                    ) : null}
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
                        {Object.entries(copy.rarityStatuses).map(([statusKey, label]) => (
                            <button
                                key={statusKey}
                                type="button"
                                onClick={() => pushFilters({nextStatus: statusKey as SpeciesRarityStatusKey, nextPage: 1})}
                                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                    currentStatus === statusKey
                                        ? "border-primary-400 bg-primary-500/20 text-white"
                                        : "border-line-300 text-ink-300 hover:border-primary-400 hover:text-white"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <p className="text-sm uppercase tracking-[0.16em] font-medium text-primary-200">{copy.alphabetLabel}</p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => pushFilters({nextLetter: "all", nextPage: 1})}
                            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
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
                                className={`h-9 min-w-9 rounded-full border px-3 text-sm transition-colors ${
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

                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm md:text-base text-ink-300">
                        {formatResultsSummary(copy.resultsSummary, speciesEntries.length, totalSpecies)}
                    </p>
                    {(currentQuery || currentLetter !== "all" || currentRegion !== "all" || currentLocation !== "all" || currentStatus !== "all") ? (
                        <button
                            type="button"
                            onClick={() => {
                                setQuery("");
                                pushFilters({nextQuery: "", nextLetter: "all", nextRegion: "all", nextLocation: "all", nextStatus: "all", nextPage: 1});
                            }}
                            className="text-sm text-primary-200 hover:text-primary-100 transition-colors"
                        >
                            {copy.clearFilters}
                        </button>
                    ) : null}
                </div>
            </div>

            {speciesEntries.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {speciesEntries.map((entry) => (
                        <article key={entry.slug} className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-6 md:p-8 flex flex-col gap-4">
                            <SpeciesImage
                                slug={entry.slug}
                                alt={getSpeciesImageAltText(entry, "thumbnail")}
                                className="aspect-[4/3] rounded-3xl border border-line-300"
                                sizes="(min-width: 1024px) 40vw, 100vw"
                            />
                            <div className="flex flex-wrap gap-2">
                                {getLocationChipLabel(entry) ? (
                                    <span className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs uppercase tracking-[0.18em] font-semibold">
                                        {getLocationChipLabel(entry)}
                                    </span>
                                ) : null}
                                <span className="rounded-full border border-white/12 px-3 py-1 text-ink-100 text-xs uppercase tracking-[0.18em] font-semibold bg-white/[0.03]">
                                    {copy.rarityStatuses[getSpeciesRarityStatusKey(entry.analysis.rarityScore)]}
                                </span>
                            </div>
                            <h2 className="font-display font-bold text-3xl text-white">{entry.name}</h2>
                            <Link
                                href={`/animals/${entry.slug}`}
                                className="mt-auto text-primary-200 text-lg hover:text-primary-100 transition-colors"
                                underline
                            >
                                {copy.readSpecies}
                            </Link>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-8 md:p-10 text-center flex flex-col gap-3">
                    <h2 className="font-display font-bold text-3xl text-white">{copy.noResultsTitle}</h2>
                    <p className="text-ink-200 text-lg">{copy.noResultsDescription}</p>
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={() => {
                                setQuery("");
                                pushFilters({nextQuery: "", nextLetter: "all", nextRegion: "all", nextLocation: "all", nextPage: 1});
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
