import {timingSafeEqual} from "crypto";
import {NextRequest, NextResponse} from "next/server";
import {paddleApiRequest} from "@/lib/paddle-server";
import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {refundReasonText} from "@/lib/wildlife-guide-refunds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends the card refunds the database has queued for Wildlife Guides (the
 * author did not reply within 48 hours, the buyer asked within 7 days, or a
 * duplicate purchase) to Paddle as full refunds, and marks each one sent.
 * Paddle's adjustment webhook then confirms it.
 *
 * Run every 10 minutes from the VM: see docs/wildlife-guide-refunds.md.
 * Authorised by `Authorization: Bearer $CRON_SECRET`.
 */

type DueRow = {id: string; paddle_transaction_id: string; refund_reason: string | null};
type Adjustment = {id?: string; action?: string; status?: string};

function authorized(request: NextRequest) {
    const secret = process.env.CRON_SECRET?.trim();
    const header = request.headers.get("authorization")?.trim() ?? "";
    if (!secret) return false;
    const expected = Buffer.from(`Bearer ${secret}`);
    const actual = Buffer.from(header);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({error: "unauthorized"}, {status: 401});
    const service = createSupabaseServiceClient();
    if (!service) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 20, 1), 100);
    const {data, error} = await service.rpc("wildlife_guide_web_refunds_due", {p_limit: limit});
    if (error) return NextResponse.json({error: error.message}, {status: 500});

    const results: {purchaseId: string; ok: boolean; adjustmentId?: string; error?: string}[] = [];
    for (const row of (data ?? []) as DueRow[]) {
        try {
            // A refund sent before a crash is still there: reuse it instead of refunding twice.
            const existing = await paddleApiRequest<{data?: Adjustment[]}>(
                `/adjustments?transaction_id=${encodeURIComponent(row.paddle_transaction_id)}&action=refund`
            );
            let adjustmentId = (existing.data ?? [])
                .find((adjustment) => adjustment.action === "refund" && adjustment.status !== "rejected")?.id ?? "";
            if (!adjustmentId) {
                const created = await paddleApiRequest<{data?: Adjustment}>("/adjustments", {
                    method: "POST",
                    body: JSON.stringify({
                        action: "refund",
                        type: "full",
                        transaction_id: row.paddle_transaction_id,
                        reason: refundReasonText(row.refund_reason)
                    })
                });
                adjustmentId = created.data?.id ?? "";
            }
            if (!adjustmentId) throw new Error("Paddle returned no adjustment id.");
            const {error: markError} = await service.rpc("mark_wildlife_guide_web_refund_sent", {
                p_purchase_id: row.id,
                p_adjustment_id: adjustmentId
            });
            if (markError) throw new Error(markError.message);
            results.push({purchaseId: row.id, ok: true, adjustmentId});
        } catch (refundError) {
            const message = refundError instanceof Error ? refundError.message : "refund_failed";
            console.error("[wildlife-guide-refunds] refund failed", row.id, message);
            results.push({purchaseId: row.id, ok: false, error: message});
        }
    }
    return NextResponse.json({
        ok: true,
        due: results.length,
        sent: results.filter((result) => result.ok).length,
        failed: results.filter((result) => !result.ok).length,
        results
    });
}
