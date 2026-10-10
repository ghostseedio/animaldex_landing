"use client";

import {useRef, useState} from "react";

type Chapter = {start: number; label: string};

type ArticleVideoBriefProps = {
    videoUrl: string;
    posterUrl: string | null;
    durationSeconds: number | null;
    headline: string;
    chapters: Chapter[];
    /** Defaults suit an article; other pages pass their own. */
    kicker?: string;
    blurb?: string;
    footnote?: string;
};

function clock(seconds: number) {
    const whole = Math.max(0, Math.round(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * The article's short video, set as an editorial "short version" module
 * rather than an embed dropped into the text: a framed 9:16 player beside a
 * headline and the video's key moments, each of which jumps the player to it.
 * Nothing autoplays; the first tap plays with sound (the captions are burned
 * in for anyone who mutes it).
 */
export default function ArticleVideoBrief({
    videoUrl,
    posterUrl,
    durationSeconds,
    headline,
    chapters,
    kicker = "The short version",
    blurb = "This article in under a minute. Watch it here, then read on for the detail and sources.",
    footnote = "AI-narrated, with motion added to some photos. Photo credits are with each image in the article."
}: ArticleVideoBriefProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [started, setStarted] = useState(false);
    const [current, setCurrent] = useState(0);

    function play(at?: number) {
        const video = videoRef.current;
        if (!video) return;
        if (typeof at === "number") video.currentTime = at;
        setStarted(true);
        void video.play().catch(() => undefined);
    }

    const activeChapter = chapters.reduce((active, chapter, index) => (current + 0.05 >= chapter.start ? index : active), -1);

    return (
        <section
            aria-labelledby="article-video-heading"
            className="mb-10 overflow-hidden rounded-[1.75rem] border border-[color:var(--rule)] bg-[color:var(--paper-900)] md:mb-12"
        >
            <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,16rem)_1fr] md:items-center md:gap-10 md:p-8">
                <div className="relative mx-auto w-full max-w-[13.5rem] overflow-hidden sm:max-w-[16rem] rounded-[1.25rem] bg-black shadow-[0_24px_60px_-28px_rgba(0,0,0,0.65)] ring-1 ring-[color:var(--rule)]">
                    <video
                        ref={videoRef}
                        src={videoUrl}
                        poster={posterUrl ?? undefined}
                        controls={started}
                        playsInline
                        preload="none"
                        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
                        onPlay={() => setStarted(true)}
                        className="block aspect-[9/16] w-full object-cover"
                    >
                        Your browser cannot play this video.
                    </video>
                    {!started ? (
                        <button
                            type="button"
                            onClick={() => play()}
                            aria-label={`Play the video: ${headline}`}
                            className="group absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black/70 via-black/0 to-black/0 p-4 text-left"
                        >
                            <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[color:var(--lime)] text-[#0b0f0a] shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-transform group-hover:scale-105 group-focus-visible:scale-105">
                                <svg viewBox="0 0 24 24" aria-hidden="true" className="ml-1 h-7 w-7 fill-current"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" /></svg>
                            </span>
                            {durationSeconds ? (
                                <span className="self-start rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white backdrop-blur-sm">
                                    {clock(durationSeconds)}
                                </span>
                            ) : null}
                        </button>
                    ) : null}
                </div>

                <div className="flex min-w-0 flex-col gap-4">
                    <p className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--lime)]">
                        {kicker}{durationSeconds ? ` · ${clock(durationSeconds)}` : ""}
                    </p>
                    <h2 id="article-video-heading" className="!m-0 max-w-[22ch] font-display text-[1.75rem] font-bold leading-[1.08] tracking-[-0.015em] text-[color:var(--text-100)] [text-wrap:balance] md:text-[2.125rem]">
                        {headline}
                    </h2>
                    <p className="!m-0 max-w-[48ch] text-[15px] leading-relaxed text-[color:var(--text-300)]">
                        {blurb}
                    </p>

                    {chapters.length > 0 ? (
                        <ol className="!m-0 flex list-none flex-col border-t border-[color:var(--rule)] !p-0">
                            {chapters.map((chapter, index) => (
                                <li key={`${chapter.start}-${chapter.label}`} className="!m-0 border-b border-[color:var(--rule)] !p-0">
                                    <button
                                        type="button"
                                        onClick={() => play(chapter.start)}
                                        aria-current={started && index === activeChapter ? "true" : undefined}
                                        className="group flex w-full items-baseline gap-4 py-2.5 text-left transition-colors"
                                    >
                                        <span className={`w-10 shrink-0 text-[12px] font-semibold tabular-nums ${started && index === activeChapter ? "text-[color:var(--lime)]" : "text-[color:var(--text-400)]"}`}>
                                            {clock(chapter.start)}
                                        </span>
                                        <span className={`text-[15px] font-semibold leading-snug transition-colors group-hover:text-[color:var(--text-100)] ${started && index === activeChapter ? "text-[color:var(--text-100)]" : "text-[color:var(--text-200)]"}`}>
                                            {chapter.label}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ol>
                    ) : null}

                    <p className="!m-0 text-[12px] leading-5 text-[color:var(--text-400)]">
                        {footnote}
                    </p>
                </div>
            </div>
        </section>
    );
}
