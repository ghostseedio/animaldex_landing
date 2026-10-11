import {NextResponse} from "next/server";
import {searchAnimalHybridCards} from "@/data/animal-hybrid-cards";

/** At most this many matches come back; the grid says how many there are in all. */
const MAX_RESULTS = 48;

/**
 * Search for the Animal Hybrid Lab grid. The hub pages ship only their own 24
 * cards, so a search across all of them runs here instead of in the browser.
 * Answers come from the published snapshots, so they cache like a static file.
 */
export async function GET(request: Request) {
    const query = new URL(request.url).searchParams.get("q")?.slice(0, 80) ?? "";
    if (query.trim().length < 2) {
        return NextResponse.json({total: 0, cards: []});
    }
    const result = searchAnimalHybridCards(query, MAX_RESULTS);
    return NextResponse.json(result, {
        headers: {"Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400"}
    });
}
