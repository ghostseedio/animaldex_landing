import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

export async function GET(request: NextRequest) {
    const isAdmin = await isSupportAdminRequestAuthorized(request);
    return NextResponse.json({ok: true, isAdmin}, {
        headers: {"Cache-Control": "private, no-store"}
    });
}

export const dynamic = "force-dynamic";
