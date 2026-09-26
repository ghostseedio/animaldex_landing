import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Web twin of iOS `SupabaseDiscoverActivityService.castChallengeVote`. */
export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();

    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const body = await request.json().catch(() => ({}));
    const challengeId = String(body.challengeId ?? "").trim();
    const captureId = String(body.captureId ?? "").trim();

    if (!UUID_PATTERN.test(challengeId) || !UUID_PATTERN.test(captureId)) {
        return NextResponse.json({error: "A valid battle and capture are required."}, {status: 400});
    }

    const {error} = await supabase.rpc("cast_capture_challenge_vote_v2", {
        p_challenge_id: challengeId,
        p_voted_capture_id: captureId
    });

    if (error) return NextResponse.json({error: error.message}, {status: 400});
    return NextResponse.json({ok: true, votedCaptureId: captureId});
}
