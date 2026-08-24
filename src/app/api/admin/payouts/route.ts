import {NextRequest, NextResponse} from "next/server";
import {requireNamedFinanceAdminActor, resolveAdminActor} from "@/lib/support-admin-auth";
import {
    approveAndExecuteSandboxPayout,
    getPayoutDiagnostics,
    listAdminPayouts,
    refreshPayoutProviderStatus
} from "@/lib/wise-sandbox-payouts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
    const actor = await resolveAdminActor(request.cookies);
    if (!actor.authorized) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    try {
        const diagnostics = await getPayoutDiagnostics();
        if (diagnostics.isProduction) {
            return NextResponse.json({
                diagnostics: {
                    ...diagnostics,
                    banner: "PRODUCTION · PAYOUTS DISABLED · NO WISE EXECUTION"
                },
                payouts: [],
                blocked: true
            });
        }
        const payouts = await listAdminPayouts();
        return NextResponse.json({diagnostics, payouts, blocked: false});
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
