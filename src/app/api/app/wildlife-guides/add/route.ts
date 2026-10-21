import {NextResponse} from "next/server";
import {normalizeMyGuides} from "@/data/virtual-wildlife-guides";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {isUuid} from "@/lib/virtual-wildlife-guides";

const NO_STORE = {"Cache-Control": "private, no-store"};

function readableError(message: string) {
    if (/place_needs_country/.test(message)) return "AnimalDex couldn't tell which country this place is in, so it can't be a guide yet.";
    if (/place_not_ready|place_not_found/.test(message)) return "This place has no wild sightings left to build a guide from.";
    if (/guide_not_restorable/.test(message)) return "This guide can't be brought back.";
    return message;
}

/**
 * Add guide (migration 20261021170000): makes a guide of one of the author's
 * places, or brings back one they deleted. Returns the new guide and the
 * author's refreshed list.
 */
export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503, headers: NO_STORE});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401, headers: NO_STORE});
    const body = await request.json().catch(() => ({})) as {placeId?: unknown};
    if (typeof body.placeId !== "string" || !isUuid(body.placeId)) {
        return NextResponse.json({error: "Pick a place."}, {status: 400, headers: NO_STORE});
    }
    const {data: guide, error} = await supabase.rpc("add_my_wildlife_guide", {p_place_id: body.placeId});
    if (error) return NextResponse.json({error: readableError(error.message)}, {status: 400, headers: NO_STORE});
    const {data: mine} = await supabase.rpc("get_my_wildlife_guides");
    return NextResponse.json(
        {guide, mine: mine && typeof mine === "object" ? normalizeMyGuides(mine as Record<string, unknown>) : null},
        {headers: NO_STORE}
    );
}
