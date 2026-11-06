import {NextRequest, NextResponse} from "next/server";
import {syncDirectMessageThread} from "@/data/direct-messages";

/** What changed in a thread since the last call's `serverNow`; `markRead=1` while the page is in view. */
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const result = await syncDirectMessageThread(
        params.get("with")?.trim() ?? "",
        params.get("since"),
        params.get("markRead") === "1"
    );
    return result.ok
        ? NextResponse.json({sync: result.value})
        : NextResponse.json({error: result.error}, {status: result.status});
}

export const dynamic = "force-dynamic";
