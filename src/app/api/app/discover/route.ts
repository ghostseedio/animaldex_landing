import {NextRequest, NextResponse} from "next/server";
import {getDiscoverTimelineBundle} from "@/data/discover-timeline";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;
const MAX_FETCH_WINDOW = 120;

function normalizedPositiveInteger(value: string | null, fallback: number, max: number) {
    const parsed = Number.parseInt(value ?? "", 10);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.min(parsed, max);
}

export async function GET(request: NextRequest) {
    const limit = normalizedPositiveInteger(request.nextUrl.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const offset = normalizedPositiveInteger(request.nextUrl.searchParams.get("offset"), 0, MAX_FETCH_WINDOW);
    const fetchLimit = Math.min(MAX_FETCH_WINDOW, offset + limit + 1);
    const {timeline} = await getDiscoverTimelineBundle(fetchLimit);
    const page = timeline.slice(offset, offset + limit);

    return NextResponse.json({
        timeline: page,
        nextOffset: offset + page.length,
        hasMore: timeline.length > offset + page.length
    });
}

export const dynamic = "force-dynamic";
