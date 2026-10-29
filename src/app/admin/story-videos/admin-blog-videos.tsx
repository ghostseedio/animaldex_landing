"use client";

import {useCallback, useEffect, useState} from "react";
import {ClapperboardPlay, Eye, EyeClosed, MagicStick3, Refresh, Share, TrashBinMinimalistic} from "solar-icon-set";
import {SOURCE_TYPES, type SourceType, type TimelineEntry, type VideoPlan} from "@/lib/content-video/plan";
import {SOURCE_LABELS, sourcePath} from "@/lib/content-video/source-paths";
import {INTENTS} from "@/lib/social-lab/arms";
import {jobScore, REACTIONS, type VideoReview} from "@/lib/social-lab/review";
import type {ContentVideoClip, ContentVideoStatus} from "@/lib/content-video/store";
import {SOCIAL_PLATFORM_LABELS, type SocialPostRow} from "@/lib/social/types";
import {Alert, Badge, Button, Card, cn, EmptyState, fieldClass, Section, Skeleton, Spinner} from "@/components/admin/ui";

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
        <Section
            title={<>Page videos {videos ? <span className="tabular-nums">({videos.length})</span> : ""}</>}
            description="Viral vertical videos made from our pages: blog edits, Pokémon-style comparison battles, hybrid reveals, ranking countdowns and location guides. Publish one to show it on its page."
        >
            <Card>
                <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                    <select value={type} onChange={(event) => { setType(event.target.value as SourceType); setChoice(""); }} disabled={working || starting} aria-label="Page type" className={cn(fieldClass, "sm:w-56")}>
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
            </Card>

            {!higgsfield || error ? (
                <div className="mt-3 flex flex-col gap-3">
                    {!higgsfield && (
                        <Alert tone="warn">HIGGSFIELD_API_KEY is not set on the server, so the AI-clip shots fall back to photo motion.</Alert>
                    )}
                    {error && <Alert tone="bad">{error}</Alert>}
                </div>
            ) : null}

            {videos === null ? (
                <div role="status" aria-label="Loading blog videos" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({length: 4}, (_, index) => (
                        <div key={index} aria-hidden="true" className="grid grid-cols-[7.5rem_1fr] gap-3 border border-line-300 bg-surface-900 p-3">
                            <Skeleton className="aspect-[9/16] w-full" />
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-3.5 w-16" />
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-3/4" />
                                <Skeleton className="mt-1 h-2.5 w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : videos.length === 0 ? (
                <EmptyState className="mt-3" icon={<ClapperboardPlay size={22} />} title="No page videos yet" description="Pick a page type, then generate the next one or choose a page." />
            ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {videos.map((video) => {
                        const videoShares = video.video_path ? shares.get(video.video_path) ?? [] : [];
                        const clipsReady = video.clips.filter((clip) => clip.status === "completed").length;
                        const clipsWanted = video.plan?.scenes.filter((scene) => scene.visual === "ai_clip").length ?? 0;
                        const disabled = acting === video.id || video.running;
                        return (
                            <article key={video.id} className="flex flex-col overflow-hidden border border-line-300 bg-surface-900">
                                <div className="grid grid-cols-[7.5rem_1fr] gap-3 p-3">
                                    {video.videoUrl
                                        ? <video src={video.videoUrl} poster={video.posterUrl ?? undefined} controls playsInline preload="none" className="aspect-[9/16] w-full bg-black object-cover" />
                                        : (
                                            <div className="grid aspect-[9/16] w-full place-items-center border border-line-300 bg-canvas-950 p-2 text-center">
                                                {inProgress(video) && !interrupted(video)
                                                    ? <div><Spinner size={22} className="mx-auto text-primary-300" /><p className="mt-2 text-[10px] leading-4 text-ink-400">{video.progress ?? STATUS_LABELS[video.status]}</p></div>
                                                    : <ClapperboardPlay size={28} className="text-ink-600" />}
                                            </div>
                                        )}
                                    <div className="flex min-w-0 flex-col gap-1.5">
                                        <div className="flex flex-wrap gap-1">
                                            <Badge tone={video.status === "ready" ? "good" : video.status === "failed" || interrupted(video) ? "bad" : "warn"}>{interrupted(video) ? "Interrupted" : STATUS_LABELS[video.status]}</Badge>
                                            <Badge>{SOURCE_LABELS[video.source_type] ?? video.source_type}</Badge>
                                            {video.published_at ? <Badge tone="ios">On the page</Badge> : null}
                                        </div>
                                        <a href={`${siteUrl}${sourcePath(video.source_type, video.source_slug)}`} target="_blank" rel="noreferrer" className="line-clamp-3 text-sm font-bold leading-5 text-white hover:text-primary-100">{video.source_title}</a>
                                        {video.plan?.hookText ? <p className="line-clamp-2 text-[11px] text-ink-300">“{video.plan.hookText}”</p> : null}
                                        {video.plan?.review ? <ReviewBadges review={video.plan.review} /> : null}
                                        <p className="text-[11px] leading-4 tabular-nums text-ink-500">
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
                                                    <Badge key={post.id} title={post.error ?? undefined} tone={post.status === "published" ? "good" : post.status === "failed" ? "bad" : "warn"} className="normal-case tracking-normal">{SOCIAL_PLATFORM_LABELS[post.platform]}: {post.status}</Badge>
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
                                                    <span className={`mr-1.5 px-1 text-[9px] font-black uppercase ${scene.visual === "ai_clip" ? "bg-violet-400/15 text-violet-100" : "bg-white/5 text-ink-400"}`}>{index === 0 ? "Hook" : scene.visual === "card" ? "Card" : scene.visual === "ai_clip" ? (scene.chain ? "AI (cont.)" : scene.keyframePrompt ? "AI (drawn)" : "AI clip") : `Photo ${scene.image}`}</span>
                                                    {scene.narration}
                                                    {scene.overlay ? <span className="text-ink-500"> [{scene.overlay}]</span> : null}
                                                </li>
                                            ))}
                                            <li className="leading-5 text-ink-400"><span className="mr-1.5 bg-white/5 px-1 text-[9px] font-black uppercase">End</span>{video.plan.ctaNarration}</li>
                                        </ol>
                                        {video.plan.review ? <ReviewDetails review={video.plan.review} /> : null}
                                    </details>
                                )}

                                <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-line-300 p-3">
                                    {acting === video.id ? <Spinner size={14} className="text-primary-300" /> : null}
                                    {video.status === "ready" && (
                                        <>
                                            {video.published_at
                                                ? <Button size="sm" onClick={() => act(video, "unpublish")} disabled={disabled}><EyeClosed size={14} />Unpublish</Button>
                                                : <Button size="sm" variant="primary" onClick={() => act(video, "publish")} disabled={disabled} className="bg-sky-400 hover:bg-sky-300"><Eye size={14} />Publish to page</Button>}
                                            <Button size="sm" variant="primary" onClick={() => onShare(video)} disabled={disabled}><Share size={14} />Share</Button>
                                            <Button size="sm" onClick={() => act(video, "rerender")} disabled={disabled || working} title="Re-edit from the same script and clips (no new AI spend)"><Refresh size={14} />Re-edit</Button>
                                        </>
                                    )}
                                    {(video.status === "failed" || interrupted(video)) && (
                                        <Button size="sm" variant="primary" onClick={() => act(video, "resume")} disabled={disabled || working} className="bg-amber-300 hover:bg-amber-200"><Refresh size={14} />Resume</Button>
                                    )}
                                    {!video.running && (
                                        <Button size="sm" variant="danger" onClick={() => act(video, "archive")} disabled={disabled} className="ml-auto"><TrashBinMinimalistic size={14} />Archive</Button>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </Section>
    );
}

/** The test audience's verdict, at a glance: the job, the 5-year-old test and the job's score. */
function ReviewBadges({review}: {review: VideoReview}) {
    return (
        <div className="flex flex-wrap gap-1" title={`A 5-year-old would say: ${review.fiveYearOld.wouldSay}`}>
            {review.job ? <Badge className="normal-case tracking-normal">Job: {INTENTS[review.job].label}</Badge> : null}
            <Badge tone={review.fiveYearOld.passes ? "good" : "bad"} className="normal-case tracking-normal">5-year-old test {review.fiveYearOld.passes ? "passed" : "failed"}</Badge>
            <Badge tone={review.passes ? "good" : "warn"} className="normal-case tracking-normal">{review.job ? INTENTS[review.job].label.split(" ")[0] : "Best"} {jobScore(review)}/10{review.rewritten ? " · rewritten" : ""}</Badge>
        </div>
    );
}

function ReviewDetails({review}: {review: VideoReview}) {
    return (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-line-300 pt-2">
            <p className="font-bold text-ink-400">Test audience{review.rewritten && review.firstDraft ? ` (first draft: ${review.firstDraft.jobScore}/10, 5-year-old test ${review.firstDraft.fiveYearOld ? "passed" : "failed"})` : ""}</p>
            <p className="leading-5">A 5-year-old would say: “{review.fiveYearOld.wouldSay}”{review.fiveYearOld.hardWords.length ? <span className="text-amber-200"> · hard words: {review.fiveYearOld.hardWords.join(", ")}</span> : null}</p>
            <ul className="flex flex-col gap-1">
                {REACTIONS.map((reaction) => (
                    <li key={reaction} className={`leading-5 ${reaction === review.job ? "text-white" : "text-ink-400"}`}>
                        <span className="mr-1.5 tabular-nums">{INTENTS[reaction].label.split(" ")[0]} {review.scores[reaction].score}/10</span>{review.scores[reaction].reason}
                    </li>
                ))}
            </ul>
        </div>
    );
}
