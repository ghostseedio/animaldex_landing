import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {FOOTAGE} from "@/lib/content-video/footage";
import type {VideoPlan} from "@/lib/content-video/plan";
import {listContentVideos, publicStorageUrl} from "@/lib/content-video/store";

/** Our footage library (src/data/footage-library.json) with each shot's URLs and how many videos have used it. */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        const videos = await listContentVideos(1000).catch(() => []);
        const uses = new Map<string, number>();
        for (const video of videos) {
            const ids = new Set(((video.plan as VideoPlan | null)?.scenes ?? []).flatMap((scene) => (scene.footage ? [scene.footage.id] : [])));
            for (const id of Array.from(ids)) uses.set(id, (uses.get(id) ?? 0) + 1);
        }
        return NextResponse.json({
            ok: true,
            clips: FOOTAGE.map((clip) => ({...clip, url: publicStorageUrl(clip.path), posterUrl: publicStorageUrl(clip.poster), uses: uses.get(clip.id) ?? 0}))
        });
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load the footage library"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
