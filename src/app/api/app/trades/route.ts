import {NextResponse} from "next/server";
import {invokeAuthenticatedSupabaseFunction} from "@/lib/supabase/app-functions";

export async function POST(request: Request) {
    const body = await request.json().catch(() => ({})) as {offererCaptureId?: string; receiverCaptureId?: string};
    if (!body.offererCaptureId || !body.receiverCaptureId) return NextResponse.json({error: "Choose both animals."}, {status: 400});
    try {
        const result = await invokeAuthenticatedSupabaseFunction("create-trade-offer", {p_offerer_capture_id: body.offererCaptureId, p_receiver_capture_id: body.receiverCaptureId, p_offerer_trade_value: null, p_receiver_trade_value: null});
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Could not create trade."}, {status: 400});
    }
}
