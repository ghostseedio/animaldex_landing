import {NextRequest, NextResponse} from "next/server";
import {ingestWiseWebhook} from "@/lib/wise-sandbox-payouts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Wise hub / browser reachability checks use GET or HEAD. */
export async function GET() {
    return NextResponse.json({ok: true, service: "wise-webhook"});
}

export async function HEAD() {
    return new NextResponse(null, {status: 200});
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const result = await ingestWiseWebhook(rawBody, request.headers);
        return NextResponse.json(result);
    } catch (e) {
        const message = e instanceof Error ? e.message : "webhook_failed";
        const status = message.includes("signature") ? 401 : 400;
        return NextResponse.json({error: message}, {status});
    }
}
