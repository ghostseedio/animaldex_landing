import {NextResponse} from "next/server";
import {arkCompactHistory, arkPopulationRead} from "@/lib/ark-population-history";
import {isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?span=week|month|all: every species' population over time (`voyage_population_history_v1`, AnimalDex migration
 * 20261127180000): the last 7 days by the hour (`week`), the last 31 days by the hour (`month`, the most the function
 * gives by the hour), or the whole record by the UTC day (`all`). Public and the same for everyone: counts by kind and
 * island, never an animal or who brought it. The kinds' ids come once (`kinds`) and the rows name them by index, so
 * the answer is a third of the server's size. Drawn by `lib/ark-population-history.ts`, which puts the hours into the
 * viewer's own days (the function has no time zone; `month` is what lets the 30-day and All views follow the viewer's).
 *
 * `{available: false}` until the function exists: the HUD then draws no graphs. The start is rounded to the hour, so
 * readers share a cached answer for five minutes.
 */
export async function GET(request: Request) {
    const {bucket, since} = arkPopulationRead(new URL(request.url).searchParams.get("span"), Date.now());
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({available: false}, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_population_history_v1", {p_bucket: bucket, p_since: since});
    if (error || !data || typeof data !== "object") {
        if (error && !isMissingArkFunction(error)) console.warn("[ark] voyage_population_history_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({available: false}, {headers: {"Cache-Control": error && isMissingArkFunction(error) ? "public, s-maxage=300" : "no-store"}});
    }
    return NextResponse.json(arkCompactHistory(data as Record<string, unknown>), {headers: {"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"}});
}
