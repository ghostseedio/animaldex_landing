import {NextResponse} from "next/server";
import {isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: the kept-population switches (`voyage_kept_populations_v1`: `{captive_breeding, human_use}`, AnimalDex decision 444,
 * migration 20261223120000). Public booleans, the same for everyone; `{kept: null}` until the function exists (the card then
 * says nothing that depends on them). Cached for minutes.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET ?animal=<id>: that animal's stored neutering draw (`voyage_kept_neutered_v1`, KEPT-NEUTER-REGION, migration
 * 20261229120000): `{neuter: {on, neutered}}`, a boolean only (the capture country is never read or sent). `{neuter: null}`
 * until the function exists (the card then keeps the flat share).
 */
async function neuterDraw(animal: string) {
    const supabase = createSupabasePublicClient();
    if (!supabase || !UUID.test(animal)) return NextResponse.json({neuter: null}, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_kept_neutered_v1", {p_animal: animal});
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] voyage_kept_neutered_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({neuter: null}, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=300" : "no-store"}});
    }
    const row = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const neuter = row ? {on: row.on === true, neutered: typeof row.neutered === "boolean" ? row.neutered : null} : null;
    return NextResponse.json({neuter}, {headers: {"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"}});
}

export async function GET(request: Request) {
    const animal = new URL(request.url).searchParams.get("animal");
    if (animal !== null) return neuterDraw(animal);
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({kept: null}, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_kept_populations_v1");
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] voyage_kept_populations_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({kept: null}, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=300" : "no-store"}});
    }
    const row = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const kept = row ? {captive_breeding: row.captive_breeding === true, human_use: row.human_use === true} : null;
    return NextResponse.json({kept}, {headers: {"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"}});
}
