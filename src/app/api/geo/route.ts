import {NextResponse, type NextRequest} from "next/server";
import {COUNTRY_HEADER, normalizeCountry, resolveVisitorCountry, systemCurrencyFor} from "@/lib/request-country";

/**
 * The visitor's own country and "System" display currency, for pages that
 * are cached for everyone (the Ark, /talk) and so cannot read the request's
 * headers while rendering. Cloudflare's `CF-IPCountry` first, then the
 * browser's languages. Per visitor, so never stored by Cloudflare or a
 * browser cache; it holds nothing but the visitor's own country.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const edgeCountry = request.headers.get(COUNTRY_HEADER);
    const acceptLanguage = request.headers.get("accept-language");
    return NextResponse.json({
        country: resolveVisitorCountry({country: edgeCountry, acceptLanguage}),
        source: normalizeCountry(edgeCountry) ? "edge" : "language",
        currency: systemCurrencyFor({country: edgeCountry, acceptLanguage})
    }, {
        headers: {
            "Cache-Control": "private, no-store",
            "X-Robots-Tag": "noindex"
        }
    });
}
