import {revalidatePath, revalidateTag} from "next/cache";
import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {contentVideoBusy, isContentVideoRunning, resumeStatus, startContentVideoJob} from "@/lib/content-video/runner";
import {CONTENT_VIDEO_CACHE_TAG, getContentVideo, updateContentVideo} from "@/lib/content-video/store";

type Action = "publish" | "unpublish" | "resume" | "rerender" | "archive";

function revalidatePost(slug: string) {
    revalidateTag(CONTENT_VIDEO_CACHE_TAG);
    revalidatePath(`/blog/${slug}`);
}

/**
 * publish / unpublish: show or hide it on its blog post.
 * resume: continue a failed or interrupted video from its last saved step.
 * rerender: re-edit a ready video from the same script and clips (free: no new clips).
 * archive: retire it (also unpublishes); the post becomes eligible for a new video.
 */
export async function PATCH(request: NextRequest, {params}: {params: {id: string}}) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const body = await request.json().catch(() => ({})) as {action?: Action};
    try {
        const row = await getContentVideo(params.id);
        if (!row || row.archived_at) return NextResponse.json({error: "Video not found"}, {status: 404});
        if (isContentVideoRunning(row.id)) return NextResponse.json({error: "This video is still being made"}, {status: 409});

        switch (body.action) {
            case "publish":
                if (row.status !== "ready") return NextResponse.json({error: "Only a finished video can be published"}, {status: 400});
                await updateContentVideo(row.id, {published_at: new Date().toISOString()});
                revalidatePost(row.source_slug);
                return NextResponse.json({ok: true});
            case "unpublish":
                await updateContentVideo(row.id, {published_at: null});
                revalidatePost(row.source_slug);
                return NextResponse.json({ok: true});
            case "archive":
                await updateContentVideo(row.id, {published_at: null, archived_at: new Date().toISOString()});
                revalidatePost(row.source_slug);
                return NextResponse.json({ok: true});
            case "resume":
            case "rerender": {
                if (contentVideoBusy()) return NextResponse.json({error: "Another video is being made; try again when it finishes"}, {status: 409});
                if (body.action === "resume" && row.status === "ready") return NextResponse.json({error: "This video is already finished"}, {status: 400});
                if (body.action === "rerender" && row.status !== "ready") return NextResponse.json({error: "Only a finished video can be re-edited"}, {status: 400});
                const status = body.action === "rerender" ? "rendering" : resumeStatus(row);
                // A published video stays on its post during a re-edit; the new file gets a new path.
                await updateContentVideo(row.id, {status, error: null, progress: "Resuming"});
                startContentVideoJob(row.id);
                return NextResponse.json({ok: true});
            }
            default:
                return NextResponse.json({error: "Unknown action"}, {status: 400});
        }
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to update the video"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
