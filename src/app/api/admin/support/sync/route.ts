import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {syncMissingReceivedEmailsFromResend} from "@/lib/support";

export async function POST(request: NextRequest) {
    if (!isSupportAdminRequestAuthorized(request)) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const limitParam = request.nextUrl.searchParams.get("limit");
        const limit = limitParam ? Number(limitParam) : 50;
        const summary = await syncMissingReceivedEmailsFromResend(Number.isFinite(limit) ? limit : 50);

        return NextResponse.json({
            ok: true,
            ...summary
        });
    } catch (error) {
        console.error("[admin-support-sync] Unable to sync received emails", {
            error: error instanceof Error ? error.message : "Unknown error"
        });
        return NextResponse.json({ok: false, error: "Unable to sync received emails from Resend"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
