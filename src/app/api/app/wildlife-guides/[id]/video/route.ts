import {NextResponse} from "next/server";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import {isUuid} from "@/lib/virtual-wildlife-guides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {"Cache-Control": "private, no-store"};

function failureFor(status: number, payload: {error?: string} | null) {
    const code = payload?.error ?? "";
    if (status === 401) return {status, error: "Sign in to edit your guides."};
    if (code === "upload_daily_limit") return {status, error: "You've added a lot of photos and videos today. Try again tomorrow."};
    if (code === "video_too_large") return {status, error: "That video is too large. Pick a shorter one."};
    if (code === "video_too_long") return {status, error: "Promo videos can be up to 60 seconds. Pick a shorter one."};
    if (code === "video_unreadable") return {status, error: "That video can't be read. Use an MP4 or MOV file."};
    if (code === "upload_not_found") return {status, error: "The video didn't finish uploading. Try again."};
    if (status === 503) return {status, error: "Videos can't be checked right now. Try again in a few minutes."};
    return {status: status >= 400 ? status : 502, error: "The video didn't upload. Try again."};
}

async function forward(body: Record<string, unknown>) {
    try {
        const invoked = await invokeAuthenticatedSupabaseFunctionResponse("wildlife-guide-upload", body);
        if (!invoked.ok) {
            const failure = failureFor(invoked.status, invoked.payload);
            return NextResponse.json({error: failure.error}, {status: failure.status, headers: NO_STORE});
        }
        return NextResponse.json(invoked.payload, {headers: NO_STORE});
    } catch (error) {
        const signedOut = error instanceof Error && /Authentication required/.test(error.message);
        return NextResponse.json(
            {error: signedOut ? "Sign in to edit your guides." : "The video didn't upload. Try again."},
            {status: signedOut ? 401 : 503, headers: NO_STORE}
        );
    }
}

/**
 * A guide's promo video through the `wildlife-guide-upload` edge function:
 * `{step: "start"}` returns a signed upload URL the browser PUTs the file to;
 * `{step: "finish", uploadId, poster}` has the server check and publish it.
 */
export async function POST(request: Request, {params}: {params: {id: string}}) {
    if (!isUuid(params.id)) return NextResponse.json({error: "Guide not found."}, {status: 404, headers: NO_STORE});
    const body = await request.json().catch(() => null) as {step?: unknown; uploadId?: unknown; poster?: unknown} | null;
    if (body?.step === "start") return forward({action: "video_start", listingId: params.id});
    if (body?.step === "finish") {
        if (typeof body.uploadId !== "string" || !isUuid(body.uploadId)) {
            return NextResponse.json({error: "Upload the video first."}, {status: 400, headers: NO_STORE});
        }
        if (typeof body.poster !== "string" || body.poster.length === 0 || body.poster.length > 5_600_000) {
            return NextResponse.json({error: "The video's cover frame is missing."}, {status: 400, headers: NO_STORE});
        }
        return forward({action: "video_finish", listingId: params.id, uploadId: body.uploadId, poster: body.poster});
    }
    return NextResponse.json({error: "Unknown step."}, {status: 400, headers: NO_STORE});
}

/** Removes the promo video. */
export async function DELETE(_request: Request, {params}: {params: {id: string}}) {
    if (!isUuid(params.id)) return NextResponse.json({error: "Guide not found."}, {status: 404, headers: NO_STORE});
    return forward({action: "video_remove", listingId: params.id});
}
