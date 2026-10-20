import {timingSafeEqual} from "crypto";
import {NextRequest, NextResponse} from "next/server";
import {runBlogAutoGenerate} from "@/lib/blog-generator/auto-generate";

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
 * Starts one news article with a random focus, standard research, published
 * when done (src/lib/blog-generator/auto-generate.ts). Run daily from
 * the VM: scripts/install-blog-auto-generate-timer.sh. Returns once the
 * article has started; it finishes in the background (10-20 minutes).
 */
export async function POST(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({error: "unauthorized"}, {status: 401});
    try {
        return NextResponse.json(await runBlogAutoGenerate());
    } catch (cause) {
        const error = cause instanceof Error ? cause.message : "Blog auto-generate failed";
        console.error("[blog-auto-generate] run failed", error);
        return NextResponse.json({ok: false, error}, {status: 503});
    }
}
