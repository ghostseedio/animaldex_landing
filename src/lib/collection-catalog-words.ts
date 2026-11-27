/**
 * The Collection tab's catalog (collection-catalog.tsx) in the reader's
 * language: English here, the locale's `appCollection` over it key by key.
 * en.json's `appCollection` holds every key below (a test checks).
 * `{name}` placeholders are filled by the catalog.
 */
export const CATALOG_WORDS_EN = {
    noMatchesEyebrow: "NO MATCHES",
    noMatchesTitle: "No species match this view.",
    noMatchesDetail: "Try another animal name or clear the current filters to explore the full catalogue.",
    resetView: "Reset view",
    catalogSummary: "{indexed} indexed · {breeds} breeds · {found} found · {left} left",
    shownAnimals: "{n} shown",
    shownPowers: "{n} powers",
    shownSystems: "{n} systems",
    shownLessons: "{n} lessons",
    binders: "Binders",
    searchAnimals: "Search species, lesson, or animal power",
    searchPowers: "Search powers",
    searchSystems: "Search systems",
    searchLessons: "Search lessons",
    matchedAll: "Matched results total: {indexed} indexed · {unindexed} unindexed · {captured} captured",
    matchedCount: "Matched results total: {n}",
    matchedPowers: "Matched results total: {powers} powers · {animals} animals",
    matchedSystems: "Matched results total: {n} systems",
    matchedLessons: "Matched results total: {lessons} lessons · {animals} animals",
    clearSearch: "Clear search",
    filters: "Filters",
    layoutGrid: "Grid layout",
    layoutList: "List layout",
    closeFilters: "Close filters",
    catalogFilters: "Catalog filters",
    applyChanges: "Apply {n} changes",
    show: "Show",
    capturedStatus: "Captured status",
    indexScope: "Index scope",
    animalType: "Animal type",
    sortBy: "Sort by",
    frequency: "Frequency",
    sortPowersBy: "Sort powers by",
    sortLessonsBy: "Sort lessons by",
    clearAllFilters: "Clear all filters",
    newBadge: "NEW",
    legendaryTier: "S-tier Legendary",
    legendary: "Legendary",
    level: "Level {n}",
    loadMoreAnimals: "Load more animals",
    loadMorePowers: "Load more powers",
    loadMoreLessons: "Load more lessons",
    animalPower: "Animal power",
    corePrinciple: "Core principle",
    animalsCount: "{n} animals",
    foundCount: "{n} found",
    optionAll: "All",
    optionDiscovered: "Discovered",
    optionUndiscovered: "Undiscovered",
    optionIndexed: "Indexed",
    optionUnindexed: "Unindexed",
    optionAllSpecies: "All species",
    optionBreedsOnly: "Breeds only",
    modeAnimals: "Animals",
    modePowers: "Powers",
    modeLessons: "Lessons",
    modeSystemDynamics: "Systems Dynamics",
    sortNewest: "Most recent capture",
    sortNewestNote: "Shows recently captured animals first",
    sortNumber: "AnimalDex number",
    sortNumberNote: "Follows the official AnimalDex order",
    sortRarity: "Canonical rarity",
    sortRarityNote: "Shows the rarest canonical species first",
    sortDominance: "Canonical dominance",
    sortDominanceNote: "Shows the strongest canonical species first",
    sortSpeed: "Canonical speed",
    sortSpeedNote: "Shows the fastest canonical species first",
    sortSize: "Canonical size",
    sortSizeNote: "Shows the largest canonical species first",
    sortIntelligence: "Canonical intelligence",
    sortIntelligenceNote: "Shows the smartest canonical species first",
    sortAlphabetical: "Alphabetical",
    sortNameNote: "Sorts by display name from A to Z",
    sortTagsNote: "Sorts tags from A to Z",
    sortMostLinked: "Most linked animals",
    sortMostLinkedNote: "Shows tags with the most linked animals first",
    sortLessonsNote: "Sorts lesson names from A to Z",
    sortIndexNumber: "Index number",
    sortIndexNumberNote: "Uses the lowest linked AnimalDex index"
};

export type CollectionCatalogWords = typeof CATALOG_WORDS_EN;

/** English, with `given` (the locale's `appCollection`) laid over it key by key. */
export function collectionCatalogWords(given: Record<string, unknown> | null | undefined): CollectionCatalogWords {
    return Object.fromEntries(Object.entries(CATALOG_WORDS_EN).map(([key, value]) => {
        const candidate = given?.[key];
        return [key, typeof candidate === "string" && candidate.trim() ? candidate : value];
    })) as CollectionCatalogWords;
}

/** `{name}` filled from `values`. */
export function fillCatalogWords(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}
