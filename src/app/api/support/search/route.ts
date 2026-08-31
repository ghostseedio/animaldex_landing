import {NextRequest, NextResponse} from "next/server";
import {searchSupportArticles} from "@/lib/support-articles";

export async function GET(request: NextRequest) {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "8");
    const locale = request.nextUrl.searchParams.get("locale")?.trim() || "en";

    if (!query) {
        return NextResponse.json({ok: true, results: []});
    }

    const results = searchSupportArticles(query, limit, locale);
    return NextResponse.json({ok: true, results});
}
