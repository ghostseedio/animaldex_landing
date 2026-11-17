import {NextResponse} from "next/server";
import {arkPhotoObject, isArkPhotoSize} from "@/lib/ark-capture-photo";
import {createSignedStorageUrl} from "@/lib/capture-storage-image";
import {isArkUuid, isMissingArkFunction} from "@/lib/ark-story";
import {createSupabaseServiceClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ark/photo/<animal id>/thumb|large: one size of the photo for an Ark animal, as a 307 to a signed URL of a
 * server-made derivative (card_640 / feed_1200, re-encoded by generate-capture-derivatives with image.strip(): no EXIF,
 * no GPS). docs/ark/CAPTURE-MEDIA-CONTRACT.md sections 2 and 2.6.
 *
 * The original upload is never served: `arkPhotoObject` signs only a path under `derived/<image id>/`. The derivative
 * function stores the ORIGINAL object as the "derivative" when no resize was needed (an original no larger than the size),
 * and the server's read hands that path over like any other; such a size is refused here. A `large` that is only the
 * original gives way to the 640 px derivative; with no derivative at all the answer is 404 (2026-11-17: 29 live `large`
 * and 1 `thumb` were originals, served until this check).
 *
 * The capture buckets are private, so this route signs with the service role, and asks only
 * `voyage_animal_photo_media_v1` (the animal's own capture, or for one born on the Ark its recorded ancestor's), which
 * applies every gate of the public read (a named founder's public capture, not suspended, not reported) and answers
 * the object or null. Before that read is applied it asks `voyage_animal_capture_media_v1` (the animal's own photo
 * only). 404 when there is no photo (or neither read is applied yet): an <img> then fails and the page draws nothing.
 * The redirect is cached like the capture image route's: well inside the signed URL's day.
 */
function none() {
    return new NextResponse(null, {status: 404, headers: {"Cache-Control": "public, max-age=60, s-maxage=60"}});
}

export async function GET(_request: Request, {params}: {params: {id: string; size: string}}) {
    if (!isArkUuid(params.id) || !isArkPhotoSize(params.size)) return none();
    const supabase = createSupabaseServiceClient();
    if (!supabase) return none();
    let {data, error} = await supabase.rpc("voyage_animal_photo_media_v1", {p_animal_id: params.id});
    if (error && isMissingArkFunction(error)) ({data, error} = await supabase.rpc("voyage_animal_capture_media_v1", {p_animal_id: params.id}));
    if (error || !data) return none();
    const object = arkPhotoObject(data, params.size);
    if (!object) return none();
    const signed = await createSignedStorageUrl(object.bucket, object.path);
    if (!signed) return none();
    const response = NextResponse.redirect(signed, 307);
    response.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=1800");
    return response;
}
