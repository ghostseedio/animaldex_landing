import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Profiles captures resolve to but can never be indexed through.
 *
 * The model is free to name an animal at whatever level it can prove — "Ant",
 * "Mammal", "Cockroach" — and each of those names becomes a species profile. A
 * profile with no AnimalDex number gives the capture nothing to collect, and a
 * hidden one is invisible to species_catalog_v1 and so to every admin surface
 * built on it. Captures pile up behind them silently.
 *
 * A profile pointing at a canonical elsewhere is fine: the capture follows the
 * pointer. Only the ones with nowhere to go are listed here, ordered by how many
 * captures are waiting, because that is the order they are worth fixing in.
 */

type Row = Record<string, unknown>;

const PROFILE_COLUMNS = [
    "id",
    "display_name",
    "animal_name",
    "scientific_name",
    "normalized_identity_key",
    "identity_kind",
    "identity_resolution_mode",
    "catalog_status",
    "canonical_species_profile_id",
    "canonical_game_stats",
    "created_at"
].join(",");

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase catalog access is not configured");
    return {url, key};
}

async function page(path: string, params: URLSearchParams) {
    const {url, key} = config();
    const rows: Row[] = [];

    for (let offset = 0; offset < 20_000; offset += 1000) {
        params.set("limit", "1000");
        params.set("offset", String(offset));
        const response = await fetch(`${url}/rest/v1/${path}?${params}`, {
            headers: getSupabaseHeaders(key, {Accept: "application/json"}),
            cache: "no-store"
        });

        if (!response.ok) throw new Error(`${path} query failed (${response.status})`);

        const batch = await response.json() as Row[];
        rows.push(...batch);
        if (batch.length < 1000) break;
    }

    return rows;
}

function text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const profiles = await page("species_profiles", new URLSearchParams({
            select: PROFILE_COLUMNS,
            animaldex_number: "is.null"
        }));

        const byId = new Map(profiles.map((row) => [String(row.id), row]));
        const counts = new Map<string, number>();
        const lastSeen = new Map<string, string>();

        const analyses = await page("analysis_results", new URLSearchParams({
            select: "capture_id,species_profile_id,created_at",
            species_profile_id: "not.is.null"
        }));

        for (const analysis of analyses) {
            const profileId = String(analysis.species_profile_id);
            if (!byId.has(profileId)) continue;
            counts.set(profileId, (counts.get(profileId) ?? 0) + 1);
            const at = text(analysis.created_at);
            if (at && (!lastSeen.has(profileId) || at > lastSeen.get(profileId)!)) lastSeen.set(profileId, at);
        }

        const entries = Array.from(counts.entries())
            .map(([profileId, captures]) => {
                const row = byId.get(profileId)!;

                return {
                    speciesProfileId: profileId,
                    displayName: text(row.display_name) ?? text(row.animal_name),
                    scientificName: text(row.scientific_name),
                    identityKey: text(row.normalized_identity_key),
                    identityKind: text(row.identity_kind),
                    identityResolutionMode: text(row.identity_resolution_mode),
                    catalogStatus: text(row.catalog_status),
                    // Hidden entries are missing from species_catalog_v1, so the
                    // rest of the admin cannot see or edit them at all.
                    invisibleToCatalog: text(row.catalog_status) === "hidden",
                    hasStats: Boolean(row.canonical_game_stats),
                    captures,
                    lastCaptureAt: lastSeen.get(profileId) ?? null,
                    createdAt: text(row.created_at)
                };
            })
            // A profile that points somewhere else is not stranded: the capture
            // resolves through the pointer to whatever holds the number.
            .filter((entry) => {
                const row = byId.get(entry.speciesProfileId)!;
                const canonical = text(row.canonical_species_profile_id);
                return !canonical || canonical === entry.speciesProfileId;
            })
            .sort((left, right) => right.captures - left.captures);

        return NextResponse.json({
            ok: true,
            entries,
            strandedCaptures: entries.reduce((total, entry) => total + entry.captures, 0),
            scannedProfiles: profiles.length
        });
    } catch (error) {
        console.error("[admin-catalog-dead-ends]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to scan for stranded captures"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
