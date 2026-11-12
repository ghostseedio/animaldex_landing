import {escapeSitemapXml, type SitemapXmlEntry} from "@/lib/sitemap-xml";

/**
 * The sitemap as an index of section sitemaps (SEO lane S3, S1's audit: one
 * 9,151-URL file made Search Console's per-sitemap report useless). The
 * sections follow the site's families; every URL lands in exactly one, and
 * anything unmatched is in `pages`.
 */

export const SITEMAP_SECTIONS = ["pages", "ark", "species", "powers", "comparisons", "hybrids", "captures", "blog", "locations", "id"] as const;
export type SitemapSection = (typeof SITEMAP_SECTIONS)[number];

const PREFIXES: Array<[SitemapSection, RegExp]> = [
    ["id", /^\/id(\/|$)/],
    ["ark", /^\/(ark|about)(\/|$)/],
    ["species", /^\/animals\//],
    ["powers", /^\/(animal-powers|qualities)\//],
    ["comparisons", /^\/comparisons\//],
    ["hybrids", /^\/(animal-hybrids|pokemon-animals)\//],
    ["captures", /^\/p\//],
    ["blog", /^\/blog\//],
    ["locations", /^\/(locations|wildlife-guides|guides)\//]
];

export function isSitemapSection(value: unknown): value is SitemapSection {
    return typeof value === "string" && (SITEMAP_SECTIONS as readonly string[]).includes(value);
}

/** The section a URL belongs to, by its path. */
export function sitemapSectionOf(url: string): SitemapSection {
    let pathname = url;
    try {
        pathname = new URL(url).pathname;
    } catch {
        // a path already
    }
    for (const [section, pattern] of PREFIXES) if (pattern.test(pathname)) return section;
    return "pages";
}

/** The entries of every section, in their original order. */
export function partitionSitemap<T extends {url: string}>(entries: T[]): Record<SitemapSection, T[]> {
    const out = Object.fromEntries(SITEMAP_SECTIONS.map((section) => [section, [] as T[]])) as Record<SitemapSection, T[]>;
    for (const entry of entries) out[sitemapSectionOf(entry.url)].push(entry);
    return out;
}

export function sitemapSectionPath(section: SitemapSection): string {
    return `/sitemaps/${section}.xml`;
}

/** The newest lastmod of a section's entries, if any has one. */
function newest(entries: SitemapXmlEntry[]): string | null {
    let best = 0;
    for (const entry of entries) {
        const time = entry.lastModified ? new Date(entry.lastModified).getTime() : NaN;
        if (Number.isFinite(time) && time > best) best = time;
    }
    return best ? new Date(best).toISOString() : null;
}

/** The sitemap index: one <sitemap> per section that has URLs. */
export function serializeSitemapIndexXml(siteUrl: string, sections: Record<SitemapSection, SitemapXmlEntry[]>): string {
    const items = SITEMAP_SECTIONS.filter((section) => sections[section].length > 0).map((section) => {
        const lastmod = newest(sections[section]);
        return `<sitemap><loc>${escapeSitemapXml(`${siteUrl}${sitemapSectionPath(section)}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</sitemap>`;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
}
