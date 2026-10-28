import {listPublishedContentVideos} from "@/lib/content-video/store";
import {getSiteUrl} from "@/lib/site";
import {serializeVideoSitemapXml} from "@/lib/video-sitemap";

// Built per request (with a short in-process cache), never at build time: the
// build has no database credentials, and a statically cached copy served Google
// an empty sitemap for hours after every deploy (Oct 2026, 65 → 0 videos).
// When the database cannot be read, the answer is a 503 Google retries, never
// an empty list it would act on.
export const dynamic = "force-dynamic";

const CACHE_MS = 15 * 60_000;
let cached: {at: number; xml: string} | null = null;

export async function GET() {
    if (!cached || Date.now() - cached.at > CACHE_MS) {
        const videos = await listPublishedContentVideos();
        if (videos.length) cached = {at: Date.now(), xml: serializeVideoSitemapXml(getSiteUrl(), videos)};
    }
    if (!cached) {
        return new Response("Video sitemap temporarily unavailable", {status: 503, headers: {"Retry-After": "1800", "Cache-Control": "no-store"}});
    }
    return new Response(cached.xml, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=0, must-revalidate",
            "CDN-Cache-Control": "max-age=900"
        }
    });
}
