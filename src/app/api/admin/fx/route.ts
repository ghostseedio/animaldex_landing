import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {getFxRates, hasFxProvider} from "@/lib/fx";
import {isCurrencyCode, parseFxPairs} from "@/lib/fx-convert";

/**
 * GET /api/admin/fx?base=USD&q=GBP@2026-08-25,IDR@2026-09-15
 * Rates that convert each requested currency (on its date) into `base`.
 */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const base = (request.nextUrl.searchParams.get("base") ?? "USD").toUpperCase();
    if (!isCurrencyCode(base)) {
        return NextResponse.json({ok: false, error: "base must be a 3-letter currency code"}, {status: 400});
    }
    if (!hasFxProvider()) {
        return NextResponse.json({ok: false, error: "No Wise API token is configured, so amounts stay in their original currencies."}, {status: 503});
    }

    const fx = await getFxRates(base, parseFxPairs(request.nextUrl.searchParams.get("q")));
    return NextResponse.json({ok: true, ...fx});
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
