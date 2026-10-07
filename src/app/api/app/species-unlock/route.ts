import {NextResponse} from "next/server";
import {createSupabaseServerClient, createSupabaseServiceClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether the signed-in viewer has unlocked a species — caught it, or an
 * alias or canonical form of it. Web twin of iOS `AppState.hasUnlockedSpecies`.
 *
 * A Trial is per person per species, and the server refuses a start, a proof
 * and a Power grant with `species_not_unlocked` for an animal the person has
 * not caught. Asking first lets the interface say "not yet captured" instead
 * of offering a button that will be refused.
 *
 * `viewer_has_unlocked_species` is service-role only, so it is called here
 * for the authenticated viewer and never from the browser. A signed-out
 * reader gets `null`: nothing is known, and nothing is locked on their behalf.
 */
export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const speciesProfileIds = new URL(request.url).searchParams
        .getAll("speciesProfileId")
        .flatMap((value) => value.split(","))
        .map((value) => value.trim().toLowerCase())
        .filter((value) => UUID_PATTERN.test(value));

    if (!speciesProfileIds.length) {
        return NextResponse.json({error: "A species profile id is required."}, {status: 400});
    }

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({signedIn: false, unlocked: null});
    }

    const service = createSupabaseServiceClient();
    if (!service) {
        return NextResponse.json({signedIn: true, unlocked: null});
    }

    const results = await Promise.all(speciesProfileIds.map(async (speciesProfileId) => {
        const {data, error} = await service.rpc("viewer_has_unlocked_species", {
            p_user_id: user.id,
            p_species_profile_id: speciesProfileId
        });
        return [speciesProfileId, error ? null : data === true] as const;
    }));

    const unlockedById = Object.fromEntries(results);
    const known = results.filter(([, value]) => value !== null);

    const response = NextResponse.json({
        signedIn: true,
        // Any one of the ids counting is enough: they are the same animal
        // under its alias, canonical and identity-key names.
        unlocked: known.length ? known.some(([, value]) => value === true) : null,
        unlockedById
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
}
