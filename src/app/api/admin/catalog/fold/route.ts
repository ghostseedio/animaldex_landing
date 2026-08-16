import {NextRequest, NextResponse} from "next/server";
import {invalidateDatabaseSpeciesCache} from "@/data/database-species-pages";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Give a breed's AnimalDex number back to the animal it is a breed of.
 *
 * The catalog indexes the parent taxon; a breed is meant to be how a capture is
 * *described*, not a slot of its own. Otherwise one animal becomes hundreds of
 * entries — every cattle breed, every rabbit, every pigeon — and a collection
 * stops meaning anything.
 *
 * Nothing about the identification changes. resolve_effective_animaldex_number
 * already returns the parent's number for a profile that has none of its own, so
 * releasing the breed's number is the whole operation: the capture still reads
 * "Pekin Duck" and now counts as Domestic Duck #2098.
 *
 * It refuses when no parent resolves. Releasing a number with nothing behind it
 * would quietly strand every capture on the entry as unindexed, which is worse
 * than the duplication it was meant to fix.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase catalog access is not configured");
    return {url, key};
}

async function rows(path: string, init?: RequestInit) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: getSupabaseHeaders(key, {Accept: "application/json", ...(init?.headers as Record<string, string>)}),
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`${path.split("?")[0]} failed (${response.status}): ${await response.text()}`);
    const text = await response.text();
    return (text ? JSON.parse(text) : []) as Row[];
}

async function rpc(name: string, args: Record<string, unknown>) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
        cache: "no-store",
        body: JSON.stringify(args)
    });
    if (!response.ok) throw new Error(`${name} failed (${response.status}): ${await response.text()}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

/** Captures on an entry, and who holds them. */
async function holders(speciesProfileId: string) {
    const analyses = await rows(`analysis_results?${new URLSearchParams({
        select: "capture_id",
        species_profile_id: `eq.${speciesProfileId}`,
        limit: "500"
    })}`);

    if (!analyses.length) return {captureIds: [] as string[], userIds: new Set<string>()};

    const captureIds = analyses.map((row) => String(row.capture_id));
    const userIds = new Set<string>();

    for (let index = 0; index < captureIds.length; index += 100) {
        const batch = await rows(`captures?${new URLSearchParams({
            select: "user_id",
            id: `in.(${captureIds.slice(index, index + 100).join(",")})`
        })}`);
        for (const capture of batch) userIds.add(String(capture.user_id));
    }

    return {captureIds, userIds};
}

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const body = await request.json().catch(() => ({})) as {speciesProfileId?: string; confirm?: boolean};
    const speciesProfileId = body.speciesProfileId?.trim() ?? "";

    if (!UUID.test(speciesProfileId)) {
        return NextResponse.json({ok: false, error: "A catalog entry is required"}, {status: 400});
    }

    try {
        const [profile] = await rows(`species_profiles?${new URLSearchParams({
            select: "id,animaldex_number,display_name,scientific_name,normalized_identity_key,identity_kind",
            id: `eq.${speciesProfileId}`,
            limit: "1"
        })}`);

        if (!profile) return NextResponse.json({ok: false, error: "No catalog entry with that id"}, {status: 404});
        if (profile.animaldex_number == null) {
            return NextResponse.json({ok: false, error: "This entry already has no number of its own."}, {status: 409});
        }

        const parentId = await rpc("find_indexed_domestic_parent_profile_id", {
            p_scientific_name: profile.scientific_name,
            p_identity_key: profile.normalized_identity_key
        }) as string | null;

        if (!parentId) {
            return NextResponse.json({
                ok: false,
                error: `No indexed parent resolves for "${profile.scientific_name ?? profile.display_name}". Releasing #${profile.animaldex_number} would leave its captures unindexed, so the parent has to exist and be mapped first.`,
                needsParent: true,
                scientificName: profile.scientific_name ?? null
            }, {status: 409});
        }

        const [parent] = await rows(`species_profiles?${new URLSearchParams({
            select: "id,animaldex_number,display_name,normalized_identity_key",
            id: `eq.${parentId}`,
            limit: "1"
        })}`);

        const child = await holders(speciesProfileId);
        const parentHolders = await holders(parentId);
        // Somebody holding both keeps one card where they had two, so the count
        // of entries in their dex goes down by one. That is the real cost and it
        // is stated before anything moves.
        const losing = Array.from(child.userIds).filter((userId) => parentHolders.userIds.has(userId));

        const preview = {
            entry: {
                speciesProfileId,
                number: profile.animaldex_number,
                displayName: profile.display_name,
                scientificName: profile.scientific_name,
                identityKind: profile.identity_kind
            },
            parent: {
                speciesProfileId: parentId,
                number: parent?.animaldex_number ?? null,
                displayName: parent?.display_name ?? null
            },
            captures: child.captureIds.length,
            members: child.userIds.size,
            membersLosingAnEntry: losing.length
        };

        if (!body.confirm) {
            return NextResponse.json({ok: false, needsConfirmation: true, preview}, {status: 409});
        }

        await rows(`species_profiles?id=eq.${speciesProfileId}`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json", Prefer: "return=minimal"},
            // The entry stays: its name is still how these captures are
            // described, and its identity key still has to resolve.
            body: JSON.stringify({animaldex_number: null, updated_at: new Date().toISOString()})
        });

        // Progression is keyed on the effective number, so every capture that
        // just changed which entry it counts as needs recomputing.
        const recomputed: string[] = [];
        const failed: string[] = [];

        for (const captureId of child.captureIds) {
            try {
                await rpc("recompute_capture_game_stats", {p_capture_id: captureId, p_refresh_profile_stats: true});
                recomputed.push(captureId);
            } catch {
                failed.push(captureId);
            }
        }

        invalidateDatabaseSpeciesCache();

        return NextResponse.json({
            ok: true,
            ...preview,
            released: profile.animaldex_number,
            recomputed: recomputed.length,
            recomputeFailed: failed
        });
    } catch (error) {
        console.error("[admin-catalog-fold]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to fold this entry"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
