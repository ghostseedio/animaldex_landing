import {NextResponse} from "next/server";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import {isUuid} from "@/lib/virtual-wildlife-guides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {"Cache-Control": "private, no-store"};
// The browser downsizes to 2048 px JPEG first; base64 of the function's 4 MB cap.
const MAX_BASE64 = 5_600_000;

function failureFor(status: number, payload: {error?: string} | null) {
    const code = payload?.error ?? "";
    if (status === 401) return {status, error: "Sign in to edit your guides."};
    if (code === "upload_daily_limit") return {status, error: "You've added a lot of photos today. Try again tomorrow."};
    if (code === "upload_limit") return {status, error: "This guide has as many photos as it can hold. Remove one to add another."};
    if (code === "image_too_large") return {status, error: "That photo is too large. Try a smaller one."};
    if (code === "jpeg_required") return {status, error: "Use a JPEG or PNG photo."};
    if (status === 503) return {status, error: "Photos can't be checked right now. Try again in a few minutes."};
    return {status: status >= 400 ? status : 502, error: "The photo didn't upload. Try again."};
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
            {error: signedOut ? "Sign in to edit your guides." : "The photo didn't upload. Try again."},
            {status: signedOut ? 401 : 503, headers: NO_STORE}
        );
    }
}

/**
 * Adds an author's photo (or banner) to a guide through the
 * `wildlife-guide-upload` edge function, which screens it before keeping it.
 * Answers { guide } or { removed: true, message } when the photo fails the check.
 */
export async function POST(request: Request, {params}: {params: {id: string}}) {
    if (!isUuid(params.id)) return NextResponse.json({error: "Guide not found."}, {status: 404, headers: NO_STORE});
    const body = await request.json().catch(() => null) as {image?: unknown; asBanner?: unknown} | null;
    if (typeof body?.image !== "string" || body.image.length === 0 || body.image.length > MAX_BASE64) {
        return NextResponse.json({error: "That photo is too large. Try a smaller one."}, {status: 413, headers: NO_STORE});
    }
    return forward({action: "upload", listingId: params.id, image: body.image, asBanner: body.asBanner === true});
}

/** Removes one of the author's uploaded photos. */
export async function DELETE(request: Request, {params}: {params: {id: string}}) {
    if (!isUuid(params.id)) return NextResponse.json({error: "Guide not found."}, {status: 404, headers: NO_STORE});
    const body = await request.json().catch(() => null) as {mediaId?: unknown} | null;
    if (typeof body?.mediaId !== "string" || !isUuid(body.mediaId)) {
        return NextResponse.json({error: "Unknown photo."}, {status: 400, headers: NO_STORE});
    }
    return forward({action: "remove", listingId: params.id, mediaId: body.mediaId});
}
