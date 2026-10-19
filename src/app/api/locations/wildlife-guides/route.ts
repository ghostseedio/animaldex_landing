import {NextResponse} from "next/server";
import {getPublicWildlifeGuidesForLocation} from "@/data/virtual-wildlife-guides";
import {getGuideLocation} from "@/data/wildlife-guide-locations";

export const runtime = "nodejs";

/**
 * Public virtual Wildlife Guides for one `/locations/<slug>` page: by country
 * for a country page, near the place's centre otherwise.
 *
 * Location pages are SSG with no remote reads at build (`seo-ssg-remote-guard`),
 * so their guides section asks here at view time instead of baking a snapshot
 * that would go stale. The guides are public already.
 */
export async function GET(request: Request) {
    const slug = new URL(request.url).searchParams.get("slug") || "";
    const location = getGuideLocation(slug);
    if (!location) {
        return NextResponse.json({error: "unknown_location"}, {status: 404});
    }
    const guides = await getPublicWildlifeGuidesForLocation(location.query);
    return NextResponse.json(
        {guides: guides.slice(0, 12), total: guides.length},
        {headers: {"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"}}
    );
}
