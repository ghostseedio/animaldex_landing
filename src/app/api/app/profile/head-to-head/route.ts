import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

type StatsRow = Record<string, any>;

function toSide(row: StatsRow | undefined) {
    if (!row) return null;

    const optional = (value: unknown) => (value == null ? null : Number(value));

    return {
        collectorScore: Number(row.collector_score ?? 0),
        powerSetScore: Number(row.power_set_score ?? 0),
        overallScore: Number(row.overall_score ?? 0),
        indexedSpeciesCount: Number(row.indexed_species_count ?? 0),
        wildObservationCount: Number(row.wild_observation_count ?? 0),
        rareObservationCount: Number(row.rare_observation_count ?? 0),
        averageDominance: optional(row.average_dominance),
        averageSpeed: optional(row.average_speed),
        averageSize: optional(row.average_size),
        averageIntelligence: optional(row.average_intelligence),
        averageRarity: optional(row.average_rarity),
        discoveryDistanceMeters: optional(row.discovery_distance_meters)
    };
}

export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Sign in to compare profiles."}, {status: 401});

    const memberId = new URL(request.url).searchParams.get("userId")?.trim();
    if (!memberId) return NextResponse.json({error: "A member id is required."}, {status: 400});

    const {data, error} = await supabase.rpc("get_profile_head_to_head", {p_other_user_id: memberId});
    if (error) return NextResponse.json({error: error.message}, {status: 400});

    const rows = (data ?? []) as StatsRow[];
    const viewer = toSide(rows.find((row) => row.is_viewer === true));
    const member = toSide(rows.find((row) => row.is_viewer !== true));

    if (!viewer || !member) {
        return NextResponse.json(
            {error: "Both profiles need stats before they can be compared."},
            {status: 404}
        );
    }

    return NextResponse.json({viewer, member});
}
