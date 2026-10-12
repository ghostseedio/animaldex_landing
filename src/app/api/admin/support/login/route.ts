import {NextRequest, NextResponse} from "next/server";
import {adminLoginThrottledResponse, throttleAdminLogin} from "@/lib/admin-login-throttle";
import {getRequestIdentifier} from "@/lib/rate-limit";
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

const noStore = {"Cache-Control": "private, no-store"};

export async function POST(request: NextRequest) {
    const throttle = throttleAdminLogin(request, "password");
    if (!throttle.allowed) {
        return adminLoginThrottledResponse(throttle);
    }

    let body: LoginRequestBody;

    try {
        body = await request.json() as LoginRequestBody;
    } catch {
        return NextResponse.json({ok: false, error: "Invalid JSON body"}, {status: 400, headers: noStore});
    }

    if (!isSupportAdminAuthConfigured()) {
        return NextResponse.json({ok: false, error: "Support admin auth is not configured"}, {status: 500, headers: noStore});
    }

    const password = typeof body.password === "string" ? body.password : "";

    if (!verifySupportAdminPassword(password)) {
        console.warn("[admin-login] rejected password attempt", {client: getRequestIdentifier(request)});
        return NextResponse.json({ok: false, error: "Invalid password"}, {status: 401, headers: noStore});
    }

    const response = NextResponse.json({ok: true}, {headers: noStore});
    response.cookies.set(supportAdminCookieName, createSupportAdminSession(), getSupportAdminCookieOptions());
    return response;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
