import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {debateProblemCode, debateUuid, decodeHeartsResult} from "@/lib/debates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Heal a heart (docs/debates/SPEC.md, section 1.8): 5 Credits, one heart, any
 * time the card is below 3, as the signed-in owner
 * (`heal_capture_heart_v1`). It replaces `restore_capture_health` (the old
 * "Restore" that refilled all three, only at 0) for 3.2.
 *
 * POST {captureId} → {ok: true, hearts, credits} or {ok: false, code}
 * (`hearts_full`, `insufficient_credits`, …).
 */
export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ok: false, code: "not_authenticated"}, {status: 401});

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const captureId = debateUuid(body.captureId);
    if (!captureId) return NextResponse.json({ok: false, code: "not_found"}, {status: 400});

    const {data, error} = await supabase.rpc("heal_capture_heart_v1", {p_capture_id: captureId});
    if (error) {
        const code = debateProblemCode(error.message);
        if (code === "debate_unavailable") console.warn("[hearts] heal_capture_heart_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({ok: false, code}, {status: code === "debate_unavailable" ? 502 : 400});
    }
    const healed = decodeHeartsResult(data);
    if (!healed) return NextResponse.json({ok: false, code: "debate_unavailable"}, {status: 502});
    return NextResponse.json({ok: true, ...healed});
}
