import {NextRequest, NextResponse} from "next/server";
import {processInboundSupportEmail, ResendWebhookPayload, isRecord} from "@/lib/support";

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

        const result = await processInboundSupportEmail({
            payload,
            sendForwardNotification: true
        });

        if (result.status === "skipped") {
            console.info("[resend-inbound] Duplicate inbound email ignored", {
                emailId: result.emailId
            });
            return NextResponse.json({ok: true, duplicate: true});
        }

        if (result.forwardResendEmailId) {
            console.info("[resend-inbound] Support notification forwarded", {
                threadId: result.threadId,
                emailId: result.emailId,
                resendEmailId: result.forwardResendEmailId
            });
        }

        return NextResponse.json({ok: true, threadId: result.threadId});
    } catch (error) {
        console.error("[resend-inbound] Unexpected error", {
            error: error instanceof Error ? error.message : "Unknown error"
        });
        return NextResponse.json({ok: false, error: "Unable to process inbound email"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
