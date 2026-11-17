import {NextResponse} from "next/server";
import {arkCompactHistory} from "@/lib/ark-population-history";
import {isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?span=week|all: every species' population over time (`voyage_population_history_v1`, AnimalDex migration
 * 20261127180000): the last 7 days by the hour, or the whole record by the day. Public and the same for everyone:
 * counts by kind and island, never an animal or who brought it. The kinds' ids come once (`kinds`) and the rows name
 * them by index, so the answer is a third of the server's size. Drawn by `lib/ark-population-history.ts`.
 *
 * `{available: false}` until the function exists: the HUD then draws no graphs. The week's start is rounded to the
 * hour, so readers share a cached answer for five minutes.
 */
export async function GET(request: Request) {
    const span = new URL(request.url).searchParams.get("span") === "all" ? "all" : "week";
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({available: false}, {headers: {"Cache-Control": "no-store"}});
    const since = span === "week" ? new Date(Math.floor((Date.now() - 7 * 86_400_000) / 3_600_000) * 3_600_000).toISOString() : null;
    const {data, error} = await supabase.rpc("voyage_population_history_v1", {p_bucket: span === "week" ? "hour" : "day", p_since: since});
    if (error || !data || typeof data !== "object") {
        if (error && !isMissingArkFunction(error)) console.warn("[ark] voyage_population_history_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({available: false}, {headers: {"Cache-Control": error && isMissingArkFunction(error) ? "public, s-maxage=300" : "no-store"}});
    }
    return NextResponse.json(arkCompactHistory(data as Record<string, unknown>), {headers: {"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"}});
}
