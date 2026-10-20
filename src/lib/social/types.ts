export const SOCIAL_PLATFORMS = ["youtube", "tiktok", "instagram", "facebook", "x"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
    youtube: "YouTube Shorts",
    tiktok: "TikTok",
    instagram: "Instagram Reels",
    facebook: "Facebook Reels",
    x: "X"
};

export function isSocialPlatform(value: unknown): value is SocialPlatform {
    return typeof value === "string" && (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

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

/** `auto`: queued by the scheduled auto-share rather than from the admin page. */
export type SocialPostOptions = {tiktok?: TikTokPostOptions; zernio?: ZernioShareInfo; auto?: boolean};

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
