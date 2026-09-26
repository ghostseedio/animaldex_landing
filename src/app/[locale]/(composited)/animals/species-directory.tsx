"use client";

import {Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {usePathname, useSearchParams} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import {getLegendaryEarthBeast} from "@/data/legendary-earth-beasts";
import {getSpeciesImageAltText} from "@/lib/species-image-public";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {speciesDirectorySearchMatch} from "@/lib/species-life-stage-policy";
import {getSpeciesRarityStatusKey, SPECIES_DIRECTORY_SORT_OPTIONS, SPECIES_DIRECTORY_PAGE_SIZE, SPECIES_DIRECTORY_PAGE_SIZES, isSpeciesDirectoryPageSize, getDefaultSpeciesDirectorySortOrder, SpeciesEntry, SpeciesDirectorySort, SpeciesDirectorySortOrder, SpeciesDirectoryTierFilter, SpeciesDirectoryPageSize, SpeciesRarityStatusKey} from "@/data/species";
import {getBattleTier, type AnimalBattleTier, type SpeciesStats} from "@/lib/battle-tier";
import BattleTierChip from "./battle-tier-chip";
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
    perPageLabel: string;
    loadingMore: string;
    paginationLabel: string;
    paginationPrevious: string;
    paginationNext: string;
    paginationPage: string;
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
    capturedSpecies: Record<string, boolean>;
    speciesImages: Record<string, string>;
    publicCaptureSpecies: Record<string, boolean>;
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
    capturedSpecies: Record<string, boolean>;
    speciesImages: Record<string, string>;
    publicCaptureSpecies: Record<string, boolean>;
    currentPage: number;
    totalPages: number;
    total: number;
    hasMore: boolean;
};

function parseDirectorySearch(search: string) {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const query = params.get("q")?.trim() ?? "";
    const letter = params.get("letter")?.trim() || "all";
    const region = (params.get("region")?.trim() || "all") as NativeRangeRegionKey | "all";
    const location = params.get("location")?.trim() || "all";
    const status = (params.get("status")?.trim() || "all") as SpeciesRarityStatusKey | "all";
    const sort = (params.get("sort")?.trim() || "number") as SpeciesDirectorySort;
    const orderParam = params.get("order")?.trim().toLowerCase();
    const order = (orderParam === "asc" || orderParam === "desc"
        ? orderParam
        : getDefaultSpeciesDirectorySortOrder(sort)) as SpeciesDirectorySortOrder;
    const tier = (params.get("tier")?.trim().toUpperCase() || "all") as SpeciesDirectoryTierFilter;
    const parsedPage = Number.parseInt(params.get("page") ?? "1", 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const parsedPerPage = Number.parseInt(params.get("perPage") ?? "", 10);
    const perPage: SpeciesDirectoryPageSize = Number.isFinite(parsedPerPage) && isSpeciesDirectoryPageSize(parsedPerPage)
        ? parsedPerPage
        : SPECIES_DIRECTORY_PAGE_SIZE;
    return {query, letter, region, location, status, sort, order, tier, page, perPage};
}

type DirectoryFilters = ReturnType<typeof parseDirectorySearch>;

/** One place that knows the directory query shape, so a prefetch and the real
 *  request produce byte-identical URLs and share the browser's HTTP cache. */
function buildDirectoryRequestUrl(filters: DirectoryFilters, page: number) {
    const params = new URLSearchParams();
    if (filters.query.trim()) params.set("q", filters.query.trim());
    if (filters.letter !== "all") params.set("letter", filters.letter);
    if (filters.region !== "all") params.set("region", filters.region);
    if (filters.location !== "all") params.set("location", filters.location);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.sort !== "number") params.set("sort", filters.sort);
    if (filters.order !== getDefaultSpeciesDirectorySortOrder(filters.sort)) params.set("order", filters.order);
    if (filters.tier !== "all") params.set("tier", filters.tier);
    if (filters.perPage !== SPECIES_DIRECTORY_PAGE_SIZE) params.set("perPage", String(filters.perPage));
    params.set("page", String(page));
    return `/api/animals/directory?${params.toString()}`;
}

/**
 * De-duplicates concurrent requests for the same page. A prefetch and the
 * load-more it was warming can overlap, and React re-invokes effects on mount in
 * development, so without this the directory asks for the same page twice.
 */
const inFlightDirectoryRequests = new Map<string, Promise<DirectoryPageResponse>>();

function fetchDirectoryPage(url: string) {
    const existing = inFlightDirectoryRequests.get(url);
    if (existing) return existing;

    const request = (async () => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load animals (${response.status})`);
        }
        return await response.json() as DirectoryPageResponse;
    })().finally(() => {
        inFlightDirectoryRequests.delete(url);
    });

    inFlightDirectoryRequests.set(url, request);
    return request;
}

/**
 * Page numbers to show: always the first and last, and a window around the
 * current page, with gaps marked by null. Fifty pages of species will not fit on
 * a phone, and a bare "next" gives no sense of where you are in the catalogue.
 */
function buildPageWindow(page: number, pageCount: number): Array<number | null> {
    if (pageCount <= 7) {
        return Array.from({length: pageCount}, (_, index) => index + 1);
    }

    const pages = new Set<number>([1, pageCount, page]);
    for (const offset of [-1, 1]) {
        const candidate = page + offset;
        if (candidate > 1 && candidate < pageCount) pages.add(candidate);
    }
    // Keep the window a constant width so the control does not resize as you page.
    if (page <= 3) [2, 3, 4].forEach((value) => pages.add(value));
    if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((value) => pages.add(value));

    const ordered = Array.from(pages).filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
    const withGaps: Array<number | null> = [];
    let previous: number | null = null;
    for (const value of ordered) {
        if (previous !== null && value - previous > 1) withGaps.push(null);
        withGaps.push(value);
        previous = value;
    }
    return withGaps;
}

function PageChevron({
    direction,
    label,
    disabled,
    onClick
}: {
    direction: "previous" | "next";
    label: string;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="inline-flex h-10 w-10 items-center justify-center border border-line-300 text-ink-200 transition-colors hover:border-primary-500/45 hover:text-white disabled:pointer-events-none disabled:opacity-35"
        >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={direction === "previous" ? "M12.5 4 6.5 10l6 6" : "M7.5 4l6 6-6 6"} />
            </svg>
        </button>
    );
}

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
/** Widest grid is 8 columns, so roughly three rows are visible on load. */
const ABOVE_FOLD_TILES = 24;
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
        <span className="inline-flex max-w-full items-center gap-1 border border-primary-400/35 bg-primary-400/12 py-1 pl-3 pr-1 text-xs font-semibold text-primary-100">
            <span className="min-w-0 truncate">{label}</span>
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${label}`}
                className="grid h-6 w-6 shrink-0 place-items-center text-primary-100/80 transition-colors hover:bg-primary-400/20 hover:text-white"
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
        tint: "#A7F432",
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
        tint: "#A7F432",
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
            className="inline-flex max-w-full items-center gap-0.5 border bg-black/80 px-1.5 py-1 text-[9px] font-black uppercase leading-none tracking-[0.02em]"
            style={{
                color: meta.tint,
                borderColor: `color-mix(in srgb, ${meta.tint} 45%, transparent)`
            }}
            title={`${meta.badge} ${displayValue}${suffix}`}
        >
            <span aria-hidden="true" className="[&>svg]:h-2.5 [&>svg]:w-2.5">
                {meta.icon}
            </span>
            <span className="hidden sm:inline">{meta.badge}</span>
            <span className="font-black tabular-nums normal-case tracking-normal text-white/95">
                {displayValue}{suffix}
            </span>
        </span>
    );
}

/**
 * Mirrors the iOS catalog card: the active sort (or the rarity band filter)
 * decides which canonical stat rides alongside the AnimalDex number.
 */
function resolveThumbnailStatKey(
    sort: SpeciesDirectorySort,
    status: SpeciesRarityStatusKey | "all"
): SortStatKey | null {
    if (isSortStatKey(sort)) {
        return sort;
    }

    return status !== "all" ? "rarity" : null;
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

/**
 * Reports the live query string without dragging the directory out of server
 * rendering: `useSearchParams` marks its whole subtree client-only, so it is
 * confined to this leaf behind a Suspense boundary.
 */
function DirectorySearchParamsReader({onChange}: {onChange: (search: string) => void}) {
    const searchParams = useSearchParams();
    const search = searchParams.toString();

    useEffect(() => {
        onChange(search);
    }, [onChange, search]);

    return null;
}

/** Placeholder tile so a re-sort or a page fetch fills visible slots straight
 *  away instead of leaving the grid looking frozen. */
function CatalogSkeletonTile() {
    return (
        <div aria-hidden="true" className="relative aspect-square w-full overflow-hidden bg-surface-900">
            <span className="absolute inset-0 animate-pulse bg-surface-800/70" />
        </div>
    );
}

function CatalogGlyphThumbnail({
    entry,
    animalDexNumber,
    captured,
    imageSrc,
    hasPublicCapture,
    priority,
    statKey,
    showBattleTier
}: {
    entry: SpeciesEntry;
    animalDexNumber: number | null;
    captured: boolean;
    imageSrc: string;
    hasPublicCapture: boolean;
    priority: boolean;
    statKey: SortStatKey | null;
    showBattleTier: boolean;
}) {
    const imageAlt = getSpeciesImageAltText(entry, "thumbnail");
    const statValue = statKey ? getCanonicalSortStatValue(entry, statKey) : null;
    const battleTier = showBattleTier ? getBattleTierFromEntry(entry) : null;
    const targetImageSrc = !captured && !hasPublicCapture
        ? getSpeciesArtworkRoute(entry.slug, 240)
        : `${imageSrc}${imageSrc.includes("?") ? "&" : "?"}thumbnail=1`;
    // The page is server-rendered from the static catalog, then the directory fetch
    // replaces every tile's URL with a database-backed one. Pointing the live <img>
    // at the new URL straight away empties all 48 tiles at once, which is what made
    // the grid look stuck on black — so decode the replacement first, then swap.
    const [displaySrc, setDisplaySrc] = useState(targetImageSrc);
    // Kept per-src rather than as a boolean so a swap re-arms the loading state.
    const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
    const [failedSrc, setFailedSrc] = useState<string | null>(null);

    useEffect(() => {
        if (targetImageSrc === displaySrc) return undefined;

        let cancelled = false;
        const preload = new window.Image();
        // On error too: the <img> re-requests it and surfaces the paw placeholder.
        const swap = () => {
            if (!cancelled) setDisplaySrc(targetImageSrc);
        };
        preload.onload = swap;
        preload.onerror = swap;
        preload.src = targetImageSrc;

        return () => {
            cancelled = true;
        };
    }, [targetImageSrc, displaySrc]);

    // A burst of tiles can momentarily overwhelm the image endpoint; latching on the
    // first error left every affected tile showing the generic paw icon for good.
    // One silent retry, and only then the placeholder.
    const [retriedSrc, setRetriedSrc] = useState<string | null>(null);
    const showPlaceholder = failedSrc === displaySrc;
    const isLoaded = loadedSrc === displaySrc;

    return (
        <div className="relative aspect-square w-full overflow-hidden bg-surface-900">
            {!showPlaceholder && !isLoaded ? (
                <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-surface-800/70" />
            ) : null}
            {showPlaceholder ? <CatalogPawPlaceholder muted={!captured} /> : (
                <img
                    src={displaySrc}
                    alt={imageAlt}
                    loading={priority ? "eager" : "lazy"}
                    fetchPriority={priority ? "high" : "auto"}
                    decoding="async"
                    ref={(node) => {
                        // A cached image can finish before React attaches onLoad.
                        if (node?.complete && node.naturalWidth > 0) {
                            setLoadedSrc(displaySrc);
                        }
                    }}
                    onLoad={() => setLoadedSrc(displaySrc)}
                    onError={(event) => {
                        if (retriedSrc === displaySrc) {
                            setFailedSrc(displaySrc);
                            return;
                        }
                        setRetriedSrc(displaySrc);
                        const image = event.currentTarget;
                        // Re-request past the browser's negative cache for this URL.
                        window.setTimeout(() => {
                            image.src = `${displaySrc}${displaySrc.includes("?") ? "&" : "?"}retry=1`;
                        }, 400);
                    }}
                    className={`relative h-full w-full transition duration-300 group-hover:scale-[1.02] ${captured || hasPublicCapture ? "object-cover" : "object-contain p-[40.5%] brightness-0 invert opacity-70"} ${!captured && hasPublicCapture ? "grayscale contrast-[.82] brightness-[.92]" : ""}`}
                />
            )}
            {!captured && hasPublicCapture ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white/95 drop-shadow-md" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                        <path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 0 1 4 0v2h-4V7Z" />
                    </svg>
                </span>
            ) : null}
            <div className="pointer-events-none absolute inset-x-1.5 top-1.5 flex items-start justify-end gap-1">
                {statKey && statValue != null ? (
                    <SortStatChip sort={statKey} value={statValue} />
                ) : null}
            </div>
            {/* Name plate. `truncate` keeps it to a single line and clips with an
                ellipsis at the tile edge rather than breaking a species name across
                two lines or mid-word; the gradient stops it sitting on busy photos. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-1.5 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-1.5 pb-1.5 pt-6">
                <span className="min-w-0 flex-1 truncate text-[10px] font-bold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:text-[11px]">
                    {entry.name}
                </span>
                {animalDexNumber && animalDexNumber > 0 ? (
                    <span className="shrink-0 font-mono text-[9px] font-bold leading-none tabular-nums text-primary-200/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                        {String(animalDexNumber).padStart(3, "0")}
                    </span>
                ) : null}
            </div>
            {battleTier ? (
                <div className="pointer-events-none absolute bottom-8 left-1.5">
                    <BattleTierChip tier={battleTier} compact />
                </div>
            ) : null}
        </div>
    );
}

export default function SpeciesDirectory({
    speciesEntries,
    capturedSpecies,
    speciesImages,
    publicCaptureSpecies,
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
    const pathname = usePathname();
    // Null until the browser reports the query string. Reading useSearchParams here
    // would opt this whole subtree out of server rendering, so it lives in a child
    // behind its own boundary and the grid renders from props on the server.
    const [directorySearchKey, setDirectorySearchKey] = useState<string | null>(null);
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
    const [capturedState, setCapturedState] = useState(capturedSpecies);
    const [speciesImageState, setSpeciesImageState] = useState(speciesImages);
    const [publicCaptureState, setPublicCaptureState] = useState(publicCaptureSpecies);
    const [page, setPage] = useState(currentPage);
    const [pageCount, setPageCount] = useState(totalPages);
    const [totalCount, setTotalCount] = useState(total);
    const [isApplyingFilters, setIsApplyingFilters] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    // One-slot cache for the next page, warmed as soon as the current one settles.
    const prefetchRef = useRef<{url: string; payload: Promise<DirectoryPageResponse>} | null>(null);
    const [overrideFilters, setOverrideFilters] = useState<ReturnType<typeof parseDirectorySearch> | null>(null);
    /** Guards against a second page request while one is already in flight. */
    const requestLockRef = useRef(false);
    /** Last server-rendered page adopted, so re-renders do not reset client state. */
    const serverPageRef = useRef<string | null>(null);
    const directoryRequestIdRef = useRef(0);
    const gridRef = useRef<HTMLDivElement | null>(null);
    const activeQuery = overrideFilters?.query ?? currentQuery;
    const activeLetter = overrideFilters?.letter ?? currentLetter;
    const activeRegion = overrideFilters?.region ?? currentRegion;
    const activeLocation = overrideFilters?.location ?? currentLocation;
    const activeStatus = overrideFilters?.status ?? currentStatus;
    const activeSort = overrideFilters?.sort ?? currentSort;
    const activeOrder = overrideFilters?.order ?? currentOrder;
    const activeTier = overrideFilters?.tier ?? currentTier;
    const activePerPage = overrideFilters?.perPage ?? SPECIES_DIRECTORY_PAGE_SIZE;
    // Memoised so the request URL it produces is referentially stable; the page
    // switch and the prefetch both depend on it.
    const activeFilters = useMemo<DirectoryFilters>(() => ({
        query: activeQuery,
        letter: activeLetter,
        region: activeRegion,
        location: activeLocation,
        status: activeStatus,
        sort: activeSort,
        order: activeOrder,
        tier: activeTier,
        page,
        perPage: activePerPage
    }), [activeQuery, activeLetter, activeRegion, activeLocation, activeStatus, activeSort, activeOrder, activeTier, page, activePerPage]);
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
        // These props are fresh objects on every server render, so depending on their
        // identity meant any re-render threw away everything the client had loaded:
        // appended pages collapsed back to the first, and every tile reverted to the
        // artwork icon, because the server payload deliberately carries no capture
        // state. Only adopt the server's page when it actually describes a new one.
        const serverPage = `${filterKey}|${currentPage}|${totalPages}|${total}|${speciesEntries.length}`;
        if (serverPageRef.current === serverPage) return;
        serverPageRef.current = serverPage;

        setEntries(speciesEntries);
        setCapturedState(capturedSpecies);
        setSpeciesImageState(speciesImages);
        setPublicCaptureState(publicCaptureSpecies);
        setPage(currentPage);
        setPageCount(totalPages);
        setTotalCount(total);
        setLoadError(null);
        requestLockRef.current = false;
        directoryRequestIdRef.current += 1;
    }, [filterKey, speciesEntries, capturedSpecies, speciesImages, publicCaptureSpecies, currentPage, totalPages, total]);

    const applyDirectoryFilters = useCallback(async (filters: DirectoryFilters) => {
        const requestId = directoryRequestIdRef.current + 1;
        directoryRequestIdRef.current = requestId;
        requestLockRef.current = true;
        prefetchRef.current = null;
        setIsApplyingFilters(true);

        try {
            const payload = await fetchDirectoryPage(buildDirectoryRequestUrl(filters, filters.page));
            if (requestId !== directoryRequestIdRef.current) {
                return;
            }
            setEntries(payload.entries);
            setCapturedState(payload.capturedSpecies);
            setSpeciesImageState(payload.speciesImages);
            setPublicCaptureState(payload.publicCaptureSpecies);
            setPage(payload.currentPage);
            setPageCount(payload.totalPages);
            setTotalCount(payload.total);
            setLoadError(null);
        } finally {
            // Never leave the lock or the pending flag set.
            requestLockRef.current = false;
            setIsApplyingFilters(false);
        }
    }, []);

    useEffect(() => {
        if (directorySearchKey === null) return;
        const filters = parseDirectorySearch(directorySearchKey ? `?${directorySearchKey}` : "");
        setOverrideFilters(filters);
        void applyDirectoryFilters(filters).catch((error) => {
            setLoadError(error instanceof Error ? error.message : "Failed to load animals");
        });
    }, [applyDirectoryFilters, directorySearchKey]);


    /**
     * Discrete pages rather than an endless append.
     *
     * The previous model relied on a sentinel that, with a ~2400px footer below
     * the grid, sat permanently inside its own trigger zone — so the grid could
     * dead-end with no way forward, and a reader had no idea where they were in
     * 2385 species. A page lives in the URL now, so it is shareable and the back
     * button works.
     */
    const goToPage = useCallback((nextPage: number) => {
        const target = Math.min(Math.max(1, nextPage), Math.max(1, pageCount));
        if (target === page || isApplyingFilters) return;

        const nextFilters = {...activeFilters, page: target};
        setOverrideFilters(nextFilters);

        const params = new URLSearchParams(buildDirectoryRequestUrl(nextFilters, target).split("?")[1]);
        params.delete("page");
        if (target > 1) params.set("page", String(target));
        const queryString = params.toString();
        window.history.pushState(null, "", queryString ? `${pathname}?${queryString}` : pathname);

        gridRef.current?.scrollIntoView({block: "start"});

        void applyDirectoryFilters(nextFilters).catch((error) => {
            setLoadError(error instanceof Error ? error.message : "Failed to load animals");
        });
    }, [activeFilters, applyDirectoryFilters, isApplyingFilters, page, pageCount, pathname]);

    const setPerPage = useCallback((nextPerPage: SpeciesDirectoryPageSize) => {
        if (nextPerPage === activePerPage) return;

        // Page 4 of 50-per-page is a different slice from page 4 of 500, so changing
        // the size returns to the first page rather than to a meaningless offset.
        const nextFilters = {...activeFilters, perPage: nextPerPage, page: 1};
        setOverrideFilters(nextFilters);

        const params = new URLSearchParams(buildDirectoryRequestUrl(nextFilters, 1).split("?")[1]);
        params.delete("page");
        const queryString = params.toString();
        window.history.pushState(null, "", queryString ? `${pathname}?${queryString}` : pathname);

        void applyDirectoryFilters(nextFilters).catch((error) => {
            setLoadError(error instanceof Error ? error.message : "Failed to load animals");
        });
    }, [activeFilters, activePerPage, applyDirectoryFilters, pathname]);

    // Warm the next page so the forward chevron feels instant.
    useEffect(() => {
        if (page >= pageCount || isApplyingFilters) return undefined;

        const url = buildDirectoryRequestUrl(activeFilters, page + 1);
        if (prefetchRef.current?.url === url) return undefined;

        let cancelled = false;
        const payload = new Promise<DirectoryPageResponse>((resolve, reject) => {
            window.setTimeout(() => {
                if (cancelled) {
                    reject(new Error("prefetch cancelled"));
                    return;
                }
                fetchDirectoryPage(url).then(resolve, reject);
            }, 150);
        });
        prefetchRef.current = {url, payload};
        void payload.catch(() => undefined);

        return () => {
            cancelled = true;
            if (prefetchRef.current?.payload === payload) prefetchRef.current = null;
        };
    }, [activeFilters, isApplyingFilters, page, pageCount]);

    function pushFilters({
        nextQuery = activeQuery,
        nextLetter = activeLetter,
        nextRegion = activeRegion,
        nextLocation = activeLocation,
        nextStatus = activeStatus,
        nextSort = activeSort,
        nextOrder = activeOrder,
        nextTier = activeTier
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
        const nextFilters = {
            query: nextQuery,
            letter: nextLetter,
            region: nextRegion,
            location: nextLocation,
            status: nextStatus,
            sort: nextSort,
            order: nextOrder,
            tier: nextTier,
            // Any filter change starts again at the first page: page 7 of the old
            // result set means nothing in the new one.
            page: 1,
            perPage: activePerPage
        };
        setOverrideFilters(nextFilters);
        window.history.replaceState(null, "", nextUrl);
        void applyDirectoryFilters(nextFilters).catch((error) => {
            setLoadError(error instanceof Error ? error.message : "Failed to load animals");
        });
    }

    const hasActiveFilters = Boolean(
        activeQuery
            || activeLetter !== "all"
            || activeRegion !== "all"
            || activeLocation !== "all"
            || activeStatus !== "all"
            || activeSort !== "number"
            || activeOrder !== getDefaultSpeciesDirectorySortOrder(activeSort)
            || activeTier !== "all"
    );

    const thumbnailStatKey = resolveThumbnailStatKey(activeSort, activeStatus);

    const resultsSummary = copy.resultsSummary
        .replace("{count}", String(entries.length))
        .replace("{total}", String(totalCount));

    const sortDirectionLabel = activeSort === "name"
        ? (activeOrder === "asc" ? "A → Z" : "Z → A")
        : activeOrder === "asc"
            ? copy.sortAscendingLabel
            : copy.sortDescendingLabel;

    const activeFilterChips: Array<{key: string; label: string; clear: () => void}> = [];

    if (activeQuery.trim()) {
        activeFilterChips.push({
            key: "query",
            label: activeQuery.trim(),
            clear: () => pushFilters({nextQuery: ""})
        });
    }

    if (activeLetter !== "all") {
        activeFilterChips.push({
            key: "letter",
            label: `${copy.alphabetLabel} ${activeLetter}`,
            clear: () => pushFilters({nextLetter: "all"})
        });
    }

    if (activeRegion !== "all") {
        activeFilterChips.push({
            key: "region",
            label: `${copy.locationLabel}: ${getNativeRangeRegionLabel(activeRegion)}`,
            clear: () => pushFilters({nextRegion: "all"})
        });
    }

    if (activeLocation !== "all") {
        const locationTitle = getLocationPage(activeLocation)?.name ?? activeLocation;
        activeFilterChips.push({
            key: "location",
            label: locationTitle,
            clear: () => pushFilters({nextLocation: "all"})
        });
    }

    if (activeStatus !== "all") {
        activeFilterChips.push({
            key: "status",
            label: `${copy.statusLabel}: ${copy.rarityStatuses[activeStatus]}`,
            clear: () => pushFilters({nextStatus: "all"})
        });
    }

    if (activeSort !== "number" || activeOrder !== getDefaultSpeciesDirectorySortOrder(activeSort)) {
        activeFilterChips.push({
            key: "sort",
            label: `${copy.sortOptions[activeSort].title} · ${sortDirectionLabel}`,
            clear: () => pushFilters({nextSort: "number", nextOrder: "asc"})
        });
    }

    if (activeTier !== "all") {
        activeFilterChips.push({
            key: "tier",
            label: activeTier === "S" ? "Tier S · Legendary" : `Tier ${activeTier}`,
            clear: () => pushFilters({nextTier: "all"})
        });
    }

    return (
        <div className="flex flex-col gap-8">
            <Suspense fallback={null}>
                <DirectorySearchParamsReader onChange={setDirectorySearchKey} />
            </Suspense>
            <div className="flex items-center justify-between gap-4 border-y border-line-300 py-4">
                <p className="text-sm md:text-base text-ink-300">
                    {resultsSummary}
                </p>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-ink-300">
                        <span className="hidden sm:inline">{copy.perPageLabel}</span>
                        <select
                            value={activePerPage}
                            onChange={(event) => setPerPage(Number(event.target.value) as SpeciesDirectoryPageSize)}
                            aria-label={copy.perPageLabel}
                            className="h-9 border border-line-300 bg-surface-900 px-2 font-mono text-sm tabular-nums text-white transition-colors hover:border-primary-500/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-200"
                        >
                            {SPECIES_DIRECTORY_PAGE_SIZES.map((size) => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                    </label>
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
                        className="inline-flex items-center gap-2 border border-line-300 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-primary-400"
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
                <div className="border border-line-300 bg-surface-900/65 p-5 md:p-6 flex flex-col gap-6">
                    <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                                <p className="text-sm uppercase tracking-[0.16em] font-medium text-primary-200">{copy.locationLabel}</p>
                                <p className="text-sm text-ink-300">{copy.locationDescription}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLocationFilterOpen((open) => !open)}
                                className="flex items-center justify-between gap-3 border border-line-300 bg-surface-950 px-4 py-3 text-left transition-colors hover:border-primary-400"
                            >
                                <span className="text-white font-medium">
                                    {locationFilterOpen ? copy.closeLocationFilter : copy.openLocationFilter}
                                </span>
                                <span className="text-sm text-ink-300">
                                    {activeRegion === "all" ? copy.allRegions : getNativeRangeRegionLabel(activeRegion)}
                                </span>
                            </button>
                        </div>

                        <div className="flex flex-col gap-3">
                            <p className="text-sm uppercase tracking-[0.16em] font-medium text-primary-200">{copy.statusLabel}</p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => pushFilters({nextStatus: "all"})}
                                    className={`border px-3 py-1.5 text-sm transition-colors ${
                                        activeStatus === "all"
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
                                        className={`border px-3 py-1.5 text-sm transition-colors ${
                                            activeStatus === statusKey
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
                            currentRegion={activeRegion}
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
                                const selected = activeSort === option.id;
                                const meta = SORT_OPTION_ICONS[option.id];
                                const directionLabel = option.id === "name"
                                    ? (activeOrder === "asc" ? "A → Z" : "Z → A")
                                    : activeOrder === "asc"
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
                                                    nextOrder: activeOrder === "asc" ? "desc" : "asc"
                                                });
                                                return;
                                            }

                                            pushFilters({
                                                nextSort: option.id,
                                                nextOrder: getDefaultSpeciesDirectorySortOrder(option.id)
                                            });
                                        }}
                                        className={`flex w-full items-start gap-3 border px-4 py-3 text-left transition-colors ${
                                            selected
                                                ? "border-primary-400 bg-primary-500/15 text-white"
                                                : "border-line-300 text-ink-300 hover:border-primary-400 hover:text-white"
                                        }`}
                                    >
                                        <span
                                            className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center border ${
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
                                                    className="px-1.5 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.12em]"
                                                    style={{
                                                        color: meta.tint,
                                                        backgroundColor: `${meta.tint}22`
                                                    }}
                                                >
                                                    {meta.badge}
                                                </span>
                                                {selected ? (
                                                    <span className="border border-primary-400/30 bg-primary-400/10 px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.08em] text-primary-100">
                                                        {directionLabel}
                                                    </span>
                                                ) : null}
                                            </span>
                                            <span className="mt-1 block text-xs leading-5 text-ink-300">{labels.detail}</span>
                                        </span>
                                        {selected ? (
                                            <span className="mt-1 shrink-0 text-primary-200" aria-hidden="true">
                                                {activeOrder === "asc" ? "↑" : "↓"}
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
                                className={`shrink-0 border px-3 py-1.5 text-sm transition-colors ${
                                    activeLetter === "all"
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
                                    className={`h-9 min-w-9 shrink-0 border px-3 text-sm transition-colors ${
                                        activeLetter === letter
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
                <div
                    ref={gridRef}
                    aria-busy={isApplyingFilters}
                    // Three across on a phone rather than four: at four columns a tile is ~95px
                    // wide and almost every species name truncates to two words.
                    className="grid grid-cols-3 gap-0 overflow-hidden bg-black sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
                >
                    {entries.map((entry, index) => (
                        <Link
                            key={entry.slug}
                            href={`/animals/${entry.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block bg-black focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary-200"
                            aria-label={`${copy.readSpecies}: ${entry.name}`}
                        >
                            <CatalogGlyphThumbnail
                                entry={entry}
                                animalDexNumber={getAnimalDexNumberFromEntry(entry)}
                                captured={capturedState[entry.slug] ?? false}
                                imageSrc={speciesImageState[entry.slug]}
                                hasPublicCapture={publicCaptureState[entry.slug] ?? false}
                                // Eight columns on desktop means ~24 tiles sit above the fold, not 12.
                                priority={index < ABOVE_FOLD_TILES}
                                statKey={thumbnailStatKey}
                                showBattleTier={activeTier !== "all"}
                            />
                        </Link>
                    ))}
                    {isApplyingFilters
                        ? Array.from({length: 16}, (_, index) => <CatalogSkeletonTile key={`pending-${index}`} />)
                        : null}
                </div>
            ) : (
                <div className="border border-line-300 bg-surface-900/80 backdrop-blur p-8 md:p-10 text-center flex flex-col gap-3">
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

            {entries.length > 0 && pageCount > 1 ? (
                <nav aria-label={copy.paginationLabel} className="flex items-center justify-center gap-1 border-t border-line-300 pt-6">
                    <PageChevron
                        direction="previous"
                        label={copy.paginationPrevious}
                        disabled={page <= 1 || isApplyingFilters}
                        onClick={() => goToPage(page - 1)}
                    />

                    <ol className="flex items-center gap-1">
                        {buildPageWindow(page, pageCount).map((entryPage, index) => (
                            entryPage === null ? (
                                <li key={`gap-${index}`} aria-hidden="true" className="px-1.5 text-sm text-ink-400">…</li>
                            ) : (
                                <li key={entryPage}>
                                    <button
                                        type="button"
                                        onClick={() => goToPage(entryPage)}
                                        aria-current={entryPage === page ? "page" : undefined}
                                        disabled={isApplyingFilters}
                                        className={`inline-flex h-10 min-w-10 items-center justify-center px-3 font-mono text-sm tabular-nums transition-colors disabled:cursor-not-allowed ${
                                            entryPage === page
                                                ? "border border-primary-400 bg-primary-400/12 font-bold text-white"
                                                : "border border-line-300 text-ink-200 hover:border-primary-500/45 hover:text-white"
                                        }`}
                                    >
                                        {entryPage}
                                    </button>
                                </li>
                            )
                        ))}
                    </ol>

                    <PageChevron
                        direction="next"
                        label={copy.paginationNext}
                        disabled={page >= pageCount || isApplyingFilters}
                        onClick={() => goToPage(page + 1)}
                    />

                    <p aria-live="polite" className="sr-only">
                        {copy.paginationPage.replace("{page}", String(page)).replace("{total}", String(pageCount))}
                    </p>
                </nav>
            ) : null}

            {loadError ? (
                <p className="text-center text-sm font-semibold text-primary-200">{loadError}</p>
            ) : null}
        </div>
    );
}
