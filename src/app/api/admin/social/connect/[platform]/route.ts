import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {buildAuthorizeUrl} from "@/lib/social/oauth";
import {isSocialPlatform} from "@/lib/social/types";

const OAUTH_COOKIE = "animaldex_social_oauth";

/** Starts connecting an official social account: sends the admin to the platform's consent screen. */
export async function GET(request: NextRequest, {params}: {params: {platform: string}}) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    if (!isSocialPlatform(params.platform)) return NextResponse.json({error: "Unknown platform"}, {status: 404});
    try {
        const start = buildAuthorizeUrl(params.platform);
        const response = NextResponse.redirect(start.url);
        response.cookies.set(OAUTH_COOKIE, JSON.stringify({platform: params.platform, state: start.state, verifier: start.verifier}), {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/api/admin/social",
            maxAge: 15 * 60
        });
        return response;
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to start sign-in"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
