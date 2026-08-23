import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {
    listInAppSupportInbox,
    listInAppSupportMessages,
    markInAppSupportRead
} from "@/lib/in-app-support";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePagination(searchParams: URLSearchParams) {
    const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
    const parsedOffset = Number.parseInt(searchParams.get("offset") ?? "", 10);
    return {
        limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE,
        offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0
    };
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const searchParams = request.nextUrl.searchParams;
        const userId = searchParams.get("userId")?.trim() || null;
        const includeThreads = searchParams.get("includeThreads") !== "false";
        const {limit, offset} = parsePagination(searchParams);

        let threads = includeThreads ? await listInAppSupportInbox(limit, offset) : [];
        const hasMore = includeThreads && threads.length === limit;
        const selectedUserId = userId || (includeThreads && offset === 0 ? threads[0]?.id : null);
        const selectedThread = selectedUserId
            ? threads.find((thread) => thread.id === selectedUserId) ?? (await listInAppSupportInbox(100, 0)).find((thread) => thread.id === selectedUserId) ?? null
            : null;
        const messages = selectedUserId ? await listInAppSupportMessages(selectedUserId) : [];

        if (selectedUserId) {
            try {
                await markInAppSupportRead(selectedUserId);
                threads = threads.map((thread) => thread.id === selectedUserId ? {...thread, unreadCount: 0} : thread);
            } catch {
                // Listing still succeeds if only the read stamp fails.
            }
        }

        return NextResponse.json({
            ok: true,
            threads,
            hasMore,
            thread: selectedThread
                ? {
                    id: selectedThread.id,
                    displayName: selectedThread.displayName,
                    username: selectedThread.username,
                    avatarUrl: selectedThread.avatarUrl,
                    lastBody: selectedThread.lastBody,
                    lastCreatedAt: selectedThread.lastCreatedAt,
                    unreadCount: 0,
                    messages
                }
                : null
        });
    } catch (error) {
        console.error("[admin-support-in-app] Unable to load in-app inbox", {
            error: error instanceof Error ? error.message : "Unknown error"
        });
        return NextResponse.json({ok: false, error: "Unable to load in-app inbox"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
