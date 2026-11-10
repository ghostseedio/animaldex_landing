import {NextResponse} from "next/server";
import {isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?since=<ISO time>: what happened in the Ark since then
 * (`voyage_events_since_v1`), for /ark's "while you were away". Public and
 * the same for everyone: kinds, times, species, animal ids and a meal's
 * stored diet phrase, never a step, a debate or a chat.
 *
 * The rows are passed on as the server wrote them; the page decodes them
 * against its snapshot (`decodeArkEvents`). `{events: [], available: false}`
 * until the function exists.
 */
const LIMIT = 200;
/** No further back than this: a replay is a short look at the last while, not the Ark's history. */
const OLDEST_MS = 30 * 86_400_000;

export async function GET(request: Request) {
    const asked = new URL(request.url).searchParams.get("since") ?? "";
    const since = Date.parse(asked);
    if (!Number.isFinite(since)) return NextResponse.json({events: [], available: true}, {status: 400, headers: {"Cache-Control": "no-store"}});
    const from = new Date(Math.max(since, Date.now() - OLDEST_MS));
    // Rounded to the minute, so readers who came back at much the same time share a cached answer.
    from.setUTCSeconds(0, 0);
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json({events: [], available: false}, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_events_since_v1", {p_since: from.toISOString(), p_limit: LIMIT});
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] voyage_events_since_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({events: [], available: false}, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=60" : "no-store"}});
    }
    return NextResponse.json({events: Array.isArray(data) ? data : [], available: true}, {headers: {"Cache-Control": "public, s-maxage=30, stale-while-revalidate=60"}});
}
