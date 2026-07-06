import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export async function GET(_: Request, {params}: {params: {id: string}}) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Not configured"}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const {data: capture} = await supabase.from("captures").select("id,status").eq("id", params.id).eq("user_id", user.id).maybeSingle();
    if (!capture) return NextResponse.json({error: "Capture not found"}, {status: 404});
    const {data: analysis} = await supabase.from("analysis_results").select("animal_name,scientific_name,normalized_identity_key,confidence,error_message,completed_at").eq("capture_id", params.id).maybeSingle();
    return NextResponse.json({status: capture.status, analysis: analysis ?? null});
}
