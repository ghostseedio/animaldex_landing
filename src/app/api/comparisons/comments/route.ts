import {NextResponse} from "next/server";
import {
    COMMENT_MIN_LENGTH,
    fetchComparisonComments,
    sanitizeCommentBody
} from "@/data/comparison-engagement";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

const COMMENT_LIMIT = 5;
const COMMENT_WINDOW_MS = 10 * 60 * 1000;

function normalizeSlug(value: unknown) {
    return String(value ?? "").trim().toLowerCase();
}

export async function GET(request: Request) {
    const slug = normalizeSlug(new URL(request.url).searchParams.get("slug"));
    if (!slug) return NextResponse.json({error: "invalid_slug"}, {status: 400});

    const supabase = createSupabaseServerClient();
    const {data} = supabase ? await supabase.auth.getUser() : {data: {user: null}};
    const comments = await fetchComparisonComments(slug, data.user?.id ?? null);

    return NextResponse.json({comments}, {headers: {"Cache-Control": "no-store"}});
}

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "unavailable"}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "authentication_required"}, {status: 401});

    let body: {slug?: string; body?: string};
    try {
        body = (await request.json()) as {slug?: string; body?: string};
    } catch {
        return NextResponse.json({error: "invalid_request"}, {status: 400});
    }

    const slug = normalizeSlug(body.slug);
    const commentBody = sanitizeCommentBody(String(body.body ?? ""));

    if (!slug) return NextResponse.json({error: "invalid_slug"}, {status: 400});
    if (commentBody.length < COMMENT_MIN_LENGTH) {
        return NextResponse.json({error: "comment_too_short"}, {status: 400});
    }

    const limit = checkRateLimit(
        `comparison-comment:${user.id}:${getRequestIdentifier(request)}`,
        COMMENT_LIMIT,
        COMMENT_WINDOW_MS
    );

    if (!limit.allowed) {
        return NextResponse.json(
            {error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds},
            {status: 429, headers: {"Retry-After": String(limit.retryAfterSeconds)}}
        );
    }

    // Written as the signed-in user so row-level security owns the insert rule.
    const {error} = await supabase.from("comparison_comments").insert({
        comparison_slug: slug,
        user_id: user.id,
        body: commentBody
    });

    if (error) {
        return NextResponse.json({error: "comment_failed", details: error.message}, {status: 502});
    }

    const comments = await fetchComparisonComments(slug, user.id);
    return NextResponse.json({status: "ok", comments}, {headers: {"Cache-Control": "no-store"}});
}

export async function DELETE(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "unavailable"}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "authentication_required"}, {status: 401});

    const {searchParams} = new URL(request.url);
    const id = String(searchParams.get("id") ?? "").trim();
    const slug = normalizeSlug(searchParams.get("slug"));

    if (!id || !slug) return NextResponse.json({error: "invalid_request"}, {status: 400});

    const {error} = await supabase
        .from("comparison_comments")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        return NextResponse.json({error: "delete_failed", details: error.message}, {status: 502});
    }

    const comments = await fetchComparisonComments(slug, user.id);
    return NextResponse.json({status: "ok", comments}, {headers: {"Cache-Control": "no-store"}});
}
