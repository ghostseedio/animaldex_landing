import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {isMissingArkFunction} from "@/lib/ark-story";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {"Cache-Control": "private, no-store"} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST {animal_id}: a control ticket for one of the signed-in viewer's Ark animals (player control,
 * docs/ark/player-control-contract.md §2–3). `voyage_control_ticket_v1` (AnimalDex migration 20261119100000) checks
 * ownership (D1), the age rule, the limits (D2, D3) and the `player_control` switch, and signs a single-use ticket
 * for 120 s that `ark-live` checks. The page never sees the user's token; the ticket is all it passes on.
 *
 * `{ok: false, reason}` with the RPC's reason, `signed_out`, or `off` (no function yet, or the switch is off).
 */
export async function POST(request: Request) {
    if (request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ok: false, reason: "cross_site"}, {status: 403, headers: HEADERS});
    if (!requestHasSupabaseAuthCookie(cookies().getAll())) return NextResponse.json({ok: false, reason: "signed_out"}, {status: 401, headers: HEADERS});
    const body = (await request.json().catch(() => null)) as {animal_id?: unknown} | null;
    const id = typeof body?.animal_id === "string" && UUID.test(body.animal_id) ? body.animal_id.toLowerCase() : null;
    if (!id) return NextResponse.json({ok: false, reason: "bad_request"}, {status: 400, headers: HEADERS});
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ok: false, reason: "signed_out"}, {status: 401, headers: HEADERS});
    const {data, error} = await supabase.rpc("voyage_control_ticket_v1", {p_animal_id: id});
    if (error) {
        if (isMissingArkFunction(error)) return NextResponse.json({ok: false, reason: "off"}, {headers: HEADERS});
        if (/not_authenticated/.test(error.message ?? "")) return NextResponse.json({ok: false, reason: "signed_out"}, {status: 401, headers: HEADERS});
        console.warn("[ark] voyage_control_ticket_v1 failed", error.message?.slice(0, 200));
        return NextResponse.json({ok: false, reason: "network"}, {status: 502, headers: HEADERS});
    }
    const result = (data ?? {}) as {ok?: boolean; reason?: string; ticket?: string; expires_at?: string; island?: string};
    if (!result.ok || typeof result.ticket !== "string") return NextResponse.json({ok: false, reason: result.reason ?? "off"}, {headers: HEADERS});
    return NextResponse.json({ok: true, ticket: result.ticket, expires_at: result.expires_at ?? null, island: result.island ?? "wild"}, {headers: HEADERS});
}
