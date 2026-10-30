import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {
    MAX_STEP_MEDIA_PATHS,
    STEP_MEDIA_BUCKET,
    STEP_VIDEO_FRAMES,
    cleanStepReport,
    isAcceptedStepMedia,
    isStepVideoFile,
    stepMediaExtension,
    stepMediaPath,
    stepProblemCode,
    stepReportReady,
    stepUuid
} from "@/lib/your-step";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "I did it" (docs/your-step/SPEC.md, section 5): the person's report on
 * their open step, before it is sent to the animal as their own message.
 *
 * Multipart: `stepId`, `speciesProfileId`, `account` (their words, at least
 * three characters), and at most one `media` file. A video comes with up to
 * three `frames` the browser sampled from it, for the record's thumbnail; its
 * clip is uploaded best effort, as the Trial proofs' clips are.
 *
 * Every file goes to the reader's own folder in the private `journal-proofs`
 * bucket, `<uid>/steps/<species>/<uuid>.<ext>`, as the reader (the storage
 * rules hold), then `attach_animal_step_report_v1` stores the report on the
 * open step. Nothing here is sent to a model, and nothing posts anywhere.
 *
 * A refusal answers `{ok: false, code}`: the RPC's (`account_too_short`,
 * `too_many_media`, `media_path_not_owned`, `step_not_open`, …) or the
 * upload's (`media_not_supported`, `media_too_large`, `upload_failed`).
 */

type Supabase = NonNullable<ReturnType<typeof createSupabaseServerClient>>;

/** A step's photo or clip, as the Trial proofs allow it. */
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const MAX_FRAME_BYTES = 4 * 1024 * 1024;

async function upload(supabase: Supabase, path: string, file: File): Promise<boolean> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const {error} = await supabase.storage.from(STEP_MEDIA_BUCKET).upload(path, bytes, {
        contentType: file.type || (path.endsWith(".mp4") ? "video/mp4" : "image/jpeg"),
        // Never over another file: every path is a new uuid.
        cacheControl: "3600",
        upsert: false
    });
    if (error) console.warn("[steps/report] upload failed", error.message.slice(0, 200));
    return !error;
}

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ok: false, code: "upload_failed"}, {status: 400});

    const stepId = stepUuid(form.get("stepId"));
    const speciesProfileId = stepUuid(form.get("speciesProfileId"));
    const account = cleanStepReport(String(form.get("account") ?? ""));
    if (!stepId || !speciesProfileId) return NextResponse.json({ok: false, code: "step_not_found"}, {status: 400});
    if (!stepReportReady(account)) return NextResponse.json({ok: false, code: "account_too_short"}, {status: 400});

    const media = form.get("media");
    const file = media instanceof File && media.size > 0 ? media : null;
    if (file && file.size > MAX_MEDIA_BYTES) return NextResponse.json({ok: false, code: "media_too_large"}, {status: 413});
    // The bucket's own types only (no HEIC): the browser has made any other photo a JPEG.
    if (file && !isAcceptedStepMedia(file)) return NextResponse.json({ok: false, code: "media_not_supported"}, {status: 415});

    const paths: string[] = [];
    if (file && isStepVideoFile(file)) {
        // The clip first, best effort; then the frames the record shows it by.
        const clip = stepMediaPath(user.id, speciesProfileId, crypto.randomUUID(), stepMediaExtension(file));
        if (await upload(supabase, clip, file)) paths.push(clip);
        const frames = form.getAll("frames")
            .filter((frame): frame is File => frame instanceof File && frame.size > 0 && frame.size <= MAX_FRAME_BYTES)
            .slice(0, STEP_VIDEO_FRAMES);
        for (const frame of frames) {
            const path = stepMediaPath(user.id, speciesProfileId, crypto.randomUUID(), "jpg");
            if (await upload(supabase, path, frame)) paths.push(path);
        }
    } else if (file) {
        const path = stepMediaPath(user.id, speciesProfileId, crypto.randomUUID(), stepMediaExtension(file));
        if (!(await upload(supabase, path, file))) {
            return NextResponse.json({ok: false, code: "upload_failed"}, {status: 502});
        }
        paths.push(path);
    }

    const {error} = await supabase.rpc("attach_animal_step_report_v1", {
        p_step_id: stepId,
        p_account: account,
        p_media_paths: paths.slice(0, MAX_STEP_MEDIA_PATHS)
    });
    if (error) {
        const code = stepProblemCode(error.message);
        if (code === "step_unavailable") console.warn("[steps/report] attach_animal_step_report_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({ok: false, code}, {status: code === "step_unavailable" ? 502 : 400});
    }
    return NextResponse.json({ok: true, mediaPaths: paths.slice(0, MAX_STEP_MEDIA_PATHS)});
}
