import {NextResponse} from "next/server";
import {friendlyCreditOfferError} from "@/lib/credit-offer-errors";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 5000;
const OUTBOUND_LIMIT = 5;

type MutationRow = {
    credit_offer_id?: string;
};

async function getAuthenticatedClient() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return {supabase: null, error: NextResponse.json({error: "Supabase is not configured."}, {status: 503})};

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return {supabase: null, error: NextResponse.json({error: "Authentication required."}, {status: 401})};

    return {supabase, error: null};
}

export async function POST(request: Request) {
    const {supabase, error} = await getAuthenticatedClient();
    if (error || !supabase) return error;

    const body = await request.json().catch(() => ({}));
    const targetCaptureId = String(body.targetCaptureId ?? "").trim();
    const amount = Math.trunc(Number(body.amount ?? 0));

    if (!targetCaptureId) {
        return NextResponse.json({error: "Choose an animal to offer on."}, {status: 400});
    }

    if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
        return NextResponse.json({error: "Credit offers must stay between 1 and 5000 credits."}, {status: 400});
    }

    const {data, error: rpcError} = await supabase.rpc("create_capture_credit_offer", {
        p_target_capture_id: targetCaptureId,
        p_amount: amount,
        p_outbound_limit: OUTBOUND_LIMIT
    });

    if (rpcError) {
        return NextResponse.json({error: friendlyCreditOfferError(rpcError)}, {status: 400});
    }

    const row = Array.isArray(data) ? data[0] as MutationRow | undefined : data as MutationRow | null;

    return NextResponse.json({
        ok: true,
        creditOfferId: row?.credit_offer_id ?? null,
        amount
    });
}
