import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {describeZernioError, getTikTokAccount, ZernioError} from "@/lib/social/zernio";

/** The TikTok account Zernio posts as: who we post as, which privacy levels and toggles it allows right now. */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        return NextResponse.json({ok: true, account: await getTikTokAccount()});
    } catch (error) {
        if (error instanceof ZernioError) return NextResponse.json({error: describeZernioError(error)}, {status: error.kind === "config" ? 400 : 502});
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load TikTok account"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
