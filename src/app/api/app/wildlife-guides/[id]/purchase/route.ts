import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {isUuid} from "@/lib/virtual-wildlife-guides";

export const dynamic = "force-dynamic";

const NO_STORE = {"Cache-Control": "private, no-store"};

/** Buy a guide with Credits. One idempotency key per guide page: a retried tap never charges twice. */
export async function POST(request: Request, {params}: {params: {id: string}}) {
    if (!isUuid(params.id)) return NextResponse.json({error: "Guide not found."}, {status: 404, headers: NO_STORE});
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503, headers: NO_STORE});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Sign in to buy with Credits.", code: "auth_required"}, {status: 401, headers: NO_STORE});

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const key = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    if (key.length < 8 || key.length > 200) return NextResponse.json({error: "Try again."}, {status: 400, headers: NO_STORE});

    const {data, error} = await supabase.rpc("purchase_wildlife_guide_with_credits", {p_listing_id: params.id, p_idempotency_key: key});
    if (error) {
        const message = error.message || "";
        if (/insufficient_credits/i.test(message)) {
            return NextResponse.json({error: "You don't have enough Credits for this guide.", code: "insufficient_credits"}, {status: 402, headers: NO_STORE});
        }
        if (/own_guide/.test(message)) return NextResponse.json({error: "This is your own guide.", code: "own_guide"}, {status: 400, headers: NO_STORE});
        if (/guide_not_for_sale/.test(message)) return NextResponse.json({error: "This guide is not for sale right now.", code: "not_for_sale"}, {status: 409, headers: NO_STORE});
        return NextResponse.json({error: "The guide could not be bought. Try again."}, {status: 400, headers: NO_STORE});
    }
    return NextResponse.json({guide: data}, {headers: NO_STORE});
}
