import type {PublishRequest, PublishResult, SocialConnection, SocialPlatform} from "@/lib/social/types";

// One function per platform: take the downloaded video and a caption, publish
// it to the connected official account, return the post id and link.
// Long-running (uploads plus platform-side processing), so these run in the
// background job in runner.ts, never inside a request.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(response: Response, what: string) {
    const text = await response.text();
    let body: any = null;
    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        body = null;
    }
    if (!response.ok) throw new Error(`${what} failed (${response.status}): ${text.slice(0, 400)}`);
    return body;
}

/** Polls `check` until it returns a value, failing after `timeoutMs`. */
async function poll<T>(what: string, check: () => Promise<T | null>, intervalMs = 5_000, timeoutMs = 10 * 60_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const result = await check();
        if (result !== null) return result;
        await sleep(intervalMs);
    }
    throw new Error(`${what} timed out`);
}

// ── YouTube: resumable upload to the Data API; vertical ≤3 min becomes a Short.
async function publishYouTube(connection: SocialConnection, request: PublishRequest): Promise<PublishResult> {
    const metadata = {
        snippet: {title: request.title.slice(0, 100), description: request.caption.slice(0, 5000), categoryId: "15"},
        status: {privacyStatus: request.mode === "draft" ? "private" : "public", selfDeclaredMadeForKids: false}
    };
    const start = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${connection.accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": "video/mp4",
            "X-Upload-Content-Length": String(request.video.length)
        },
        body: JSON.stringify(metadata)
    });
    if (!start.ok) await readJson(start, "YouTube upload start");
    const uploadUrl = start.headers.get("location");
    if (!uploadUrl) throw new Error("YouTube did not return an upload URL");
    const video = await readJson(await fetch(uploadUrl, {
        method: "PUT",
        headers: {"Content-Type": "video/mp4", "Content-Length": String(request.video.length)},
        body: request.video
    }), "YouTube upload");
    return {externalId: video.id, externalUrl: `https://www.youtube.com/shorts/${video.id}`};
}

// ── TikTok: Content Posting API, FILE_UPLOAD. "post" publishes directly
// (unaudited apps are forced to SELF_ONLY), "draft" lands in the account's
// TikTok inbox to finish on the phone.
const TIKTOK_CHUNK = 10 * 1024 * 1024;

export function tiktokChunkPlan(size: number) {
    // Under 5 MB, or up to one 64 MB chunk: send it whole. Otherwise 10 MB
    // chunks, the remainder folded into the last one (TikTok's rule).
    if (size <= 64 * 1024 * 1024) return {chunkSize: size, count: 1};
    return {chunkSize: TIKTOK_CHUNK, count: Math.floor(size / TIKTOK_CHUNK)};
}

async function publishTikTok(connection: SocialConnection, request: PublishRequest): Promise<PublishResult> {
    const auth = {Authorization: `Bearer ${connection.accessToken}`, "Content-Type": "application/json; charset=UTF-8"};
    const {chunkSize, count} = tiktokChunkPlan(request.video.length);
    const sourceInfo = {source: "FILE_UPLOAD", video_size: request.video.length, chunk_size: chunkSize, total_chunk_count: count};

    let initUrl: string;
    let body: Record<string, unknown>;
    if (request.mode === "draft") {
        initUrl = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
        body = {source_info: sourceInfo};
    } else {
        // The poster's own choices from the share dialog (TikTok forbids presetting them).
        const chosen = request.options?.tiktok;
        if (!chosen?.privacyLevel) throw new Error("No TikTok privacy level was chosen");
        const creator = await readJson(await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {method: "POST", headers: auth}), "TikTok creator info");
        const allowed: string[] = creator?.data?.privacy_level_options ?? [];
        if (allowed.length && !allowed.includes(chosen.privacyLevel)) throw new Error(`TikTok no longer allows "${chosen.privacyLevel}" for this account; choose again`);
        initUrl = "https://open.tiktokapis.com/v2/post/publish/video/init/";
        body = {
            post_info: {
                title: request.caption.slice(0, 2200),
                privacy_level: chosen.privacyLevel,
                disable_comment: !chosen.allowComment,
                disable_duet: !chosen.allowDuet,
                disable_stitch: !chosen.allowStitch,
                brand_organic_toggle: chosen.brandOrganic,
                brand_content_toggle: chosen.brandContent,
                is_aigc: true
            },
            source_info: sourceInfo
        };
    }
    const initResponse = await fetch(initUrl, {method: "POST", headers: auth, body: JSON.stringify(body)});
    if (initResponse.status === 403) {
        const text = await initResponse.clone().text();
        if (text.includes("unaudited_client_can_only_post_to_private_accounts")) {
            throw new Error("TikTok has not audited the app yet, so it only accepts posts set to \"Only me\" from a private account. Choose \"Only me\" (and keep the account private) until the audit passes.");
        }
    }
    const init = await readJson(initResponse, "TikTok upload start");
    if (init?.error?.code && init.error.code !== "ok") throw new Error(`TikTok: ${init.error.message || init.error.code}`);
    const publishId: string = init.data.publish_id;
    const uploadUrl: string = init.data.upload_url;

    for (let index = 0; index < count; index += 1) {
        const from = index * chunkSize;
        const to = index === count - 1 ? request.video.length : from + chunkSize;
        const chunk = request.video.subarray(from, to);
        const response = await fetch(uploadUrl, {
            method: "PUT",
            headers: {"Content-Type": "video/mp4", "Content-Length": String(chunk.length), "Content-Range": `bytes ${from}-${to - 1}/${request.video.length}`},
            body: chunk
        });
        if (!response.ok && response.status !== 206) await readJson(response, `TikTok chunk ${index + 1}/${count}`);
    }

    const postId = await poll("TikTok processing", async () => {
        const status = await readJson(await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
            method: "POST", headers: auth, body: JSON.stringify({publish_id: publishId})
        }), "TikTok status");
        const state: string | undefined = status?.data?.status;
        if (state === "FAILED") throw new Error(`TikTok rejected the video: ${status.data.fail_reason ?? "unknown reason"}`);
        if (state === "SEND_TO_USER_INBOX") return "";
        if (state === "PUBLISH_COMPLETE") return String(status.data.publicaly_available_post_id?.[0] ?? status.data.publicly_available_post_id?.[0] ?? "");
        return null;
    });
    // The stored account name is the display name, not the @handle a post URL needs.
    return {externalId: postId || publishId, externalUrl: null};
}

// ── Instagram: Reels via the Instagram Login content publishing API: create
// a resumable container, upload the bytes, wait for processing, publish.
async function publishInstagram(connection: SocialConnection, request: PublishRequest): Promise<PublishResult> {
    if (!connection.accountId) throw new Error("Instagram account id missing; reconnect Instagram");
    // The API has no drafts (an unpublished container just expires after 24 h).
    if (request.mode === "draft") throw new Error("Instagram has no drafts via the API; use Post");
    const base = `https://graph.instagram.com/v23.0`;
    const token = connection.accessToken;
    // Resumable upload of our bytes (not video_url), so Instagram gets the
    // frame-rate-fixed file rather than downloading the original.
    const container = await readJson(await fetch(`${base}/${connection.accountId}/media`, {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({media_type: "REELS", upload_type: "resumable", caption: request.caption.slice(0, 2200), share_to_feed: "true", access_token: token}).toString()
    }), "Instagram container");
    await readJson(await fetch(container.uri ?? `https://rupload.facebook.com/ig-api-upload/v23.0/${container.id}`, {
        method: "POST",
        headers: {Authorization: `OAuth ${token}`, offset: "0", file_size: String(request.video.length), "Content-Type": "application/octet-stream"},
        body: request.video
    }), "Instagram upload");
    await poll("Instagram processing", async () => {
        const status = await readJson(await fetch(`${base}/${container.id}?fields=status_code,status&access_token=${encodeURIComponent(token)}`), "Instagram status");
        if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new Error(`Instagram could not process the video: ${status.status ?? status.status_code}`);
        return status.status_code === "FINISHED" ? true : null;
    });
    const published = await readJson(await fetch(`${base}/${connection.accountId}/media_publish`, {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({creation_id: container.id, access_token: token}).toString()
    }), "Instagram publish");
    const media = await readJson(await fetch(`${base}/${published.id}?fields=permalink&access_token=${encodeURIComponent(token)}`), "Instagram permalink").catch(() => null);
    return {externalId: published.id, externalUrl: media?.permalink ?? null};
}

// ── Facebook: Page Reels. Start an upload session, send the bytes to
// rupload, then finish with the description; Facebook processes it async.
async function publishFacebook(connection: SocialConnection, request: PublishRequest): Promise<PublishResult> {
    if (!connection.accountId) throw new Error("Facebook Page id missing; reconnect Facebook");
    const base = "https://graph.facebook.com/v23.0";
    const token = connection.accessToken;
    const start = await readJson(await fetch(`${base}/${connection.accountId}/video_reels`, {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({upload_phase: "start", access_token: token}).toString()
    }), "Facebook upload start");
    const videoId: string = start.video_id;
    if (!videoId) throw new Error("Facebook did not return a video id");
    await readJson(await fetch(start.upload_url ?? `https://rupload.facebook.com/video-upload/v23.0/${videoId}`, {
        method: "POST",
        headers: {Authorization: `OAuth ${token}`, offset: "0", file_size: String(request.video.length), "Content-Type": "application/octet-stream"},
        body: request.video
    }), "Facebook upload");
    await readJson(await fetch(`${base}/${connection.accountId}/video_reels`, {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({
            upload_phase: "finish",
            video_id: videoId,
            video_state: request.mode === "draft" ? "DRAFT" : "PUBLISHED",
            description: request.caption.slice(0, 2200),
            access_token: token
        }).toString()
    }), "Facebook publish");
    await poll("Facebook processing", async () => {
        const status = await readJson(await fetch(`${base}/${videoId}?fields=status&access_token=${encodeURIComponent(token)}`), "Facebook status");
        const state = status?.status;
        if (state?.video_status === "error" || state?.processing_phase?.status === "error") {
            throw new Error(`Facebook could not process the video: ${state?.processing_phase?.error?.message ?? "unknown reason"}`);
        }
        const done = state?.video_status === "ready" || state?.publishing_phase?.status === "complete";
        return done || request.mode === "draft" && state?.uploading_phase?.status === "complete" ? true : null;
    });
    return {externalId: videoId, externalUrl: request.mode === "draft" ? null : `https://www.facebook.com/reel/${videoId}`};
}

// ── X: v2 chunked media upload, wait for processing, then a post with it.
const X_CHUNK = 4 * 1024 * 1024;

async function publishX(connection: SocialConnection, request: PublishRequest): Promise<PublishResult> {
    if (request.mode === "draft") throw new Error("X has no drafts via the API; use Post");
    const auth = {Authorization: `Bearer ${connection.accessToken}`};
    const init = await readJson(await fetch("https://api.x.com/2/media/upload/initialize", {
        method: "POST",
        headers: {...auth, "Content-Type": "application/json"},
        body: JSON.stringify({media_type: "video/mp4", total_bytes: request.video.length, media_category: "tweet_video"})
    }), "X upload start");
    const mediaId: string = init?.data?.id;
    if (!mediaId) throw new Error("X did not return a media id");

    for (let index = 0, from = 0; from < request.video.length; index += 1, from += X_CHUNK) {
        const chunk = request.video.subarray(from, Math.min(from + X_CHUNK, request.video.length));
        const body = new FormData();
        body.append("segment_index", String(index));
        body.append("media", new Blob([chunk], {type: "video/mp4"}), "video.mp4");
        const response = await fetch(`https://api.x.com/2/media/upload/${mediaId}/append`, {method: "POST", headers: auth, body});
        if (!response.ok) await readJson(response, `X chunk ${index + 1}`);
    }

    const finalized = await readJson(await fetch(`https://api.x.com/2/media/upload/${mediaId}/finalize`, {method: "POST", headers: auth}), "X upload finish");
    let processing = finalized?.data?.processing_info;
    while (processing && processing.state !== "succeeded") {
        if (processing.state === "failed") throw new Error(`X could not process the video: ${processing.error?.message ?? "unknown reason"}`);
        await sleep(Math.max(1, Number(processing.check_after_secs) || 5) * 1000);
        const status = await readJson(await fetch(`https://api.x.com/2/media/upload?command=STATUS&media_id=${mediaId}`, {headers: auth}), "X status");
        processing = status?.data?.processing_info;
    }

    const post = await readJson(await fetch("https://api.x.com/2/tweets", {
        method: "POST",
        headers: {...auth, "Content-Type": "application/json"},
        body: JSON.stringify({text: request.caption, media: {media_ids: [mediaId]}})
    }), "X post");
    const id: string = post.data.id;
    const handle = connection.accountName?.replace(/^@/, "");
    return {externalId: id, externalUrl: handle ? `https://x.com/${handle}/status/${id}` : `https://x.com/i/web/status/${id}`};
}

export const publishers: Record<SocialPlatform, (connection: SocialConnection, request: PublishRequest) => Promise<PublishResult>> = {
    youtube: publishYouTube,
    tiktok: publishTikTok,
    instagram: publishInstagram,
    facebook: publishFacebook,
    x: publishX
};
