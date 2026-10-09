import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {listAdminStoryVideos} from "@/lib/social/story-videos";

/** Every generated video species-story-media currently serves. */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        const videos = (await listAdminStoryVideos()).map(({signedUrl: _signedUrl, ...video}) => video);
        return NextResponse.json({ok: true, videos});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load videos"}, {status: 502});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
