import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {sendInAppSupportReply} from "@/lib/in-app-support";

type ReplyBody = {
    userId?: unknown;
    message?: unknown;
};

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    let body: ReplyBody;
    try {
        body = await request.json() as ReplyBody;
    } catch {
        return NextResponse.json({ok: false, error: "Invalid JSON body"}, {status: 400});
    }

    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!userId) {
        return NextResponse.json({ok: false, error: "Missing conversation"}, {status: 400});
    }
    if (!message) {
        return NextResponse.json({ok: false, error: "Message is required"}, {status: 400});
    }
    if (message.length > 1000) {
        return NextResponse.json({ok: false, error: "Message is too long"}, {status: 400});
    }

    try {
        await sendInAppSupportReply(userId, message);
        return NextResponse.json({ok: true});
    } catch (error) {
        console.error("[admin-support-in-app-reply] Unable to send in-app reply", {
            error: error instanceof Error ? error.message : "Unknown error"
        });
        return NextResponse.json({ok: false, error: "Unable to send reply"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
