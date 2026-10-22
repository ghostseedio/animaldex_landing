import {getFreshConnection, isOAuthPlatform} from "@/lib/social/oauth";
import {publishers} from "@/lib/social/publishers";
import {findAdminStoryVideo} from "@/lib/social/story-videos";
import {findShareableContentVideoByPath} from "@/lib/content-video/share";
import {CONTENT_VIDEO_MEDIA_KIND} from "@/lib/content-video/store";
import {findShareableUploadedVideoByPath, UPLOADED_VIDEO_MEDIA_KIND} from "@/lib/social/uploaded-videos";
import {updatePost} from "@/lib/social/store";
import {normalizeVideoForSocial} from "@/lib/social/video-normalize";
import {EMPTY_TIKTOK_OPTIONS} from "@/lib/social/tiktok-options";
import {describeZernioError, getTikTokAccount, postToTikTok, uploadVideoToZernio, ZernioError, type ZernioPostSnapshot} from "@/lib/social/zernio";
import {rateLimitRetryDelaySeconds, zernioPatchForRow} from "@/lib/social/zernio-sync";
import type {SocialPostRow, TikTokPostOptions} from "@/lib/social/types";

// Runs queued shares in the background of the (long-lived, self-hosted) Node
// server: the request that queued them returns at once and the admin page
// polls the log. A container restart mid-upload leaves a row "processing";
// the page shows it as stale and it can be retried. TikTok rows are handed to
// Zernio (upload + create post) and from then on tracked by their Zernio post
// id, so they are never stale once options.zernio.postId is set.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

async function download(url: string) {
    const response = await fetch(url, {cache: "no-store", signal: AbortSignal.timeout(5 * 60_000)});
    if (!response.ok) throw new Error(`Downloading the video failed (${response.status})`);
    const length = Number(response.headers.get("content-length"));
    if (length > MAX_VIDEO_BYTES) throw new Error(`Video is ${Math.round(length / 1e6)} MB, over the ${MAX_VIDEO_BYTES / 1e6} MB limit`);
    return Buffer.from(await response.arrayBuffer());
}

function errorText(error: unknown) {
    return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
}

/** Publishes one video to every platform in `rows` (all the same video), one download shared. */
export async function runShareJob(rows: SocialPostRow[]) {
    const [first] = rows;
    if (!first) return;
    await Promise.all(rows.map((row) => updatePost(row.id, {status: "processing"}).catch(() => undefined)));

    let video: Buffer;
    let videoUrl: string;
    try {
        if (first.media_kind === CONTENT_VIDEO_MEDIA_KIND) {
            // A blog video: still live (not archived) at the moment of sharing.
            const current = await findShareableContentVideoByPath(first.media_path);
            if (!current) throw new Error("The blog video was archived or removed");
            videoUrl = current.stableUrl;
        } else if (first.media_kind === UPLOADED_VIDEO_MEDIA_KIND) {
            const current = await findShareableUploadedVideoByPath(first.media_path);
            if (!current) throw new Error("The uploaded video was archived");
            videoUrl = current.stableUrl;
        } else {
            if (!first.species_profile_id) throw new Error("Share has no species");
            // Re-read from the endpoint: the file must still be served (the capture
            // still public) at the moment of sharing, and this gives a fresh URL.
            const current = await findAdminStoryVideo(first.species_profile_id, first.media_path);
            if (!current) throw new Error("The video is no longer served by species-story-media (deleted or made private)");
            videoUrl = current.signedUrl ?? current.stableUrl;
        }
        // Fixes the frame rate (e.g. old 15 fps renders) once, for every platform.
        const normalized = await normalizeVideoForSocial(await download(videoUrl));
        video = normalized.video;
        if (normalized.converted) console.info(`[social-share] ${first.media_path}: re-encoded ${normalized.fromFps?.toFixed(1)} fps → 30 fps`);
    } catch (error) {
        const message = errorText(error);
        await Promise.all(rows.map((row) => updatePost(row.id, {status: "failed", error: message}).catch(() => undefined)));
        return;
    }

    await Promise.all(rows.map(async (row) => {
        if (row.platform === "tiktok") {
            await shareToTikTok(row, video);
            return;
        }
        if (!isOAuthPlatform(row.platform)) return;
        try {
            const connection = await getFreshConnection(row.platform);
            const result = await publishers[row.platform](connection, {
                video,
                videoUrl,
                caption: row.caption,
                title: row.title ?? row.caption.split("\n")[0] ?? "",
                mode: row.mode,
                options: row.options ?? null
            });
            await updatePost(row.id, {status: "published", external_id: result.externalId, external_url: result.externalUrl, error: null});
        } catch (error) {
            await updatePost(row.id, {status: "failed", error: errorText(error)}).catch(() => undefined);
        }
    }));
}

/** Uploads the video to Zernio and creates the TikTok post (now, or at the scheduled time). */
async function shareToTikTok(row: SocialPostRow, video: Buffer) {
    let snapshot: ZernioPostSnapshot;
    let stage: "upload" | "create" = "upload";
    try {
        const filename = row.media_path.split("/").pop()?.replace(/\.[^.]+$/, "") || "animaldex";
        const {publicUrl} = await uploadVideoToZernio(video, `${filename}.mp4`);
        stage = "create";
        snapshot = await createTikTokPostWithRetry(row, publicUrl);
    } catch (error) {
        const message = (error instanceof ZernioError ? describeZernioError(error) : errorText(error)).slice(0, 900);
        if (stage === "create" && error instanceof ZernioError && error.kind === "unavailable") {
            // Zernio may have created the post before the connection dropped. Leave the
            // row "processing" (the 30-min stale rule frees it) rather than inviting a
            // blind retry that would post the video twice.
            await updatePost(row.id, {status: "processing", error: `Zernio did not answer while creating the post; check the Zernio dashboard before retrying. ${message}`}).catch(() => undefined);
            return;
        }
        await updatePost(row.id, {status: "failed", error: message}).catch(() => undefined);
        return;
    }
    // The post exists in Zernio now: the row must record its id even if the DB hiccups.
    const patch = zernioPatchForRow(row, snapshot);
    for (let attempt = 1; ; attempt += 1) {
        try {
            await updatePost(row.id, patch);
            return;
        } catch (error) {
            if (attempt >= 3) {
                console.error(`[social-share] row ${row.id} is Zernio post ${snapshot.postId} but the share log could not be updated`, error);
                return;
            }
            await sleep(2_000 * attempt);
        }
    }
}

/** Options for a Creator Inbox draft: TikTok wants a real privacy level even though the creator picks it in the app. */
async function draftOptions(): Promise<TikTokPostOptions> {
    let privacyLevel = "PUBLIC_TO_EVERYONE";
    try {
        const account = await getTikTokAccount();
        privacyLevel = account.privacyLevels.find((level) => level.value === "PUBLIC_TO_EVERYONE")?.value ?? account.privacyLevels[0]?.value ?? privacyLevel;
    } catch {
        // Keep the default; Zernio validates it again.
    }
    return {...EMPTY_TIKTOK_OPTIONS, privacyLevel, previewConfirmed: true};
}

async function createTikTokPostWithRetry(row: SocialPostRow, videoUrl: string): Promise<ZernioPostSnapshot> {
    // A draft (TikTok Creator Inbox) has no options of its own: privacy and the
    // toggles are chosen in the TikTok app. The poster consented by sharing.
    const options = row.options?.tiktok ?? await draftOptions();
    const create = () => postToTikTok({
        videoUrl,
        caption: row.caption,
        scheduledFor: row.options?.zernio?.scheduledFor ?? null,
        timezone: row.options?.zernio?.timezone ?? null,
        options,
        draft: row.mode === "draft",
        metadata: {source: "animaldex-admin", mediaPath: row.media_path, rowId: row.id},
        requestId: row.id
    });
    try {
        return await create();
    } catch (error) {
        const wait = rateLimitRetryDelaySeconds(error);
        if (wait === null) throw error;
        console.info(`[social-share] Zernio rate limit for ${row.id}; retrying in ${wait} s`);
        await sleep(wait * 1000);
        return await create();
    }
}
