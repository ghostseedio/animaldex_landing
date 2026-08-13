import {NextResponse} from "next/server";
import {fetchSearchSuggestions, normalizeSearchQuery} from "@/data/universal-search";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";

export const runtime = "nodejs";

const SUGGEST_LIMIT = 120;
const SUGGEST_WINDOW_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
    const {searchParams} = new URL(request.url);
    const query = normalizeSearchQuery(searchParams.get("q") ?? "");
    const locale = (searchParams.get("locale") ?? "en").slice(0, 16);

    if (!query) return NextResponse.json({suggestions: []});

    const limit = checkRateLimit(
        `animal-suggest:${getRequestIdentifier(request)}`,
        SUGGEST_LIMIT,
        SUGGEST_WINDOW_MS
    );

    if (!limit.allowed) return NextResponse.json({suggestions: []});

    const suggestions = await fetchSearchSuggestions(query, locale);

    // Upstream caches these per query, so a short shared cache is safe.
    return NextResponse.json(
        {suggestions},
        {headers: {"Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600"}}
    );
}
