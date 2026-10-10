import {NextRequest, NextResponse} from "next/server";
import {isSourceType} from "@/lib/content-video/plan";
import {getPublishedContentVideo} from "@/lib/content-video/store";

/**
 * A page's published video, for pages that are static HTML: they carry the
 * videos snapshotted at build time and ask here for one published since.
 * Public and cached; only published, unarchived videos are ever returned.
 */
export async function GET(request: NextRequest) {
    const type = request.nextUrl.searchParams.get("type");
    const slug = request.nextUrl.searchParams.get("slug") ?? "";
    if (!isSourceType(type) || !/^[a-z0-9-]{1,160}$/.test(slug)) return NextResponse.json({video: null}, {status: 400});
    const video = await getPublishedContentVideo(slug, type);
    return NextResponse.json({video}, {headers: {"Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600"}});
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
