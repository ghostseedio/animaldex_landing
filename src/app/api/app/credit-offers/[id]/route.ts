import {NextResponse} from "next/server";
import {friendlyCreditOfferError} from "@/lib/credit-offer-errors";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

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

export async function POST(request: Request, {params}: {params: {id: string}}) {
    const {supabase, error} = await getAuthenticatedClient();
    if (error || !supabase) return error;

    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (!["accept", "reject", "cancel"].includes(action)) {
        return NextResponse.json({error: "Invalid action"}, {status: 400});
    }

    const {data, error: rpcError} = await supabase.rpc("resolve_capture_credit_offer", {
        p_credit_offer_id: params.id,
        p_action: action
    });

    if (rpcError) {
        return NextResponse.json({error: friendlyCreditOfferError(rpcError)}, {status: 400});
    }

    const row = Array.isArray(data) ? data[0] as MutationRow | undefined : data as MutationRow | null;

    return NextResponse.json({
        ok: true,
        creditOfferId: row?.credit_offer_id ?? params.id,
        action
    });
}
