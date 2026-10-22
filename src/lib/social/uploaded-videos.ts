import {randomUUID} from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {CONTENT_VIDEO_BUCKET, publicStorageUrl} from "@/lib/content-video/store";
import {normalizeShareCopy, parseShareCopy, SHARE_COPY_JSON_SCHEMA, type ShareCopy} from "@/lib/social/share-copy";
import {getAbsoluteUrl} from "@/lib/site";

// Finished videos made outside the site (travel vlogs, edits), uploaded in
// /admin/story-videos and shared like story and page videos. The browser puts
// the file straight into the content-videos bucket (uploads/) with a signed
// upload URL, so a 200 MB file never passes through this server's memory.
// Table: supabase/migrations/20261022210000_admin_uploaded_videos.sql.

export const UPLOADED_VIDEO_MEDIA_KIND = "uploaded_video";
/** Same cap as the share runner's download (src/lib/social/runner.ts) and the bucket. */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export type UploadedVideoRow = {
    id: string;
    title: string;
    notes: string;
    video_path: string;
    duration_seconds: number | null;
    size_bytes: number | null;
    share: ShareCopy | null;
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

async function rest(path: string, init: RequestInit & {prefer?: string} = {}) {
    const {url, key} = config();
    const {prefer, ...rest} = init;
    const response = await fetch(`${url}/rest/v1/${path}`, {
        ...rest,
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json", ...(prefer ? {Prefer: prefer} : {})}),
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`Uploaded videos request failed (${response.status}): ${(await response.text().catch(() => "")).slice(0, 300)}`);
    return response;
}

function normalizeRow(row: UploadedVideoRow): UploadedVideoRow {
    return {
        ...row,
        duration_seconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
        size_bytes: row.size_bytes === null ? null : Number(row.size_bytes)
    };
}

const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function listUploadedVideos(limit = 100) {
    const response = await rest(`admin_uploaded_videos?select=*&archived_at=is.null&order=created_at.desc&limit=${limit}`);
    return (await response.json() as UploadedVideoRow[]).map(normalizeRow);
}

export async function getUploadedVideo(id: string) {
    if (!isId(id)) return null;
    const [row] = await (await rest(`admin_uploaded_videos?id=eq.${id}&archived_at=is.null&select=*`)).json() as UploadedVideoRow[];
    return row ? normalizeRow(row) : null;
}

async function findUploadedVideoByPath(videoPath: string) {
    const [row] = await (await rest(`admin_uploaded_videos?video_path=eq.${encodeURIComponent(videoPath)}&archived_at=is.null&select=*`)).json() as UploadedVideoRow[];
    return row ? normalizeRow(row) : null;
}

/** A fresh storage path and a one-time URL the browser PUTs the file to. */
export async function signUpload(fileName: string) {
    const {url, key} = config();
    const stem = fileName.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "video";
    const path = `uploads/${new Date().toISOString().slice(0, 10)}/${randomUUID().slice(0, 8)}-${stem}.mp4`;
    const response = await fetch(`${url}/storage/v1/object/upload/sign/${CONTENT_VIDEO_BUCKET}/${path}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
        body: "{}",
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`Could not prepare the upload (${response.status}): ${(await response.text().catch(() => "")).slice(0, 300)}`);
    const body = await response.json() as {url?: string};
    if (!body.url) throw new Error("Storage returned no upload URL");
    return {path, uploadUrl: `${url}/storage/v1${body.url}`};
}

/** Records an uploaded file once the browser has finished putting it in storage. */
export async function createUploadedVideo(input: {path: string; title: string; notes: string; durationSeconds: number | null}) {
    if (!/^uploads\/[0-9-]{10}\/[a-z0-9-]+\.mp4$/.test(input.path)) throw new Error("Not an upload path");
    const head = await fetch(publicStorageUrl(input.path), {method: "HEAD", cache: "no-store"});
    if (!head.ok) throw new Error("The file is not in storage yet; upload it again");
    const size = Number(head.headers.get("content-length")) || null;
    const response = await rest("admin_uploaded_videos", {
        method: "POST",
        prefer: "return=representation",
        body: JSON.stringify({
            title: input.title,
            notes: input.notes,
            video_path: input.path,
            duration_seconds: input.durationSeconds,
            size_bytes: size
        })
    });
    const [row] = await response.json() as UploadedVideoRow[];
    return normalizeRow(row);
}

/** Hidden from the page and from new shares; the file and share log stay. */
export async function archiveUploadedVideo(id: string) {
    if (!isId(id)) throw new Error("Bad id");
    await rest(`admin_uploaded_videos?id=eq.${id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({archived_at: new Date().toISOString(), updated_at: new Date().toISOString()})
    });
}

async function saveShareCopy(id: string, share: ShareCopy) {
    await rest(`admin_uploaded_videos?id=eq.${id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({share, updated_at: new Date().toISOString()})
    });
}

export type ShareableUploadedVideo = {
    mediaPath: string;
    kind: typeof UPLOADED_VIDEO_MEDIA_KIND;
    speciesProfileId: null;
    speciesName: string;
    pageSlug: null;
    captureId: null;
    stableUrl: string;
    durationSeconds: number | null;
};

function toShareable(row: UploadedVideoRow): ShareableUploadedVideo {
    return {
        mediaPath: row.video_path,
        kind: UPLOADED_VIDEO_MEDIA_KIND,
        speciesProfileId: null,
        speciesName: row.title,
        pageSlug: null,
        captureId: null,
        stableUrl: publicStorageUrl(row.video_path),
        durationSeconds: row.duration_seconds
    };
}

export async function shareableUploadedVideo(id: string) {
    const row = await getUploadedVideo(id);
    return row ? toShareable(row) : null;
}

export async function findShareableUploadedVideoByPath(mediaPath: string) {
    const row = await findUploadedVideoByPath(mediaPath);
    return row ? toShareable(row) : null;
}

const UPLOAD_COPY_SYSTEM_PROMPT = `You write social copy for AnimalDex, a wildlife app where people photograph real animals and collect them. Each post is a real-footage vertical video the team filmed themselves (travel vlogs, dives, wildlife encounters), usually with the app's animal cards shown. You get its title and the team's notes (often the voiceover).

Every piece of copy must do two jobs: HOOK (stop the scroll with the most striking true moment — never invent animals, numbers, records or places that the notes do not support) and SEARCH (work in the phrases people search: the place, the animals, "travel vlog", "snorkeling", and so on, naturally).

Brand rules: never "AnimalDex" in the YouTube title; #AnimalDex is the FIRST hashtag everywhere. Handles: YouTube @animaldexapp, TikTok @animaldex.app, Instagram @animaldexapp, X @animaldexapp, Facebook "the AnimalDex Page". 1–2 emoji at most. App link: <app url>.

- youtube.title: max 100 chars, hook in the first 40, then a search phrase. No hashtags.
- youtube.description: 3–5 short lines, then "Every animal scanned with AnimalDex: <app url>", then "Subscribe @animaldexapp for more.", then 4–5 hashtags starting "#AnimalDex".
- tiktok.caption: hook in 80 chars, a searchable line, a question for comments, "Follow @animaldex.app", 4–5 hashtags starting #AnimalDex. No URL.
- instagram.caption: hook in 125 chars, blank line, 1–2 lines, blank line, "Follow @animaldexapp for more.", blank line, 3–5 hashtags starting #AnimalDex. No URL.
- facebook.caption: hook in 125 chars, blank line, 2–3 lines, blank line, "Get the app: <app url>", 2–3 hashtags starting #AnimalDex.
- x.text: max 240 chars, the hook, 1–2 hashtags starting #AnimalDex. No URL.

Return only the JSON object.`;

export type UploadedShareCopy = {copy: ShareCopy; source: "claude" | "template"; error?: string};

function placeholderCopy(row: UploadedVideoRow): ShareCopy {
    const app = getAbsoluteUrl("en", "/");
    return {
        youtube: {title: row.title, description: `${row.title}\n\nEvery animal scanned with AnimalDex: ${app}\nSubscribe @animaldexapp for more.\n#AnimalDex #Wildlife #TravelVlog`},
        tiktok: {caption: `${row.title}\nFollow @animaldex.app\n#AnimalDex #wildlife #travelvlog`},
        instagram: {caption: `${row.title}\n\nFollow @animaldexapp for more.\n\n#AnimalDex #Wildlife #TravelVlog`},
        facebook: {caption: `${row.title}\n\nGet the app: ${app}\n#AnimalDex #Wildlife`},
        x: {text: `${row.title} #AnimalDex`}
    };
}

/** The saved copy, unless there is none or `regenerate`: then a Claude draft from the title and notes (saved). */
export async function uploadedShareCopy(id: string, regenerate: boolean): Promise<UploadedShareCopy> {
    const row = await getUploadedVideo(id);
    if (!row) throw new Error("Video not found");
    const context = {name: row.title};
    if (row.share && !regenerate) return {copy: normalizeShareCopy(row.share, context), source: "claude"};
    const fallback = normalizeShareCopy(row.share ?? placeholderCopy(row), context);

    const key = process.env.CLAUDE_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) return {copy: fallback, source: "template", error: "CLAUDE_API_KEY is not configured"};
    try {
        const client = new Anthropic({apiKey: key});
        const response = await client.beta.messages.create({
            model: process.env.CLAUDE_SOCIAL_COPY_MODEL?.trim() || "claude-opus-5-5",
            max_tokens: 4000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: {effort: "low", format: {type: "json_schema", schema: SHARE_COPY_JSON_SCHEMA}},
            system: UPLOAD_COPY_SYSTEM_PROMPT.replaceAll("<app url>", getAbsoluteUrl("en", "/")),
            messages: [{
                role: "user",
                content: [
                    `Video title: ${row.title}`,
                    row.duration_seconds ? `Length: ${Math.round(row.duration_seconds)} seconds` : "",
                    row.notes ? `\nNotes / voiceover:\n${row.notes.slice(0, 4000)}` : ""
                ].join("\n")
            }]
        });
        if (response.stop_reason === "refusal") throw new Error("Claude declined the request");
        const parsed = parseShareCopy(response.content.map((block) => (block.type === "text" ? block.text : "")).join(""));
        if (!parsed) throw new Error("Claude returned unusable copy");
        await saveShareCopy(row.id, parsed);
        return {copy: normalizeShareCopy(parsed, context), source: "claude"};
    } catch (error) {
        return {copy: fallback, source: "template", error: error instanceof Error ? error.message : String(error)};
    }
}
