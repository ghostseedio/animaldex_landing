import {NextRequest, NextResponse} from "next/server";
import {markDirectConversationRead} from "@/data/direct-messages";

export async function POST(request: NextRequest) {
    let body: {otherUserId?: string};

    try {
        body = await request.json() as {otherUserId?: string};
    } catch {
        return NextResponse.json({error: "Invalid JSON body"}, {status: 400});
    }

    const otherUserId = typeof body.otherUserId === "string" ? body.otherUserId.trim() : "";
    if (!otherUserId) {
        return NextResponse.json({error: "Missing conversation partner"}, {status: 400});
    }

    const result = await markDirectConversationRead(otherUserId);
    return result.ok
        ? NextResponse.json({ok: true})
        : NextResponse.json({error: result.error}, {status: 400});
}

export const dynamic = "force-dynamic";
