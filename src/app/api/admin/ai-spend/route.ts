import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {buildAiSpendReport} from "@/lib/ai-spend";

const RANGES = new Set([1, 7, 14, 30]);

/** AI spend: provider bills against the call ledger, by source and feature (src/lib/ai-spend.ts). */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const requested = Number(request.nextUrl.searchParams.get("days"));
    const days = RANGES.has(requested) ? requested : 7;
    try {
        return NextResponse.json({ok: true, report: await buildAiSpendReport(days)});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to build the AI spend report"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
