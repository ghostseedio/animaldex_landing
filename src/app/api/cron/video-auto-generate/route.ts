import {timingSafeEqual} from "crypto";
import {NextRequest, NextResponse} from "next/server";
import {runAutoGenerate} from "@/lib/content-video/auto-generate";

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
 * Starts one page video from a random page family and page
 * (src/lib/content-video/auto-generate.ts). Run every 3 hours from the VM:
 * scripts/install-video-auto-generate-timer.sh. Returns once the video has
 * started; it finishes in the background.
 */
export async function POST(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({error: "unauthorized"}, {status: 401});
    try {
        return NextResponse.json(await runAutoGenerate());
    } catch (cause) {
        const error = cause instanceof Error ? cause.message : "Auto-generate failed";
        console.error("[video-auto-generate] run failed", error);
        return NextResponse.json({ok: false, error}, {status: 503});
    }
}
