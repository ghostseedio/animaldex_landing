import {NextResponse} from "next/server";
import {invokeAuthenticatedSupabaseFunction} from "@/lib/supabase/app-functions";

export async function POST(request: Request, {params}: {params: {id: string}}) {
    const body = await request.json().catch(() => ({})) as {action?: string};
    if (!['accept', 'reject', 'cancel'].includes(body.action ?? "")) return NextResponse.json({error: "Invalid action"}, {status: 400});
    try {
        const result = await invokeAuthenticatedSupabaseFunction("resolve-trade-offer", {p_trade_offer_id: params.id, p_action: body.action});
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Trade failed"}, {status: 400});
    }
}
