import {blogShareCopy} from "@/lib/content-video/share";
import {CONTENT_VIDEO_MEDIA_KIND, listContentVideos} from "@/lib/content-video/store";
import {autoShareTargets, autoTikTokOptions, isStale, isUploading, pickNextAutoShare} from "@/lib/social/auto-share-plan";
import {checkOAuthConnection} from "@/lib/social/connection-health";
import {isOAuthPlatform, isProviderConfigured} from "@/lib/social/oauth";
import {runShareJob} from "@/lib/social/runner";
import {buildSpeciesShareContext, generateShareCopy} from "@/lib/social/share-copy-server";
import {insertPost, listConnectionRows, listPosts, updatePost} from "@/lib/social/store";
import {type AdminStoryVideo, listAdminStoryVideos} from "@/lib/social/story-videos";
import {SOCIAL_PLATFORMS, type SocialPlatform, type SocialPostRow, type TikTokPostOptions} from "@/lib/social/types";
import {describeZernioError, getTikTokAccount, isZernioConfigured} from "@/lib/social/zernio";

// Unattended sharing, run by the VM timer (POST /api/cron/social-auto-share):
// each run shares the oldest video that some connected platform has not had
// yet, to every such platform, with the same copy and runner as the admin
// page. One video per run paces the feeds and keeps one upload job (and its
// ffmpeg normalise) on the e2-small at a time.

type Candidate = {
    mediaPath: string;
    createdAt: string;
    kind: string;
    speciesProfileId: string | null;
    speciesName: string;
    pageSlug: string;
    captureId: string | null;
    durationSeconds: number | null;
    /** A blog video (admin_content_videos.id), else an app story video. */
    contentVideoId: string | null;
    story: AdminStoryVideo | null;
};

export type AutoShareResult =
    | {ok: true; shared: false; reason: string; skipped?: Record<string, string>}
    | {ok: true; shared: true; dryRun: boolean; video: {mediaPath: string; name: string; kind: string}; queued: SocialPlatform[]; skipped: Record<string, string>; copySource: string};

async function candidates(): Promise<Candidate[]> {
    const [stories, blogs] = await Promise.all([listAdminStoryVideos(), listContentVideos(200)]);
    return [
        ...stories.map((video) => ({
            mediaPath: video.mediaPath,
            createdAt: video.createdAt,
            kind: video.kind,
            speciesProfileId: video.speciesProfileId,
            speciesName: video.speciesName,
            pageSlug: video.pageSlug,
            captureId: video.captureId,
            durationSeconds: video.durationSeconds,
            contentVideoId: null,
            story: video
        })),
        // Only blog videos the admin has put on their page: that is the approval.
        ...blogs.filter((row) => row.status === "ready" && row.video_path && row.published_at).map((row) => ({
            mediaPath: row.video_path!,
            createdAt: row.published_at!,
            kind: CONTENT_VIDEO_MEDIA_KIND,
            speciesProfileId: null,
            speciesName: row.source_title,
            pageSlug: row.source_slug,
            captureId: null,
            durationSeconds: row.duration_seconds,
            contentVideoId: row.id,
            story: null
        }))
    ];
}

/** Platforms that can take a post right now; the rest with the reason. */
async function readyPlatforms() {
    const skipped: Record<string, string> = {};
    const rows = await listConnectionRows();
    const tiktok: {current: {options: TikTokPostOptions; maxSeconds: number | null} | null} = {current: null};
    const ready = await Promise.all(SOCIAL_PLATFORMS.map(async (platform): Promise<SocialPlatform | null> => {
        try {
            if (isOAuthPlatform(platform)) {
                if (!isProviderConfigured(platform) || !rows.some((row) => row.platform === platform)) return null;
                await checkOAuthConnection(platform);
                return platform;
            }
            if (!isZernioConfigured()) return null;
            const account = await getTikTokAccount();
            if (!account.canPostMore) throw new Error("TikTok's daily posting limit is reached");
            const options = autoTikTokOptions(account);
            if (!options) throw new Error("This TikTok account cannot post publicly");
            tiktok.current = {options, maxSeconds: account.maxVideoDurationSec};
            return platform;
        } catch (error) {
            skipped[platform] = platform === "tiktok" ? describeZernioError(error) : error instanceof Error ? error.message : String(error);
            return null;
        }
    }));
    return {platforms: ready.filter((platform): platform is SocialPlatform => platform !== null), skipped, tiktok: tiktok.current};
}

async function draftCopy(video: Candidate) {
    if (video.contentVideoId) return blogShareCopy(video.contentVideoId, false);
    const context = await buildSpeciesShareContext(video.pageSlug, video.speciesName, video.story);
    return generateShareCopy(context);
}

/** One run: shares the next due video, or says why nothing went out. `dryRun` stops before queuing. */
export async function runAutoShare({dryRun = false} = {}): Promise<AutoShareResult> {
    if (process.env.SOCIAL_AUTO_SHARE_DISABLED?.trim() === "1") return {ok: true, shared: false, reason: "SOCIAL_AUTO_SHARE_DISABLED=1"};

    const now = Date.now();
    const posts = await listPosts(1000);
    const uploading = posts.find((post) => isUploading(post, now));
    if (uploading) return {ok: true, shared: false, reason: `An upload is still running (${uploading.platform}, ${uploading.media_path})`};

    const {platforms, skipped, tiktok} = await readyPlatforms();
    if (!platforms.length) return {ok: true, shared: false, reason: "No connected platform can post right now", skipped};

    const next = pickNextAutoShare(await candidates(), posts, platforms, now);
    if (!next) return {ok: true, shared: false, reason: "Every video is already shared to every ready platform", skipped};
    const {video} = next;
    let due = next.platforms;
    if (due.includes("tiktok") && tiktok?.maxSeconds && video.durationSeconds && video.durationSeconds > tiktok.maxSeconds) {
        skipped.tiktok = `Video is ${Math.round(video.durationSeconds)}s, over TikTok's ${tiktok.maxSeconds}s`;
        due = due.filter((platform) => platform !== "tiktok");
    }

    const drafted = await draftCopy(video);
    // A story video's template copy is a fallback for a person to edit, not to post unseen: try again next run.
    if (drafted.source !== "claude" && !video.contentVideoId) {
        return {ok: true, shared: false, reason: `Claude could not draft the copy for ${video.speciesName}; retrying next run (${drafted.error ?? "template only"})`, skipped};
    }
    const {targets, tooLong} = autoShareTargets(drafted.copy, due);
    for (const platform of tooLong) skipped[platform] = "Drafted copy is over the platform's limit";
    if (!targets.length) return {ok: true, shared: false, reason: `No platform left for ${video.speciesName}`, skipped};

    const summary = {mediaPath: video.mediaPath, name: video.speciesName, kind: video.kind};
    if (dryRun) return {ok: true, shared: true, dryRun, video: summary, queued: targets.map((target) => target.platform), skipped, copySource: drafted.source};

    await Promise.all(posts
        .filter((post) => post.media_path === video.mediaPath && isStale(post, now))
        .map((post) => updatePost(post.id, {status: "failed", error: "Interrupted (server restarted during upload)"})));

    const queued: SocialPostRow[] = [];
    for (const target of targets) {
        const row = await insertPost({
            platform: target.platform,
            media_path: video.mediaPath,
            media_kind: video.kind,
            species_profile_id: video.speciesProfileId,
            species_name: video.speciesName,
            page_slug: video.pageSlug,
            capture_id: video.captureId,
            caption: target.caption.slice(0, 5000),
            title: drafted.copy.youtube.title.slice(0, 100),
            mode: "post",
            options: target.platform === "tiktok" && tiktok
                ? {auto: true, tiktok: tiktok.options, zernio: {postId: "", scheduledFor: null, timezone: null}}
                : {auto: true}
        });
        if (row) queued.push(row);
        else skipped[target.platform] = "Already shared";
    }

    if (!queued.length) return {ok: true, shared: false, reason: `Nothing queued for ${video.speciesName}`, skipped};
    // Not awaited, as on the admin page: uploads take minutes. The next run waits for it (isUploading).
    void runShareJob(queued).catch((error) => console.error("[social-auto-share]", error));
    console.info(`[social-auto-share] ${video.speciesName} (${video.mediaPath}) → ${queued.map((row) => row.platform).join(", ")}`);
    return {ok: true, shared: true, dryRun, video: summary, queued: queued.map((row) => row.platform), skipped, copySource: drafted.source};
}
