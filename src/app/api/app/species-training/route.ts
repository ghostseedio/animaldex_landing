import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {
    type SpeciesTraining,
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
 * A signed-out visitor gets a preview read from the same quiz row the RPC reads:
 * the real questions and choices, never an answer or an explanation, and
 * `unlocked: false`, so it can be read but not taken until they sign in. It
 * locks the Trials exactly as it will once they sign in; null (no quiz, or the
 * read failed) gates nothing.
 */

/** `get_species_training` pays a fixed 10 XP and 1 Credit (iOS migration 20261011120000); it cannot be called signed out. */
const PREVIEW_REWARD = {xp: 10, credits: 1};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signedOutPreview(speciesProfileId: string): Promise<SpeciesTraining | null> {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key || !UUID_PATTERN.test(speciesProfileId)) return null;

    const read = async (path: string) => {
        const response = await fetch(`${url}/rest/v1/${path}`, {headers: getSupabaseHeaders(key), cache: "no-store"});
        return response.ok ? await response.json() as Array<Record<string, unknown>> : null;
    };

    try {
        // Quizzes are keyed by the canonical row, as the RPC follows the fold.
        const profile = (await read(`species_profiles?select=id,canonical_species_profile_id&id=eq.${speciesProfileId}`))?.[0];
        const canonical = String(profile?.canonical_species_profile_id ?? profile?.id ?? speciesProfileId);
        const questions = (await read(`species_training_quizzes?select=questions,content_version&species_profile_id=eq.${canonical}`))?.[0];
        if (!questions || !Array.isArray(questions.questions)) return null;
        // Shaped as the RPC shapes it: prompt and choices only. The answer and
        // the explanation stay in the database.
        return decodeSpeciesTraining({
            species_profile_id: canonical,
            available: true,
            completed: false,
            unlocked: false,
            reward_xp: PREVIEW_REWARD.xp,
            reward_credits: PREVIEW_REWARD.credits,
            content_version: questions.content_version,
            questions: (questions.questions as Array<Record<string, unknown>>).map((question, index) => ({
                index,
                prompt: question?.prompt,
                choices: question?.choices
            }))
        });
    } catch {
        return null;
    }
}

function errorCode(message: string) {
    const match = /(not_authenticated|species_not_found|training_not_found|species_not_unlocked|answers_mismatch|training_locked)/i.exec(message);
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
        return NextResponse.json({training: await signedOutPreview(speciesProfileId), isSignedIn: false});
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
