import type {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {SOURCE_LABELS} from "@/lib/content-video/source-paths";
import {listPublishedContentVideos} from "@/lib/content-video/store";
import {videoWatchPath} from "@/lib/video-sitemap";

// Every published page video, newest first, each linking to its watch page:
// the hub that gives the watch pages internal links. English only.

export const revalidate = 3600;

export function generateStaticParams() {
    return [];
}

export const metadata: Metadata = {
    title: "Animal Videos: Battles, Rankings and Wild Facts in Under a Minute",
    description: "Short animal videos from AnimalDex: who would win, the fastest and strongest animals ranked, imagined hybrids and the wildest facts, each with its full story and sources.",
    alternates: {canonical: "/videos"}
};

export default async function VideosPage({params}: {params: {locale: string}}) {
    if (params.locale !== "en") notFound();
    const videos = (await listPublishedContentVideos()).filter((video) => video.posterUrl);
    return (
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 md:px-8 md:py-16">
            <header className="flex flex-col gap-3">
                <p className="text-xs font-black uppercase tracking-[.2em] text-primary-200">AnimalDex shorts</p>
                <h1 className="font-display text-4xl leading-tight text-white sm:text-6xl">Animal videos</h1>
                <p className="max-w-3xl text-lg leading-8 text-ink-300">Who would win, the fastest and strongest animals ranked, imagined hybrids and the strangest true facts, each under a minute and each with the full story behind it.</p>
            </header>
            <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
                {videos.map((video) => (
                    <li key={`${video.type}/${video.slug}`}>
                        <Link href={videoWatchPath(video.type, video.slug)} className="group flex flex-col gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element -- poster frames from the public videos bucket */}
                            <img src={video.posterUrl!} alt={video.title} loading="lazy" width={270} height={480} className="aspect-[9/16] w-full object-cover ring-1 ring-line-300 transition group-hover:ring-primary-400" />
                            <span className="text-[11px] font-black uppercase tracking-wide text-primary-200">{SOURCE_LABELS[video.type]}</span>
                            <span className="text-sm font-bold leading-5 text-white">{video.title}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
