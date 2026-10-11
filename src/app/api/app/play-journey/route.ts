import {NextResponse} from "next/server";
import {getAppCaptures} from "@/data/authenticated-app";
import {type AnimalPower, decodeAnimalPower, decodeCapturePlayEligibility, earnedLabel} from "@/lib/animal-powers";
import type {PlayJourneyCard, PlayJourneyFused, PlayJourneyStepFailure} from "@/lib/play-journey";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * The bulk reads behind the Play tab's Powers page — web twin of iOS
 * `SupabasePlayJourneyService` plus the Powers and eligibility reads
 * `MatchupsHubView.refreshJourneyInputs` makes, and the challenge summary the
 * hub's Wins/Net figures come from (`challenge_profile_stats_v1`, never the
 * paged history: reducing over a page made the totals climb on "load more").
 *
 * Every read is the signed-in player's own rows. The fused Powers table has
 * no user column, so it is read for the player's own capture ids only.
 */

type Supabase = NonNullable<ReturnType<typeof createSupabaseServerClient>>;

function str(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function readTrainedSpecies(supabase: Supabase, userId: string) {
    const {data, error} = await supabase.from("user_species_trainings").select("species_profile_id").eq("user_id", userId);
    if (error) return null;
    return Array.from(new Set((data ?? []).map((row) => str(row.species_profile_id)).filter((id): id is string => Boolean(id))));
}

async function readStepFailures(supabase: Supabase, userId: string) {
    const {data, error} = await supabase
        .from("user_power_step_failures")
        .select("species_profile_id,step,failed_at")
        .eq("user_id", userId);
    if (error) return null;
    const failures: PlayJourneyStepFailure[] = [];
    for (const row of data ?? []) {
        const species = str(row.species_profile_id);
        const failedAt = str(row.failed_at);
        const step = row.step === "training" ? "train" : row.step === "proof" ? "proveIt" : null;
        if (species && failedAt && step) failures.push({speciesProfileId: species, step, failedAt});
    }
    return failures;
}

async function readFusedPowers(supabase: Supabase, captureIds: string[]) {
    const fused: PlayJourneyFused[] = [];
    for (let start = 0; start < captureIds.length; start += 100) {
        const {data, error} = await supabase
            .from("capture_learned_sub_principles")
            .select("id,capture_id,learned_sub_principle_name,created_at,training_completed_at,earned_at,training_failed_at,proof_failed_at")
            .in("capture_id", captureIds.slice(start, start + 100))
            .order("created_at", {ascending: false});
        if (error) return null;
        for (const row of data ?? []) {
            const id = str(row.id);
            const captureId = str(row.capture_id);
            const createdAt = str(row.created_at);
            if (!id || !captureId || !createdAt) continue;
            fused.push({
                id,
                captureId: captureId.toLowerCase(),
                name: str(row.learned_sub_principle_name) ?? "Fused Power",
                createdAt,
                trainingCompletedAt: str(row.training_completed_at),
                earnedAt: str(row.earned_at),
                trainingFailedAt: str(row.training_failed_at),
                proofFailedAt: str(row.proof_failed_at)
            });
        }
    }
    return fused;
}

async function readEarnedPowers(supabase: Supabase) {
    const {data, error} = await supabase
        .from("animal_powers_for_viewer_v1")
        .select()
        .not("earned_at", "is", null)
        .order("earned_at", {ascending: false});
    if (error) return null;
    return (data ?? []).map(decodeAnimalPower).filter((power): power is AnimalPower => power !== null);
}

async function readChallengeSummary(supabase: Supabase, userId: string) {
    const {data} = await supabase
        .from("challenge_profile_stats_v1")
        .select("wins,losses,net_credits")
        .eq("user_id", userId)
        .limit(1);
    const row = Array.isArray(data) ? data[0] : null;
    return {
        wins: Number(row?.wins ?? 0) || 0,
        losses: Number(row?.losses ?? 0) || 0,
        netCredits: Number(row?.net_credits ?? 0) || 0
    };
}

export async function GET() {
    const supabase = createSupabaseServerClient();
    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({error: "Authentication required."}, {status: 401});
    }

    const [eligibilityResult, captures, trainedSpecies, failures, earnedPowers, summary] = await Promise.all([
        supabase.from("capture_play_eligibility_v1").select(),
        getAppCaptures().catch(() => []),
        readTrainedSpecies(supabase, user.id),
        readStepFailures(supabase, user.id),
        readEarnedPowers(supabase),
        readChallengeSummary(supabase, user.id)
    ]);

    const capturesById = new Map(captures.map((capture) => [capture.captureId.toLowerCase(), capture]));
    // Names the library does not have come from the Power rows, as iOS does.
    const namesBySpecies = new Map<string, string>();
    for (const power of earnedPowers ?? []) namesBySpecies.set(power.speciesProfileId.toLowerCase(), power.speciesDisplayName);

    const eligibilityRows = eligibilityResult.error ? null : (eligibilityResult.data ?? [])
        .map(decodeCapturePlayEligibility)
        .filter((row): row is NonNullable<typeof row> => row !== null);

    const cards: PlayJourneyCard[] = [];
    for (const row of eligibilityRows ?? []) {
        const capture = capturesById.get(row.captureId);
        const name = capture?.displayName
            ?? (row.canonicalSpeciesProfileId ? namesBySpecies.get(row.canonicalSpeciesProfileId.toLowerCase()) : null);
        if (!name) continue;
        cards.push({
            captureId: row.captureId,
            speciesProfileId: row.canonicalSpeciesProfileId,
            animalName: name,
            capturedAt: capture?.capturedAt ?? null,
            imageSrc: capture?.imageSrc || null,
            powerName: row.principleName,
            gate: row.powerGateStatus
        });
    }

    const fused = await readFusedPowers(supabase, cards.map((card) => card.captureId));

    return NextResponse.json({
        // Null where a read failed: the page keeps what it already had.
        loaded: eligibilityRows !== null,
        cards,
        trainedSpecies,
        failures,
        fused,
        earnedPowers: earnedPowers?.map((power) => ({
            speciesProfileId: power.speciesProfileId,
            speciesDisplayName: power.speciesDisplayName,
            powerName: power.principleNameAtEarning || power.principleName,
            route: power.earnedVia ? earnedLabel(power.earnedVia) : null,
            earnedAt: power.earnedAt
        })) ?? null,
        summary
    });
}
