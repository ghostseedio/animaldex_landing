import {NextRequest, NextResponse} from "next/server";
import {requireNamedFinanceAdminActor, resolveAdminActor} from "@/lib/support-admin-auth";
import {
    approveAndExecuteSandboxPayout,
    approvePayoutForManualPayment,
    confirmManualPayoutPaid,
    getPayoutDiagnostics,
    listAdminPayouts,
    recordManualWiseTransfer,
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

const MANUAL_ACTIONS = new Set([
    "approve_manual",
    "record_wise_transfer",
    "confirm_paid"
]);

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
        try {
            const howTo = await rpc("admin_list_payout_readiness_how_to_pay");
            if (readiness && typeof readiness === "object" && Array.isArray(howTo)) {
                (readiness as Record<string, unknown>).how_to_pay = howTo;
            }
        } catch {
            // optional helper until migration applied
        }

        const payouts = await listAdminPayouts();
        const autoExecuteBlocked = diagnostics.isProduction;

        return NextResponse.json({
            diagnostics: {
                ...diagnostics,
                banner: diagnostics.isProduction
                    ? diagnostics.banner || "PRODUCTION — REAL MONEY — MANUAL WISE"
                    : diagnostics.banner
            },
            payouts,
            readiness,
            blocked: false,
            autoExecuteBlocked,
            blockedReason: autoExecuteBlocked
                ? "Sandbox Approve & execute stays gated on production. Use Approve → Record Wise → Confirm Paid."
                : null
        });
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

        if (!payoutId && action !== "") {
            return NextResponse.json({error: "payoutId required"}, {status: 400});
        }

        if (MANUAL_ACTIONS.has(action)) {
            if (action === "approve_manual") {
                const result = await approvePayoutForManualPayment(payoutId, actor);
                return NextResponse.json({ok: true, result});
            }
            if (action === "record_wise_transfer") {
                const result = await recordManualWiseTransfer(payoutId, actor, {
                    providerTransferRef: String(body.providerTransferRef ?? ""),
                    quoteSourceCurrency: String(body.quoteSourceCurrency ?? ""),
                    quoteTargetCurrency: String(body.quoteTargetCurrency ?? ""),
                    quoteSourceAmountMinor: Number(body.quoteSourceAmountMinor ?? 0),
                    quoteTargetAmountMinor: Number(body.quoteTargetAmountMinor ?? 0),
                    quoteFeeAmountMinor: Number(body.quoteFeeAmountMinor ?? 0),
                    quoteRate: Number(body.quoteRate ?? 0),
                    providerStatus: body.providerStatus ? String(body.providerStatus) : undefined
                });
                return NextResponse.json({ok: true, result});
            }
            if (action === "confirm_paid") {
                const result = await confirmManualPayoutPaid(payoutId, actor);
                return NextResponse.json({ok: true, result});
            }
        }

        if (diagnostics.isProduction) {
            return NextResponse.json(
                {
                    error:
                        "production_auto_execute_blocked — use approve_manual → record_wise_transfer → confirm_paid",
                    diagnostics
                },
                {status: 403}
            );
        }

        if (action === "approve_execute") {
            const result = await approveAndExecuteSandboxPayout(payoutId, actor);
            return NextResponse.json({ok: true, result});
        }
        if (action === "refresh_status") {
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
