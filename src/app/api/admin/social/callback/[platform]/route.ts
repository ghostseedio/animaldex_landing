import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {getSiteUrl} from "@/lib/site";
import {exchangeCode} from "@/lib/social/oauth";
import {saveConnection} from "@/lib/social/store";
import {isSocialPlatform} from "@/lib/social/types";

const OAUTH_COOKIE = "animaldex_social_oauth";

function backToAdmin(params: Record<string, string>) {
    const response = NextResponse.redirect(`${getSiteUrl()}/admin/story-videos?${new URLSearchParams(params)}`);
    response.cookies.set(OAUTH_COOKIE, "", {path: "/api/admin/social", maxAge: 0});
    return response;
}

/** The platform sends the admin back here with a code; store the tokens for the official account. */
export async function GET(request: NextRequest, {params}: {params: {platform: string}}) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const {platform} = params;
    if (!isSocialPlatform(platform)) return NextResponse.json({error: "Unknown platform"}, {status: 404});

    const query = request.nextUrl.searchParams;
    const denied = query.get("error_description") || query.get("error");
    if (denied) return backToAdmin({connectError: `${platform}: ${denied}`});

    let saved: {platform?: string; state?: string; verifier?: string} = {};
    try {
        saved = JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? "{}");
    } catch {
        saved = {};
    }
    const code = query.get("code");
    if (!code || !saved.state || saved.platform !== platform || saved.state !== query.get("state")) {
        return backToAdmin({connectError: `${platform}: sign-in expired or was started elsewhere; try again`});
    }

    try {
        // Instagram appends "#_" to the code.
        const connection = await exchangeCode(platform, code.replace(/#_$/, ""), saved.verifier ?? "");
        await saveConnection(connection);
        return backToAdmin({connected: platform});
    } catch (error) {
        return backToAdmin({connectError: `${platform}: ${error instanceof Error ? error.message : "sign-in failed"}`.slice(0, 400)});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
