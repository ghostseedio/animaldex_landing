"use client";

import {useEffect, useState} from "react";
import Image from "next/image";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AnimalDexNumberBadge from "@/app/[locale]/(composited)/animals/animaldex-number-badge";
import {getSpeciesArtworkUrl} from "@/data/species-artwork";
import {getLegendaryEarthBeast} from "@/data/legendary-earth-beasts";
import {getSpeciesImageAltText, type SpeciesDirectoryImageState} from "@/lib/species-image-public";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {speciesDirectorySearchMatch} from "@/lib/species-life-stage-policy";
import {getSpeciesRarityStatusKey, SpeciesEntry, SpeciesRarityStatusKey} from "@/data/species";
import {getBattleTier, type AnimalBattleTier, type SpeciesStats} from "@/lib/battle-tier";
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
    battleTierChip: string;
    rarityStatuses: Record<SpeciesRarityStatusKey, string>;
};

type SpeciesDirectoryProps = {
    locale: string;
    speciesEntries: SpeciesEntry[];
    directoryImageState: Record<string, SpeciesDirectoryImageState>;
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
const STAT_KEYS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;

function getBattleTierFromEntry(entry: SpeciesEntry): AnimalBattleTier | null {
    if (getLegendaryEarthBeast(entry.slug)) {
        return "S";
    }

    const rawStats = entry.databaseSource?.canonicalGameStats;

    if (!rawStats) {
        return null;
    }

    const stats = {} as SpeciesStats;

    for (const key of STAT_KEYS) {
        const value = Number(rawStats[key]);

        if (!Number.isFinite(value)) {
            return null;
        }

        stats[key] = value;
    }

    return getBattleTier(stats);
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

function CatalogPawPlaceholder({muted = false}: {muted?: boolean}) {
    return (
        <div
            className={[
                "flex h-full w-full items-center justify-center",
                muted ? "text-white/20" : "text-primary-200/70"
            ].join(" ")}
            aria-hidden="true"
        >
            <svg viewBox="0 0 24 24" className="h-8 w-8 sm:h-9 sm:w-9" fill="currentColor">
                <ellipse cx="12" cy="17.5" rx="5.2" ry="4.4" />
                <circle cx="7.1" cy="10.2" r="2.35" />
                <circle cx="10.4" cy="7.6" r="2.35" />
                <circle cx="13.6" cy="7.6" r="2.35" />
                <circle cx="16.9" cy="10.2" r="2.35" />
            </svg>
        </div>
    );
}

function CatalogUncapturedSilhouette({
    src,
    alt,
    onError
}: {
    src: string;
    alt: string;
    onError: () => void;
}) {
    return (
        <img
            src={src}
            alt={alt}
            className="absolute inset-0 h-full w-full object-contain brightness-0 invert"
            onError={onError}
        />
    );
}

function CatalogGlyphThumbnail({
    entry,
    animalDexNumber,
    imageState
}: {
    entry: SpeciesEntry;
    animalDexNumber: number | null;
    imageState: SpeciesDirectoryImageState;
}) {
    const gradientId = `catalog-glyph-fill-${entry.slug}`;
    const depthGradientId = `catalog-glyph-depth-${entry.slug}`;
    const imageAlt = getSpeciesImageAltText(entry, "thumbnail");
    const hasPublicCapture = imageState.hasPublicCapture;
    const [showPlaceholder, setShowPlaceholder] = useState(false);
    const iconSrc = getSpeciesArtworkUrl(entry.slug);
    const isLegendary = Boolean(getLegendaryEarthBeast(entry.slug));

    return (
        <div className="relative h-20 w-20 shrink-0 overflow-visible sm:h-24 sm:w-24">
            <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
                <svg
                    viewBox="0 0 100 100"
                    focusable="false"
                    className="h-full w-full overflow-visible"
                >
                <defs>
                    <linearGradient id={gradientId} x1="12" y1="10" x2="88" y2="90" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#83ffae" stopOpacity="0.30" />
                        <stop offset="58%" stopColor="#83ffae" stopOpacity="0.14" />
                        <stop offset="100%" stopColor="#83ffae" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id={depthGradientId} x1="50" y1="0" x2="50" y2="100" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#83ffae" stopOpacity="0.27" />
                        <stop offset="54%" stopColor="#9b7cff" stopOpacity="0.16" />
                        <stop offset="100%" stopColor="#9b7cff" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path
                    d="M50 2C69 0 78 8 83 18C96 28 99 39 96 49C92 67 87 79 80 84C68 96 55 101 43 98C29 95 16 90 10 79C3 67 -1 55 2 44C5 25 10 16 20 12C28 4 40 0 50 2Z"
                    fill={`url(#${gradientId})`}
                    className="blur-[0.4px]"
                />
                <path
                    d="M50 2C69 0 78 8 83 18C96 28 99 39 96 49C92 67 87 79 80 84C68 96 55 101 43 98C29 95 16 90 10 79C3 67 -1 55 2 44C5 25 10 16 20 12C28 4 40 0 50 2Z"
                    fill="none"
                    stroke="#83ffae"
                    strokeOpacity="0.26"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    transform="translate(4 3) scale(.92)"
                    className="blur-[0.6px] transition-opacity duration-300 group-hover:opacity-100"
                />
                <path
                    d="M50 2C69 0 78 8 83 18C96 28 99 39 96 49C92 67 87 79 80 84C68 96 55 101 43 98C29 95 16 90 10 79C3 67 -1 55 2 44C5 25 10 16 20 12C28 4 40 0 50 2Z"
                    fill={`url(#${depthGradientId})`}
                    transform="translate(-4 -2) scale(.84)"
                    className="origin-center transition-transform duration-300 group-hover:scale-90"
                />
                <path
                    d="M50 2C69 0 78 8 83 18C96 28 99 39 96 49C92 67 87 79 80 84C68 96 55 101 43 98C29 95 16 90 10 79C3 67 -1 55 2 44C5 25 10 16 20 12C28 4 40 0 50 2Z"
                    fill="none"
                    stroke="#ffffff"
                    strokeOpacity="0.12"
                    strokeWidth="0.8"
                    transform="translate(-1 -1) scale(1.01)"
                />
            </svg>
            </div>

            <div className="absolute inset-0 z-[1] flex items-center justify-center">
                <div className="relative h-14 w-14 transition-transform duration-300 group-hover:scale-[1.04] sm:h-[4.35rem] sm:w-[4.35rem]">
                    {showPlaceholder ? (
                        <CatalogPawPlaceholder muted={!hasPublicCapture} />
                    ) : hasPublicCapture ? (
                        <Image
                            src={iconSrc}
                            fill
                            unoptimized
                            sizes="72px"
                            className="object-contain"
                            onError={() => setShowPlaceholder(true)}
                            alt={imageAlt}
                        />
                    ) : (
                        <CatalogUncapturedSilhouette
                            src={iconSrc}
                            alt={imageAlt}
                            onError={() => setShowPlaceholder(true)}
                        />
                    )}
                </div>
            </div>
            <div className="absolute right-1 top-1 z-[2] flex flex-col items-end gap-1">
                {isLegendary ? (
                    <span className="rounded-full border border-amber-400/35 bg-amber-400/90 px-1.5 py-0.5 text-[0.5rem] font-black uppercase tracking-[0.08em] text-black">
                        S
                    </span>
                ) : null}
                <AnimalDexNumberBadge number={animalDexNumber} compact showNewWhenMissing />
            </div>
        </div>
    );
}

export default function SpeciesDirectory({
    locale,
    speciesEntries,
    directoryImageState,
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
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {speciesEntries.map((entry) => {
                        const animalDexNumber = getAnimalDexNumberFromEntry(entry);
                        const locationChipLabel = getLocationChipLabel(entry);
                        const rarityLabel = copy.rarityStatuses[getSpeciesRarityStatusKey(entry.analysis.rarityScore)];
                        const battleTier = getBattleTierFromEntry(entry);
                        const battleTierLabel = battleTier
                            ? copy.battleTierChip.replace("{tier}", battleTier)
                            : null;
                        const searchMatch = currentQuery.trim()
                            ? speciesDirectorySearchMatch(entry, currentQuery)
                            : null;

                        return (
                        <Link
                            key={entry.slug}
                            href={`/animals/${entry.slug}`}
                            className="group flex min-h-[7rem] items-center gap-3 rounded-[1.375rem] border border-line-300/80 bg-surface-900/70 p-3 shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-0.5 hover:border-primary-400/45 hover:bg-surface-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200 sm:min-h-[8rem] sm:gap-4 sm:p-4"
                            aria-label={`${copy.readSpecies}: ${entry.name}`}
                        >
                            <CatalogGlyphThumbnail
                                entry={entry}
                                animalDexNumber={animalDexNumber}
                                imageState={directoryImageState[entry.slug] ?? {hasPublicCapture: false, captureId: null}}
                            />
                            <article className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        {battleTierLabel ? (
                                            <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.16em] text-ink-200">{battleTierLabel}</p>
                                        ) : null}
                                        <h2 className="mt-1 truncate font-display text-xl font-bold text-white transition-colors group-hover:text-primary-100 sm:text-2xl">{entry.name}</h2>
                                        {searchMatch?.aliasMatchLabel ? (
                                            <p className="truncate text-xs text-ink-300">{searchMatch.aliasMatchLabel}</p>
                                        ) : null}
                                        {searchMatch?.helperText ? (
                                            <p className="truncate text-xs text-primary-200/80">{searchMatch.helperText}</p>
                                        ) : null}
                                        <p className="truncate text-sm italic text-ink-400">{entry.analysis.scientificName}</p>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="max-w-full truncate rounded-full bg-primary-500/10 px-2.5 py-1 text-xs font-semibold text-primary-200">
                                        {entry.analysis.category}
                                    </span>
                                    {locationChipLabel ? (
                                        <span className="max-w-[8.5rem] truncate rounded-full bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-ink-200 sm:max-w-[10rem]">
                                            {locationChipLabel}
                                        </span>
                                    ) : null}
                                    <span className="max-w-[8.5rem] truncate rounded-full bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-ink-200 sm:max-w-[10rem]">
                                        {rarityLabel}
                                    </span>
                                </div>
                            </article>
                        </Link>
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
