import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {publicStorageUrl} from "@/lib/content-video/store";
import {archiveUploadedVideo, createUploadedVideo, listUploadedVideos, MAX_UPLOAD_BYTES, signUpload} from "@/lib/social/uploaded-videos";

/** Uploaded videos, newest first. */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        const videos = (await listUploadedVideos()).map((row) => ({...row, videoUrl: publicStorageUrl(row.video_path)}));
        return NextResponse.json({ok: true, videos, maxBytes: MAX_UPLOAD_BYTES});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load uploaded videos"}, {status: 500});
    }
}

type Body = {action?: string; fileName?: string; size?: number; path?: string; title?: string; notes?: string; durationSeconds?: number | null};

/**
 * `sign`: a storage path and one-time upload URL for the browser to PUT the file to.
 * `create`: records the file once it is in storage.
 */
export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const body = await request.json().catch(() => null) as Body | null;
    try {
        if (body?.action === "sign") {
            if (typeof body.size !== "number" || body.size <= 0) return NextResponse.json({error: "Missing file size"}, {status: 400});
            if (body.size > MAX_UPLOAD_BYTES) return NextResponse.json({error: `The file is ${Math.round(body.size / 1e6)} MB; the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB. Export a 1080×1920 copy.`}, {status: 400});
            return NextResponse.json({ok: true, ...(await signUpload(typeof body.fileName === "string" ? body.fileName : "video.mp4"))});
        }
        if (body?.action === "create") {
            const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
            if (!title || typeof body.path !== "string") return NextResponse.json({error: "A title and an uploaded file are required"}, {status: 400});
            const duration = typeof body.durationSeconds === "number" && Number.isFinite(body.durationSeconds) && body.durationSeconds > 0 ? body.durationSeconds : null;
            const row = await createUploadedVideo({
                path: body.path,
                title,
                notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 4000) : "",
                durationSeconds: duration
            });
            return NextResponse.json({ok: true, video: {...row, videoUrl: publicStorageUrl(row.video_path)}});
        }
        return NextResponse.json({error: "Unknown action"}, {status: 400});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Upload failed"}, {status: 500});
    }
}

/** Archives `?id=`: gone from the page and from new shares. */
export async function DELETE(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({error: "Missing id"}, {status: 400});
    try {
        await archiveUploadedVideo(id);
        return NextResponse.json({ok: true});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to archive"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
