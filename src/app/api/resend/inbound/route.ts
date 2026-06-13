import {NextRequest, NextResponse} from "next/server";
import {
    createOrUpdateSupportThread,
    createStoredReplyToken,
    createSupportMessage,
    getReplyLink,
    isRecord,
    normalizeEmailAddress,
    normalizeInboundEmail,
    ResendWebhookPayload,
    retrieveReceivedEmail,
    sendSupportForwardNotification,
    stripHtmlToText,
    updateSupportThread
} from "@/lib/support";

async function parseWebhookPayload(request: NextRequest): Promise<ResendWebhookPayload> {
    const rawPayload = await request.text();
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();

    if (webhookSecret) {
        const id = request.headers.get("svix-id");
        const timestamp = request.headers.get("svix-timestamp");
        const signature = request.headers.get("svix-signature");

        if (!id || !timestamp || !signature) {
            throw new Error("Missing Resend webhook signature headers");
        }

        const runtimeRequire = eval("require") as NodeRequire;
        const {Webhook} = runtimeRequire("standardwebhooks") as {
            Webhook: new (secret: string) => {
                verify: (payload: string, headers: Record<string, string>) => unknown;
            };
        };

        const verifiedPayload = new Webhook(webhookSecret).verify(rawPayload, {
            "webhook-id": id,
            "webhook-timestamp": timestamp,
            "webhook-signature": signature
        });

        if (!isRecord(verifiedPayload)) {
            throw new Error("Verified webhook payload is not a JSON object");
        }

        return verifiedPayload as ResendWebhookPayload;
    }

    console.warn("[resend-inbound] RESEND_WEBHOOK_SECRET is not configured; accepting unsigned webhook payloads");

    const parsed = JSON.parse(rawPayload);

    if (!isRecord(parsed)) {
        throw new Error("Webhook payload is not a JSON object");
    }

    return parsed as ResendWebhookPayload;
}

export async function GET() {
    return NextResponse.json({ok: true, route: "resend-inbound"});
}

export async function POST(request: NextRequest) {
    try {
        const payload = await parseWebhookPayload(request);

        if (payload.type !== "email.received") {
            return NextResponse.json({ok: true});
        }

        if (!isRecord(payload.data)) {
            console.error("[resend-inbound] Missing email data in webhook payload", {
                eventType: payload.type
            });
            return NextResponse.json({ok: false, error: "Missing email data"}, {status: 400});
        }

        const initialEmail = normalizeInboundEmail({
            ...payload.data,
            created_at: payload.data.created_at ?? payload.created_at
        });
        const email = await retrieveReceivedEmail(initialEmail);
        const fromEmail = normalizeEmailAddress(email.from);

        if (!fromEmail) {
            console.error("[resend-inbound] Original sender is missing or invalid", {
                emailId: email.emailId
            });
            return NextResponse.json({ok: false, error: "Missing original sender"}, {status: 400});
        }

        if (!email.html && !email.text) {
            console.error("[resend-inbound] Inbound email body is unavailable after lookup", {
                emailId: email.emailId
            });
            return NextResponse.json({ok: false, error: "Inbound email body unavailable"}, {status: 502});
        }

        const thread = await createOrUpdateSupportThread(email);
        await createSupportMessage({
            threadId: thread.id,
            direction: "inbound",
            fromEmail,
            toEmail: email.to.join(", ") || "support@animaldex.app",
            subject: email.subject ?? null,
            textBody: email.text ?? stripHtmlToText(email.html ?? "") ?? null,
            htmlBody: email.html ?? null,
            resendEmailId: email.emailId ?? null,
            rawPayload: payload
        });
        await updateSupportThread(thread.id);

        const replyToken = await createStoredReplyToken(thread.id);
        const resendEmailId = await sendSupportForwardNotification({
            email,
            replyLink: getReplyLink(replyToken.token)
        });

        if (resendEmailId) {
            console.info("[resend-inbound] Support notification forwarded", {
                threadId: thread.id,
                emailId: email.emailId,
                resendEmailId
            });
        }

        return NextResponse.json({ok: true});
    } catch (error) {
        console.error("[resend-inbound] Unexpected error", {
            error: error instanceof Error ? error.message : "Unknown error"
        });
        return NextResponse.json({ok: false, error: "Unable to process inbound email"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
