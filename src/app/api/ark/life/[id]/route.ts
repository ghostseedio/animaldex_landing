import {NextResponse} from "next/server";
import {decodeArkLife} from "@/lib/ark-life";
import {isArkUuid, isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: one Ark animal's life story (`voyage_animal_life_v1`), for the /ark
 * tap card: how it came aboard (or was born), its generation, age, meals,
 * young and milestones. Public and the same for everyone (bringers only as
 * labels), so read anonymously and cached briefly.
 *
 * `story_public` (the public debate it came from) is in the answer only
 * when the server's `public_story` flag is on; otherwise the card says only
 * that a step worked.
 *
 * `{life: null}` when there is none: the function is not applied yet
 * (PostgREST's PGRST202), the animal is unknown, or the read failed. The
 * card then tells what the snapshot knows.
 */
const CACHED = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(_request: Request, {params}: {params: {id: string}}) {
    if (!isArkUuid(params.id)) return NextResponse.json({life: null}, {status: 400, headers: {"Cache-Control": "no-store"}});
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({life: null}, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_animal_life_v1", {p_animal_id: params.id});
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] voyage_animal_life_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({life: null}, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=60" : "no-store"}});
    }
    return NextResponse.json({life: decodeArkLife(data)}, {headers: {"Cache-Control": CACHED}});
}
