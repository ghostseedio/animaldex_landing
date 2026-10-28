import type {OAuthPlatform} from "@/lib/social/oauth";
import type {ImagePublishRequest, PublishRequest, PublishResult, SocialConnection, TextPublishRequest} from "@/lib/social/types";

// One function per platform and kind (video, carousel, text): publish to the
// connected official account, return the post id and link.
// Long-running (uploads plus platform-side processing), so these run in the
// background job in runner.ts, never inside a request. TikTok is not here:
// runner.ts hands it to Zernio (zernio.ts).

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

const INSTAGRAM_ATTEMPTS = 2;

// ── Instagram: Reels via the Instagram Login content publishing API. Instagram
// fetches the video from a public URL when the container is created.
async function publishInstagram(connection: SocialConnection, request: PublishRequest): Promise<PublishResult> {
    if (!connection.accountId) throw new Error("Instagram account id missing; reconnect Instagram");
    // The API has no drafts (an unpublished container just expires after 24 h).
    if (request.mode === "draft") throw new Error("Instagram has no drafts via the API; use Post");
    const base = `https://graph.instagram.com/v23.0`;
    const token = connection.accessToken;
    // Instagram fetches and transcodes the file itself and sometimes answers a
    // valid Reel with a bare status "ERROR" (Oct 20 2026: a 21 s 1080x1920 H.264
    // that YouTube, TikTok, Facebook and X all took); a fresh container usually works.
    let container: {id: string} | null = null;
    for (let attempt = 1; !container; attempt += 1) {
        const created = await readJson(await fetch(`${base}/${connection.accountId}/media`, {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: new URLSearchParams({media_type: "REELS", video_url: request.videoUrl, caption: request.caption.slice(0, 2200), share_to_feed: "true", access_token: token}).toString()
        }), "Instagram container");
        const finished = await poll("Instagram processing", async () => {
            const status = await readJson(await fetch(`${base}/${created.id}?fields=status_code,status&access_token=${encodeURIComponent(token)}`), "Instagram status");
            if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
                if (attempt < INSTAGRAM_ATTEMPTS) return false;
                throw new Error(`Instagram could not process the video: ${status.status ?? status.status_code} (after ${attempt} attempts)`);
            }
            return status.status_code === "FINISHED" ? true : null;
        });
        if (finished) container = created;
        else await sleep(30_000);
    }
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

/** Uploads one file through X's v2 chunked media upload and waits for processing; returns its media id. */
async function uploadXMedia(auth: Record<string, string>, bytes: Buffer, mediaType: string, category: "tweet_video" | "tweet_image") {
    const init = await readJson(await fetch("https://api.x.com/2/media/upload/initialize", {
        method: "POST",
        headers: {...auth, "Content-Type": "application/json"},
        body: JSON.stringify({media_type: mediaType, total_bytes: bytes.length, media_category: category})
    }), "X upload start");
    const mediaId: string = init?.data?.id;
    if (!mediaId) throw new Error("X did not return a media id");

    for (let index = 0, from = 0; from < bytes.length; index += 1, from += X_CHUNK) {
        const chunk = bytes.subarray(from, Math.min(from + X_CHUNK, bytes.length));
        const body = new FormData();
        body.append("segment_index", String(index));
        body.append("media", new Blob([chunk], {type: mediaType}), category === "tweet_video" ? "video.mp4" : "image.jpg");
        const response = await fetch(`https://api.x.com/2/media/upload/${mediaId}/append`, {method: "POST", headers: auth, body});
        if (!response.ok) await readJson(response, `X chunk ${index + 1}`);
    }

    const finalized = await readJson(await fetch(`https://api.x.com/2/media/upload/${mediaId}/finalize`, {method: "POST", headers: auth}), "X upload finish");
    let processing = finalized?.data?.processing_info;
    while (processing && processing.state !== "succeeded") {
        if (processing.state === "failed") throw new Error(`X could not process the media: ${processing.error?.message ?? "unknown reason"}`);
        await sleep(Math.max(1, Number(processing.check_after_secs) || 5) * 1000);
        const status = await readJson(await fetch(`https://api.x.com/2/media/upload?command=STATUS&media_id=${mediaId}`, {headers: auth}), "X status");
        processing = status?.data?.processing_info;
    }
    return mediaId;
}

async function postTweet(connection: SocialConnection, body: Record<string, unknown>): Promise<PublishResult> {
    const post = await readJson(await fetch("https://api.x.com/2/tweets", {
        method: "POST",
        headers: {Authorization: `Bearer ${connection.accessToken}`, "Content-Type": "application/json"},
        body: JSON.stringify(body)
    }), "X post");
    const id: string = post.data.id;
    const handle = connection.accountName?.replace(/^@/, "");
    return {externalId: id, externalUrl: handle ? `https://x.com/${handle}/status/${id}` : `https://x.com/i/web/status/${id}`};
}

async function publishX(connection: SocialConnection, request: PublishRequest): Promise<PublishResult> {
    if (request.mode === "draft") throw new Error("X has no drafts via the API; use Post");
    const mediaId = await uploadXMedia({Authorization: `Bearer ${connection.accessToken}`}, request.video, "video/mp4", "tweet_video");
    return postTweet(connection, {text: request.caption, media: {media_ids: [mediaId]}});
}

/** Up to four slides (X's limit) with the text. */
async function publishXImages(connection: SocialConnection, request: ImagePublishRequest): Promise<PublishResult> {
    const auth = {Authorization: `Bearer ${connection.accessToken}`};
    const mediaIds: string[] = [];
    for (const image of request.images.slice(0, 4)) mediaIds.push(await uploadXMedia(auth, image.bytes, "image/jpeg", "tweet_image"));
    return postTweet(connection, {text: request.caption, media: {media_ids: mediaIds}});
}

/** Text, or a poll: X polls cannot carry media and run 5 minutes to 7 days. */
async function publishXText(connection: SocialConnection, request: TextPublishRequest): Promise<PublishResult> {
    const poll = request.poll && request.poll.options.length >= 2
        ? {options: request.poll.options.slice(0, 4).map((option) => option.slice(0, 25)), duration_minutes: Math.min(Math.max(request.poll.minutes, 5), 10080)}
        : null;
    return postTweet(connection, poll ? {text: request.text, poll} : {text: request.text});
}

// ── Instagram: a carousel of up to 10 slides (or one image). Instagram fetches
// each JPEG from its public URL; children first, then the carousel container.
async function publishInstagramImages(connection: SocialConnection, request: ImagePublishRequest): Promise<PublishResult> {
    if (!connection.accountId) throw new Error("Instagram account id missing; reconnect Instagram");
    const base = "https://graph.instagram.com/v23.0";
    const token = connection.accessToken;
    const create = async (params: Record<string, string>) => readJson(await fetch(`${base}/${connection.accountId}/media`, {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({...params, access_token: token}).toString()
    }), "Instagram container");
    const ready = (id: string) => poll("Instagram processing", async () => {
        const status = await readJson(await fetch(`${base}/${id}?fields=status_code,status&access_token=${encodeURIComponent(token)}`), "Instagram status");
        if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new Error(`Instagram could not process the image: ${status.status ?? status.status_code}`);
        return status.status_code === "FINISHED" ? true : null;
    }, 3_000, 5 * 60_000);
    const images = request.images.slice(0, 10);
    let containerId: string;
    if (images.length === 1) {
        containerId = (await create({image_url: images[0].url, caption: request.caption.slice(0, 2200)})).id;
    } else {
        const children: string[] = [];
        for (const image of images) children.push((await create({image_url: image.url, is_carousel_item: "true"})).id);
        for (const child of children) await ready(child);
        containerId = (await create({media_type: "CAROUSEL", children: children.join(","), caption: request.caption.slice(0, 2200)})).id;
    }
    await ready(containerId);
    const published = await readJson(await fetch(`${base}/${connection.accountId}/media_publish`, {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({creation_id: containerId, access_token: token}).toString()
    }), "Instagram publish");
    const media = await readJson(await fetch(`${base}/${published.id}?fields=permalink&access_token=${encodeURIComponent(token)}`), "Instagram permalink").catch(() => null);
    return {externalId: published.id, externalUrl: media?.permalink ?? null};
}

// ── Facebook: the slides as unpublished photos, then one Page post that attaches them.
async function publishFacebookImages(connection: SocialConnection, request: ImagePublishRequest): Promise<PublishResult> {
    if (!connection.accountId) throw new Error("Facebook Page id missing; reconnect Facebook");
    const base = "https://graph.facebook.com/v23.0";
    const token = connection.accessToken;
    const photoIds: string[] = [];
    for (const image of request.images.slice(0, 10)) {
        const photo = await readJson(await fetch(`${base}/${connection.accountId}/photos`, {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: new URLSearchParams({url: image.url, published: "false", ...(image.alt ? {alt_text_custom: image.alt.slice(0, 1000)} : {}), access_token: token}).toString()
        }), "Facebook photo upload");
        photoIds.push(photo.id);
    }
    const body = new URLSearchParams({message: request.caption.slice(0, 5000), access_token: token});
    photoIds.forEach((id, index) => body.append(`attached_media[${index}]`, JSON.stringify({media_fbid: id})));
    const post = await readJson(await fetch(`${base}/${connection.accountId}/feed`, {method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: body.toString()}), "Facebook post");
    return {externalId: post.id, externalUrl: `https://www.facebook.com/${post.id}`};
}

/** A text Page post; with a link Facebook shows the page's preview card under it. */
async function publishFacebookText(connection: SocialConnection, request: TextPublishRequest): Promise<PublishResult> {
    if (!connection.accountId) throw new Error("Facebook Page id missing; reconnect Facebook");
    const text = request.link ? request.text.replace(request.link, "").trim() : request.text;
    const post = await readJson(await fetch(`https://graph.facebook.com/v23.0/${connection.accountId}/feed`, {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({message: text.slice(0, 5000), ...(request.link ? {link: request.link} : {}), access_token: connection.accessToken}).toString()
    }), "Facebook post");
    return {externalId: post.id, externalUrl: `https://www.facebook.com/${post.id}`};
}

export const publishers: Record<OAuthPlatform, (connection: SocialConnection, request: PublishRequest) => Promise<PublishResult>> = {
    youtube: publishYouTube,
    instagram: publishInstagram,
    facebook: publishFacebook,
    x: publishX
};

/** Carousels: YouTube has no image posts in its API. */
export const imagePublishers: Partial<Record<OAuthPlatform, (connection: SocialConnection, request: ImagePublishRequest) => Promise<PublishResult>>> = {
    instagram: publishInstagramImages,
    facebook: publishFacebookImages,
    x: publishXImages
};

/** Text posts: Instagram and YouTube have none in their APIs. */
export const textPublishers: Partial<Record<OAuthPlatform, (connection: SocialConnection, request: TextPublishRequest) => Promise<PublishResult>>> = {
    facebook: publishFacebookText,
    x: publishXText
};
