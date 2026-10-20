import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {isUuid} from "@/lib/virtual-wildlife-guides";

export const dynamic = "force-dynamic";

const NO_STORE = {"Cache-Control": "private, no-store"};

/**
 * Ask for a refund. The first no-questions refund in 90 days is immediate
 * (Credits back, or a card refund queued for /api/cron/wildlife-guide-refunds);
 * after that the request goes to review.
 */
export async function POST(request: Request, {params}: {params: {id: string}}) {
    if (!isUuid(params.id)) return NextResponse.json({error: "Guide not found."}, {status: 404, headers: NO_STORE});
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503, headers: NO_STORE});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Sign in to ask for a refund."}, {status: 401, headers: NO_STORE});

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const purchaseId = typeof body.purchaseId === "string" ? body.purchaseId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    if (!isUuid(purchaseId)) return NextResponse.json({error: "Purchase not found."}, {status: 400, headers: NO_STORE});

    const {data, error} = await supabase.rpc("request_wildlife_guide_refund", {p_purchase_id: purchaseId, p_note: note || null});
    if (error) {
        if (/refund_window_closed/.test(error.message)) {
            return NextResponse.json({error: "Refunds for this guide are closed."}, {status: 409, headers: NO_STORE});
        }
        if (/purchase_not_found/.test(error.message)) return NextResponse.json({error: "Purchase not found."}, {status: 404, headers: NO_STORE});
        return NextResponse.json({error: "The refund could not be requested. Try again."}, {status: 400, headers: NO_STORE});
    }
    return NextResponse.json({guide: data}, {headers: NO_STORE});
}
