import {NextResponse} from "next/server";
import {getFusableSpecies, searchFusableSpecies, type FusableSpecies} from "@/data/animal-fusions";

export const runtime = "nodejs";

/**
 * Picker data for the Fuse tool: published animals that have a principle.
 * `?q=` searches by name; `?slugs=a,b` resolves a prefilled pair.
 */
export async function GET(request: Request) {
    const {searchParams} = new URL(request.url);
    const slugs = (searchParams.get("slugs") ?? "").split(",").slice(0, 2).filter(Boolean);
    const matches: FusableSpecies[] = slugs.length > 0
        ? slugs.flatMap((slug) => getFusableSpecies(slug) ?? [])
        : searchFusableSpecies((searchParams.get("q") ?? "").slice(0, 60), 8);

    return NextResponse.json(
        {species: matches.map(({slug, name, principle}) => ({slug, name, principle}))},
        {headers: {"Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"}}
    );
}
