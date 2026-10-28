import {recordAutomationRun} from "@/lib/automation-runs";
import {contentVideoBusy} from "@/lib/content-video/runner";
import {blogShareCopy} from "@/lib/content-video/share";
import {sourcePath} from "@/lib/content-video/source-paths";
import {CONTENT_VIDEO_MEDIA_KIND, listContentVideos} from "@/lib/content-video/store";
import {getAbsoluteUrl} from "@/lib/site";
import {maybeSyncPostMetrics} from "@/lib/social-lab/metrics";
import {listSocialContent} from "@/lib/social-content/store";
import {contentMediaPath, type SocialContentRow} from "@/lib/social-content/types";
import {
    autoShareTargets,
    autoTikTokOptions,
    CAROUSEL_MEDIA_KIND,
    dailyCaps,
    isStale,
    isUploading,
    pickLightKind,
    pickNextAutoShare,
    platformsWithRoom,
    TEXT_MEDIA_KIND
} from "@/lib/social/auto-share-plan";
import {checkOAuthConnection} from "@/lib/social/connection-health";
import {isOAuthPlatform, isProviderConfigured} from "@/lib/social/oauth";
import {runContentShareJob, runShareJob} from "@/lib/social/runner";
import type {ShareCopy} from "@/lib/social/share-copy";
import {buildSpeciesShareContext, generateShareCopy} from "@/lib/social/share-copy-server";
import {insertPost, listConnectionRows, listPosts, updatePost} from "@/lib/social/store";
import {type AdminStoryVideo, listAdminStoryVideos} from "@/lib/social/story-videos";
import {isZernioPlatform, SOCIAL_PLATFORMS, type SocialPlatform, type SocialPostRow, type TikTokPostOptions} from "@/lib/social/types";
import {describeZernioError, getTikTokAccount, isZernioApiConfigured, isZernioConfigured, zernioAccountFor} from "@/lib/social/zernio";
import {reconcileZernioRows} from "@/lib/social/zernio-sync";

// Unattended sharing, run by the VM timer (POST /api/cron/social-auto-share).
// Each run shares at most one video (the newest some ready platform has not
// had) and one carousel or text post, within each platform's daily caps
// (auto-share-plan.ts), with the same copy and runner as the admin page. One
// video per run keeps one upload job (and its ffmpeg normalise) on the
// e2-small at a time. Every run also refreshes the per-post numbers the hook
// lab learns from, at most every six hours.

/** Longest video each platform takes through our share path (Facebook Reels API, X without Premium, Bluesky). */
const MAX_VIDEO_SECONDS: Partial<Record<SocialPlatform, number>> = {facebook: 90, x: 140, bluesky: 60, threads: 300};

type Candidate = {
    mediaPath: string;
    createdAt: string;
    kind: string;
    speciesProfileId: string | null;
    speciesName: string;
    pageSlug: string;
    pageUrl: string;
    captureId: string | null;
    durationSeconds: number | null;
    /** A blog video (admin_content_videos.id), else an app story video. */
    contentVideoId: string | null;
    story: AdminStoryVideo | null;
};

export type LightShareResult =
    | {kind: "carousel" | "text"; id: string; title: string; queued: SocialPlatform[]; skipped: Record<string, string>}
    | {kind: null; reason: string};

export type AutoShareResult =
    | {ok: true; shared: false; reason: string; skipped?: Record<string, string>; light?: LightShareResult}
    | {ok: true; shared: true; dryRun: boolean; video: {mediaPath: string; name: string; kind: string}; queued: SocialPlatform[]; skipped: Record<string, string>; copySource: string; light?: LightShareResult};

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
            pageUrl: getAbsoluteUrl("en", `/animals/${video.pageSlug}`),
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
            pageUrl: getAbsoluteUrl("en", sourcePath(row.source_type, row.source_slug)),
            captureId: null,
            durationSeconds: row.duration_seconds,
            contentVideoId: row.id,
            story: null
        }))
    ];
}

type Ready = {platforms: SocialPlatform[]; skipped: Record<string, string>; tiktok: {options: TikTokPostOptions; maxSeconds: number | null} | null};

/** Platforms that can take a post right now; the rest with the reason. */
async function readyPlatforms(): Promise<Ready> {
    const skipped: Record<string, string> = {};
    const rows = await listConnectionRows();
    const tiktok: {current: Ready["tiktok"]} = {current: null};
    const ready = await Promise.all(SOCIAL_PLATFORMS.map(async (platform): Promise<SocialPlatform | null> => {
        try {
            if (isOAuthPlatform(platform)) {
                if (!isProviderConfigured(platform) || !rows.some((row) => row.platform === platform)) return null;
                await checkOAuthConnection(platform);
                return platform;
            }
            if (platform === "tiktok") {
                if (!isZernioConfigured()) return null;
                const account = await getTikTokAccount();
                if (!account.canPostMore) throw new Error("TikTok's daily posting limit is reached");
                const options = autoTikTokOptions(account);
                if (!options) throw new Error("This TikTok account cannot post publicly");
                tiktok.current = {options, maxSeconds: account.maxVideoDurationSec};
                return platform;
            }
            // Pinterest, Threads, Bluesky: ready once an account is connected in Zernio.
            if (!isZernioApiConfigured()) return null;
            await zernioAccountFor(platform);
            return platform;
        } catch (error) {
            const message = isZernioPlatform(platform) ? describeZernioError(error) : error instanceof Error ? error.message : String(error);
            // A platform simply not connected in Zernio yet is not worth a line in every run's log.
            if (!/No (Pinterest|Threads|Bluesky) account is connected/.test(message)) skipped[platform] = message;
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

/** True while this server is still uploading a share (the auto-generate timer waits for it too). */
export async function isSocialUploadRunning() {
    const now = Date.now();
    return (await listPosts(200)).some((post) => isUploading(post, now));
}

/** What the next run would share, without health checks or copy drafting: for the admin panel. */
export async function previewAutoShare() {
    const rows = await listConnectionRows();
    const accounts = isZernioApiConfigured() ? await Promise.all((["pinterest", "threads", "bluesky"] as const).map((platform) => zernioAccountFor(platform).then(() => platform).catch(() => null))) : [];
    const connected = SOCIAL_PLATFORMS.filter((platform) => isOAuthPlatform(platform)
        ? isProviderConfigured(platform) && rows.some((row) => row.platform === platform)
        : platform === "tiktok" ? isZernioConfigured() : accounts.includes(platform));
    const [posts, videos] = await Promise.all([listPosts(1000), candidates()]);
    const now = Date.now();
    const caps = dailyCaps(process.env.SOCIAL_DAILY_CAPS);
    const videoRoom = platformsWithRoom(connected, "video", posts, caps, now);
    const due = videos.filter((video) => pickNextAutoShare([video], posts, videoRoom, now));
    const next = pickNextAutoShare(videos, posts, videoRoom, now, "newest");
    return {
        connected,
        queueLength: due.length,
        next: next ? {mediaPath: next.video.mediaPath, name: next.video.speciesName, kind: next.video.kind, platforms: next.platforms} : null
    };
}

function lightSummary(light: LightShareResult | undefined) {
    if (!light) return "";
    return light.kind ? ` · ${light.kind} “${light.title}” → ${light.queued.join(", ") || "nothing"}` : ` · ${light.reason}`;
}

/** One timer run, logged to admin_automation_runs (dry runs are not logged). */
export async function runAutoShare({dryRun = false} = {}): Promise<AutoShareResult> {
    if (!dryRun) await maybeSyncPostMetrics().catch((error) => console.error("[social-metrics-sync]", error));
    try {
        const result = await shareNext(dryRun);
        if (!dryRun) {
            const lightQueued = result.light?.kind ? result.light.queued.length > 0 : false;
            await recordAutomationRun(result.shared
                ? {job: "social-auto-share", outcome: "acted", summary: `${result.video.name} → ${result.queued.join(", ")}${lightSummary(result.light)}`, ref: result.video.mediaPath, detail: {kind: result.video.kind, queued: result.queued, skipped: result.skipped, copySource: result.copySource, light: result.light ?? null}}
                : {job: "social-auto-share", outcome: lightQueued ? "acted" : "skipped", summary: `${result.reason}${lightSummary(result.light)}`, detail: {skipped: result.skipped ?? null, light: result.light ?? null}});
        }
        return result;
    } catch (error) {
        if (!dryRun) await recordAutomationRun({job: "social-auto-share", outcome: "failed", summary: error instanceof Error ? error.message : String(error)});
        throw error;
    }
}

/** Shares the next due video and the next carousel or text post, or says why not. `dryRun` stops before queuing. */
async function shareNext(dryRun: boolean): Promise<AutoShareResult> {
    if (process.env.SOCIAL_AUTO_SHARE_DISABLED?.trim() === "1") return {ok: true, shared: false, reason: "SOCIAL_AUTO_SHARE_DISABLED=1"};
    // Both encode with ffmpeg on two vCPUs: let a page video finish first.
    if (contentVideoBusy()) return {ok: true, shared: false, reason: "A page video is being made"};

    const now = Date.now();
    // Brings waiting Zernio rows up to date, as opening the share log does.
    const posts = await reconcileZernioRows(await listPosts(1000)).catch(() => listPosts(1000));
    const uploading = posts.find((post) => isUploading(post, now));
    if (uploading) return {ok: true, shared: false, reason: `An upload is still running (${uploading.platform}, ${uploading.media_path})`};

    const ready = await readyPlatforms();
    if (!ready.platforms.length) return {ok: true, shared: false, reason: "No connected platform can post right now", skipped: ready.skipped};
    const caps = dailyCaps(process.env.SOCIAL_DAILY_CAPS);

    const video = await shareVideo(dryRun, posts, ready, caps, now);
    const light = await shareLight(dryRun, posts, ready, caps, now).catch((error): LightShareResult => ({kind: null, reason: `Carousel/text share failed: ${error instanceof Error ? error.message : String(error)}`}));
    return {...video, light};
}

async function shareVideo(dryRun: boolean, posts: SocialPostRow[], ready: Ready, caps: ReturnType<typeof dailyCaps>, now: number): Promise<AutoShareResult> {
    const skipped: Record<string, string> = {...ready.skipped};
    const withRoom = platformsWithRoom(ready.platforms, "video", posts, caps, now);
    for (const platform of ready.platforms) if (!withRoom.includes(platform)) skipped[platform] = "Today's video cap is reached";
    if (!withRoom.length) return {ok: true, shared: false, reason: "Every ready platform has had today's videos", skipped};

    // Newest first: fresh videos carry the hook lab's current arms, so they teach it fastest.
    const next = pickNextAutoShare(await candidates(), posts, withRoom, now, "newest");
    if (!next) return {ok: true, shared: false, reason: "Every video is already shared to every ready platform", skipped};
    const {video} = next;
    let due = next.platforms;
    const tooLong = (platform: SocialPlatform) => {
        const max = platform === "tiktok" ? ready.tiktok?.maxSeconds : MAX_VIDEO_SECONDS[platform];
        return Boolean(max && video.durationSeconds && video.durationSeconds > max);
    };
    for (const platform of due.filter(tooLong)) skipped[platform] = `Video is ${Math.round(video.durationSeconds ?? 0)}s, over the platform's limit`;
    due = due.filter((platform) => !tooLong(platform));

    const drafted = await draftCopy(video);
    // A story video's template copy is a fallback for a person to edit, not to post unseen: try again next run.
    if (drafted.source !== "claude" && !video.contentVideoId) {
        return {ok: true, shared: false, reason: `Claude could not draft the copy for ${video.speciesName}; retrying next run (${drafted.error ?? "template only"})`, skipped};
    }
    const {targets, tooLong: overLimit} = autoShareTargets(drafted.copy, due, video.pageUrl);
    for (const platform of overLimit) skipped[platform] = "Drafted copy is over the platform's limit";
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
            title: (target.title ?? drafted.copy.youtube.title).slice(0, 100),
            mode: "post",
            options: zernioRowOptions(target.platform, ready, video.pageUrl)
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

/** Row options: auto, the page link, and for Zernio platforms the bookkeeping that marks the row as Zernio-held. */
function zernioRowOptions(platform: SocialPlatform, ready: Ready, link: string, content?: string): SocialPostRow["options"] {
    const base = {auto: true, link, ...(content ? {content} : {})};
    if (platform === "tiktok" && ready.tiktok) return {...base, tiktok: ready.tiktok.options, zernio: {postId: "", scheduledFor: null, timezone: null}};
    if (isZernioPlatform(platform)) return {...base, zernio: {postId: "", scheduledFor: null, timezone: null}};
    return base;
}

/** The newest ready item of `kind` some platform with room still needs, and those platforms. */
function nextLightItem(items: SocialContentRow[], kind: "carousel" | "text", posts: SocialPostRow[], platforms: SocialPlatform[], now: number) {
    const candidates = items
        .filter((item) => item.kind === kind && item.status === "ready" && !item.archived_at)
        .map((item) => ({item, mediaPath: contentMediaPath(item.id), createdAt: item.created_at}));
    return pickNextAutoShare(candidates, posts, platforms, now, "newest");
}

async function shareLight(dryRun: boolean, posts: SocialPostRow[], ready: Ready, caps: ReturnType<typeof dailyCaps>, now: number): Promise<LightShareResult> {
    const kind = pickLightKind(ready.platforms, posts, caps, now);
    if (!kind) return {kind: null, reason: "Today's carousels and text posts are all out"};
    const items = await listSocialContent(kind, 100);
    const withRoom = platformsWithRoom(ready.platforms, kind, posts, caps, now);
    const next = nextLightItem(items, kind, posts, withRoom, now);
    if (!next) return {kind: null, reason: `No ${kind === "carousel" ? "carousel" : "text post"} waiting for a platform with room today`};
    const {item} = next.video;
    const link = getAbsoluteUrl("en", sourcePath(item.source_type, item.source_slug));
    const {targets, tooLong} = autoShareTargets(item.share as ShareCopy, next.platforms, link);
    const skipped: Record<string, string> = {};
    for (const platform of tooLong) skipped[platform] = "Copy is over the platform's limit";
    if (dryRun || !targets.length) return {kind, id: item.id, title: item.source_title, queued: dryRun ? targets.map((target) => target.platform) : [], skipped};

    const queued: SocialPostRow[] = [];
    for (const target of targets) {
        const row = await insertPost({
            platform: target.platform,
            media_path: contentMediaPath(item.id),
            media_kind: kind === "carousel" ? CAROUSEL_MEDIA_KIND : TEXT_MEDIA_KIND,
            species_profile_id: null,
            species_name: item.source_title,
            page_slug: item.source_slug,
            capture_id: null,
            caption: target.caption.slice(0, 5000),
            title: (target.title ?? (item.share as ShareCopy).youtube?.title ?? item.source_title).slice(0, 100),
            mode: "post",
            options: zernioRowOptions(target.platform, ready, link, item.id)
        });
        if (row) queued.push(row);
        else skipped[target.platform] = "Already shared";
    }
    if (queued.length) void runContentShareJob(queued, item).catch((error) => console.error("[social-auto-share] content", error));
    return {kind, id: item.id, title: item.source_title, queued: queued.map((row) => row.platform), skipped};
}

/**
 * "Share now" from the admin panel: one carousel or text post to every ready
 * platform that takes its kind (cap above 0) and has not had it, ignoring
 * today's remaining room. Returns the platforms queued.
 */
export async function shareContentNow(item: SocialContentRow): Promise<{queued: SocialPlatform[]; skipped: Record<string, string>}> {
    const now = Date.now();
    const posts = await listPosts(1000);
    const ready = await readyPlatforms();
    const caps = dailyCaps(process.env.SOCIAL_DAILY_CAPS);
    const kind = item.kind === "carousel" ? "carousel" : "text";
    const takers = ready.platforms.filter((platform) => caps[platform][kind] > 0);
    const next = nextLightItem([item], kind, posts, takers, now);
    if (!next) return {queued: [], skipped: {...ready.skipped, all: "Already on every ready platform that takes it"}};
    const link = getAbsoluteUrl("en", sourcePath(item.source_type, item.source_slug));
    const {targets, tooLong} = autoShareTargets(item.share as ShareCopy, next.platforms, link);
    const skipped: Record<string, string> = {...ready.skipped};
    for (const platform of tooLong) skipped[platform] = "Copy is over the platform's limit";
    const queued: SocialPostRow[] = [];
    for (const target of targets) {
        const row = await insertPost({
            platform: target.platform,
            media_path: contentMediaPath(item.id),
            media_kind: kind === "carousel" ? CAROUSEL_MEDIA_KIND : TEXT_MEDIA_KIND,
            species_profile_id: null,
            species_name: item.source_title,
            page_slug: item.source_slug,
            capture_id: null,
            caption: target.caption.slice(0, 5000),
            title: (target.title ?? (item.share as ShareCopy).youtube?.title ?? item.source_title).slice(0, 100),
            mode: "post",
            options: {...zernioRowOptions(target.platform, ready, link, item.id), auto: false}
        });
        if (row) queued.push(row);
        else skipped[target.platform] = "Already shared";
    }
    if (queued.length) void runContentShareJob(queued, item).catch((error) => console.error("[social-share] content", error));
    return {queued: queued.map((row) => row.platform), skipped};
}
