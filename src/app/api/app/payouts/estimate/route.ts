import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getSupabaseAuthKey, getSupabaseUrl} from "@/lib/supabase-http";
import {
    loadWiseConfigFromEnv,
    loadWiseProductionConfigFromEnv,
    WisePayoutProvider
} from "@/lib/wise-payout-provider";

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

/** Estimate conversion via Wise quote. Does not write ledger rows. */
export async function POST(request: Request) {
    const supabase = await resolveUserClient(request);
    if (!supabase) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const body = await request.json().catch(() => ({}));
    const sourceCurrency = String(body.sourceCurrency ?? "").toUpperCase();
    const targetCurrency = String(body.targetCurrency ?? "").toUpperCase();
    const sourceAmountMinor = Number(body.sourceAmountMinor ?? 0);

    if (!/^[A-Z]{3}$/.test(sourceCurrency) || !/^[A-Z]{3}$/.test(targetCurrency)) {
        return NextResponse.json({error: "Invalid currency."}, {status: 400});
    }
    if (!(sourceAmountMinor > 0)) {
        return NextResponse.json({error: "Invalid amount."}, {status: 400});
    }

    try {
        const identity = await supabase.rpc("get_animaldex_environment_identity");
        const envRow = (identity.data ?? {}) as Record<string, unknown>;
        const env = String(envRow.environment_label ?? envRow.environmentLabel ?? "").toLowerCase();
        const config = env === "production" ? loadWiseProductionConfigFromEnv() : loadWiseConfigFromEnv();
        if (!config.apiToken || !config.profileId) {
            return NextResponse.json({
                estimateAvailable: false,
                reason: "quote_provider_unavailable",
                sourceCurrency,
                targetCurrency,
                sourceAmountMinor,
                feePolicy: "company_absorbed_beta",
                note: "Final conversion is confirmed when finance processes your payout."
            });
        }

        const provider = new WisePayoutProvider(config);
        const quote = await provider.createQuote({
            profileId: config.profileId,
            sourceCurrency,
            targetCurrency,
            sourceAmount: sourceAmountMinor / 100
        });

        return NextResponse.json({
            estimateAvailable: true,
            sourceCurrency: quote.sourceCurrency,
            targetCurrency: quote.targetCurrency,
            sourceAmountMinor: Math.round(quote.sourceAmount * 100),
            targetAmountMinor: Math.round(quote.targetAmount * 100),
            exchangeRate: quote.rate,
            providerFeeMinor: Math.round(quote.fee * 100),
            feeCurrency: quote.sourceCurrency,
            feePolicy: "company_absorbed_beta",
            providerQuoteRef: quote.providerQuoteRef,
            quoteExpiresAt: quote.expiresAt,
            note: "Estimated conversion. Final Wise rate is confirmed when your payout is processed. Fees are covered by AnimalDex."
        });
    } catch (error) {
        return NextResponse.json(
            {
                estimateAvailable: false,
                reason: error instanceof Error ? error.message : "estimate_failed",
                sourceCurrency,
                targetCurrency,
                sourceAmountMinor,
                feePolicy: "company_absorbed_beta",
                note: "Final conversion is confirmed when finance processes your payout."
            },
            {status: 200}
        );
    }
}
