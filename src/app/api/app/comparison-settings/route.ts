import {NextResponse} from "next/server";
import {getAppCaptureDetail} from "@/data/authenticated-app";
import {getBattleTier, type AnimalBattleTier} from "@/lib/battle-tier";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

const TIER_STAKE: Record<AnimalBattleTier, number> = {
    E: 5,
    D: 10,
    C: 15,
    B: 20,
    A: 25,
    S: 25
};

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
        const capture = await getAppCaptureDetail(captureId);

        if (!capture) {
            return NextResponse.json({error: "Capture not found."}, {status: 404});
        }

        const challengeStake = TIER_STAKE[getBattleTier(capture.effectiveGameStats)];
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
