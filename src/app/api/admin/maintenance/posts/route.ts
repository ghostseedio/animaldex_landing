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
                select: "capture_id,animal_name,scientific_name,confidence,completed_at,error_message,model_version,capture_grade,species_profile_id,normalized_identity_key,identity_resolution_mode",
                capture_id: `in.(${captureIds.join(",")})`
            })) : [],
            userIds.length ? rows("profiles", new URLSearchParams({
                select: "id,display_name,username,avatar_url",
                id: `in.(${userIds.join(",")})`
            })) : []
        ]);

        /**
         * Resolve the AnimalDex number the way the app does, not just by profile id.
         *
         * An analysis can carry an identity key with no species_profile_id at all,
         * and the profile a key names is often a hidden stand-in whose number lives
         * on its canonical parent — "domestic_cat" is hidden and points at "cat"
         * #1008. Reading only the profile id reports those captures as unindexed
         * when the animal is in the catalog, which is the opposite of the truth.
         */
        const speciesIds = new Set(analyses
            .map((row) => String(row.species_profile_id ?? ""))
            .filter(Boolean));
        const identityKeys = Array.from(new Set(analyses
            .filter((row) => !row.species_profile_id)
            .map((row) => String(row.normalized_identity_key ?? ""))
            .filter(Boolean)));

        const byKey = identityKeys.length ? await rows("species_profiles", new URLSearchParams({
            select: "id,animaldex_number,display_name,normalized_identity_key,canonical_species_profile_id",
            normalized_identity_key: `in.(${identityKeys.join(",")})`
        })) : [];
        byKey.forEach((row) => speciesIds.add(String(row.id)));

        const direct = speciesIds.size ? await rows("species_profiles", new URLSearchParams({
            select: "id,animaldex_number,display_name,normalized_identity_key,canonical_species_profile_id",
            id: `in.(${Array.from(speciesIds).join(",")})`
        })) : [];

        // One more hop for the profiles whose number sits on a canonical parent.
        const canonicalIds = Array.from(new Set(direct
            .filter((row) => row.animaldex_number == null && row.canonical_species_profile_id)
            .map((row) => String(row.canonical_species_profile_id))
            .filter((id) => !speciesIds.has(id))));
        const canonical = canonicalIds.length ? await rows("species_profiles", new URLSearchParams({
            select: "id,animaldex_number,display_name,normalized_identity_key,canonical_species_profile_id",
            id: `in.(${canonicalIds.join(",")})`
        })) : [];

        const profileById = new Map([...direct, ...canonical].map((row) => [String(row.id), row]));
        const profileByKey = new Map(byKey.map((row) => [String(row.normalized_identity_key), row]));

        const resolveIndex = (analysis: Row) => {
            const startId = String(analysis.species_profile_id ?? "");
            const start = startId
                ? profileById.get(startId)
                : profileByKey.get(String(analysis.normalized_identity_key ?? ""));

            if (!start) return {number: null, via: null as string | null};

            if (start.animaldex_number != null) {
                return {
                    number: Number(start.animaldex_number),
                    via: startId ? null : String(start.normalized_identity_key ?? "")
                };
            }

            const parent = start.canonical_species_profile_id
                ? profileById.get(String(start.canonical_species_profile_id))
                : null;

            return parent?.animaldex_number != null
                ? {number: Number(parent.animaldex_number), via: String(start.normalized_identity_key ?? "")}
                : {number: null, via: null};
        };

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
                animalDexNumber: resolveIndex(analysis).number,
                // Null profile id means the capture is not linked to the catalog at
                // all, which is what keeps it out of the owner's collection index.
                indexLinked: Boolean(analysis.species_profile_id),
                indexVia: resolveIndex(analysis).via,
                // "refinable" is the pipeline saying it stopped at a parent identity
                // like domestic_cat and wants a breed before it links; that is a
                // different state from a terminal identity that simply never linked.
                identityResolutionMode: analysis.identity_resolution_mode ?? null,
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
