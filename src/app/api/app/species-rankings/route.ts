import {NextResponse} from "next/server";
import {getSpeciesPageData} from "@/data/database-species-pages";
import {getSpeciesRankings} from "@/data/species-rankings";

export const runtime = "nodejs";

/**
 * Community rankings for one species, read from `discover_feed_v1` exactly as
 * iOS `fetchSpeciesRankingSummary` does.
 *
 * Client-fetched rather than rendered on the server because the species page is
 * fully static (`revalidate = false`) and rankings move with every new public
 * capture. Public: these are already-public captures, and the ranked list is
 * what iOS shows in the Stats tab without an account.
 */
export async function GET(request: Request) {
    const slug = new URL(request.url).searchParams.get("slug")?.trim();

    if (!slug) {
        return NextResponse.json({error: "A species slug is required."}, {status: 400});
    }

    const entry = await getSpeciesPageData(slug);

    if (!entry) {
        return NextResponse.json({items: []});
    }

    try {
        const items = await getSpeciesRankings(entry);
        return NextResponse.json({items}, {
            headers: {"Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800"}
        });
    } catch {
        // A ranking failure must not blank the Stats tab.
        return NextResponse.json({items: []});
    }
}
