"use client";

import {useCallback, useEffect, useRef, useState, type ReactNode} from "react";
import Image from "next/image";
import {usePathname, useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AnimalDexNumberBadge from "@/app/[locale]/(composited)/animals/animaldex-number-badge";
import BattleTierChip from "@/app/[locale]/(composited)/animals/battle-tier-chip";
import IdentityKindChip from "@/app/[locale]/(composited)/animals/identity-kind-chip";
import {getSpeciesArtworkUrl} from "@/data/species-artwork";
import {getLegendaryEarthBeast} from "@/data/legendary-earth-beasts";
import {getSpeciesImageAltText, type SpeciesDirectoryImageState} from "@/lib/species-image-public";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {speciesDirectorySearchMatch} from "@/lib/species-life-stage-policy";
import {getSpeciesRarityStatusKey, SPECIES_DIRECTORY_SORT_OPTIONS, getDefaultSpeciesDirectorySortOrder, SpeciesEntry, SpeciesDirectorySort, SpeciesDirectorySortOrder, SpeciesDirectoryTierFilter, SpeciesRarityStatusKey} from "@/data/species";
import {getBattleTier, type AnimalBattleTier, type SpeciesStats} from "@/lib/battle-tier";
import {identityKindShortLabel} from "@/lib/identity-kind";
import SpeciesRegionMap from "./species-region-map";
import {getNativeRangeRegionLabel, NativeRangeRegionKey, resolveNativeRangePresentation} from "@/data/native-range";
import {getLocationPage} from "@/data/locations";

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
    sortLabel: string;
    sortAscendingLabel: string;
    sortDescendingLabel: string;
    filterAll: string;
    resultsSummary: string;
    loadingMore: string;
    noResultsTitle: string;
    noResultsDescription: string;
    clearFilters: string;
    battleTierChip: string;
    sortOptions: Record<SpeciesDirectorySort, {title: string; detail: string}>;
    rarityStatuses: Record<SpeciesRarityStatusKey, string>;
};

type SpeciesDirectoryProps = {
    locale: string;
    speciesEntries: SpeciesEntry[];
    directoryImageState: Record<string, SpeciesDirectoryImageState>;
    currentPage: number;
    totalPages: number;
    total: number;
    currentQuery: string;
    currentLetter: string;
    currentRegion: NativeRangeRegionKey | "all";
    currentLocation: string | "all";
    currentStatus: SpeciesRarityStatusKey | "all";
    currentSort: SpeciesDirectorySort;
    currentOrder: SpeciesDirectorySortOrder;
    currentTier: SpeciesDirectoryTierFilter;
    copy: SpeciesDirectoryCopy;
};

type DirectoryPageResponse = {
    entries: SpeciesEntry[];
    directoryImageState: Record<string, SpeciesDirectoryImageState>;
    currentPage: number;
    totalPages: number;
    total: number;
    hasMore: boolean;
};

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const rarityOrder: SpeciesRarityStatusKey[] = ["relatively-common", "uncommon", "rare", "very-rare"];
const STAT_KEYS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;

function ActiveFilterChip({
    label,
    onRemove
}: {
    label: string;
    onRemove: () => void;
}) {
    return (
        <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary-400/35 bg-primary-400/12 py-1 pl-3 pr-1 text-xs font-semibold text-primary-100">
            <span className="min-w-0 truncate">{label}</span>
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${label}`}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-primary-100/80 transition-colors hover:bg-primary-400/20 hover:text-white"
            >
                <span aria-hidden="true" className="text-sm leading-none">×</span>
            </button>
        </span>
    );
}

const SORT_STAT_KEYS = ["rarity", "dominance", "speed", "size", "intelligence"] as const;
type SortStatKey = (typeof SORT_STAT_KEYS)[number];

function isSortStatKey(sort: SpeciesDirectorySort): sort is SortStatKey {
    return (SORT_STAT_KEYS as readonly string[]).includes(sort);
}

const SORT_OPTION_ICONS: Record<SpeciesDirectorySort, {badge: string; tint: string; icon: ReactNode}> = {
    number: {
        badge: "#",
        tint: "#38fa47",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 8.5h14M5 15.5h14M9.5 4.5 7.5 19.5M16.5 4.5 14.5 19.5" strokeLinecap="round" />
            </svg>
        )
    },
    rarity: {
        badge: "RAR",
        tint: "rgba(251, 146, 60, 0.92)",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="m12 3.5 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8 7.2 18.4l.9-5.4-3.9-3.8 5.4-.8L12 3.5Z" strokeLinejoin="round" />
            </svg>
        )
    },
    dominance: {
        badge: "DOM",
        tint: "rgba(239, 68, 68, 0.92)",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 3.5 19 7v5.2c0 4.2-2.8 7.8-7 8.8-4.2-1-7-4.6-7-8.8V7l7-3.5Z" strokeLinejoin="round" />
                <path d="M9.2 12.2 11 14l3.8-3.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    speed: {
        badge: "SPD",
        tint: "#38fa47",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M13 3.5 6.5 13.2h5L11 20.5 17.5 10.8h-5L13 3.5Z" strokeLinejoin="round" />
            </svg>
        )
    },
    size: {
        badge: "SIZE",
        tint: "#a78bfa",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 4.5H4.5V8M16 4.5h3.5V8M8 19.5H4.5V16M16 19.5h3.5V16" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="8.5" y="8.5" width="7" height="7" rx="1.2" />
            </svg>
        )
    },
    intelligence: {
        badge: "INT",
        tint: "rgba(34, 211, 238, 0.92)",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9.5 17.5h5M10.2 20h3.6M8.2 14.8c-1.7-1-2.7-2.7-2.7-4.7A5.5 5.5 0 0 1 12 4.6a5.5 5.5 0 0 1 6.5 5.5c0 2-1 3.7-2.7 4.7l-.6 1.2H8.8l-.6-1.2Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    },
    name: {
        badge: "A–Z",
        tint: "#94a3b8",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="m7.5 17.5 3-10h1.2l3 10M8.4 14.2h5.4M16.2 7.5H19M16.8 12H19M16.2 16.5H19" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    }
};

function getCanonicalSortStatValue(entry: SpeciesEntry, sort: SortStatKey): number | null {
    const value = Number(entry.databaseSource?.canonicalGameStats?.[sort]);
    return Number.isFinite(value) ? value : null;
}

function SortStatChip({sort, value}: {sort: SortStatKey; value: number}) {
    const meta = SORT_OPTION_ICONS[sort];
    const displayValue = Number.isInteger(value) ? String(value) : value.toFixed(1);
    const suffix = sort === "rarity" ? "%" : "";

    return (
        <span
            className="inline-flex h-[22px] items-center gap-1 rounded-full border px-2 text-[10px] font-black uppercase tracking-[0.04em]"
            style={{
                color: meta.tint,
                backgroundColor: `color-mix(in srgb, ${meta.tint} 14%, transparent)`,
                borderColor: `color-mix(in srgb, ${meta.tint} 40%, transparent)`
            }}
            title={`${meta.badge} ${displayValue}${suffix}`}
        >
            <span aria-hidden="true" className="[&>svg]:h-3 [&>svg]:w-3">
                {meta.icon}
            </span>
            <span>{meta.badge}</span>
            <span className="font-bold normal-case tracking-normal text-white/95">
                {displayValue}{suffix}
            </span>
        </span>
    );
}

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
    speciesEntries,
    directoryImageState,
    currentPage,
    totalPages,
    total,
    currentQuery,
    currentLetter,
    currentRegion,
    currentLocation,
    currentStatus,
    currentSort,
    currentOrder,
    currentTier,
    copy
}: SpeciesDirectoryProps) {
    const router = useRouter();
    const pathname = usePathname();
    const defaultOrder = getDefaultSpeciesDirectorySortOrder(currentSort);
    const [locationFilterOpen, setLocationFilterOpen] = useState(currentRegion !== "all");
    const [filtersOpen, setFiltersOpen] = useState(
        currentLetter !== "all"
            || currentRegion !== "all"
            || currentLocation !== "all"
            || currentStatus !== "all"
            || currentSort !== "number"
            || currentOrder !== defaultOrder
            || currentTier !== "all"
    );
    const [entries, setEntries] = useState(speciesEntries);
    const [imageState, setImageState] = useState(directoryImageState);
    const [page, setPage] = useState(currentPage);
    const [pageCount, setPageCount] = useState(totalPages);
    const [totalCount, setTotalCount] = useState(total);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const loadMoreLockRef = useRef(false);
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const filterKey = [
        currentQuery,
        currentLetter,
        currentRegion,
        currentLocation,
        currentStatus,
        currentSort,
        currentOrder,
        currentTier
    ].join("|");

    useEffect(() => {
        if (currentRegion !== "all") {
            setLocationFilterOpen(true);
        }
    }, [currentRegion]);

    useEffect(() => {
        setEntries(speciesEntries);
        setImageState(directoryImageState);
        setPage(currentPage);
        setPageCount(totalPages);
        setTotalCount(total);
        setLoadError(null);
        loadMoreLockRef.current = false;
    }, [filterKey, speciesEntries, directoryImageState, currentPage, totalPages, total]);

    const hasMore = page < pageCount;

    const loadMore = useCallback(async () => {
        if (loadMoreLockRef.current || isLoadingMore || !hasMore) return;

        loadMoreLockRef.current = true;
        setIsLoadingMore(true);
        setLoadError(null);

        try {
            const params = new URLSearchParams();
            if (currentQuery.trim()) params.set("q", currentQuery.trim());
            if (currentLetter !== "all") params.set("letter", currentLetter);
            if (currentRegion !== "all") params.set("region", currentRegion);
            if (currentLocation !== "all") params.set("location", currentLocation);
            if (currentStatus !== "all") params.set("status", currentStatus);
            if (currentSort !== "number") params.set("sort", currentSort);
            if (currentOrder !== getDefaultSpeciesDirectorySortOrder(currentSort)) params.set("order", currentOrder);
            if (currentTier !== "all") params.set("tier", currentTier);
            params.set("page", String(page + 1));

            const response = await fetch(`/api/animals/directory?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`Failed to load more animals (${response.status})`);
            }

            const payload = await response.json() as DirectoryPageResponse;
            setEntries((current) => {
                const seen = new Set(current.map((entry) => entry.slug));
                return [...current, ...payload.entries.filter((entry) => !seen.has(entry.slug))];
            });
            setImageState((current) => ({...current, ...payload.directoryImageState}));
            setPage(payload.currentPage);
            setPageCount(payload.totalPages);
            setTotalCount(payload.total);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : "Failed to load more animals");
        } finally {
            setIsLoadingMore(false);
            loadMoreLockRef.current = false;
        }
    }, [
        currentLetter,
        currentLocation,
        currentQuery,
        currentRegion,
        currentSort,
        currentOrder,
        currentStatus,
        currentTier,
        hasMore,
        isLoadingMore,
        page
    ]);

    useEffect(() => {
        if (!hasMore) return undefined;
        const node = sentinelRef.current;
        if (!node) return undefined;

        const observer = new IntersectionObserver((observerEntries) => {
            if (observerEntries.some((entry) => entry.isIntersecting)) {
                void loadMore();
            }
        }, {rootMargin: "800px 0px"});

        observer.observe(node);
        return () => observer.disconnect();
    }, [hasMore, loadMore, entries.length]);

    function pushFilters({
        nextQuery = currentQuery,
        nextLetter = currentLetter,
        nextRegion = currentRegion,
        nextLocation = currentLocation,
        nextStatus = currentStatus,
        nextSort = currentSort,
        nextOrder = currentOrder,
        nextTier = currentTier
    }: {
        nextQuery?: string;
        nextLetter?: string;
        nextRegion?: NativeRangeRegionKey | "all";
        nextLocation?: string | "all";
        nextStatus?: SpeciesRarityStatusKey | "all";
        nextSort?: SpeciesDirectorySort;
        nextOrder?: SpeciesDirectorySortOrder;
        nextTier?: SpeciesDirectoryTierFilter;
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

        if (nextSort !== "number") {
            params.set("sort", nextSort);
        }

        if (nextOrder !== getDefaultSpeciesDirectorySortOrder(nextSort)) {
            params.set("order", nextOrder);
        }

        if (nextTier !== "all") {
            params.set("tier", nextTier);
        }

        const queryString = params.toString();
        const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
        router.push(nextUrl);
    }

    const hasActiveFilters = Boolean(
        currentQuery
            || currentLetter !== "all"
            || currentRegion !== "all"
            || currentLocation !== "all"
            || currentStatus !== "all"
            || currentSort !== "number"
            || currentOrder !== getDefaultSpeciesDirectorySortOrder(currentSort)
            || currentTier !== "all"
    );

    const resultsSummary = copy.resultsSummary
        .replace("{count}", String(entries.length))
        .replace("{total}", String(totalCount));

    const sortDirectionLabel = currentSort === "name"
        ? (currentOrder === "asc" ? "A → Z" : "Z → A")
        : currentOrder === "asc"
            ? copy.sortAscendingLabel
            : copy.sortDescendingLabel;

    const activeFilterChips: Array<{key: string; label: string; clear: () => void}> = [];

    if (currentQuery.trim()) {
        activeFilterChips.push({
            key: "query",
            label: currentQuery.trim(),
            clear: () => pushFilters({nextQuery: ""})
        });
    }

    if (currentLetter !== "all") {
        activeFilterChips.push({
            key: "letter",
            label: `${copy.alphabetLabel} ${currentLetter}`,
            clear: () => pushFilters({nextLetter: "all"})
        });
    }

    if (currentRegion !== "all") {
        activeFilterChips.push({
            key: "region",
            label: `${copy.locationLabel}: ${getNativeRangeRegionLabel(currentRegion)}`,
            clear: () => pushFilters({nextRegion: "all"})
        });
    }

    if (currentLocation !== "all") {
        const locationTitle = getLocationPage(currentLocation)?.name ?? currentLocation;
        activeFilterChips.push({
            key: "location",
            label: locationTitle,
            clear: () => pushFilters({nextLocation: "all"})
        });
    }

    if (currentStatus !== "all") {
        activeFilterChips.push({
            key: "status",
            label: `${copy.statusLabel}: ${copy.rarityStatuses[currentStatus]}`,
            clear: () => pushFilters({nextStatus: "all"})
        });
    }

    if (currentSort !== "number" || currentOrder !== getDefaultSpeciesDirectorySortOrder(currentSort)) {
        activeFilterChips.push({
            key: "sort",
            label: `${copy.sortOptions[currentSort].title} · ${sortDirectionLabel}`,
            clear: () => pushFilters({nextSort: "number", nextOrder: "asc"})
        });
    }

    if (currentTier !== "all") {
        activeFilterChips.push({
            key: "tier",
            label: currentTier === "S" ? "Tier S · Legendary" : `Tier ${currentTier}`,
            clear: () => pushFilters({nextTier: "all"})
        });
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between gap-4 border-y border-line-300 py-4">
                <p className="text-sm md:text-base text-ink-300">
                    {resultsSummary}
                </p>
                <div className="flex items-center gap-4">
                    {hasActiveFilters ? (
                        <button
                            type="button"
                            onClick={() => pushFilters({
                                nextQuery: "",
                                nextLetter: "all",
                                nextRegion: "all",
                                nextLocation: "all",
                                nextStatus: "all",
                                nextSort: "number",
                                nextOrder: "asc",
                                nextTier: "all"
                            })}
                            className="inline-flex items-center gap-1.5 text-sm text-primary-200 transition-colors hover:text-primary-100"
                        >
                            <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <path d="M4.5 5.5h11M7.5 5.5V4h5v1.5M6.5 7.5l.6 8h5.8l.6-8M8.5 8.5v5M11.5 8.5v5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {copy.clearFilters}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => setFiltersOpen((open) => !open)}
                        aria-expanded={filtersOpen}
                        className="inline-flex items-center gap-2 rounded-full border border-line-300 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-primary-400"
                    >
                        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path d="M3.5 5h13M6 10h8M8.5 15h3" strokeLinecap="round" />
                        </svg>
                        {filtersOpen ? copy.closeFiltersButton : copy.filtersButton}
                        <svg
                            viewBox="0 0 20 20"
                            className={`h-3.5 w-3.5 shrink-0 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                        >
                            <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
            </div>

            {activeFilterChips.length > 0 ? (
                <div className="-mt-4 flex flex-wrap items-center gap-2">
                    {activeFilterChips.map((chip) => (
                        <ActiveFilterChip key={chip.key} label={chip.label} onRemove={chip.clear} />
                    ))}
                </div>
            ) : null}

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
                                    onClick={() => pushFilters({nextStatus: "all"})}
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
                                        onClick={() => pushFilters({nextStatus: statusKey})}
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
                            onSelectRegion={(region) => pushFilters({nextRegion: region})}
                            allLabel={copy.allRegions}
                            mapAriaLabel={copy.mapAriaLabel}
                            mapActiveLabel={copy.mapActiveLabel}
                        />
                    ) : null}

                    <div className="flex flex-col gap-3">
                        <p className="text-sm uppercase tracking-[0.16em] font-medium text-primary-200">{copy.sortLabel}</p>
                        <div className="space-y-2">
                            {SPECIES_DIRECTORY_SORT_OPTIONS.map((option) => {
                                const labels = copy.sortOptions[option.id];
                                const selected = currentSort === option.id;
                                const meta = SORT_OPTION_ICONS[option.id];
                                const directionLabel = option.id === "name"
                                    ? (currentOrder === "asc" ? "A → Z" : "Z → A")
                                    : currentOrder === "asc"
                                        ? copy.sortAscendingLabel
                                        : copy.sortDescendingLabel;

                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => {
                                            if (selected) {
                                                pushFilters({
                                                    nextSort: option.id,
                                                    nextOrder: currentOrder === "asc" ? "desc" : "asc"
                                                });
                                                return;
                                            }

                                            pushFilters({
                                                nextSort: option.id,
                                                nextOrder: getDefaultSpeciesDirectorySortOrder(option.id)
                                            });
                                        }}
                                        className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                                            selected
                                                ? "border-primary-400 bg-primary-500/15 text-white"
                                                : "border-line-300 text-ink-300 hover:border-primary-400 hover:text-white"
                                        }`}
                                    >
                                        <span
                                            className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
                                                selected
                                                    ? "border-primary-400/40 bg-primary-400/15 text-primary-100"
                                                    : "border-white/10 bg-white/[0.04] text-white/55"
                                            }`}
                                            style={selected ? {color: meta.tint} : undefined}
                                            aria-hidden="true"
                                        >
                                            {meta.icon}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-semibold text-white">{labels.title}</span>
                                                <span
                                                    className="rounded-full px-1.5 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.12em]"
                                                    style={{
                                                        color: meta.tint,
                                                        backgroundColor: `${meta.tint}22`
                                                    }}
                                                >
                                                    {meta.badge}
                                                </span>
                                                {selected ? (
                                                    <span className="rounded-full border border-primary-400/30 bg-primary-400/10 px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.08em] text-primary-100">
                                                        {directionLabel}
                                                    </span>
                                                ) : null}
                                            </span>
                                            <span className="mt-1 block text-xs leading-5 text-ink-300">{labels.detail}</span>
                                        </span>
                                        {selected ? (
                                            <span className="mt-1 shrink-0 text-primary-200" aria-hidden="true">
                                                {currentOrder === "asc" ? "↑" : "↓"}
                                            </span>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <p className="text-sm uppercase tracking-[0.16em] font-medium text-primary-200">{copy.alphabetLabel}</p>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            <button
                                type="button"
                                onClick={() => pushFilters({nextLetter: "all"})}
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
                                    onClick={() => pushFilters({nextLetter: letter})}
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

            {entries.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {entries.map((entry) => {
                        const animalDexNumber = getAnimalDexNumberFromEntry(entry);
                        const locationChipLabel = getLocationChipLabel(entry);
                        const rarityLabel = copy.rarityStatuses[getSpeciesRarityStatusKey(entry.analysis.rarityScore)];
                        const battleTier = getBattleTierFromEntry(entry);
                        const identityKind = entry.databaseSource?.identityKind ?? null;
                        const identityKindLabel = identityKindShortLabel(identityKind);
                        const sortStatValue = isSortStatKey(currentSort)
                            ? getCanonicalSortStatValue(entry, currentSort)
                            : null;
                        const searchMatch = currentQuery.trim()
                            ? speciesDirectorySearchMatch(entry, currentQuery)
                            : null;

                        return (
                        <Link
                            key={entry.slug}
                            href={`/animals/${entry.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex min-h-[7rem] items-center gap-3 rounded-[1.375rem] border border-line-300/80 bg-surface-900/70 p-3 shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-0.5 hover:border-primary-400/45 hover:bg-surface-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200 sm:min-h-[8rem] sm:gap-4 sm:p-4"
                            aria-label={`${copy.readSpecies}: ${entry.name}`}
                        >
                            <CatalogGlyphThumbnail
                                entry={entry}
                                animalDexNumber={animalDexNumber}
                                imageState={imageState[entry.slug] ?? {hasPublicCapture: false, captureId: null}}
                            />
                            <article className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {battleTier ? <BattleTierChip tier={battleTier} compact /> : null}
                                            {identityKindLabel ? (
                                                <IdentityKindChip
                                                    identityKind={identityKind}
                                                    label={identityKindLabel}
                                                    animalName={entry.name}
                                                    compact
                                                />
                                            ) : null}
                                            {sortStatValue != null && isSortStatKey(currentSort) ? (
                                                <SortStatChip sort={currentSort} value={sortStatValue} />
                                            ) : null}
                                        </div>
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
                                pushFilters({nextQuery: "", nextLetter: "all", nextRegion: "all", nextLocation: "all", nextStatus: "all", nextSort: "number", nextOrder: "asc", nextTier: "all"});
                            }}
                            className="text-primary-200 text-lg hover:text-primary-100 transition-colors"
                        >
                            {copy.clearFilters}
                        </button>
                    </div>
                </div>
            )}

            {entries.length > 0 ? (
                <div ref={sentinelRef} className="flex min-h-12 flex-col items-center justify-center gap-2 py-2" aria-live="polite">
                    {isLoadingMore ? (
                        <div className="inline-flex items-center gap-2.5 text-sm font-semibold text-ink-300">
                            <span
                                aria-hidden="true"
                                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-400/25 border-t-primary-300"
                            />
                            {copy.loadingMore}
                        </div>
                    ) : null}
                    {loadError ? (
                        <button
                            type="button"
                            onClick={() => void loadMore()}
                            className="text-sm font-semibold text-primary-200 hover:text-primary-100"
                        >
                            {loadError} · Retry
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
