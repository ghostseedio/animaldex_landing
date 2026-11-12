import {NextResponse, type NextRequest} from "next/server";
import {readArkFoodChainAboard, readArkFoodChainEntry} from "@/data/ark-food-chain";
import {isArkFoodChainSlug} from "@/lib/ark-food-chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?species=<model slug>: one species' place in the Ark's food chain, for
 * /ark/food-chain's taps (decision 244): what it eats and what eats it among
 * the animals aboard, with each link's field-guide phrase. Species facts only,
 * the same for everyone, so the CDN and the VM's nginx may cache it.
 *
 * A value that is not a strict slug is refused with a 400 before anything is
 * read; a slug with none of it aboard is a 404 (who is aboard is the shared,
 * memoised public read, so that costs no database read either).
 */
const CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(request: NextRequest) {
    const species = request.nextUrl.searchParams.get("species") ?? "";
    if (!isArkFoodChainSlug(species)) {
        return NextResponse.json({error: "species must be a species slug"}, {status: 400, headers: {"Cache-Control": "public, max-age=86400"}});
    }
    const read = await readArkFoodChainAboard();
    if (!read) return NextResponse.json({error: "the Ark cannot be read"}, {status: 503, headers: {"Cache-Control": "no-store"}});
    const entry = await readArkFoodChainEntry(read, species);
    if (!entry) {
        const aboard = read.aboard.bySlug.has(species);
        return NextResponse.json(
            {error: aboard ? "its food links cannot be read" : "none of it is aboard"},
            {status: aboard ? 503 : 404, headers: {"Cache-Control": aboard ? "no-store" : "public, max-age=300, s-maxage=600"}}
        );
    }
    return NextResponse.json({entry, asOf: read.asOf}, {headers: {"Cache-Control": CACHE}});
}
