import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Point a capture at a chosen catalog entry.
 *
 * This is the correction that used to be written as a one-off migration: a
 * confident-looking analysis landed on the wrong species, and the fix is to move
 * the capture onto the right AnimalDex number, then recompute its game stats from
 * that profile. Re-running the model instead would usually reproduce the same
 * mistake, since it judges each frame alone.
 *
 * GET searches the catalog by number, name or identity key. POST applies the move.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CATALOG_COLUMNS = [
    "species_profile_id",
    "animaldex_number",
    "display_name",
    "animal_name",
    "scientific_name",
    "normalized_identity_key",
    "landing_page_slug",
    "identity_kind",
    "catalog_status",
    "canonical_game_stats"
].join(",");

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase maintenance access is not configured");
    return {url, key};
}

async function query(path: string, init?: RequestInit) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: getSupabaseHeaders(key, {Accept: "application/json", ...(init?.headers as Record<string, string>)}),
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(`${path.split("?")[0]} failed (${response.status}): ${await response.text()}`);
    }

    return response;
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const search = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (search.length < 2) {
        return NextResponse.json({ok: true, matches: []});
    }

    try {
        const digits = /^\d+$/.test(search);
        const params = new URLSearchParams({
            select: CATALOG_COLUMNS,
            order: "animaldex_number.asc",
            limit: "25"
        });

        if (digits) {
            params.set("animaldex_number", `eq.${search}`);
        } else {
            const term = `*${search}*`;
            params.set("or", `(display_name.ilike.${term},animal_name.ilike.${term},scientific_name.ilike.${term},normalized_identity_key.ilike.${term})`);
        }

        const response = await query(`species_catalog_v1?${params}`);
        return NextResponse.json({ok: true, matches: await response.json()});
    } catch (error) {
        console.error("[admin-capture-identity]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Catalog search failed"
        }, {status: 500});
    }
}

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const payload = await request.json().catch(() => ({})) as {captureId?: string; speciesProfileId?: string};
    const captureId = payload.captureId?.trim() ?? "";
    const speciesProfileId = payload.speciesProfileId?.trim() ?? "";

    if (!UUID.test(captureId) || !UUID.test(speciesProfileId)) {
        return NextResponse.json({ok: false, error: "A capture and a catalog entry are required"}, {status: 400});
    }

    try {
        const profileResponse = await query(`species_catalog_v1?${new URLSearchParams({
            select: CATALOG_COLUMNS,
            species_profile_id: `eq.${speciesProfileId}`,
            limit: "1"
        })}`);
        const [profile] = await profileResponse.json() as Array<Record<string, unknown>>;

        if (!profile) {
            return NextResponse.json({ok: false, error: "That catalog entry no longer exists"}, {status: 404});
        }

        // Point at the canonical profile: an alias entry carries the number for
        // display, but the collection projection keys on the canonical one, and
        // pointing a capture at the alias leaves the two disagreeing.
        const targetProfileId = String(profile.canonical_species_profile_id ?? speciesProfileId);

        // The owner's collection holds one row per species, so moving a capture
        // onto a species they already own has no representation — the two
        // captures have to become one, which is what merge is for.
        const ownerResponse = await query(`captures?${new URLSearchParams({
            select: "id,user_id",
            id: `eq.${captureId}`,
            limit: "1"
        })}`);
        const [capture] = await ownerResponse.json() as Array<{id: string; user_id: string}>;

        if (!capture) {
            return NextResponse.json({ok: false, error: "That capture no longer exists"}, {status: 404});
        }

        const siblingResponse = await query(`analysis_results?${new URLSearchParams({
            select: "capture_id",
            species_profile_id: `eq.${targetProfileId}`,
            capture_id: `neq.${captureId}`,
            limit: "50"
        })}`);
        const siblingIds = (await siblingResponse.json() as Array<{capture_id: string}>).map((row) => row.capture_id);

        if (siblingIds.length) {
            const ownedResponse = await query(`captures?${new URLSearchParams({
                select: "id",
                id: `in.(${siblingIds.join(",")})`,
                user_id: `eq.${capture.user_id}`,
                limit: "1"
            })}`);
            const [owned] = await ownedResponse.json() as Array<{id: string}>;

            if (owned) {
                return NextResponse.json({
                    ok: false,
                    error: `This owner already has a capture of that species (${owned.id}). Merge this capture into it instead of moving it.`,
                    conflictCaptureId: owned.id
                }, {status: 409});
            }
        }

        // Mirrors the identity correction written by hand in migrations: the
        // capture keeps its photo and owner, and only its identity moves.
        await query(`analysis_results?capture_id=eq.${captureId}`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json", Prefer: "return=minimal"},
            body: JSON.stringify({
                species_profile_id: targetProfileId,
                normalized_identity_key: profile.normalized_identity_key,
                animal_name: profile.animal_name ?? profile.display_name,
                scientific_name: profile.scientific_name,
                refined_identity: profile.display_name,
                identity_kind: profile.identity_kind ?? "species",
                identity_resolution_mode: "terminal"
            })
        });

        // Stats follow the profile, so they are recomputed rather than left
        // describing the animal the capture used to be. Profile stats are
        // refreshed too: the owner's collection totals counted the old species.
        const {url, key} = config();
        const recompute = await fetch(`${url}/rest/v1/rpc/recompute_capture_game_stats`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            cache: "no-store",
            body: JSON.stringify({p_capture_id: captureId, p_refresh_profile_stats: true})
        });

        const recomputeResult = await recompute.json().catch(() => null);

        return NextResponse.json({
            ok: true,
            captureId,
            animalDexNumber: profile.animaldex_number ?? null,
            displayName: profile.display_name ?? null,
            statsRecomputed: recompute.ok,
            statsError: recompute.ok ? null : (recomputeResult?.message ?? `Stats recompute failed (${recompute.status})`)
        });
    } catch (error) {
        console.error("[admin-capture-identity]", error);
        const message = error instanceof Error ? error.message : "Unable to move this capture";

        // 23505 from this write means the owner's collection projection cannot be
        // rebuilt — usually because two of their captures already resolve to one
        // species. Saying so is more use than the raw constraint text.
        if (message.includes("23505")) {
            return NextResponse.json({
                ok: false,
                error: "The owner's collection index could not be rebuilt: two of their captures already resolve to the same species. Merge those first, then move this one.",
                detail: message
            }, {status: 409});
        }

        return NextResponse.json({ok: false, error: message}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
