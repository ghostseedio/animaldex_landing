import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {runShareJob} from "@/lib/social/runner";
import {findAdminStoryVideo} from "@/lib/social/story-videos";
import {shareableContentVideo} from "@/lib/content-video/share";
import {insertPost, listPosts, updatePost} from "@/lib/social/store";
import {readTikTokOptions, tiktokOptionsProblem} from "@/lib/social/tiktok-options";
import {isSocialPlatform, type SocialPlatform, type SocialPostOptions, type SocialPostRow} from "@/lib/social/types";
import {deleteZernioPost, describeZernioError, isZernioConfigured, scheduleProblem, ZernioError, zernioConfigProblem} from "@/lib/social/zernio";
import {reconcileZernioRows} from "@/lib/social/zernio-sync";

/**
 * A queued/processing row older than this is assumed dead (server restarted
 * mid-upload). Rows that already have a Zernio post id are never stale: the
 * post lives in Zernio and is reconciled from there.
 */
const STALE_MS = 30 * 60_000;

function isStale(post: SocialPostRow, now: number) {
    if (post.status !== "queued" && post.status !== "processing") return false;
    if (post.platform === "tiktok" && post.options?.zernio?.postId) return false;
    return now - Date.parse(post.updated_at) > STALE_MS;
}

/** The share log, with waiting TikTok rows brought up to date from Zernio first. */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        const posts = await reconcileZernioRows(await listPosts());
        return NextResponse.json({ok: true, posts});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load share log"}, {status: 500});
    }
}

type ShareTarget = {platform?: string; caption?: string; mode?: string; tiktok?: unknown; scheduledFor?: string | null; timezone?: string | null};

type ShareBody = {
    /** A blog video (admin_content_videos.id) instead of an app story video. */
    contentVideoId?: string;
    speciesProfileId?: string;
    mediaPath?: string;
    title?: string;
    targets?: ShareTarget[];
};

const IANA_ZONE = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/;

function readTimezone(value: unknown) {
    return typeof value === "string" && IANA_ZONE.test(value.trim()) ? value.trim() : null;
}

/** Queues one video for the chosen platforms and starts uploading in the background. */
export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const body = await request.json().catch(() => null) as ShareBody | null;
    const targets = (body?.targets ?? []).filter((target): target is ShareTarget & {platform: SocialPlatform} => isSocialPlatform(target.platform));
    if (!(body?.contentVideoId || (body?.speciesProfileId && body.mediaPath)) || targets.length === 0) {
        return NextResponse.json({error: "Pick a video and at least one platform"}, {status: 400});
    }

    // Scheduling is a Zernio feature, so only TikTok has it.
    if (targets.some((target) => target.platform !== "tiktok" && target.scheduledFor)) {
        return NextResponse.json({error: "Scheduling is only available for TikTok right now"}, {status: 400});
    }
    const tiktokTarget = targets.find((target) => target.platform === "tiktok");
    let tiktokOptions: SocialPostOptions | null = null;
    if (tiktokTarget) {
        const configProblem = zernioConfigProblem();
        if (configProblem || !isZernioConfigured()) return NextResponse.json({error: configProblem ?? "TikTok posting is not set up"}, {status: 400});
        const scheduledFor = typeof tiktokTarget.scheduledFor === "string" && tiktokTarget.scheduledFor.trim() ? tiktokTarget.scheduledFor.trim() : null;
        const timeProblem = scheduleProblem(scheduledFor);
        if (timeProblem) return NextResponse.json({error: timeProblem}, {status: 400});
        // A draft goes to the TikTok Creator Inbox, where privacy and the toggles are
        // chosen in the app; a direct post needs the poster's own choices here.
        const draft = tiktokTarget.mode === "draft";
        const chosen = draft ? undefined : readTikTokOptions(tiktokTarget.tiktok);
        const optionsProblem = draft ? null : tiktokOptionsProblem(chosen, null);
        if (optionsProblem) return NextResponse.json({error: optionsProblem}, {status: 400});
        tiktokOptions = {
            ...(chosen ? {tiktok: chosen} : {}),
            // postId is filled by the runner once Zernio has the post.
            zernio: {postId: "", scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null, timezone: readTimezone(tiktokTarget.timezone)}
        };
    }

    try {
        const video = body.contentVideoId
            ? await shareableContentVideo(body.contentVideoId)
            : await findAdminStoryVideo(body.speciesProfileId!, body.mediaPath!);
        if (!video) return NextResponse.json({error: "That video is no longer served (deleted, archived or made private)"}, {status: 409});

        const existing = await listPosts(500);
        const now = Date.now();
        await Promise.all(existing
            .filter((post) => post.media_path === video.mediaPath && isStale(post, now))
            .map((post) => updatePost(post.id, {status: "failed", error: "Interrupted (server restarted during upload)"})));

        const queued: SocialPostRow[] = [];
        const skipped: SocialPlatform[] = [];
        for (const target of targets) {
            const row = await insertPost({
                platform: target.platform,
                media_path: video.mediaPath,
                media_kind: video.kind,
                species_profile_id: video.speciesProfileId,
                species_name: video.speciesName,
                page_slug: video.pageSlug,
                capture_id: video.captureId,
                caption: (target.caption ?? "").slice(0, 5000),
                title: body.title?.slice(0, 100) ?? null,
                mode: target.mode === "draft" ? "draft" : "post",
                options: target === tiktokTarget ? tiktokOptions : null
            });
            if (row) queued.push(row);
            else skipped.push(target.platform);
        }

        // Deliberately not awaited: uploads take minutes and the self-hosted
        // server keeps running after the response. The page polls the log.
        if (queued.length > 0) void runShareJob(queued).catch((error) => console.error("[social-share]", error));

        return NextResponse.json({ok: true, queued: queued.map((row) => row.platform), skipped});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to share"}, {status: 500});
    }
}

/** Cancels a scheduled TikTok post that Zernio has not published yet: `?id=<share-log row id>`. */
export async function DELETE(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({error: "Missing share id"}, {status: 400});
    try {
        const row = (await listPosts(500)).find((post) => post.id === id);
        if (!row) return NextResponse.json({error: "That share is not in the log"}, {status: 404});
        const postId = row.options?.zernio?.postId;
        if (row.platform !== "tiktok" || !postId) return NextResponse.json({error: "Only scheduled TikTok posts can be cancelled"}, {status: 400});
        if (row.status !== "queued") return NextResponse.json({error: row.status === "published" ? "That post is already live on TikTok" : "That post is not waiting to publish"}, {status: 409});
        try {
            await deleteZernioPost(postId);
        } catch (error) {
            // Already deleted in the Zernio dashboard: the end state is the same.
            if (!(error instanceof ZernioError && error.kind === "not_found")) throw error;
        }
        await updatePost(row.id, {status: "failed", error: "Cancelled before publishing"});
        return NextResponse.json({ok: true});
    } catch (error) {
        if (error instanceof ZernioError) return NextResponse.json({error: describeZernioError(error)}, {status: error.kind === "config" ? 400 : 502});
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to cancel"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
