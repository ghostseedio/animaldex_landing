/**
 * Path-based paging for long hub lists (/animal-trials, /animal-frequencies,
 * /tier-list).
 *
 * Page 1 is the hub itself; later pages live at <hub>/page/<n> so each one is
 * a static, cacheable URL with its own canonical. /page/1 is 308'd to the hub
 * in next.config.js.
 */

export type HubPagination = {
    basePath: string;
    perPage: number;
    /** Element id of the paged list; page links jump straight to it. */
    anchor: string;
    pageCount: (total: number) => number;
    pagePath: (page: number) => string;
    slice: <T>(entries: T[], page: number) => T[];
};

export function createHubPagination({basePath, perPage, anchor}: {basePath: string; perPage: number; anchor: string}): HubPagination {
    return {
        basePath,
        perPage,
        anchor,
        pageCount: (total) => Math.max(1, Math.ceil(total / perPage)),
        pagePath: (page) => (page <= 1 ? basePath : `${basePath}/page/${page}`),
        slice: (entries, page) => entries.slice((page - 1) * perPage, page * perPage)
    };
}

/**
 * Strict parse of the `[page]` segment: only canonical positive integers
 * ("2", not "02", "2.0" or "-1"), so every page has exactly one URL.
 */
export function parsePageParam(value: string): number | null {
    if (!/^[1-9]\d*$/.test(value)) return null;
    const page = Number(value);
    return Number.isSafeInteger(page) ? page : null;
}

/** First, last, and the neighbours of the current page, with gaps marked. */
export function getPaginationItems(currentPage: number, totalPages: number): Array<number | "gap"> {
    if (totalPages <= 7) {
        return Array.from({length: totalPages}, (_, index) => index + 1);
    }

    const pages = Array.from(new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]))
        .filter((page) => page >= 1 && page <= totalPages)
        .sort((a, b) => a - b);

    return pages.flatMap<number | "gap">((page, index) => {
        const previous = pages[index - 1];
        return previous && page - previous > 1 ? ["gap", page] : [page];
    });
}

export const animalTrialsPagination = createHubPagination({
    basePath: "/animal-trials",
    perPage: 60,
    anchor: "every-trial"
});

export const animalFrequenciesPagination = createHubPagination({
    basePath: "/animal-frequencies",
    perPage: 24,
    anchor: "behaviour-signatures"
});

/**
 * The tier-list hub's list grid. Search and category filters still cover every
 * list; paging only applies to the unfiltered grid. Hub order puts the
 * Search-Console winners first (FEATURED_TIER_LIST_SLUGS), so they stay on page 1.
 */
export const tierListPagination = createHubPagination({
    basePath: "/tier-list",
    perPage: 12,
    anchor: "browse-tier-lists"
});

/** The Animal Hybrid Lab grid (514 hybrids + app fusions). Search goes through /api/animal-hybrids/search. */
export const animalHybridsPagination = createHubPagination({
    basePath: "/animal-hybrids",
    perPage: 24,
    anchor: "hybrids-and-fusions"
});
