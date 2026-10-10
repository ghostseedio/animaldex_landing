import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import type {SourceType, TimelineEntry, VideoPlan} from "@/lib/content-video/plan";

// Service-role access to admin_content_videos and the content-videos bucket
// (supabase/migrations/20261010120000_admin_content_videos.sql).

export const CONTENT_VIDEO_BUCKET = "content-videos";
export const CONTENT_VIDEO_MEDIA_KIND = "blog_video";

export type ContentVideoStatus = "scripting" | "generating" | "rendering" | "ready" | "failed";

/** One Higgsfield clip of the plan (by scene index). "imaging": its first frame is being drawn. */
export type ContentVideoClip = {
    scene: number;
    status: "imaging" | "submitted" | "completed" | "failed";
    imageStatusUrl?: string;
    /** The drawn first frame (generated keyframes), also the fallback still if the animation fails. */
    imageUrl?: string;
    idempotencyKey: string;
    requestId?: string;
    statusUrl?: string;
    videoUrl?: string;
    usd: number;
    error?: string;
};

export type ContentVideoRow = {
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
    poster_path: string | null;
    duration_seconds: number | null;
    error: string | null;
    published_at: string | null;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
};

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase service role is not configured");
    return {url, key};
}

function rest(path: string, init: RequestInit & {prefer?: string; next?: {revalidate?: number; tags?: string[]}} = {}) {
    const {url, key} = config();
    const headers: Record<string, string> = getSupabaseHeaders(key, {"Content-Type": "application/json"});
    if (init.prefer) headers.Prefer = init.prefer;
    const {prefer: _prefer, next, ...rest} = init;
    return fetch(`${url}/rest/v1/${path}`, {
        ...rest,
        headers: {...headers, ...(init.headers as Record<string, string> | undefined)},
        ...(next ? {next} : {cache: "no-store" as const})
    });
}

async function expectOk(response: Response, what: string) {
    if (response.ok) return response;
    const text = await response.text().catch(() => "");
    throw new Error(`${what} failed (${response.status}): ${text.slice(0, 300)}`);
}

function normalizeRow(row: ContentVideoRow): ContentVideoRow {
    return {
        ...row,
        estimated_usd: Number(row.estimated_usd ?? 0),
        duration_seconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
        clips: Array.isArray(row.clips) ? row.clips : []
    };
}

export async function listContentVideos(limit = 100) {
    const response = await expectOk(await rest(`admin_content_videos?select=*&archived_at=is.null&order=created_at.desc&limit=${limit}`), "Loading blog videos");
    return (await response.json() as ContentVideoRow[]).map(normalizeRow);
}

export async function getContentVideo(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const response = await expectOk(await rest(`admin_content_videos?id=eq.${id}&select=*`), "Loading blog video");
    const [row] = await response.json() as ContentVideoRow[];
    return row ? normalizeRow(row) : null;
}

export async function findContentVideoByPath(videoPath: string) {
    const response = await expectOk(await rest(`admin_content_videos?video_path=eq.${encodeURIComponent(videoPath)}&archived_at=is.null&select=*`), "Loading blog video");
    const [row] = await response.json() as ContentVideoRow[];
    return row ? normalizeRow(row) : null;
}

/** Slugs of one page family that already have a live (not archived) video. */
export async function usedSourceSlugs(type: SourceType = "blog") {
    const response = await expectOk(await rest(`admin_content_videos?select=source_slug&archived_at=is.null&source_type=eq.${type}`), "Loading used pages");
    return new Set((await response.json() as Array<{source_slug: string}>).map((row) => row.source_slug));
}

/** Null when the post already has a live video (the unique index). */
export async function insertContentVideo(type: SourceType, slug: string, title: string): Promise<ContentVideoRow | null> {
    const response = await rest("admin_content_videos", {
        method: "POST",
        prefer: "return=representation",
        body: JSON.stringify({source_type: type, source_slug: slug, source_title: title, status: "scripting", progress: "Queued"})
    });
    if (response.status === 409) return null;
    await expectOk(response, "Creating blog video");
    const [row] = await response.json() as ContentVideoRow[];
    return row ? normalizeRow(row) : null;
}

export type ContentVideoPatch = Partial<Omit<ContentVideoRow, "id" | "source_type" | "source_slug" | "created_at" | "updated_at">>;

export async function updateContentVideo(id: string, patch: ContentVideoPatch) {
    await expectOk(await rest(`admin_content_videos?id=eq.${id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({...patch, updated_at: new Date().toISOString()})
    }), "Updating blog video");
}

/** USD committed to clips since the start of the UTC day, across all blog videos. */
export async function spentTodayUSD() {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const response = await expectOk(await rest(`admin_content_videos?select=estimated_usd&created_at=gte.${start}`), "Loading today's spend");
    return (await response.json() as Array<{estimated_usd: number | string}>).reduce((sum, row) => sum + Number(row.estimated_usd ?? 0), 0);
}

export function publicStorageUrl(path: string) {
    return `${config().url}/storage/v1/object/public/${CONTENT_VIDEO_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export async function uploadToStorage(path: string, bytes: Buffer, contentType: string) {
    const {url, key} = config();
    const response = await fetch(`${url}/storage/v1/object/${CONTENT_VIDEO_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": contentType, "x-upsert": "true", "Cache-Control": "max-age=31536000"}),
        body: new Uint8Array(bytes),
        cache: "no-store",
        signal: AbortSignal.timeout(5 * 60_000)
    });
    await expectOk(response, `Uploading ${path}`);
    return publicStorageUrl(path);
}

/** What a blog page shows: its published video, if any. Cached like managed content. */
export type PublishedContentVideo = {
    videoUrl: string;
    posterUrl: string | null;
    durationSeconds: number | null;
    title: string;
    hookText: string;
    timeline: TimelineEntry[];
    publishedAt: string;
};

export const CONTENT_VIDEO_CACHE_TAG = "content-videos";

export async function getPublishedContentVideo(slug: string, type: SourceType = "blog"): Promise<PublishedContentVideo | null> {
    if (!getSupabaseUrl() || !getSupabaseServiceKey()) return null;
    try {
        const response = await rest(
            `admin_content_videos?source_type=eq.${type}&source_slug=eq.${encodeURIComponent(slug)}&archived_at=is.null&published_at=not.is.null&video_path=not.is.null&select=video_path,poster_path,duration_seconds,plan,timeline,published_at&limit=1`,
            {next: {revalidate: 300, tags: [CONTENT_VIDEO_CACHE_TAG]}}
        );
        if (!response.ok) return null;
        const [row] = await response.json() as Array<Pick<ContentVideoRow, "video_path" | "poster_path" | "duration_seconds" | "plan" | "timeline" | "published_at">>;
        if (!row?.video_path || !row.published_at) return null;
        return {
            videoUrl: publicStorageUrl(row.video_path),
            posterUrl: row.poster_path ? publicStorageUrl(row.poster_path) : null,
            durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
            title: row.plan?.title ?? "",
            hookText: row.plan?.hookText ?? "",
            timeline: Array.isArray(row.timeline) ? row.timeline : [],
            publishedAt: row.published_at
        };
    } catch {
        // The article renders without its video rather than failing.
        return null;
    }
}
