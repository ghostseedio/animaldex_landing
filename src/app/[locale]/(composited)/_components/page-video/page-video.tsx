import snapshot from "@/data/published-page-videos.json";
import ArticleVideoBrief from "@/app/[locale]/(composited)/blog/_components/article-video-brief";
import PageVideoIsland from "@/app/[locale]/(composited)/_components/page-video/page-video-island";
import {pageVideoChapters, type PageVideoCopy} from "@/app/[locale]/(composited)/_components/page-video/page-video-copy";
import type {SourceType} from "@/lib/content-video/plan";
import type {PublishedContentVideo} from "@/lib/content-video/store";

type PageVideoProps = {
    type: SourceType;
    slug: string;
    /** For the VideoObject markup. */
    pageTitle: string;
    pageDescription: string;
    pageUrl: string;
    copy: PageVideoCopy;
};

const videos = (snapshot as unknown as {videos: Record<string, PublishedContentVideo>}).videos;

/**
 * A static page's video. Published videos are snapshotted into the build
 * (src/data/published-page-videos.json), so the player and its VideoObject
 * markup are in the HTML with no database call during static generation; a
 * video published since then is fetched in the browser instead.
 */
export default function PageVideo({type, slug, pageTitle, pageDescription, pageUrl, copy}: PageVideoProps) {
    const video = videos[`${type}:${slug}`];
    if (!video) return <PageVideoIsland type={type} slug={slug} copy={copy} />;
    const schema = {
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
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />
            <ArticleVideoBrief
                videoUrl={video.videoUrl}
                posterUrl={video.posterUrl}
                durationSeconds={video.durationSeconds}
                headline={video.hookText || video.title || pageTitle}
                chapters={pageVideoChapters(video.timeline)}
                {...copy}
            />
        </>
    );
}
