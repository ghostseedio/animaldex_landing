import {timingSafeEqual} from "crypto";
import {NextRequest, NextResponse} from "next/server";
import {runGrowthDailyLog} from "@/lib/growth-daily-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
    const secret = process.env.CRON_SECRET?.trim();
    const actual = request.headers.get("authorization")?.trim() ?? "";
    if (!secret) return false;
    const expected = Buffer.from(`Bearer ${secret}`);
    const supplied = Buffer.from(actual);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

/**
 * Writes the last three finished Jakarta days into growth_marketing_daily
 * from the connected sources (src/lib/growth-daily-log.ts). Run nightly from
 * the VM: scripts/install-growth-daily-log-timer.sh. Kill switch:
 * GROWTH_DAILY_LOG_DISABLED=1.
 */
export async function POST(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({error: "unauthorized"}, {status: 401});
    if (process.env.GROWTH_DAILY_LOG_DISABLED?.trim() === "1") return NextResponse.json({ok: true, written: [], skipped: [], notes: ["GROWTH_DAILY_LOG_DISABLED=1"]});
    try {
        return NextResponse.json(await runGrowthDailyLog());
    } catch (cause) {
        const error = cause instanceof Error ? cause.message : "Growth daily log failed";
        console.error("[growth-daily-log] run failed", error);
        return NextResponse.json({ok: false, error}, {status: 503});
    }
}
