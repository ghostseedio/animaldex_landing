import type {SourceType} from "@/lib/content-video/plan";
import {sourcePath} from "@/lib/content-video/source-paths";
import type {PublishedContentVideoListing} from "@/lib/content-video/store";

// Google video sitemap (https://developers.google.com/search/docs/appearance/video#sitemaps)
// for the page videos in admin_content_videos. Each video is listed on its
// watch page (/videos/<type>/<slug>), where it is the main content: Google
// skipped videos listed on their articles as "Video isn't on a watch page"
// (Oct 2026). The article keeps its own VideoObject markup too.

const MAX_TEXT = 2000;

function escapeXml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

/** The canonical (English, unprefixed) page a video lives on. */
export function videoPageUrl(siteUrl: string, type: SourceType, slug: string) {
    return new URL(sourcePath(type, slug), siteUrl).toString();
}

/** The video's own watch page path. */
export function videoWatchPath(type: SourceType, slug: string) {
    return `/videos/${type}/${slug}`;
}

export function videoWatchUrl(siteUrl: string, type: SourceType, slug: string) {
    return new URL(videoWatchPath(type, slug), siteUrl).toString();
}

export function serializeVideoSitemapXml(siteUrl: string, videos: PublishedContentVideoListing[]) {
    // A thumbnail is required by Google; a video without a poster is left out.
    const byPage = new Map<string, PublishedContentVideoListing>();
    for (const video of videos) {
        if (!video.posterUrl) continue;
        const page = videoWatchUrl(siteUrl, video.type, video.slug);
        if (!byPage.has(page)) byPage.set(page, video);
    }
    const urls = Array.from(byPage).map(([page, video]) => {
        const title = (video.title || video.hookText).slice(0, 100);
        const description = (video.hookText ? `${video.hookText}. ${video.title}` : video.title).slice(0, MAX_TEXT);
        const duration = video.durationSeconds ? `<video:duration>${Math.max(1, Math.round(video.durationSeconds))}</video:duration>` : "";
        return `<url><loc>${escapeXml(page)}</loc><video:video>`
            + `<video:thumbnail_loc>${escapeXml(video.posterUrl!)}</video:thumbnail_loc>`
            + `<video:title>${escapeXml(title)}</video:title>`
            + `<video:description>${escapeXml(description)}</video:description>`
            + `<video:content_loc>${escapeXml(video.videoUrl)}</video:content_loc>`
            + duration
            + `<video:publication_date>${new Date(video.publishedAt).toISOString()}</video:publication_date>`
            + `<video:family_friendly>yes</video:family_friendly>`
            + `</video:video></url>`;
    });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${urls.join("\n")}\n</urlset>\n`;
}
