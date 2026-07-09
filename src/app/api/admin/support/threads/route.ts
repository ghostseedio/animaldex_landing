import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {
    loadSupportMessagesByThreadId,
    loadSupportThreadById,
    loadSupportThreads,
    SupportThread,
    toSafeSupportThread
} from "@/lib/support";

const DEFAULT_THREAD_PAGE_SIZE = 15;
const MAX_THREAD_PAGE_SIZE = 100;

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

function parseThreadPagination(searchParams: URLSearchParams) {
    const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
    const parsedOffset = Number.parseInt(searchParams.get("offset") ?? "", 10);
    const limit = Number.isFinite(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), MAX_THREAD_PAGE_SIZE)
        : DEFAULT_THREAD_PAGE_SIZE;
    const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

    return {limit, offset};
}

export async function GET(request: NextRequest) {
    if (!isSupportAdminRequestAuthorized(request)) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const searchParams = request.nextUrl.searchParams;
        const requestedThreadId = searchParams.get("threadId")?.trim();
        const includeThreads = searchParams.get("includeThreads") !== "false";
        const {limit, offset} = parseThreadPagination(searchParams);

        let threads: SupportThread[] = [];
        let hasMore = false;

        if (includeThreads) {
            threads = await loadSupportThreads({limit, offset});
            hasMore = threads.length === limit;
        }

        const selectedThreadId = requestedThreadId || (includeThreads && offset === 0 ? threads[0]?.id : undefined);
        const selectedThread = selectedThreadId ? await loadSupportThreadById(selectedThreadId) : null;
        const messages = selectedThread ? await loadSupportMessagesByThreadId(selectedThread.id) : [];

        return NextResponse.json({
            ok: true,
            threads: includeThreads ? threads.map(toThreadSummary) : undefined,
            hasMore: includeThreads ? hasMore : undefined,
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
