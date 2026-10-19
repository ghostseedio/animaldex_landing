import {NextResponse} from "next/server";
import {normalizeMyGuides} from "@/data/virtual-wildlife-guides";
import {createSupabaseServerClient} from "@/lib/supabase/server";

/**
 * Guide sharing for the signed-in author. `autoPublish: null` leaves sharing as
 * it is (the notice's "Keep sharing"); false hides every guide and new ones
 * start hidden. Returns the author's guides as get_my_wildlife_guides does.
 */
export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const autoPublish = body.autoPublish === undefined ? null : body.autoPublish;
    if (autoPublish !== null && typeof autoPublish !== "boolean") {
        return NextResponse.json({error: "Choose whether to share your guides."}, {status: 400});
    }
    const acknowledgeNotice = body.acknowledgeNotice === true;
    if (autoPublish === null && !acknowledgeNotice) {
        return NextResponse.json({error: "There is nothing to change."}, {status: 400});
    }
    const {data, error} = await supabase.rpc("set_my_wildlife_guide_settings", {
        p_auto_publish: autoPublish,
        p_acknowledge_notice: acknowledgeNotice
    });
    if (error) return NextResponse.json({error: error.message}, {status: 400});
    const mine = data && typeof data === "object" ? normalizeMyGuides(data as Record<string, unknown>) : null;
    return NextResponse.json({ok: true, mine}, {headers: {"Cache-Control": "private, no-store"}});
}
