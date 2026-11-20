import {NextResponse} from "next/server";
import {isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: the record's carers (`voyage_carers_v1`: `{v, keepers, farmers, homes}`, AnimalDex decision 418): the keepers,
 * farmers and pet owners who feed the kept animals, generic figures the scene draws at work. Public, counts only, the
 * same for everyone; `{carers: null}` while the server's `carers` is off, and until the function exists. Cached for minutes.
 */
export async function GET() {
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({carers: null}, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_carers_v1");
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] voyage_carers_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({carers: null}, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=300" : "no-store"}});
    }
    const row = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const count = (k: string) => Math.max(0, Math.floor(Number(row?.[k]) || 0));
    const carers = row ? {v: Number(row.v) || 1, keepers: count("keepers"), farmers: count("farmers"), homes: count("homes")} : null;
    return NextResponse.json({carers}, {headers: {"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"}});
}
