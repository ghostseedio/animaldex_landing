import {NextResponse} from "next/server";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";
import {getSiteUrl} from "@/lib/site";

export const runtime = "nodejs";

const GEOCODE_LIMIT = 60;
const GEOCODE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Place lookup for the "type your location" box, and reverse lookup for the
 * browser-geolocation path. Uses OpenStreetMap Nominatim (no key). Their usage
 * policy requires an identifying User-Agent and discourages heavy traffic, so
 * results are cached hard at the edge.
 */
function nominatimHeaders() {
    return {
        "User-Agent": `AnimalDex/1.0 (${getSiteUrl()})`,
        Accept: "application/json"
    };
}

export async function GET(request: Request) {
    const {searchParams} = new URL(request.url);
    const query = (searchParams.get("q") ?? "").trim();
    const latitude = searchParams.get("lat");
    const longitude = searchParams.get("lon");

    const limit = checkRateLimit(
        `locations-geocode:${getRequestIdentifier(request)}`,
        GEOCODE_LIMIT,
        GEOCODE_WINDOW_MS
    );

    if (!limit.allowed) return NextResponse.json({places: []}, {status: 429});

    try {
        if (latitude && longitude) {
            const url = new URL("https://nominatim.openstreetmap.org/reverse");
            url.searchParams.set("lat", latitude);
            url.searchParams.set("lon", longitude);
            url.searchParams.set("format", "jsonv2");
            url.searchParams.set("zoom", "12");

            const response = await fetch(url, {
                headers: nominatimHeaders(),
                next: {revalidate: 86400}
            });
            if (!response.ok) return NextResponse.json({places: []});

            const row = (await response.json()) as {display_name?: string; address?: Record<string, string>};
            const label = row.display_name ?? null;
            return NextResponse.json(
                {
                    places: label
                        ? [{
                            label,
                            latitude: Number(latitude),
                            longitude: Number(longitude),
                            countryCode: row.address?.country_code?.toUpperCase() ?? null
                        }]
                        : []
                },
                {headers: {"Cache-Control": "public, s-maxage=86400"}}
            );
        }

        if (!query) return NextResponse.json({places: []});

        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", query);
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("limit", "5");
        url.searchParams.set("addressdetails", "1");

        const response = await fetch(url, {
            headers: nominatimHeaders(),
            next: {revalidate: 86400}
        });
        if (!response.ok) return NextResponse.json({places: []});

        const rows = (await response.json()) as Array<{
            display_name?: string;
            lat?: string;
            lon?: string;
            address?: Record<string, string>;
        }>;

        const places = (Array.isArray(rows) ? rows : []).flatMap((row) => {
            const label = row.display_name?.trim();
            const lat = Number(row.lat);
            const lon = Number(row.lon);
            if (!label || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
            return [{
                label,
                latitude: lat,
                longitude: lon,
                countryCode: row.address?.country_code?.toUpperCase() ?? null
            }];
        });

        return NextResponse.json(
            {places},
            {headers: {"Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"}}
        );
    } catch {
        return NextResponse.json({places: []});
    }
}
