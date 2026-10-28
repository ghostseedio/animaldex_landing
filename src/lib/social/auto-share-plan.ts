import {captionFits, captionForPlatform} from "@/lib/social/platform-copy";
import type {ShareCopy} from "@/lib/social/share-copy";
import type {TikTokAccountInfo} from "@/lib/social/zernio-core";
import {isZernioPlatform, SOCIAL_PLATFORMS, type SocialPlatform, type SocialPostRow, type TikTokPostOptions} from "@/lib/social/types";

// The scheduled auto-share (src/lib/social/auto-share.ts) decides here, purely,
// what goes out next and to which platforms. Each run shares at most one video
// and one carousel or text post; a platform is retried after a failure, but
// only up to MAX_AUTO_ATTEMPTS, and then left to the admin page. Daily caps per
// platform and kind keep each feed from being flooded (DEFAULT_DAILY_CAPS).

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
    if (isZernioPlatform(post.platform) && post.options?.zernio?.postId) return false;
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

/** The oldest (or newest) item with at least one platform still due, and those platforms. */
export function pickNextAutoShare<T extends AutoShareCandidate>(candidates: T[], posts: SocialPostRow[], platforms: readonly SocialPlatform[], now: number, order: "oldest" | "newest" = "oldest") {
    const ordered = [...candidates].sort((a, b) => order === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
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

export type AutoShareTarget = {platform: SocialPlatform; caption: string; title: string | null};

/** Each platform's caption from the drafted copy, as the share dialog sends it; a platform whose copy is over its limit is left out. */
export function autoShareTargets(copy: ShareCopy, platforms: readonly SocialPlatform[], pageUrl: string | null = null) {
    const targets: AutoShareTarget[] = [];
    const tooLong: SocialPlatform[] = [];
    for (const platform of platforms) {
        const caption = captionForPlatform(copy, platform, pageUrl);
        if (captionFits(platform, caption)) targets.push({platform, caption: caption.caption, title: caption.title});
        else tooLong.push(platform);
    }
    return {targets, tooLong};
}

// ── Daily mix ────────────────────────────────────────────────────────────────

export const SHARE_CONTENT_KINDS = ["video", "carousel", "text"] as const;
export type ShareContentKind = (typeof SHARE_CONTENT_KINDS)[number];

/** media_kind of a share-log row that posts a carousel / a text post (admin_social_content). */
export const CAROUSEL_MEDIA_KIND = "carousel";
export const TEXT_MEDIA_KIND = "text_post";

/**
 * Posts per platform per day (Jakarta day), by kind. Videos are held to a few a
 * day while the hook lab learns: a feed of weak videos drags the account down.
 * 0 = never (YouTube and Pinterest take no text; YouTube no carousels via the API).
 * Override with SOCIAL_DAILY_CAPS='{"tiktok":{"video":3}}'.
 */
export const DEFAULT_DAILY_CAPS: Record<SocialPlatform, Record<ShareContentKind, number>> = {
    youtube: {video: 6, carousel: 0, text: 0},
    tiktok: {video: 4, carousel: 2, text: 0},
    instagram: {video: 4, carousel: 2, text: 0},
    facebook: {video: 4, carousel: 1, text: 2},
    x: {video: 4, carousel: 1, text: 3},
    pinterest: {video: 2, carousel: 3, text: 0},
    threads: {video: 3, carousel: 1, text: 3},
    bluesky: {video: 2, carousel: 1, text: 3}
};

/** The caps with an override (JSON) merged over the defaults; a malformed override is ignored. */
export function dailyCaps(override: string | undefined | null = null): Record<SocialPlatform, Record<ShareContentKind, number>> {
    const caps = Object.fromEntries(SOCIAL_PLATFORMS.map((platform) => [platform, {...DEFAULT_DAILY_CAPS[platform]}])) as Record<SocialPlatform, Record<ShareContentKind, number>>;
    if (!override?.trim()) return caps;
    try {
        const parsed = JSON.parse(override) as Record<string, Record<string, unknown>>;
        for (const platform of SOCIAL_PLATFORMS) {
            for (const kind of SHARE_CONTENT_KINDS) {
                const value = Number(parsed?.[platform]?.[kind]);
                if (Number.isFinite(value) && value >= 0) caps[platform][kind] = Math.floor(value);
            }
        }
    } catch {
        // Keep the defaults.
    }
    return caps;
}

export function contentKindOf(row: Pick<SocialPostRow, "media_kind">): ShareContentKind {
    if (row.media_kind === CAROUSEL_MEDIA_KIND) return "carousel";
    if (row.media_kind === TEXT_MEDIA_KIND) return "text";
    return "video";
}

/** Jakarta (UTC+7) is where the team reads the numbers: a "day" starts at its midnight. */
export function dayStartMs(now: number, offsetHours = 7) {
    const shifted = now + offsetHours * 3_600_000;
    return shifted - (shifted % 86_400_000) - offsetHours * 3_600_000;
}

/** Posts (not drafts) of `kind` that went out, or are going out, to `platform` today. Failures do not count. */
export function postedToday(posts: SocialPostRow[], platform: SocialPlatform, kind: ShareContentKind, now: number) {
    const start = dayStartMs(now);
    return posts.filter((post) => post.platform === platform && post.mode === "post" && post.status !== "failed"
        && contentKindOf(post) === kind && Date.parse(post.created_at) >= start).length;
}

/** The platforms among `platforms` that still have room for one more `kind` today. */
export function platformsWithRoom(platforms: readonly SocialPlatform[], kind: ShareContentKind, posts: SocialPostRow[], caps: Record<SocialPlatform, Record<ShareContentKind, number>>, now: number) {
    return platforms.filter((platform) => postedToday(posts, platform, kind, now) < caps[platform][kind]);
}

/**
 * Which light kind (carousel or text) this run shares: the one with the most
 * room left today across ready platforms, carousels first on a tie. Null when
 * neither has room anywhere.
 */
export function pickLightKind(platforms: readonly SocialPlatform[], posts: SocialPostRow[], caps: Record<SocialPlatform, Record<ShareContentKind, number>>, now: number): "carousel" | "text" | null {
    const room = (kind: "carousel" | "text") => platforms.reduce((sum, platform) => sum + Math.max(caps[platform][kind] - postedToday(posts, platform, kind, now), 0), 0);
    const carousel = room("carousel");
    const text = room("text");
    if (!carousel && !text) return null;
    return carousel >= text ? "carousel" : "text";
}
