import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {type AnimalTrial, decodeAnimalTrial, isComplete, isFailed} from "@/lib/animal-trials";
import {animalTrialDiscoverPostId} from "@/lib/animal-trial-post-id";

export const runtime = "nodejs";

type Supabase = NonNullable<ReturnType<typeof createSupabaseServerClient>>;

function decodeRows(data: unknown) {
    return (Array.isArray(data) ? data : [])
        .map(decodeAnimalTrial)
        .filter((trial): trial is AnimalTrial => trial !== null);
}

/**
 * Qualities travel on the Trial view once `best_use_cases` is selected
 * there. For a species whose own row is empty, read the same labels the
 * catalog already publishes. Web twin of iOS `attachingMissingQualities`.
 */
async function attachMissingQualities(supabase: Supabase, trials: AnimalTrial[]) {
    const missing = Array.from(new Set(
        trials.filter((trial) => isComplete(trial) && trial.bestUseCases.length === 0).map((trial) => trial.speciesProfileId)
    ));
    if (!missing.length) return trials;

    const labelsBySpecies = new Map<string, string[]>();
    for (let start = 0; start < missing.length; start += 40) {
        const chunk = missing.slice(start, start + 40);
        const {data} = await supabase
            .from("species_catalog_v1")
            .select("species_profile_id,best_use_cases")
            .in("species_profile_id", chunk);
        for (const row of (Array.isArray(data) ? data : []) as Array<{species_profile_id: string; best_use_cases: unknown}>) {
            const labels = Array.isArray(row.best_use_cases)
                ? row.best_use_cases.map((item) => String(item).trim()).filter(Boolean)
                : [];
            if (labels.length) labelsBySpecies.set(row.species_profile_id, labels);
        }
    }

    return trials.map((trial) => {
        if (trial.bestUseCases.length) return trial;
        const labels = labelsBySpecies.get(trial.speciesProfileId);
        return labels?.length ? {...trial, bestUseCases: labels} : trial;
    });
}

/** Completed Trials, plus the ones whose evidence never succeeded. */
async function readTrialHistory(supabase: Supabase) {
    const {data, error} = await supabase
        .from("animal_trials_for_viewer_v1")
        .select()
        .in("status", ["completed", "expired", "abandoned", "active", "proof_submitted"]);
    if (error) return [];
    const finished = decodeRows(data).filter((trial) => isComplete(trial) || isFailed(trial));
    return attachMissingQualities(supabase, finished);
}

/**
 * Explore › Battles › History › Trials: what was done, and what never
 * succeeded, as the signed-in viewer. The open Trials went with the Powers
 * page in 3.2: a Trial is now made a step from the animal's chat or Bond tab.
 */
export async function GET() {
    const supabase = createSupabaseServerClient();
    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({error: "Authentication required."}, {status: 401});
    }

    const history = await readTrialHistory(supabase);

    // A finished Trial is a Discover post. The id is deterministic, so the
    // history row can link straight to the card without a lookup.
    const postIds = Object.fromEntries(
        history
            .filter((trial) => isComplete(trial) ? trial.sharePublicly : true)
            .map((trial) => [
                `${trial.speciesProfileId}:${trial.frequency}`,
                animalTrialDiscoverPostId(user.id, trial.speciesProfileId, trial.frequency)
            ])
    );

    const response = NextResponse.json({history, postIds});
    response.headers.set("Cache-Control", "private, no-store");
    return response;
}
