import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {ARK_ABOARD_SERVER_MAX, decodeArkAboard, isArkAboardId} from "@/lib/ark-aboard";
import {isMissingArkFunction} from "@/lib/ark-story";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {"Cache-Control": "private, no-store"} as const;

/**
 * GET ?captures=<id>,<id>,...: of a page of Discover captures (at most 100), the ones whose animal is aboard the Ark
 * and alive now, for the "Aboard the Ark" chip: `voyage_capture_aboard_v1` (migration 20261201150000), answered as
 * `{aboard: {<capture id>: <Ark animal id>}}`. Public data only, under the Ark capture photo's public-capture gate: a
 * capture that is private, hidden, reported, not named or not aboard is simply absent. No user, place or state.
 *
 * `{aboard: {}}` when signed out, before the function is applied, or when it fails (a failure answers 502 so the page
 * backs off): the post then draws no chip, never a broken one.
 */
export async function GET(request: Request) {
    if (!requestHasSupabaseAuthCookie(cookies().getAll())) return NextResponse.json({aboard: {}}, {headers: HEADERS});
    const raw = new URL(request.url).searchParams.get("captures") ?? "";
    const ids = [...new Set(raw.split(",").map((id) => id.trim().toLowerCase()).filter(Boolean))];
    if (!ids.length) return NextResponse.json({aboard: {}}, {headers: HEADERS});
    if (ids.length > ARK_ABOARD_SERVER_MAX || !ids.every(isArkAboardId)) return NextResponse.json({aboard: {}}, {status: 400, headers: HEADERS});
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({aboard: {}}, {headers: HEADERS});
    const {data, error} = await supabase.rpc("voyage_capture_aboard_v1", {p_capture_ids: ids});
    if (error) {
        if (isMissingArkFunction(error)) return NextResponse.json({aboard: {}}, {headers: HEADERS});
        console.warn("[ark] voyage_capture_aboard_v1 failed", error.message?.slice(0, 200));
        return NextResponse.json({aboard: {}}, {status: 502, headers: HEADERS});
    }
    return NextResponse.json({aboard: decodeArkAboard(data, ids)}, {headers: HEADERS});
}
