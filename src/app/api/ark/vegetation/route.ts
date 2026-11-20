import {NextResponse} from "next/server";
import {isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: the record's vegetation (`voyage_vegetation_public_v1`, AnimalDex decision 417 (1)): by island and zone, how much
 * of what the ground holds stands now (0-1), for the scene to thin overgrazed grass and for "Grass here: …".
 * `{vegetation: null}` while the server's vegetation is off, and until the function exists. Public and the same for
 * everyone; it moves with the hourly tick: cached for minutes.
 */
export async function GET() {
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({vegetation: null}, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_vegetation_public_v1");
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] voyage_vegetation_public_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({vegetation: null}, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=300" : "no-store"}});
    }
    const row = data && typeof data === "object" && !Array.isArray(data) ? (data as {day?: unknown; zones?: unknown}) : null;
    const zones = row?.zones && typeof row.zones === "object" && !Array.isArray(row.zones) ? row.zones : null;
    const vegetation = zones ? {day: Number.isFinite(Number(row!.day)) ? Number(row!.day) : null, zones} : null;
    return NextResponse.json({vegetation}, {headers: {"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"}});
}
