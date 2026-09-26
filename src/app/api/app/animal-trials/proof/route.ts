import {NextResponse} from "next/server";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {decodeAnimalTrial, sortTrials, verifierRefusalMessage} from "@/lib/animal-trials";

export const runtime = "nodejs";

/** Storage bucket the edge function and the storage RLS both assert against. */
const PROOF_BUCKET = "journal-proofs";

/**
 * Owner-folder prefix is what the storage RLS and the edge function both assert
 * against, so it has to lead.
 */
function proofFolder(userId: string, speciesProfileId: string, frequency: string) {
    return `${userId.toLowerCase()}/animal-trials/${speciesProfileId.toLowerCase()}-${frequency.toLowerCase()}`;
}

async function upload(
    supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>,
    path: string,
    file: File
) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const {error} = await supabase.storage.from(PROOF_BUCKET).upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: true
    });
    return error?.message ?? null;
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

    const form = await request.formData().catch(() => null);

    if (!form) {
        return NextResponse.json({error: "Evidence upload was malformed."}, {status: 400});
    }

    const speciesProfileId = String(form.get("speciesProfileId") ?? "").trim();
    const frequency = String(form.get("frequency") ?? "").trim().toUpperCase();
    const proofType = String(form.get("proofType") ?? "photo").trim();
    const proof = form.get("proof");

    if (!speciesProfileId || !["LOW", "MID", "HIGH"].includes(frequency)) {
        return NextResponse.json({error: "A species profile id and frequency are required."}, {status: 400});
    }

    if (!(proof instanceof File) || proof.size === 0) {
        return NextResponse.json({error: "Evidence file is required."}, {status: 400});
    }

    const folder = proofFolder(user.id, speciesProfileId, frequency);
    const framePaths: string[] = [];
    let proofPath: string;

    if (proofType === "video") {
        // Nothing server-side in this stack can decode video, so the sequence the
        // model judges is the one the browser assembled from the clip. It can
        // show a transformation — a tower standing, then down — and it cannot
        // show a count or a duration.
        const frames = form.getAll("frames").filter((frame): frame is File => frame instanceof File);

        if (frames.length < 2) {
            return NextResponse.json(
                {error: "That recording could not be read. Try recording it again.", code: "video_frames_required"},
                {status: 400}
            );
        }

        for (let index = 0; index < frames.length; index += 1) {
            const path = `${folder}/frame-${index}.jpg`;
            const failure = await upload(supabase, path, frames[index]);
            if (failure) {
                return NextResponse.json({error: failure}, {status: 400});
            }
            framePaths.push(path);
        }

        proofPath = `${folder}/clip.mp4`;
    } else {
        proofPath = `${folder}/${crypto.randomUUID()}.jpg`;
    }

    const uploadFailure = await upload(supabase, proofPath, proof);

    if (uploadFailure) {
        return NextResponse.json({error: uploadFailure}, {status: 400});
    }

    const invoked = await invokeAuthenticatedSupabaseFunctionResponse("verify-animal-trial-proof", {
        species_profile_id: speciesProfileId,
        frequency,
        proof_path: proofPath,
        frame_paths: framePaths,
        proof_type: proofType
    });

    if (!invoked.ok) {
        // The body is the whole point: it names the refusal. Without it every
        // refusal reaches the user as "try again in a moment", including the
        // ones where trying again can never work.
        const code = invoked.payload?.error || `http_${invoked.status}`;
        return NextResponse.json(
            {error: verifierRefusalMessage(code, invoked.payload?.message), code},
            {status: 400}
        );
    }

    // Re-read through the view so the caller gets the server's own post-verification state.
    const {data} = await supabase
        .from("animal_trials_for_viewer_v1")
        .select()
        .eq("species_profile_id", speciesProfileId);

    const trials = sortTrials(
        (Array.isArray(data) ? data : [])
            .map(decodeAnimalTrial)
            .filter((trial): trial is NonNullable<typeof trial> => trial !== null)
    );

    return NextResponse.json({
        verification: {
            status: invoked.payload?.status ?? "needs_more_context",
            reason: invoked.payload?.reason ?? "Try again with clearer evidence.",
            rewardXP: invoked.payload?.reward_xp ?? 0,
            framesUsed: invoked.payload?.frames_used ?? 0
        },
        trials,
        trial: trials.find((item) => item.frequency === frequency) ?? null
    });
}
