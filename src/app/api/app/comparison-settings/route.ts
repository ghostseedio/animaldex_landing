import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({error: "Authentication required."}, {status: 401});
    }

    const body = await request.json().catch(() => ({}));
    const captureId = String(body.captureId ?? "").trim();
    const action = String(body.action ?? "").trim();

    if (!captureId) {
        return NextResponse.json({error: "Capture is required."}, {status: 400});
    }

    if (action === "restore") {
        const {data, error} = await supabase.rpc("restore_capture_health", {
            p_capture_id: captureId
        });

        if (error) {
            return NextResponse.json({error: error.message}, {status: 400});
        }

        return NextResponse.json({comparison: Array.isArray(data) ? data[0] ?? null : data});
    }

    if (action === "update") {
        const challengeStake = Math.min(100, Math.max(2, Number(body.challengeStake ?? 2)));
        const {data, error} = await supabase.rpc("update_capture_challenge_settings", {
            p_capture_id: captureId,
            p_is_challenge_ready: body.isChallengeReady === true,
            p_challenge_stake: challengeStake
        });

        if (error) {
            return NextResponse.json({error: error.message}, {status: 400});
        }

        return NextResponse.json({comparison: Array.isArray(data) ? data[0] ?? null : data});
    }

    return NextResponse.json({error: "Unsupported comparison action."}, {status: 400});
}
