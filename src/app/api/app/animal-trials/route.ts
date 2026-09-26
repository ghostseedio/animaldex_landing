import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {decodeAnimalTrial, sortTrials} from "@/lib/animal-trials";

export const runtime = "nodejs";

/**
 * Animal Trials for the signed-in viewer, reading the same
 * `animal_trials_for_viewer_v1` view iOS reads so definition and per-viewer
 * state always arrive together.
 *
 * Reading a Trial needs no account — a visitor should be able to see what an
 * animal teaches before deciding to sign up; the view simply returns no
 * per-viewer state for them. Starting one does, and every state transition that
 * matters still happens on the server: the web client may start a Trial and
 * attach evidence, never mark one active, approved or paid.
 */

async function readTrials(supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>, speciesProfileId: string) {
    const {data, error} = await supabase
        .from("animal_trials_for_viewer_v1")
        .select()
        .eq("species_profile_id", speciesProfileId);

    if (error) return {error: error.message, trials: null};

    const rows = Array.isArray(data) ? data : [];
    const trials = rows
        .map(decodeAnimalTrial)
        .filter((trial): trial is NonNullable<typeof trial> => trial !== null);

    return {error: null, trials: sortTrials(trials)};
}

export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();

    const speciesProfileId = new URL(request.url).searchParams.get("speciesProfileId")?.trim();

    if (!speciesProfileId) {
        return NextResponse.json({error: "A species profile id is required."}, {status: 400});
    }

    const {error, trials} = await readTrials(supabase, speciesProfileId);

    if (error) {
        return NextResponse.json({error}, {status: 400});
    }

    return NextResponse.json({trials, isSignedIn: Boolean(user)});
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
    const speciesProfileId = String(body.speciesProfileId ?? "").trim();
    const frequency = String(body.frequency ?? "").trim().toUpperCase();
    const action = String(body.action ?? "start");

    if (!speciesProfileId || !["LOW", "MID", "HIGH"].includes(frequency)) {
        return NextResponse.json({error: "A species profile id and frequency are required."}, {status: 400});
    }

    const rpc = action === "restart" ? "restart_expired_animal_trial" : "start_animal_trial";

    // Server-authoritative and idempotent: a second call returns the same row
    // rather than starting a second attempt.
    const {error} = await supabase.rpc(rpc, {
        p_species_profile_id: speciesProfileId,
        p_frequency: frequency,
        // The browser stores no timezone preference, so it supplies its own
        // offset and the server keeps a random HIGH activation inside local daytime.
        p_utc_offset_minutes: Number.isFinite(Number(body.utcOffsetMinutes)) ? Number(body.utcOffsetMinutes) : 0
    });

    if (error) {
        return NextResponse.json({error: error.message}, {status: 400});
    }

    // Re-read through the view so definition and state arrive together.
    const {error: readError, trials} = await readTrials(supabase, speciesProfileId);

    if (readError) {
        return NextResponse.json({error: readError}, {status: 400});
    }

    return NextResponse.json({
        trials,
        trial: trials?.find((item) => item.frequency === frequency) ?? null
    });
}
