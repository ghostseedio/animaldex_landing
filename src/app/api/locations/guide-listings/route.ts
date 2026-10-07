import {NextResponse} from "next/server";
import {getPublicGuideListings} from "@/data/guide-marketplace";
import {getLocationPage} from "@/data/locations";
import {matchGuideListingsToLocation} from "@/lib/guide-location-match";

export const runtime = "nodejs";

/**
 * Published Guide listings for one `/locations/<slug>` page.
 *
 * Location pages are SSG with no remote reads at build (`seo-ssg-remote-guard`),
 * so the "Wildlife guides in <Location>" section asks here at view time instead of
 * baking a listing snapshot that would go stale. The listings are public already.
 */
export async function GET(request: Request) {
    const slug = new URL(request.url).searchParams.get("slug") || "";
    if (!getLocationPage(slug)) {
        return NextResponse.json({error: "unknown_location"}, {status: 404});
    }

    try {
        const listings = matchGuideListingsToLocation(await getPublicGuideListings(), slug);
        return NextResponse.json(
            {listings},
            {headers: {"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"}}
        );
    } catch {
        return NextResponse.json({error: "unavailable"}, {status: 503});
    }
}
