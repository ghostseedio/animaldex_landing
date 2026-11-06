import {NextRequest, NextResponse} from "next/server";
import {unsendDirectMessage} from "@/data/direct-messages";

/** Takes the reader's own message back within 48 hours (`unsend_direct_message`). */
export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const messageId = typeof body?.messageId === "string" ? body.messageId.trim() : "";
    const result = await unsendDirectMessage(messageId, body?.wasPhoto === true);
    return result.ok
        ? NextResponse.json({message: result.value})
        : NextResponse.json({error: result.error}, {status: result.status});
}

export const dynamic = "force-dynamic";
