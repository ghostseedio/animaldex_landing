import "server-only";
import {
    buildTikTokPostBody,
    parseTikTokAccountInfo,
    parseZernioPost,
    type PostToTikTokInput,
    type TikTokAccountInfo,
    ZERNIO_BASE_URL,
    ZERNIO_ENV,
    ZernioError,
    type ZernioErrorKind,
    zernioConfigProblem,
    zernioErrorFromResponse,
    type ZernioPostSnapshot
} from "@/lib/social/zernio-core";

// Server-only half of the Zernio client: every call that sends the API key.
// Shapes, error mapping, webhook verification and schedule rules are in
// zernio-core.ts and re-exported here so callers import one module.

export * from "@/lib/social/zernio-core";

function env(name: string) {
    return process.env[name]?.trim() || "";
}

function requireConfig() {
    const problem = zernioConfigProblem();
    if (problem) throw new ZernioError(problem, {kind: "config"});
    return {apiKey: env(ZERNIO_ENV.apiKey), accountId: env(ZERNIO_ENV.accountId)};
}


async function zernioFetch(path: string, init: RequestInit & {timeoutMs?: number} = {}) {
    const {apiKey} = requireConfig();
    const {timeoutMs = 60_000, ...rest} = init;
    let response: Response;
    try {
        response = await fetch(`${ZERNIO_BASE_URL}${path}`, {
            ...rest,
            headers: {Authorization: `Bearer ${apiKey}`, Accept: "application/json", ...(rest.body ? {"Content-Type": "application/json"} : {}), ...(rest.headers as Record<string, string> | undefined)},
            cache: "no-store",
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch (error) {
        throw new ZernioError(`Could not reach Zernio: ${error instanceof Error ? error.message : String(error)}`, {kind: "unavailable"});
    }
    const text = await response.text();
    let body: any = null;
    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        body = null;
    }
    if (!response.ok) throw zernioErrorFromResponse(response.status, body ?? {error: text.slice(0, 300)}, response);
    return {status: response.status, body};
}

// ── Account ──────────────────────────────────────────────────────────────────

/** The TikTok account Zernio posts as, with the privacy levels and toggles it allows right now. */
export async function getTikTokAccount(): Promise<TikTokAccountInfo> {
    const {accountId} = requireConfig();
    const {body} = await zernioFetch(`/accounts/${encodeURIComponent(accountId)}/tiktok/creator-info?mediaType=video`, {timeoutMs: 30_000});
    return parseTikTokAccountInfo(body, accountId);
}

// ── Media ────────────────────────────────────────────────────────────────────

/** Uploads a video through Zernio's presigned storage; the returned URL is public for 7 days. */
export async function uploadVideoToZernio(video: Buffer, filename: string, contentType = "video/mp4"): Promise<{publicUrl: string; key: string}> {
    const {body} = await zernioFetch("/media/presign", {method: "POST", body: JSON.stringify({filename, contentType, size: video.length}), timeoutMs: 30_000});
    const uploadUrl: string | undefined = body?.uploadUrl;
    const publicUrl: string | undefined = body?.publicUrl;
    if (!uploadUrl || !publicUrl) throw new ZernioError("Zernio did not return an upload URL", {kind: "unknown", details: body});
    let put: Response;
    try {
        // No Authorization header: the URL itself is the credential.
        put = await fetch(uploadUrl, {method: "PUT", headers: {"Content-Type": contentType, "Content-Length": String(video.length)}, body: new Uint8Array(video), signal: AbortSignal.timeout(10 * 60_000)});
    } catch (error) {
        throw new ZernioError(`Uploading the video to Zernio failed: ${error instanceof Error ? error.message : String(error)}`, {kind: "unavailable"});
    }
    if (!put.ok) throw new ZernioError(`Uploading the video to Zernio failed (${put.status})`, {kind: put.status >= 500 ? "unavailable" : "invalid_video", status: put.status});
    return {publicUrl, key: typeof body?.key === "string" ? body.key : publicUrl};
}

// ── Posts ────────────────────────────────────────────────────────────────────

/**
 * Creates the TikTok post in Zernio: published at once (`publishNow`) or at
 * `scheduledFor`. Resolves with the post's state; a post TikTok refused in the
 * same request (HTTP 207, status failed) rejects with a ZernioError "platform".
 */
export async function postToTikTok(input: PostToTikTokInput): Promise<ZernioPostSnapshot> {
    const {accountId} = requireConfig();
    if (!input.options.previewConfirmed) throw new ZernioError("Preview the video and confirm you consent to posting it to TikTok first", {kind: "invalid_request"});
    const body = buildTikTokPostBody(input, accountId);
    const {status, body: result} = await zernioFetch("/posts", {
        method: "POST",
        headers: input.requestId ? {"x-request-id": input.requestId} : undefined,
        body: JSON.stringify(body),
        // publishNow uploads to TikTok inside the request.
        timeoutMs: 5 * 60_000
    });
    const snapshot = parseZernioPost(result?.post);
    if (!snapshot) throw new ZernioError("Zernio did not return the created post", {kind: "unknown", status, details: result});
    if (status === 207) {
        // Created, but the inline publish did not fully succeed. "scheduled" means a
        // transient error Zernio retries by itself; failed/partial is final.
        if (snapshot.status === "failed" || snapshot.status === "partial") {
            const reason = snapshot.tiktok?.errorMessage ?? (Array.isArray(result?.platformResults) ? result.platformResults[0]?.error : null) ?? result?.error ?? "TikTok rejected the post";
            const kind: ZernioErrorKind = /too many posts|capacity|limit/i.test(reason) ? "rate_limited" : "platform";
            throw new ZernioError(`TikTok: ${reason}`, {kind, status, details: {postId: snapshot.postId, category: snapshot.tiktok?.errorCategory}});
        }
    }
    return snapshot;
}

/** Current state of a Zernio post (GET /v1/posts/{postId}). */
export async function getZernioPost(postId: string): Promise<ZernioPostSnapshot> {
    const {body} = await zernioFetch(`/posts/${encodeURIComponent(postId)}`, {timeoutMs: 30_000});
    const snapshot = parseZernioPost(body?.post ?? body);
    if (!snapshot) throw new ZernioError("Zernio returned no post", {kind: "unknown", details: body});
    return snapshot;
}

/** Cancels a scheduled post that has not published yet (DELETE /v1/posts/{postId}). */
export async function deleteZernioPost(postId: string) {
    await zernioFetch(`/posts/${encodeURIComponent(postId)}`, {method: "DELETE", timeoutMs: 30_000});
}

