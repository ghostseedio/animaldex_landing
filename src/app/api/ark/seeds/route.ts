import {NextResponse} from "next/server";
import {ARK_SEEDS_ABSENT, shapeArkSeeds} from "@/lib/ark-seeds";
import {isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: the Ark's year seeds (`voyage_year_seeds_public_v1`, AnimalDex migration 20261204200000, P1-6 anti-staging; docs/ark/
 * anti-staging-p1-6.md). The Ark's few chance rolls are keyed with a secret number per Ark year (14 real days). Its SHA-256
 * commitment is published when the year starts and the number itself when the year is over (and the engine has finished it),
 * so anyone can check that nothing was changed:
 *
 *   commitment = sha256( "animaldex-ark-seed-v1|<voyage>|<year>|<seed>" )      (hex)
 *
 * Public and the same for everyone: years, Ark days, times, hashes and revealed seeds. Nothing about a person, and nothing
 * about what will happen: a seed is never answered before its year has ended. `matches` is this server's own check of a
 * revealed seed against its commitment.
 *
 *   200 {available: true, years: [...]}   at least one year committed (the flag is on or has been)
 *   200 {available: false}                the read is not there yet, or no year is committed: the calm empty state
 *   503                                   the read failed now
 */
const CACHE = "public, s-maxage=300, stale-while-revalidate=600";

export async function GET() {
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json(ARK_SEEDS_ABSENT, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_year_seeds_public_v1", {p_voyage: "first"});
    if (error) {
        if (isMissingArkFunction(error)) return NextResponse.json(ARK_SEEDS_ABSENT, {headers: {"Cache-Control": "public, s-maxage=300"}});
        console.warn("[ark] voyage_year_seeds_public_v1 failed", error.message.slice(0, 200));
        return NextResponse.json(ARK_SEEDS_ABSENT, {status: 503, headers: {"Cache-Control": "no-store"}});
    }
    const body = shapeArkSeeds(data);
    if (!body) return NextResponse.json(ARK_SEEDS_ABSENT, {status: 503, headers: {"Cache-Control": "no-store"}});
    return NextResponse.json(body, {headers: {"Cache-Control": body.available ? CACHE : "public, s-maxage=60"}});
}
