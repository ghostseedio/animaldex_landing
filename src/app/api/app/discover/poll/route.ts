import {NextRequest, NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Feedback polls in Discover (AnimalDex 20261201100000), for the signed-in
 * reader only; the RPCs read auth.uid(), so nobody answers for someone else.
 *   GET  ?surface=feed|debates&seed=..&asOf=<session moment>  -> {poll: row | null}
 *   POST {action: "answer", pollId, choices, freeText}         -> {answer}
 *   POST {action: "dismiss", pollId}                           -> {ok: true}
 * A server without the migration (missing RPC) answers {poll: null}: no card.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({poll: null});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({poll: null});
    const params = request.nextUrl.searchParams;
    const surface = params.get("surface") === "debates" ? "debates" : "feed";
    const asOf = params.get("asOf");
    const asOfValid = asOf && Number.isFinite(Date.parse(asOf)) ? new Date(asOf).toISOString() : null;
    const {data, error} = await supabase.rpc("discover_feed_poll_v1", {
        p_surface: surface,
        p_seed: (params.get("seed") ?? "web").slice(0, 64),
        p_as_of: asOfValid
    });
    if (error) return NextResponse.json({poll: null});
    return NextResponse.json({poll: Array.isArray(data) ? data[0] ?? null : null});
}

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const pollId = typeof body.pollId === "string" && UUID.test(body.pollId) ? body.pollId : null;
    if (!pollId) return NextResponse.json({error: "invalid_answer"}, {status: 400});

    if (body.action === "dismiss") {
        const {error} = await supabase.rpc("dismiss_feedback_poll", {p_poll_id: pollId});
        return error ? NextResponse.json({error: "failed"}, {status: 500}) : NextResponse.json({ok: true});
    }

    const choices = body.choices && typeof body.choices === "object" && !Array.isArray(body.choices) ? body.choices : {};
    const freeText = typeof body.freeText === "string" ? body.freeText.slice(0, 1000) : null;
    const {data, error} = await supabase.rpc("submit_feedback_poll_answer", {
        p_poll_id: pollId,
        p_choices: choices,
        p_free_text: freeText
    });
    if (error) {
        const code = error.message === "poll_closed" || error.message === "invalid_answer" ? error.message : "failed";
        return NextResponse.json({error: code}, {status: code === "failed" ? 500 : 400});
    }
    return NextResponse.json({answer: data});
}
