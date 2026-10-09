import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {runShareJob} from "@/lib/social/runner";
import {findAdminStoryVideo} from "@/lib/social/story-videos";
import {insertPost, listPosts, updatePost} from "@/lib/social/store";
import {readTikTokOptions, tiktokOptionsProblem} from "@/lib/social/tiktok-options";
import {isSocialPlatform, type SocialPlatform, type SocialPostRow} from "@/lib/social/types";

/** A queued/processing row older than this is assumed dead (server restarted mid-upload). */
const STALE_MS = 30 * 60_000;

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        return NextResponse.json({ok: true, posts: await listPosts()});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load share log"}, {status: 500});
    }
}

type ShareBody = {
    speciesProfileId?: string;
    mediaPath?: string;
    title?: string;
    targets?: Array<{platform?: string; caption?: string; mode?: string; tiktok?: unknown}>;
};

/** Queues one video for the chosen platforms and starts uploading in the background. */
export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const body = await request.json().catch(() => null) as ShareBody | null;
    const targets = (body?.targets ?? []).filter((target): target is {platform: SocialPlatform; caption?: string; mode?: string; tiktok?: unknown} => isSocialPlatform(target.platform));
    if (!body?.speciesProfileId || !body.mediaPath || targets.length === 0) {
        return NextResponse.json({error: "Pick a video and at least one platform"}, {status: 400});
    }

    // The TikTok connection only has video.publish (direct posting), no drafts scope.
    if (targets.some((target) => target.platform === "tiktok" && target.mode === "draft")) {
        return NextResponse.json({error: "TikTok drafts are not enabled; post directly instead"}, {status: 400});
    }
    // A direct TikTok post needs the poster's own choices.
    const tiktokTarget = targets.find((target) => target.platform === "tiktok" && target.mode !== "draft");
    const tiktokOptions = tiktokTarget ? readTikTokOptions(tiktokTarget.tiktok) : undefined;
    const tiktokProblem = tiktokTarget ? tiktokOptionsProblem(tiktokOptions, null) : null;
    if (tiktokProblem) return NextResponse.json({error: tiktokProblem}, {status: 400});

    try {
        const video = await findAdminStoryVideo(body.speciesProfileId, body.mediaPath);
        if (!video) return NextResponse.json({error: "That video is no longer served (deleted or made private)"}, {status: 409});

        const existing = await listPosts(500);
        const now = Date.now();
        await Promise.all(existing
            .filter((post) => post.media_path === video.mediaPath && (post.status === "queued" || post.status === "processing") && now - Date.parse(post.updated_at) > STALE_MS)
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
                options: target === tiktokTarget && tiktokOptions ? {tiktok: tiktokOptions} : null
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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
