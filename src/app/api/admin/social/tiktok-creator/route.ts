import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {getFreshConnection} from "@/lib/social/oauth";
import {parseTikTokCreatorInfo} from "@/lib/social/tiktok-options";

/** TikTok creator_info for the connected account: who we post as and which privacy levels it allows. */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        const connection = await getFreshConnection("tiktok");
        const response = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
            method: "POST",
            headers: {Authorization: `Bearer ${connection.accessToken}`, "Content-Type": "application/json; charset=UTF-8"},
            cache: "no-store"
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || (body?.error?.code && body.error.code !== "ok")) {
            return NextResponse.json({error: `TikTok: ${body?.error?.message || body?.error?.code || response.status}`}, {status: 502});
        }
        return NextResponse.json({ok: true, creator: parseTikTokCreatorInfo(body?.data)});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load TikTok account"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
