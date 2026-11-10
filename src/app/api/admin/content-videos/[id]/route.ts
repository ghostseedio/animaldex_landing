import {revalidatePath, revalidateTag} from "next/cache";
import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {contentVideoBusy, isContentVideoRunning, resumeStatus, startContentVideoJob} from "@/lib/content-video/runner";
import {CONTENT_VIDEO_CACHE_TAG, getContentVideo, publicStorageUrl, updateContentVideo} from "@/lib/content-video/store";
import {fixPlan, videoProblems} from "@/lib/content-video/fix";
import {isRecordedSourceType} from "@/lib/content-video/plan";
import {submitIndexNow} from "@/lib/indexnow";
import {videoWatchPath} from "@/lib/video-sitemap";

type Action = "publish" | "unpublish" | "resume" | "rerender" | "archive" | "fix";

function revalidatePost(slug: string) {
    revalidateTag(CONTENT_VIDEO_CACHE_TAG);
    revalidatePath(`/blog/${slug}`);
}

/**
 * publish / unpublish: show or hide it on its blog post.
 * resume: continue a failed or interrupted video from its last saved step.
 * rerender: re-edit a ready video from the same script and clips (free: no new clips).
 * archive: retire it (also unpublishes); the post becomes eligible for a new video.
 * fix: find what is wrong (no voice, failed AI shots, a missing file, a stopped
 *   run) and repair it through the video maker (fix.ts). Only retried shots spend.
 */
export async function PATCH(request: NextRequest, {params}: {params: {id: string}}) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const body = await request.json().catch(() => ({})) as {action?: Action};
    try {
        const row = await getContentVideo(params.id);
        if (!row || row.archived_at) return NextResponse.json({error: "Video not found"}, {status: 404});
        if (isContentVideoRunning(row.id)) return NextResponse.json({error: "This video is still being made"}, {status: 409});
        // An Ark clip is recorded, not made: it can be published, taken down or archived, never re-made here.
        if (isRecordedSourceType(row.source_type) && (body.action === "resume" || body.action === "rerender" || body.action === "fix")) {
            return NextResponse.json({error: "Ark clips are recorded with scripts/ark-clips.mts: record it again instead"}, {status: 400});
        }

        switch (body.action) {
            case "publish":
                if (row.status !== "ready") return NextResponse.json({error: "Only a finished video can be published"}, {status: 400});
                await updateContentVideo(row.id, {published_at: new Date().toISOString()});
                revalidatePost(row.source_slug);
                // An Ark clip lives on its own watch page: tell the search engines, as the autopilot does for page videos.
                if (row.source_type === "ark") void submitIndexNow([videoWatchPath(row.source_type, row.source_slug), "/videos"]);
                return NextResponse.json({ok: true});
            case "unpublish":
                await updateContentVideo(row.id, {published_at: null});
                revalidatePost(row.source_slug);
                return NextResponse.json({ok: true});
            case "archive":
                await updateContentVideo(row.id, {published_at: null, archived_at: new Date().toISOString()});
                revalidatePost(row.source_slug);
                return NextResponse.json({ok: true});
            case "fix": {
                const fileMissing = row.status === "ready" && row.video_path ? !(await fileExists(publicStorageUrl(row.video_path))) : false;
                const problems = videoProblems({...row, running: false}, {fileMissing});
                const plan = fixPlan(row, problems, new Date(), resumeStatus(row));
                if (!plan) {
                    const reason = problems.find((problem) => problem.code === "not_editable")?.label;
                    return NextResponse.json({ok: true, fixing: [], message: reason ?? "Nothing to fix: the voice, every shot and the file are all there"});
                }
                if (contentVideoBusy()) return NextResponse.json({error: "Another video is being made; try again when it finishes"}, {status: 409});
                // A published video stays on its page (the current cut) until the fixed one replaces it.
                await updateContentVideo(row.id, {status: plan.status, plan: plan.plan, clips: plan.clips, error: null, progress: `Fixing: ${plan.fixing.join(", ")}`});
                startContentVideoJob(row.id, async () => revalidatePost(row.source_slug));
                return NextResponse.json({ok: true, fixing: plan.fixing, usd: plan.usd});
            }
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

/** Whether the bucket still serves the finished file (a deleted object 400s/404s). */
async function fileExists(url: string) {
    try {
        const response = await fetch(url, {method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(15_000)});
        return response.ok;
    } catch {
        // Unreachable is not proof of absence: do not re-render on a network blip.
        return true;
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
