import {NextResponse} from "next/server";
import {isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: the record's forestry (`voyage_forestry_v1`: `{fromDay, v}`, AnimalDex decision 379), for the scene to draw the
 * wild island's logging and replanting from the shared Ark day. Public and the same for everyone; `{forestry: null}`
 * while the server's forestry is off, and until the function exists. It changes only when switched: cached for minutes.
 */
export async function GET() {
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({forestry: null}, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_forestry_v1");
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] voyage_forestry_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({forestry: null}, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=300" : "no-store"}});
    }
    const row = data && typeof data === "object" ? (data as {fromDay?: unknown; v?: unknown}) : null;
    const fromDay = Number(row?.fromDay);
    const forestry = row && Number.isFinite(fromDay) && fromDay >= 0 ? {fromDay, v: Number(row.v) || 1} : null;
    return NextResponse.json({forestry}, {headers: {"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"}});
}
