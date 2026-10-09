"use client";

import Link from "next/link";
import {useCallback, useEffect, useMemo, useState} from "react";
import {ArrowLeft, CheckCircle, ClapperboardPlay, CloseCircle, DangerTriangle, PlugCircle, Refresh, Share} from "solar-icon-set";
import {X_POST_LIMIT, xLength} from "@/lib/social/captions";
import {COPY_LIMITS, type ShareCopy, VISIBLE_CHARS} from "@/lib/social/share-copy";
import {TIKTOK_PRIVACY_LABELS, type TikTokCreatorInfo, tiktokOptionsProblem} from "@/lib/social/tiktok-options";
import {SOCIAL_PLATFORM_LABELS, SOCIAL_PLATFORMS, type SocialPlatform, type SocialPostMode, type SocialPostRow, type TikTokPostOptions} from "@/lib/social/types";

type Video = {
    mediaPath: string;
    kind: "story_video" | "hook" | "trial_scene" | "still";
    locale: string | null;
    stableUrl: string;
    durationSeconds: number | null;
    hasAudio: boolean;
    script: string | null;
    videoHook: string | null;
    captureId: string | null;
    createdAt: string;
    speciesProfileId: string;
    speciesName: string;
    pageSlug: string;
};

type Connection = {
    platform: SocialPlatform;
    configured: boolean;
    connected: boolean;
    accountName: string | null;
    expiresAt: string | null;
    envNames: {id: string; secret: string};
    redirectUri: string;
};

const KIND_LABELS: Record<Video["kind"], string> = {
    story_video: "Narrated story",
    hook: "Animated capture",
    trial_scene: "Trial scene",
    still: "Still"
};

/** Only TikTok (inbox) and YouTube (private upload) have a not-yet-public option. */
const DRAFT_LABELS: Partial<Record<SocialPlatform, string>> = {
    tiktok: "Send to TikTok drafts",
    youtube: "Upload as private",
    facebook: "Save as draft"
};

const STALE_MS = 30 * 60_000;

async function api<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, {cache: "no-store", ...init});
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Request failed (${response.status})`);
    return body as T;
}

function statusTone(post: SocialPostRow) {
    if (post.status === "published") return "bg-primary-500/15 text-primary-100";
    if (post.status === "failed") return "bg-red-500/15 text-red-200";
    return "bg-amber-400/15 text-amber-100";
}

function isStale(post: SocialPostRow) {
    return (post.status === "queued" || post.status === "processing") && Date.now() - Date.parse(post.updated_at) > STALE_MS;
}

export default function AdminStoryVideos({siteUrl}: {siteUrl: string}) {
    const [videos, setVideos] = useState<Video[] | null>(null);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [posts, setPosts] = useState<SocialPostRow[]>([]);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [sharing, setSharing] = useState<Video | null>(null);

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

    // Poll the log while anything is still uploading.
    const inFlight = posts.some((post) => (post.status === "queued" || post.status === "processing") && !isStale(post));
    useEffect(() => {
        if (!inFlight) return;
        const interval = window.setInterval(() => loadPosts().catch(() => undefined), 5_000);
        return () => window.clearInterval(interval);
    }, [inFlight, loadPosts]);

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

    return (
        <main className="bg-[radial-gradient(circle_at_20%_0%,rgba(33,192,94,.12),transparent_28%)] px-4 py-6 text-ink-100 sm:px-7 lg:px-10">
            <div className="mx-auto w-full max-w-[100rem]">
                <header className="flex flex-col gap-5 border-b border-line-300 pb-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-ink-400 hover:text-white"><ArrowLeft size={18} />Dashboard</Link>
                        <p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-primary-200">Social publishing</p>
                        <h1 className="mt-2 font-display text-4xl text-white sm:text-5xl">Story videos</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-300">Every finished, narrated story video the app currently serves. Share one to the official AnimalDex accounts; uploads run in the background and land in the log below.</p>
                    </div>
                    <button onClick={() => loadAll()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line-300 px-5 py-3 text-sm font-black text-white hover:border-primary-300"><Refresh size={18} />Refresh</button>
                </header>

                {error && <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
                {notice && <div className="mt-5 rounded-xl border border-primary-400/20 bg-primary-500/10 px-4 py-3 text-sm text-primary-100">{notice}</div>}

                <section className="mt-6">
                    <h2 className="text-xs font-black uppercase tracking-[.18em] text-ink-400">Official accounts</h2>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {SOCIAL_PLATFORMS.map((platform) => {
                            const connection = connections.find((candidate) => candidate.platform === platform);
                            return (
                                <article key={platform} className="flex flex-col gap-3 rounded-2xl border border-line-300 bg-surface-900 p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-bold text-white">{SOCIAL_PLATFORM_LABELS[platform]}</p>
                                        {connection?.connected
                                            ? <span className="inline-flex items-center gap-1 rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-primary-100"><CheckCircle size={12} iconStyle="Bold" />Connected</span>
                                            : <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black uppercase text-ink-400">{connection?.configured ? "Not connected" : "Not set up"}</span>}
                                    </div>
                                    {connection?.connected ? (
                                        <>
                                            <p className="text-sm text-ink-300">{connection.accountName ?? "Account connected"}</p>
                                            <div className="mt-auto flex gap-2">
                                                <a href={`/api/admin/social/connect/${platform}`} className="flex-1 rounded-lg border border-line-300 px-3 py-2 text-center text-xs font-bold text-white hover:border-primary-300">Reconnect</a>
                                                <button onClick={() => disconnect(platform)} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10">Disconnect</button>
                                            </div>
                                        </>
                                    ) : connection?.configured ? (
                                        <a href={`/api/admin/social/connect/${platform}`} className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary-400 px-3 py-2 text-xs font-black text-canvas-950"><PlugCircle size={15} />Connect account</a>
                                    ) : connection ? (
                                        <p className="text-xs leading-5 text-ink-500">
                                            Set <code className="text-ink-300">{connection.envNames.id}</code> and <code className="text-ink-300">{connection.envNames.secret}</code> on the server, with redirect URI <code className="break-all text-ink-300">{connection.redirectUri}</code> in the platform&apos;s app.
                                        </p>
                                    ) : <p className="text-xs text-ink-500">Loading…</p>}
                                </article>
                            );
                        })}
                    </div>
                </section>

                <section className="mt-8">
                    <h2 className="text-xs font-black uppercase tracking-[.18em] text-ink-400">Videos {videos ? `(${videos.length})` : ""}</h2>
                    {videos === null ? <div className="grid min-h-[16rem] place-items-center text-sm text-ink-400">Loading videos…</div> : videos.length === 0 ? (
                        <div className="mt-3 grid min-h-[16rem] place-items-center rounded-2xl border border-dashed border-line-300 text-center"><div><ClapperboardPlay size={38} className="mx-auto text-ink-500" /><p className="mt-3 font-bold text-white">No finished story videos yet</p><p className="mt-1 text-sm text-ink-500">They appear here once the app renders them.</p></div></div>
                    ) : (
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                            {videos.map((video) => {
                                const shares = postsByVideo.get(video.mediaPath) ?? [];
                                return (
                                    <article key={video.mediaPath} className="flex flex-col overflow-hidden rounded-2xl border border-line-300 bg-surface-900">
                                        <video src={video.stableUrl} controls playsInline preload="none" className="aspect-[9/16] w-full bg-black object-cover" />
                                        <div className="flex flex-1 flex-col gap-2 p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <a href={`${siteUrl}/animals/${video.pageSlug}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-white hover:text-primary-100">{video.speciesName}</a>
                                                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${video.kind === "story_video" ? "bg-primary-500/15 text-primary-100" : "bg-white/5 text-ink-300"}`}>{KIND_LABELS[video.kind]}</span>
                                            </div>
                                            <p className="text-[11px] text-ink-500">
                                                {[video.durationSeconds ? `${Math.round(video.durationSeconds)}s` : null, video.hasAudio ? "with audio" : "silent", video.locale?.toUpperCase(), new Date(video.createdAt).toLocaleDateString()].filter(Boolean).join(" · ")}
                                            </p>
                                            {shares.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {shares.map((post) => (
                                                        <span key={post.id} title={post.error ?? undefined} className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${statusTone(post)}`}>{SOCIAL_PLATFORM_LABELS[post.platform]}: {isStale(post) ? "stale" : post.status}</span>
                                                    ))}
                                                </div>
                                            )}
                                            <button onClick={() => setSharing(video)} className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-400 px-3 py-2 text-xs font-black text-canvas-950"><Share size={15} />Share</button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="mt-10 pb-10">
                    <h2 className="text-xs font-black uppercase tracking-[.18em] text-ink-400">Share log</h2>
                    {posts.length === 0 ? <p className="mt-3 text-sm text-ink-500">Nothing shared yet.</p> : (
                        <div className="mt-3 overflow-x-auto rounded-2xl border border-line-300">
                            <table className="w-full min-w-[44rem] text-left text-sm">
                                <thead className="bg-surface-900 text-[10px] uppercase tracking-[.14em] text-ink-500">
                                    <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Animal</th><th className="px-4 py-3">Platform</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Result</th></tr>
                                </thead>
                                <tbody>
                                    {posts.map((post) => (
                                        <tr key={post.id} className="border-t border-line-300 align-top">
                                            <td className="whitespace-nowrap px-4 py-3 text-ink-400">{new Date(post.created_at).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-white">{post.species_name ?? post.page_slug}<span className="block text-[11px] text-ink-500">{KIND_LABELS[post.media_kind as Video["kind"]] ?? post.media_kind}</span></td>
                                            <td className="px-4 py-3 text-ink-200">{SOCIAL_PLATFORM_LABELS[post.platform]}{post.mode === "draft" ? <span className="block text-[11px] text-ink-500">{DRAFT_LABELS[post.platform] ?? "draft"}</span> : null}</td>
                                            <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${statusTone(post)}`}>{isStale(post) ? "stale" : post.status}</span></td>
                                            <td className="px-4 py-3 text-ink-300">
                                                {post.external_url ? <a href={post.external_url} target="_blank" rel="noreferrer" className="font-bold text-primary-100 hover:text-white">Open post ↗</a>
                                                    : post.error ? <span className="text-red-200">{post.error}</span>
                                                        : post.external_id ? <span className="text-ink-400">ID {post.external_id}</span> : null}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

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
        </main>
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
        <p className="mt-1 rounded-lg bg-white/[0.03] px-3 py-2 text-xs leading-5 text-ink-500">
            <span className="text-white">{chars.slice(0, visible).join("")}</span>{chars.length > visible ? `${chars.slice(visible, visible + 40).join("")}…` : ""}
        </p>
    );
}

const fieldClass = "mt-1 w-full rounded-xl border border-line-300 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-300";

function ShareDialog({video, siteUrl, connections, shares, onClose, onShared}: ShareDialogProps) {
    const pageUrl = `${siteUrl}/animals/${video.pageSlug}`;
    const [copy, setCopy] = useState<ShareCopy | null>(null);
    const [copySource, setCopySource] = useState<"claude" | "template" | null>(null);
    const [copyError, setCopyError] = useState("");
    const [drafting, setDrafting] = useState(false);
    const [tab, setTab] = useState<SocialPlatform>("youtube");
    const [xLink, setXLink] = useState(false);
    const [modes, setModes] = useState<Record<SocialPlatform, SocialPostMode>>({youtube: "post", tiktok: "post", instagram: "post", facebook: "post", x: "post"});
    // A draft and a direct post are separate shares; each can happen once.
    const blocked = (platform: SocialPlatform, mode: SocialPostMode = modes[platform]) => shares.some((post) => post.platform === platform && post.mode === mode && (post.status === "published" || ((post.status === "queued" || post.status === "processing") && !isStale(post))));
    const available = (platform: SocialPlatform) => Boolean(connections.find((candidate) => candidate.platform === platform)?.connected)
        && !(blocked(platform, "post") && (!DRAFT_LABELS[platform] || blocked(platform, "draft")));
    const [selected, setSelected] = useState<SocialPlatform[]>(() => SOCIAL_PLATFORMS.filter(available));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const tiktokConnected = Boolean(connections.find((candidate) => candidate.platform === "tiktok")?.connected);
    const [tiktokCreator, setTiktokCreator] = useState<TikTokCreatorInfo | null>(null);
    const [tiktokCreatorError, setTiktokCreatorError] = useState("");
    // TikTok's guidelines: no preset privacy level, every interaction off until the poster turns it on.
    const [tiktok, setTiktok] = useState<TikTokPostOptions>({privacyLevel: "", allowComment: false, allowDuet: false, allowStitch: false, brandOrganic: false, brandContent: false});
    const [tiktokDisclose, setTiktokDisclose] = useState(false);

    useEffect(() => {
        if (!tiktokConnected) return;
        api<{creator: TikTokCreatorInfo}>("/api/admin/social/tiktok-creator")
            .then((body) => setTiktokCreator(body.creator))
            .catch((caught) => setTiktokCreatorError(caught instanceof Error ? caught.message : "Unable to load the TikTok account"));
    }, [tiktokConnected]);

    const tiktokDirect = selected.includes("tiktok") && modes.tiktok === "post";
    const tiktokTooLong = Boolean(tiktokDirect && tiktokCreator?.maxVideoPostDurationSec && video.durationSeconds && video.durationSeconds > tiktokCreator.maxVideoPostDurationSec);
    const tiktokProblem = tiktokDirect
        ? (tiktokTooLong ? `This video is longer than the ${tiktokCreator?.maxVideoPostDurationSec}s this TikTok account can post`
            : tiktokDisclose && !tiktok.brandOrganic && !tiktok.brandContent ? "Choose what the commercial content is, or turn the disclosure off"
                : tiktokOptionsProblem(tiktok, tiktokCreator?.privacyLevelOptions ?? null))
        : null;

    const draft = useCallback(async () => {
        setDrafting(true);
        setCopyError("");
        try {
            const body = await api<{copy: ShareCopy; source: "claude" | "template"; error?: string}>("/api/admin/social/copy", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({speciesProfileId: video.speciesProfileId, mediaPath: video.mediaPath, pageSlug: video.pageSlug, speciesName: video.speciesName})
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
        const captionFor: Record<SocialPlatform, string> = {
            youtube: copy.youtube.description,
            tiktok: copy.tiktok.caption,
            instagram: copy.instagram.caption,
            facebook: copy.facebook.caption,
            x: xText
        };
        try {
            const body = await api<{queued: SocialPlatform[]; skipped: SocialPlatform[]}>("/api/admin/social/posts", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    speciesProfileId: video.speciesProfileId,
                    mediaPath: video.mediaPath,
                    title: copy.youtube.title,
                    targets: selected.map((platform) => ({
                        platform,
                        caption: captionFor[platform],
                        mode: modes[platform],
                        ...(platform === "tiktok" ? {tiktok: {...tiktok, brandOrganic: tiktokDisclose && tiktok.brandOrganic, brandContent: tiktokDisclose && tiktok.brandContent}} : {})
                    }))
                })
            });
            const queued = body.queued.map((platform) => SOCIAL_PLATFORM_LABELS[platform]).join(", ");
            const skipped = body.skipped.map((platform) => SOCIAL_PLATFORM_LABELS[platform]).join(", ");
            onShared([
                queued && `Uploading ${video.speciesName} to ${queued}.`,
                body.queued.includes("tiktok") && "TikTok can take a few minutes to process the video before it appears.",
                skipped && `Already shared to ${skipped}.`
            ].filter(Boolean).join(" "));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to share");
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={`Share ${video.speciesName}`}>
            <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-line-300 bg-canvas-950 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">Share</p>
                        <h2 className="mt-1 font-display text-2xl text-white">{video.speciesName} · {KIND_LABELS[video.kind]}</h2>
                        {video.videoHook ? <p className="mt-1 text-xs text-ink-400">Opens on: “{video.videoHook}”</p> : null}
                    </div>
                    <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-white"><CloseCircle size={26} /></button>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-[10rem_1fr]">
                    <video src={video.stableUrl} controls playsInline preload="metadata" className="aspect-[9/16] w-40 bg-black object-cover" />
                    <div className="flex flex-col gap-4">
                        {!video.hasAudio && (
                            <p className="flex gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100"><DangerTriangle size={16} className="shrink-0" />This clip is silent. Short-video feeds favour audio.</p>
                        )}
                        <fieldset className="flex flex-col gap-2">
                            <legend className="mb-1 text-xs font-bold text-ink-300">Post to</legend>
                            {SOCIAL_PLATFORMS.map((platform) => {
                                const connected = Boolean(connections.find((candidate) => candidate.platform === platform)?.connected);
                                const already = blocked(platform);
                                const checked = selected.includes(platform);
                                return (
                                    <div key={platform} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line-300 px-3 py-2">
                                        <label className={`flex flex-1 items-center gap-2 text-sm ${available(platform) ? "text-white" : "text-ink-500"}`}>
                                            <input type="checkbox" disabled={!available(platform)} checked={checked} onChange={(event) => setSelected((current) => event.target.checked ? [...current, platform] : current.filter((item) => item !== platform))} />
                                            {SOCIAL_PLATFORM_LABELS[platform]}
                                            {!connected ? <span className="text-[11px]">(not connected)</span> : already ? <span className="text-[11px]">({modes[platform] === "draft" ? "draft already sent" : "already posted"})</span> : null}
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
                    <div className="flex flex-wrap gap-1 rounded-xl border border-line-300 p-1" role="tablist">
                        {SOCIAL_PLATFORMS.map((platform) => (
                            <button key={platform} role="tab" aria-selected={tab === platform} onClick={() => setTab(platform)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${tab === platform ? "bg-primary-400 text-canvas-950" : "text-ink-300 hover:text-white"}`}>{SOCIAL_PLATFORM_LABELS[platform]}</button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        {copySource ? <span className="text-[11px] text-ink-500">{copySource === "claude" ? "Drafted by Claude" : "Template draft"}</span> : null}
                        <button onClick={() => draft()} disabled={drafting} className="inline-flex items-center gap-1.5 rounded-lg border border-line-300 px-3 py-1.5 text-xs font-bold text-white hover:border-primary-300 disabled:opacity-50"><Refresh size={14} />{drafting ? "Drafting…" : "Regenerate"}</button>
                    </div>
                </div>
                {copyError && <p className="mt-3 text-xs text-amber-200">{copyError}</p>}

                {!copy ? <div className="grid min-h-[12rem] place-items-center text-sm text-ink-400">{drafting ? "Drafting titles and captions…" : "No draft"}</div> : (
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
                                    creator={tiktokCreator}
                                    creatorError={tiktokCreatorError}
                                    connected={tiktokConnected}
                                    draftMode={modes.tiktok === "draft"}
                                    options={tiktok}
                                    onChange={setTiktok}
                                    disclose={tiktokDisclose}
                                    onDiscloseChange={setTiktokDisclose}
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
                                    Add the animal page link (X shows posts with outside links to fewer people)
                                </label>
                            </>
                        )}
                    </div>
                )}

                {error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
                {tiktokProblem && <p className="mt-4 text-xs text-amber-200">TikTok: {tiktokProblem} (TikTok tab).</p>}
                {tiktokDirect && (
                    <p className="mt-4 text-right text-[11px] leading-5 text-ink-400">
                        By posting, you agree to TikTok&apos;s <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer" className="underline hover:text-white">Music Usage Confirmation</a>
                        {tiktokDisclose && tiktok.brandContent ? <> and <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noreferrer" className="underline hover:text-white">Branded Content Policy</a></> : null}.
                    </p>
                )}

                <div className="mt-5 flex justify-end gap-2">
                    <button onClick={onClose} className="rounded-xl border border-line-300 px-5 py-2.5 text-sm font-bold text-white hover:border-primary-300">Cancel</button>
                    <button onClick={submit} disabled={submitting || !copy || selected.length === 0 || tooLong || Boolean(tiktokProblem)} className="inline-flex items-center gap-2 rounded-xl bg-primary-400 px-5 py-2.5 text-sm font-black text-canvas-950 disabled:opacity-50"><Share size={16} />{submitting ? "Queuing…" : `Share to ${selected.length} platform${selected.length === 1 ? "" : "s"}`}</button>
                </div>
            </div>
        </div>
    );
}

type TikTokPostSettingsProps = {
    creator: TikTokCreatorInfo | null;
    creatorError: string;
    connected: boolean;
    draftMode: boolean;
    options: TikTokPostOptions;
    onChange: (options: TikTokPostOptions) => void;
    disclose: boolean;
    onDiscloseChange: (disclose: boolean) => void;
};

/** The posting choices TikTok's Content Sharing Guidelines require us to show (and not preset). */
function TikTokPostSettings({creator, creatorError, connected, draftMode, options, onChange, disclose, onDiscloseChange}: TikTokPostSettingsProps) {
    if (!connected) return <p className="mt-4 text-xs text-ink-500">Connect TikTok to choose its posting settings.</p>;
    if (draftMode) return <p className="mt-4 text-xs text-ink-400">Sent to the account&apos;s TikTok drafts: privacy, interactions and disclosure are chosen in the TikTok app when you finish the post.</p>;
    const set = (patch: Partial<TikTokPostOptions>) => onChange({...options, ...patch});
    const interactions: Array<{key: "allowComment" | "allowDuet" | "allowStitch"; label: string; disabled: boolean}> = [
        {key: "allowComment", label: "Comment", disabled: Boolean(creator?.commentDisabled)},
        {key: "allowDuet", label: "Duet", disabled: Boolean(creator?.duetDisabled)},
        {key: "allowStitch", label: "Stitch", disabled: Boolean(creator?.stitchDisabled)}
    ];
    return (
        <div className="mt-5 flex flex-col gap-4 rounded-xl border border-line-300 p-4">
            <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {creator?.avatarUrl ? <img src={creator.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="h-9 w-9 rounded-full bg-white/10" />}
                <p className="text-sm text-white">Posting to TikTok as <strong>{creator?.nickname ?? (creatorError ? "unknown account" : "…")}</strong></p>
            </div>
            {creatorError && <p className="text-xs text-red-200">{creatorError}</p>}

            <label className="block text-xs font-bold text-ink-300">Who can view this video
                <select value={options.privacyLevel} onChange={(event) => set({privacyLevel: event.target.value})} className={fieldClass}>
                    <option value="" disabled>Choose who can view…</option>
                    {(creator?.privacyLevelOptions ?? []).map((level) => (
                        <option key={level} value={level} disabled={disclose && options.brandContent && level === "SELF_ONLY"}>{TIKTOK_PRIVACY_LABELS[level] ?? level}</option>
                    ))}
                </select>
            </label>
            <p className="-mt-2 text-[11px] text-ink-500">Until TikTok audits the app it only accepts &quot;Only me&quot;, from a private account.</p>

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
        </div>
    );
}
