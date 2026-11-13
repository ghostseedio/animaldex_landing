import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {loadMonthlyCapStatus} from "@/lib/ai-spend-cap";
import {monthlyCapNotice} from "@/lib/ai-usage-core";

/** The $100 monthly AI cap and where the month stands (src/lib/ai-spend-cap.ts): the admin overview's notice reads this. */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const status = await loadMonthlyCapStatus(new Date(), request.nextUrl.searchParams.get("fresh") === "1");
    return NextResponse.json({ok: true, status, notice: monthlyCapNotice(status)});
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
