import {timingSafeEqual} from "crypto";
import {NextRequest, NextResponse} from "next/server";
import {getSiteUrl} from "@/lib/site";
import {sendResendEmail} from "@/lib/support";
import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {renderGuideEmail, type GuideEmailPayload} from "@/lib/wildlife-guide-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends the Wildlife Guide sales emails the database queued in
 * wildlife_guide_email_outbox (a sale, the reply reminder, refunds, payouts).
 * claim_wildlife_guide_emails hands each row to one run; each is sent once
 * through Resend (the outbox id is the idempotency key) and finished as sent,
 * skipped (no address, unknown kind) or failed (retried with backoff, up to 8
 * attempts).
 *
 * Run every 10 minutes from the VM with the card refunds: see
 * docs/wildlife-guide-purchases.md. Authorised by `Authorization: Bearer $CRON_SECRET`.
 */

type OutboxRow = {
    id: string;
    kind: string;
    user_id: string | null;
    to_email: string | null;
    payload: GuideEmailPayload | null;
};

function authorized(request: NextRequest) {
    const secret = process.env.CRON_SECRET?.trim();
    const header = request.headers.get("authorization")?.trim() ?? "";
    if (!secret) return false;
    const expected = Buffer.from(`Bearer ${secret}`);
    const actual = Buffer.from(header);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function fromHeader() {
    const email = process.env.SUPPORT_FROM_EMAIL?.trim() || "support@animaldex.app";
    return {from: `AnimalDex <${email}>`, replyTo: email};
}

export async function POST(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({error: "unauthorized"}, {status: 401});
    const service = createSupabaseServiceClient();
    if (!service) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    if (!process.env.RESEND_API_KEY?.trim()) return NextResponse.json({error: "RESEND_API_KEY is not set."}, {status: 503});

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 25, 1), 100);
    const {data, error} = await service.rpc("claim_wildlife_guide_emails", {p_limit: limit});
    if (error) return NextResponse.json({error: error.message}, {status: 500});

    const siteUrl = getSiteUrl();
    const {from, replyTo} = fromHeader();
    const results: {id: string; kind: string; outcome: "sent" | "skipped" | "failed"; detail?: string}[] = [];

    for (const row of (data ?? []) as OutboxRow[]) {
        const finish = (sent: boolean, skippedReason: string | null, problem: string | null) =>
            service.rpc("finish_wildlife_guide_email", {
                p_id: row.id,
                p_sent: sent,
                p_skipped_reason: skippedReason,
                p_error: problem
            });
        try {
            const email = renderGuideEmail(row.kind, row.payload ?? {}, siteUrl);
            if (!email) {
                await finish(false, `unknown_kind:${row.kind}`, null);
                results.push({id: row.id, kind: row.kind, outcome: "skipped", detail: "unknown kind"});
                continue;
            }
            let to = row.to_email?.trim().toLowerCase() || "";
            if (!to && row.user_id) {
                const {data: found} = await service.auth.admin.getUserById(row.user_id);
                to = found.user?.email?.trim().toLowerCase() || "";
            }
            if (!to) {
                // Signed in with a phone number or a provider that gave no email.
                await finish(false, "no_address", null);
                results.push({id: row.id, kind: row.kind, outcome: "skipped", detail: "no address"});
                continue;
            }
            await sendResendEmail({
                from,
                replyTo,
                to,
                subject: email.subject,
                text: email.text,
                html: email.html,
                idempotencyKey: `wildlife-guide-email:${row.id}`
            });
            await finish(true, null, null);
            results.push({id: row.id, kind: row.kind, outcome: "sent"});
        } catch (sendError) {
            const message = sendError instanceof Error ? sendError.message : "send_failed";
            console.error("[wildlife-guide-emails] send failed", row.id, row.kind, message);
            await finish(false, null, message.slice(0, 500));
            results.push({id: row.id, kind: row.kind, outcome: "failed", detail: message});
        }
    }
    return NextResponse.json({
        ok: true,
        claimed: results.length,
        sent: results.filter((result) => result.outcome === "sent").length,
        skipped: results.filter((result) => result.outcome === "skipped").length,
        failed: results.filter((result) => result.outcome === "failed").length,
        results
    });
}
