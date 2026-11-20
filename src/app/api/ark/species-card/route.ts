import {NextResponse, type NextRequest} from "next/server";
import {readArkSpeciesCard} from "@/data/ark-species-card";
import {isArkFoodChainSlug} from "@/lib/ark-food-chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

/**
 * GET ?id=<species profile id>&slug=<model slug>: the Ark card's species facts (lane ARK-SIMPLE): its AnimalDex index
 * number and its Animal Power's name and lesson (`data/ark-species-card.ts`). Species facts only, the same for everyone,
 * so the CDN may cache it. A value that is neither a uuid nor a strict slug is refused before anything is read.
 */
export async function GET(request: NextRequest) {
    const id = request.nextUrl.searchParams.get("id");
    const slug = request.nextUrl.searchParams.get("slug");
    const okId = id && UUID.test(id) ? id : null;
    const okSlug = slug && isArkFoodChainSlug(slug) ? slug : null;
    if (!okId && !okSlug) return NextResponse.json({error: "id or slug required"}, {status: 400, headers: {"Cache-Control": "public, max-age=86400"}});
    const card = await readArkSpeciesCard(okId, okSlug);
    if (!card) return NextResponse.json({card: null}, {status: 404, headers: {"Cache-Control": "public, max-age=600, s-maxage=3600"}});
    return NextResponse.json({card}, {headers: {"Cache-Control": CACHE}});
}
