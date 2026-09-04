export type SitemapXmlEntry = {
    url: string;
    lastModified?: string | Date;
    changeFrequency?: string;
    priority?: number;
};

export function uniqueSitemapEntries<T extends {url: string}>(entries: T[]): T[] {
    const seen = new Set<string>();
    return entries.filter((entry) => {
        if (seen.has(entry.url)) return false;
        seen.add(entry.url);
        return true;
    });
}

function escapeXml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

export function serializeSitemapXml(entries: SitemapXmlEntry[]) {
    const urls = entries.map((entry) => {
        const lastModified = entry.lastModified
            ? `<lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>`
            : "";
        const changeFrequency = entry.changeFrequency
            ? `<changefreq>${entry.changeFrequency}</changefreq>`
            : "";
        const priority = entry.priority !== undefined
            ? `<priority>${entry.priority}</priority>`
            : "";

        return `<url><loc>${escapeXml(entry.url)}</loc>${lastModified}${changeFrequency}${priority}</url>`;
    }).join("");

    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
