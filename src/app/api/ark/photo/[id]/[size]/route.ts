import {NextResponse} from "next/server";
import {arkPhotoObject, isArkPhotoSize} from "@/lib/ark-capture-photo";
import {createSignedStorageUrl} from "@/lib/capture-storage-image";
import {isArkUuid} from "@/lib/ark-story";
import {createSupabaseServiceClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ark/photo/<animal id>/thumb|large: one size of the photo that brought an Ark animal aboard, as a 307 to a
 * signed URL of the server-made derivative (640 or 1200 px, re-encoded without EXIF or GPS; never the original).
 * docs/ark/CAPTURE-MEDIA-CONTRACT.md section 2.
 *
 * The capture buckets are private, so this route signs with the service role, and asks only
 * `voyage_animal_capture_media_v1`, which applies every gate of the public read (a named founder's public capture,
 * not suspended, not reported) and answers the object or null. 404 when there is no photo (or the read is not
 * applied yet): an <img> then fails and the page draws nothing. The redirect is cached like the capture image
 * route's: well inside the signed URL's day.
 */
function none() {
    return new NextResponse(null, {status: 404, headers: {"Cache-Control": "public, max-age=60, s-maxage=60"}});
}

export async function GET(_request: Request, {params}: {params: {id: string; size: string}}) {
    if (!isArkUuid(params.id) || !isArkPhotoSize(params.size)) return none();
    const supabase = createSupabaseServiceClient();
    if (!supabase) return none();
    const {data, error} = await supabase.rpc("voyage_animal_capture_media_v1", {p_animal_id: params.id});
    if (error || !data) return none();
    const object = arkPhotoObject(data, params.size);
    if (!object) return none();
    const signed = await createSignedStorageUrl(object.bucket, object.path);
    if (!signed) return none();
    const response = NextResponse.redirect(signed, 307);
    response.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=1800");
    return response;
}
