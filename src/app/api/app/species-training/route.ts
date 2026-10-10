import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {
    decodeSpeciesTraining,
    decodeSpeciesTrainingResult,
    trainingRefusalMessage
} from "@/lib/species-training";

export const runtime = "nodejs";

/**
 * Training for one animal: `get_species_training` to read it and
 * `submit_species_training` to answer it. Both RPCs are scoped to auth.uid()
 * server-side, so the right answers never leave the database and the reward
 * is paid there, never here.
 *
 * A signed-out visitor gets `training: null`, which gates nothing — they cannot
 * start a Trial either, and the Training step is theirs to see once they sign in.
 */

function errorCode(message: string) {
    const match = /(not_authenticated|species_not_found|training_not_found|species_not_unlocked|answers_mismatch)/i.exec(message);
    return match ? match[1].toLowerCase() : "training_failed";
}

export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const speciesProfileId = new URL(request.url).searchParams.get("speciesProfileId")?.trim();

    if (!speciesProfileId) {
        return NextResponse.json({error: "A species profile id is required."}, {status: 400});
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({training: null, isSignedIn: false});
    }

    const {data, error} = await supabase.rpc("get_species_training", {p_species_profile_id: speciesProfileId});

    if (error) {
        const code = errorCode(error.message);
        return NextResponse.json({error: trainingRefusalMessage(code), code}, {status: 400});
    }

    return NextResponse.json({training: decodeSpeciesTraining(data), isSignedIn: true});
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
    const speciesProfileId = String(body?.speciesProfileId ?? "").trim();
    const answers = Array.isArray(body?.answers) ? body.answers.map((value: unknown) => Number(value)) : null;

    if (!speciesProfileId || !answers || !answers.length || answers.some((value: number) => !Number.isInteger(value) || value < 0)) {
        return NextResponse.json({error: "A species profile id and answers are required."}, {status: 400});
    }

    const {data, error} = await supabase.rpc("submit_species_training", {
        p_species_profile_id: speciesProfileId,
        p_answers: answers
    });

    if (error) {
        const code = errorCode(error.message);
        return NextResponse.json({error: trainingRefusalMessage(code), code}, {status: 400});
    }

    const result = decodeSpeciesTrainingResult(data);

    if (!result) {
        return NextResponse.json({error: trainingRefusalMessage("training_failed"), code: "training_failed"}, {status: 502});
    }

    return NextResponse.json({result});
}
