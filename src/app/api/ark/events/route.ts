import {NextResponse} from "next/server";
import {isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?since=<ISO time>: what happened in the Ark since then
 * (`voyage_events_since_v1`), for /ark's "while you were away". Public and
 * the same for everyone: kinds, times, species, the public animals the
 * events name (their places included) and a meal's stored diet phrase, never
 * a step, a debate or a chat.
 *
 * The server answers a page at a time (`{events, next_since, more, as_of}`,
 * never cut inside a commit); this follows `next_since` for up to PAGES pages
 * and passes the rows on as the server wrote them, oldest first, with `more`
 * when there was still more. The page decodes them against its snapshot
 * (`decodeArkEvents`). `{events: [], available: false}` until the function
 * exists.
 */
const LIMIT = 200;
const PAGES = 5;
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
    const events: unknown[] = [];
    let cursor = from.toISOString();
    let more = false;
    for (let page = 0; page < PAGES; page++) {
        const {data, error} = await supabase.rpc("voyage_events_since_v1", {p_since: cursor, p_limit: LIMIT});
        if (error) {
            if (!isMissingArkFunction(error)) console.warn("[ark] voyage_events_since_v1 failed", error.message.slice(0, 200));
            if (page > 0) break;
            return NextResponse.json({events: [], available: false}, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=60" : "no-store"}});
        }
        const answer = data && typeof data === "object" ? data as {events?: unknown; next_since?: unknown; more?: unknown} : {};
        if (Array.isArray(answer.events)) events.push(...answer.events);
        more = answer.more === true;
        if (!more || typeof answer.next_since !== "string" || answer.next_since === cursor) break;
        cursor = answer.next_since;
    }
    return NextResponse.json({events, more, available: true}, {headers: {"Cache-Control": "public, s-maxage=30, stale-while-revalidate=60"}});
}
