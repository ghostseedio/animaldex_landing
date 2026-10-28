import {createHmac, timingSafeEqual} from "crypto";
import {SOCIAL_PLATFORM_LABELS, type SocialPostStatus, type TikTokPostOptions, type ZernioPlatform} from "@/lib/social/types";

// Pure half of the Zernio client: request/response shapes, error mapping, webhook
// signatures and schedule rules. No fetch and no API key here, so tests can import
// it; the calls that send the key live in zernio.ts (server-only).
//
// Zernio (https://docs.zernio.com) posts to the official AnimalDex TikTok
// account on our behalf: it holds the TikTok OAuth connection, so this app
// keeps no TikTok app credentials or tokens any more. Server-only: the API key
// never reaches the browser.
//
//   base URL   https://zernio.com/api/v1
//   auth       Authorization: Bearer <ZERNIO_API_KEY>   (sk_ + 64 hex)
//   create     POST /v1/posts  {content, mediaItems:[{type:"video",url}], platforms:[{platform:"tiktok",accountId}],
//                               tiktokSettings:{…}, publishNow | scheduledFor (+ timezone)}
//              201 created/scheduled; 207 created but the inline publish failed (post.status failed/partial)
//              or hit a transient error (post.status scheduled: Zernio retries, not a failure).
//   media      every mediaItems[].url must be public HTTPS returning the bytes; or PUT the file to
//              POST /v1/media/presign's uploadUrl and use its publicUrl (kept 7 days).
//   status     GET /v1/posts/{postId}: draft | scheduled | publishing | published | partial | failed | cancelled,
//              platforms[].status / platformPostUrl / errorMessage.
//   webhooks   X-Zernio-Signature = hex HMAC-SHA256(raw body, secret); events post.scheduled,
//              post.platform.published, post.platform.failed, post.published, post.partial, post.failed, post.cancelled.
//   errors     {error, type?, code?, param?, details?}; 429 carries Retry-After; 409 = duplicate content.

export const ZERNIO_BASE_URL = "https://zernio.com/api/v1";
export const ZERNIO_ENV = {apiKey: "ZERNIO_API_KEY", accountId: "ZERNIO_TIKTOK_ACCOUNT_ID", webhookSecret: "ZERNIO_WEBHOOK_SECRET"} as const;

/** TikTok caption limit for video posts (Zernio/TikTok). */
export const TIKTOK_CAPTION_LIMIT = 2200;
/** Zernio copies the uploaded video to permanent storage when the post is created, so
 * the cap is a product choice (keeps the share log short-horizon), not a storage limit. */
export const MAX_SCHEDULE_DAYS = 30;
/** Zernio rejects times that already passed as "publish now"; keep a small margin. */
export const MIN_SCHEDULE_LEAD_MS = 2 * 60_000;

export type ZernioErrorKind =
    | "config"          // env vars missing
    | "auth"            // 401: bad key
    | "payment"         // 402: Zernio plan / card
    | "permission"      // 403: feature / account disconnected
    | "not_found"       // 404
    | "invalid_request" // 400/422: our body was wrong
    | "invalid_video"   // 400 about the media item / video
    | "duplicate"       // 409: same content already scheduled or posted in 24 h
    | "rate_limited"    // 429 (Zernio or TikTok's daily cap)
    | "platform"        // TikTok rejected the post
    | "unavailable"     // 5xx / network / timeout: retry later
    | "unknown";

export class ZernioError extends Error {
    kind: ZernioErrorKind;
    status: number | null;
    code: string | null;
    retryAfterSeconds: number | null;
    existingPostId: string | null;
    details: unknown;

    constructor(message: string, init: {kind: ZernioErrorKind; status?: number | null; code?: string | null; retryAfterSeconds?: number | null; existingPostId?: string | null; details?: unknown}) {
        super(message);
        this.name = "ZernioError";
        this.kind = init.kind;
        this.status = init.status ?? null;
        this.code = init.code ?? null;
        this.retryAfterSeconds = init.retryAfterSeconds ?? null;
        this.existingPostId = init.existingPostId ?? null;
        this.details = init.details;
    }

    /** Whether the same request may succeed later without changes. */
    get retryable() {
        return this.kind === "rate_limited" || this.kind === "unavailable";
    }
}

function env(name: string) {
    return process.env[name]?.trim() || "";
}

/** Null when TikTok posting through Zernio is set up, otherwise what is missing. */
export function zernioConfigProblem(): string | null {
    const missing = [!env(ZERNIO_ENV.apiKey) && ZERNIO_ENV.apiKey, !env(ZERNIO_ENV.accountId) && ZERNIO_ENV.accountId].filter(Boolean);
    return missing.length ? `${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} not set on the server` : null;
}

export function isZernioConfigured() {
    return zernioConfigProblem() === null;
}

export function getZernioTikTokAccountId() {
    return env(ZERNIO_ENV.accountId);
}

function parseRetryAfter(response: Response, body: any): number | null {
    const header = Number(response.headers.get("retry-after"));
    if (Number.isFinite(header) && header > 0) return Math.ceil(header);
    const detail = Number(body?.details?.retryAfterSeconds);
    return Number.isFinite(detail) && detail > 0 ? Math.ceil(detail) : null;
}

const VIDEO_WORDS = /media|video|mediaItems|duration|file|format|codec|resolution|aspect/i;

/** Turns a non-2xx Zernio response into a ZernioError the admin UI can explain. */
export function zernioErrorFromResponse(status: number, body: any, response?: Response): ZernioError {
    const message: string = typeof body?.error === "string" && body.error ? body.error : `Zernio request failed (${status})`;
    const code: string | null = typeof body?.code === "string" ? body.code : null;
    const param: string | null = typeof body?.param === "string" ? body.param : null;
    const base = {status, code, details: body?.details};
    if (status === 401) return new ZernioError(`Zernio rejected the API key: ${message}`, {...base, kind: "auth"});
    if (status === 402) return new ZernioError(`Zernio needs a plan or payment method: ${message}`, {...base, kind: "payment"});
    if (status === 403) return new ZernioError(code === "ACCOUNT_DISCONNECTED" ? `The TikTok account is disconnected in Zernio; reconnect it in the Zernio dashboard (${message})` : message, {...base, kind: "permission"});
    if (status === 404) return new ZernioError(code === "account_not_found" ? `Zernio has no TikTok account with id ${env(ZERNIO_ENV.accountId) || "(unset)"}; check ZERNIO_TIKTOK_ACCOUNT_ID` : message, {...base, kind: "not_found"});
    if (status === 409) return new ZernioError(message, {...base, kind: "duplicate", existingPostId: typeof body?.details?.existingPostId === "string" ? body.details.existingPostId : null});
    if (status === 429) return new ZernioError(message, {...base, kind: "rate_limited", retryAfterSeconds: response ? parseRetryAfter(response, body) : Number(body?.details?.retryAfterSeconds) || null});
    if (status === 400 || status === 422) {
        const aboutVideo = VIDEO_WORDS.test(param ?? "") || VIDEO_WORDS.test(message);
        return new ZernioError(aboutVideo ? `Zernio could not accept the video: ${message}` : message, {...base, kind: aboutVideo ? "invalid_video" : "invalid_request"});
    }
    if (status === 502) return new ZernioError(`TikTok did not answer Zernio: ${message}`, {...base, kind: "unavailable"});
    if (status >= 500) return new ZernioError(message, {...base, kind: "unavailable", retryAfterSeconds: response ? parseRetryAfter(response, body) : null});
    return new ZernioError(message, {...base, kind: "unknown"});
}



export type TikTokAccountInfo = {
    accountId: string;
    nickname: string | null;
    avatarUrl: string | null;
    /** TikTok says the account may publish more posts right now (daily API cap not reached). */
    canPostMore: boolean;
    /** Privacy levels this creator allows, in TikTok's own values. */
    privacyLevels: Array<{value: string; label: string}>;
    maxVideoDurationSec: number | null;
    /** Per toggle: whether the creator allows it at all (false = turned off in the TikTok app). */
    interactions: {allowComment: boolean; allowDuet: boolean; allowStitch: boolean};
    /** Disclosure choices the account can make: "none", "brand_organic", "brand_content". */
    commercialContentTypes: Array<{value: string; label: string}>;
};

/** Reads Zernio's creator-info response (GET /v1/accounts/{id}/tiktok/creator-info) defensively. */
export function parseTikTokAccountInfo(body: any, accountId: string): TikTokAccountInfo {
    const creator = body?.creator ?? {};
    const limits = body?.postingLimits ?? {};
    const toggles = limits?.interactionSettings ?? {};
    const enabled = (toggle: any) => toggle == null ? true : toggle.enabled !== false;
    const options = (list: unknown) => Array.isArray(list)
        ? list.filter((item: any) => item && typeof item.value === "string").map((item: any) => ({value: item.value as string, label: typeof item.label === "string" ? item.label : item.value as string}))
        : [];
    const maxDuration = Number(limits?.maxVideoDurationSec);
    return {
        accountId,
        nickname: typeof creator.nickname === "string" ? creator.nickname : null,
        avatarUrl: typeof creator.avatarUrl === "string" ? creator.avatarUrl : null,
        canPostMore: creator.canPostMore !== false,
        privacyLevels: options(body?.privacyLevels),
        maxVideoDurationSec: Number.isFinite(maxDuration) && maxDuration > 0 ? maxDuration : null,
        interactions: {allowComment: enabled(toggles.allow_comment), allowDuet: enabled(toggles.allow_duet), allowStitch: enabled(toggles.allow_stitch)},
        commercialContentTypes: options(body?.commercialContentTypes)
    };
}



export type ZernioPostStatus = "draft" | "scheduled" | "publishing" | "published" | "partial" | "failed" | "cancelled";

/** What we keep of a Zernio post: its id, where it is, and the TikTok target's outcome. */
export type ZernioPostSnapshot = {
    postId: string;
    status: ZernioPostStatus;
    scheduledFor: string | null;
    publishedAt: string | null;
    tiktok: {
        status: string;
        platformPostId: string | null;
        platformPostUrl: string | null;
        errorMessage: string | null;
        errorCategory: string | null;
    } | null;
};

/**
 * Reads a post object (from POST/GET /v1/posts or a webhook's `post`) defensively.
 * Every post we create targets one platform; `tiktok` holds that target's
 * outcome (the field kept its name from when TikTok was the only one).
 */
export function parseZernioPost(post: any, platform: ZernioPlatform = "tiktok"): ZernioPostSnapshot | null {
    const postId = typeof post?._id === "string" ? post._id : typeof post?.id === "string" ? post.id : null;
    if (!postId) return null;
    const platforms: any[] = Array.isArray(post?.platforms) ? post.platforms : [];
    const entry = platforms.find((item) => item?.platform === platform) ?? platforms[0] ?? null;
    const str = (value: unknown) => typeof value === "string" && value ? value : null;
    return {
        postId,
        status: (typeof post?.status === "string" ? post.status : "scheduled") as ZernioPostStatus,
        scheduledFor: str(post?.scheduledFor),
        publishedAt: str(post?.publishedAt),
        tiktok: entry ? {
            status: typeof entry.status === "string" ? entry.status : "pending",
            platformPostId: str(entry.platformPostId),
            platformPostUrl: str(entry.platformPostUrl) ?? str(entry.publishedUrl),
            errorMessage: str(entry.errorMessage) ?? str(entry.error),
            errorCategory: str(entry.errorCategory)
        } : null
    };
}

/** The share-log row fields a Zernio post state maps to. */
export function rowStateFromZernio(snapshot: ZernioPostSnapshot, platform: ZernioPlatform = "tiktok"): {status: SocialPostStatus; external_url: string | null; error: string | null} {
    const target = snapshot.tiktok;
    const label = SOCIAL_PLATFORM_LABELS[platform];
    if (snapshot.status === "published" || target?.status === "published") {
        return {status: "published", external_url: target?.platformPostUrl ?? null, error: null};
    }
    if (snapshot.status === "failed" || snapshot.status === "partial" || snapshot.status === "cancelled" || target?.status === "failed") {
        const reason = target?.errorMessage ?? (snapshot.status === "cancelled" ? "Cancelled in Zernio" : `${label} rejected the post`);
        return {status: "failed", external_url: null, error: `${label}: ${reason}`.slice(0, 1000)};
    }
    if (snapshot.status === "publishing") return {status: "processing", external_url: null, error: null};
    // draft / scheduled / pending: waiting for its time.
    return {status: "queued", external_url: null, error: null};
}

export type PostToTikTokInput = {
    /** Public HTTPS URL that returns the MP4 bytes (a Zernio presigned publicUrl works). */
    videoUrl: string;
    caption: string;
    /** ISO 8601 with offset or Z. Omitted: publish now. */
    scheduledFor?: string | null;
    /** IANA zone shown on the post in Zernio (the time itself is absolute). */
    timezone?: string | null;
    options: TikTokPostOptions;
    /** Zernio's TikTok Creator Inbox upload instead of a direct post. */
    draft?: boolean;
    /** Free-form bookkeeping stored on the Zernio post. */
    metadata?: Record<string, string | number | boolean | null>;
    /** Sent as x-request-id so a retried request returns the original post instead of a duplicate. */
    requestId?: string;
};

/** The body POST /v1/posts gets for one TikTok video. Exported for tests. */
export function buildTikTokPostBody(input: PostToTikTokInput, accountId: string) {
    const {options} = input;
    const commercialContentType = options.brandContent ? "brand_content" : options.brandOrganic ? "brand_organic" : "none";
    const tiktokSettings: Record<string, unknown> = {
        privacyLevel: options.privacyLevel,
        allowComment: options.allowComment,
        allowDuet: options.allowDuet,
        allowStitch: options.allowStitch,
        commercialContentType,
        // Both disclosures at once need the explicit flags on top of the type.
        ...(options.brandContent && options.brandOrganic ? {isBrandOrganicPost: true, brandPartnerPromote: true} : {}),
        videoMadeWithAi: options.madeWithAi,
        // TikTok's legal requirements, confirmed by the poster in the share dialog.
        contentPreviewConfirmed: options.previewConfirmed,
        expressConsentGiven: options.previewConfirmed,
        ...(input.draft ? {draft: true} : {})
    };
    const scheduled = Boolean(input.scheduledFor);
    return {
        content: input.caption.slice(0, TIKTOK_CAPTION_LIMIT),
        mediaItems: [{type: "video", url: input.videoUrl}],
        platforms: [{platform: "tiktok", accountId}],
        tiktokSettings,
        ...(scheduled ? {scheduledFor: input.scheduledFor, ...(input.timezone ? {timezone: input.timezone} : {})} : {publishNow: true}),
        ...(input.metadata ? {metadata: input.metadata} : {})
    };
}



// ── Any platform: Pinterest, Threads, Bluesky, and TikTok photo carousels ──────

export type ZernioMediaItem = {type: "image" | "video"; url: string};

export type ZernioPostInput = {
    platform: ZernioPlatform;
    accountId: string;
    /** The post text: caption, Threads/Bluesky text, Pinterest description, TikTok photo title. */
    content: string;
    media: ZernioMediaItem[];
    /** Pinterest: board, title and destination link. */
    pinterest?: {boardId: string | null; title: string | null; link: string | null};
    /** TikTok photo carousel: the long caption and the toggles (TikTok's required consent included). */
    tiktokPhoto?: {description: string; options: TikTokPostOptions};
    metadata?: Record<string, string | number | boolean | null>;
};

/** TikTok photo titles are capped at 90 characters (hashtags are stripped from them). */
export const TIKTOK_PHOTO_TITLE_LIMIT = 90;
export const TIKTOK_PHOTO_DESCRIPTION_LIMIT = 4000;

/** The body POST /v1/posts gets for one post on one non-video-TikTok target. Exported for tests. */
export function buildZernioPostBody(input: ZernioPostInput) {
    const platformSpecificData: Record<string, unknown> = {};
    if (input.platform === "pinterest" && input.pinterest) {
        if (input.pinterest.boardId) platformSpecificData.boardId = input.pinterest.boardId;
        if (input.pinterest.title) platformSpecificData.title = Array.from(input.pinterest.title).slice(0, 100).join("");
        if (input.pinterest.link) platformSpecificData.link = input.pinterest.link;
    }
    const photo = input.platform === "tiktok" && input.tiktokPhoto ? input.tiktokPhoto : null;
    const content = photo
        ? Array.from(input.content.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\s+/g, " ").trim()).slice(0, TIKTOK_PHOTO_TITLE_LIMIT).join("")
        : input.content;
    return {
        content,
        mediaItems: input.media.map((item) => ({type: item.type, url: item.url})),
        platforms: [{platform: input.platform, accountId: input.accountId, ...(Object.keys(platformSpecificData).length ? {platformSpecificData} : {})}],
        ...(photo ? {
            tiktokSettings: {
                privacyLevel: photo.options.privacyLevel,
                allowComment: photo.options.allowComment,
                commercialContentType: "none",
                contentPreviewConfirmed: photo.options.previewConfirmed,
                expressConsentGiven: photo.options.previewConfirmed,
                mediaType: "photo",
                photoCoverIndex: 0,
                autoAddMusic: true,
                description: photo.description.slice(0, TIKTOK_PHOTO_DESCRIPTION_LIMIT)
            }
        } : {}),
        publishNow: true,
        ...(input.metadata ? {metadata: input.metadata} : {})
    };
}

export type ZernioAccount = {id: string; platform: string; username: string | null; active: boolean};

/** GET /v1/accounts, read defensively: the accounts connected in Zernio. */
export function parseZernioAccounts(body: any): ZernioAccount[] {
    const list: any[] = Array.isArray(body?.accounts) ? body.accounts : Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    return list.flatMap((account) => {
        const id = typeof account?._id === "string" ? account._id : typeof account?.id === "string" ? account.id : null;
        const platform = typeof account?.platform === "string" ? account.platform.toLowerCase() : null;
        if (!id || !platform) return [];
        const username = typeof account.username === "string" ? account.username : typeof account.displayName === "string" ? account.displayName : null;
        const active = account.isActive !== false && account.enabled !== false && account.needsReconnection !== true;
        return [{id, platform, username, active}];
    });
}

/** True when `signature` is the hex HMAC-SHA256 of `rawBody` under `secret`. */
export function verifyZernioWebhookSignature(rawBody: string, signature: string | null, secret: string) {
    if (!signature || !secret) return false;
    const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const given = signature.trim().toLowerCase();
    if (given.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(given, "utf8"), Buffer.from(expected, "utf8"));
}

export type ZernioWebhookEvent = {id: string | null; event: string; post: ZernioPostSnapshot | null; timestamp: string | null};

/** The parts of a Zernio webhook delivery the share log cares about; null when it is not a post event. */
export function parseZernioWebhookEvent(body: any): ZernioWebhookEvent | null {
    if (!body || typeof body.event !== "string") return null;
    return {
        id: typeof body.id === "string" ? body.id : null,
        event: body.event,
        post: body.event.startsWith("post.") ? parseZernioPost(body.post) : null,
        timestamp: typeof body.timestamp === "string" ? body.timestamp : null
    };
}

// ── Scheduling ───────────────────────────────────────────────────────────────

/** Null when `value` is a usable schedule time, otherwise why not. Exported for tests. */
export function scheduleProblem(value: string | null | undefined, now = Date.now()): string | null {
    if (!value) return null;
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return "The schedule time is not a valid date";
    if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(value.trim())) return "The schedule time needs a timezone offset";
    if (time < now + MIN_SCHEDULE_LEAD_MS) return "Schedule at least a few minutes ahead, or post now";
    if (time > now + MAX_SCHEDULE_DAYS * 86_400_000) return `Schedule within the next ${MAX_SCHEDULE_DAYS} days`;
    return null;
}

/** A readable reason for the admin UI, with the next step when there is one. */
export function describeZernioError(error: unknown): string {
    if (!(error instanceof ZernioError)) return error instanceof Error ? error.message : String(error);
    switch (error.kind) {
        case "config": return `TikTok posting is not set up: ${error.message}`;
        case "rate_limited": return `${error.message}${error.retryAfterSeconds ? ` Try again in ${error.retryAfterSeconds >= 120 ? `${Math.ceil(error.retryAfterSeconds / 60)} min` : `${error.retryAfterSeconds} s`}.` : ""}`;
        case "duplicate": return `${error.message}${error.existingPostId ? ` (Zernio post ${error.existingPostId})` : ""} Change the caption or the video to post it again.`;
        case "unavailable": return `${error.message} Retry in a few minutes.`;
        default: return error.message;
    }
}
