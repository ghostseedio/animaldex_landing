import {getSiteUrl} from "@/lib/site";
import {partitionSitemap, serializeSitemapIndexXml} from "@/lib/sitemap-sections";
import {cachedSitemapEntries} from "@/lib/sitemap-entries-cache";

export const revalidate = 86400;

/**
 * The sitemap index (SEO lane S3): one section sitemap per family of pages
 * (`/sitemaps/<section>.xml`, src/lib/sitemap-sections.ts), so Search Console
 * reports each on its own. The same URLs as before, split.
 */
export async function GET() {
    const sections = partitionSitemap(await cachedSitemapEntries());

    return new Response(serializeSitemapIndexXml(getSiteUrl(), sections), {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=0, must-revalidate",
            "CDN-Cache-Control": "max-age=3600, stale-while-revalidate=86400",
            "X-AnimalDex-Cache-Version": "cdn-v3"
        }
    });
}
