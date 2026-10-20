import {X_POST_LIMIT, xLength} from "@/lib/social/captions";
import {COPY_LIMITS, type ShareCopy} from "@/lib/social/share-copy";
import type {TikTokAccountInfo} from "@/lib/social/zernio-core";
import type {SocialPlatform, SocialPostRow, TikTokPostOptions} from "@/lib/social/types";

// The scheduled auto-share (src/lib/social/auto-share.ts) decides here, purely,
// which video goes out next and to which platforms. One video per run, oldest
// first; a platform is retried after a failure, but only up to
// MAX_AUTO_ATTEMPTS, and then left to the admin page.

/**
 * A queued/processing row older than this is assumed dead (server restarted
 * mid-upload). Rows that already have a Zernio post id are never stale: the
 * post lives in Zernio and is reconciled from there.
 */
export const STALE_MS = 30 * 60_000;

/** Failed shares of one video to one platform after which auto-share gives up on it. */
export const MAX_AUTO_ATTEMPTS = 2;

export function isStale(post: SocialPostRow, now: number) {
    if (post.status !== "queued" && post.status !== "processing") return false;
    if (post.platform === "tiktok" && post.options?.zernio?.postId) return false;
    return now - Date.parse(post.updated_at) > STALE_MS;
}

/** An upload this server is still working on (a Zernio-held TikTok post is not: it waits in Zernio). */
export function isUploading(post: SocialPostRow, now: number) {
    if (post.status !== "queued" && post.status !== "processing") return false;
    return !post.options?.zernio?.postId && !isStale(post, now);
}

/** Platforms this video still needs: no live or published share (in any mode) and attempts left. */
export function duePlatforms(mediaPath: string, posts: SocialPostRow[], platforms: readonly SocialPlatform[], now: number) {
    const shares = posts.filter((post) => post.media_path === mediaPath);
    return platforms.filter((platform) => {
        const mine = shares.filter((post) => post.platform === platform);
        if (mine.some((post) => post.status === "published" || ((post.status === "queued" || post.status === "processing") && !isStale(post, now)))) return false;
        return mine.filter((post) => post.mode === "post" && post.status === "failed").length < MAX_AUTO_ATTEMPTS;
    });
}

export type AutoShareCandidate = {mediaPath: string; createdAt: string};

/** The oldest video with at least one platform still due, and those platforms. */
export function pickNextAutoShare<T extends AutoShareCandidate>(candidates: T[], posts: SocialPostRow[], platforms: readonly SocialPlatform[], now: number) {
    const ordered = [...candidates].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const video of ordered) {
        const due = duePlatforms(video.mediaPath, posts, platforms, now);
        if (due.length) return {video, platforms: due};
    }
    return null;
}

/**
 * The fixed TikTok choices for unattended posts: everyone can view, every
 * interaction the account allows is on, AI-generated label on, no commercial
 * disclosure, and the operator's standing consent to post.
 */
export function autoTikTokOptions(account: Pick<TikTokAccountInfo, "privacyLevels" | "interactions">): TikTokPostOptions | null {
    if (account.privacyLevels.length && !account.privacyLevels.some((level) => level.value === "PUBLIC_TO_EVERYONE")) return null;
    return {
        privacyLevel: "PUBLIC_TO_EVERYONE",
        allowComment: account.interactions.allowComment,
        allowDuet: account.interactions.allowDuet,
        allowStitch: account.interactions.allowStitch,
        brandOrganic: false,
        brandContent: false,
        madeWithAi: true,
        previewConfirmed: true
    };
}

export type AutoShareTarget = {platform: SocialPlatform; caption: string};

/** Each platform's caption from the drafted copy, as the share dialog sends it; a platform whose copy is over its limit is left out. */
export function autoShareTargets(copy: ShareCopy, platforms: readonly SocialPlatform[]) {
    const targets: AutoShareTarget[] = [];
    const tooLong: SocialPlatform[] = [];
    for (const platform of platforms) {
        const caption = platform === "youtube" ? copy.youtube.description
            : platform === "x" ? copy.x.text
                : copy[platform].caption;
        const fits = platform === "x" ? xLength(caption) <= X_POST_LIMIT
            : platform === "youtube" ? copy.youtube.title.length <= COPY_LIMITS.youtubeTitle && caption.length <= COPY_LIMITS.youtubeDescription
                : caption.length <= COPY_LIMITS.caption;
        if (fits && caption.trim()) targets.push({platform, caption});
        else tooLong.push(platform);
    }
    return {targets, tooLong};
}
