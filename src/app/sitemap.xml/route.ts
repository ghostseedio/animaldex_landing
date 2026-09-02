import {buildSitemapEntries, serializeSitemapXml} from "@/lib/build-sitemap";

export const dynamic = "force-dynamic";

export async function GET() {
    const entries = await buildSitemapEntries();

    return new Response(serializeSitemapXml(entries), {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
        }
    });
}
