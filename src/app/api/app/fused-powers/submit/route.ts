import {NextResponse} from "next/server";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {OFFERED_APPLICATION_DOMAINS, POWER_APPLICATION_EVIDENCE, POWER_APPLICATION_LIMITS} from "@/lib/animal-powers";
import {decodeFusedSubmitResult, fusedRefusalMessage} from "@/lib/fused-powers";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Proving a fused Power: the fused Trial (`kind: trial`) or Apply It Your Way
 * (`kind: application`), both graded and paid by the `fused-power` edge
 * function. This route only carries the evidence into the proofs bucket and the
 * verdict back.
 *
 * Evidence arrives as multipart, exactly as the Trial and Apply It Your Way
 * routes take it: one `evidence` image for a photo, or the 2–4 `frames` the
 * browser sampled from a video, plus that video's `clip` — uploaded best-effort,
 * like a Trial's, since only the frames are graded.
 */

const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

function refusal(code: string, status = 400, serverMessage?: string | null) {
    return NextResponse.json({error: fusedRefusalMessage(code, serverMessage), code}, {status});
}

/** Owner-folder first: the storage RLS and the edge function both assert it. */
function evidenceFolder(userId: string, learnedId: string) {
    return `${userId.toLowerCase()}/fused-powers/${learnedId.toLowerCase()}`;
}

async function upload(
    supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>,
    path: string,
    file: File
) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const {error} = await supabase.storage.from(POWER_APPLICATION_EVIDENCE.bucket).upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: false
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
        return NextResponse.json({error: "That submission was malformed."}, {status: 400});
    }

    const learnedId = String(form.get("learnedId") ?? "").trim();
    const kind = String(form.get("kind") ?? "").trim();
    const evidenceType = String(form.get("evidenceType") ?? "").trim().toLowerCase();

    if (!learnedId || (kind !== "trial" && kind !== "application")) {
        return NextResponse.json({error: "A fused Power and a route are required."}, {status: 400});
    }

    let domain: string | null = null;
    let account: string | null = null;

    if (kind === "application") {
        domain = String(form.get("domain") ?? "").trim().toUpperCase();
        account = String(form.get("account") ?? "").trim().slice(0, POWER_APPLICATION_LIMITS.maxCharacters);
        if (!(OFFERED_APPLICATION_DOMAINS as string[]).includes(domain)) return refusal("domain_not_allowed");
        // Caught before anything is uploaded or graded.
        if (account.length < POWER_APPLICATION_LIMITS.minCharacters) return refusal("account_too_short");
    }

    const isFile = (file: unknown): file is File => file instanceof File && file.size > 0;
    let files: File[];

    if (evidenceType === "photo") {
        const evidence = form.get("evidence");
        if (!isFile(evidence)) return refusal("evidence_required");
        files = [evidence];
    } else if (evidenceType === "video") {
        files = form.getAll("frames").filter(isFile);
        if (files.length === 0) return refusal("evidence_required");
        if (files.length < POWER_APPLICATION_EVIDENCE.minFrames) return refusal("video_frames_required");
        files = files.slice(0, POWER_APPLICATION_EVIDENCE.maxFrames);
    } else {
        return refusal("evidence_required");
    }

    if (files.some((file) => !POWER_APPLICATION_EVIDENCE.photoTypes.includes(file.type))) {
        return refusal("evidence_download_failed");
    }

    const folder = evidenceFolder(user.id, learnedId);
    const id = crypto.randomUUID().toLowerCase();
    const evidencePaths = evidenceType === "photo"
        ? [`${folder}/${id}.jpg`]
        : files.map((_, index) => `${folder}/${id}/frame-${index}.jpg`);

    for (let index = 0; index < files.length; index += 1) {
        const failure = await upload(supabase, evidencePaths[index], files[index]);
        if (failure) return refusal("evidence_download_failed");
    }

    if (evidenceType === "video") {
        const clip = form.get("clip");
        if (isFile(clip) && VIDEO_TYPES.includes(clip.type)) {
            const extension = clip.type === "video/quicktime" ? "mov" : clip.type === "video/webm" ? "webm" : "mp4";
            const failure = await upload(supabase, `${folder}/${id}/clip.${extension}`, clip);
            // The grader reads only the frames already uploaded.
            if (failure) console.warn("[fused-powers/submit] clip upload failed, grading from frames", failure);
        }
    }

    const invoked = await invokeAuthenticatedSupabaseFunctionResponse("fused-power", {
        action: "submit",
        learned_sub_principle_id: learnedId,
        kind,
        evidence_type: evidenceType,
        evidence_paths: evidencePaths,
        ...(kind === "application" ? {domain, account} : {})
    });

    if (!invoked.ok) {
        const code = invoked.payload?.error || `http_${invoked.status}`;
        return refusal(code, invoked.status === 503 ? 503 : 400, invoked.payload?.message);
    }

    const result = decodeFusedSubmitResult(invoked.payload);

    if (!result) {
        return refusal("grading_unavailable", 502);
    }

    return NextResponse.json({result});
}
