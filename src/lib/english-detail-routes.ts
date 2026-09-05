const COLLAPSED_DETAIL_PREFIXES = [
    "/animals/",
    "/animal-lessons/",
    "/pokemon-animals/",
    "/animal-hybrids/",
    "/comparisons/"
] as const;

const COLLAPSED_DETAIL_RE = /^\/(animals|animal-lessons|pokemon-animals|animal-hybrids|comparisons)\/[a-z0-9-]+\/?$/i;

export const CLOSED_SEO_NAMESPACE_FAMILIES = [
    "animals",
    "animal-lessons",
    "pokemon-animals",
    "animal-hybrids"
] as const;

export const COLLAPSED_ID_DETAIL_FAMILIES = [
    ...CLOSED_SEO_NAMESPACE_FAMILIES,
    "comparisons"
] as const;

export type CollapsedIdDetailFamily = typeof COLLAPSED_ID_DETAIL_FAMILIES[number];

function pathnameOnly(path: string) {
    const withoutQuery = path.split("?")[0]?.split("#")[0] ?? path;
    if (!withoutQuery.startsWith("/")) {
        return `/${withoutQuery}`;
    }
    return withoutQuery;
}

export function isCollapsedEnglishDetailPath(path: string) {
    const normalized = pathnameOnly(path).replace(/\/+$/, "") || "/";
    return COLLAPSED_DETAIL_RE.test(normalized);
}

export function matchCollapsedIdDetailPath(path: string): {family: CollapsedIdDetailFamily; englishPath: string} | null {
    const normalized = pathnameOnly(path);
    const match = normalized.match(/^\/id\/(animals|animal-lessons|pokemon-animals|animal-hybrids|comparisons)\/([a-z0-9-]+)\/?$/i);
    if (!match) {
        return null;
    }

    const family = match[1] as CollapsedIdDetailFamily;
    const slug = match[2];
    return {
        family,
        englishPath: `/${family}/${slug}`
    };
}

export function collapsedEnglishDetailPrefixes() {
    return COLLAPSED_DETAIL_PREFIXES;
}
