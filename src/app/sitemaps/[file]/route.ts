import {isSitemapSection, partitionSitemap, SITEMAP_SECTIONS} from "@/lib/sitemap-sections";
import {cachedSitemapEntries} from "@/lib/sitemap-entries-cache";
import {serializeSitemapXml} from "@/lib/sitemap-xml";

export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
    return SITEMAP_SECTIONS.map((section) => ({file: `${section}.xml`}));
}

/** One section of the sitemap index (`/sitemaps/<section>.xml`); anything else is a 404. */
export async function GET(_request: Request, {params}: {params: {file: string}}) {
    const section = params.file.replace(/\.xml$/, "");
    if (!params.file.endsWith(".xml") || !isSitemapSection(section)) return new Response("Not found", {status: 404});
    const entries = partitionSitemap(await cachedSitemapEntries())[section];
    return new Response(serializeSitemapXml(entries), {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=0, must-revalidate",
            "CDN-Cache-Control": "max-age=3600, stale-while-revalidate=86400",
            "X-AnimalDex-Cache-Version": "cdn-v3"
        }
    });
}
