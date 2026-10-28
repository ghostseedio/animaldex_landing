import "server-only";
import {
    buildTikTokPostBody,
    buildZernioPostBody,
    choosePinterestBoard,
    parseTikTokAccountInfo,
    parseZernioAccounts,
    parseZernioPost,
    type PinterestBoard,
    type PostToTikTokInput,
    type ZernioAccount,
    type ZernioPostInput,
    type TikTokAccountInfo,
    ZERNIO_BASE_URL,
    ZERNIO_ENV,
    ZernioError,
    type ZernioErrorKind,
    zernioConfigProblem,
    zernioErrorFromResponse,
    type ZernioPostSnapshot
} from "@/lib/social/zernio-core";
import {SOCIAL_PLATFORM_LABELS, type ZernioPlatform} from "@/lib/social/types";

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
export async function getZernioPost(postId: string, platform: ZernioPlatform = "tiktok"): Promise<ZernioPostSnapshot> {
    const {body} = await zernioFetch(`/posts/${encodeURIComponent(postId)}`, {timeoutMs: 30_000});
    const snapshot = parseZernioPost(body?.post ?? body, platform);
    if (!snapshot) throw new ZernioError("Zernio returned no post", {kind: "unknown", details: body});
    return snapshot;
}

/** Cancels a scheduled post that has not published yet (DELETE /v1/posts/{postId}). */
export async function deleteZernioPost(postId: string) {
    await zernioFetch(`/posts/${encodeURIComponent(postId)}`, {method: "DELETE", timeoutMs: 30_000});
}


// ── Analytics ────────────────────────────────────────────────────────────────
// Needs Zernio's Analytics add-on. Zernio covers the TikTok account only.

/** TikTok views received each UTC day (any post), from GET /v1/analytics/dashboard. */
export async function getTikTokDailyViews(fromDate: string, toDate: string): Promise<Record<string, number>> {
    const params = new URLSearchParams({platform: "tiktok", fromDate, toDate, topPosts: "0", recentPosts: "0"});
    const {body} = await zernioFetch(`/analytics/dashboard?${params}`, {timeoutMs: 30_000});
    const views: Record<string, number> = {};
    // Days before Zernio's first sync come back as zeros, not as missing.
    for (const day of body?.daily ?? []) if (typeof day?.date === "string" && Number(day.views) > 0) views[day.date] = Number(day.views);
    return views;
}

/** When each published TikTok video went live, including ones posted outside Zernio. */
export async function listTikTokPublishTimes(fromDate: string, toDate: string): Promise<string[]> {
    const times: string[] = [];
    for (let page = 1; page <= 10; page++) {
        const params = new URLSearchParams({platform: "tiktok", fromDate, toDate, limit: "100", page: String(page)});
        const {body} = await zernioFetch(`/analytics?${params}`, {timeoutMs: 30_000});
        for (const post of body?.posts ?? []) if (post?.status === "published" && typeof post.publishedAt === "string") times.push(post.publishedAt);
        if (page >= Number(body?.pagination?.pages ?? 1)) break;
    }
    return times;
}


// ── Pinterest, Threads, Bluesky, and TikTok photo carousels ─────────────────

/** The API key alone: enough for every Zernio platform but video TikTok (which also pins its account id). */
export function isZernioApiConfigured() {
    return Boolean(env(ZERNIO_ENV.apiKey));
}

const ACCOUNT_CACHE_MS = 5 * 60_000;
let accountCache: {at: number; accounts: ZernioAccount[]} | null = null;

/** The accounts connected in Zernio (cached five minutes). */
export async function listZernioAccounts(force = false): Promise<ZernioAccount[]> {
    if (!force && accountCache && Date.now() - accountCache.at < ACCOUNT_CACHE_MS) return accountCache.accounts;
    if (!isZernioApiConfigured()) throw new ZernioError(`${ZERNIO_ENV.apiKey} is not set on the server`, {kind: "config"});
    const {body} = await zernioFetch("/accounts", {timeoutMs: 30_000});
    accountCache = {at: Date.now(), accounts: parseZernioAccounts(body)};
    return accountCache.accounts;
}

/** ZERNIO_PINTEREST_ACCOUNT_ID etc. pin an account; otherwise the active one Zernio lists for the platform. */
export async function zernioAccountFor(platform: ZernioPlatform): Promise<ZernioAccount> {
    const pinned = platform === "tiktok" ? env(ZERNIO_ENV.accountId) : env(`ZERNIO_${platform.toUpperCase()}_ACCOUNT_ID`);
    const accounts = await listZernioAccounts();
    const match = pinned ? accounts.find((account) => account.id === pinned) : accounts.find((account) => account.platform === platform && account.active);
    if (match) return match;
    if (pinned) return {id: pinned, platform, username: null, active: true};
    throw new ZernioError(`No ${SOCIAL_PLATFORM_LABELS[platform]} account is connected in Zernio; connect one in the Zernio dashboard`, {kind: "not_found"});
}

// Expires like the account list, so a board made after the first pin is picked up.
const boardCache = new Map<string, {at: number; board: PinterestBoard | null}>();

/** The board pins go to: ZERNIO_PINTEREST_BOARD_ID, else choosePinterestBoard. */
export async function pinterestBoard(accountId: string, force = false): Promise<PinterestBoard | null> {
    const pinned = env("ZERNIO_PINTEREST_BOARD_ID");
    if (pinned) return {id: pinned, name: null};
    const cached = boardCache.get(accountId);
    if (!force && cached && Date.now() - cached.at < ACCOUNT_CACHE_MS) return cached.board;
    const {body} = await zernioFetch(`/accounts/${encodeURIComponent(accountId)}/pinterest-boards`, {timeoutMs: 30_000});
    const board = choosePinterestBoard(body);
    boardCache.set(accountId, {at: Date.now(), board});
    return board;
}

export async function pinterestBoardId(accountId: string) {
    return (await pinterestBoard(accountId))?.id ?? null;
}

/** Uploads any file (a slide JPEG, a video) through Zernio's presigned storage; the URL is public for 7 days. */
export async function uploadToZernio(bytes: Buffer, filename: string, contentType: string) {
    return uploadVideoToZernio(bytes, filename, contentType);
}

/**
 * Creates and publishes one post on one Zernio platform. A post the platform
 * refused inside the request (HTTP 207, status failed) rejects with a
 * ZernioError "platform"; "scheduled" after a 207 means Zernio retries itself.
 */
export async function postToZernio(input: ZernioPostInput, requestId?: string): Promise<ZernioPostSnapshot> {
    const {status, body: result} = await zernioFetch("/posts", {
        method: "POST",
        headers: requestId ? {"x-request-id": requestId} : undefined,
        body: JSON.stringify(buildZernioPostBody(input)),
        timeoutMs: 5 * 60_000
    });
    const snapshot = parseZernioPost(result?.post, input.platform);
    if (!snapshot) throw new ZernioError("Zernio did not return the created post", {kind: "unknown", status, details: result});
    if (status === 207 && (snapshot.status === "failed" || snapshot.status === "partial")) {
        const label = SOCIAL_PLATFORM_LABELS[input.platform];
        const reason = snapshot.tiktok?.errorMessage ?? (Array.isArray(result?.platformResults) ? result.platformResults[0]?.error : null) ?? result?.error ?? `${label} rejected the post`;
        const kind: ZernioErrorKind = /too many posts|capacity|limit/i.test(reason) ? "rate_limited" : "platform";
        throw new ZernioError(`${label}: ${reason}`, {kind, status, details: {postId: snapshot.postId, category: snapshot.tiktok?.errorCategory}});
    }
    return snapshot;
}

/** Every post Zernio has analytics for on one platform between two dates (YYYY-MM-DD), raw. Needs Zernio's Analytics add-on. */
export async function listZernioAnalytics(platform: ZernioPlatform, fromDate: string, toDate: string): Promise<any[]> {
    const posts: any[] = [];
    for (let page = 1; page <= 20; page++) {
        const params = new URLSearchParams({platform, fromDate, toDate, limit: "100", page: String(page)});
        const {body} = await zernioFetch(`/analytics?${params}`, {timeoutMs: 30_000});
        posts.push(...(Array.isArray(body?.posts) ? body.posts : []));
        if (page >= Number(body?.pagination?.pages ?? 1)) break;
    }
    return posts;
}
