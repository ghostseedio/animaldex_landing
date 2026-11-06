import {NextRequest, NextResponse} from "next/server";
import {
    blockDirectMessagePartner,
    hideDirectConversation,
    reportDirectMessage,
    setDirectConversationSetting
} from "@/data/direct-messages";

/**
 * One person's own handling of a conversation, as iOS's inbox menu and
 * thread menu do it: read/unread, pin, mute, delete (hide), block, report.
 */
export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({error: "invalid_request"}, {status: 400});
    const otherUserId = typeof body.otherUserId === "string" ? body.otherUserId.trim() : "";
    const action = String(body.action ?? "");

    switch (action) {
        case "pin":
        case "unpin":
        case "mute":
        case "unmute":
        case "read":
        case "unread": {
            const result = await setDirectConversationSetting(otherUserId,
                action === "pin" || action === "unpin" ? {kind: "pin", pinned: action === "pin"}
                    : action === "mute" || action === "unmute" ? {kind: "mute", until: action === "mute" && typeof body.mutedUntil === "string" ? body.mutedUntil : null}
                        : {kind: "unread", unread: action === "unread"});
            return result.ok
                ? NextResponse.json({settings: result.value})
                : NextResponse.json({error: result.error}, {status: result.status});
        }
        case "delete":
        case "block":
        case "report": {
            const result = action === "delete"
                ? await hideDirectConversation(otherUserId)
                : action === "block"
                    ? await blockDirectMessagePartner(otherUserId)
                    : await reportDirectMessage(
                        otherUserId,
                        typeof body.contentId === "string" ? body.contentId : null,
                        typeof body.snapshot === "string" ? body.snapshot : ""
                    );
            return result.ok
                ? NextResponse.json({ok: true})
                : NextResponse.json({error: result.error}, {status: result.status});
        }
        default:
            return NextResponse.json({error: "invalid_request"}, {status: 400});
    }
}

export const dynamic = "force-dynamic";
