import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

/**
 * Delete Card, as iOS does it: the `delete_own_capture` RPC as the signed-in
 * person, which refuses a card someone else owns or one locked in a sealed
 * pack or a pending trade. The refusal comes back as a code the card words.
 */
function refusalCode(message: string) {
    const lowered = message.toLowerCase();
    if (lowered.includes("capture_locked_by_sealed_pack") || lowered.includes("foreign key") || lowered.includes("23503")) return "locked_by_sealed_pack";
    if (lowered.includes("capture_locked_by_trade")) return "locked_by_trade";
    if (lowered.includes("capture_not_owned")) return "not_owned";
    if (lowered.includes("not_authenticated")) return "not_authenticated";
    return "failed";
}

export async function POST(_: Request, {params}: {params: {id: string}}) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "failed"}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "not_authenticated"}, {status: 401});
    const captureId = params.id?.trim();
    if (!captureId) return NextResponse.json({error: "failed"}, {status: 400});
    const {error} = await supabase.rpc("delete_own_capture", {p_capture_id: captureId});
    if (error) return NextResponse.json({error: refusalCode(error.message ?? "")}, {status: 400});
    return NextResponse.json({ok: true});
}
