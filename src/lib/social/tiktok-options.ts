import type {TikTokPostOptions} from "@/lib/social/types";

// TikTok's Content Sharing Guidelines: the poster picks the privacy level
// (from what creator_info allows, nothing preselected), the interaction
// settings, and any commercial content disclosure. Validated server-side too.

export type TikTokCreatorInfo = {
    nickname: string | null;
    avatarUrl: string | null;
    privacyLevelOptions: string[];
    commentDisabled: boolean;
    duetDisabled: boolean;
    stitchDisabled: boolean;
    maxVideoPostDurationSec: number | null;
};

export const TIKTOK_PRIVACY_LABELS: Record<string, string> = {
    PUBLIC_TO_EVERYONE: "Everyone",
    MUTUAL_FOLLOW_FRIENDS: "Friends",
    FOLLOWER_OF_CREATOR: "Followers",
    SELF_ONLY: "Only me"
};

export function parseTikTokCreatorInfo(data: any): TikTokCreatorInfo {
    return {
        nickname: data?.creator_nickname ?? data?.creator_username ?? null,
        avatarUrl: data?.creator_avatar_url ?? null,
        privacyLevelOptions: Array.isArray(data?.privacy_level_options) ? data.privacy_level_options.filter((option: unknown) => typeof option === "string") : [],
        commentDisabled: Boolean(data?.comment_disabled),
        duetDisabled: Boolean(data?.duet_disabled),
        stitchDisabled: Boolean(data?.stitch_disabled),
        maxVideoPostDurationSec: Number.isFinite(Number(data?.max_video_post_duration_sec)) ? Number(data.max_video_post_duration_sec) : null
    };
}

/** The reason these options cannot be posted, or null when they can. */
export function tiktokOptionsProblem(options: Partial<TikTokPostOptions> | undefined, allowedPrivacy: string[] | null): string | null {
    if (!options?.privacyLevel) return "Choose who can view the TikTok post";
    if (allowedPrivacy && !allowedPrivacy.includes(options.privacyLevel)) return "That privacy level is not available for this TikTok account";
    if (options.brandContent && options.privacyLevel === "SELF_ONLY") return "Branded content cannot be private on TikTok; choose another privacy level";
    return null;
}

/** Coerces a request body into options (booleans default off, as TikTok requires). */
export function readTikTokOptions(value: unknown): TikTokPostOptions | undefined {
    if (!value || typeof value !== "object") return undefined;
    const raw = value as Record<string, unknown>;
    return {
        privacyLevel: typeof raw.privacyLevel === "string" ? raw.privacyLevel : "",
        allowComment: raw.allowComment === true,
        allowDuet: raw.allowDuet === true,
        allowStitch: raw.allowStitch === true,
        brandOrganic: raw.brandOrganic === true,
        brandContent: raw.brandContent === true
    };
}
