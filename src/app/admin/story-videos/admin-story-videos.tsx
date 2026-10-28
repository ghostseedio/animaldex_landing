"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import {CheckCircle, ClapperboardPlay, CloseCircle, PlugCircle, Refresh, Share} from "solar-icon-set";
import {X_POST_LIMIT, xLength} from "@/lib/social/captions";
import {COPY_LIMITS, type ShareCopy, VISIBLE_CHARS} from "@/lib/social/share-copy";
import {EMPTY_TIKTOK_OPTIONS, TIKTOK_PRIVACY_LABELS, tiktokOptionsProblem} from "@/lib/social/tiktok-options";
import type {TikTokAccountInfo} from "@/lib/social/zernio-core";
import {MANUAL_SHARE_PLATFORMS, type ManualSharePlatform, SOCIAL_PLATFORM_LABELS, SOCIAL_PLATFORMS, type SocialPlatform, type SocialPostMode, type SocialPostRow, type TikTokPostOptions, type ZernioShareInfo} from "@/lib/social/types";
import AdminBlogVideos, {type BlogVideo} from "@/app/admin/story-videos/admin-blog-videos";
import AdminAutomation from "@/app/admin/story-videos/admin-automation";
import {AdminHookLab, AdminSocialContent} from "@/app/admin/story-videos/admin-growth-lab";
import AdminTrendRadar from "@/app/admin/story-videos/admin-trend-radar";
import AdminUploadedVideos, {type UploadedVideo} from "@/app/admin/story-videos/admin-uploaded-videos";
import {sourcePath} from "@/lib/content-video/source-paths";
import {AdminPage, Alert, Badge, Button, buttonVariants, Card, cn, EmptyState, PageHeader, RefreshButton, Section, Skeleton, Spinner, Table, TableSkeleton, TD, TH} from "@/components/admin/ui";

type Video = {
    mediaPath: string;
    kind: "story_video" | "hook" | "trial_scene" | "still" | "blog_video" | "uploaded_video";
    locale: string | null;
    stableUrl: string;
    /** A still of the species, so the card is not a black box until played. */
    posterUrl?: string | null;
    durationSeconds: number | null;
    hasAudio: boolean;
    script: string | null;
    videoHook: string | null;
    captureId: string | null;
    createdAt: string;
    speciesProfileId: string;
    speciesName: string;
    pageSlug: string;
    /** Set for blog videos: shared by id, linked to the post instead of an animal page. */
    contentVideoId?: string;
    pagePath?: string;
    /** Set for uploaded videos: shared by id; real footage, so not labelled AI-made. */
    uploadedVideoId?: string;
};

function blogVideoToShareable(video: BlogVideo): Video {
    return {
        mediaPath: video.video_path ?? "",
        kind: "blog_video",
        locale: "en",
        stableUrl: video.videoUrl ?? "",
        durationSeconds: video.duration_seconds,
        hasAudio: true,
        script: video.plan?.scenes.map((scene) => scene.narration).join(" ") ?? null,
        videoHook: video.plan?.hookText ?? null,
        captureId: null,
        createdAt: video.created_at,
        speciesProfileId: "",
        speciesName: video.source_title,
        pageSlug: video.source_slug,
        contentVideoId: video.id,
        pagePath: sourcePath(video.source_type, video.source_slug)
    };
}

function uploadedVideoToShareable(video: UploadedVideo): Video {
    return {
        mediaPath: video.video_path,
        kind: "uploaded_video",
        locale: "en",
        stableUrl: video.videoUrl,
        durationSeconds: video.duration_seconds,
        hasAudio: true,
        script: video.notes || null,
        videoHook: null,
        captureId: null,
        createdAt: video.created_at,
        speciesProfileId: "",
        speciesName: video.title,
        pageSlug: "",
        uploadedVideoId: video.id,
        pagePath: "/"
    };
}

type Connection = {
    platform: SocialPlatform;
    /** "oauth" = our own app connection; "zernio" = posted through Zernio (TikTok). Missing = oauth. */
    provider?: "oauth" | "zernio";
    configured: boolean;
    connected: boolean;
    accountName: string | null;
    expiresAt: string | null;
    envNames: {id: string; secret: string};
    redirectUri: string | null;
    manageUrl?: string | null;
    error?: string | null;
};

const KIND_LABELS: Record<Video["kind"], string> = {
    story_video: "Narrated story",
    hook: "Animated capture",
    trial_scene: "Trial scene",
    still: "Still",
    blog_video: "Page video",
    uploaded_video: "Uploaded video"
};

/** Longest video each platform takes through our share path (Facebook Reels API, X without Premium). */
const MAX_SECONDS: Partial<Record<SocialPlatform, number>> = {facebook: 90, x: 140};
/** YouTube posts longer videos as regular uploads rather than Shorts. */
const YOUTUBE_SHORTS_MAX_SECONDS = 180;

/** Not-yet-public options. TikTok drafts go to the account's inbox through Zernio. */
const DRAFT_LABELS: Partial<Record<SocialPlatform, string>> = {
    youtube: "Upload as private",
    tiktok: "Send to TikTok inbox (draft)",
    facebook: "Save as draft"
};

const STALE_MS = 30 * 60_000;

// Mirrors scheduleProblem() in src/lib/social/zernio-core.ts (the server checks the same).
const MIN_SCHEDULE_LEAD_MS = 2 * 60_000;
const MAX_SCHEDULE_DAYS = 30;
const SCHEDULE_PICKER_LEAD_MS = 5 * 60_000;

const BROWSER_TIMEZONE = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

async function api<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, {cache: "no-store", ...init});
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Request failed (${response.status})`);
    return body as T;
}

function zernioInfo(post: SocialPostRow): ZernioShareInfo | null {
    const info = post.options?.zernio;
    return info && typeof info.postId === "string" && info.postId ? info : null;
}

/** A TikTok post waiting in Zernio for its scheduled time. */
function isScheduled(post: SocialPostRow) {
    return post.status === "queued" && Boolean(zernioInfo(post)?.scheduledFor);
}

function statusTone(post: SocialPostRow): "good" | "bad" | "warn" {
    if (post.status === "published") return "good";
    if (post.status === "failed") return "bad";
    return "warn";
}

/** In-process uploads that stopped reporting. Posts handed to Zernio are tracked there, so they never go stale. */
function isStale(post: SocialPostRow) {
    if (zernioInfo(post)) return false;
    return (post.status === "queued" || post.status === "processing") && Date.now() - Date.parse(post.updated_at) > STALE_MS;
}

function inFlight(post: SocialPostRow) {
    return (post.status === "queued" || post.status === "processing") && !isStale(post);
}

function statusLabel(post: SocialPostRow) {
    if (isStale(post)) return "stale";
    if (isScheduled(post)) return "scheduled";
    return post.status;
}

function formatLocal(iso: string) {
    const time = Date.parse(iso);
    return Number.isFinite(time) ? new Date(time).toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"}) : iso;
}

/** A Date as the value a <input type="datetime-local"> wants (local wall time, minute precision). */
function toLocalInputValue(date: Date) {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Null when the picked local time can be scheduled, otherwise why not (same rules as the server). */
function localScheduleProblem(localValue: string, now = Date.now()): string | null {
    if (!localValue) return "Pick a time to schedule the TikTok post, or post now";
    const time = new Date(localValue).getTime();
    if (!Number.isFinite(time)) return "The schedule time is not a valid date";
    if (time < now + MIN_SCHEDULE_LEAD_MS) return "Schedule at least a few minutes ahead, or post now";
    if (time > now + MAX_SCHEDULE_DAYS * 86_400_000) return `Schedule within the next ${MAX_SCHEDULE_DAYS} days`;
    return null;
}

export default function AdminStoryVideos({siteUrl}: {siteUrl: string}) {
    const [videos, setVideos] = useState<Video[] | null>(null);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [posts, setPosts] = useState<SocialPostRow[]>([]);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [sharing, setSharing] = useState<Video | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [cancelling, setCancelling] = useState<string | null>(null);

    const loadPosts = useCallback(async () => {
        const body = await api<{posts: SocialPostRow[]}>("/api/admin/social/posts");
        setPosts(body.posts);
    }, []);

    const loadAll = useCallback(async () => {
        setError("");
        const results = await Promise.allSettled([
            api<{videos: Video[]}>("/api/admin/social/videos").then((body) => setVideos(body.videos)),
            api<{connections: Connection[]}>("/api/admin/social/connections").then((body) => setConnections(body.connections)),
            loadPosts()
        ]);
        const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
        if (failed) setError(failed.reason instanceof Error ? failed.reason.message : "Unable to load");
        setVideos((current) => current ?? []);
    }, [loadPosts]);

    useEffect(() => {
        loadAll();
        const params = new URLSearchParams(window.location.search);
        const connected = params.get("connected");
        const connectError = params.get("connectError");
        if (connected) setNotice(`${SOCIAL_PLATFORM_LABELS[connected as SocialPlatform] ?? connected} connected.`);
        if (connectError) setError(connectError);
        if (connected || connectError) window.history.replaceState(null, "", window.location.pathname);
    }, [loadAll]);

    // Poll the log while anything is still uploading or publishing. Posts merely waiting for
    // their scheduled time in Zernio only need an occasional check (the server reconciles on GET).
    const activeInFlight = posts.some((post) => inFlight(post) && !isScheduled(post));
    const scheduledInFlight = posts.some(isScheduled);
    const pollMs = activeInFlight ? 5_000 : scheduledInFlight ? 30_000 : 0;
    useEffect(() => {
        if (!pollMs) return;
        const interval = window.setInterval(() => loadPosts().catch(() => undefined), pollMs);
        return () => window.clearInterval(interval);
    }, [pollMs, loadPosts]);

    const postsByVideo = useMemo(() => {
        const map = new Map<string, SocialPostRow[]>();
        for (const post of posts) map.set(post.media_path, [...(map.get(post.media_path) ?? []), post]);
        return map;
    }, [posts]);

    async function disconnect(platform: SocialPlatform) {
        if (!window.confirm(`Disconnect ${SOCIAL_PLATFORM_LABELS[platform]}? Sharing to it stops until it is connected again.`)) return;
        try {
            await api(`/api/admin/social/connections?platform=${platform}`, {method: "DELETE"});
            await loadAll();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to disconnect");
        }
    }

    async function cancelScheduled(post: SocialPostRow) {
        const when = zernioInfo(post)?.scheduledFor;
        if (!window.confirm(`Cancel the TikTok post scheduled for ${when ? formatLocal(when) : "later"}? It is removed from Zernio and can be shared again.`)) return;
        setCancelling(post.id);
        setError("");
        try {
            await api(`/api/admin/social/posts?id=${encodeURIComponent(post.id)}`, {method: "DELETE"});
            setNotice("Scheduled TikTok post cancelled.");
            await loadPosts();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to cancel the scheduled post");
        } finally {
            setCancelling(null);
        }
    }

    return (
        <AdminPage width="wide">
            <PageHeader
                eyebrow="Content"
                title="Story videos"
                description="Videos made from blog posts here, and every finished, narrated story video the app serves. Share any of them to the official AnimalDex accounts; uploads run in the background and land in the log below."
                actions={<RefreshButton loading={refreshing || videos === null} onClick={() => { setRefreshing(true); loadAll().finally(() => setRefreshing(false)); }} />}
            />

            {error || notice ? (
                <div className="mt-6 flex flex-col gap-3">
                    {error && <Alert tone="bad">{error}</Alert>}
                    {notice && <Alert tone="good">{notice}</Alert>}
                </div>
            ) : null}

            <AdminAutomation onChanged={() => void loadAll()} />

            <AdminTrendRadar />

            <AdminHookLab />

            <AdminSocialContent />

            <Section title="Official accounts">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {SOCIAL_PLATFORMS.map((platform) => {
                        const connection = connections.find((candidate) => candidate.platform === platform);
                        const viaZernio = connection?.provider === "zernio";
                        return (
                            <article key={platform} className="flex flex-col gap-3 border border-line-300 bg-surface-900 p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-bold text-white">{SOCIAL_PLATFORM_LABELS[platform]}</p>
                                    {connection?.error
                                        ? <Badge tone="bad">Needs attention</Badge>
                                        : connection?.connected
                                        ? <Badge tone="good"><CheckCircle size={12} iconStyle="Bold" />Connected</Badge>
                                        : connection ? <Badge>{connection.configured ? "Not connected" : "Not set up"}</Badge> : <Skeleton className="h-4 w-20" />}
                                </div>
                                {!connection ? (
                                    <div aria-label="Loading" className="mt-auto flex flex-col gap-2">
                                        <Skeleton className="h-3 w-2/3" />
                                        <Skeleton className="h-8 w-full" />
                                    </div>
                                ) : viaZernio ? (
                                    <>
                                        {connection.connected ? (
                                            <>
                                                <p className="text-sm text-ink-300">Posting through Zernio{connection.accountName ? <> as <span className="text-white">{connection.accountName}</span></> : null}</p>
                                                {connection.error ? <p className="text-xs leading-5 text-amber-200">{connection.error}</p> : null}
                                            </>
                                        ) : connection.configured ? (
                                            <p className={`text-xs leading-5 ${platform === "tiktok" ? "text-red-200" : "text-ink-400"}`}>
                                                {platform === "tiktok"
                                                    ? connection.error || "Zernio has no connected TikTok account for this id."
                                                    : `Connect the ${SOCIAL_PLATFORM_LABELS[platform]} account in the Zernio dashboard; it is picked up here automatically and the auto-share starts posting to it.`}
                                            </p>
                                        ) : (
                                            <p className="text-xs leading-5 text-ink-500">
                                                Set <code className="text-ink-300">{connection.envNames.id}</code>{platform === "tiktok" ? <> and <code className="text-ink-300">{connection.envNames.secret}</code></> : null} on the server. Zernio holds the {SOCIAL_PLATFORM_LABELS[platform]} connection; this app keeps no credentials for it.
                                            </p>
                                        )}
                                        {connection.manageUrl ? (
                                            <a href={connection.manageUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({size: "sm"}), "mt-auto")}>Manage in Zernio ↗</a>
                                        ) : null}
                                    </>
                                ) : connection.error ? (
                                    <>
                                        <p className="text-xs leading-5 text-red-200">{connection.error}</p>
                                        <a href={`/api/admin/social/connect/${platform}`} className={cn(buttonVariants({variant: "primary", size: "sm"}), "mt-auto")}>Reconnect account</a>
                                    </>
                                ) : connection.connected ? (
                                    <>
                                        <p className="text-sm text-ink-300">{connection.accountName ?? "Account connected"}</p>
                                        <p className="text-xs leading-5 text-ink-500">
                                            {platform === "instagram"
                                                ? "Access token refreshes automatically before its 60-day expiry."
                                                : platform === "facebook"
                                                    ? "No scheduled expiry; Facebook can still revoke access."
                                                    : "Access token refreshes automatically; the provider can still revoke access."}
                                        </p>
                                        <div className="mt-auto flex gap-2">
                                            <a href={`/api/admin/social/connect/${platform}`} className={cn(buttonVariants({size: "sm"}), "flex-1")}>Reconnect</a>
                                            <Button size="sm" variant="danger" onClick={() => disconnect(platform)}>Disconnect</Button>
                                        </div>
                                    </>
                                ) : connection.configured ? (
                                    <a href={`/api/admin/social/connect/${platform}`} className={cn(buttonVariants({variant: "primary", size: "sm"}), "mt-auto")}><PlugCircle size={15} />Connect account</a>
                                ) : (
                                    <p className="text-xs leading-5 text-ink-500">
                                        Set <code className="text-ink-300">{connection.envNames.id}</code> and <code className="text-ink-300">{connection.envNames.secret}</code> on the server{connection.redirectUri ? <>, with redirect URI <code className="break-all text-ink-300">{connection.redirectUri}</code> in the platform&apos;s app</> : null}.
                                    </p>
                                )}
                            </article>
                        );
                    })}
                </div>
            </Section>

            <AdminUploadedVideos shares={postsByVideo} onShare={(video) => setSharing(uploadedVideoToShareable(video))} onNotice={setNotice} />

            <AdminBlogVideos siteUrl={siteUrl} shares={postsByVideo} onShare={(video) => setSharing(blogVideoToShareable(video))} onNotice={setNotice} />

            <Section title={<>App story videos {videos ? <span className="tabular-nums">({videos.length})</span> : ""}</>}>
                {videos === null ? (
                    <div role="status" aria-label="Loading videos" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                        {Array.from({length: 6}, (_, index) => (
                            <div key={index} aria-hidden="true" className="border border-line-300 bg-surface-900">
                                <Skeleton className="aspect-[9/16] w-full" />
                                <div className="flex flex-col gap-2 p-3">
                                    <Skeleton className="h-3 w-3/4" />
                                    <Skeleton className="h-2.5 w-1/2" />
                                    <Skeleton className="mt-1 h-8 w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : videos.length === 0 ? (
                    <EmptyState icon={<ClapperboardPlay size={22} />} title="No finished story videos yet" description="They appear here once the app renders them." />
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                        {videos.map((video) => {
                            const shares = postsByVideo.get(video.mediaPath) ?? [];
                            return (
                                <article key={video.mediaPath} className="flex flex-col overflow-hidden border border-line-300 bg-surface-900">
                                    <video src={video.stableUrl} poster={video.posterUrl ?? undefined} controls playsInline preload={video.posterUrl ? "none" : "metadata"} className="aspect-[9/16] w-full bg-black object-cover" />
                                    <div className="flex flex-1 flex-col gap-2 p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <a href={`${siteUrl}/animals/${video.pageSlug}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-white hover:text-primary-100">{video.speciesName}</a>
                                            <Badge tone={video.kind === "story_video" ? "good" : "neutral"} className="shrink-0">{KIND_LABELS[video.kind]}</Badge>
                                        </div>
                                        <p className="text-[11px] tabular-nums text-ink-500">
                                            {[video.durationSeconds ? `${Math.round(video.durationSeconds)}s` : null, video.hasAudio ? "with audio" : "silent", video.locale?.toUpperCase(), new Date(video.createdAt).toLocaleDateString()].filter(Boolean).join(" · ")}
                                        </p>
                                        {shares.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {shares.map((post) => (
                                                    <Badge key={post.id} title={post.error ?? (isScheduled(post) ? `Scheduled for ${formatLocal(zernioInfo(post)!.scheduledFor!)}` : undefined)} tone={statusTone(post)} className="normal-case tracking-normal">{SOCIAL_PLATFORM_LABELS[post.platform]}: {statusLabel(post)}</Badge>
                                                ))}
                                            </div>
                                        )}
                                        <Button size="sm" variant="primary" onClick={() => setSharing(video)} className="mt-auto w-full"><Share size={15} />Share</Button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </Section>

            <Section title="Share log">
                {posts.length === 0 && videos === null ? (
                    <Card><TableSkeleton rows={4} columns={5} /></Card>
                ) : posts.length === 0 ? <EmptyState title="Nothing shared yet." description="Shares to the official accounts are logged here." /> : (
                    <Card>
                        <Table minWidth={704}>
                            <thead>
                                <tr><TH>When</TH><TH>Video</TH><TH>Platform</TH><TH>Status</TH><TH>Result</TH></tr>
                            </thead>
                            <tbody>
                                {posts.map((post) => {
                                    const zernio = zernioInfo(post);
                                    const scheduled = isScheduled(post);
                                    return (
                                        <tr key={post.id} className="transition hover:bg-white/[.02]">
                                            <TD className="whitespace-nowrap tabular-nums text-ink-400">{new Date(post.created_at).toLocaleString()}</TD>
                                            <TD className="text-white">{post.species_name ?? post.page_slug}<span className="block text-[11px] text-ink-500">{KIND_LABELS[post.media_kind as Video["kind"]] ?? post.media_kind}</span></TD>
                                            <TD>{SOCIAL_PLATFORM_LABELS[post.platform]}{post.options?.auto ? <Badge tone="ios" className="ml-2">Auto</Badge> : null}{post.mode === "draft" ? <span className="block text-[11px] text-ink-500">{DRAFT_LABELS[post.platform] ?? "draft"}</span> : null}</TD>
                                            <TD><Badge tone={statusTone(post)}>{statusLabel(post)}</Badge></TD>
                                            <TD className="text-ink-300">
                                                {scheduled && zernio?.scheduledFor ? (
                                                    <span className="flex flex-wrap items-center gap-2">
                                                        <span className="tabular-nums">Posts {formatLocal(zernio.scheduledFor)}{zernio.timezone && zernio.timezone !== BROWSER_TIMEZONE ? <span className="block text-[11px] text-ink-500">scheduled in {zernio.timezone}</span> : null}</span>
                                                        <Button size="sm" variant="danger" loading={cancelling === post.id} onClick={() => cancelScheduled(post)}>Cancel</Button>
                                                    </span>
                                                ) : post.platform === "tiktok" && post.status === "processing" && zernio ? (
                                                    <span className="flex items-center gap-2 text-ink-400"><Spinner size={12} />Publishing…</span>
                                                ) : post.external_url ? <a href={post.external_url} target="_blank" rel="noreferrer" className="font-bold text-primary-100 hover:text-white">Open post ↗</a>
                                                    : post.error ? <span className="text-red-200">{post.error}</span>
                                                        : post.status === "published" && post.external_id ? <span className="text-ink-400">Published (ID {post.external_id})</span>
                                                            : post.external_id ? <span className="text-ink-400">ID {post.external_id}</span> : null}
                                            </TD>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    </Card>
                )}
            </Section>

            {sharing && (
                <ShareDialog
                    video={sharing}
                    siteUrl={siteUrl}
                    connections={connections}
                    shares={postsByVideo.get(sharing.mediaPath) ?? []}
                    onClose={() => setSharing(null)}
                    onShared={(message) => {
                        setSharing(null);
                        setNotice(message);
                        loadPosts().catch(() => undefined);
                    }}
                />
            )}
        </AdminPage>
    );
}

type ShareDialogProps = {
    video: Video;
    siteUrl: string;
    connections: Connection[];
    shares: SocialPostRow[];
    onClose: () => void;
    onShared: (message: string) => void;
};

/** Counter for a text field, with how much of it shows before the feed's "more" cut-off. */
function Counter({length, max, visible}: {length: number; max: number; visible?: number}) {
    return (
        <span className={`font-normal ${length > max ? "text-red-300" : "text-ink-500"}`}>
            ({length}/{max}{visible ? `; first ${visible} show before “more”` : ""})
        </span>
    );
}

/** The first `visible` characters, highlighted, so the hook can be checked at a glance. */
function VisiblePreview({text, visible}: {text: string; visible: number}) {
    const chars = Array.from(text);
    return (
        <p className="mt-1 border border-line-300/60 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-ink-500">
            <span className="text-white">{chars.slice(0, visible).join("")}</span>{chars.length > visible ? `${chars.slice(visible, visible + 40).join("")}…` : ""}
        </p>
    );
}

const fieldClass = "mt-1.5 w-full border border-line-300 bg-canvas-900 px-3 py-2 text-sm text-white outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-300/20";

type TikTokWhen = "now" | "schedule";

function ShareDialog({video, siteUrl, connections, shares, onClose, onShared}: ShareDialogProps) {
    const pageUrl = `${siteUrl}${video.pagePath ?? `/animals/${video.pageSlug}`}`;
    const [copy, setCopy] = useState<ShareCopy | null>(null);
    const [copySource, setCopySource] = useState<"claude" | "template" | null>(null);
    const [copyError, setCopyError] = useState("");
    const [drafting, setDrafting] = useState(false);
    const [tab, setTab] = useState<ManualSharePlatform>("youtube");
    const [xLink, setXLink] = useState(false);
    const [modes, setModes] = useState<Record<ManualSharePlatform, SocialPostMode>>({youtube: "post", tiktok: "post", instagram: "post", facebook: "post", x: "post"});
    // A draft and a direct post are separate shares; each can happen once.
    const blocked = (platform: ManualSharePlatform, mode: SocialPostMode = modes[platform]) => shares.some((post) => post.platform === platform && post.mode === mode && (post.status === "published" || inFlight(post)));
    const overLength = (platform: SocialPlatform) => Boolean(video.durationSeconds && MAX_SECONDS[platform] && video.durationSeconds > MAX_SECONDS[platform]!);
    const available = (platform: ManualSharePlatform) => Boolean(connections.find((candidate) => candidate.platform === platform)?.connected)
        && !overLength(platform)
        && !(blocked(platform, "post") && (!DRAFT_LABELS[platform] || blocked(platform, "draft")));
    const [selected, setSelected] = useState<ManualSharePlatform[]>(() => MANUAL_SHARE_PLATFORMS.filter(available));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const tiktokConnected = Boolean(connections.find((candidate) => candidate.platform === "tiktok")?.connected);
    const [tiktokAccount, setTiktokAccount] = useState<TikTokAccountInfo | null>(null);
    const [tiktokAccountError, setTiktokAccountError] = useState("");
    // TikTok's guidelines: no preset privacy level, every interaction off until the poster turns it on.
    const [tiktok, setTiktok] = useState<TikTokPostOptions>(() => video.uploadedVideoId ? {...EMPTY_TIKTOK_OPTIONS, madeWithAi: false} : EMPTY_TIKTOK_OPTIONS);
    const [tiktokDisclose, setTiktokDisclose] = useState(false);
    const [tiktokWhen, setTiktokWhen] = useState<TikTokWhen>("now");
    const [tiktokScheduleLocal, setTiktokScheduleLocal] = useState("");

    useEffect(() => {
        if (!tiktokConnected) return;
        api<{account: TikTokAccountInfo}>("/api/admin/social/tiktok-account")
            .then((body) => {
                setTiktokAccount(body.account);
                // A toggle ticked before the account answered, which the account forbids, would be stuck on behind a disabled box.
                const allowed = body.account.interactions;
                setTiktok((current) => ({...current, allowComment: current.allowComment && allowed.allowComment, allowDuet: current.allowDuet && allowed.allowDuet, allowStitch: current.allowStitch && allowed.allowStitch}));
            })
            .catch((caught) => setTiktokAccountError(caught instanceof Error ? caught.message : "Unable to load the TikTok account"));
    }, [tiktokConnected]);

    const tiktokDirect = selected.includes("tiktok") && modes.tiktok === "post";
    const tiktokScheduling = tiktokDirect && tiktokWhen === "schedule";
    const tiktokTooLong = Boolean(tiktokDirect && tiktokAccount?.maxVideoDurationSec && video.durationSeconds && video.durationSeconds > tiktokAccount.maxVideoDurationSec);
    const tiktokProblem = tiktokDirect
        ? (tiktokTooLong ? `This video is longer than the ${tiktokAccount?.maxVideoDurationSec}s this TikTok account can post`
            : tiktokDisclose && !tiktok.brandOrganic && !tiktok.brandContent ? "Choose what the commercial content is, or turn the disclosure off"
                : tiktokOptionsProblem(tiktok, tiktokAccount) ?? (tiktokScheduling ? localScheduleProblem(tiktokScheduleLocal) : null))
        : null;

    const draft = useCallback(async (regenerate = false) => {
        setDrafting(true);
        setCopyError("");
        try {
            const body = await api<{copy: ShareCopy; source: "claude" | "template"; error?: string}>("/api/admin/social/copy", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(video.uploadedVideoId
                    ? {uploadedVideoId: video.uploadedVideoId, regenerate}
                    : video.contentVideoId
                    ? {contentVideoId: video.contentVideoId, regenerate}
                    : {speciesProfileId: video.speciesProfileId, mediaPath: video.mediaPath, pageSlug: video.pageSlug, speciesName: video.speciesName})
            });
            setCopy(body.copy);
            setCopySource(body.source);
            if (body.error) setCopyError(`Claude was unavailable, so this is the template draft (${body.error}).`);
        } catch (caught) {
            setCopyError(caught instanceof Error ? caught.message : "Unable to draft copy");
        } finally {
            setDrafting(false);
        }
    }, [video]);

    useEffect(() => {
        draft();
    }, [draft]);

    const xText = copy ? (xLink ? `${copy.x.text}\n${pageUrl}` : copy.x.text) : "";
    const tooLong = copy !== null && (
        (selected.includes("x") && xLength(xText) > X_POST_LIMIT)
        || (selected.includes("youtube") && (copy.youtube.title.length > COPY_LIMITS.youtubeTitle || copy.youtube.description.length > COPY_LIMITS.youtubeDescription))
        || (selected.includes("tiktok") && copy.tiktok.caption.length > COPY_LIMITS.caption)
        || (selected.includes("instagram") && copy.instagram.caption.length > COPY_LIMITS.caption)
        || (selected.includes("facebook") && copy.facebook.caption.length > COPY_LIMITS.caption)
    );

    function edit<K extends keyof ShareCopy>(platform: K, field: keyof ShareCopy[K], value: string) {
        setCopy((current) => current ? {...current, [platform]: {...current[platform], [field]: value}} : current);
    }

    async function submit() {
        if (!copy) return;
        setSubmitting(true);
        setError("");
        const captionFor: Record<ManualSharePlatform, string> = {
            youtube: copy.youtube.description,
            tiktok: copy.tiktok.caption,
            instagram: copy.instagram.caption,
            facebook: copy.facebook.caption,
            x: xText
        };
        // Resolved once so the notice and the request agree on the time.
        const scheduledFor = tiktokScheduling && tiktokScheduleLocal ? new Date(tiktokScheduleLocal).toISOString() : null;
        try {
            const body = await api<{queued: SocialPlatform[]; skipped: SocialPlatform[]}>("/api/admin/social/posts", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    ...(video.uploadedVideoId ? {uploadedVideoId: video.uploadedVideoId} : video.contentVideoId ? {contentVideoId: video.contentVideoId} : {speciesProfileId: video.speciesProfileId, mediaPath: video.mediaPath}),
                    title: copy.youtube.title,
                    targets: selected.map((platform) => ({
                        platform,
                        caption: captionFor[platform],
                        mode: modes[platform],
                        ...(platform === "tiktok" ? {
                            tiktok: {...tiktok, brandOrganic: tiktokDisclose && tiktok.brandOrganic, brandContent: tiktokDisclose && tiktok.brandContent},
                            ...(scheduledFor ? {scheduledFor, timezone: BROWSER_TIMEZONE} : {})
                        } : {})
                    }))
                })
            });
            const queued = body.queued.map((platform) => SOCIAL_PLATFORM_LABELS[platform]).join(", ");
            const skipped = body.skipped.map((platform) => SOCIAL_PLATFORM_LABELS[platform]).join(", ");
            onShared([
                queued && `Uploading ${video.speciesName} to ${queued}.`,
                body.queued.includes("tiktok") && (scheduledFor ? `TikTok scheduled for ${formatLocal(scheduledFor)}.` : "TikTok can take a few minutes to publish."),
                skipped && `Already shared to ${skipped}.`
            ].filter(Boolean).join(" "));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to share");
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={`Share ${video.speciesName}`}>
            <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto border border-line-300 bg-surface-900 p-5 shadow-2xl sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[.16em] text-primary-200">Share</p>
                        <h2 className="mt-1 font-display text-2xl text-white">{video.speciesName} · {KIND_LABELS[video.kind]}</h2>
                        {video.videoHook ? <p className="mt-1 text-xs text-ink-400">Opens on: “{video.videoHook}”</p> : null}
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close"><CloseCircle size={20} /></Button>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-[10rem_1fr]">
                    <video src={video.stableUrl} poster={video.posterUrl ?? undefined} controls playsInline preload="metadata" className="aspect-[9/16] w-40 bg-black object-cover" />
                    <div className="flex flex-col gap-4">
                        {!video.hasAudio && (
                            <Alert tone="warn" className="text-xs">This clip is silent. Short-video feeds favour audio.</Alert>
                        )}
                        <fieldset className="flex flex-col gap-2">
                            <legend className="mb-1.5 text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Post to</legend>
                            {MANUAL_SHARE_PLATFORMS.map((platform) => {
                                const connected = Boolean(connections.find((candidate) => candidate.platform === platform)?.connected);
                                const already = blocked(platform);
                                const checked = selected.includes(platform);
                                return (
                                    <div key={platform} className="flex flex-wrap items-center gap-x-4 gap-y-1 border border-line-300 bg-canvas-900 px-3 py-2">
                                        <label className={`flex flex-1 items-center gap-2 text-sm ${available(platform) ? "text-white" : "text-ink-500"}`}>
                                            <input type="checkbox" disabled={!available(platform)} checked={checked} onChange={(event) => setSelected((current) => event.target.checked ? [...current, platform] : current.filter((item) => item !== platform))} />
                                            {SOCIAL_PLATFORM_LABELS[platform]}
                                            {!connected ? <span className="text-[11px]">(not connected)</span> : overLength(platform) ? <span className="text-[11px]">(over its {MAX_SECONDS[platform]} s limit; share a shorter cut)</span> : platform === "youtube" && (video.durationSeconds ?? 0) > YOUTUBE_SHORTS_MAX_SECONDS ? <span className="text-[11px]">(over 3 min: posts as a regular video, not a Short)</span> : already ? <span className="text-[11px]">({modes[platform] === "draft" ? "draft already sent" : "already posted"})</span> : null}
                                        </label>
                                        {DRAFT_LABELS[platform] && checked ? (
                                            <label className="flex items-center gap-2 text-xs text-ink-300">
                                                <input type="checkbox" checked={modes[platform] === "draft"} onChange={(event) => setModes((current) => ({...current, [platform]: event.target.checked ? "draft" : "post"}))} />
                                                {DRAFT_LABELS[platform]}
                                            </label>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </fieldset>
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-0.5 border border-line-300 bg-canvas-900 p-0.5" role="tablist">
                        {MANUAL_SHARE_PLATFORMS.map((platform) => (
                            <button key={platform} role="tab" aria-selected={tab === platform} onClick={() => setTab(platform)} className={`min-h-8 px-3 text-xs font-black transition ${tab === platform ? "bg-primary-400 text-canvas-950" : "text-ink-400 hover:text-white"}`}>{SOCIAL_PLATFORM_LABELS[platform]}</button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        {copySource ? <span className="text-[11px] text-ink-500">{copySource === "claude" ? "Drafted by Claude" : "Template draft"}</span> : null}
                        <Button size="sm" onClick={() => draft(true)} loading={drafting}>{drafting ? null : <Refresh size={14} />}{drafting ? "Drafting…" : "Regenerate"}</Button>
                    </div>
                </div>
                {copyError && <Alert tone="warn" className="mt-3 text-xs">{copyError}</Alert>}

                {!copy ? (drafting ? (
                    <div role="status" aria-label="Drafting titles and captions" className="mt-4 flex flex-col gap-2">
                        <p className="flex items-center gap-2 text-xs font-bold text-ink-400"><Spinner size={12} />Drafting titles and captions…</p>
                        <Skeleton className="h-2.5 w-24" />
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="mt-2 h-2.5 w-28" />
                        <Skeleton className="h-40 w-full" />
                    </div>
                ) : <EmptyState className="mt-4" title="No draft" />) : (
                    <div className="mt-4">
                        {tab === "youtube" && (
                            <>
                                <label className="block text-xs font-bold text-ink-300">Title <Counter length={copy.youtube.title.length} max={COPY_LIMITS.youtubeTitle} visible={VISIBLE_CHARS.youtubeTitle} />
                                    <input value={copy.youtube.title} onChange={(event) => edit("youtube", "title", event.target.value)} className={fieldClass} />
                                </label>
                                <VisiblePreview text={copy.youtube.title} visible={VISIBLE_CHARS.youtubeTitle} />
                                <label className="mt-4 block text-xs font-bold text-ink-300">Description <Counter length={copy.youtube.description.length} max={COPY_LIMITS.youtubeDescription} />
                                    <textarea value={copy.youtube.description} rows={10} onChange={(event) => edit("youtube", "description", event.target.value)} className={fieldClass} />
                                </label>
                                <p className="mt-1 text-[11px] text-ink-500">The first three hashtags show above the title on YouTube.</p>
                            </>
                        )}
                        {tab === "tiktok" && (
                            <>
                                <label className="block text-xs font-bold text-ink-300">Caption <Counter length={copy.tiktok.caption.length} max={COPY_LIMITS.caption} visible={VISIBLE_CHARS.tiktok} />
                                    <textarea value={copy.tiktok.caption} rows={8} onChange={(event) => edit("tiktok", "caption", event.target.value)} className={fieldClass} />
                                </label>
                                <VisiblePreview text={copy.tiktok.caption} visible={VISIBLE_CHARS.tiktok} />
                                <TikTokPostSettings
                                    account={tiktokAccount}
                                    accountError={tiktokAccountError}
                                    connected={tiktokConnected}
                                    draftMode={modes.tiktok === "draft"}
                                    options={tiktok}
                                    onChange={setTiktok}
                                    disclose={tiktokDisclose}
                                    onDiscloseChange={setTiktokDisclose}
                                    when={tiktokWhen}
                                    onWhenChange={setTiktokWhen}
                                    scheduleLocal={tiktokScheduleLocal}
                                    onScheduleLocalChange={setTiktokScheduleLocal}
                                />
                            </>
                        )}
                        {tab === "instagram" && (
                            <>
                                <label className="block text-xs font-bold text-ink-300">Caption <Counter length={copy.instagram.caption.length} max={COPY_LIMITS.caption} visible={VISIBLE_CHARS.instagram} />
                                    <textarea value={copy.instagram.caption} rows={10} onChange={(event) => edit("instagram", "caption", event.target.value)} className={fieldClass} />
                                </label>
                                <VisiblePreview text={copy.instagram.caption} visible={VISIBLE_CHARS.instagram} />
                            </>
                        )}
                        {tab === "facebook" && (
                            <>
                                <label className="block text-xs font-bold text-ink-300">Caption <Counter length={copy.facebook.caption.length} max={COPY_LIMITS.caption} visible={VISIBLE_CHARS.facebook} />
                                    <textarea value={copy.facebook.caption} rows={10} onChange={(event) => edit("facebook", "caption", event.target.value)} className={fieldClass} />
                                </label>
                                <VisiblePreview text={copy.facebook.caption} visible={VISIBLE_CHARS.facebook} />
                            </>
                        )}
                        {tab === "x" && (
                            <>
                                <label className="block text-xs font-bold text-ink-300">Post <Counter length={xLength(xText)} max={X_POST_LIMIT} />
                                    <textarea value={copy.x.text} rows={4} onChange={(event) => edit("x", "text", event.target.value)} className={fieldClass} />
                                </label>
                                <label className="mt-2 flex items-center gap-2 text-xs text-ink-300">
                                    <input type="checkbox" checked={xLink} onChange={(event) => setXLink(event.target.checked)} />
                                    Add the {video.uploadedVideoId ? "app" : video.contentVideoId ? "article" : "animal page"} link (X shows posts with outside links to fewer people)
                                </label>
                            </>
                        )}
                    </div>
                )}

                {error && <Alert tone="bad" className="mt-4">{error}</Alert>}
                {tiktokProblem && <p className="mt-4 text-xs text-amber-200">TikTok: {tiktokProblem} (TikTok tab).</p>}
                {tiktokDirect && (
                    <p className="mt-4 text-right text-[11px] leading-5 text-ink-400">
                        By posting, you agree to TikTok&apos;s <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer" className="underline hover:text-white">Music Usage Confirmation</a>
                        {tiktokDisclose && tiktok.brandContent ? <> and <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noreferrer" className="underline hover:text-white">Branded Content Policy</a></> : null}.
                    </p>
                )}

                <div className="mt-5 flex justify-end gap-2 border-t border-line-300 pt-4">
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={submit} loading={submitting} disabled={!copy || selected.length === 0 || tooLong || Boolean(tiktokProblem)}>{submitting ? null : <Share size={16} />}{submitting ? "Queuing…" : `Share to ${selected.length} platform${selected.length === 1 ? "" : "s"}`}</Button>
                </div>
            </div>
        </div>
    );
}

type TikTokPostSettingsProps = {
    account: TikTokAccountInfo | null;
    accountError: string;
    connected: boolean;
    draftMode: boolean;
    options: TikTokPostOptions;
    onChange: (options: TikTokPostOptions) => void;
    disclose: boolean;
    onDiscloseChange: (disclose: boolean) => void;
    when: TikTokWhen;
    onWhenChange: (when: TikTokWhen) => void;
    scheduleLocal: string;
    onScheduleLocalChange: (value: string) => void;
};

/** The posting choices TikTok's Content Sharing Guidelines require us to show (and not preset), plus when to post. */
function TikTokPostSettings({account, accountError, connected, draftMode, options, onChange, disclose, onDiscloseChange, when, onWhenChange, scheduleLocal, onScheduleLocalChange}: TikTokPostSettingsProps) {
    if (!connected) return <p className="mt-4 text-xs text-ink-500">TikTok posts go through Zernio; set it up on the server to choose its posting settings.</p>;
    if (draftMode) return <p className="mt-4 text-xs text-ink-400">Sent to the account&apos;s TikTok inbox as a draft: privacy, interactions and disclosure are chosen in the TikTok app when you finish the post. Drafts cannot be scheduled.</p>;
    const set = (patch: Partial<TikTokPostOptions>) => onChange({...options, ...patch});
    const interactions: Array<{key: "allowComment" | "allowDuet" | "allowStitch"; label: string; disabled: boolean}> = [
        {key: "allowComment", label: "Comment", disabled: account ? !account.interactions.allowComment : false},
        {key: "allowDuet", label: "Duet", disabled: account ? !account.interactions.allowDuet : false},
        {key: "allowStitch", label: "Stitch", disabled: account ? !account.interactions.allowStitch : false}
    ];
    const minLocal = toLocalInputValue(new Date(Date.now() + SCHEDULE_PICKER_LEAD_MS));
    const maxLocal = toLocalInputValue(new Date(Date.now() + MAX_SCHEDULE_DAYS * 86_400_000));
    const scheduleProblem = when === "schedule" ? localScheduleProblem(scheduleLocal) : null;
    const resolved = when === "schedule" && scheduleLocal && !scheduleProblem ? new Date(scheduleLocal) : null;
    return (
        <div className="mt-5 flex flex-col gap-4 border border-line-300 bg-canvas-900 p-4">
            <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {account?.avatarUrl ? <img src={account.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="h-9 w-9 rounded-full bg-white/10" />}
                <p className="text-sm text-white">Posting to TikTok as <strong>{account?.nickname ?? (accountError ? "unknown account" : "…")}</strong></p>
            </div>
            {accountError && <p className="text-xs text-red-200">{accountError}</p>}
            {account && !account.canPostMore && (
                <Alert tone="warn" className="text-xs">TikTok&apos;s daily API posting cap is reached for this account; schedule it for later or try tomorrow.</Alert>
            )}

            <label className="block text-xs font-bold text-ink-300">Who can view this video
                <select value={options.privacyLevel} onChange={(event) => set({privacyLevel: event.target.value})} className={fieldClass}>
                    <option value="" disabled>Choose who can view…</option>
                    {(account?.privacyLevels ?? []).map((level) => (
                        <option key={level.value} value={level.value} disabled={disclose && options.brandContent && level.value === "SELF_ONLY"}>{TIKTOK_PRIVACY_LABELS[level.value] ?? level.label}</option>
                    ))}
                </select>
            </label>
            <p className="-mt-2 text-[11px] text-ink-500">Posted through Zernio to @animaldex.app; the levels are the ones that account allows. Accounts connected through TikTok for Business can only post videos as Everyone.</p>

            <fieldset>
                <legend className="text-xs font-bold text-ink-300">Allow users to</legend>
                <div className="mt-2 flex flex-wrap gap-4">
                    {interactions.map((item) => (
                        <label key={item.key} className={`flex items-center gap-2 text-sm ${item.disabled ? "text-ink-600" : "text-white"}`} title={item.disabled ? "Turned off in this account's TikTok settings" : undefined}>
                            <input type="checkbox" disabled={item.disabled} checked={!item.disabled && options[item.key]} onChange={(event) => set({[item.key]: event.target.checked})} />
                            {item.label}
                        </label>
                    ))}
                </div>
            </fieldset>

            <div>
                <label className="flex items-center justify-between gap-3 text-sm text-white">
                    <span>Disclose video content<span className="block text-[11px] text-ink-500">Turn on if this video promotes yourself, a brand, product or service.</span></span>
                    <input type="checkbox" checked={disclose} onChange={(event) => onDiscloseChange(event.target.checked)} />
                </label>
                {disclose && (
                    <div className="mt-3 flex flex-col gap-2 pl-1">
                        <label className="flex items-start gap-2 text-sm text-white">
                            <input type="checkbox" className="mt-1" checked={options.brandOrganic} onChange={(event) => set({brandOrganic: event.target.checked})} />
                            <span>Your brand<span className="block text-[11px] text-ink-500">You are promoting yourself or your own business. The video will be labelled &quot;Promotional content&quot;.</span></span>
                        </label>
                        <label className="flex items-start gap-2 text-sm text-white">
                            <input type="checkbox" className="mt-1" checked={options.brandContent} onChange={(event) => set({brandContent: event.target.checked, privacyLevel: event.target.checked && options.privacyLevel === "SELF_ONLY" ? "" : options.privacyLevel})} />
                            <span>Branded content<span className="block text-[11px] text-ink-500">You are promoting another brand or a third party. The video will be labelled &quot;Paid partnership&quot;, and cannot be private.</span></span>
                        </label>
                    </div>
                )}
            </div>

            <label className="flex items-start gap-2 text-sm text-white">
                <input type="checkbox" className="mt-1" checked={options.madeWithAi} onChange={(event) => set({madeWithAi: event.target.checked})} />
                <span>AI-generated content<span className="block text-[11px] text-ink-500">Adds TikTok&apos;s AI-generated label. Our story videos are AI-made, so this stays on unless the clip is real footage.</span></span>
            </label>

            <fieldset>
                <legend className="text-xs font-bold text-ink-300">When</legend>
                <div className="mt-2 flex flex-wrap gap-4">
                    {([["now", "Post now"], ["schedule", "Schedule"]] as Array<[TikTokWhen, string]>).map(([value, label]) => (
                        <label key={value} className="flex items-center gap-2 text-sm text-white">
                            <input type="radio" name="tiktok-when" value={value} checked={when === value} onChange={() => onWhenChange(value)} />
                            {label}
                        </label>
                    ))}
                </div>
                {when === "schedule" && (
                    <div className="mt-3">
                        <label className="block text-xs font-bold text-ink-300">Publish at
                            <input
                                type="datetime-local"
                                value={scheduleLocal}
                                min={minLocal}
                                max={maxLocal}
                                step={60}
                                onChange={(event) => onScheduleLocalChange(event.target.value)}
                                className={cn(fieldClass, "max-w-xs")}
                            />
                        </label>
                        <p className={`mt-1 text-[11px] ${scheduleProblem && scheduleLocal ? "text-amber-200" : "text-ink-500"}`}>
                            {scheduleProblem && scheduleLocal
                                ? scheduleProblem
                                : resolved
                                    ? `Posts ${resolved.toLocaleString(undefined, {dateStyle: "full", timeStyle: "short"})} (${BROWSER_TIMEZONE}). Zernio publishes it at that moment.`
                                    : `Between 2 minutes and ${MAX_SCHEDULE_DAYS} days ahead, in your timezone (${BROWSER_TIMEZONE}).`}
                        </p>
                    </div>
                )}
            </fieldset>

            <label className="flex items-start gap-2 border-t border-line-300 pt-4 text-sm text-white">
                <input type="checkbox" className="mt-1" checked={options.previewConfirmed} onChange={(event) => set({previewConfirmed: event.target.checked})} />
                <span>I previewed this video and consent to it being posted to the AnimalDex TikTok account<span className="block text-[11px] text-ink-500">Required by TikTok before a post can be made through a third party.</span></span>
            </label>
        </div>
    );
}
