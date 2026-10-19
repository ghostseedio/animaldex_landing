import type {TikTokPostOptions} from "@/lib/social/types";
import type {TikTokAccountInfo} from "@/lib/social/zernio-core";

// TikTok's Content Sharing Guidelines: the poster picks the privacy level
// (from what the account allows, nothing preselected), the interaction
// settings, any commercial content disclosure, and confirms the preview and
// consent. Validated server-side too. The account's allowances come from
// Zernio's creator-info (TikTokAccountInfo).

export const TIKTOK_PRIVACY_LABELS: Record<string, string> = {
    PUBLIC_TO_EVERYONE: "Everyone",
    MUTUAL_FOLLOW_FRIENDS: "Friends",
    FOLLOWER_OF_CREATOR: "Followers",
    SELF_ONLY: "Only me"
};

/** Options with nothing chosen yet (TikTok forbids presets; AI label on because our videos are AI-made). */
export const EMPTY_TIKTOK_OPTIONS: TikTokPostOptions = {
    privacyLevel: "",
    allowComment: false,
    allowDuet: false,
    allowStitch: false,
    brandOrganic: false,
    brandContent: false,
    madeWithAi: true,
    previewConfirmed: false
};

/** The reason these options cannot be posted, or null when they can. */
export function tiktokOptionsProblem(options: Partial<TikTokPostOptions> | undefined, account: Pick<TikTokAccountInfo, "privacyLevels" | "interactions"> | null): string | null {
    if (!options?.privacyLevel) return "Choose who can view the TikTok post";
    const allowed = account?.privacyLevels.map((level) => level.value) ?? null;
    if (allowed && allowed.length && !allowed.includes(options.privacyLevel)) return "That privacy level is not available for this TikTok account";
    if (options.brandContent && options.privacyLevel === "SELF_ONLY") return "Branded content cannot be private on TikTok; choose another privacy level";
    if (account && options.allowComment && !account.interactions.allowComment) return "Comments are turned off in this TikTok account's settings";
    if (account && options.allowDuet && !account.interactions.allowDuet) return "Duets are turned off in this TikTok account's settings";
    if (account && options.allowStitch && !account.interactions.allowStitch) return "Stitches are turned off in this TikTok account's settings";
    if (!options.previewConfirmed) return "Preview the video and confirm you consent to posting it to TikTok";
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
        brandContent: raw.brandContent === true,
        madeWithAi: raw.madeWithAi === true,
        previewConfirmed: raw.previewConfirmed === true
    };
}
