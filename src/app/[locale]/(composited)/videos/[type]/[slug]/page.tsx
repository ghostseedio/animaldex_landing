import type {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {isSourceType} from "@/lib/content-video/plan";
import {SOURCE_LABELS, sourcePath} from "@/lib/content-video/source-paths";
import {getPublishedVideoForWatch, listPublishedContentVideos} from "@/lib/content-video/store";
import {getAbsoluteAssetUrl, getAbsoluteUrl} from "@/lib/site";
import {videoWatchPath} from "@/lib/video-sitemap";

// One page video as the main content of its own page (Google indexes a video
// only where it is the page's focus): the player first, then what it covers,
// its full narration as a transcript, the article it comes from, and more
// videos. Rendered on request and cached; English only.

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
    return [];
}

type WatchPageProps = {params: {locale: string; type: string; slug: string}};

async function load(params: WatchPageProps["params"]) {
    if (params.locale !== "en" || !isSourceType(params.type)) return null;
    return getPublishedVideoForWatch(params.type, params.slug);
}

function clock(seconds: number) {
    const whole = Math.max(0, Math.round(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function describe(video: NonNullable<Awaited<ReturnType<typeof load>>>) {
    const lines = video.timeline.filter((entry) => entry.kind !== "end").map((entry) => entry.narration).join(" ");
    const lead = video.hookText ? `${video.hookText.charAt(0)}${video.hookText.slice(1).toLowerCase()}. ` : "";
    return `${lead}${lines}`.replace(/\s+/g, " ").trim().slice(0, 155).replace(/\s\S*$/, "…");
}

export async function generateMetadata({params}: WatchPageProps): Promise<Metadata> {
    const video = await load(params);
    if (!video) return {};
    const path = videoWatchPath(video.type, video.slug);
    const title = `${video.title} (Video)`;
    const description = describe(video);
    return {
        title,
        description,
        alternates: {canonical: path},
        openGraph: {
            type: "video.other",
            title,
            description,
            url: getAbsoluteUrl("en", path),
            images: video.posterUrl ? [{url: video.posterUrl, width: 1080, height: 1920, alt: video.title}] : undefined,
            videos: [{url: video.videoUrl, type: "video/mp4", width: 1080, height: 1920}]
        },
        twitter: {card: "summary_large_image", title, description, images: video.posterUrl ? [video.posterUrl] : undefined}
    };
}

export default async function VideoWatchPage({params}: WatchPageProps) {
    const video = await load(params);
    if (!video) notFound();
    const path = videoWatchPath(video.type, video.slug);
    const articlePath = sourcePath(video.type, video.slug);
    const scenes = video.timeline.filter((entry) => entry.kind !== "end" && entry.narration);
    const transcript = scenes.map((entry) => entry.narration).join(" ");
    const more = (await listPublishedContentVideos()).filter((other) => other.posterUrl && !(other.type === video.type && other.slug === video.slug)).slice(0, 12);

    const schema = {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "@id": `${getAbsoluteUrl("en", path)}#video`,
        name: video.title,
        description: describe(video),
        thumbnailUrl: video.posterUrl ? [video.posterUrl] : undefined,
        uploadDate: video.publishedAt,
        contentUrl: video.videoUrl,
        ...(video.durationSeconds ? {duration: `PT${Math.round(video.durationSeconds)}S`} : {}),
        inLanguage: "en",
        isFamilyFriendly: true,
        ...(transcript ? {transcript} : {}),
        isPartOf: {"@type": "WebPage", "@id": getAbsoluteUrl("en", articlePath), name: video.sourceTitle},
        publisher: {"@type": "Organization", name: "AnimalDex", logo: {"@type": "ImageObject", url: getAbsoluteAssetUrl("/images/logo.webp")}}
    };
    const breadcrumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {"@type": "ListItem", position: 1, name: "AnimalDex", item: getAbsoluteUrl("en", "/")},
            {"@type": "ListItem", position: 2, name: "Videos", item: getAbsoluteUrl("en", "/videos")},
            {"@type": "ListItem", position: 3, name: video.title, item: getAbsoluteUrl("en", path)}
        ]
    };

    return (
        <article className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 md:px-8 md:py-16">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([schema, breadcrumbs])}} />
            <div className="grid gap-8 md:grid-cols-[minmax(0,22rem)_1fr] md:items-start md:gap-12">
                <div className="mx-auto w-full max-w-[22rem] overflow-hidden bg-black ring-1 ring-line-300">
                    <video src={video.videoUrl} poster={video.posterUrl ?? undefined} controls playsInline preload="metadata" className="block aspect-[9/16] w-full object-cover">
                        Your browser cannot play this video.
                    </video>
                </div>
                <div className="flex flex-col gap-5">
                    <p className="text-xs font-black uppercase tracking-[.2em] text-primary-200">{SOURCE_LABELS[video.type]} · Video{video.durationSeconds ? ` · ${clock(video.durationSeconds)}` : ""}</p>
                    <h1 className="font-display text-4xl leading-tight text-white sm:text-5xl">{video.title}</h1>
                    {video.hookText ? <p className="text-lg font-bold uppercase tracking-wide text-primary-100">{video.hookText}</p> : null}
                    <p className="text-lg leading-8 text-ink-200">
                        A short from AnimalDex, from{" "}
                        <Link href={articlePath} className="font-bold text-white underline decoration-primary-400 underline-offset-4">{video.sourceTitle}</Link>
                        . Every claim in it comes from that page, which has the full detail and sources.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Link href={articlePath} className="bg-primary-400 px-5 py-3 text-sm font-black text-canvas-950">Read the full {video.type === "comparison" ? "matchup" : video.type === "ranking" ? "ranking" : "story"}</Link>
                        <Link href="/talk-to-animals" className="border border-line-300 px-5 py-3 text-sm font-black text-white">Talk to any animal</Link>
                    </div>
                    <p className="text-xs text-ink-500">Published {new Date(video.publishedAt).toLocaleDateString("en-GB", {day: "numeric", month: "long", year: "numeric"})}. AI-narrated, with motion added to some images.</p>
                </div>
            </div>

            {scenes.length ? (
                <section aria-labelledby="transcript" className="flex flex-col gap-4 border-t border-line-300 pt-8">
                    <h2 id="transcript" className="font-display text-3xl text-white">Transcript</h2>
                    <ol className="flex flex-col gap-3">
                        {scenes.map((entry, index) => (
                            <li key={index} className="grid grid-cols-[3.5rem_1fr] gap-3 text-base leading-7 text-ink-200">
                                <span className="tabular-nums text-ink-500">{clock(entry.start)}</span>
                                <span>{entry.overlay ? <strong className="text-white">{entry.overlay}. </strong> : null}{entry.narration}</span>
                            </li>
                        ))}
                    </ol>
                </section>
            ) : null}

            {more.length ? (
                <section aria-labelledby="more-videos" className="flex flex-col gap-4 border-t border-line-300 pt-8">
                    <div className="flex items-baseline justify-between gap-4">
                        <h2 id="more-videos" className="font-display text-3xl text-white">More animal shorts</h2>
                        <Link href="/videos" className="text-sm font-bold text-primary-200">All videos</Link>
                    </div>
                    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                        {more.map((other) => (
                            <li key={`${other.type}/${other.slug}`}>
                                <Link href={videoWatchPath(other.type, other.slug)} className="group flex flex-col gap-2">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- poster frames from the public videos bucket */}
                                    <img src={other.posterUrl!} alt={other.title} loading="lazy" width={270} height={480} className="aspect-[9/16] w-full object-cover ring-1 ring-line-300 transition group-hover:ring-primary-400" />
                                    <span className="text-sm font-bold leading-5 text-white">{other.title}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
        </article>
    );
}
