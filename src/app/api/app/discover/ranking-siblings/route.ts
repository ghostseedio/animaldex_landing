import {NextRequest, NextResponse} from "next/server";
import {getDiscoverRankingSiblings} from "@/data/discover-timeline";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 24;

function positiveInt(value: string | null, fallback: number, max: number) {
    const parsed = Number.parseInt(value ?? "", 10);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.min(parsed, max);
}

export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const captureId = params.get("captureId")?.trim() ?? "";
    const speciesProfileId = params.get("speciesProfileId")?.trim() || null;
    const normalizedIdentityKey = params.get("normalizedIdentityKey")?.trim() || null;
    const offset = positiveInt(params.get("offset"), 0, 500);
    const limit = positiveInt(params.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);

    if (!captureId) {
        return NextResponse.json({error: "captureId is required."}, {status: 400});
    }

    const result = await getDiscoverRankingSiblings({
        captureId,
        speciesProfileId,
        normalizedIdentityKey,
        offset,
        limit
    });

    return NextResponse.json(result);
}

export const dynamic = "force-dynamic";
