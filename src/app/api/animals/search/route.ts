import {NextResponse} from "next/server";
import {
    normalizeSearchQuery,
    recordCatalogSearch,
    runUniversalSearch
} from "@/data/universal-search";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";

export const runtime = "nodejs";

// Every miss costs an AI round trip on the shared function.
const SEARCH_LIMIT = 20;
const SEARCH_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
    let body: {query?: string; locale?: string; latitude?: number; longitude?: number};
    try {
        body = (await request.json()) as typeof body;
    } catch {
        return NextResponse.json({error: "invalid_request"}, {status: 400});
    }

    const query = normalizeSearchQuery(String(body.query ?? ""));
    if (!query) return NextResponse.json({error: "missing_query"}, {status: 400});

    const limit = checkRateLimit(
        `animal-search:${getRequestIdentifier(request)}`,
        SEARCH_LIMIT,
        SEARCH_WINDOW_MS
    );

    if (!limit.allowed) {
        return NextResponse.json(
            {error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds},
            {status: 429, headers: {"Retry-After": String(limit.retryAfterSeconds)}}
        );
    }

    const response = await runUniversalSearch({
        query,
        locale: typeof body.locale === "string" ? body.locale : "en",
        latitude: typeof body.latitude === "number" ? body.latitude : null,
        longitude: typeof body.longitude === "number" ? body.longitude : null
    });

    if (!response) {
        return NextResponse.json({error: "search_failed"}, {status: 502});
    }

    // Feeds the trending rail; never blocks the response.
    void recordCatalogSearch(query);

    return NextResponse.json(response, {headers: {"Cache-Control": "no-store"}});
}
