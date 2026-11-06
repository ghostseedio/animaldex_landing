import {NextRequest, NextResponse} from "next/server";
import {sendDirectMessage} from "@/data/direct-messages";

export async function POST(request: NextRequest) {
    let body: {recipientId?: string; body?: string; captureId?: string};

    try {
        body = await request.json() as {recipientId?: string; body?: string; captureId?: string};
    } catch {
        return NextResponse.json({error: "invalid_request"}, {status: 400});
    }

    const recipientId = typeof body.recipientId === "string" ? body.recipientId.trim() : "";
    const messageBody = typeof body.body === "string" ? body.body : "";

    const captureId = typeof body.captureId === "string" && body.captureId.trim() ? body.captureId.trim() : null;

    const result = await sendDirectMessage(recipientId, messageBody, captureId);
    return result.ok
        ? NextResponse.json({message: result.value})
        : NextResponse.json({error: result.error}, {status: result.status});
}

export const dynamic = "force-dynamic";
