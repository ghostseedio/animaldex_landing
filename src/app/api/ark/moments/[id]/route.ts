import {NextResponse} from "next/server";
import {readArkHeartsRules} from "@/data/ark-hearts-rules";
import {decodeArkMoments} from "@/lib/ark-life-so-far";
import {isArkUuid, isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: one Ark animal's life so far (`voyage_animal_moments_v1`, AnimalDex migration 20270102100000), for the /ark card's
 * "Life so far" (lane BIO, behind `?lifestory` until the read is live): its recorded moments, newest first. Public and
 * the same for everyone (the read names no person), so read anonymously and cached briefly.
 *
 * `{moments: null}` when there is none: the function is not applied yet (PostgREST's PGRST202), the animal is unknown,
 * or the read failed. The card then shows no list.
 *
 * `heartsRules` beside it (`voyage_hearts_rules_v1`, docs/ark/hearts-escape.md): which rule the server runs for a heart, so a
 * return reads "Back after lying up" while a heart is a survived attack, and "Came back for another life" otherwise. Absent
 * from a server that does not say (the words are then as they were).
 */
const CACHED = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(_request: Request, {params}: {params: {id: string}}) {
    if (!isArkUuid(params.id)) return NextResponse.json({moments: null}, {status: 400, headers: {"Cache-Control": "no-store"}});
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({moments: null}, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_animal_moments_v1", {p_animal_id: params.id, p_limit: 100});
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] voyage_animal_moments_v1 failed", error.message.slice(0, 200));
        // Not there yet: ask again in a minute, not on every tap.
        return NextResponse.json({moments: null}, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=60" : "no-store"}});
    }
    // The server's answer as it is (the card decodes it again: `decodeArkMoments`), or null when it is not one.
    const heartsRules = await readArkHeartsRules(60);
    return NextResponse.json({moments: decodeArkMoments(data) ? data : null, ...(heartsRules ? {heartsRules} : {})}, {headers: {"Cache-Control": CACHED}});
}
