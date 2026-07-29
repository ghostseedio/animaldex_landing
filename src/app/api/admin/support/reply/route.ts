import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {
    createSupportMessage,
    EmailAttachment,
    formatSupportMessageHtml,
    getSupportSenderEmail,
    loadSupportMessagesByThreadId,
    loadSupportThreadById,
    sendSupportReply,
    updateSupportThread
} from "@/lib/support";

type AdminReplyRequestBody = {
    threadId?: unknown;
    message?: unknown;
    attachments?: unknown;
};

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
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

    let attachments: EmailAttachment[] | undefined;

    if (Array.isArray(body.attachments)) {
        attachments = body.attachments.filter(
            (a): a is EmailAttachment =>
                typeof a === "object" &&
                a !== null &&
                typeof a.filename === "string" &&
                typeof a.content === "string" &&
                typeof a.contentType === "string" &&
                a.content.length <= 20_000_000
        );

        if (attachments.length === 0) {
            attachments = undefined;
        }
    }

    if (!message && !attachments?.length) {
        return NextResponse.json({ok: false, error: "Message or attachment is required"}, {status: 400});
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
            previousMessages,
            attachments
        });

        await createSupportMessage({
            threadId: thread.id,
            direction: "outbound",
            fromEmail: getSupportSenderEmail(),
            toEmail: thread.customer_email,
            subject: thread.subject ? `Re: ${thread.subject}` : "Re: (no subject)",
            textBody: `${message}\n\nAnimalDex Support`,
            htmlBody: formatSupportMessageHtml(message),
            resendEmailId,
            rawPayload: attachments?.map(({filename, contentType, contentId}) => ({filename, contentType, contentId})) ?? null
        });
        try {
            await updateSupportThread(thread.id, {read_at: new Date().toISOString()});
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "";

            // The reply has already been sent and stored at this point. Do not
            // report a false send failure if only the read-state migration is
            // pending.
            if (!errorMessage.includes("PGRST204") || !errorMessage.includes("read_at")) {
                throw error;
            }

            console.warn("[admin-support-reply] Read state migration is not applied yet");
        }

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
