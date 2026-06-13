import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {
    createSupportMessage,
    getSupportSenderEmail,
    loadSupportMessagesByThreadId,
    loadSupportThreadById,
    sendSupportReply,
    updateSupportThread
} from "@/lib/support";

type AdminReplyRequestBody = {
    threadId?: unknown;
    message?: unknown;
};

export async function POST(request: NextRequest) {
    if (!isSupportAdminRequestAuthorized(request)) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    let body: AdminReplyRequestBody;

    try {
        body = await request.json() as AdminReplyRequestBody;
    } catch {
        return NextResponse.json({ok: false, error: "Invalid JSON body"}, {status: 400});
    }

    const threadId = typeof body.threadId === "string" ? body.threadId.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!threadId) {
        return NextResponse.json({ok: false, error: "Missing thread"}, {status: 400});
    }

    if (!message) {
        return NextResponse.json({ok: false, error: "Message is required"}, {status: 400});
    }

    try {
        const thread = await loadSupportThreadById(threadId);

        if (!thread) {
            return NextResponse.json({ok: false, error: "Support thread was not found"}, {status: 404});
        }

        const previousMessages = await loadSupportMessagesByThreadId(thread.id);
        const resendEmailId = await sendSupportReply({
            thread,
            message,
            previousMessages
        });

        await createSupportMessage({
            threadId: thread.id,
            direction: "outbound",
            fromEmail: getSupportSenderEmail(),
            toEmail: thread.customer_email,
            subject: thread.subject ? `Re: ${thread.subject}` : "Re: (no subject)",
            textBody: `${message}\n\nAnimalDex Support`,
            htmlBody: null,
            resendEmailId,
            rawPayload: null
        });
        await updateSupportThread(thread.id);

        return NextResponse.json({ok: true});
    } catch (error) {
        console.error("[admin-support-reply] Unable to send support reply", {
            error: error instanceof Error ? error.message : "Unknown error"
        });
        return NextResponse.json({ok: false, error: "Unable to send reply"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
