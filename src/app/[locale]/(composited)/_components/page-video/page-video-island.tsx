"use client";

import {useEffect, useState} from "react";
import ArticleVideoBrief from "@/app/[locale]/(composited)/blog/_components/article-video-brief";
import {pageVideoChapters, type PageVideoCopy} from "@/app/[locale]/(composited)/_components/page-video/page-video-copy";
import type {SourceType} from "@/lib/content-video/plan";
import type {PublishedContentVideo} from "@/lib/content-video/store";

/** A video published after this page was built: looked up once in the browser. Renders nothing when there is none. */
export default function PageVideoIsland({type, slug, copy}: {type: SourceType; slug: string; copy: PageVideoCopy}) {
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
        <ArticleVideoBrief
            videoUrl={video.videoUrl}
            posterUrl={video.posterUrl}
            durationSeconds={video.durationSeconds}
            headline={video.hookText || video.title}
            chapters={pageVideoChapters(video.timeline)}
            {...copy}
        />
    );
}
