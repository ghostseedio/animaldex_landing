import {randomUUID} from "crypto";
import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {invokeAuthenticatedSupabaseFunction} from "@/lib/supabase/app-functions";
import {verifyWebCaptureSession} from "@/lib/supabase/web-capture-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const form = await request.formData();
    const file = form.get("image");
    const captureToken = String(form.get("captureToken") ?? "");
    const captureSource = String(form.get("captureSource") ?? "");
    const capturedAt = Number(form.get("capturedAt"));
    if (!verifyWebCaptureSession(captureToken, user.id) || captureSource !== "live_camera" || !Number.isFinite(capturedAt) || Math.abs(Date.now() - capturedAt) > 30_000) {
        return NextResponse.json({error: "A fresh live camera capture is required."}, {status: 400});
    }
    if (!(file instanceof File) || file.type !== "image/jpeg") return NextResponse.json({error: "Live camera output must be a JPEG image."}, {status: 400});
    if (file.size > 12 * 1024 * 1024) return NextResponse.json({error: "Images must be smaller than 12 MB."}, {status: 413});

    const captureId = randomUUID();
    const latitudeValue = form.get("latitude");
    const longitudeValue = form.get("longitude");
    const latitude = typeof latitudeValue === "string" ? Number(latitudeValue) : NaN;
    const longitude = typeof longitudeValue === "string" ? Number(longitudeValue) : NaN;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return NextResponse.json({error: "Location permission is required for live scans."}, {status: 400});
    }
    // The capture row, its media and its status are created through the
    // capture-authority RPCs rather than written here. This route runs as the
    // signed-in person, not the service role, so before the RPCs existed it
    // could set user_id, status and analysis_credit_cost directly — the same
    // authority a tampered mobile client had. The server now decides all three.
    const {data: createdId, error: insertError} = await supabase.rpc("create_capture_v1", {
        p_capture_mode: "photo",
        p_client_capture_id: captureId,
        p_location_lat: latitude,
        p_location_lng: longitude
    });
    if (insertError || typeof createdId !== "string") {
        return NextResponse.json({error: insertError?.message ?? "The capture could not be created."}, {status: 400});
    }
    const serverCaptureId: string = createdId;

    try {
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
        const {data: finalized, error: finalizeError} = await supabase.rpc("finalize_capture_upload", {p_capture_id: serverCaptureId});
        if (finalizeError) throw finalizeError;
        const finalizeRow = Array.isArray(finalized) ? finalized[0] : finalized;
        if (!finalizeRow?.ok) {
            throw new Error(String(finalizeRow?.error ?? "source_media_unavailable"));
        }
        await invokeAuthenticatedSupabaseFunction("analyze-capture", {capture_id: serverCaptureId, identity_correction_requested: false});
        return NextResponse.json({captureId: serverCaptureId}, {status: 202});
    } catch (error) {
        // 'failed' is a pipeline-owned state and is deliberately not written
        // from here. A capture abandoned mid-upload stays 'pending' and is
        // reclaimed by the capture_pipeline_heal cron, which is the component
        // that actually knows whether the work can still succeed.
        return NextResponse.json({error: error instanceof Error ? error.message : "Capture analysis failed."}, {status: 400});
    }
}
