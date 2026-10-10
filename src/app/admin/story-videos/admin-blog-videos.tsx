"use client";

import {useCallback, useEffect, useState} from "react";
import {ClapperboardPlay, DangerTriangle, Eye, EyeClosed, MagicStick3, Refresh, Share, TrashBinMinimalistic} from "solar-icon-set";
import {SOURCE_TYPES, type SourceType, type TimelineEntry, type VideoPlan} from "@/lib/content-video/plan";
import {SOURCE_LABELS, sourcePath} from "@/lib/content-video/source-paths";
import type {ContentVideoClip, ContentVideoStatus} from "@/lib/content-video/store";
import {SOCIAL_PLATFORM_LABELS, type SocialPostRow} from "@/lib/social/types";

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

    return (
        <section className="mt-8">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h2 className="text-xs font-black uppercase tracking-[.18em] text-ink-400">Page videos {videos ? `(${videos.length})` : ""}</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-400">Viral vertical videos made from our pages: blog edits, Pokémon-style comparison battles, hybrid reveals, ranking countdowns and location guides. Publish one to show it on its page.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select value={type} onChange={(event) => { setType(event.target.value as SourceType); setChoice(""); }} disabled={working || starting} aria-label="Page type" className="rounded-xl border border-line-300 bg-surface-900 px-3 py-2.5 text-sm text-white outline-none focus:border-primary-300">
                        {SOURCE_TYPES.map((option) => <option key={option} value={option}>{SOURCE_LABELS[option]} ({available[option]?.length ?? 0})</option>)}
                    </select>
                    <select value={choice} onChange={(event) => setChoice(event.target.value)} disabled={working || starting} aria-label="Page" className="max-w-full rounded-xl border border-line-300 bg-surface-900 px-3 py-2.5 text-sm text-white outline-none focus:border-primary-300 sm:w-80">
                        <option value="">{next ? `Next: ${next.title}` : "Every page of this kind has a video"}</option>
                        {candidates.map((candidate) => (
                            <option key={candidate.slug} value={candidate.slug}>{candidate.title}{type === "blog" ? ` (${candidate.imageCount} photos)` : ""}</option>
                        ))}
                    </select>
                    <button onClick={generate} disabled={working || starting || (!choice && !next)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-400 px-5 py-2.5 text-sm font-black text-canvas-950 disabled:opacity-50">
                        <MagicStick3 size={18} />{starting ? "Starting…" : working ? "Making a video…" : "Generate video"}
                    </button>
                </div>
            </div>

            {!higgsfield && (
                <p className="mt-3 flex gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100"><DangerTriangle size={16} className="shrink-0" />HIGGSFIELD_API_KEY is not set on the server, so the AI-clip shots fall back to photo motion.</p>
            )}
            {error && <div className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

            {videos === null ? <div className="grid min-h-[10rem] place-items-center text-sm text-ink-400">Loading blog videos…</div> : videos.length === 0 ? (
                <div className="mt-3 grid min-h-[12rem] place-items-center rounded-2xl border border-dashed border-line-300 text-center"><div><ClapperboardPlay size={38} className="mx-auto text-ink-500" /><p className="mt-3 font-bold text-white">No page videos yet</p><p className="mt-1 text-sm text-ink-500">Pick a page type, then generate the next one or choose a page.</p></div></div>
            ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {videos.map((video) => {
                        const videoShares = video.video_path ? shares.get(video.video_path) ?? [] : [];
                        const clipsReady = video.clips.filter((clip) => clip.status === "completed").length;
                        const clipsWanted = video.plan?.scenes.filter((scene) => scene.visual === "ai_clip").length ?? 0;
                        const disabled = acting === video.id || video.running;
                        return (
                            <article key={video.id} className="flex flex-col overflow-hidden rounded-2xl border border-line-300 bg-surface-900">
                                <div className="grid grid-cols-[7.5rem_1fr] gap-3 p-3">
                                    {video.videoUrl
                                        ? <video src={video.videoUrl} poster={video.posterUrl ?? undefined} controls playsInline preload="none" className="aspect-[9/16] w-full rounded-lg bg-black object-cover" />
                                        : (
                                            <div className="grid aspect-[9/16] w-full place-items-center rounded-lg bg-black/40 p-2 text-center">
                                                {inProgress(video) && !interrupted(video)
                                                    ? <div><span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-primary-300 border-t-transparent" /><p className="mt-2 text-[10px] leading-4 text-ink-400">{video.progress ?? STATUS_LABELS[video.status]}</p></div>
                                                    : <ClapperboardPlay size={28} className="text-ink-600" />}
                                            </div>
                                        )}
                                    <div className="flex min-w-0 flex-col gap-1.5">
                                        <div className="flex flex-wrap gap-1">
                                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${video.status === "ready" ? "bg-primary-500/15 text-primary-100" : video.status === "failed" || interrupted(video) ? "bg-red-500/15 text-red-200" : "bg-amber-400/15 text-amber-100"}`}>{interrupted(video) ? "Interrupted" : STATUS_LABELS[video.status]}</span>
                                            <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-black uppercase text-ink-300">{SOURCE_LABELS[video.source_type] ?? video.source_type}</span>
                                            {video.published_at ? <span className="rounded-full bg-sky-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-100">On the page</span> : null}
                                        </div>
                                        <a href={`${siteUrl}${sourcePath(video.source_type, video.source_slug)}`} target="_blank" rel="noreferrer" className="line-clamp-3 text-sm font-bold leading-5 text-white hover:text-primary-100">{video.source_title}</a>
                                        {video.plan?.hookText ? <p className="line-clamp-2 text-[11px] text-ink-300">“{video.plan.hookText}”</p> : null}
                                        <p className="text-[11px] leading-4 text-ink-500">
                                            {[
                                                video.duration_seconds ? `${Math.round(video.duration_seconds)}s` : null,
                                                clipsWanted ? `${clipsReady}/${clipsWanted} AI clips` : null,
                                                video.estimated_usd ? `$${video.estimated_usd.toFixed(2)}` : null,
                                                video.llm_provider ? `script: ${video.llm_provider}` : null,
                                                video.tts_provider ? `voice: ${video.tts_provider}` : null
                                            ].filter(Boolean).join(" · ")}
                                        </p>
                                        {video.status === "failed" && video.error ? <p className="line-clamp-4 text-[11px] leading-4 text-red-200" title={video.error}>{video.error}</p> : null}
                                        {videoShares.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {videoShares.map((post) => (
                                                    <span key={post.id} title={post.error ?? undefined} className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${post.status === "published" ? "bg-primary-500/15 text-primary-100" : post.status === "failed" ? "bg-red-500/15 text-red-200" : "bg-amber-400/15 text-amber-100"}`}>{SOCIAL_PLATFORM_LABELS[post.platform]}: {post.status}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {video.plan && (
                                    <details className="border-t border-line-300 px-3 py-2 text-xs text-ink-300">
                                        <summary className="cursor-pointer font-bold text-ink-400 hover:text-white">Script & shots</summary>
                                        <ol className="mt-2 flex flex-col gap-1.5">
                                            {video.plan.scenes.map((scene, index) => (
                                                <li key={index} className="leading-5">
                                                    <span className={`mr-1.5 rounded px-1 text-[9px] font-black uppercase ${scene.visual === "ai_clip" ? "bg-violet-400/15 text-violet-100" : "bg-white/5 text-ink-400"}`}>{index === 0 ? "Hook" : scene.visual === "card" ? "Card" : scene.visual === "ai_clip" ? (scene.chain ? "AI (cont.)" : scene.keyframePrompt ? "AI (drawn)" : "AI clip") : `Photo ${scene.image}`}</span>
                                                    {scene.narration}
                                                    {scene.overlay ? <span className="text-ink-500"> [{scene.overlay}]</span> : null}
                                                </li>
                                            ))}
                                            <li className="leading-5 text-ink-400"><span className="mr-1.5 rounded bg-white/5 px-1 text-[9px] font-black uppercase">End</span>{video.plan.ctaNarration}</li>
                                        </ol>
                                    </details>
                                )}

                                <div className="mt-auto flex flex-wrap gap-1.5 border-t border-line-300 p-3">
                                    {video.status === "ready" && (
                                        <>
                                            {video.published_at
                                                ? <button onClick={() => act(video, "unpublish")} disabled={disabled} className="inline-flex items-center gap-1 rounded-lg border border-line-300 px-2.5 py-1.5 text-xs font-bold text-white hover:border-primary-300 disabled:opacity-50"><EyeClosed size={14} />Unpublish</button>
                                                : <button onClick={() => act(video, "publish")} disabled={disabled} className="inline-flex items-center gap-1 rounded-lg bg-sky-400 px-2.5 py-1.5 text-xs font-black text-canvas-950 disabled:opacity-50"><Eye size={14} />Publish to page</button>}
                                            <button onClick={() => onShare(video)} disabled={disabled} className="inline-flex items-center gap-1 rounded-lg bg-primary-400 px-2.5 py-1.5 text-xs font-black text-canvas-950 disabled:opacity-50"><Share size={14} />Share</button>
                                            <button onClick={() => act(video, "rerender")} disabled={disabled || working} title="Re-edit from the same script and clips (no new AI spend)" className="inline-flex items-center gap-1 rounded-lg border border-line-300 px-2.5 py-1.5 text-xs font-bold text-white hover:border-primary-300 disabled:opacity-50"><Refresh size={14} />Re-edit</button>
                                        </>
                                    )}
                                    {(video.status === "failed" || interrupted(video)) && (
                                        <button onClick={() => act(video, "resume")} disabled={disabled || working} className="inline-flex items-center gap-1 rounded-lg bg-amber-300 px-2.5 py-1.5 text-xs font-black text-canvas-950 disabled:opacity-50"><Refresh size={14} />Resume</button>
                                    )}
                                    {!video.running && (
                                        <button onClick={() => act(video, "archive")} disabled={disabled} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-red-400/20 px-2.5 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50"><TrashBinMinimalistic size={14} />Archive</button>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
