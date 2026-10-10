import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {buildSpeciesShareContext, generateShareCopy} from "@/lib/social/share-copy-server";
import {findAdminStoryVideo} from "@/lib/social/story-videos";
import {blogShareCopy} from "@/lib/content-video/share";

type CopyBody = {contentVideoId?: string; regenerate?: boolean; speciesProfileId?: string; mediaPath?: string; pageSlug?: string; speciesName?: string};

/** Drafts per-platform titles and captions for one video (Claude, else the template). */
export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const body = await request.json().catch(() => null) as CopyBody | null;
    if (body?.contentVideoId) {
        try {
            return NextResponse.json({ok: true, ...(await blogShareCopy(body.contentVideoId, Boolean(body.regenerate)))});
        } catch (error) {
            return NextResponse.json({error: error instanceof Error ? error.message : "Unable to draft copy"}, {status: 500});
        }
    }
    if (!body?.pageSlug || !/^[a-z0-9-]+$/.test(body.pageSlug)) return NextResponse.json({error: "pageSlug is required"}, {status: 400});
    try {
        const video = body.speciesProfileId && body.mediaPath
            ? await findAdminStoryVideo(body.speciesProfileId, body.mediaPath).catch(() => null)
            : null;
        const context = await buildSpeciesShareContext(body.pageSlug, body.speciesName ?? body.pageSlug, video);
        const result = await generateShareCopy(context);
        return NextResponse.json({ok: true, ...result});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to draft copy"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
