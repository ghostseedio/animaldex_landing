import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {
    loadSupportMessagesByThreadId,
    loadSupportThreadById,
    loadSupportThreads,
    SupportThread,
    toSafeSupportThread
} from "@/lib/support";

function toThreadSummary(thread: SupportThread) {
    return {
        id: thread.id,
        subject: thread.subject,
        customerEmail: thread.customer_email,
        customerName: thread.customer_name,
        status: thread.status,
        createdAt: thread.created_at,
        updatedAt: thread.updated_at
    };
}

export async function GET(request: NextRequest) {
    if (!isSupportAdminRequestAuthorized(request)) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const requestedThreadId = request.nextUrl.searchParams.get("threadId")?.trim();
        const threads = await loadSupportThreads();
        const selectedThreadId = requestedThreadId || threads[0]?.id;
        const selectedThread = selectedThreadId ? await loadSupportThreadById(selectedThreadId) : null;
        const messages = selectedThread ? await loadSupportMessagesByThreadId(selectedThread.id) : [];

        return NextResponse.json({
            ok: true,
            threads: threads.map(toThreadSummary),
            thread: selectedThread ? toSafeSupportThread(selectedThread, messages) : null
        });
    } catch (error) {
        console.error("[admin-support-threads] Unable to load support inbox", {
            error: error instanceof Error ? error.message : "Unknown error"
        });
        return NextResponse.json({ok: false, error: "Unable to load support inbox"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
