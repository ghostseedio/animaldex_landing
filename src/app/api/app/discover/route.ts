import {NextRequest, NextResponse} from "next/server";
import {
    getDiscoverPostById,
    getDiscoverTimelineBundle,
    seedTimelineWithFocusPost,
    type DiscoverTimelineCursor
} from "@/data/discover-timeline";
import {parseDiscoverPostId} from "@/lib/discover-post";
import {getViewerUserId} from "@/lib/viewer";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;

function normalizedPositiveInteger(value: string | null, fallback: number, max: number) {
    const parsed = Number.parseInt(value ?? "", 10);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.min(parsed, max);
}

function readCursor(request: NextRequest): DiscoverTimelineCursor | null {
    const date = request.nextUrl.searchParams.get("cursorDate");
    const rank = Number.parseInt(request.nextUrl.searchParams.get("cursorRank") ?? "", 10);
    const id = request.nextUrl.searchParams.get("cursorId");

    if (!date || !id || !Number.isFinite(rank)) return null;
    return {date, sortRank: rank, id};
}

export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const limit = normalizedPositiveInteger(params.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const cursor = readCursor(request);
    // `hydrate=1` is sent once by the static /p/[postId] shell (and only from a
    // real browser session) to turn a single shared post into the live feed —
    // the same thing the iOS deep link does when it scrolls the timeline to a
    // post. It also carries the viewer id so the action rail can light up.
    const hydrate = params.get("hydrate") === "1" && !cursor;
    const focusPostId = hydrate ? parseDiscoverPostId(params.get("focusPostId"))?.postId ?? null : null;

    const [bundle, focusPost, viewerUserId] = await Promise.all([
        getDiscoverTimelineBundle(limit, cursor),
        focusPostId ? getDiscoverPostById(focusPostId) : Promise.resolve(null),
        hydrate ? getViewerUserId() : Promise.resolve(null)
    ]);

    const timeline = hydrate ? seedTimelineWithFocusPost(bundle.timeline, focusPost) : bundle.timeline;

    return NextResponse.json({
        timeline,
        nextCursor: bundle.nextCursor,
        hasMore: Boolean(bundle.nextCursor),
        ...(hydrate ? {featured: bundle.featured, viewerUserId} : {})
    });
}

export const dynamic = "force-dynamic";
