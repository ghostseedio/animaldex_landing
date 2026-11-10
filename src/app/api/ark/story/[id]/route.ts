import {NextResponse} from "next/server";
import {decodeArkStory, isArkUuid, isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: how one Ark animal got aboard (`voyage_animal_story_v1`), for the
 * /ark tap card. The answer is public and the same for everyone, so it is
 * read anonymously and cached briefly.
 *
 * `{story: null}` whenever there is nothing public to tell: the animal did
 * not come from a public debate by an adult, the function is not applied
 * yet (PostgREST's PGRST202), or the read failed. The card then says only
 * that a step worked.
 */
const CACHED = "public, s-maxage=120, stale-while-revalidate=600";

export async function GET(_request: Request, {params}: {params: {id: string}}) {
    if (!isArkUuid(params.id)) return NextResponse.json({story: null}, {status: 400, headers: {"Cache-Control": "no-store"}});
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({story: null}, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_animal_story_v1", {p_animal_id: params.id});
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] voyage_animal_story_v1 failed", error.message.slice(0, 200));
        // Not there yet: ask again in a minute, not on every tap.
        return NextResponse.json({story: null}, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=60" : "no-store"}});
    }
    return NextResponse.json({story: decodeArkStory(data)}, {headers: {"Cache-Control": CACHED}});
}
