import {timingSafeEqual} from "crypto";
import {NextRequest, NextResponse} from "next/server";
import {runAutoShare} from "@/lib/social/auto-share";

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
 * Shares the next unshared /admin/story-videos video to every connected
 * platform (src/lib/social/auto-share.ts). Run every 2 hours from the VM:
 * scripts/install-social-auto-share-timer.sh. `?dryRun=1` reports what would
 * go out without queuing anything.
 */
export async function POST(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({error: "unauthorized"}, {status: 401});
    try {
        return NextResponse.json(await runAutoShare({dryRun: request.nextUrl.searchParams.get("dryRun") === "1"}));
    } catch (cause) {
        const error = cause instanceof Error ? cause.message : "Auto-share failed";
        console.error("[social-auto-share] run failed", error);
        return NextResponse.json({ok: false, error}, {status: 503});
    }
}
