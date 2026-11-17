import {NextResponse} from "next/server";
import {isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY = {bonds: [], children: []};

/**
 * GET: the town's human couples and their children (`voyage_human_bonds_v1`, AnimalDex decision 380): who is dating
 * whom, who lives together, whose child a young human is. Animal ids and Ark days only: no names, no user ids. Public
 * and the same for everyone; empty while the server's courtship is off, and until the function exists. A courtship
 * moves over real days: cached for minutes.
 */
export async function GET() {
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json(EMPTY, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_human_bonds_v1");
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] voyage_human_bonds_v1 failed", error.message.slice(0, 200));
        return NextResponse.json(EMPTY, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=300" : "no-store"}});
    }
    const row = data && typeof data === "object" ? (data as {bonds?: unknown; children?: unknown}) : null;
    return NextResponse.json({bonds: Array.isArray(row?.bonds) ? row.bonds : [], children: Array.isArray(row?.children) ? row.children : []}, {headers: {"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"}});
}
