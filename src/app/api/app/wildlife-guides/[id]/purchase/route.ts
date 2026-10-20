import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {isUuid} from "@/lib/virtual-wildlife-guides";

export const dynamic = "force-dynamic";

const NO_STORE = {"Cache-Control": "private, no-store"};

/**
 * Buy a guide with Credits. One idempotency key per guide page: a retried tap
 * never charges twice. buyerTermsVersion is the Wildlife Guide Buyer Terms
 * version the buyer ticked; the database refuses the purchase without it.
 */
export async function POST(request: Request, {params}: {params: {id: string}}) {
    if (!isUuid(params.id)) return NextResponse.json({error: "Guide not found."}, {status: 404, headers: NO_STORE});
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503, headers: NO_STORE});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Sign in to buy with Credits.", code: "auth_required"}, {status: 401, headers: NO_STORE});

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const key = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    if (key.length < 8 || key.length > 200) return NextResponse.json({error: "Try again."}, {status: 400, headers: NO_STORE});
    const buyerTermsVersion = typeof body.buyerTermsVersion === "string" ? body.buyerTermsVersion.trim().slice(0, 80) : "";
    if (!buyerTermsVersion) {
        return NextResponse.json({error: "Agree to the Buyer Terms to buy this guide.", code: "buyer_terms_required"}, {status: 400, headers: NO_STORE});
    }

    const {data, error} = await supabase.rpc("purchase_wildlife_guide_with_credits", {
        p_listing_id: params.id,
        p_idempotency_key: key,
        p_buyer_terms_version: buyerTermsVersion
    });
    if (error) {
        const message = error.message || "";
        if (/insufficient_credits/i.test(message)) {
            return NextResponse.json({error: "You don't have enough Credits for this guide.", code: "insufficient_credits"}, {status: 402, headers: NO_STORE});
        }
        if (/buyer_terms_required/.test(message)) {
            return NextResponse.json({error: "The Buyer Terms were updated. Reload the page to read and agree to them.", code: "buyer_terms_required"}, {status: 409, headers: NO_STORE});
        }
        if (/own_guide/.test(message)) return NextResponse.json({error: "This is your own guide.", code: "own_guide"}, {status: 400, headers: NO_STORE});
        if (/guide_not_for_sale/.test(message)) return NextResponse.json({error: "This guide is not for sale right now.", code: "not_for_sale"}, {status: 409, headers: NO_STORE});
        return NextResponse.json({error: "The guide could not be bought. Try again."}, {status: 400, headers: NO_STORE});
    }
    return NextResponse.json({guide: data}, {headers: NO_STORE});
}
