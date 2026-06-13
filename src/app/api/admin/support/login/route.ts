import {NextRequest, NextResponse} from "next/server";
import {
    createSupportAdminSession,
    getSupportAdminCookieOptions,
    isSupportAdminAuthConfigured,
    supportAdminCookieName,
    verifySupportAdminPassword
} from "@/lib/support-admin-auth";

type LoginRequestBody = {
    password?: unknown;
};

export async function POST(request: NextRequest) {
    let body: LoginRequestBody;

    try {
        body = await request.json() as LoginRequestBody;
    } catch {
        return NextResponse.json({ok: false, error: "Invalid JSON body"}, {status: 400});
    }

    if (!isSupportAdminAuthConfigured()) {
        return NextResponse.json({ok: false, error: "Support admin auth is not configured"}, {status: 500});
    }

    const password = typeof body.password === "string" ? body.password : "";

    if (!verifySupportAdminPassword(password)) {
        return NextResponse.json({ok: false, error: "Invalid password"}, {status: 401});
    }

    const response = NextResponse.json({ok: true});
    response.cookies.set(supportAdminCookieName, createSupportAdminSession(), getSupportAdminCookieOptions());
    return response;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
