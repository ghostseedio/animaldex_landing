import {NextResponse} from "next/server";
import {isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: encounter hunting as the scene needs it (`voyage_hunting_v1`, AnimalDex migration 20261118100000): whether the
 * Ark hunts by encounter, its clock, every living predator's next hunt and the last encounter meals with their
 * geometry. Public and the same for everyone (animal ids, Ark days, scene metres; never a user). `{available: false}`
 * until the function exists, and the scene then stays on today's behaviour (`src/lib/ark-hunting.ts`).
 */
export async function GET() {
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({available: false}, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_hunting_v1", {p_voyage: "first"});
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] voyage_hunting_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({available: false}, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=300" : "no-store"}});
    }
    return NextResponse.json({available: true, hunting: data}, {headers: {"Cache-Control": "public, s-maxage=30, stale-while-revalidate=60"}});
}
