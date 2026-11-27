"use client";

import {CATALOG_WORDS_EN, fillCatalogWords, type CollectionCatalogWords} from "@/lib/collection-catalog-words";
import {type ReactNode, useEffect, useMemo, useRef, useState} from "react";
import {SHOWS_BATTLE_TIER_AND_POWER} from "@/lib/battle-visibility";
import {useCompanions} from "@/components/companions/use-companions";
import {ownCardLevel} from "@/lib/companion-bond";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {canonicalPowerKey, displayPowerLabel} from "@/lib/power-set-tags";
import {formatAnimalDexNumber} from "@/lib/animaldex-number";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import type {CollectionDiscoveryStats} from "@/lib/collection-discovery";
import CollectionSystemDynamics, {
    FREQUENCY_FILTER_OPTIONS,
    type SystemDynamicsFrequencyFilter
} from "@/app/[locale]/(authenticated)/app/collection/collection-system-dynamics";

export type CatalogSpecies = {
    slug: string;
    name: string;
    scientificName: string;
    category: string;
    number: number;
    rarity: number;
    gameStats: Record<string, number> | null;
    principle: string;
    catalogLesson: string | null;
    lesson: string;
    powers: string[];
    captured: boolean;
    captureId: string | null;
    capturedAt: string | null;
    score: number | null;
    context: string | null;
    imageSrc: string;
    hasIndexNumber?: boolean;
    identityKind: string | null;
    isBreed: boolean;
    isLegendary: boolean;
    legendaryTier: "S" | null;
};

/** `binders`: the binders, folded into the Catalog as a filter (docs/companion-loop/SPEC.md, phase 4). */
export type ContentMode = "animals" | "powers" | "lessons" | "systemDynamics" | "binders";
type Ownership = "all" | "discovered" | "undiscovered";
type Indexing = "all" | "indexed" | "unindexed";
type SpeciesFilter = "allSpecies" | "breedsOnly";
type Layout = "grid" | "list";
type AnimalSort = "dateNewest" | "number" | "rarity" | "dominance" | "speed" | "size" | "intelligence" | "name";
type PowerSort = "alphabetical" | "mostLinked";
type LessonSort = "alphabetical" | "indexNumber";

type CatalogFilters = {
    contentMode: ContentMode;
    ownership: Ownership;
    indexing: Indexing;
    speciesFilter: SpeciesFilter;
    animalSort: AnimalSort;
    powerSort: PowerSort;
    lessonSort: LessonSort;
    frequencyFilter: SystemDynamicsFrequencyFilter;
};

const DEFAULT_FILTERS: CatalogFilters = {
    contentMode: "animals",
    ownership: "all",
    indexing: "all",
    speciesFilter: "allSpecies",
    animalSort: "number",
    powerSort: "mostLinked",
    lessonSort: "alphabetical",
    frequencyFilter: "all"
};

const ANIMAL_BATCH_SIZE = 40;
const FACET_BATCH_SIZE = 24;

type Word = keyof CollectionCatalogWords;

const OWNERSHIP_OPTIONS: Array<{id: Ownership; label: Word}> = [
    {id: "all", label: "optionAll"},
    {id: "discovered", label: "optionDiscovered"},
    {id: "undiscovered", label: "optionUndiscovered"}
];

const INDEXING_OPTIONS: Array<{id: Indexing; label: Word}> = [
    {id: "all", label: "optionAll"},
    {id: "indexed", label: "optionIndexed"},
    {id: "unindexed", label: "optionUnindexed"}
];

const SPECIES_OPTIONS: Array<{id: SpeciesFilter; label: Word}> = [
    {id: "allSpecies", label: "optionAllSpecies"},
    {id: "breedsOnly", label: "optionBreedsOnly"}
];

const CONTENT_MODE_OPTIONS: Array<{id: ContentMode; label: Word}> = [
    {id: "animals", label: "modeAnimals"},
    {id: "powers", label: "modePowers"},
    {id: "lessons", label: "modeLessons"},
    {id: "systemDynamics", label: "modeSystemDynamics"},
    {id: "binders", label: "binders"}
];

const ANIMAL_SORT_OPTIONS: Array<{id: AnimalSort; title: Word; detail: Word}> = [
    {id: "dateNewest", title: "sortNewest", detail: "sortNewestNote"},
    {id: "number", title: "sortNumber", detail: "sortNumberNote"},
    {id: "rarity", title: "sortRarity", detail: "sortRarityNote"},
    {id: "dominance", title: "sortDominance", detail: "sortDominanceNote"},
    {id: "speed", title: "sortSpeed", detail: "sortSpeedNote"},
    {id: "size", title: "sortSize", detail: "sortSizeNote"},
    {id: "intelligence", title: "sortIntelligence", detail: "sortIntelligenceNote"},
    {id: "name", title: "sortAlphabetical", detail: "sortNameNote"}
];

const POWER_SORT_OPTIONS: Array<{id: PowerSort; title: Word; detail: Word}> = [
    {id: "alphabetical", title: "sortAlphabetical", detail: "sortTagsNote"},
    {id: "mostLinked", title: "sortMostLinked", detail: "sortMostLinkedNote"}
];

const LESSON_SORT_OPTIONS: Array<{id: LessonSort; title: Word; detail: Word}> = [
    {id: "alphabetical", title: "sortAlphabetical", detail: "sortLessonsNote"},
    {id: "indexNumber", title: "sortIndexNumber", detail: "sortIndexNumberNote"}
];

function normalizedSearchText(value: string) {
    return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function matchesSearch(item: CatalogSpecies, query: string) {
    const normalizedQuery = normalizedSearchText(query);
    if (!normalizedQuery) return true;

    const fields = [
        item.name,
        item.scientificName,
        item.category,
        item.principle,
        item.catalogLesson,
        item.lesson,
        ...item.powers
    ]
        .filter((field): field is string => Boolean(field))
        .map(normalizedSearchText);

    if (fields.some((field) => field.includes(normalizedQuery))) {
        return true;
    }

    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    if (tokens.length <= 1) return false;

    const primaryTokens = normalizedSearchText(item.name).split(/\s+/).filter(Boolean);
    let tokenIndex = 0;

    for (const token of tokens) {
        let matched = false;
        while (tokenIndex < primaryTokens.length) {
            if (primaryTokens[tokenIndex].startsWith(token)) {
                matched = true;
                tokenIndex += 1;
                break;
            }
            tokenIndex += 1;
        }
        if (!matched) return false;
    }

    return true;
}

function matchesDiscoveryFilter(item: CatalogSpecies, filters: CatalogFilters) {
    const matchesOwnership = filters.ownership === "all"
        || (filters.ownership === "discovered" ? item.captured : !item.captured);

    const matchesIndexing = filters.indexing === "all"
        || (filters.indexing === "indexed" ? item.hasIndexNumber : !item.hasIndexNumber);

    const matchesSpecies = filters.speciesFilter === "allSpecies"
        || (filters.speciesFilter === "breedsOnly" && item.isBreed);

    return matchesOwnership && matchesIndexing && matchesSpecies;
}

function compareByNumber(lhs: CatalogSpecies, rhs: CatalogSpecies) {
    if (lhs.hasIndexNumber && rhs.hasIndexNumber && lhs.number !== rhs.number) {
        return lhs.number - rhs.number;
    }
    if (lhs.hasIndexNumber !== rhs.hasIndexNumber) {
        return lhs.hasIndexNumber ? -1 : 1;
    }
    return lhs.name.localeCompare(rhs.name) || lhs.slug.localeCompare(rhs.slug);
}

function compareByStat(lhs: CatalogSpecies, rhs: CatalogSpecies, key: string) {
    const left = lhs.gameStats?.[key] ?? -1;
    const right = rhs.gameStats?.[key] ?? -1;
    if (left !== right) return right - left;
    return compareByNumber(lhs, rhs);
}

function sortAnimals(items: CatalogSpecies[], sort: AnimalSort) {
    const sorted = [...items];

    if (sort === "dateNewest") {
        const captured = sorted.filter((item) => item.capturedAt);
        const uncaptured = sorted.filter((item) => !item.capturedAt);

        captured.sort((lhs, rhs) => {
            const left = new Date(lhs.capturedAt!).getTime();
            const right = new Date(rhs.capturedAt!).getTime();
            if (left !== right) return right - left;
            return compareByNumber(lhs, rhs);
        });
        uncaptured.sort(compareByNumber);
        return [...captured, ...uncaptured];
    }

    sorted.sort((lhs, rhs) => {
        switch (sort) {
        case "name":
            return lhs.name.localeCompare(rhs.name) || compareByNumber(lhs, rhs);
        case "rarity":
            return compareByStat(lhs, rhs, "rarity");
        case "dominance":
            return compareByStat(lhs, rhs, "dominance");
        case "speed":
            return compareByStat(lhs, rhs, "speed");
        case "size":
            return compareByStat(lhs, rhs, "size");
        case "intelligence":
            return compareByStat(lhs, rhs, "intelligence");
        default:
            return compareByNumber(lhs, rhs);
        }
    });

    return sorted;
}

function hasActiveFilters(filters: CatalogFilters, appliedQuery: string) {
    if (filters.contentMode !== "animals") {
        return true;
    }

    const hasQuery = appliedQuery.trim().length > 0;

    return hasQuery
        || filters.ownership !== "all"
        || filters.indexing !== "all"
        || filters.speciesFilter !== "allSpecies"
        || filters.animalSort !== "number";
}

function countPendingChanges(
    pendingQuery: string,
    appliedQuery: string,
    pending: CatalogFilters,
    applied: CatalogFilters
) {
    let count = 0;
    if (pendingQuery.trim() !== appliedQuery.trim()) count += 1;
    if (pending.contentMode !== applied.contentMode) count += 1;
    if (pending.frequencyFilter !== applied.frequencyFilter) count += 1;
    if (pending.ownership !== applied.ownership) count += 1;
    if (pending.indexing !== applied.indexing) count += 1;
    if (pending.speciesFilter !== applied.speciesFilter) count += 1;
    if (pending.animalSort !== applied.animalSort) count += 1;
    if (pending.powerSort !== applied.powerSort) count += 1;
    if (pending.lessonSort !== applied.lessonSort) count += 1;
    return count;
}

function FilterChip({title, selected, onClick}: {title: string; selected: boolean; onClick: () => void}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`border px-3 py-2.5 text-sm font-bold transition ${selected ? "border-primary-400 bg-primary-400 text-black" : "border-white/10 bg-white/[0.03] text-white hover:border-white/20"}`}
        >
            {title}
        </button>
    );
}

function SortOption<T extends string>({id, title, detail, selected, onSelect}: {id: T; title: string; detail: string; selected: boolean; onSelect: (id: T) => void}) {
    return (
        <button
            type="button"
            onClick={() => onSelect(id)}
            className={`flex w-full items-start gap-3 border px-3.5 py-3 text-left transition ${selected ? "border-primary-400/35 bg-white/[0.06]" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}
        >
            <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-white">{title}</p>
                <p className="mt-0.5 text-xs text-white/45">{detail}</p>
            </div>
            {selected ? <AppIcon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" /> : null}
        </button>
    );
}

/** The grid's own words (`appCollection`, lib/collection-catalog-words), English by default. */
export type {CollectionCatalogWords};

/**
 * A species not found yet is its silhouette art on the canvas (iOS IOS-21,
 * d1fa2511), never a greyed-out photo, so the grid reads as one set.
 */
function SpeciesSilhouette({slug}: {slug: string}) {
    const url = `url(${getSpeciesArtworkRoute(slug)})`;
    return (
        <span
            aria-hidden="true"
            className="absolute inset-[18%] block bg-white/[0.16]"
            style={{maskImage: url, WebkitMaskImage: url, maskPosition: "center", WebkitMaskPosition: "center", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskSize: "contain", WebkitMaskSize: "contain"}}
        />
    );
}

export default function CollectionCatalog({
    species,
    discoveryStats,
    bindersPanel = null,
    initialContentMode = "animals",
    onContentModeChange,
    words = CATALOG_WORDS_EN
}: {
    species: CatalogSpecies[];
    discoveryStats: CollectionDiscoveryStats;
    /** The binders, shown when the Binders filter is on. Absent hides the filter. */
    bindersPanel?: ReactNode;
    initialContentMode?: ContentMode;
    onContentModeChange?: (mode: ContentMode) => void;
    words?: CollectionCatalogWords;
}) {
    const [query, setQuery] = useState("");
    const [appliedQuery, setAppliedQuery] = useState("");
    const [appliedFilters, setAppliedFilters] = useState<CatalogFilters>(() => ({...DEFAULT_FILTERS, contentMode: initialContentMode}));
    const [pendingFilters, setPendingFilters] = useState<CatalogFilters>(() => ({...DEFAULT_FILTERS, contentMode: initialContentMode}));
    useEffect(() => {
        setAppliedFilters((current) => current.contentMode === initialContentMode ? current : {...current, contentMode: initialContentMode});
    }, [initialContentMode]);
    // Each caught animal shows its bond level: one level per animal.
    const companions = useCompanions();
    // 0 when the bond is not known: the tile then shows no level.
    const levelFor = (slug: string) => ownCardLevel(companions.rows, {speciesSlug: slug}, 0);
    const contentModeOptions = bindersPanel ? CONTENT_MODE_OPTIONS : CONTENT_MODE_OPTIONS.filter((option) => option.id !== "binders");
    const [layout, setLayout] = useState<Layout>("grid");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [visibleAnimalCount, setVisibleAnimalCount] = useState(ANIMAL_BATCH_SIZE);
    const [visiblePowerCount, setVisiblePowerCount] = useState(FACET_BATCH_SIZE);
    const [visibleLessonCount, setVisibleLessonCount] = useState(FACET_BATCH_SIZE);
    const [systemDynamicsCount, setSystemDynamicsCount] = useState(0);
    const animalSentinelRef = useRef<HTMLDivElement | null>(null);
    const powerSentinelRef = useRef<HTMLDivElement | null>(null);
    const lessonSentinelRef = useRef<HTMLDivElement | null>(null);

    const indexedCount = discoveryStats.indexed;
    const breedCount = discoveryStats.breeds;
    const discovered = discoveryStats.found;
    const remaining = discoveryStats.remaining;
    const indexedEntries = useMemo(
        () => species.filter((item) => item.hasIndexNumber && !item.isBreed),
        [species]
    );

    const filteredAnimals = useMemo(() => {
        const items = species
            .filter((item) => matchesDiscoveryFilter(item, appliedFilters))
            .filter((item) => matchesSearch(item, appliedQuery));

        return sortAnimals(items, appliedFilters.animalSort);
    }, [species, appliedFilters, appliedQuery]);

    const powerFacets = useMemo(() => {
        const counts = new Map<string, {name: string; count: number; found: number}>();
        const queryKey = normalizedSearchText(appliedQuery);

        for (const item of indexedEntries) {
            const keys = Array.from(new Set(item.powers.map(canonicalPowerKey).filter(Boolean)));
            if (!keys.length) continue;
            for (const key of keys) {
                const name = displayPowerLabel(key);
                if (queryKey && !normalizedSearchText(name).includes(queryKey)) continue;
                const current = counts.get(key) ?? {name, count: 0, found: 0};
                current.count += 1;
                current.found += item.captured ? 1 : 0;
                counts.set(key, current);
            }
        }

        const facets = Array.from(counts.entries()).map(([key, value]) => ({key, ...value}));
        facets.sort((lhs, rhs) => {
            if (appliedFilters.powerSort === "alphabetical") {
                return lhs.name.localeCompare(rhs.name);
            }
            if (lhs.count !== rhs.count) return rhs.count - lhs.count;
            return lhs.name.localeCompare(rhs.name);
        });
        return facets;
    }, [indexedEntries, appliedFilters, appliedQuery]);

    const lessonFacets = useMemo(() => {
        const aggregates = new Map<string, {name: string; count: number; found: number; minIndex: number | null}>();
        const queryKey = normalizedSearchText(appliedQuery);

        for (const item of indexedEntries) {
            const name = item.catalogLesson?.trim();
            if (!name) continue;
            if (queryKey && !normalizedSearchText(name).includes(queryKey)) continue;

            const current = aggregates.get(name) ?? {name, count: 0, found: 0, minIndex: null};
            current.count += 1;
            current.found += item.captured ? 1 : 0;
            if (item.hasIndexNumber) {
                current.minIndex = current.minIndex == null ? item.number : Math.min(current.minIndex, item.number);
            }
            aggregates.set(name, current);
        }

        const facets = Array.from(aggregates.values());
        facets.sort((lhs, rhs) => {
            if (appliedFilters.lessonSort === "alphabetical") {
                return lhs.name.localeCompare(rhs.name);
            }
            const leftIndex = lhs.minIndex;
            const rightIndex = rhs.minIndex;
            if (leftIndex != null && rightIndex != null && leftIndex !== rightIndex) {
                return leftIndex - rightIndex;
            }
            if (leftIndex != null && rightIndex == null) return -1;
            if (leftIndex == null && rightIndex != null) return 1;
            return lhs.name.localeCompare(rhs.name);
        });
        return facets;
    }, [indexedEntries, appliedFilters, appliedQuery]);

    const activeFilters = hasActiveFilters(appliedFilters, appliedQuery);
    const pendingChangeCount = countPendingChanges(query, appliedQuery, pendingFilters, appliedFilters);
    const hasPendingChanges = pendingChangeCount > 0;
    const visibleAnimals = useMemo(() => filteredAnimals.slice(0, visibleAnimalCount), [filteredAnimals, visibleAnimalCount]);
    const visiblePowerFacets = useMemo(() => powerFacets.slice(0, visiblePowerCount), [powerFacets, visiblePowerCount]);
    const visibleLessonFacets = useMemo(() => lessonFacets.slice(0, visibleLessonCount), [lessonFacets, visibleLessonCount]);
    const hasMoreAnimals = visibleAnimalCount < filteredAnimals.length;
    const hasMorePowers = visiblePowerCount < powerFacets.length;
    const hasMoreLessons = visibleLessonCount < lessonFacets.length;

    const searchPlaceholder = appliedFilters.contentMode === "animals"
        ? words.searchAnimals
        : appliedFilters.contentMode === "powers"
            ? words.searchPowers
            : appliedFilters.contentMode === "systemDynamics"
                ? words.searchSystems
                : words.searchLessons;

    const matchedSummary = appliedFilters.contentMode === "animals"
        ? appliedFilters.indexing === "all"
            ? fillCatalogWords(words.matchedAll, {indexed: filteredAnimals.filter((item) => item.hasIndexNumber).length, unindexed: filteredAnimals.filter((item) => !item.hasIndexNumber).length, captured: filteredAnimals.filter((item) => item.captured).length})
            : fillCatalogWords(words.matchedCount, {n: filteredAnimals.length})
        : appliedFilters.contentMode === "powers"
            ? fillCatalogWords(words.matchedPowers, {powers: powerFacets.length, animals: species.length})
            : appliedFilters.contentMode === "systemDynamics"
                ? fillCatalogWords(words.matchedSystems, {n: systemDynamicsCount})
                : appliedFilters.contentMode === "binders"
                    ? ""
                    : fillCatalogWords(words.matchedLessons, {lessons: lessonFacets.length, animals: species.length});

    function openFilters() {
        setPendingFilters(appliedFilters);
        setQuery((current) => current || appliedQuery);
        setFiltersOpen(true);
    }

    function applyPendingFilters() {
        setAppliedFilters(pendingFilters);
        if (pendingFilters.contentMode !== appliedFilters.contentMode) onContentModeChange?.(pendingFilters.contentMode);
        setAppliedQuery(query.trim());
        setFiltersOpen(false);
    }

    function resetPendingFilters() {
        setQuery("");
        setPendingFilters(DEFAULT_FILTERS);
    }

    useEffect(() => {
        if (!filtersOpen) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [filtersOpen]);

    useEffect(() => {
        setVisibleAnimalCount(ANIMAL_BATCH_SIZE);
        setVisiblePowerCount(FACET_BATCH_SIZE);
        setVisibleLessonCount(FACET_BATCH_SIZE);
    }, [appliedFilters, appliedQuery, layout]);

    useEffect(() => {
        if (appliedFilters.contentMode !== "animals" || !hasMoreAnimals) return undefined;
        const node = animalSentinelRef.current;
        if (!node) return undefined;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setVisibleAnimalCount((current) => Math.min(current + ANIMAL_BATCH_SIZE, filteredAnimals.length));
            }
        }, {rootMargin: "700px 0px"});
        observer.observe(node);
        return () => observer.disconnect();
    }, [appliedFilters.contentMode, hasMoreAnimals, filteredAnimals.length]);

    useEffect(() => {
        if (appliedFilters.contentMode !== "powers" || !hasMorePowers) return undefined;
        const node = powerSentinelRef.current;
        if (!node) return undefined;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setVisiblePowerCount((current) => Math.min(current + FACET_BATCH_SIZE, powerFacets.length));
            }
        }, {rootMargin: "700px 0px"});
        observer.observe(node);
        return () => observer.disconnect();
    }, [appliedFilters.contentMode, hasMorePowers, powerFacets.length]);

    useEffect(() => {
        if (appliedFilters.contentMode !== "lessons" || !hasMoreLessons) return undefined;
        const node = lessonSentinelRef.current;
        if (!node) return undefined;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setVisibleLessonCount((current) => Math.min(current + FACET_BATCH_SIZE, lessonFacets.length));
            }
        }, {rootMargin: "700px 0px"});
        observer.observe(node);
        return () => observer.disconnect();
    }, [appliedFilters.contentMode, hasMoreLessons, lessonFacets.length]);

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-white/45">
                <span>{fillCatalogWords(words.catalogSummary, {indexed: indexedCount, breeds: breedCount, found: discovered, left: remaining})}</span>
                <span>
                    {appliedFilters.contentMode === "animals"
                        ? fillCatalogWords(words.shownAnimals, {n: filteredAnimals.length})
                        : appliedFilters.contentMode === "powers"
                            ? fillCatalogWords(words.shownPowers, {n: powerFacets.length})
                            : appliedFilters.contentMode === "systemDynamics"
                                ? fillCatalogWords(words.shownSystems, {n: systemDynamicsCount})
                                : appliedFilters.contentMode === "binders"
                                    ? words.binders
                                    : fillCatalogWords(words.shownLessons, {n: lessonFacets.length})}
                </span>
            </div>

            <div className="sticky top-0 z-20 space-y-3 border border-white/[0.08] bg-[#0d0d0d]/90 p-3 backdrop-blur-xl lg:bg-[#121212]/90">
                <label className="flex items-center gap-3 border border-white/10 bg-black/50 px-4 py-3 focus-within:border-primary-400/40">
                    <AppIcon name="search" className="h-5 w-5 shrink-0 text-white/35" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                setAppliedQuery(query.trim());
                            }
                        }}
                        className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                        placeholder={searchPlaceholder}
                    />
                    {query ? (
                        <button type="button" onClick={() => setQuery("")} aria-label={words.clearSearch}>
                            <AppIcon name="close" className="h-4 w-4 text-white/35" />
                        </button>
                    ) : null}
                </label>

                <p className="text-xs text-white/40">{matchedSummary}</p>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={openFilters}
                        className={`flex min-h-11 flex-1 items-center gap-2 border px-4 py-3 text-sm font-black transition ${activeFilters ? "border-primary-400 bg-primary-400 text-black" : "border-white/10 bg-black/40 text-white"}`}
                    >
                        <AppIcon name="filter" />
                        {words.filters}
                        {activeFilters ? <span className="ml-auto h-2 w-2 rounded-full bg-black" /> : null}
                    </button>
                    {appliedFilters.contentMode === "animals" ? (
                        <div className="flex border border-white/10 bg-black/40 p-1">
                            {(["grid", "list"] as Layout[]).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    aria-label={item === "grid" ? words.layoutGrid : words.layoutList}
                                    onClick={() => setLayout(item)}
                                    className={`p-2.5 transition ${layout === item ? "bg-primary-400 text-black" : "text-white/45 hover:text-white"}`}
                                >
                                    <AppIcon name={item} />
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>

            {filtersOpen ? (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 sm:justify-end sm:p-5 sm:pt-24">
                    <button
                        type="button"
                        aria-label={words.closeFilters}
                        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
                        onClick={() => setFiltersOpen(false)}
                    />
                    <div className="relative z-10 flex max-h-[min(80vh,520px)] w-full max-w-md flex-col overflow-hidden border border-white/10 bg-[#0d0d0d] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.95)]">
                        <div className="overflow-y-auto p-5">
                            <h2 className="font-display text-lg font-bold text-white">{words.catalogFilters}</h2>

                            <button
                                type="button"
                                disabled={!hasPendingChanges}
                                onClick={applyPendingFilters}
                                className={`mt-4 flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-black transition ${hasPendingChanges ? "bg-primary-400 text-black" : "cursor-not-allowed bg-white/[0.04] text-white/35"}`}
                            >
                                <AppIcon name="search" className="h-4 w-4" />
                                {fillCatalogWords(words.applyChanges, {n: pendingChangeCount})}
                            </button>

                            <div className="mt-5 space-y-2">
                                <p className="text-xs font-black uppercase tracking-wider text-white/35">{words.show}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {contentModeOptions.map((option) => (
                                        <FilterChip
                                            key={option.id}
                                            title={words[option.label]}
                                            selected={pendingFilters.contentMode === option.id}
                                            onClick={() => setPendingFilters((current) => ({...current, contentMode: option.id}))}
                                        />
                                    ))}
                                </div>
                            </div>

                            {pendingFilters.contentMode === "animals" ? (
                                <>
                                    <div className="mt-5 space-y-2">
                                        <p className="text-xs font-black uppercase tracking-wider text-white/35">{words.capturedStatus}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {OWNERSHIP_OPTIONS.map((option) => (
                                                <FilterChip
                                                    key={option.id}
                                                    title={words[option.label]}
                                                    selected={pendingFilters.ownership === option.id}
                                                    onClick={() => setPendingFilters((current) => ({...current, ownership: option.id}))}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-5 space-y-2">
                                        <p className="text-xs font-black uppercase tracking-wider text-white/35">{words.indexScope}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {INDEXING_OPTIONS.map((option) => (
                                                <FilterChip
                                                    key={option.id}
                                                    title={words[option.label]}
                                                    selected={pendingFilters.indexing === option.id}
                                                    onClick={() => setPendingFilters((current) => ({...current, indexing: option.id}))}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-5 space-y-2">
                                        <p className="text-xs font-black uppercase tracking-wider text-white/35">{words.animalType}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {SPECIES_OPTIONS.map((option) => (
                                                <FilterChip
                                                    key={option.id}
                                                    title={words[option.label]}
                                                    selected={pendingFilters.speciesFilter === option.id}
                                                    onClick={() => setPendingFilters((current) => ({...current, speciesFilter: option.id}))}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-5 space-y-2">
                                        <p className="text-xs font-black uppercase tracking-wider text-white/35">{words.sortBy}</p>
                                        <div className="space-y-2">
                                            {ANIMAL_SORT_OPTIONS.map((option) => (
                                                <SortOption
                                                    key={option.id}
                                                    id={option.id}
                                                    title={words[option.title]}
                                                    detail={words[option.detail]}
                                                    selected={pendingFilters.animalSort === option.id}
                                                    onSelect={(animalSort) => setPendingFilters((current) => ({...current, animalSort}))}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : pendingFilters.contentMode === "systemDynamics" ? (
                                <div className="mt-5 space-y-2">
                                    <p className="text-xs font-black uppercase tracking-wider text-white/35">{words.frequency}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {FREQUENCY_FILTER_OPTIONS.map((option) => (
                                            <FilterChip
                                                key={option.id}
                                                title={option.label}
                                                selected={pendingFilters.frequencyFilter === option.id}
                                                onClick={() => setPendingFilters((current) => ({...current, frequencyFilter: option.id}))}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ) : pendingFilters.contentMode === "powers" ? (
                                <div className="mt-5 space-y-2">
                                    <p className="text-xs font-black uppercase tracking-wider text-white/35">{words.sortPowersBy}</p>
                                    <div className="space-y-2">
                                        {POWER_SORT_OPTIONS.map((option) => (
                                            <SortOption
                                                key={option.id}
                                                id={option.id}
                                                title={words[option.title]}
                                                detail={words[option.detail]}
                                                selected={pendingFilters.powerSort === option.id}
                                                onSelect={(powerSort) => setPendingFilters((current) => ({...current, powerSort}))}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ) : pendingFilters.contentMode === "binders" ? null : (
                                <div className="mt-5 space-y-2">
                                    <p className="text-xs font-black uppercase tracking-wider text-white/35">{words.sortLessonsBy}</p>
                                    <div className="space-y-2">
                                        {LESSON_SORT_OPTIONS.map((option) => (
                                            <SortOption
                                                key={option.id}
                                                id={option.id}
                                                title={words[option.title]}
                                                detail={words[option.detail]}
                                                selected={pendingFilters.lessonSort === option.id}
                                                onSelect={(lessonSort) => setPendingFilters((current) => ({...current, lessonSort}))}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(activeFilters || hasPendingChanges) ? (
                                <button
                                    type="button"
                                    onClick={resetPendingFilters}
                                    className="mt-5 text-sm font-black text-primary-400"
                                >
                                    {words.clearAllFilters}
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}

            {appliedFilters.contentMode === "binders" ? (
                bindersPanel
            ) : appliedFilters.contentMode === "animals" ? (
                <>
                    {filteredAnimals.length === 0 ? (
                        // iOS "No species match this view.", with a way back to all of them.
                        <div className="relative overflow-hidden border-y border-white/[0.08] bg-[linear-gradient(135deg,rgba(167,244,50,.055),rgba(148,84,250,.025),transparent)] px-5 py-6" data-testid="collection-no-matches">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary-400">{words.noMatchesEyebrow}</p>
                            <p className="mt-2.5 font-display text-2xl font-black text-white">{words.noMatchesTitle}</p>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">{words.noMatchesDetail}</p>
                            <button
                                type="button"
                                onClick={() => {
                                    setQuery("");
                                    setAppliedQuery("");
                                    setPendingFilters(DEFAULT_FILTERS);
                                    setAppliedFilters({...DEFAULT_FILTERS, contentMode: appliedFilters.contentMode});
                                }}
                                className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-black text-primary-400"
                            >
                                {words.resetView} <span aria-hidden="true">→</span>
                            </button>
                        </div>
                    ) : null}
                    <div className={layout === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" : "space-y-3"}>
                        {visibleAnimals.map((item) => (
                            <Link
                                key={item.slug}
                                // The in-app species page, caught or not (iOS
                                // AnimalDexSpeciesDetailView), not the public one.
                                href={`/app/collection/species/${item.slug}`}
                                className={`group overflow-hidden border shadow-[0_16px_40px_-30px_rgba(0,0,0,0.95)] transition hover:-translate-y-0.5 hover:border-primary-400/35 ${item.captured ? "border-white/10 bg-[#121212]" : "border-white/[0.06] bg-[#101010]"} ${layout === "list" ? "flex items-center" : "block"}`}
                            >
                                <div className={`relative overflow-hidden bg-white/[0.03] ${layout === "list" ? "h-28 w-28 shrink-0" : "aspect-square"}`}>
                                    {item.captured
                                        ? <img src={item.imageSrc} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                                        : <SpeciesSilhouette slug={item.slug} />}
                                    {item.hasIndexNumber ? <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[0.62rem] font-black tabular-nums text-primary-200">{formatAnimalDexNumber(item.number)}</span> : <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white/45">{words.newBadge}</span>}
                                    {item.isLegendary ? (
                                        <span className="absolute bottom-2 left-2 right-2 truncate rounded-full border border-amber-400/35 bg-amber-400/90 px-2 py-1 text-center text-[0.58rem] font-black uppercase tracking-[0.08em] text-black">
                                            {SHOWS_BATTLE_TIER_AND_POWER ? words.legendaryTier : words.legendary}
                                        </span>
                                    ) : null}
                                    {item.score !== null ? <span className="absolute right-2 top-2 rounded-full bg-primary-400 px-2 py-1 text-[0.62rem] font-black text-black">{item.score}</span> : null}
                                    {item.captured && levelFor(item.slug) > 0 ? (
                                        // Its bond level: a small number, read out as "Level {n}".
                                        <span
                                            aria-label={fillCatalogWords(words.level, {n: levelFor(item.slug)})}
                                            className="absolute bottom-2 right-2 grid h-6 min-w-6 place-items-center rounded-full border border-primary-400/40 bg-black/75 px-1.5 text-[0.65rem] font-black tabular-nums text-primary-200"
                                        >
                                            {levelFor(item.slug)}
                                        </span>
                                    ) : null}
                                </div>
                                <div className="min-w-0 p-3.5">
                                    <h2 className="truncate font-display text-lg font-bold text-white">{item.name}</h2>
                                    <p className="mt-1 truncate text-xs italic text-white/35">{item.scientificName}</p>
                                    <div className="mt-3 flex items-center justify-between gap-2">
                                        <span className="truncate text-[0.62rem] font-black uppercase tracking-wider text-primary-200/75">{item.principle}</span>
                                        <span className="text-[0.62rem] font-bold text-white/25">R{item.gameStats?.rarity ?? item.rarity}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                    {hasMoreAnimals ? (
                        <div ref={animalSentinelRef} className="flex justify-center py-3">
                            <button
                                type="button"
                                onClick={() => setVisibleAnimalCount((current) => Math.min(current + ANIMAL_BATCH_SIZE, filteredAnimals.length))}
                                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/50 transition hover:border-white/20 hover:text-white"
                            >
                                {words.loadMoreAnimals}
                            </button>
                        </div>
                    ) : null}
                </>
            ) : appliedFilters.contentMode === "systemDynamics" ? (
                <CollectionSystemDynamics
                    query={appliedQuery}
                    frequencyFilter={appliedFilters.frequencyFilter}
                    onCountChange={setSystemDynamicsCount}
                />
            ) : appliedFilters.contentMode === "powers" ? (
                <>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visiblePowerFacets.map((facet) => {
                        const percent = facet.count ? Math.round(facet.found / facet.count * 100) : 0;
                        return (
                            <AppSurface key={facet.key}>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[0.65rem] font-black uppercase tracking-wider text-primary-200">{words.animalPower}</p>
                                        <h2 className="mt-2 font-display text-xl font-bold">{facet.name}</h2>
                                    </div>
                                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-white/45">{fillCatalogWords(words.animalsCount, {n: facet.count})}</span>
                                </div>
                                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                                    <div className="h-full rounded-full bg-primary-400 transition-all duration-500" style={{width: `${percent}%`}} />
                                </div>
                                <div className="mt-2 flex justify-between text-xs text-white/35">
                                    <span>{fillCatalogWords(words.foundCount, {n: facet.found})}</span>
                                    <span>{percent}%</span>
                                </div>
                            </AppSurface>
                        );
                    })}
                    </div>
                    {hasMorePowers ? (
                        <div ref={powerSentinelRef} className="flex justify-center py-3">
                            <button
                                type="button"
                                onClick={() => setVisiblePowerCount((current) => Math.min(current + FACET_BATCH_SIZE, powerFacets.length))}
                                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/50 transition hover:border-white/20 hover:text-white"
                            >
                                {words.loadMorePowers}
                            </button>
                        </div>
                    ) : null}
                </>
            ) : (
                <>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visibleLessonFacets.map((facet) => {
                        const percent = facet.count ? Math.round(facet.found / facet.count * 100) : 0;
                        return (
                            <AppSurface key={facet.name}>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[0.65rem] font-black uppercase tracking-wider text-primary-200">{words.corePrinciple}</p>
                                        <h2 className="mt-2 font-display text-xl font-bold">{facet.name}</h2>
                                    </div>
                                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-white/45">{fillCatalogWords(words.animalsCount, {n: facet.count})}</span>
                                </div>
                                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                                    <div className="h-full rounded-full bg-primary-400 transition-all duration-500" style={{width: `${percent}%`}} />
                                </div>
                                <div className="mt-2 flex justify-between text-xs text-white/35">
                                    <span>{fillCatalogWords(words.foundCount, {n: facet.found})}</span>
                                    <span>{percent}%</span>
                                </div>
                            </AppSurface>
                        );
                    })}
                    </div>
                    {hasMoreLessons ? (
                        <div ref={lessonSentinelRef} className="flex justify-center py-3">
                            <button
                                type="button"
                                onClick={() => setVisibleLessonCount((current) => Math.min(current + FACET_BATCH_SIZE, lessonFacets.length))}
                                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/50 transition hover:border-white/20 hover:text-white"
                            >
                                {words.loadMoreLessons}
                            </button>
                        </div>
                    ) : null}
                </>
            )}
        </div>
    );
}
