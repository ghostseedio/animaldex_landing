import {listPublishedContentVideos} from "@/lib/content-video/store";
import {getSiteUrl} from "@/lib/site";
import {serializeVideoSitemapXml} from "@/lib/video-sitemap";

// Hourly: the build has no database credentials, so the first copy is empty
// and the first regeneration in production fills it.
export const revalidate = 3600;

export async function GET() {
    const videos = await listPublishedContentVideos();

    return new Response(serializeVideoSitemapXml(getSiteUrl(), videos), {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=0, must-revalidate",
            "CDN-Cache-Control": "max-age=3600, stale-while-revalidate=86400"
        }
    });
}
