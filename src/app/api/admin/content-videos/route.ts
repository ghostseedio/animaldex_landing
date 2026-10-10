import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {contentVideoBusy, isContentVideoRunning, startContentVideoJob} from "@/lib/content-video/runner";
import {listPageCandidates, loadPageSource} from "@/lib/content-video/page-sources";
import {isSourceType, SOURCE_TYPES, type SourceType} from "@/lib/content-video/plan";
import {insertContentVideo, listContentVideos, publicStorageUrl, usedSourceSlugs} from "@/lib/content-video/store";
import {higgsfieldAuthorization} from "@/lib/content-video/higgsfield";

/** Page videos (newest first) and, per page family, the pages that do not have one yet. */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        const rows = await listContentVideos();
        const available = Object.fromEntries(await Promise.all(SOURCE_TYPES.map(async (type) => {
            const [candidates, used] = await Promise.all([listPageCandidates(type), usedSourceSlugs(type)]);
            return [type, candidates.filter((candidate) => !used.has(candidate.slug))] as const;
        })));
        const videos = rows.map((row) => ({
            ...row,
            running: isContentVideoRunning(row.id),
            videoUrl: row.video_path ? publicStorageUrl(row.video_path) : null,
            posterUrl: row.poster_path ? publicStorageUrl(row.poster_path) : null
        }));
        return NextResponse.json({
            ok: true,
            videos,
            available,
            busy: contentVideoBusy(),
            higgsfieldConfigured: Boolean(higgsfieldAuthorization())
        });
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load blog videos"}, {status: 500});
    }
}

/** Starts a video for `type` + `slug`, or for the first page of that family without one. */
export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const body = await request.json().catch(() => ({})) as {type?: string; slug?: string};
    const type: SourceType = isSourceType(body.type) ? body.type : "blog";
    if (contentVideoBusy()) return NextResponse.json({error: "Another video is being made; start the next one when it finishes"}, {status: 409});
    try {
        let slug = typeof body.slug === "string" && /^[a-z0-9-]+$/.test(body.slug) ? body.slug : null;
        if (!slug) {
            const [candidates, used] = await Promise.all([listPageCandidates(type), usedSourceSlugs(type)]);
            slug = candidates.find((candidate) => !used.has(candidate.slug))?.slug ?? null;
            if (!slug) return NextResponse.json({error: "Every page of that kind already has a video"}, {status: 409});
        }
        const source = await loadPageSource(type, slug);
        if (!source) return NextResponse.json({error: "That page does not exist or lacks the images a video needs"}, {status: 404});
        if (source.images.length < 2) return NextResponse.json({error: "That page needs at least two images for a video"}, {status: 400});
        const row = await insertContentVideo(type, slug, source.title);
        if (!row) return NextResponse.json({error: "That page already has a video (archive it to make a new one)"}, {status: 409});
        startContentVideoJob(row.id);
        return NextResponse.json({ok: true, id: row.id, type, slug, title: source.title});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to start the video"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
