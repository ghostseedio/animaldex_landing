import {NextRequest, NextResponse} from "next/server";
import {getDiscoverTimelineBundle, type DiscoverTimelineCursor} from "@/data/discover-timeline";

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
    const limit = normalizedPositiveInteger(request.nextUrl.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const {timeline, nextCursor} = await getDiscoverTimelineBundle(limit, readCursor(request));

    return NextResponse.json({
        timeline,
        nextCursor,
        hasMore: Boolean(nextCursor)
    });
}

export const dynamic = "force-dynamic";
