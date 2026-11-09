"use client";

import {useCallback, useEffect, useRef, useState, type DragEvent} from "react";
import {ClapperboardPlay, CloseCircle, MagicStick3, Pen, Refresh, Share, TrashBinMinimalistic, Upload} from "solar-icon-set";
import {SOCIAL_PLATFORM_LABELS, type SocialPostRow} from "@/lib/social/types";
import {Alert, Badge, Button, Card, cn, EmptyState, fieldClass, Section, Skeleton, Spinner} from "@/components/admin/ui";
import {CompressionCancelled, compressVideo, probeVideo, sampleFrames, srtToText, type VideoProbe} from "@/lib/admin/video-compress";

export type UploadedVideo = {
    id: string;
    title: string;
    notes: string;
    video_path: string;
    duration_seconds: number | null;
    size_bytes: number | null;
    created_at: string;
    videoUrl: string;
};

async function api<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, {cache: "no-store", ...init});
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Request failed (${response.status})`);
    return body as T;
}

const post = <T,>(body: Record<string, unknown>) => api<T>("/api/admin/uploaded-videos", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body)
});

class UploadAborted extends Error {
    constructor() {
        super("Cancelled");
    }
}

/** PUTs the file to the signed storage URL, reporting progress (fetch has no upload progress). */
function putFile(url: string, file: Blob, signal: AbortSignal, onProgress: (loaded: number) => void) {
    return new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("PUT", url);
        request.setRequestHeader("Content-Type", "video/mp4");
        request.setRequestHeader("x-upsert", "false");
        request.upload.onprogress = (event) => onProgress(event.loaded);
        request.onload = () => (request.status >= 200 && request.status < 300
            ? resolve()
            : reject(new Error(`Storage refused the file (${request.status}): ${request.responseText.slice(0, 200)}`)));
        request.onerror = () => reject(new Error("The upload was interrupted"));
        request.onabort = () => reject(new UploadAborted());
        signal.addEventListener("abort", () => request.abort(), {once: true});
        request.send(file);
    });
}

/** At most `limit` jobs at once, started in the order they asked. */
function createLimiter(limit: number) {
    let running = 0;
    const waiting: Array<() => void> = [];
    return async function run<T>(job: () => Promise<T>): Promise<T> {
        if (running >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
        running += 1;
        try {
            return await job();
        } finally {
            running -= 1;
            waiting.shift()?.();
        }
    };
}

// Measured on the owner's line (2026-11-09): one upload gets 2.1–2.7 MB/s and
// three together saturate it at ~3.3 MB/s; a fourth adds nothing. Encoding uses
// the hardware encoder, so one at a time, overlapping the uploads.
const UPLOAD_CONCURRENCY = 3;
const compressSlot = createLimiter(1);
const uploadSlot = createLimiter(UPLOAD_CONCURRENCY);

/** Recent whole-file upload speed, bytes/s; decides whether encoding is worth its time. */
let measuredUploadRate = 0;
/** Seconds of encoding per second of video (0.08 measured for 1080×1920 on the owner's Mac); updated per compression. */
let measuredEncodeRate = 0.1;

type Stage = "probing" | "waiting" | "compressing" | "queued" | "uploading" | "saving" | "describing" | "done" | "failed" | "cancelled";

type QueueItem = {
    key: string;
    file: File;
    title: string;
    notes: string;
    transcript: string;
    stage: Stage;
    probe: VideoProbe | null;
    /** 0–1 within the current stage. */
    progress: number;
    /** Bytes that go up (after compression). */
    uploadBytes: number;
    compressedNote: string;
    rate: number;
    error: string;
    videoId: string | null;
};

const MB = 1024 * 1024;
const formatMB = (bytes: number) => `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;
const titleFromName = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
const stemOf = (name: string) => name.replace(/\.[^.]+$/, "").toLowerCase();
const isVideo = (file: File) => file.type.startsWith("video/") || /\.(mp4|m4v|mov)$/i.test(file.name);
const isSrt = (file: File) => /\.srt$/i.test(file.name);
const ACTIVE: Stage[] = ["probing", "waiting", "compressing", "queued", "uploading", "saving", "describing"];

const STAGE_LABEL: Record<Stage, string> = {
    probing: "Reading",
    waiting: "Waiting to compress",
    compressing: "Compressing",
    queued: "Waiting to upload",
    uploading: "Uploading",
    saving: "Saving",
    describing: "Writing what happens…",
    done: "Done",
    failed: "Failed",
    cancelled: "Cancelled"
};

type Props = {
    shares: Map<string, SocialPostRow[]>;
    onShare: (video: UploadedVideo) => void;
    onNotice: (message: string) => void;
};

/**
 * Finished videos made outside the site (travel vlogs, edits, Shorts): drop
 * several at once and they compress, upload in parallel and get their "what
 * happens" notes written when left empty, then share to the official accounts
 * like any story or page video. The notes are what Claude drafts captions from.
 */
export default function AdminUploadedVideos({shares, onShare, onNotice}: Props) {
    const [videos, setVideos] = useState<UploadedVideo[] | null>(null);
    const [maxBytes, setMaxBytes] = useState(200 * MB);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [compress, setCompress] = useState(true);
    const [dragging, setDragging] = useState(false);
    const [archiving, setArchiving] = useState<string | null>(null);
    const [editing, setEditing] = useState<{id: string; title: string; notes: string} | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [describingId, setDescribingId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const input = useRef<HTMLInputElement>(null);
    const queueRef = useRef<QueueItem[]>([]);
    const aborts = useRef(new Map<string, AbortController>());
    const settings = useRef({compress, maxBytes});
    settings.current = {compress, maxBytes};

    const update = useCallback((key: string, patch: Partial<QueueItem>) => {
        queueRef.current = queueRef.current.map((item) => (item.key === key ? {...item, ...patch} : item));
        setQueue(queueRef.current);
    }, []);
    const current = (key: string) => queueRef.current.find((item) => item.key === key);

    const load = useCallback(async () => {
        const body = await api<{videos: UploadedVideo[]; maxBytes: number}>("/api/admin/uploaded-videos");
        setVideos(body.videos);
        setMaxBytes(body.maxBytes);
    }, []);

    useEffect(() => {
        load().catch((caught) => {
            setError(caught instanceof Error ? caught.message : "Unable to load uploaded videos");
            setVideos([]);
        });
    }, [load]);

    const busy = queue.some((item) => ACTIVE.includes(item.stage));
    useEffect(() => {
        if (!busy) return;
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [busy]);

    /** Fills empty notes from the video itself; the owner can edit them after. */
    async function describe(videoId: string, source: Blob | string, transcript: string) {
        const frames = await sampleFrames(source);
        try {
            const body = await post<{video: UploadedVideo; source: string; failures: string[]}>({action: "describe", id: videoId, frames, transcript});
            if (body.failures.length) console.warn("[uploaded-videos] describe fallbacks", body.failures);
            return body.video;
        } catch (caught) {
            // A proxy timeout can cut the reply while the server still saves the notes.
            await new Promise((resolve) => setTimeout(resolve, 4000));
            await load().catch(() => undefined);
            throw caught;
        }
    }

    async function runItem(key: string) {
        const controller = new AbortController();
        aborts.current.set(key, controller);
        const {signal} = controller;
        const item = current(key);
        if (!item) return;
        try {
            const probe = await probeVideo(item.file).catch(() => null);
            if (signal.aborted) throw new UploadAborted();
            const mustRemux = probe ? !probe.isMp4 : !/\.(mp4|m4v)$/i.test(item.file.name);
            const uploadSecondsSaved = probe ? (item.file.size - probe.estimatedBytes) / (measuredUploadRate || 3 * MB) : 0;
            const encodeSeconds = probe ? probe.durationSeconds * measuredEncodeRate : Infinity;
            // Skipped only where the line is so fast that encoding would take longer than the upload it saves.
            const shouldCompress = Boolean(probe && settings.current.compress && probe.worthCompressing && uploadSecondsSaved > encodeSeconds);
            update(key, {probe, stage: shouldCompress || mustRemux ? "waiting" : "queued"});

            let body: Blob = item.file;
            if (shouldCompress || mustRemux) {
                body = await compressSlot(async () => {
                    if (signal.aborted) throw new UploadAborted();
                    update(key, {stage: "compressing", progress: 0});
                    const started = performance.now();
                    const out = await compressVideo(item.file, {
                        targetBitrate: probe?.targetBitrate ?? 8_000_000,
                        width: probe?.width ?? 1080,
                        height: probe?.height ?? 1920,
                        transcodeVideo: shouldCompress,
                        signal,
                        onProgress: (progress) => update(key, {progress})
                    });
                    const seconds = (performance.now() - started) / 1000;
                    if (shouldCompress && probe?.durationSeconds) measuredEncodeRate = seconds / probe.durationSeconds;
                    // Never upload a bigger file than the original MP4.
                    const keep = out.size < item.file.size || mustRemux;
                    update(key, {
                        compressedNote: keep
                            ? `${formatMB(item.file.size)} → ${formatMB(out.size)} in ${seconds.toFixed(0)} s`
                            : `kept the original (${formatMB(item.file.size)})`
                    });
                    return keep ? out : item.file;
                });
            }
            if (body.size > settings.current.maxBytes) {
                throw new Error(`${formatMB(body.size)} is over the ${formatMB(settings.current.maxBytes)} limit. Export a smaller copy.`);
            }
            update(key, {stage: "queued", progress: 0, uploadBytes: body.size});

            const path = await uploadSlot(async () => {
                if (signal.aborted) throw new UploadAborted();
                update(key, {stage: "uploading", progress: 0});
                const started = performance.now();
                for (let attempt = 1; ; attempt += 1) {
                    try {
                        const signed = await post<{path: string; uploadUrl: string}>({action: "sign", fileName: item.file.name, size: body.size});
                        await putFile(signed.uploadUrl, body, signal, (loaded) => {
                            const elapsed = (performance.now() - started) / 1000;
                            update(key, {progress: loaded / body.size, rate: elapsed > 0.5 ? loaded / elapsed : 0});
                        });
                        measuredUploadRate = body.size / ((performance.now() - started) / 1000);
                        return signed.path;
                    } catch (caught) {
                        if (caught instanceof UploadAborted || attempt >= 3) throw caught;
                        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
                    }
                }
            });

            update(key, {stage: "saving", progress: 1});
            const latest = current(key) ?? item;
            const created = await post<{video: UploadedVideo}>({
                action: "create",
                path,
                title: latest.title.trim() || titleFromName(item.file.name),
                notes: latest.notes.trim(),
                durationSeconds: probe?.durationSeconds ?? null
            });
            update(key, {videoId: created.video.id});
            setVideos((list) => (list ? [created.video, ...list.filter((video) => video.id !== created.video.id)] : [created.video]));

            if (!latest.notes.trim()) {
                update(key, {stage: "describing"});
                try {
                    const described = await describe(created.video.id, body, latest.transcript);
                    setVideos((list) => list?.map((video) => (video.id === described.id ? described : video)) ?? list);
                } catch (caught) {
                    update(key, {error: `Uploaded, but the notes could not be written: ${caught instanceof Error ? caught.message : caught}. Use “Write it” on the card.`});
                }
            }
            update(key, {stage: "done", progress: 1});
            onNotice(`Uploaded “${created.video.title}”. Share it from its card below.`);
        } catch (caught) {
            if (caught instanceof UploadAborted || caught instanceof CompressionCancelled || signal.aborted) {
                update(key, {stage: "cancelled"});
            } else {
                update(key, {stage: "failed", error: caught instanceof Error ? caught.message : "Upload failed"});
            }
        } finally {
            aborts.current.delete(key);
        }
    }

    function addFiles(list: FileList | File[]) {
        const files = Array.from(list);
        const subtitles = new Map(files.filter(isSrt).map((file) => [stemOf(file.name), file]));
        const added = files.filter(isVideo).map((file): QueueItem => ({
            key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
            file,
            title: titleFromName(file.name),
            notes: "",
            transcript: "",
            stage: "probing",
            probe: null,
            progress: 0,
            uploadBytes: file.size,
            compressedNote: "",
            rate: 0,
            error: "",
            videoId: null
        }));
        const skipped = files.filter((file) => !isVideo(file) && !isSrt(file)).length;
        if (!added.length) {
            setError(skipped ? "Only video files (MP4 or MOV) and their .srt subtitles can be added." : "");
            return;
        }
        setError(skipped ? `${skipped} file${skipped === 1 ? "" : "s"} skipped (not a video or .srt).` : "");
        queueRef.current = [...queueRef.current, ...added];
        setQueue(queueRef.current);
        for (const item of added) {
            const subtitle = subtitles.get(stemOf(item.file.name));
            // The .srt is read before the item can reach the "describe" step.
            const ready = subtitle ? subtitle.text().then((text) => update(item.key, {transcript: srtToText(text)})).catch(() => undefined) : Promise.resolve();
            void ready.then(() => runItem(item.key));
        }
    }

    function retry(key: string) {
        update(key, {stage: "probing", error: "", progress: 0, rate: 0, compressedNote: ""});
        void runItem(key);
    }

    function removeItem(key: string) {
        aborts.current.get(key)?.abort();
        queueRef.current = queueRef.current.filter((item) => item.key !== key);
        setQueue(queueRef.current);
    }

    function clearFinished() {
        queueRef.current = queueRef.current.filter((item) => ACTIVE.includes(item.stage) || item.stage === "failed");
        setQueue(queueRef.current);
    }

    function onDrop(event: DragEvent<HTMLElement>) {
        event.preventDefault();
        setDragging(false);
        if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
    }

    async function saveEdit() {
        if (!editing) return;
        setSavingEdit(true);
        setError("");
        try {
            const body = await post<{video: UploadedVideo}>({action: "update", id: editing.id, title: editing.title, notes: editing.notes});
            setVideos((list) => list?.map((video) => (video.id === body.video.id ? body.video : video)) ?? list);
            setEditing(null);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to save");
        } finally {
            setSavingEdit(false);
        }
    }

    async function writeNotes(video: UploadedVideo) {
        setDescribingId(video.id);
        setError("");
        try {
            const described = await describe(video.id, video.videoUrl, "");
            setVideos((list) => list?.map((item) => (item.id === described.id ? described : item)) ?? list);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to write the notes");
        } finally {
            setDescribingId(null);
        }
    }

    async function archive(video: UploadedVideo) {
        if (!window.confirm(`Archive “${video.title}”? It leaves this page and cannot be shared again; posts already made stay up.`)) return;
        setArchiving(video.id);
        setError("");
        try {
            await api(`/api/admin/uploaded-videos?id=${video.id}`, {method: "DELETE"});
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to archive");
        } finally {
            setArchiving(null);
        }
    }

    const finished = queue.filter((item) => item.stage === "done" || item.stage === "cancelled").length;
    const totalRate = queue.filter((item) => item.stage === "uploading").reduce((sum, item) => sum + item.rate, 0);

    return (
        <Section
            title={<>Uploaded videos {videos ? <span className="tabular-nums">({videos.length})</span> : ""}</>}
            description="Your own finished edits (travel vlogs, Shorts, encounters). Drop several at once; they upload in parallel and are shared to the official accounts from their cards. Captions are drafted from each video's notes."
        >
            <Card>
                <div
                    onDragEnter={(event) => {
                        event.preventDefault();
                        setDragging(true);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
                    }}
                    onDrop={onDrop}
                    className={cn(
                        "m-3 flex flex-col items-center gap-2 border border-dashed px-4 py-6 text-center transition-colors",
                        dragging ? "border-primary-300 bg-primary-400/10" : "border-line-300"
                    )}
                >
                    <Upload size={22} className="text-ink-300" />
                    <p className="text-sm font-bold text-white">Drop videos here</p>
                    <p className="max-w-xl text-[11px] leading-4 text-ink-500">
                        MP4 or MOV, up to {Math.round(maxBytes / MB)} MB each, {UPLOAD_CONCURRENCY} at a time. Drop a video&apos;s .srt with it and the notes quote its voiceover exactly.
                    </p>
                    <input
                        ref={input}
                        type="file"
                        multiple
                        accept="video/mp4,video/quicktime,.mp4,.m4v,.mov,.srt"
                        className="sr-only"
                        onChange={(event) => {
                            if (event.target.files?.length) addFiles(event.target.files);
                            event.target.value = "";
                        }}
                    />
                    <Button variant="primary" size="sm" onClick={() => input.current?.click()}><Upload size={14} />Choose videos</Button>
                    <label className="mt-1 flex items-center gap-2 text-[11px] text-ink-300">
                        <input type="checkbox" checked={compress} onChange={(event) => setCompress(event.target.checked)} />
                        Compress big files first (H.264 at ~8 Mbps for 1080×1920: no visible change, far less to upload)
                    </label>
                </div>

                {queue.length > 0 && (
                    <div className="border-t border-line-300">
                        <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-[11px] text-ink-500">
                            <span className="tabular-nums">{finished}/{queue.length} done</span>
                            {totalRate > 0 && <span className="tabular-nums">· {formatMB(totalRate)}/s</span>}
                            {finished > 0 && <Button size="sm" variant="ghost" className="ml-auto" onClick={clearFinished}>Clear finished</Button>}
                        </div>
                        <ul className="divide-y divide-line-300">
                            {queue.map((item) => {
                                const editable = ["probing", "waiting", "compressing", "queued", "uploading"].includes(item.stage);
                                const percent = Math.round(item.progress * 100);
                                const detail = [
                                    item.stage === "compressing" ? `${percent}%` : null,
                                    item.stage === "uploading" ? `${percent}% of ${formatMB(item.uploadBytes)}${item.rate ? ` · ${formatMB(item.rate)}/s` : ""}` : null,
                                    item.probe ? `${Math.round(item.probe.durationSeconds)} s · ${item.probe.width}×${item.probe.height} · ${(item.probe.videoBitrate / 1e6).toFixed(1)} Mbps` : null,
                                    item.compressedNote || null,
                                    item.transcript ? "voiceover from .srt" : null
                                ].filter(Boolean).join(" · ");
                                return (
                                    <li key={item.key} className="flex flex-col gap-2 p-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge tone={item.stage === "done" ? "good" : item.stage === "failed" ? "bad" : item.stage === "cancelled" ? undefined : "warn"} className="gap-1">
                                                {ACTIVE.includes(item.stage) ? <Spinner size={10} /> : null}{STAGE_LABEL[item.stage]}
                                            </Badge>
                                            <span className="min-w-0 truncate text-xs text-ink-300" title={item.file.name}>{item.file.name}</span>
                                            <span className="text-[11px] tabular-nums text-ink-500">{detail}</span>
                                            <span className="ml-auto flex gap-1">
                                                {(item.stage === "failed" || item.stage === "cancelled") && <Button size="sm" onClick={() => retry(item.key)}><Refresh size={14} />Retry</Button>}
                                                <Button size="sm" variant="ghost" aria-label={ACTIVE.includes(item.stage) ? `Cancel ${item.file.name}` : `Remove ${item.file.name}`} onClick={() => removeItem(item.key)} disabled={item.stage === "saving" || item.stage === "describing"}><CloseCircle size={14} /></Button>
                                            </span>
                                        </div>
                                        {(item.stage === "compressing" || item.stage === "uploading") && (
                                            <div className="h-1 w-full bg-canvas-900" role="progressbar" aria-label={`${STAGE_LABEL[item.stage]} ${item.file.name}`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                                                <div className={cn("h-full transition-[width]", item.stage === "compressing" ? "bg-ink-300" : "bg-primary-400")} style={{width: `${percent}%`}} />
                                            </div>
                                        )}
                                        {editable && (
                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                <input value={item.title} onChange={(event) => update(item.key, {title: event.target.value})} maxLength={200} aria-label={`Title for ${item.file.name}`} placeholder="Title" className={cn(fieldClass, "sm:w-72")} />
                                                <textarea value={item.notes} onChange={(event) => update(item.key, {notes: event.target.value})} rows={1} maxLength={4000} aria-label={`What happens in ${item.file.name}`} placeholder="What happens in it (empty: AI writes it)" className={cn(fieldClass, "flex-1")} />
                                            </div>
                                        )}
                                        {item.error && <p className="text-[11px] text-red-200">{item.error}</p>}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </Card>

            {error && <Alert tone="bad" className="mt-3">{error}</Alert>}

            {videos === null ? (
                <div role="status" aria-label="Loading uploaded videos" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({length: 2}, (_, index) => (
                        <div key={index} aria-hidden="true" className="grid grid-cols-[7.5rem_1fr] gap-3 border border-line-300 bg-surface-900 p-3">
                            <Skeleton className="aspect-[9/16] w-full" />
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-2.5 w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : videos.length === 0 ? (
                <EmptyState className="mt-3" icon={<ClapperboardPlay size={22} />} title="No uploaded videos" description="Drop a finished edit above to share it." />
            ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {videos.map((video) => {
                        const videoShares = shares.get(video.video_path) ?? [];
                        const isEditing = editing?.id === video.id;
                        const pendingNotes = !video.notes && queue.some((item) => item.videoId === video.id && item.stage === "describing");
                        return (
                            <article key={video.id} className="flex flex-col overflow-hidden border border-line-300 bg-surface-900">
                                <div className="grid grid-cols-[7.5rem_1fr] gap-3 p-3">
                                    <video src={video.videoUrl} controls playsInline preload="metadata" className="aspect-[9/16] w-full bg-black object-cover" />
                                    <div className="flex min-w-0 flex-col gap-1.5">
                                        <Badge className="self-start">Uploaded</Badge>
                                        <p className="line-clamp-3 text-sm font-bold leading-5 text-white">{isEditing ? editing.title : video.title}</p>
                                        {isEditing ? null : video.notes ? (
                                            <p className="line-clamp-4 whitespace-pre-line text-[11px] text-ink-300" title={video.notes}>{video.notes}</p>
                                        ) : pendingNotes || describingId === video.id ? (
                                            <p className="flex items-center gap-1.5 text-[11px] text-ink-500"><Spinner size={10} />Writing what happens…</p>
                                        ) : null}
                                        <p className="text-[11px] leading-4 tabular-nums text-ink-500">
                                            {[
                                                video.duration_seconds ? `${Math.floor(video.duration_seconds / 60)}:${String(Math.round(video.duration_seconds % 60)).padStart(2, "0")}` : null,
                                                video.size_bytes ? `${Math.round(video.size_bytes / MB)} MB` : null,
                                                new Date(video.created_at).toLocaleDateString()
                                            ].filter(Boolean).join(" · ")}
                                        </p>
                                        {videoShares.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {videoShares.map((share) => (
                                                    <Badge key={share.id} title={share.error ?? undefined} tone={share.status === "published" ? "good" : share.status === "failed" ? "bad" : "warn"} className="normal-case tracking-normal">{SOCIAL_PLATFORM_LABELS[share.platform]}: {share.status}</Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {isEditing && (
                                    <div className="flex flex-col gap-2 px-3 pb-3">
                                        <input value={editing.title} onChange={(event) => setEditing({...editing, title: event.target.value})} maxLength={200} aria-label="Title" className={fieldClass} />
                                        <textarea value={editing.notes} onChange={(event) => setEditing({...editing, notes: event.target.value})} rows={10} maxLength={4000} aria-label="What happens in it" placeholder="What happens in it: place, animals, the voiceover" className={cn(fieldClass, "text-xs leading-5")} />
                                    </div>
                                )}
                                <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-line-300 p-3">
                                    {isEditing ? (
                                        <>
                                            <Button size="sm" variant="primary" onClick={saveEdit} loading={savingEdit} disabled={!editing.title.trim()}>Save</Button>
                                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={savingEdit}>Cancel</Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button size="sm" variant="primary" onClick={() => onShare(video)}><Share size={14} />Share</Button>
                                            <Button size="sm" onClick={() => setEditing({id: video.id, title: video.title, notes: video.notes})}><Pen size={14} />Edit</Button>
                                            {!video.notes && !pendingNotes && (
                                                <Button size="sm" onClick={() => writeNotes(video)} loading={describingId === video.id}>{describingId === video.id ? null : <MagicStick3 size={14} />}Write it</Button>
                                            )}
                                        </>
                                    )}
                                    <Button size="sm" variant="danger" onClick={() => archive(video)} loading={archiving === video.id} className="ml-auto" disabled={isEditing}><TrashBinMinimalistic size={14} />Archive</Button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </Section>
    );
}
