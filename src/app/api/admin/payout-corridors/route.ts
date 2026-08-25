import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized, requireNamedFinanceAdminActor} from "@/lib/support-admin-auth";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {cookies} from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function rpc(name: string, body: Record<string, unknown> = {}) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase is not configured");
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Accept: "application/json"}),
        body: JSON.stringify(body),
        cache: "no-store"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(typeof payload?.message === "string" ? payload.message : `${name} failed`);
    }
    return payload;
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    try {
        const corridors = await rpc("admin_list_payout_corridors");
        return NextResponse.json({corridors});
    } catch (error) {
        return NextResponse.json(
            {error: error instanceof Error ? error.message : "Failed"},
            {status: 400}
        );
    }
}

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    try {
        await requireNamedFinanceAdminActor(await cookies());
        const body = await request.json().catch(() => ({}));
        const action = String(body.action ?? "update");

        if (action === "probe_requirements") {
            const currency = String(body.currencyCode ?? "").toUpperCase();
            if (!/^[A-Z]{3}$/.test(currency)) {
                return NextResponse.json({error: "currencyCode required"}, {status: 400});
            }
            const {
                loadWiseConfigFromEnv,
                loadWiseProductionConfigFromEnv,
                WisePayoutProvider
            } = await import("@/lib/wise-payout-provider");
            const {getPayoutDiagnostics} = await import("@/lib/wise-sandbox-payouts");
            const diagnostics = await getPayoutDiagnostics();
            const config = diagnostics.isProduction
                ? loadWiseProductionConfigFromEnv()
                : loadWiseConfigFromEnv();
            if (!config.apiToken || !config.profileId) {
                return NextResponse.json({error: "Wise credentials not configured"}, {status: 400});
            }
            const provider = new WisePayoutProvider(config);
            const sourceCurrency = String(body.sourceCurrency ?? "GBP").toUpperCase();
            const wiseReqs = await provider.getAccountRequirements({
                sourceCurrency,
                targetCurrency: currency,
                sourceAmount: 100
            });
            return NextResponse.json({
                ok: true,
                sourceCurrency,
                targetCurrency: currency,
                requirements: wiseReqs,
                checklistHint:
                    "Confirm types match seeded recipient_type, create a test recipient, quote, then Mark tested + enable."
            });
        }

        const result = await rpc("admin_update_payout_corridor", {
            p_corridor_id: body.corridorId,
            p_enabled_for_setup: body.enabledForSetup ?? null,
            p_enabled_for_requests: body.enabledForRequests ?? null,
            p_status: body.status ?? null,
            p_minimum_payout_amount_minor: body.minimumPayoutAmountMinor ?? null,
            p_enhanced_review_amount_minor: body.enhancedReviewAmountMinor ?? null,
            p_tested_at: body.testedAt ?? null,
            p_blocker_reason: body.blockerReason === null ? "" : (body.blockerReason ?? null),
            p_actor_operator_id: null
        });
        return NextResponse.json({corridor: result});
    } catch (error) {
        return NextResponse.json(
            {error: error instanceof Error ? error.message : "Failed"},
            {status: 400}
        );
    }
}
