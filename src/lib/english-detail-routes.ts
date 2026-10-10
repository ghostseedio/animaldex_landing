const COLLAPSED_DETAIL_PREFIXES = [
    "/animals/",
    "/animal-powers/",
    "/pokemon-animals/",
    "/animal-hybrids/",
    "/comparisons/",
    "/tier-list/"
] as const;

const COLLAPSED_DETAIL_RE = /^\/(animals|animal-powers|pokemon-animals|animal-hybrids|comparisons|tier-list)\/[a-z0-9-]+\/?$/i;

export const CLOSED_SEO_NAMESPACE_FAMILIES = [
    "animals",
    "animal-powers",
    "pokemon-animals",
    "animal-hybrids",
    "qualities",
    "comparisons"
] as const;

// Only untranslated article bodies may 308 to English. /qualities keeps /id
// because title, meta, and cluster intro are genuinely localized. Tier-list
// bodies (title, description, entries, FAQ) are English data in rankings.ts,
// so /id/tier-list/<slug> was an exact duplicate that Google chose over the
// English URL for English queries.
export const COLLAPSED_ID_DETAIL_FAMILIES = [
    "animals",
    "animal-powers",
    "pokemon-animals",
    "animal-hybrids",
    "comparisons",
    "tier-list"
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
    const match = normalized.match(/^\/id\/(animals|animal-powers|pokemon-animals|animal-hybrids|comparisons|tier-list)\/([a-z0-9-]+)\/?$/i);
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
