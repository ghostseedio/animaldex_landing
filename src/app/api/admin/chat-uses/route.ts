import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {fetchChatUseSummary} from "@/lib/chat-uses";

const RANGES = new Set([7, 14, 30, 90]);

/** What people use the animal chat for (src/lib/chat-uses.ts). Admin only. */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const requested = Number(request.nextUrl.searchParams.get("days"));
    const days = RANGES.has(requested) ? requested : 30;
    try {
        return NextResponse.json({ok: true, summary: await fetchChatUseSummary(days)});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load chat uses"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
