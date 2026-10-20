"use client";

import {useEffect, useState} from "react";
import ArticleVideoBrief from "@/app/[locale]/(composited)/blog/_components/article-video-brief";
import {pageVideoChapters, pageVideoSchema, type PageVideoCopy, type PageVideoPage} from "@/app/[locale]/(composited)/_components/page-video/page-video-copy";
import type {SourceType} from "@/lib/content-video/plan";
import type {PublishedContentVideo} from "@/lib/content-video/store";

/**
 * A video published after this page was built: looked up once in the browser.
 * Renders nothing when there is none. Its VideoObject markup is rendered too,
 * so Google's renderer still finds it (the video sitemap covers the rest).
 */
export default function PageVideoIsland({type, slug, copy, page}: {type: SourceType; slug: string; copy: PageVideoCopy; page: PageVideoPage}) {
    const [video, setVideo] = useState<PublishedContentVideo | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/page-videos?type=${type}&slug=${encodeURIComponent(slug)}`, {signal: controller.signal})
            .then((response) => (response.ok ? response.json() : null))
            .then((body: {video?: PublishedContentVideo | null} | null) => setVideo(body?.video ?? null))
            .catch(() => undefined);
        return () => controller.abort();
    }, [type, slug]);
    if (!video) return null;
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(pageVideoSchema(video, page))}} />
            <ArticleVideoBrief
                videoUrl={video.videoUrl}
                posterUrl={video.posterUrl}
                durationSeconds={video.durationSeconds}
                headline={video.hookText || video.title}
                chapters={pageVideoChapters(video.timeline)}
                {...copy}
            />
        </>
    );
}
