import {NextResponse} from "next/server";
import {createSupabaseServerClient, createSupabaseServiceClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The bond with your animals (AnimalDex 20261028150000;
 * docs/companion-loop/SPEC.md, phases 2 and 4).
 *
 * GET lists every animal you hold from `animal_companions_v1`, in the
 * server's order (an unread message, a referral waiting, an open step, then
 * the most recent), each with the species slug its icon art is filed under.
 * GET ?speciesProfileId= reads one animal's bond from `animal_bond_v1`.
 *
 * Both run as you. Until the migration is live they fail; the answer is then
 * an empty list or no bond with `available: false`, and the screens show
 * without their bond parts.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The icon art is filed by the species' identity key, written with hyphens. */
async function slugsFor(ids: string[]): Promise<Map<string, string>> {
    const service = createSupabaseServiceClient();
    if (!service || ids.length === 0) return new Map();
    try {
        const {data} = await service
            .from("species_profiles")
            .select("id, normalized_identity_key")
            .in("id", ids.slice(0, 500));
        return new Map((data ?? []).flatMap((row) => {
            const key = typeof row.normalized_identity_key === "string" ? row.normalized_identity_key.trim() : "";
            return key ? [[String(row.id).toLowerCase(), key.replace(/_/g, "-")] as [string, string]] : [];
        }));
    } catch {
        return new Map();
    }
}

export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const speciesProfileId = new URL(request.url).searchParams.get("speciesProfileId")?.trim() ?? "";
    if (speciesProfileId) {
        if (!UUID_PATTERN.test(speciesProfileId)) {
            return NextResponse.json({error: "A species profile id is required."}, {status: 400});
        }
        const {data, error} = await supabase.rpc("animal_bond_v1", {p_species_profile_id: speciesProfileId});
        if (error) {
            console.warn("[companions] animal_bond_v1 failed", error.message.slice(0, 200));
            return NextResponse.json({bond: null, available: false});
        }
        return NextResponse.json({bond: data ?? null, available: true});
    }

    const {data, error} = await supabase.rpc("animal_companions_v1", {p_limit: 200});
    if (error) {
        console.warn("[companions] animal_companions_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({companions: [], available: false});
    }
    const rows = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
    const slugs = await slugsFor(rows.map((row) => String(row.species_profile_id ?? "")).filter((id) => UUID_PATTERN.test(id)));
    return NextResponse.json({
        companions: rows.map((row) => ({...row, slug: slugs.get(String(row.species_profile_id ?? "").toLowerCase()) ?? null})),
        available: true
    });
}
