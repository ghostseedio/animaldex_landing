import {NextResponse} from "next/server";
import {decodeArkCapturePhoto} from "@/lib/ark-capture-photo";
import {isArkUuid, isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: the photo that brought an Ark animal aboard (`voyage_animal_capture_v1`, docs/ark/CAPTURE-MEDIA-CONTRACT.md),
 * for the /ark tap card: `{photo: {thumb, large} | null}`, each size `{width, height, path}` where `path` is this
 * site's signing route. Public and the same for everyone, so read anonymously and cached briefly.
 *
 * `{photo: null}` when there is none: the read is not applied yet (PGRST202, answered quietly and cached), the
 * animal has no photo the server will show, or the read failed.
 */
const CACHED = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(_request: Request, {params}: {params: {id: string}}) {
    if (!isArkUuid(params.id)) return NextResponse.json({photo: null}, {status: 400, headers: {"Cache-Control": "no-store"}});
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({photo: null}, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_animal_capture_v1", {p_animal_id: params.id});
    if (error) {
        const missing = isMissingArkFunction(error);
        if (!missing) console.warn("[ark] voyage_animal_capture_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({photo: null}, {headers: {"Cache-Control": missing ? "public, s-maxage=300" : "no-store"}});
    }
    return NextResponse.json({photo: decodeArkCapturePhoto(data, params.id)}, {headers: {"Cache-Control": CACHED}});
}
