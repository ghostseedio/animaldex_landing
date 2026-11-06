import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {formatBoard} from "@/lib/social-lab/format-board-server";

/** The format leaderboard: each format's views per post against its platform's median, and its verdict (src/lib/social-lab/format-board.ts). */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        return NextResponse.json({ok: true, board: await formatBoard(request.nextUrl.searchParams.get("fresh") === "1")});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load the format board"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
