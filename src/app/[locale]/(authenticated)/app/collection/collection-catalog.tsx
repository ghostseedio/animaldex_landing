"use client";

import {useEffect, useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {canonicalPowerKey, displayPowerLabel} from "@/lib/power-set-tags";
import {formatAnimalDexNumber} from "@/lib/animaldex-number";

export type CatalogSpecies = {
    slug: string;
    name: string;
    scientificName: string;
    category: string;
    number: number;
    rarity: number;
    gameStats: Record<string, number> | null;
    principle: string;
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
};

type ContentMode = "animals" | "powers" | "lessons";
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
};

const DEFAULT_FILTERS: CatalogFilters = {
    contentMode: "animals",
    ownership: "all",
    indexing: "all",
    speciesFilter: "allSpecies",
    animalSort: "number",
    powerSort: "mostLinked",
    lessonSort: "alphabetical"
};

const OWNERSHIP_OPTIONS: Array<{id: Ownership; label: string}> = [
    {id: "all", label: "All"},
    {id: "discovered", label: "Discovered"},
    {id: "undiscovered", label: "Undiscovered"}
];

const INDEXING_OPTIONS: Array<{id: Indexing; label: string}> = [
    {id: "all", label: "All"},
    {id: "indexed", label: "Indexed"},
    {id: "unindexed", label: "Unindexed"}
];

const SPECIES_OPTIONS: Array<{id: SpeciesFilter; label: string}> = [
    {id: "allSpecies", label: "All species"},
    {id: "breedsOnly", label: "Breeds only"}
];

const CONTENT_MODE_OPTIONS: Array<{id: ContentMode; label: string}> = [
    {id: "animals", label: "Animals"},
    {id: "powers", label: "Powers"},
    {id: "lessons", label: "Lessons"}
];

const ANIMAL_SORT_OPTIONS: Array<{id: AnimalSort; title: string; detail: string}> = [
    {id: "dateNewest", title: "Most recent capture", detail: "Shows recently captured animals first"},
    {id: "number", title: "AnimalDex number", detail: "Follows the official AnimalDex order"},
    {id: "rarity", title: "Canonical rarity", detail: "Shows the rarest canonical species first"},
    {id: "dominance", title: "Canonical dominance", detail: "Shows the strongest canonical species first"},
    {id: "speed", title: "Canonical speed", detail: "Shows the fastest canonical species first"},
    {id: "size", title: "Canonical size", detail: "Shows the largest canonical species first"},
    {id: "intelligence", title: "Canonical intelligence", detail: "Shows the smartest canonical species first"},
    {id: "name", title: "Alphabetical", detail: "Sorts by display name from A to Z"}
];

const POWER_SORT_OPTIONS: Array<{id: PowerSort; title: string; detail: string}> = [
    {id: "alphabetical", title: "Alphabetical", detail: "Sorts tags from A to Z"},
    {id: "mostLinked", title: "Most linked animals", detail: "Shows tags with the most linked animals first"}
];

const LESSON_SORT_OPTIONS: Array<{id: LessonSort; title: string; detail: string}> = [
    {id: "alphabetical", title: "Alphabetical", detail: "Sorts principle names from A to Z"},
    {id: "indexNumber", title: "Index number", detail: "Uses the lowest linked AnimalDex index"}
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
        item.lesson,
        ...item.powers
    ].map(normalizedSearchText);

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
            className={`rounded-2xl border px-3 py-2.5 text-sm font-bold transition ${selected ? "border-primary-400 bg-primary-400 text-black" : "border-white/10 bg-white/[0.03] text-white hover:border-white/20"}`}
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
            className={`flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${selected ? "border-primary-400/35 bg-white/[0.06]" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}
        >
            <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-white">{title}</p>
                <p className="mt-0.5 text-xs text-white/45">{detail}</p>
            </div>
            {selected ? <AppIcon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" /> : null}
        </button>
    );
}

export default function CollectionCatalog({species}: {species: CatalogSpecies[]}) {
    const [query, setQuery] = useState("");
    const [appliedQuery, setAppliedQuery] = useState("");
    const [appliedFilters, setAppliedFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);
    const [pendingFilters, setPendingFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);
    const [layout, setLayout] = useState<Layout>("grid");
    const [filtersOpen, setFiltersOpen] = useState(false);

    const indexedCount = species.filter((item) => item.hasIndexNumber).length;
    const breedCount = species.filter((item) => item.isBreed).length;
    const discovered = species.filter((item) => item.captured).length;
    const indexedEntries = useMemo(() => species.filter((item) => item.hasIndexNumber), [species]);

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
            const name = item.principle.trim();
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

    const searchPlaceholder = appliedFilters.contentMode === "animals"
        ? "Search species, lesson, or animal power"
        : appliedFilters.contentMode === "powers"
            ? "Search powers"
            : "Search principles";

    const matchedSummary = appliedFilters.contentMode === "animals"
        ? appliedFilters.indexing === "all"
            ? `Matched results total: ${filteredAnimals.filter((item) => item.hasIndexNumber).length} indexed · ${filteredAnimals.filter((item) => !item.hasIndexNumber).length} unindexed · ${filteredAnimals.filter((item) => item.captured).length} captured`
            : `Matched results total: ${filteredAnimals.length}`
        : appliedFilters.contentMode === "powers"
            ? `Matched results total: ${powerFacets.length} powers · ${species.length} animals`
            : `Matched results total: ${lessonFacets.length} lessons · ${species.length} animals`;

    function openFilters() {
        setPendingFilters(appliedFilters);
        setQuery((current) => current || appliedQuery);
        setFiltersOpen(true);
    }

    function applyPendingFilters() {
        setAppliedFilters(pendingFilters);
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

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-white/45">
                <span>{indexedCount} indexed · {breedCount} breeds · {discovered} found · {species.length - discovered} left</span>
                <span>
                    {appliedFilters.contentMode === "animals"
                        ? `${filteredAnimals.length} shown`
                        : appliedFilters.contentMode === "powers"
                            ? `${powerFacets.length} powers`
                            : `${lessonFacets.length} lessons`}
                </span>
            </div>

            <div className="sticky top-16 z-20 space-y-3 rounded-[1.35rem] border border-white/[0.08] bg-[#0d0d0d]/90 p-3 backdrop-blur-xl lg:top-0 lg:bg-[#121212]/90">
                <label className="flex items-center gap-3 rounded-[1.15rem] border border-white/10 bg-black/50 px-4 py-3 focus-within:border-primary-400/40">
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
                        <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                            <AppIcon name="close" className="h-4 w-4 text-white/35" />
                        </button>
                    ) : null}
                </label>

                <p className="text-xs text-white/40">{matchedSummary}</p>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={openFilters}
                        className={`flex min-h-11 flex-1 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition ${activeFilters ? "border-primary-400 bg-primary-400 text-black" : "border-white/10 bg-black/40 text-white"}`}
                    >
                        <AppIcon name="filter" />
                        Filters
                        {activeFilters ? <span className="ml-auto h-2 w-2 rounded-full bg-black" /> : null}
                    </button>
                    {appliedFilters.contentMode === "animals" ? (
                        <div className="flex rounded-2xl border border-white/10 bg-black/40 p-1">
                            {(["grid", "list"] as Layout[]).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    aria-label={`${item} layout`}
                                    onClick={() => setLayout(item)}
                                    className={`rounded-xl p-2.5 transition ${layout === item ? "bg-primary-400 text-black" : "text-white/45 hover:text-white"}`}
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
                        aria-label="Close filters"
                        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
                        onClick={() => setFiltersOpen(false)}
                    />
                    <div className="relative z-10 flex max-h-[min(80vh,520px)] w-full max-w-md flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#0d0d0d] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.95)]">
                        <div className="overflow-y-auto p-5">
                            <h2 className="font-display text-lg font-bold text-white">Catalog filters</h2>

                            <button
                                type="button"
                                disabled={!hasPendingChanges}
                                onClick={applyPendingFilters}
                                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${hasPendingChanges ? "bg-primary-400 text-black" : "cursor-not-allowed bg-white/[0.04] text-white/35"}`}
                            >
                                <AppIcon name="search" className="h-4 w-4" />
                                Apply {pendingChangeCount} changes
                            </button>

                            <div className="mt-5 space-y-2">
                                <p className="text-xs font-black uppercase tracking-wider text-white/35">Show</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {CONTENT_MODE_OPTIONS.map((option) => (
                                        <FilterChip
                                            key={option.id}
                                            title={option.label}
                                            selected={pendingFilters.contentMode === option.id}
                                            onClick={() => setPendingFilters((current) => ({...current, contentMode: option.id}))}
                                        />
                                    ))}
                                </div>
                            </div>

                            {pendingFilters.contentMode === "animals" ? (
                                <>
                                    <div className="mt-5 space-y-2">
                                        <p className="text-xs font-black uppercase tracking-wider text-white/35">Captured status</p>
                                        <div className="flex flex-wrap gap-2">
                                            {OWNERSHIP_OPTIONS.map((option) => (
                                                <FilterChip
                                                    key={option.id}
                                                    title={option.label}
                                                    selected={pendingFilters.ownership === option.id}
                                                    onClick={() => setPendingFilters((current) => ({...current, ownership: option.id}))}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-5 space-y-2">
                                        <p className="text-xs font-black uppercase tracking-wider text-white/35">Index scope</p>
                                        <div className="flex flex-wrap gap-2">
                                            {INDEXING_OPTIONS.map((option) => (
                                                <FilterChip
                                                    key={option.id}
                                                    title={option.label}
                                                    selected={pendingFilters.indexing === option.id}
                                                    onClick={() => setPendingFilters((current) => ({...current, indexing: option.id}))}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-5 space-y-2">
                                        <p className="text-xs font-black uppercase tracking-wider text-white/35">Animal type</p>
                                        <div className="flex flex-wrap gap-2">
                                            {SPECIES_OPTIONS.map((option) => (
                                                <FilterChip
                                                    key={option.id}
                                                    title={option.label}
                                                    selected={pendingFilters.speciesFilter === option.id}
                                                    onClick={() => setPendingFilters((current) => ({...current, speciesFilter: option.id}))}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-5 space-y-2">
                                        <p className="text-xs font-black uppercase tracking-wider text-white/35">Sort by</p>
                                        <div className="space-y-2">
                                            {ANIMAL_SORT_OPTIONS.map((option) => (
                                                <SortOption
                                                    key={option.id}
                                                    id={option.id}
                                                    title={option.title}
                                                    detail={option.detail}
                                                    selected={pendingFilters.animalSort === option.id}
                                                    onSelect={(animalSort) => setPendingFilters((current) => ({...current, animalSort}))}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : pendingFilters.contentMode === "powers" ? (
                                <div className="mt-5 space-y-2">
                                    <p className="text-xs font-black uppercase tracking-wider text-white/35">Sort powers by</p>
                                    <div className="space-y-2">
                                        {POWER_SORT_OPTIONS.map((option) => (
                                            <SortOption
                                                key={option.id}
                                                id={option.id}
                                                title={option.title}
                                                detail={option.detail}
                                                selected={pendingFilters.powerSort === option.id}
                                                onSelect={(powerSort) => setPendingFilters((current) => ({...current, powerSort}))}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-5 space-y-2">
                                    <p className="text-xs font-black uppercase tracking-wider text-white/35">Sort lessons by</p>
                                    <div className="space-y-2">
                                        {LESSON_SORT_OPTIONS.map((option) => (
                                            <SortOption
                                                key={option.id}
                                                id={option.id}
                                                title={option.title}
                                                detail={option.detail}
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
                                    Clear all filters
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}

            {appliedFilters.contentMode === "animals" ? (
                <div className={layout === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" : "space-y-3"}>
                    {filteredAnimals.map((item) => (
                        <Link
                            key={item.slug}
                            href={`/animals/${item.slug}`}
                            className={`group overflow-hidden rounded-[1.35rem] border shadow-[0_16px_40px_-30px_rgba(0,0,0,0.95)] transition hover:-translate-y-0.5 hover:border-primary-400/35 ${item.captured ? "border-white/10 bg-[#121212]" : "border-white/[0.06] bg-[#101010]"} ${layout === "list" ? "flex items-center" : "block"}`}
                        >
                            <div className={`relative overflow-hidden bg-white/[0.03] ${layout === "list" ? "h-28 w-28 shrink-0" : "aspect-square"}`}>
                                <img src={item.imageSrc} alt="" loading="lazy" className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] ${item.captured ? "" : "grayscale opacity-25"}`} />
                                {!item.captured ? <span className="absolute inset-0 flex items-center justify-center text-white/35"><AppIcon name="lock" /></span> : null}
                                {item.hasIndexNumber ? <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[0.62rem] font-black tabular-nums text-primary-200">{formatAnimalDexNumber(item.number)}</span> : <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white/45">NEW</span>}
                                {item.score !== null ? <span className="absolute right-2 top-2 rounded-full bg-primary-400 px-2 py-1 text-[0.62rem] font-black text-black">{item.score}</span> : null}
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
            ) : appliedFilters.contentMode === "powers" ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {powerFacets.map((facet) => {
                        const percent = facet.count ? Math.round(facet.found / facet.count * 100) : 0;
                        return (
                            <AppSurface key={facet.key}>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[0.65rem] font-black uppercase tracking-wider text-primary-200">Animal power</p>
                                        <h2 className="mt-2 font-display text-xl font-bold">{facet.name}</h2>
                                    </div>
                                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-white/45">{facet.count} animals</span>
                                </div>
                                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                                    <div className="h-full rounded-full bg-primary-400 transition-all duration-500" style={{width: `${percent}%`}} />
                                </div>
                                <div className="mt-2 flex justify-between text-xs text-white/35">
                                    <span>{facet.found} found</span>
                                    <span>{percent}%</span>
                                </div>
                            </AppSurface>
                        );
                    })}
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {lessonFacets.map((facet) => {
                        const percent = facet.count ? Math.round(facet.found / facet.count * 100) : 0;
                        return (
                            <AppSurface key={facet.name}>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[0.65rem] font-black uppercase tracking-wider text-primary-200">Core principle</p>
                                        <h2 className="mt-2 font-display text-xl font-bold">{facet.name}</h2>
                                    </div>
                                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-white/45">{facet.count} animals</span>
                                </div>
                                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                                    <div className="h-full rounded-full bg-primary-400 transition-all duration-500" style={{width: `${percent}%`}} />
                                </div>
                                <div className="mt-2 flex justify-between text-xs text-white/35">
                                    <span>{facet.found} found</span>
                                    <span>{percent}%</span>
                                </div>
                            </AppSurface>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
