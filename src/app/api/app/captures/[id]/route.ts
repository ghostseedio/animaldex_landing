import {NextResponse} from "next/server";
import {classifyCaptureFailure} from "@/lib/capture-failure";
import {createSupabaseServerClient} from "@/lib/supabase/server";

/**
 * The capture screen's poll: where the capture is, and when it failed, the
 * failure as a code (`lib/capture-failure`). The analysis row's own error
 * text stays on the server: it can hold provider or Postgres wording.
 */
export async function GET(_: Request, {params}: {params: {id: string}}) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "server_error"}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "authentication_required"}, {status: 401});
    const {data: capture} = await supabase.from("captures").select("id,status").eq("id", params.id).eq("user_id", user.id).maybeSingle();
    if (!capture) return NextResponse.json({error: "capture_not_found"}, {status: 404});
    const {data: analysis} = await supabase.from("analysis_results").select("animal_name,scientific_name,normalized_identity_key,confidence,error_message,completed_at").eq("capture_id", params.id).maybeSingle();
    const errorText = typeof analysis?.error_message === "string" ? analysis.error_message.trim() : "";
    const failed = Boolean(errorText) || capture.status === "failed";
    const failureCode = failed ? classifyCaptureFailure({errorCode: errorText || null, message: errorText || null}) : null;
    return NextResponse.json({
        status: capture.status,
        failure_code: failureCode,
        analysis: analysis ? {
            animal_name: analysis.animal_name,
            scientific_name: analysis.scientific_name,
            normalized_identity_key: analysis.normalized_identity_key,
            confidence: analysis.confidence,
            completed_at: analysis.completed_at,
            failed
        } : null
    });
}
