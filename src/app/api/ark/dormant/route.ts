import {NextResponse} from "next/server";
import {isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: the kinds asleep through their dormant season now (`voyage_dormant_v1`: species ids, AnimalDex decision 370),
 * for the scene to draw them asleep in their dens. Public and the same for everyone; `{dormant: []}` while the
 * server's dormancy is off, and until the function exists. A season lasts a real day or more: cached for minutes.
 */
export async function GET() {
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({dormant: []}, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_dormant_v1");
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] voyage_dormant_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({dormant: []}, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=300" : "no-store"}});
    }
    const dormant = Array.isArray(data) ? data.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{8,64}$/i.test(id)) : [];
    return NextResponse.json({dormant}, {headers: {"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"}});
}
