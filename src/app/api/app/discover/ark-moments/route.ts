import {NextRequest, NextResponse} from "next/server";
import {arkMomentRowsFromRpc} from "@/lib/ark-moments";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ark moments in Discover (AnimalDex 20261202110000_ark_moments.sql), for the signed-in reader only; the RPCs read
 * auth.uid(), so nobody marks or hides moments for someone else. Guests never call the RPCs.
 *   GET  ?seed=..&asOf=<session moment>        -> {moments: rows}  (0-2)
 *   POST {action: "seen", momentIds: [..]}     -> {ok: true}
 *   POST {action: "dismiss", momentId}         -> {ok: true}
 * A server without the migration (missing RPC: PGRST202 / 404) or any other error answers {moments: []} with 200, and
 * a POST answers {ok: false} with 200: no card, no error anywhere, one debug line at most.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function quiet(where: string, error: {code?: string | null; message?: string | null}) {
    if (process.env.NODE_ENV !== "production") console.debug(`[ark-moments] ${where}: ${error.code ?? ""} ${error.message ?? ""}`.trim());
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createSupabaseServerClient();
        if (!supabase) return NextResponse.json({moments: []});
        const {data: {user}} = await supabase.auth.getUser();
        if (!user) return NextResponse.json({moments: []});
        const params = request.nextUrl.searchParams;
        const asOf = params.get("asOf");
        const asOfValid = asOf && Number.isFinite(Date.parse(asOf)) ? new Date(asOf).toISOString() : null;
        const {data, error} = await supabase.rpc("discover_feed_ark_moments_v1", {
            p_seed: (params.get("seed") ?? "web").slice(0, 64),
            p_as_of: asOfValid
        });
        if (error) quiet("feed", error);
        return NextResponse.json({moments: arkMomentRowsFromRpc(data, error)});
    } catch {
        return NextResponse.json({moments: []});
    }
}

export async function POST(request: Request) {
    try {
        const supabase = createSupabaseServerClient();
        if (!supabase) return NextResponse.json({ok: false});
        const {data: {user}} = await supabase.auth.getUser();
        if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});
        const body = await request.json().catch(() => ({})) as Record<string, unknown>;

        if (body.action === "seen") {
            const ids = Array.isArray(body.momentIds)
                ? Array.from(new Set(body.momentIds.filter((id): id is string => typeof id === "string" && UUID.test(id)).map((id) => id.toLowerCase()))).slice(0, 8)
                : [];
            if (ids.length === 0) return NextResponse.json({error: "invalid"}, {status: 400});
            const {error} = await supabase.rpc("mark_ark_moments_seen", {p_moment_ids: ids});
            if (error) quiet("seen", error);
            return NextResponse.json({ok: !error});
        }

        if (body.action === "dismiss") {
            const id = typeof body.momentId === "string" && UUID.test(body.momentId) ? body.momentId.toLowerCase() : null;
            if (!id) return NextResponse.json({error: "invalid"}, {status: 400});
            const {error} = await supabase.rpc("dismiss_ark_moment", {p_moment_id: id});
            if (error) quiet("dismiss", error);
            return NextResponse.json({ok: !error});
        }

        return NextResponse.json({error: "invalid"}, {status: 400});
    } catch {
        return NextResponse.json({ok: false});
    }
}
