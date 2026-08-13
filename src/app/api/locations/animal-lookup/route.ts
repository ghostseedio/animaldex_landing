import {NextResponse} from "next/server";
import {compassBearing, haversineKm, lookupAnimalLocation} from "@/data/nearby-wildlife";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";

export const runtime = "nodejs";

const LOOKUP_LIMIT = 15;
const LOOKUP_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
    let body: {
        latitude?: number;
        longitude?: number;
        animalName?: string;
        scientificName?: string;
        identityKey?: string;
        placeLabel?: string;
        locale?: string;
    };

    try {
        body = (await request.json()) as typeof body;
    } catch {
        return NextResponse.json({error: "invalid_request"}, {status: 400});
    }

    const latitude = body.latitude;
    const longitude = body.longitude;
    const animalName = String(body.animalName ?? "").trim();

    if (
        typeof latitude !== "number" || typeof longitude !== "number"
        || !Number.isFinite(latitude) || !Number.isFinite(longitude)
        || Math.abs(latitude) > 90 || Math.abs(longitude) > 180
        || !animalName
    ) {
        return NextResponse.json({error: "invalid_request"}, {status: 400});
    }

    const limit = checkRateLimit(
        `locations-lookup:${getRequestIdentifier(request)}`,
        LOOKUP_LIMIT,
        LOOKUP_WINDOW_MS
    );

    if (!limit.allowed) {
        return NextResponse.json(
            {error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds},
            {status: 429, headers: {"Retry-After": String(limit.retryAfterSeconds)}}
        );
    }

    const result = await lookupAnimalLocation({
        latitude,
        longitude,
        animalName,
        scientificName: body.scientificName ?? null,
        identityKey: body.identityKey ?? null,
        placeLabel: body.placeLabel ?? null,
        locale: body.locale ?? "en"
    });

    if (!result) return NextResponse.json({error: "lookup_failed"}, {status: 502});

    const origin = {latitude, longitude};
    const destination = {latitude: result.latitude, longitude: result.longitude};

    return NextResponse.json(
        {
            ...result,
            distanceKm: Math.round(haversineKm(origin, destination) * 10) / 10,
            bearing: compassBearing(origin, destination),
            origin
        },
        {headers: {"Cache-Control": "no-store"}}
    );
}
