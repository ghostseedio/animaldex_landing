import {NextRequest, NextResponse} from "next/server";
import {sendDirectMessage} from "@/data/direct-messages";

export async function POST(request: NextRequest) {
    let body: {recipientId?: string; body?: string};

    try {
        body = await request.json() as {recipientId?: string; body?: string};
    } catch {
        return NextResponse.json({error: "Invalid JSON body"}, {status: 400});
    }

    const recipientId = typeof body.recipientId === "string" ? body.recipientId.trim() : "";
    const messageBody = typeof body.body === "string" ? body.body : "";

    if (!recipientId) {
        return NextResponse.json({error: "Missing recipient"}, {status: 400});
    }

    const result = await sendDirectMessage(recipientId, messageBody);
    return result.ok
        ? NextResponse.json({message: result.message})
        : NextResponse.json({error: result.error}, {status: 400});
}

export const dynamic = "force-dynamic";
