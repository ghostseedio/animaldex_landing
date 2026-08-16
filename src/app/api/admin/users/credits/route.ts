import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Grant credits to one member.
 *
 * Runs through credit_balance_grant, the same routine missions and referrals use,
 * so the balance and the ledger move together and the grant carries a reason.
 * Its idempotency key is generated per grant rather than derived from the amount:
 * an operator granting 5 twice means two grants, not a no-op.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_GRANT = 500;

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) {
        return NextResponse.json({ok: false, error: "Supabase access is not configured"}, {status: 500});
    }

    const body = await request.json().catch(() => ({})) as {userId?: string; amount?: number; note?: string};
    const userId = body.userId?.trim() ?? "";
    const amount = Math.round(Number(body.amount));
    const note = body.note?.trim().slice(0, 200) ?? "";

    if (!UUID.test(userId)) {
        return NextResponse.json({ok: false, error: "A member is required"}, {status: 400});
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ok: false, error: "Grant a positive number of credits"}, {status: 400});
    }
    if (amount > MAX_GRANT) {
        return NextResponse.json({
            ok: false,
            error: `That is more than the ${MAX_GRANT} credit cap for a single grant`
        }, {status: 400});
    }

    try {
        const response = await fetch(`${url}/rest/v1/rpc/credit_balance_grant`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            cache: "no-store",
            body: JSON.stringify({
                p_user_id: userId,
                p_delta: amount,
                p_idempotency_key: `admin_grant:${userId}:${Date.now()}`,
                p_action: "admin_grant",
                p_metadata: {source: "admin_panel", note: note || null}
            })
        });

        const result = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(typeof result?.message === "string" ? result.message : `Grant failed (${response.status})`);
        }

        // The routine returns the balance it left behind.
        const balance = Number(result);

        return NextResponse.json({
            ok: true,
            userId,
            granted: amount,
            balance: Number.isFinite(balance) ? balance : null
        });
    } catch (error) {
        console.error("[admin-user-credits]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Grant failed"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
