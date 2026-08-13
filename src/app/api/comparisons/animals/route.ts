import {NextResponse} from "next/server";
import {searchComparableAnimals} from "@/data/comparison-animals";

export const runtime = "nodejs";

/** Type-ahead source for the public "compare any two animals" builder. */
export async function GET(request: Request) {
    const {searchParams} = new URL(request.url);
    const query = (searchParams.get("q") ?? "").trim();
    const limitParam = Number.parseInt(searchParams.get("limit") ?? "10", 10);
    const limit = Number.isFinite(limitParam) ? limitParam : 10;

    try {
        const animals = await searchComparableAnimals(query, limit);
        return NextResponse.json(
            {animals},
            {headers: {"Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800"}}
        );
    } catch {
        return NextResponse.json({animals: []}, {status: 200});
    }
}
