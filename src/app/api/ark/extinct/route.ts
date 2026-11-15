import {NextResponse} from "next/server";
import {arkExtinctForHost, decodeArkExtinctions} from "@/lib/ark-extinct";
import {isMissingArkFunction} from "@/lib/ark-story";
import {isPublishedAnimalSlug} from "@/lib/published-seo-slugs";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: Lost from the Ark (`voyage_extinctions_v1`, AnimalDex migration 20261124100000): every species the server
 * logged an extinction for, newest first, how its last one went and whether one is back aboard now. Public and the
 * same for everyone (species and Ark days only, never a person). `{available: false, extinctions: []}` until the
 * function exists or when the read fails: every surface then hides the section. Contract: docs/ark/EXTINCT-CONTRACT.md.
 */
const LIMIT = 50;

export async function GET() {
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({available: false, extinctions: []}, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_extinctions_v1", {p_voyage: "first", p_limit: LIMIT});
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] voyage_extinctions_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({available: false, extinctions: []}, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=300" : "no-store"}});
    }
    const list = decodeArkExtinctions(data);
    if (!list) return NextResponse.json({available: false, extinctions: []}, {headers: {"Cache-Control": "no-store"}});
    // A page slug only for a species page that exists (the list links to it).
    for (const one of list) if (one.pageSlug && !isPublishedAnimalSlug(one.pageSlug)) one.pageSlug = null;
    // An extinction (or a return) is rare and the page says "Back aboard" from this: a minute is fresh enough.
    return NextResponse.json(arkExtinctForHost({available: true, extinctions: list}), {headers: {"Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"}});
}
