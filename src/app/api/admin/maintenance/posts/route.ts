import {NextRequest, NextResponse} from "next/server";
import {getCaptureImageRoute} from "@/lib/capture-storage-image";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

type Row = Record<string, unknown>;

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase maintenance access is not configured");
    return {url, key};
}

async function rows(table: string, params: URLSearchParams) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
        headers: getSupabaseHeaders(key, {Accept: "application/json"}),
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`${table} query failed (${response.status}): ${await response.text()}`);
    return response.json() as Promise<Row[]>;
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const limit = Math.min(100, Math.max(10, Number(request.nextUrl.searchParams.get("limit")) || 50));
        const captureParams = new URLSearchParams({
            select: "id,user_id,status,capture_mode,title,notes,created_at,updated_at,merged_into_capture_id",
            order: "created_at.desc",
            limit: String(limit)
        });
        const requestedStatus = request.nextUrl.searchParams.get("status");
        if (requestedStatus && requestedStatus !== "all") captureParams.set("status", `eq.${requestedStatus}`);

        const captures = await rows("captures", captureParams);
        const captureIds = captures.map((row) => String(row.id));
        const userIds = Array.from(new Set(captures.map((row) => String(row.user_id))));

        const [analyses, profiles] = await Promise.all([
            captureIds.length ? rows("analysis_results", new URLSearchParams({
                select: "capture_id,animal_name,scientific_name,confidence,completed_at,error_message,model_version,capture_grade,species_profile_id,normalized_identity_key",
                capture_id: `in.(${captureIds.join(",")})`
            })) : [],
            userIds.length ? rows("profiles", new URLSearchParams({
                select: "id,display_name,username,avatar_url",
                id: `in.(${userIds.join(",")})`
            })) : []
        ]);

        // The AnimalDex number lives on the species profile, and operators work in
        // numbers rather than profile ids, so it is resolved here rather than left
        // for the panel to look up per row.
        const speciesIds = Array.from(new Set(analyses
            .map((row) => String(row.species_profile_id ?? ""))
            .filter(Boolean)));
        const species = speciesIds.length ? await rows("species_profiles", new URLSearchParams({
            select: "id,animaldex_number,display_name",
            id: `in.(${speciesIds.join(",")})`
        })) : [];
        const speciesById = new Map(species.map((row) => [String(row.id), row]));

        const analysisByCapture = new Map(analyses.map((row) => [String(row.capture_id), row]));
        const profileByUser = new Map(profiles.map((row) => [String(row.id), row]));
        const search = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
        const posts = captures.map((capture) => {
            const id = String(capture.id);
            const analysis = analysisByCapture.get(id) ?? {};
            const profile = profileByUser.get(String(capture.user_id)) ?? {};
            return {
                id,
                status: capture.status,
                captureMode: capture.capture_mode === "video" ? "video" : "photo",
                title: capture.title,
                notes: capture.notes,
                createdAt: capture.created_at,
                updatedAt: capture.updated_at,
                animalName: analysis.animal_name,
                captureGrade: analysis.capture_grade ?? null,
                animalDexNumber: speciesById.get(String(analysis.species_profile_id ?? ""))?.animaldex_number ?? null,
                identityKey: analysis.normalized_identity_key ?? null,
                scientificName: analysis.scientific_name,
                confidence: analysis.confidence,
                analysisCompletedAt: analysis.completed_at,
                analysisError: analysis.error_message,
                modelVersion: analysis.model_version,
                user: {
                    id: capture.user_id,
                    displayName: profile.display_name,
                    username: profile.username,
                    avatarUrl: profile.avatar_url
                },
                // Merging moves a capture's photos onto the target rather than
                // copying them, so a merged-away source genuinely owns no image
                // and its image route 404s. Without this the panel rendered it
                // as a broken thumbnail, which reads as a failed capture when
                // nothing failed at all.
                mergedIntoCaptureId: capture.merged_into_capture_id ?? null,
                imageUrl: capture.merged_into_capture_id
                    ? getCaptureImageRoute(String(capture.merged_into_capture_id))
                    : getCaptureImageRoute(id)
            };
        }).filter((post) => !search || [
            post.id, post.title, post.animalName, post.scientificName,
            post.user.displayName, post.user.username
        ].some((value) => String(value ?? "").toLowerCase().includes(search)));

        return NextResponse.json({ok: true, posts, generatedAt: new Date().toISOString()});
    } catch (error) {
        console.error("[admin-maintenance-posts]", error);
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Unable to load posts"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
