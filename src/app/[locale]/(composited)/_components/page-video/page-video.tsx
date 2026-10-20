import snapshot from "@/data/published-page-videos.json";
import ArticleVideoBrief from "@/app/[locale]/(composited)/blog/_components/article-video-brief";
import PageVideoIsland from "@/app/[locale]/(composited)/_components/page-video/page-video-island";
import {pageVideoChapters, pageVideoSchema, type PageVideoCopy} from "@/app/[locale]/(composited)/_components/page-video/page-video-copy";
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
    if (!video) return <PageVideoIsland type={type} slug={slug} copy={copy} page={{pageTitle, pageDescription, pageUrl}} />;
    const schema = pageVideoSchema(video, {pageTitle, pageDescription, pageUrl});
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
