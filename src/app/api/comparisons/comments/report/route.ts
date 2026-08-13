import {NextResponse} from "next/server";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

const REPORT_LIMIT = 10;
const REPORT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "unavailable"}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "authentication_required"}, {status: 401});

    let body: {commentId?: string; reason?: string};
    try {
        body = (await request.json()) as {commentId?: string; reason?: string};
    } catch {
        return NextResponse.json({error: "invalid_request"}, {status: 400});
    }

    const commentId = String(body.commentId ?? "").trim();
    if (!commentId) return NextResponse.json({error: "invalid_request"}, {status: 400});

    const limit = checkRateLimit(
        `comparison-report:${user.id}:${getRequestIdentifier(request)}`,
        REPORT_LIMIT,
        REPORT_WINDOW_MS
    );

    if (!limit.allowed) {
        return NextResponse.json({error: "rate_limited"}, {status: 429});
    }

    const {error} = await supabase.from("comparison_comment_reports").insert({
        comment_id: commentId,
        reporter_user_id: user.id,
        reason: String(body.reason ?? "").trim().slice(0, 280) || null
    });

    // A duplicate report from the same reader is a no-op, not an error.
    if (error && !error.message.toLowerCase().includes("duplicate")) {
        return NextResponse.json({error: "report_failed", details: error.message}, {status: 502});
    }

    return NextResponse.json({status: "ok"});
}
