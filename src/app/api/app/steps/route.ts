import {NextResponse} from "next/server";
import {createSignedStorageUrl} from "@/lib/capture-storage-image";
import {createSupabaseServerClient, createSupabaseServiceClient} from "@/lib/supabase/server";
import {
    STEP_MEDIA_BUCKET,
    decodeOpenSteps,
    decodeStepRecords,
    decodeStepResult,
    isOwnStepMediaPath,
    stepFrequency,
    stepMediaKind,
    stepProblemCode,
    stepUuid,
    type StepRecordMedia,
    type StepRecordWithMedia
} from "@/lib/your-step";
import {decodeArkAccept} from "@/lib/ark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AnimalDex 3.2 "Your step" (docs/your-step/SPEC.md, section 3), as the
 * signed-in reader. Every RPC acts on auth.uid()'s own rows only.
 *
 * GET                    every open step across their animals (`animal_open_steps_v1`),
 *                        with each species' icon-art slug: Companions' "Your steps".
 * GET ?speciesProfileId= the done steps with one animal (`animal_step_records_v1`),
 *                        newest first, each photo or video signed for an hour: the
 *                        Bond tab's "Your record with {name}".
 * POST {action: "accept", stepId}                   "I'll do it" (`accept_animal_step_v1`), with its
 *                                                   Life Sim reveal (`reveal`, `revealSkipped`) when the
 *                                                   server plays one (docs/life-sim/CONTRACT.md, section 3).
 * POST {action: "drop", stepId}                     "Something else" (`drop_animal_step_v1`).
 * POST {action: "fromTrial", speciesProfileId, frequency}
 *                                                   "Make this my step" (`set_animal_step_from_trial_v1`).
 *
 * A refusal answers `{ok: false, code}`, the RPC's own code (SERVER.md:
 * `step_not_found`, `step_not_open`, `species_not_unlocked`, …) for the
 * client to say in words. Until the migration is live the reads answer
 * `available: false` and the screens show without them; the writes fail with
 * `step_unavailable`.
 */

type Supabase = NonNullable<ReturnType<typeof createSupabaseServerClient>>;

const SIGNED_MEDIA_SECONDS = 60 * 60;

function failed(what: string, message: string) {
    const code = stepProblemCode(message);
    if (code === "step_unavailable") console.warn(`[steps] ${what} failed`, message.slice(0, 200));
    return NextResponse.json({ok: false, code}, {status: code === "step_unavailable" ? 502 : code === "not_authenticated" ? 401 : 400});
}

/** The icon art is filed by the species' identity key, written with hyphens. */
async function slugsFor(ids: string[]): Promise<Map<string, string>> {
    const service = createSupabaseServiceClient();
    if (!service || ids.length === 0) return new Map();
    try {
        const {data} = await service.from("species_profiles").select("id, normalized_identity_key").in("id", ids.slice(0, 200));
        return new Map((data ?? []).flatMap((row) => {
            const key = typeof row.normalized_identity_key === "string" ? row.normalized_identity_key.trim() : "";
            return key ? [[String(row.id).toLowerCase(), key.replace(/_/g, "-")] as [string, string]] : [];
        }));
    } catch {
        return new Map();
    }
}

async function signedMedia(userId: string, paths: string[]): Promise<StepRecordMedia[]> {
    const own = paths.filter((path) => isOwnStepMediaPath(userId, path));
    const signed = await Promise.all(own.map(async (path) => {
        const url = await createSignedStorageUrl(STEP_MEDIA_BUCKET, path, SIGNED_MEDIA_SECONDS).catch(() => null);
        return url ? [{path, url, kind: stepMediaKind(path)} satisfies StepRecordMedia] : [];
    }));
    return signed.flat();
}

async function openSteps(supabase: Supabase) {
    const {data, error} = await supabase.rpc("animal_open_steps_v1");
    if (error) {
        console.warn("[steps] animal_open_steps_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({steps: [], available: false});
    }
    const steps = decodeOpenSteps(data);
    const slugs = await slugsFor(Array.from(new Set(steps.map((step) => step.speciesProfileId))));
    return NextResponse.json({
        steps: steps.map((step) => ({...step, slug: step.slug ?? slugs.get(step.speciesProfileId) ?? null})),
        available: true
    });
}

async function records(supabase: Supabase, userId: string, speciesProfileId: string) {
    const {data, error} = await supabase.rpc("animal_step_records_v1", {p_species_profile_id: speciesProfileId});
    if (error) {
        console.warn("[steps] animal_step_records_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({records: [], available: false});
    }
    const rows = decodeStepRecords(data);
    const withMedia: StepRecordWithMedia[] = await Promise.all(rows.map(async (row) => ({
        ...row,
        media: await signedMedia(userId, row.mediaPaths)
    })));
    return NextResponse.json({records: withMedia, available: true}, {headers: {"Cache-Control": "private, no-store"}});
}

export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const raw = new URL(request.url).searchParams.get("speciesProfileId");
    if (raw === null) return openSteps(supabase);
    const speciesProfileId = stepUuid(raw);
    if (!speciesProfileId) return NextResponse.json({error: "A species profile id is required."}, {status: 400});
    return records(supabase, user.id, speciesProfileId);
}

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "accept" || action === "drop") {
        const stepId = stepUuid(body.stepId);
        if (!stepId) return NextResponse.json({ok: false, code: "step_not_found"}, {status: 400});
        const rpc = action === "accept" ? "accept_animal_step_v1" : "drop_animal_step_v1";
        const {data, error} = await supabase.rpc(rpc, {p_step_id: stepId});
        if (error) return failed(rpc, error.message);
        if (action === "drop") return NextResponse.json({ok: true, step: null});
        // An old server answers `{step}` alone: no reveal, nothing skipped.
        const accepted = decodeArkAccept(data, decodeStepResult);
        return NextResponse.json({ok: true, step: accepted.step, reveal: accepted.reveal, revealSkipped: accepted.revealSkipped});
    }

    if (action === "fromTrial") {
        const speciesProfileId = stepUuid(body.speciesProfileId);
        const frequency = stepFrequency(body.frequency);
        if (!speciesProfileId || !frequency) {
            return NextResponse.json({ok: false, code: "invalid_frequency"}, {status: 400});
        }
        const {data, error} = await supabase.rpc("set_animal_step_from_trial_v1", {
            p_species_profile_id: speciesProfileId,
            p_frequency: frequency
        });
        if (error) return failed("set_animal_step_from_trial_v1", error.message);
        const accepted = decodeArkAccept(data, decodeStepResult);
        return accepted.step
            ? NextResponse.json({ok: true, step: accepted.step, reveal: accepted.reveal, revealSkipped: accepted.revealSkipped})
            : failed("set_animal_step_from_trial_v1", "no step returned");
    }

    return NextResponse.json({ok: false, code: "step_unavailable"}, {status: 400});
}
