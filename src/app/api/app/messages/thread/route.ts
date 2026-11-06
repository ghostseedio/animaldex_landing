import {NextRequest, NextResponse} from "next/server";
import {getDirectMessageThreadPage} from "@/data/direct-messages";

/** A thread's newest page (`markRead=1` reads it), or the page before `before` (a message id). */
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const result = await getDirectMessageThreadPage(params.get("with")?.trim() ?? "", {
        beforeId: params.get("before")?.trim() || null,
        limit: 50,
        markRead: params.get("markRead") === "1"
    });
    return result.ok
        ? NextResponse.json({page: result.value})
        : NextResponse.json({error: result.error}, {status: result.status});
}

export const dynamic = "force-dynamic";
