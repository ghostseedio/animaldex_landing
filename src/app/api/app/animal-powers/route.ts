import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {decodeAnimalPower} from "@/lib/animal-powers";

export const runtime = "nodejs";

/**
 * Animal Powers for the viewer, reading the same `animal_powers_for_viewer_v1`
 * view iOS reads so the lesson and the earned state always arrive together.
 *
 * Reading a Power needs no account and no Pro — the knowledge is what creates
 * the wanting. Earning is never a client write: there is no INSERT policy on
 * `user_animal_powers` and `grant_animal_power` is service-role only, so the
 * web can submit an account and read a verdict and can never award a Power.
 */
export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const params = new URL(request.url).searchParams;
    const speciesProfileId = params.get("speciesProfileId")?.trim();

    if (params.get("earned") === "1") {
        const {data: {user}} = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({powers: []});
        }

        // Every Power this person has earned, newest first, for the profile.
        const {data, error} = await supabase
            .from("animal_powers_for_viewer_v1")
            .select()
            .not("earned_at", "is", null)
            .order("earned_at", {ascending: false});

        if (error) {
            return NextResponse.json({error: error.message}, {status: 400});
        }

        const powers = (Array.isArray(data) ? data : [])
            .map(decodeAnimalPower)
            .filter((power): power is NonNullable<typeof power> => power !== null);

        return NextResponse.json({powers});
    }

    if (!speciesProfileId) {
        return NextResponse.json({error: "A species profile id is required."}, {status: 400});
    }

    const {data, error} = await supabase
        .from("animal_powers_for_viewer_v1")
        .select()
        .eq("species_profile_id", speciesProfileId)
        .limit(1);

    if (error) {
        return NextResponse.json({error: error.message}, {status: 400});
    }

    const row = Array.isArray(data) ? data[0] : null;

    return NextResponse.json({power: row ? decodeAnimalPower(row) : null});
}
