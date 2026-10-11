import {NextResponse} from "next/server";
import {getMatchupArena} from "@/data/matchups";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * The Comparisons grid, re-read when the Following chip is toggled. Following
 * membership is applied by `following_challenge_feed_v1` before the limit, so
 * it cannot be a client-side filter over the default page (iOS
 * `selectArenaFollowingOnly`).
 */
export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({error: "Authentication required."}, {status: 401});
    }

    const followingOnly = new URL(request.url).searchParams.get("following") === "1";
    const arena = await getMatchupArena(user.id, 48, followingOnly);
    return NextResponse.json({arena});
}
