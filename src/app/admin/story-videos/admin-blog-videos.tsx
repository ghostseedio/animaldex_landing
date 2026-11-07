"use client";

import {useCallback, useEffect, useState} from "react";
import {ClapperboardPlay, Eye, EyeClosed, MagicStick3, Refresh, Share, TrashBinMinimalistic} from "solar-icon-set";
import {SOURCE_TYPES, type SourceType, type TimelineEntry, type VideoPlan} from "@/lib/content-video/plan";
import {SOURCE_LABELS, sourcePath} from "@/lib/content-video/source-paths";
import type {ContentVideoClip, ContentVideoStatus} from "@/lib/content-video/store";
import {SOCIAL_PLATFORM_LABELS, type SocialPostRow} from "@/lib/social/types";
import {Alert, Badge, Button, Card, cn, EmptyState, fieldClass, Segmented, Skeleton, Spinner} from "@/components/admin/ui";

export type BlogVideo = {
    id: string;
    source_type: SourceType;
    source_slug: string;
    source_title: string;
    status: ContentVideoStatus;
    progress: string | null;
    plan: VideoPlan | null;
    clips: ContentVideoClip[];
    timeline: TimelineEntry[] | null;
    llm_provider: string | null;
    tts_provider: string | null;
    estimated_usd: number;
    video_path: string | null;
    duration_seconds: number | null;
    error: string | null;
    published_at: string | null;
    created_at: string;
    updated_at: string;
    running: boolean;
    videoUrl: string | null;
    posterUrl: string | null;
};

type Candidate = {slug: string; title: string; publishedAt: string; imageCount: number};

const STATUS_LABELS: Record<ContentVideoStatus, string> = {
    scripting: "Writing script",
    generating: "Animating clips",
    rendering: "Editing",
    ready: "Ready",
    failed: "Failed"
};

async function api<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, {cache: "no-store", ...init});
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Request failed (${response.status})`);
    return body as T;
}

function inProgress(video: BlogVideo) {
    return video.status !== "ready" && video.status !== "failed";
}

/** In progress on paper, but no runner has it: the server restarted mid-way. */
function interrupted(video: BlogVideo) {
    return inProgress(video) && !video.running;
}

type Props = {
    siteUrl: string;
    shares: Map<string, SocialPostRow[]>;
    onShare: (video: BlogVideo) => void;
    onNotice: (message: string) => void;
};

/**
 * Short vertical videos made from blog posts: Claude writes the script and
 * shot list from the article and its photos, Higgsfield animates the hook and
 * four more shots, the server voices and edits it. A finished video goes on
 * its post only once it is published here, and shares like any story video.
 */
export default function AdminBlogVideos({siteUrl, shares, onShare, onNotice}: Props) {
    const [videos, setVideos] = useState<BlogVideo[] | null>(null);
    const [available, setAvailable] = useState<Partial<Record<SourceType, Candidate[]>>>({});
    const [type, setType] = useState<SourceType>("blog");
    const [busy, setBusy] = useState(false);
    const [higgsfield, setHiggsfield] = useState(true);
    const [choice, setChoice] = useState("");
    const [starting, setStarting] = useState(false);
    const [acting, setActing] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const [making, setMaking] = useState(false);
    const [limit, setLimit] = useState(PAGE);

    const load = useCallback(async () => {
        const body = await api<{videos: BlogVideo[]; available: Partial<Record<SourceType, Candidate[]>>; busy: boolean; higgsfieldConfigured: boolean}>("/api/admin/content-videos");
        setVideos(body.videos);
        setAvailable(body.available);
        setBusy(body.busy);
        setHiggsfield(body.higgsfieldConfigured);
    }, []);

    useEffect(() => {
        load().catch((caught) => {
            setError(caught instanceof Error ? caught.message : "Unable to load blog videos");
            setVideos([]);
        });
    }, [load]);

    const working = busy || (videos ?? []).some((video) => video.running);
    useEffect(() => {
        if (!working) return;
        const interval = window.setInterval(() => load().catch(() => undefined), 4_000);
        return () => window.clearInterval(interval);
    }, [working, load]);

    async function generate() {
        setStarting(true);
        setError("");
        try {
            const body = await api<{title: string}>("/api/admin/content-videos", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(choice ? {type, slug: choice} : {type})
            });
            onNotice(`Making a video from “${body.title}”. It takes a few minutes; this page updates as it goes.`);
            setChoice("");
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to start");
        } finally {
            setStarting(false);
        }
    }

    async function act(video: BlogVideo, action: "publish" | "unpublish" | "resume" | "rerender" | "archive") {
        if (action === "archive" && !window.confirm(`Archive the video for “${video.source_title}”? It comes off the page, and the page can get a new video.`)) return;
        setActing(video.id);
        setError("");
        try {
            await api(`/api/admin/content-videos/${video.id}`, {method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action})});
            if (action === "publish") onNotice(`Published on ${sourcePath(video.source_type, video.source_slug)}. ${video.source_type === "blog" ? "The post updates within five minutes." : "It shows on the page now, and is baked into the page's HTML at the next deploy."}`);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to update");
        } finally {
            setActing(null);
        }
    }

    const candidates = available[type] ?? [];
    const next = candidates[0];
    const matching = (videos ?? []).filter((video) => matchesFilter(video, filter, shares));
    const shown = matching.slice(0, limit);
    const counts = Object.fromEntries(FILTERS.map((entry) => [entry.value, (videos ?? []).filter((video) => matchesFilter(video, entry.value, shares)).length])) as Record<Filter, number>;

    return (
        <section className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
                <Segmented label="Show" value={filter} onChange={(next) => { setFilter(next); setLimit(PAGE); }} options={FILTERS.map((entry) => ({value: entry.value, label: entry.label, count: videos ? counts[entry.value] : null}))} />
                <Button size="sm" onClick={() => setMaking((open) => !open)} className="ml-auto" aria-expanded={making}>
                    <MagicStick3 size={15} />{making ? "Close" : "Make one now"}
                </Button>
            </div>

            {making ? (
                <Card className="mt-3">
                    <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                        <select value={type} onChange={(event) => { setType(event.target.value as SourceType); setChoice(""); }} disabled={working || starting} aria-label="Format" className={cn(fieldClass, "sm:w-56")}>
                            {SOURCE_TYPES.map((option) => <option key={option} value={option}>{SOURCE_LABELS[option]} ({available[option]?.length ?? 0})</option>)}
                        </select>
                        <select value={choice} onChange={(event) => setChoice(event.target.value)} disabled={working || starting} aria-label="Page" className={cn(fieldClass, "max-w-full sm:w-80")}>
                            <option value="">{next ? `Next: ${next.title}` : "Every page of this kind has a video"}</option>
                            {candidates.map((candidate) => (
                                <option key={candidate.slug} value={candidate.slug}>{candidate.title}{type === "blog" ? ` (${candidate.imageCount} photos)` : ""}</option>
                            ))}
                        </select>
                        <Button variant="primary" onClick={generate} loading={starting || working} disabled={!choice && !next} className="sm:ml-auto">
                            {starting || working ? null : <MagicStick3 size={18} />}{starting ? "Starting…" : working ? "Making a video…" : "Generate video"}
                        </Button>
                    </div>
                    <p className="border-t border-line-300 px-3 py-2 text-xs text-ink-500">The autopilot already makes up to two a day and posts them. Use this for one more, now.</p>
                </Card>
            ) : null}

            {!higgsfield || error ? (
                <div className="mt-3 flex flex-col gap-3">
                    {!higgsfield && <Alert tone="warn">HIGGSFIELD_API_KEY is not set on the server, so the AI-clip shots fall back to photo motion.</Alert>}
                    {error && <Alert tone="bad">{error}</Alert>}
                </div>
            ) : null}

            {videos === null ? (
                <div role="status" aria-label="Loading videos" className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {Array.from({length: 5}, (_, index) => (
                        <div key={index} aria-hidden="true" className="border border-line-300 bg-surface-900">
                            <Skeleton className="aspect-[9/16] w-full" />
                            <div className="flex flex-col gap-2 p-3"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-2.5 w-1/2" /></div>
                        </div>
                    ))}
                </div>
            ) : shown.length === 0 ? (
                <EmptyState className="mt-3" icon={<ClapperboardPlay size={22} />} title={videos.length ? "Nothing here" : "No videos yet"} description={videos.length ? "No video matches this filter." : "The autopilot makes the first one at its next run, or make one now."} />
            ) : (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {shown.map((video) => {
                        const videoShares = video.video_path ? shares.get(video.video_path) ?? [] : [];
                        const disabled = acting === video.id || video.running;
                        const footage = video.plan?.scenes.some((scene) => scene.footage) ?? false;
                        const silent = video.plan?.experiment?.voice === "no_voice";
                        return (
                            <article key={video.id} className="flex flex-col overflow-hidden border border-line-300 bg-surface-900">
                                {video.videoUrl
                                    ? <video src={video.videoUrl} poster={video.posterUrl ?? undefined} controls playsInline preload="none" className="aspect-[9/16] w-full bg-black object-cover" />
                                    : (
                                        <div className="grid aspect-[9/16] w-full place-items-center bg-canvas-950 p-3 text-center">
                                            {inProgress(video) && !interrupted(video)
                                                ? <div><Spinner size={22} className="mx-auto text-primary-300" /><p className="mt-2 text-[11px] leading-4 text-ink-400">{video.progress ?? STATUS_LABELS[video.status]}</p></div>
                                                : <div><ClapperboardPlay size={28} className="mx-auto text-ink-600" /><p className={cn("mt-2 text-[11px] leading-4", interrupted(video) ? "text-ink-400" : "text-red-200")}>{interrupted(video) ? "Waiting to resume" : STATUS_LABELS[video.status]}</p></div>}
                                        </div>
                                    )}
                                <div className="flex flex-1 flex-col gap-2 p-3">
                                    <div className="flex flex-wrap gap-1">
                                        <Badge>{SOURCE_LABELS[video.source_type] ?? video.source_type}</Badge>
                                        {footage ? <Badge tone="good">Real footage</Badge> : null}
                                        {silent ? <Badge tone="ios">No voice</Badge> : null}
                                    </div>
                                    <a href={`${siteUrl}${sourcePath(video.source_type, video.source_slug)}`} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm font-bold leading-5 text-white hover:text-primary-100">{video.source_title}</a>
                                    <p className="text-[11px] tabular-nums text-ink-500">
                                        {[new Date(video.created_at).toLocaleDateString(undefined, {month: "short", day: "numeric"}), video.duration_seconds ? `${Math.round(video.duration_seconds)}s` : null, video.estimated_usd ? `$${video.estimated_usd.toFixed(2)}` : null].filter(Boolean).join(" · ")}
                                    </p>
                                    <PostedTo shares={videoShares} ready={video.status === "ready"} />
                                    {video.status === "failed" && video.error ? <p className="line-clamp-3 text-[11px] leading-4 text-red-200" title={video.error}>{video.error}</p> : null}
                                    {video.plan ? (
                                        <details className="text-xs text-ink-300">
                                            <summary className="cursor-pointer text-[11px] font-bold text-ink-500 hover:text-white">Script</summary>
                                            {video.plan.hookText ? <p className="mt-2 font-bold text-white">“{video.plan.hookText}”</p> : null}
                                            <ol className="mt-1.5 flex flex-col gap-1">
                                                {video.plan.scenes.map((scene, index) => <li key={index} className="leading-5">{scene.footage ? <span className="mr-1 text-[9px] font-black uppercase text-primary-200">Ours</span> : null}{scene.narration}</li>)}
                                            </ol>
                                        </details>
                                    ) : null}
                                    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                                        {acting === video.id ? <Spinner size={14} className="text-primary-300" /> : null}
                                        {video.status === "ready" && (
                                            <>
                                                <Button size="sm" variant="primary" onClick={() => onShare(video)} disabled={disabled}><Share size={14} />Share</Button>
                                                {video.published_at ? null : <Button size="sm" onClick={() => act(video, "publish")} disabled={disabled}><Eye size={14} />Show on page</Button>}
                                            </>
                                        )}
                                        {(video.status === "failed" || interrupted(video)) && (
                                            <Button size="sm" variant="primary" onClick={() => act(video, "resume")} disabled={disabled || working}><Refresh size={14} />Resume</Button>
                                        )}
                                        {!video.running && (
                                            <details className="relative ml-auto">
                                                <summary className="cursor-pointer list-none px-2 py-1 text-xs font-black text-ink-400 hover:text-white" aria-label="More actions">•••</summary>
                                                <div className="absolute bottom-full right-0 z-10 mb-1 flex w-40 flex-col border border-line-300 bg-canvas-900 p-1">
                                                    {video.status === "ready" ? <button type="button" onClick={() => act(video, "rerender")} disabled={disabled || working} className="px-2 py-1.5 text-left text-xs text-ink-200 hover:bg-white/5 disabled:opacity-50">Re-edit (no new spend)</button> : null}
                                                    {video.published_at ? <button type="button" onClick={() => act(video, "unpublish")} disabled={disabled} className="px-2 py-1.5 text-left text-xs text-ink-200 hover:bg-white/5"><EyeClosed size={12} className="mr-1 inline" />Take off the page</button> : null}
                                                    <button type="button" onClick={() => act(video, "archive")} disabled={disabled} className="px-2 py-1.5 text-left text-xs text-red-200 hover:bg-red-400/10"><TrashBinMinimalistic size={12} className="mr-1 inline" />Archive</button>
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
            {matching.length > shown.length ? (
                <div className="mt-4 flex justify-center">
                    <Button size="sm" onClick={() => setLimit((current) => current + PAGE)}>Show more ({matching.length - shown.length} older)</Button>
                </div>
            ) : null}
        </section>
    );
}

/** Videos shown at a time, newest first. */
const PAGE = 20;

type Filter = "all" | "posted" | "waiting" | "making" | "failed";

const FILTERS: Array<{value: Filter; label: string}> = [
    {value: "all", label: "All"},
    {value: "posted", label: "Posted"},
    {value: "waiting", label: "Waiting to post"},
    {value: "making", label: "In progress"},
    {value: "failed", label: "Failed"}
];

function matchesFilter(video: BlogVideo, filter: Filter, shares: Map<string, SocialPostRow[]>) {
    const posted = Boolean(video.video_path && (shares.get(video.video_path) ?? []).some((post) => post.status === "published"));
    switch (filter) {
        case "all": return true;
        case "posted": return posted;
        case "waiting": return video.status === "ready" && !posted;
        case "making": return inProgress(video) && !interrupted(video);
        case "failed": return video.status === "failed" || interrupted(video);
    }
}

/** Where a video went: one small chip per platform, green once it is live there. */
function PostedTo({shares, ready}: {shares: SocialPostRow[]; ready: boolean}) {
    if (!shares.length) return ready ? <p className="text-[11px] text-ink-500">Not posted yet: the auto-share picks it up.</p> : null;
    const latest = new Map<string, SocialPostRow>();
    for (const post of shares) if (!latest.has(post.platform) || post.status === "published") latest.set(post.platform, post);
    return (
        <div className="flex flex-wrap gap-1">
            {Array.from(latest.values()).map((post) => (
                <span key={post.platform} title={post.error ?? post.status} className={cn("px-1.5 py-0.5 text-[10px] font-bold", post.status === "published" ? "bg-primary-400/15 text-primary-100" : post.status === "failed" ? "bg-red-400/15 text-red-200" : "bg-white/5 text-ink-400")}>
                    {SOCIAL_PLATFORM_LABELS[post.platform]}{post.status === "published" ? " ✓" : post.status === "failed" ? " ✕" : "…"}
                </span>
            ))}
        </div>
    );
}
