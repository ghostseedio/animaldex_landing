import {NextRequest, NextResponse} from "next/server";
import {requireNamedFinanceAdminActor, resolveAdminActor} from "@/lib/support-admin-auth";
import {
    approveAndExecuteSandboxPayout,
    getPayoutDiagnostics,
    listAdminPayouts,
    refreshPayoutProviderStatus
} from "@/lib/wise-sandbox-payouts";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function rpc(name: string, body: Record<string, unknown> = {}) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase is not configured");
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {
            "Content-Type": "application/json",
            Accept: "application/json"
        }),
        body: JSON.stringify(body),
        cache: "no-store"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = typeof payload?.message === "string" ? payload.message : `${name} failed`;
        throw new Error(message);
    }
    return payload;
}

export async function GET(request: NextRequest) {
    const actor = await resolveAdminActor(request.cookies);
    if (!actor.authorized) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    try {
        const diagnostics = await getPayoutDiagnostics();
        let readiness: unknown = null;
        try {
            readiness = await rpc("admin_list_payout_readiness");
        } catch {
            readiness = null;
        }

        if (diagnostics.isProduction) {
            return NextResponse.json({
                diagnostics: {
                    ...diagnostics,
                    banner: diagnostics.banner || "PRODUCTION — REAL MONEY — WISE"
                },
                payouts: [],
                readiness,
                blocked: true,
                blockedReason:
                    diagnostics.phase7cStopReason ||
                    "Live Wise execution stays gated until funding + Phase 7C gates pass. Readiness board is still visible for ops planning."
            });
        }

        const payouts = await listAdminPayouts();
        return NextResponse.json({diagnostics, payouts, readiness, blocked: false});
    } catch (e) {
        return NextResponse.json({error: e instanceof Error ? e.message : "Failed"}, {status: 400});
    }
}

export async function POST(request: NextRequest) {
    try {
        const actor = await requireNamedFinanceAdminActor(request.cookies);
        const body = await request.json().catch(() => ({}));
        const action = String(body.action ?? "");
        const payoutId = String(body.payoutId ?? "");
        const diagnostics = await getPayoutDiagnostics();

        if (diagnostics.isProduction) {
            return NextResponse.json(
                {
                    error:
                        "production_payout_execution_blocked_until_wise_gbp_funded_and_phase7c_gates_pass",
                    diagnostics
                },
                {status: 403}
            );
        }

        if (action === "approve_execute") {
            if (!payoutId) return NextResponse.json({error: "payoutId required"}, {status: 400});
            const result = await approveAndExecuteSandboxPayout(payoutId, actor);
            return NextResponse.json({ok: true, result});
        }
        if (action === "refresh_status") {
            if (!payoutId) return NextResponse.json({error: "payoutId required"}, {status: 400});
            const result = await refreshPayoutProviderStatus(payoutId, actor);
            return NextResponse.json({ok: true, result});
        }
        return NextResponse.json({error: "Unknown action"}, {status: 400});
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed";
        const status =
            message === "Unauthorized" || message === "named_operator_required_for_finance" ? 403 : 400;
        return NextResponse.json({error: message}, {status});
    }
}
