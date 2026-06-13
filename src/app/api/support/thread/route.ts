import {NextRequest, NextResponse} from "next/server";
import {loadValidSupportThreadByToken, toSafeSupportThread} from "@/lib/support";

export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get("token")?.trim();

    if (!token) {
        return NextResponse.json({ok: false, error: "Missing token"}, {status: 400});
    }

    try {
        const result = await loadValidSupportThreadByToken(token);

        if (!result.ok) {
            return NextResponse.json({ok: false, error: result.error}, {status: result.status});
        }

        return NextResponse.json({
            ok: true,
            thread: toSafeSupportThread(result.thread, result.messages)
        });
    } catch (error) {
        console.error("[support-thread] Unable to load support thread", {
            error: error instanceof Error ? error.message : "Unknown error"
        });
        return NextResponse.json({ok: false, error: "Unable to load support thread"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
