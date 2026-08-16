import {NextResponse} from "next/server";
import {getBattleTier} from "@/lib/battle-tier";
import {createSupabaseServerClient} from "@/lib/supabase/server";

/** Enough to characterise a spread without pulling an entire library — matches iOS. */
const TIER_SAMPLE_LIMIT = 300;

type StatsRow = Record<string, any>;

function emptyTierCounts() {
    return {S: 0, A: 0, B: 0, C: 0, D: 0, E: 0};
}

function toSide(row: StatsRow | undefined) {
    if (!row) return null;

    const optional = (value: unknown) => (value == null ? null : Number(value));

    return {
        collectorScore: Number(row.collector_score ?? 0),
        competitiveScore: Number(row.competitive_score ?? 0),
        powerSetScore: Number(row.power_set_score ?? 0),
        overallScore: Number(row.overall_score ?? 0),
        indexedSpeciesCount: Number(row.indexed_species_count ?? 0),
        wildObservationCount: Number(row.wild_observation_count ?? 0),
        rareObservationCount: Number(row.rare_observation_count ?? 0),
        challengeWins: Number(row.challenge_wins ?? 0),
        averageDominance: optional(row.average_dominance),
        averageSpeed: optional(row.average_speed),
        averageSize: optional(row.average_size),
        averageIntelligence: optional(row.average_intelligence),
        averageRarity: optional(row.average_rarity),
        discoveryDistanceMeters: optional(row.discovery_distance_meters)
    };
}

async function fetchTierCounts(
    supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>,
    userId: string
) {
    const {data} = await supabase
        .from("discover_feed_v1")
        .select("game_stats,dominance_boost,speed_boost,intelligence_boost")
        .eq("user_id", userId)
        .order("capture_created_at", {ascending: false})
        .limit(TIER_SAMPLE_LIMIT);

    const counts = emptyTierCounts();
    for (const row of (data ?? []) as StatsRow[]) {
        const stats = row.game_stats && typeof row.game_stats === "object" ? row.game_stats : {};
        const resolved = {
            dominance: Number(stats.dominance ?? 0) + Number(row.dominance_boost ?? 0),
            speed: Number(stats.speed ?? 0) + Number(row.speed_boost ?? 0),
            size: Number(stats.size ?? 0),
            intelligence: Number(stats.intelligence ?? 0) + Number(row.intelligence_boost ?? 0),
            rarity: Number(stats.rarity ?? 0)
        };
        const total = resolved.dominance + resolved.speed + resolved.size + resolved.intelligence + resolved.rarity;
        if (total <= 0) continue;
        counts[getBattleTier(resolved)] += 1;
    }

    return counts;
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

    // Non-fatal: the rest of the comparison is still worth showing if the tier
    // spread cannot be built, so failures leave the card hidden.
    const [viewerTierCounts, memberTierCounts] = await Promise.all([
        fetchTierCounts(supabase, user.id).catch(() => emptyTierCounts()),
        fetchTierCounts(supabase, memberId).catch(() => emptyTierCounts())
    ]);

    return NextResponse.json({viewer, member, viewerTierCounts, memberTierCounts});
}
