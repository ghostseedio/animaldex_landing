import {NextResponse} from "next/server";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {
    OFFERED_APPLICATION_DOMAINS,
    POWER_APPLICATION_EVIDENCE,
    POWER_APPLICATION_LIMITS,
    type PowerApplicationResult,
    type PowerApplicationVerdict,
    decodeAnimalPower,
    powerRefusalMessage
} from "@/lib/animal-powers";

export const runtime = "nodejs";

const VERDICTS: PowerApplicationVerdict[] = ["approved", "needs_more", "rejected"];

/**
 * Owner-folder prefix is what the storage RLS and the edge function both assert
 * against, so it has to lead, lowercased.
 */
function evidenceFolder(userId: string, speciesProfileId: string) {
    return `${userId.toLowerCase()}/power-applications/${speciesProfileId.toLowerCase()}`;
}

function refusal(code: string, status = 400) {
    return NextResponse.json({error: powerRefusalMessage(code), code}, {status});
}

async function upload(
    supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>,
    path: string,
    file: File
) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const {error} = await supabase.storage.from(POWER_APPLICATION_EVIDENCE.bucket).upload(path, bytes, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false
    });
    return error?.message ?? null;
}

/**
 * "Apply It Your Way" — the written route to an Animal Power.
 *
 * The grading and the grant both live in `verify-power-application`; this route
 * only carries the account and its evidence there and the verdict back. What
 * the person wrote is never logged here.
 *
 * Evidence arrives as multipart: one `evidence` image for a photo, or the
 * `frames` the browser sampled from a video. The clip itself is never sent —
 * the bucket takes images only.
 */
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
        return NextResponse.json({error: "That submission was malformed."}, {status: 400});
    }

    const speciesProfileId = String(form.get("speciesProfileId") ?? "").trim();
    const domain = String(form.get("domain") ?? "").trim().toUpperCase();
    const account = String(form.get("account") ?? "").trim().slice(0, POWER_APPLICATION_LIMITS.maxCharacters);
    const evidenceType = String(form.get("evidenceType") ?? "").trim().toLowerCase();

    if (!speciesProfileId) {
        return NextResponse.json({error: "A species profile id is required."}, {status: 400});
    }

    if (!(OFFERED_APPLICATION_DOMAINS as string[]).includes(domain)) {
        return NextResponse.json(
            {error: powerRefusalMessage("domain_not_allowed"), code: "domain_not_allowed"},
            {status: 400}
        );
    }

    // Caught before the request is made, so a short account never reaches the grader.
    if (account.length < POWER_APPLICATION_LIMITS.minCharacters) {
        return NextResponse.json(
            {error: powerRefusalMessage("account_too_short"), code: "account_too_short"},
            {status: 400}
        );
    }

    // Missing evidence is caught here, before anything is uploaded or graded.
    const isImage = (file: unknown): file is File =>
        file instanceof File && file.size > 0;
    let files: File[];

    if (evidenceType === "photo") {
        const evidence = form.get("evidence");
        if (!isImage(evidence)) return refusal("evidence_required");
        files = [evidence];
    } else if (evidenceType === "video") {
        files = form.getAll("frames").filter(isImage);
        if (files.length === 0) return refusal("evidence_required");
        if (files.length < POWER_APPLICATION_EVIDENCE.minFrames) return refusal("video_frames_required");
        files = files.slice(0, POWER_APPLICATION_EVIDENCE.maxFrames);
    } else {
        return refusal("evidence_required");
    }

    // The bucket accepts JPEG, PNG and WebP only; anything else would fail
    // in storage, so say so in the same words.
    if (files.some((file) => !POWER_APPLICATION_EVIDENCE.photoTypes.includes(file.type))) {
        return refusal("evidence_download_failed");
    }

    const folder = evidenceFolder(user.id, speciesProfileId);
    const evidencePaths =
        evidenceType === "photo"
            ? [`${folder}/${crypto.randomUUID().toLowerCase()}.jpg`]
            : (() => {
                const clip = crypto.randomUUID().toLowerCase();
                return files.map((_, index) => `${folder}/${clip}/frame-${index}.jpg`);
            })();

    for (let index = 0; index < files.length; index += 1) {
        const failure = await upload(supabase, evidencePaths[index], files[index]);
        if (failure) return refusal("evidence_download_failed");
    }

    const invoked = await invokeAuthenticatedSupabaseFunctionResponse("verify-power-application", {
        species_profile_id: speciesProfileId,
        domain,
        account,
        evidence_type: evidenceType,
        evidence_paths: evidencePaths
    });

    if (!invoked.ok) {
        const code = invoked.payload?.error || `http_${invoked.status}`;
        return NextResponse.json(
            {error: powerRefusalMessage(code, invoked.payload?.message), code},
            {status: 400}
        );
    }

    const verdict = String(invoked.payload?.verdict ?? "");
    const result: PowerApplicationResult = {
        verdict: (VERDICTS as string[]).includes(verdict) ? verdict as PowerApplicationVerdict : "needs_more",
        reason: invoked.payload?.reason || "Tell us the one thing you actually did.",
        quotedAction: invoked.payload?.quoted_action || "",
        grantedPower: invoked.payload?.granted_power === true,
        rejectionsRemaining: Number.isFinite(Number(invoked.payload?.rejections_remaining))
            ? Number(invoked.payload.rejections_remaining)
            : POWER_APPLICATION_LIMITS.maxRejections,
        evidenceMatches: typeof invoked.payload?.evidence_matches === "boolean"
            ? invoked.payload.evidence_matches
            : undefined
    };

    // The grant is server-side; re-read rather than inferring the new state
    // from the verdict.
    const {data} = await supabase
        .from("animal_powers_for_viewer_v1")
        .select()
        .eq("species_profile_id", speciesProfileId)
        .limit(1);

    const row = Array.isArray(data) ? data[0] : null;

    return NextResponse.json({result, power: row ? decodeAnimalPower(row) : null});
}
