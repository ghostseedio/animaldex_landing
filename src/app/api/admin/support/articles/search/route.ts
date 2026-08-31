import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {searchSupportArticles} from "@/lib/support-articles";

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "8");

    const results = searchSupportArticles(query, limit, "en");
    return NextResponse.json({ok: true, results});
}
