import {NextResponse} from "next/server";
import {createSignedStorageUrl} from "@/lib/capture-storage-image";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * What this person actually submitted for one Trial, and nothing else. Web
 * twin of iOS `fetchSubmission`: the still (or a frame of the recording) and
 * the written answer. The verdict lives on the Trial row itself.
 *
 * `user_animal_trials` is owner-only under RLS, so the viewer's session is
 * what scopes the read; the storage URL is signed only for a path that row
 * names, so nothing outside their own folder is ever reachable here.
 */
export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({image: null, text: null, signedIn: false});
    }

    const params = new URL(request.url).searchParams;
    const speciesProfileId = params.get("speciesProfileId")?.trim();
    const frequency = params.get("frequency")?.trim().toUpperCase();
    if (!speciesProfileId || !frequency) {
        return NextResponse.json({error: "A species profile id and frequency are required."}, {status: 400});
    }

    const {data, error} = await supabase
        .from("user_animal_trials")
        .select("proof_type, proof_text, proof_storage_bucket, proof_storage_path, proof_frame_paths")
        .eq("user_id", user.id)
        .eq("species_profile_id", speciesProfileId)
        .eq("frequency", frequency)
        .limit(1);

    if (error) {
        return NextResponse.json({error: error.message}, {status: 400});
    }

    const row = (Array.isArray(data) ? data[0] : null) as {
        proof_type?: string | null;
        proof_text?: string | null;
        proof_storage_bucket?: string | null;
        proof_storage_path?: string | null;
        proof_frame_paths?: string[] | null;
    } | null;

    if (!row) {
        return NextResponse.json({image: null, text: null, signedIn: true});
    }

    const written = row.proof_text?.trim() || null;
    const rawPath = row.proof_type === "video"
        ? row.proof_frame_paths?.[0]
        : row.proof_type === "photo" || row.proof_type === "screenshot"
            ? row.proof_storage_path
            : null;
    const path = rawPath?.trim() || null;
    const image = row.proof_storage_bucket && path
        ? await createSignedStorageUrl(row.proof_storage_bucket, path).catch(() => null)
        : null;

    const response = NextResponse.json({image: image ?? null, text: written, signedIn: true});
    response.headers.set("Cache-Control", "private, no-store");
    return response;
}
