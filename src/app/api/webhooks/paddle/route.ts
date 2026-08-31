import {NextRequest, NextResponse} from "next/server";
import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {
    assertPaddleWebhookConfigured,
    getPaddleWebhookSecret,
    resolvePaddleEnvironment,
    verifyPaddleSignature,
    type PaddleEvent
} from "@/lib/paddle-server";
import {handlePaddleEvent} from "@/lib/paddle-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const configError = assertPaddleWebhookConfigured();
    if (configError) {
        return NextResponse.json({ok: false, service: "paddle-webhook", error: configError}, {status: 503});
    }
    return NextResponse.json({
        ok: true,
        service: "paddle-webhook",
        environment: resolvePaddleEnvironment()
    });
}

export async function POST(request: NextRequest) {
    const configError = assertPaddleWebhookConfigured();
    if (configError) {
        return NextResponse.json({error: configError}, {status: 503});
    }
    const rawBody = await request.text();
    const verified = verifyPaddleSignature(rawBody, request.headers.get("paddle-signature"), getPaddleWebhookSecret());
    if (!verified.ok) return NextResponse.json({error: verified.error}, {status: 400});

    let event: PaddleEvent;
    try {
        event = JSON.parse(rawBody) as PaddleEvent;
    } catch {
        return NextResponse.json({error: "invalid_json"}, {status: 400});
    }
    if (!event?.event_id || !event.event_type || !event.occurred_at || !event.data) {
        return NextResponse.json({error: "invalid_event"}, {status: 400});
    }
    const supabase = createSupabaseServiceClient();
    if (!supabase) return NextResponse.json({error: "Webhook processing is not configured."}, {status: 503});
    try {
        return NextResponse.json(await handlePaddleEvent(supabase, event, rawBody));
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "webhook_failed"}, {status: 400});
    }
}
