import {NextResponse} from "next/server";
import {getSpeciesSystemDynamicsCatalogPage} from "@/data/species-system-dynamics";

export const runtime = "nodejs";

/**
 * One page of System Dynamics for the Collection's "Systems Dynamics" browse
 * mode. The rows are the public, species-level summaries — the same ones the
 * Learn band renders for a viewer without Pro — so this needs no account.
 */
export async function GET(request: Request) {
    const params = new URL(request.url).searchParams;
    const limit = Number(params.get("limit") ?? 60);
    const offset = Number(params.get("offset") ?? 0);
    const page = await getSpeciesSystemDynamicsCatalogPage(
        Number.isFinite(limit) ? limit : 60,
        Number.isFinite(offset) ? offset : 0
    );
    const response = NextResponse.json(page);
    response.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    return response;
}
