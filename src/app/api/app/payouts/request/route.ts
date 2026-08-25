import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getSupabaseAuthKey, getSupabaseUrl} from "@/lib/supabase-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveUserClient(request: Request): Promise<SupabaseClient | null> {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (bearer) {
        const url = getSupabaseUrl();
        const key = getSupabaseAuthKey();
        if (!url || !key) return null;
        const supabase = createClient(url, key, {
            global: {headers: {Authorization: `Bearer ${bearer}`}},
            auth: {persistSession: false, autoRefreshToken: false}
        });
        const {data, error} = await supabase.auth.getUser(bearer);
        if (error || !data.user) return null;
        return supabase;
    }
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {data} = await supabase.auth.getUser();
    return data.user ? supabase : null;
}

/** User payout request: Available → Held. Manual finance pays later. */
export async function POST(request: Request) {
    const supabase = await resolveUserClient(request);
    if (!supabase) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const body = await request.json().catch(() => ({}));
    const currencyCode = String(body.currencyCode ?? "").toUpperCase();
    const amountMinor = Number(body.amountMinor ?? 0);
    const idempotencyKey = String(body.idempotencyKey ?? "").trim();

    if (!/^[A-Z]{3}$/.test(currencyCode) || !(amountMinor > 0) || !idempotencyKey) {
        return NextResponse.json({error: "currencyCode, amountMinor, and idempotencyKey are required."}, {status: 400});
    }

    const {data, error} = await supabase.rpc("request_my_payout", {
        p_currency_code: currencyCode,
        p_amount_minor: amountMinor,
        p_idempotency_key: idempotencyKey,
        p_estimate_target_amount_minor:
            body.estimateTargetAmountMinor == null ? null : Number(body.estimateTargetAmountMinor),
        p_estimate_exchange_rate: body.estimateExchangeRate == null ? null : Number(body.estimateExchangeRate),
        p_estimate_provider_fee_minor:
            body.estimateProviderFeeMinor == null ? null : Number(body.estimateProviderFeeMinor)
    });

    if (error) {
        return NextResponse.json({error: error.message}, {status: 400});
    }
    return NextResponse.json(data);
}
