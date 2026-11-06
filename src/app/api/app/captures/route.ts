import {randomUUID} from "crypto";
import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import {verifyWebCaptureSession} from "@/lib/supabase/web-capture-session";
import {classifyCaptureFailure} from "@/lib/capture-failure";

export const runtime = "nodejs";

/** The apps' CaptureRules.version; a library upload needs this agreed first. */
const CAPTURE_RULES_VERSION = 1;

/** The claims a library photo's file made about itself, as the apps send them (never evidence). */
const CAMERA_ROLL_CLAIM_KEYS = ["taken_at", "camera_make", "camera_model", "software", "had_embedded_location"] as const;

function cameraRollClaims(raw: FormDataEntryValue | null): Record<string, string> {
    if (typeof raw !== "string" || !raw) return {};
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const claims: Record<string, string> = {};
        for (const key of CAMERA_ROLL_CLAIM_KEYS) {
            const value = parsed?.[key];
            if (typeof value === "string" && value.length <= 80) claims[key] = value;
        }
        return claims;
    } catch {
        return {};
    }
}

/**
 * A failure as the capture screen reads it: a code from the one failure
 * vocabulary (`lib/capture-failure`), never the text a server, a provider or
 * Postgres produced. `captureId` and `uploaded` say what a Retry can reuse.
 */
function failure(code: string, status: number, extra: Record<string, unknown> = {}) {
    return NextResponse.json({error: code, failure_code: code, ...extra}, {status});
}

/** A request turned away before anything was created; the screen says why in the reader's words. */
function refusal(code: string, status = 400) {
    return NextResponse.json({error: code, refusal: code}, {status});
}

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return failure("server_error", 503);
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return failure("authentication_required", 401);

    const form = await request.formData();
    const file = form.get("image");
    const captureToken = String(form.get("captureToken") ?? "");
    const captureSource = String(form.get("captureSource") ?? "");
    // Two ways in. A live frame carries the shutter-time token, signed with
    // the server's clock: that is what proves freshness. (A second check
    // against the phone's clock rejected anyone who read the review for half
    // a minute, and added nothing.) A camera-roll photo (the chat's "+",
    // 2026-11-06) carries no token; it is marked as a library upload below,
    // which only ever makes the server stricter, and needs the capture rules
    // agreed, as in the apps.
    const isLibrary = captureSource === "camera_roll";
    if (!isLibrary && (!verifyWebCaptureSession(captureToken, user.id) || captureSource !== "live_camera")) {
        return refusal("capture_session_expired");
    }
    if (!(file instanceof File) || file.type !== "image/jpeg") return refusal("jpeg_required");
    if (file.size > 12 * 1024 * 1024) return failure("media_too_large", 413);

    if (isLibrary) {
        const {data: rulesVersion, error: rulesError} = await supabase.rpc("my_capture_rules_version");
        if (rulesError) return failure("server_error", 502);
        if ((typeof rulesVersion === "number" ? rulesVersion : 0) < CAPTURE_RULES_VERSION) {
            return NextResponse.json({error: "capture_rules_not_accepted", message: "Agree to the capture rules before uploading from your camera roll."}, {status: 403});
        }
    }

    const captureId = randomUUID();
    const latitudeValue = form.get("latitude");
    const longitudeValue = form.get("longitude");
    const latitude = typeof latitudeValue === "string" ? Number(latitudeValue) : NaN;
    const longitude = typeof longitudeValue === "string" ? Number(longitudeValue) : NaN;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return refusal(isLibrary ? "place_required" : "location_required");
    }
    // The capture row, its media and its status are created through the
    // capture-authority RPCs rather than written here. This route runs as the
    // signed-in person, not the service role, so before the RPCs existed it
    // could set user_id, status and analysis_credit_cost directly, the same
    // authority a tampered mobile client had. The server now decides all three.
    const {data: createdId, error: insertError} = await supabase.rpc("create_capture_v1", {
        p_capture_mode: "photo",
        p_client_capture_id: captureId,
        p_location_lat: latitude,
        p_location_lng: longitude
    });
    if (insertError || typeof createdId !== "string") {
        return failure(classifyCaptureFailure({errorCode: insertError?.code, message: insertError?.message}), 400);
    }
    const serverCaptureId: string = createdId;
    // Once the photo is attached a Retry re-runs the analysis on this
    // capture; before that it sends the photo again.
    let uploaded = false;

    try {
        if (isLibrary) {
            // Before upload and analysis, so the server screens it as a
            // library photo from the first pass (the apps do the same).
            const {error: markError} = await supabase.rpc("mark_capture_camera_roll_v1", {
                p_capture_id: serverCaptureId,
                p_metadata: cameraRollClaims(form.get("cameraRollMetadata"))
            });
            if (markError) throw markError;
        }
        await supabase.from("captures").update({status: "uploading"}).eq("id", serverCaptureId);
        const bytes = Buffer.from(await file.arrayBuffer());
        const path = `${user.id.toLowerCase()}/${serverCaptureId.toLowerCase()}/primary.jpg`;
        const {error: uploadError} = await supabase.storage.from("captures").upload(path, bytes, {contentType: file.type || "image/jpeg", cacheControl: "3600", upsert: true});
        if (uploadError) throw uploadError;
        const {error: imageError} = await supabase.rpc("attach_capture_image_v1", {
            p_capture_id: serverCaptureId,
            p_storage_bucket: "captures",
            p_storage_path: path,
            p_mime_type: file.type || "image/jpeg",
            p_byte_size: file.size,
            p_media_kind: "photo",
            p_sort_order: 0
        });
        if (imageError) throw imageError;
        uploaded = true;
        const {data: finalized, error: finalizeError} = await supabase.rpc("finalize_capture_upload", {p_capture_id: serverCaptureId});
        if (finalizeError) throw finalizeError;
        const finalizeRow = Array.isArray(finalized) ? finalized[0] : finalized;
        if (!finalizeRow?.ok) {
            throw new Error(String(finalizeRow?.error ?? "source_media_unavailable"));
        }
        const analysis = await invokeAuthenticatedSupabaseFunctionResponse("analyze-capture", {capture_id: serverCaptureId, identity_correction_requested: false});
        if (analysis.status === 402) {
            // Not a failure: the capture is saved and waits for credits, and
            // resumes by itself once the wallet covers it.
            return NextResponse.json({
                error: "insufficient_credits",
                captureId: serverCaptureId,
                title: analysis.payload?.title ?? "Not enough credits",
                message: analysis.payload?.message ?? "This capture is saved. Add credits to continue analysing it.",
                balance: typeof analysis.payload?.balance === "number" ? analysis.payload.balance : null,
                creditCost: typeof analysis.payload?.credit_cost === "number" ? analysis.payload.credit_cost : null
            }, {status: 402});
        }
        if (!analysis.ok) {
            const code = classifyCaptureFailure({
                errorCode: analysis.payload?.failure_code ?? analysis.payload?.error,
                httpStatus: analysis.status,
                message: analysis.payload?.message
            });
            return failure(code, analysis.status >= 400 ? analysis.status : 400, {captureId: serverCaptureId, uploaded});
        }
        return NextResponse.json({captureId: serverCaptureId}, {status: 202});
    } catch (error) {
        // 'failed' is a pipeline-owned state and is deliberately not written
        // from here. A capture abandoned mid-upload stays 'pending' and is
        // reclaimed by the capture_pipeline_heal cron, which is the component
        // that actually knows whether the work can still succeed.
        const caught = error as {code?: string; message?: string} | null;
        const code = classifyCaptureFailure({errorCode: caught?.code, message: caught?.message ?? (error instanceof Error ? error.message : null)});
        return failure(code, 400, {captureId: serverCaptureId, uploaded});
    }
}
