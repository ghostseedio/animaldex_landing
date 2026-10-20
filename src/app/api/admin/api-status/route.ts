import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {checkApiStatuses} from "@/lib/api-status";

/** Probes Claude, OpenAI, Gemini and Higgsfield and reports health and spend (src/lib/api-status.ts). */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        return NextResponse.json({ok: true, checkedAt: new Date().toISOString(), providers: await checkApiStatuses()});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to check the APIs"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
