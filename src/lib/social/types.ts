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

/** TikTok's required posting choices (Content Sharing Guidelines): nothing is preset. */
export type TikTokPostOptions = {
    privacyLevel: string;
    allowComment: boolean;
    allowDuet: boolean;
    allowStitch: boolean;
    /** Commercial content disclosure: promoting the creator's own brand. */
    brandOrganic: boolean;
    /** Commercial content disclosure: paid partnership for a third party. */
    brandContent: boolean;
};

export type SocialPostOptions = {tiktok?: TikTokPostOptions};

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
