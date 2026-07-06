import {NextRequest, NextResponse} from "next/server";
import {getDiscoverCollectorsPage} from "@/data/discover-collectors";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

function normalizedPositiveInteger(value: string | null, fallback: number, max: number) {
    const parsed = Number.parseInt(value ?? "", 10);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.min(parsed, max);
}

export async function GET(request: NextRequest) {
    const limit = normalizedPositiveInteger(request.nextUrl.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const offset = normalizedPositiveInteger(request.nextUrl.searchParams.get("offset"), 0, 500);
    const {collectors, total, hasMore} = await getDiscoverCollectorsPage(limit, offset);

    return NextResponse.json({
        collectors,
        total,
        nextOffset: offset + collectors.length,
        hasMore
    });
}

export const dynamic = "force-dynamic";
