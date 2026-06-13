import {NextResponse} from "next/server";
import {supportAdminCookieName} from "@/lib/support-admin-auth";

export async function POST() {
    const response = NextResponse.json({ok: true});
    response.cookies.set(supportAdminCookieName, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0
    });
    return response;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
