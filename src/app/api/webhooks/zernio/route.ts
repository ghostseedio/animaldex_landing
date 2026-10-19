import {NextRequest, NextResponse} from "next/server";
import {findPostByExternalId, updatePost} from "@/lib/social/store";
import {parseZernioWebhookEvent, verifyZernioWebhookSignature, ZERNIO_ENV} from "@/lib/social/zernio-core";
import {zernioPatchForRow} from "@/lib/social/zernio-sync";

// Zernio tells us when a TikTok post publishes, fails or is cancelled, so the
// share log is right without waiting for the next poll. Public path (outside
// /api/admin, so the admin guard does not apply); authenticity comes from the
// HMAC signature over the raw body with ZERNIO_WEBHOOK_SECRET. Deliveries are
// at-least-once: applying the same post state twice is harmless.
// Register with POST https://zernio.com/api/v1/webhooks/settings (docs/zernio-tiktok.md).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const secret = () => process.env[ZERNIO_ENV.webhookSecret]?.trim() || "";

export async function GET() {
    return NextResponse.json({ok: true, service: "zernio-webhook", configured: Boolean(secret())});
}

export async function POST(request: NextRequest) {
    const key = secret();
    if (!key) return NextResponse.json({error: "ZERNIO_WEBHOOK_SECRET is not set"}, {status: 503});
    const raw = await request.text();
    if (!verifyZernioWebhookSignature(raw, request.headers.get("x-zernio-signature"), key)) {
        return NextResponse.json({error: "Bad signature"}, {status: 401});
    }
    let body: unknown = null;
    try {
        body = JSON.parse(raw);
    } catch {
        return NextResponse.json({error: "Body is not JSON"}, {status: 400});
    }
    const event = parseZernioWebhookEvent(body);
    const eventId = event?.id ?? request.headers.get("x-zernio-event-id") ?? "?";
    if (!event?.post) {
        console.info(`[zernio-webhook] ${eventId} ${event?.event ?? "unknown"}: ignored`);
        return NextResponse.json({ok: true, ignored: true});
    }
    try {
        // One lookup and one PATCH: Zernio wants the 2xx within 5 s.
        const row = await findPostByExternalId(event.post.postId);
        if (!row) {
            console.info(`[zernio-webhook] ${eventId} ${event.event}: no share-log row for post ${event.post.postId}`);
            return NextResponse.json({ok: true, matched: false});
        }
        const patch = zernioPatchForRow(row, event.post);
        await updatePost(row.id, patch);
        console.info(`[zernio-webhook] ${eventId} ${event.event}: ${row.id} -> ${patch.status}`);
        return NextResponse.json({ok: true, matched: true, status: patch.status});
    } catch (error) {
        console.error(`[zernio-webhook] ${eventId} ${event.event}: update failed`, error);
        return NextResponse.json({error: "Update failed"}, {status: 500});
    }
}
