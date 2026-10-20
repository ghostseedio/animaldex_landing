import type {TimelineEntry} from "@/lib/content-video/plan";
import type {PublishedContentVideo} from "@/lib/content-video/store";

export type PageVideoCopy = {kicker: string; blurb: string; footnote: string};

/** Key moments for the player: the beats with an on-screen label, never the winner reveal (that would spoil it). */
export function pageVideoChapters(timeline: TimelineEntry[]) {
    return timeline
        .filter((entry) => entry.kind === "scene" && entry.overlay && entry.overlayStyle !== "winner")
        .slice(0, 6)
        .map((entry) => ({start: entry.start, label: entry.overlay}));
}

export type PageVideoPage = {pageTitle: string; pageDescription: string; pageUrl: string};

/** schema.org VideoObject for a page video, shared by the build snapshot and the browser fallback. */
export function pageVideoSchema(video: PublishedContentVideo, {pageTitle, pageDescription, pageUrl}: PageVideoPage) {
    return {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: video.title || pageTitle,
        description: video.hookText ? `${video.hookText}. ${pageDescription}` : pageDescription,
        thumbnailUrl: video.posterUrl ?? undefined,
        uploadDate: video.publishedAt,
        contentUrl: video.videoUrl,
        inLanguage: "en",
        ...(video.durationSeconds ? {duration: `PT${Math.round(video.durationSeconds)}S`} : {}),
        isPartOf: {"@id": pageUrl},
        publisher: {"@type": "Organization", name: "AnimalDex"}
    };
}
