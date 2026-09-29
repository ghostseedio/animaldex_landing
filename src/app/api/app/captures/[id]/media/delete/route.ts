import {NextResponse} from "next/server";
import {isServableCaptureMediaReference} from "@/lib/capture-storage-reference";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BATCH = 50;

/**
 * Removes extra media from one of the signed-in owner's captures.
 *
 * Runs as the owner, so row security is what stops anybody deleting somebody
 * else's media. On top of that every statement here carries `sort_order > 0`:
 * the analysis photo at position zero is never matched, whatever id is sent.
 *
 * A POST rather than a DELETE because the batch travels in the body, and this
 * server refuses a DELETE that carries one before any handler sees it.
 *
 * The row goes first and the stored object second, as on iOS. If the object
 * cannot be removed the capture is still correct — an orphaned file is
 * invisible, a row pointing at a missing file is a broken card.
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
    const requested: string[] = Array.isArray(body.mediaRowIds) ? body.mediaRowIds : [];
    const mediaRowIds = Array.from(new Set(
        requested.map((id) => String(id).trim().toLowerCase()).filter((id) => UUID.test(id))
    )).slice(0, MAX_BATCH);

    if (!UUID.test(captureId) || !mediaRowIds.length) {
        return NextResponse.json({error: "A capture and at least one media item are required."}, {status: 400});
    }

    // Ownership is settled before anything is touched, so a request for a
    // capture that is not theirs is refused rather than silently matching nothing.
    const {data: capture} = await supabase
        .from("captures")
        .select("id")
        .eq("id", captureId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (!capture) {
        return NextResponse.json({error: "Capture not found."}, {status: 404});
    }

    const {data: rows, error: readError} = await supabase
        .from("capture_images")
        .select("id,storage_bucket,storage_path")
        .eq("capture_id", captureId)
        .in("id", mediaRowIds)
        .gt("sort_order", 0);

    if (readError) {
        return NextResponse.json({error: "That media could not be removed. Try again in a moment."}, {status: 400});
    }

    const deletable = (rows ?? []) as Array<{id: string; storage_bucket: string | null; storage_path: string | null}>;
    const deleted: string[] = [];

    for (const row of deletable) {
        const {data: removed, error} = await supabase
            .from("capture_images")
            .delete()
            .eq("capture_id", captureId)
            .eq("id", row.id)
            .gt("sort_order", 0)
            .select("id");

        if (error || !removed?.length) continue;
        deleted.push(row.id.toLowerCase());

        if (row.storage_bucket && row.storage_path && isServableCaptureMediaReference(row.storage_bucket, row.storage_path)) {
            await supabase.storage.from(row.storage_bucket).remove([row.storage_path]).catch(() => undefined);
        }
    }

    // Anything asked for and not removed is reported, so the interface can put
    // it back and say so instead of pretending the whole batch worked.
    const rejected = mediaRowIds.filter((id) => !deleted.includes(id));

    return NextResponse.json({deleted, rejected}, {status: deleted.length ? 200 : 409});
}
