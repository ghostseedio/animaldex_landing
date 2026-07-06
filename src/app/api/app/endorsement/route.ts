import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

const ENDORSEMENT_STATS = new Set(["dominance", "speed", "size", "intelligence", "rarity"]);

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();

    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const body = await request.json().catch(() => ({}));
    const captureId = String(body.captureId ?? "").trim();
    const requestedStat = body.endorsedStat == null ? null : String(body.endorsedStat).trim().toLowerCase();

    if (!captureId || (requestedStat !== null && !ENDORSEMENT_STATS.has(requestedStat))) {
        return NextResponse.json({error: "A valid capture and endorsement trait are required."}, {status: 400});
    }

    const {error} = await supabase.rpc("set_capture_endorsement", {
        p_capture_id: captureId,
        p_endorsed_stat: requestedStat
    });

    if (error) return NextResponse.json({error: error.message}, {status: 400});
    return NextResponse.json({ok: true, endorsedStat: requestedStat});
}
