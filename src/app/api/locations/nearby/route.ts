import {NextResponse} from "next/server";
import {fetchNearbyGuide} from "@/data/nearby-wildlife";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";

export const runtime = "nodejs";

const GUIDE_LIMIT = 12;
const GUIDE_WINDOW_MS = 10 * 60 * 1000;

function validCoordinate(latitude: unknown, longitude: unknown) {
    return typeof latitude === "number"
        && typeof longitude === "number"
        && Number.isFinite(latitude)
        && Number.isFinite(longitude)
        && Math.abs(latitude) <= 90
        && Math.abs(longitude) <= 180;
}

export async function POST(request: Request) {
    let body: {latitude?: number; longitude?: number; placeLabel?: string; countryCode?: string; locale?: string};
    try {
        body = (await request.json()) as typeof body;
    } catch {
        return NextResponse.json({error: "invalid_request"}, {status: 400});
    }

    if (!validCoordinate(body.latitude, body.longitude)) {
        return NextResponse.json({error: "invalid_coordinates"}, {status: 400});
    }

    const limit = checkRateLimit(
        `locations-guide:${getRequestIdentifier(request)}`,
        GUIDE_LIMIT,
        GUIDE_WINDOW_MS
    );

    if (!limit.allowed) {
        return NextResponse.json(
            {error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds},
            {status: 429, headers: {"Retry-After": String(limit.retryAfterSeconds)}}
        );
    }

    const guide = await fetchNearbyGuide({
        latitude: body.latitude as number,
        longitude: body.longitude as number,
        placeLabel: body.placeLabel ?? null,
        countryCode: body.countryCode ?? null,
        locale: body.locale ?? "en"
    });

    if (!guide) return NextResponse.json({error: "guide_failed"}, {status: 502});

    return NextResponse.json(guide, {headers: {"Cache-Control": "no-store"}});
}
