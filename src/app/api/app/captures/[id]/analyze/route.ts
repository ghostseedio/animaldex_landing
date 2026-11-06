import {NextResponse} from "next/server";
import {classifyCaptureFailure} from "@/lib/capture-failure";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Runs the analysis again on one of the viewer's own captures, through the
 * same `analyze-capture` edge function the apps call: the capture screen's
 * Retry, and the card's Re-analyze (iOS `reanalyzeCapture`, with "Animal
 * label is wrong" as `identity_correction_requested`). Re-analysis is free:
 * the server bills a capture once, never per run.
 *
 * POST {identityCorrectionRequested?: boolean} → 202, or a failure code.
 */
export async function POST(request: Request, {params}: {params: {id: string}}) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "server_error", failure_code: "server_error"}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "authentication_required", failure_code: "authentication_required"}, {status: 401});

    const captureId = params.id?.trim();
    const {data: capture} = await supabase.from("captures").select("id").eq("id", captureId).eq("user_id", user.id).maybeSingle();
    if (!capture) return NextResponse.json({error: "media_missing", failure_code: "media_missing"}, {status: 404});

    const body = await request.json().catch(() => ({}));
    const identityCorrectionRequested = body?.identityCorrectionRequested === true;
    try {
        const analysis = await invokeAuthenticatedSupabaseFunctionResponse("analyze-capture", {
            capture_id: capture.id,
            identity_correction_requested: identityCorrectionRequested
        });
        if (analysis.status === 402) {
            return NextResponse.json({
                error: "insufficient_credits",
                failure_code: "insufficient_credits",
                captureId: capture.id,
                balance: typeof analysis.payload?.balance === "number" ? analysis.payload.balance : null
            }, {status: 402});
        }
        if (!analysis.ok) {
            const code = classifyCaptureFailure({
                errorCode: analysis.payload?.failure_code ?? analysis.payload?.error,
                httpStatus: analysis.status,
                message: analysis.payload?.message
            });
            return NextResponse.json({error: code, failure_code: code, captureId: capture.id}, {status: analysis.status >= 400 ? analysis.status : 400});
        }
        return NextResponse.json({captureId: capture.id}, {status: 202});
    } catch (error) {
        const code = classifyCaptureFailure({message: error instanceof Error ? error.message : null});
        return NextResponse.json({error: code, failure_code: code, captureId: capture.id}, {status: 400});
    }
}
