import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {decodeAnimalTrial, sortTrials} from "@/lib/animal-trials";
import {trialMotionCaptionLanguage} from "@/lib/trial-motion/captions";
import {attachTrialMotionCaptions} from "@/lib/trial-motion/storyboards-server";

export const runtime = "nodejs";

/**
 * Animal Trials for the signed-in viewer, reading the same
 * `animal_trials_for_viewer_v1` view iOS reads so definition and per-viewer
 * state always arrive together.
 *
 * Reading a Trial needs no account — a visitor should be able to see what an
 * animal teaches before deciding to sign up; the view simply returns no
 * per-viewer state for them. Since 3.2 nothing is started here: "Make this my
 * step" makes a Trial the step with the animal (`/api/app/steps`), and the
 * animal decides in conversation when it is done.
 */

/**
 * `lang` is the page's caption language (`id` on /id pages, else null): the
 * Trial Loops' pre-translated captions ride along with the rows.
 */
async function readTrials(supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>, speciesProfileId: string, lang: string | null) {
    const {data, error} = await supabase
        .from("animal_trials_for_viewer_v1")
        .select()
        .eq("species_profile_id", speciesProfileId);

    if (error) return {error: error.message, trials: null};

    const rows = Array.isArray(data) ? data : [];
    const trials = rows
        .map(decodeAnimalTrial)
        .filter((trial): trial is NonNullable<typeof trial> => trial !== null);

    return {error: null, trials: await attachTrialMotionCaptions(supabase, sortTrials(trials), lang)};
}

export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();

    const searchParams = new URL(request.url).searchParams;
    const speciesProfileId = searchParams.get("speciesProfileId")?.trim();
    const lang = trialMotionCaptionLanguage(searchParams.get("lang"));

    if (!speciesProfileId) {
        return NextResponse.json({error: "A species profile id is required."}, {status: 400});
    }

    const {error, trials} = await readTrials(supabase, speciesProfileId, lang);

    if (error) {
        return NextResponse.json({error}, {status: 400});
    }

    return NextResponse.json({trials, isSignedIn: Boolean(user)});
}
