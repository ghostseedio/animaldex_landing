import {NextResponse} from "next/server";
import {decodeArkCapturePhoto} from "@/lib/ark-capture-photo";
import {isArkUuid, isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: the photo for an Ark animal (`voyage_animal_photo_v1`, docs/ark/CAPTURE-MEDIA-CONTRACT.md 2 and 2.6), for the
 * /ark tap card: `{photo: {thumb, large, relation, generation, brought_by} | null}`, each size `{width, height, path}`
 * where `path` is this site's signing route. The animal's own capture photo (`relation: "self"`), or, for one born on
 * the Ark, its recorded ancestor's, with whose it is and who brought that ancestor aboard. Public and the same for
 * everyone, so read anonymously and cached briefly.
 *
 * `{photo: null}` when there is none: the animal has no photo the server will show, or the read failed. Before the
 * newer read is applied (PGRST202) it asks the older one, which answers the animal's own photo only (a born animal
 * then answers null); both missing is answered quietly and cached.
 */
const CACHED = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(_request: Request, {params}: {params: {id: string}}) {
    if (!isArkUuid(params.id)) return NextResponse.json({photo: null}, {status: 400, headers: {"Cache-Control": "no-store"}});
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({photo: null}, {headers: {"Cache-Control": "no-store"}});
    let {data, error} = await supabase.rpc("voyage_animal_photo_v1", {p_animal_id: params.id});
    if (error && isMissingArkFunction(error)) ({data, error} = await supabase.rpc("voyage_animal_capture_v1", {p_animal_id: params.id}));
    if (error) {
        const missing = isMissingArkFunction(error);
        if (!missing) console.warn("[ark] voyage_animal_photo_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({photo: null}, {headers: {"Cache-Control": missing ? "public, s-maxage=300" : "no-store"}});
    }
    return NextResponse.json({photo: decodeArkCapturePhoto(data, params.id)}, {headers: {"Cache-Control": CACHED}});
}
