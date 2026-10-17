/**
 * Directory filter/sort vocabulary with no catalog dependency.
 *
 * The /animals directory is a client component. Importing these constants from
 * "@/data/species" dragged the whole static catalog (every expansion pack, the
 * location pages and the legendary beasts) into the client chunk that every page
 * prefetches via the header link. Keep this module free of data imports; the
 * catalog module re-exports everything here so server code keeps one import path.
 */

export type SpeciesDirectoryLetter = "all" | string;
export type SpeciesRarityStatusKey = "very-rare" | "rare" | "uncommon" | "relatively-common";
export type SpeciesDirectorySort =
    | "number"
    | "name"
    | "rarity"
    | "dominance"
    | "speed"
    | "size"
    | "intelligence";

export type SpeciesDirectorySortOrder = "asc" | "desc";

export type SpeciesDirectoryTierFilter = "all" | "S" | "A" | "B" | "C" | "D" | "E";

/** Options offered by the directory's per-page control; the first is the default. */
export const SPECIES_DIRECTORY_PAGE_SIZES = [50, 100, 500, 1000] as const;
export type SpeciesDirectoryPageSize = (typeof SPECIES_DIRECTORY_PAGE_SIZES)[number];
export const SPECIES_DIRECTORY_PAGE_SIZE: SpeciesDirectoryPageSize = SPECIES_DIRECTORY_PAGE_SIZES[0];

export function isSpeciesDirectoryPageSize(value: number): value is SpeciesDirectoryPageSize {
    return (SPECIES_DIRECTORY_PAGE_SIZES as readonly number[]).includes(value);
}
export const SPECIES_DIRECTORY_SORT_OPTIONS: Array<{
    id: SpeciesDirectorySort;
    titleKey: string;
    detailKey: string;
}> = [
    {id: "number", titleKey: "sortNumberTitle", detailKey: "sortNumberDetail"},
    {id: "rarity", titleKey: "sortRarityTitle", detailKey: "sortRarityDetail"},
    {id: "dominance", titleKey: "sortDominanceTitle", detailKey: "sortDominanceDetail"},
    {id: "speed", titleKey: "sortSpeedTitle", detailKey: "sortSpeedDetail"},
    {id: "size", titleKey: "sortSizeTitle", detailKey: "sortSizeDetail"},
    {id: "intelligence", titleKey: "sortIntelligenceTitle", detailKey: "sortIntelligenceDetail"},
    {id: "name", titleKey: "sortNameTitle", detailKey: "sortNameDetail"}
];

export function isSpeciesDirectorySort(value: string): value is SpeciesDirectorySort {
    return SPECIES_DIRECTORY_SORT_OPTIONS.some((option) => option.id === value);
}

export function getDefaultSpeciesDirectorySortOrder(sort: SpeciesDirectorySort): SpeciesDirectorySortOrder {
    switch (sort) {
        case "number":
        case "name":
            return "asc";
        default:
            return "desc";
    }
}

export function isSpeciesDirectorySortOrder(value: string): value is SpeciesDirectorySortOrder {
    return value === "asc" || value === "desc";
}

export function isSpeciesDirectoryTierFilter(value: string): value is SpeciesDirectoryTierFilter {
    return ["all", "S", "A", "B", "C", "D", "E"].includes(value);
}

export function getSpeciesRarityStatusKey(score: number): SpeciesRarityStatusKey {
    if (score >= 85) return "very-rare";
    if (score >= 70) return "rare";
    if (score >= 50) return "uncommon";
    return "relatively-common";
}
