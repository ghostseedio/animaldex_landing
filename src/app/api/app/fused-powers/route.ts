import {NextResponse} from "next/server";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {decodeFusedPowers, decodePrepareStage, fusedRefusalMessage} from "@/lib/fused-powers";
import {decodeSpeciesTrainingResult} from "@/lib/species-training";

export const runtime = "nodejs";

/**
 * Fused Powers on one of the viewer's own cards.
 *
 * GET  ?captureId=…                         → `get_capture_fused_powers` ([] for others' cards)
 * POST {action: "prepare", learnedId}       → `fused-power` edge function, `prepare`
 * POST {action: "training", learnedId, answers} → `submit_fused_training`
 *
 * Every RPC is scoped to auth.uid() server-side: the right answers never leave
 * the database and every reward is paid there, never here.
 */

function errorCode(message: string) {
    const match = /(not_authenticated|fused_power_not_found|fused_training_not_ready|answers_mismatch)/i.exec(message);
    return match ? match[1].toLowerCase() : "fused_failed";
}

export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const captureId = new URL(request.url).searchParams.get("captureId")?.trim();

    if (!captureId) {
        return NextResponse.json({error: "A capture id is required."}, {status: 400});
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        // Fused Powers are shown on the owner's own card only.
        return NextResponse.json({items: []});
    }

    const {data, error} = await supabase.rpc("get_capture_fused_powers", {p_capture_id: captureId});

    if (error) {
        const code = errorCode(error.message);
        return NextResponse.json({error: fusedRefusalMessage(code), code}, {status: 400});
    }

    return NextResponse.json({items: decodeFusedPowers(data)});
}

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
    const action = String(body?.action ?? "");
    const learnedId = String(body?.learnedId ?? "").trim();

    if (!learnedId) {
        return NextResponse.json({error: "A fused Power id is required."}, {status: 400});
    }

    if (action === "prepare") {
        const invoked = await invokeAuthenticatedSupabaseFunctionResponse("fused-power", {
            action: "prepare",
            learned_sub_principle_id: learnedId
        }).catch(() => null);

        if (!invoked?.ok) {
            const code = invoked?.payload?.error || "preparing_failed";
            return NextResponse.json({error: fusedRefusalMessage(code), code}, {status: invoked?.status === 404 ? 404 : 503});
        }

        return NextResponse.json({stage: decodePrepareStage(invoked.payload)});
    }

    if (action === "training") {
        const answers = Array.isArray(body?.answers) ? body.answers.map((value: unknown) => Number(value)) : null;

        if (!answers || !answers.length || answers.some((value: number) => !Number.isInteger(value) || value < 0)) {
            return NextResponse.json({error: "Answers are required."}, {status: 400});
        }

        const {data, error} = await supabase.rpc("submit_fused_training", {
            p_learned_sub_principle_id: learnedId,
            p_answers: answers
        });

        if (error) {
            const code = errorCode(error.message);
            return NextResponse.json({error: fusedRefusalMessage(code), code}, {status: 400});
        }

        const result = decodeSpeciesTrainingResult(data);

        if (!result) {
            return NextResponse.json({error: fusedRefusalMessage("fused_failed"), code: "fused_failed"}, {status: 502});
        }

        return NextResponse.json({result});
    }

    return NextResponse.json({error: "Unknown action."}, {status: 400});
}
