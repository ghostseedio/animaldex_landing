export const SOCIAL_PLATFORMS = ["youtube", "tiktok", "instagram", "facebook", "x", "pinterest", "threads", "bluesky"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
    youtube: "YouTube Shorts",
    tiktok: "TikTok",
    instagram: "Instagram Reels",
    facebook: "Facebook Reels",
    x: "X",
    pinterest: "Pinterest",
    threads: "Threads",
    bluesky: "Bluesky"
};

export function isSocialPlatform(value: unknown): value is SocialPlatform {
    return typeof value === "string" && (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

/** Posted through Zernio, which holds the account connection: no OAuth row of ours. */
export const ZERNIO_PLATFORMS = ["tiktok", "pinterest", "threads", "bluesky"] as const;
export type ZernioPlatform = (typeof ZERNIO_PLATFORMS)[number];

export function isZernioPlatform(value: unknown): value is ZernioPlatform {
    return typeof value === "string" && (ZERNIO_PLATFORMS as readonly string[]).includes(value);
}

/** What the per-video share dialog offers. Pinterest, Threads and Bluesky are auto-share only. */
export const MANUAL_SHARE_PLATFORMS = ["youtube", "tiktok", "instagram", "facebook", "x"] as const;
export type ManualSharePlatform = (typeof MANUAL_SHARE_PLATFORMS)[number];

/** Decrypted connection, server-side only. */
export type SocialConnection = {
    platform: SocialPlatform;
    accountId: string | null;
    accountName: string | null;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
    scopes: string | null;
};

/** What the admin UI is allowed to see about a connection. */
export type SocialConnectionSummary = {
    platform: SocialPlatform;
    configured: boolean;
    connected: boolean;
    accountName: string | null;
    expiresAt: string | null;
};

export type SocialPostStatus = "queued" | "processing" | "published" | "failed";
export type SocialPostMode = "post" | "draft";

/**
 * TikTok's required posting choices (Content Sharing Guidelines): nothing is
 * preset, the poster picks each one in the share dialog. Sent to Zernio as
 * tiktokSettings (src/lib/social/zernio-core.ts).
 */
export type TikTokPostOptions = {
    /** One of the creator's allowed values: PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, FOLLOWER_OF_CREATOR, SELF_ONLY. */
    privacyLevel: string;
    allowComment: boolean;
    allowDuet: boolean;
    allowStitch: boolean;
    /** Commercial content disclosure: promoting the creator's own brand ("Promotional content" label). */
    brandOrganic: boolean;
    /** Commercial content disclosure: paid partnership for a third party ("Paid partnership" label; cannot be SELF_ONLY). */
    brandContent: boolean;
    /** AI-generated content label (our story videos are AI-made, so the dialog defaults this on). */
    madeWithAi: boolean;
    /** The poster previewed the video and consents to it being posted (TikTok's legal requirement; must be true). */
    previewConfirmed: boolean;
};

/** Bookkeeping for a share that went through Zernio (TikTok). */
export type ZernioShareInfo = {
    /** Zernio post id (also kept in external_id). */
    postId: string;
    /** Absolute ISO time the post publishes at, or null for "post now". */
    scheduledFor: string | null;
    /** IANA zone the admin scheduled in, for display. */
    timezone: string | null;
    /** TikTok's own video id once published. */
    platformPostId?: string | null;
    /** When Zernio reported the post published (ISO); drives the URL back-fill window. */
    publishedAt?: string | null;
    /** Last time the row was reconciled with Zernio (ISO). */
    syncedAt?: string | null;
};

/**
 * `auto`: queued by the scheduled auto-share rather than from the admin page.
 * `content`: the carousel or text post (admin_social_content.id) a row shares.
 * `link`: the page the post points at (Pinterest's destination, Facebook's link card).
 */
export type SocialPostOptions = {tiktok?: TikTokPostOptions; zernio?: ZernioShareInfo; auto?: boolean; content?: string; link?: string | null};

export type SocialPostRow = {
    id: string;
    platform: SocialPlatform;
    media_path: string;
    media_kind: string;
    species_profile_id: string | null;
    species_name: string | null;
    page_slug: string | null;
    capture_id: string | null;
    caption: string;
    title: string | null;
    mode: SocialPostMode;
    status: SocialPostStatus;
    external_id: string | null;
    external_url: string | null;
    error: string | null;
    options: SocialPostOptions | null;
    created_at: string;
    updated_at: string;
};

/** Everything a platform needs to publish one video. */
export type PublishRequest = {
    video: Buffer;
    /** A URL the platform can download the same file from (Instagram pulls rather than accepts bytes). */
    videoUrl: string;
    caption: string;
    title: string;
    mode: SocialPostMode;
    options: SocialPostOptions | null;
};

export type PublishResult = {
    externalId: string;
    externalUrl: string | null;
};

/** One slide of a carousel: a public JPEG the platform can fetch, and the same bytes for platforms that take uploads. */
export type PublishImage = {url: string; bytes: Buffer; alt: string};

/** A carousel (or a single image) with its caption. */
export type ImagePublishRequest = {images: PublishImage[]; caption: string; title: string; link: string | null};

/** A text-only post, optionally a poll (X only; elsewhere the question is posted as text). */
export type TextPublishRequest = {text: string; poll: {options: string[]; minutes: number} | null; link: string | null};
