import {NextRequest, NextResponse} from "next/server";
import {createSupabasePublicClient} from "@/lib/supabase/server";
import {readTrialMotionStoryboards, trialMotionKey} from "@/lib/trial-motion/storyboards-server";

export const runtime = "nodejs";

/**
 * Trial Loop storyboards by `key=<species id>:<FREQUENCY>` (repeatable or
 * comma-separated, up to 24). For Discover Trial posts, whose timeline view
 * carries no storyboard. Public: `trial_motion_storyboards_v1` is anon-readable
 * and holds nothing but the drawings.
 */
export async function GET(request: NextRequest) {
    const keys = request.nextUrl.searchParams.getAll("key")
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 24);
    const pairs = keys.flatMap((key) => {
        const [species, frequency] = key.split(":");
        return species && frequency ? [{species, frequency: frequency.toUpperCase()}] : [];
    });
    if (!pairs.length) return NextResponse.json({storyboards: {}});

    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const found = await readTrialMotionStoryboards(supabase, pairs.map((pair) => pair.species));
    const storyboards: Record<string, unknown> = {};
    for (const pair of pairs) {
        const key = trialMotionKey(pair.species, pair.frequency);
        storyboards[key] = found.get(key) ?? null;
    }
    const response = NextResponse.json({storyboards});
    // Authors are filling the column now; a short shared cache keeps it fresh.
    response.headers.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    return response;
}
