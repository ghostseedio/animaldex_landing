import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {mediaMutationMessage} from "@/lib/capture-media-management";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Makes one of a capture's media its cover, through the same
 * `set_capture_cover_media` RPC iOS calls.
 *
 * The RPC decides everything that matters: it reads the owner from the
 * session, refuses a shot that was never analysed, and swaps positions in one
 * statement so the carousel never has two covers or none.
 */
export async function POST(request: Request, {params}: {params: {id: string}}) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({error: "Authentication required."}, {status: 401});
    }

    const body = await request.json().catch(() => ({}));
    const captureId = params.id?.trim() ?? "";
    const mediaRowId = String(body.mediaRowId ?? "").trim();

    if (!UUID.test(captureId) || !UUID.test(mediaRowId)) {
        return NextResponse.json({error: "A capture and a media item are required."}, {status: 400});
    }

    const {data, error} = await supabase.rpc("set_capture_cover_media", {
        p_capture_id: captureId,
        p_media_row_id: mediaRowId
    });

    if (error) {
        return NextResponse.json({error: mediaMutationMessage(error.message)}, {status: 400});
    }

    // Confirmed, not assumed: the change only counts if the row the owner chose
    // is the one now sitting at position zero.
    const selected = Array.isArray(data) ? data[0] : data;
    if (selected?.media_row_id?.toLowerCase() !== mediaRowId.toLowerCase() || selected?.sort_order !== 0) {
        return NextResponse.json({error: mediaMutationMessage("media_locked_or_unavailable")}, {status: 409});
    }

    return NextResponse.json({coverMediaRowId: mediaRowId});
}
