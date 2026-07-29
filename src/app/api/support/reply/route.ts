import {NextRequest, NextResponse} from "next/server";
import {
    createSupportMessage,
    EmailAttachment,
    getSupportSenderEmail,
    loadValidSupportThreadByToken,
    markReplyTokenUsed,
    sendSupportReply,
    updateSupportThread
} from "@/lib/support";

type ReplyRequestBody = {
    token?: unknown;
    message?: unknown;
    attachments?: unknown;
};

export async function POST(request: NextRequest) {
    let body: ReplyRequestBody;

    try {
        body = await request.json() as ReplyRequestBody;
    } catch {
        return NextResponse.json({ok: false, error: "Invalid JSON body"}, {status: 400});
    }

    const token = typeof body.token === "string" ? body.token.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!token) {
        return NextResponse.json({ok: false, error: "Missing token"}, {status: 400});
    }

    if (!message) {
        return NextResponse.json({ok: false, error: "Message is required"}, {status: 400});
    }

    let attachments: EmailAttachment[] | undefined;

    if (Array.isArray(body.attachments)) {
        attachments = body.attachments.filter(
            (a): a is EmailAttachment =>
                typeof a === "object" &&
                a !== null &&
                typeof a.filename === "string" &&
                typeof a.content === "string" &&
                typeof a.contentType === "string"
        );

        if (attachments.length === 0) {
            attachments = undefined;
        }
    }

    try {
        const result = await loadValidSupportThreadByToken(token);

        if (!result.ok) {
            return NextResponse.json({ok: false, error: result.error}, {status: result.status});
        }

        const resendEmailId = await sendSupportReply({
            thread: result.thread,
            message,
            previousMessages: result.messages,
            attachments
        });

        await createSupportMessage({
            threadId: result.thread.id,
            direction: "outbound",
            fromEmail: getSupportSenderEmail(),
            toEmail: result.thread.customer_email,
            subject: result.thread.subject ? `Re: ${result.thread.subject}` : "Re: (no subject)",
            textBody: `${message}\n\nAnimalDex Support`,
            htmlBody: null,
            resendEmailId,
            rawPayload: null
        });
        await updateSupportThread(result.thread.id);
        await markReplyTokenUsed(result.token.id);

        return NextResponse.json({ok: true});
    } catch (error) {
        console.error("[support-reply] Unable to send support reply", {
            error: error instanceof Error ? error.message : "Unknown error"
        });
        return NextResponse.json({ok: false, error: "Unable to send support reply"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
