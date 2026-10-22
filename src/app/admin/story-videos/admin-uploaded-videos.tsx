"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {ClapperboardPlay, Share, TrashBinMinimalistic, Upload} from "solar-icon-set";
import {SOCIAL_PLATFORM_LABELS, type SocialPostRow} from "@/lib/social/types";
import {Alert, Badge, Button, Card, cn, EmptyState, fieldClass, Section, Skeleton} from "@/components/admin/ui";

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

/** Length of a local video file, read by the browser before it uploads. */
function readDuration(file: File) {
    return new Promise<number | null>((resolve) => {
        const url = URL.createObjectURL(file);
        const probe = document.createElement("video");
        probe.preload = "metadata";
        const done = (value: number | null) => {
            URL.revokeObjectURL(url);
            resolve(value);
        };
        probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? probe.duration : null);
        probe.onerror = () => done(null);
        probe.src = url;
    });
}

/** PUTs the file to the signed storage URL, reporting progress (fetch has no upload progress). */
function putFile(url: string, file: File, onProgress: (fraction: number) => void) {
    return new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("PUT", url);
        request.setRequestHeader("Content-Type", "video/mp4");
        request.setRequestHeader("x-upsert", "false");
        request.upload.onprogress = (event) => {
            if (event.lengthComputable) onProgress(event.loaded / event.total);
        };
        request.onload = () => (request.status >= 200 && request.status < 300
            ? resolve()
            : reject(new Error(`Storage refused the file (${request.status}): ${request.responseText.slice(0, 200)}`)));
        request.onerror = () => reject(new Error("The upload was interrupted"));
        request.send(file);
    });
}

const MB = 1024 * 1024;

type Props = {
    shares: Map<string, SocialPostRow[]>;
    onShare: (video: UploadedVideo) => void;
    onNotice: (message: string) => void;
};

/**
 * Finished videos made outside the site (travel vlogs, edits): upload one and
 * share it to the official accounts like any story or page video. The notes
 * (what happens, the voiceover) are what Claude drafts the captions from.
 */
export default function AdminUploadedVideos({shares, onShare, onNotice}: Props) {
    const [videos, setVideos] = useState<UploadedVideo[] | null>(null);
    const [maxBytes, setMaxBytes] = useState(200 * MB);
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [notes, setNotes] = useState("");
    const [progress, setProgress] = useState<number | null>(null);
    const [archiving, setArchiving] = useState<string | null>(null);
    const [error, setError] = useState("");
    const input = useRef<HTMLInputElement>(null);

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

    const tooBig = Boolean(file && file.size > maxBytes);
    const uploading = progress !== null;

    async function upload() {
        if (!file || !title.trim()) return;
        setError("");
        setProgress(0);
        try {
            const durationSeconds = await readDuration(file);
            const signed = await api<{path: string; uploadUrl: string}>("/api/admin/uploaded-videos", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "sign", fileName: file.name, size: file.size})
            });
            await putFile(signed.uploadUrl, file, setProgress);
            await api("/api/admin/uploaded-videos", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "create", path: signed.path, title: title.trim(), notes: notes.trim(), durationSeconds})
            });
            onNotice(`Uploaded “${title.trim()}”. Share it from its card below.`);
            setFile(null);
            setTitle("");
            setNotes("");
            if (input.current) input.current.value = "";
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Upload failed");
        } finally {
            setProgress(null);
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

    return (
        <Section
            title={<>Uploaded videos {videos ? <span className="tabular-nums">({videos.length})</span> : ""}</>}
            description="Your own finished edits (travel vlogs, dives, encounters). Upload a vertical MP4 and share it to the official accounts; the notes are what the captions are drafted from."
        >
            <Card>
                <div className="flex flex-col gap-3 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                            ref={input}
                            type="file"
                            accept="video/mp4"
                            disabled={uploading}
                            onChange={(event) => {
                                const picked = event.target.files?.[0] ?? null;
                                setFile(picked);
                                if (picked && !title) setTitle(picked.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
                            }}
                            className={cn(fieldClass, "sm:w-80")}
                        />
                        <input value={title} onChange={(event) => setTitle(event.target.value)} disabled={uploading} placeholder="Title (e.g. Labuan Bajo vlog, part 1)" maxLength={200} aria-label="Title" className={cn(fieldClass, "flex-1")} />
                    </div>
                    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={uploading} rows={3} maxLength={4000} placeholder="What happens in it: place, animals, the voiceover. Claude drafts the titles and captions from this." aria-label="Notes" className={fieldClass} />
                    <div className="flex flex-wrap items-center gap-3">
                        <p className={`text-[11px] ${tooBig ? "text-red-200" : "text-ink-500"}`}>
                            {file ? `${(file.size / MB).toFixed(0)} MB` : "MP4"} · up to {Math.round(maxBytes / MB)} MB. Export 1080×1920 at about 6–8 Mbps for long videos.
                        </p>
                        <Button variant="primary" onClick={upload} loading={uploading} disabled={!file || !title.trim() || tooBig} className="sm:ml-auto">
                            {uploading ? null : <Upload size={16} />}{uploading ? `Uploading… ${Math.round((progress ?? 0) * 100)}%` : "Upload video"}
                        </Button>
                    </div>
                    {uploading && (
                        <div className="h-1.5 w-full bg-canvas-900" role="progressbar" aria-valuenow={Math.round((progress ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
                            <div className="h-full bg-primary-400 transition-[width]" style={{width: `${(progress ?? 0) * 100}%`}} />
                        </div>
                    )}
                </div>
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
                <EmptyState className="mt-3" icon={<ClapperboardPlay size={22} />} title="No uploaded videos" description="Upload a finished edit to share it." />
            ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {videos.map((video) => {
                        const videoShares = shares.get(video.video_path) ?? [];
                        return (
                            <article key={video.id} className="flex flex-col overflow-hidden border border-line-300 bg-surface-900">
                                <div className="grid grid-cols-[7.5rem_1fr] gap-3 p-3">
                                    <video src={video.videoUrl} controls playsInline preload="metadata" className="aspect-[9/16] w-full bg-black object-cover" />
                                    <div className="flex min-w-0 flex-col gap-1.5">
                                        <Badge className="self-start">Uploaded</Badge>
                                        <p className="line-clamp-3 text-sm font-bold leading-5 text-white">{video.title}</p>
                                        {video.notes ? <p className="line-clamp-3 text-[11px] text-ink-300">{video.notes}</p> : null}
                                        <p className="text-[11px] leading-4 tabular-nums text-ink-500">
                                            {[
                                                video.duration_seconds ? `${Math.floor(video.duration_seconds / 60)}:${String(Math.round(video.duration_seconds % 60)).padStart(2, "0")}` : null,
                                                video.size_bytes ? `${Math.round(video.size_bytes / MB)} MB` : null,
                                                new Date(video.created_at).toLocaleDateString()
                                            ].filter(Boolean).join(" · ")}
                                        </p>
                                        {videoShares.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {videoShares.map((post) => (
                                                    <Badge key={post.id} title={post.error ?? undefined} tone={post.status === "published" ? "good" : post.status === "failed" ? "bad" : "warn"} className="normal-case tracking-normal">{SOCIAL_PLATFORM_LABELS[post.platform]}: {post.status}</Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-line-300 p-3">
                                    <Button size="sm" variant="primary" onClick={() => onShare(video)}><Share size={14} />Share</Button>
                                    <Button size="sm" variant="danger" onClick={() => archive(video)} loading={archiving === video.id} className="ml-auto"><TrashBinMinimalistic size={14} />Archive</Button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </Section>
    );
}
