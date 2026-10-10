import {NextRequest, NextResponse} from "next/server";
import {runIdentityReviewScan} from "@/lib/capture-identity-review-server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * The scheduled identity-review scan: queue new suspect pairs from the last
 * `days` days, then analyse up to `limit` pending pairs with the vision model.
 * It writes verdicts only; captures change when an operator applies one.
 *
 * Authorised by an operator session or `Authorization: Bearer $CRON_SECRET`,
 * like the self-heal route.
 */

function cronAuthorized(request: NextRequest) {
    const secret = process.env.CRON_SECRET?.trim();
    return Boolean(secret) && request.headers.get("authorization")?.trim() === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
    if (!cronAuthorized(request) && !(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const days = Math.min(120, Math.max(1, Number(request.nextUrl.searchParams.get("days")) || 7));
    const limit = Math.min(60, Math.max(0, Number(request.nextUrl.searchParams.get("limit") ?? 12)));

    try {
        const result = await runIdentityReviewScan({days, analyzeLimit: limit});
        return NextResponse.json({ok: true, days, limit, ...result});
    } catch (error) {
        console.error("[identity-review-scan]", error);
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Scan failed"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
