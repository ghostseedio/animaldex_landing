import {NextResponse} from "next/server";
import {normalizeMyGuides} from "@/data/virtual-wildlife-guides";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE = {"Cache-Control": "private, no-store"};

/**
 * The author accepts the Wildlife Guide Author Terms version they were shown
 * and confirms they are 18 or older; their guides become buyable. Returns the
 * author's guides as get_my_wildlife_guides does.
 */
export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503, headers: NO_STORE});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Sign in to accept the author terms."}, {status: 401, headers: NO_STORE});

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const version = typeof body.version === "string" ? body.version.trim() : "";
    if (!version || version.length > 100) return NextResponse.json({error: "Reload the page and try again."}, {status: 400, headers: NO_STORE});
    if (body.ageConfirmed !== true) return NextResponse.json({error: "Confirm that you're 18 or older."}, {status: 400, headers: NO_STORE});

    const {data, error} = await supabase.rpc("accept_wildlife_guide_author_terms", {p_version: version, p_age_confirmed: true});
    if (error) {
        if (/terms_version_outdated/.test(error.message)) {
            return NextResponse.json({error: "The author terms were updated. Reload the page to read and accept the new version."}, {status: 409, headers: NO_STORE});
        }
        if (/age_confirmation_required/.test(error.message)) {
            return NextResponse.json({error: "Confirm that you're 18 or older."}, {status: 400, headers: NO_STORE});
        }
        return NextResponse.json({error: "The terms could not be accepted. Try again."}, {status: 400, headers: NO_STORE});
    }
    const mine = data && typeof data === "object" ? normalizeMyGuides(data as Record<string, unknown>) : null;
    return NextResponse.json({ok: true, mine}, {headers: NO_STORE});
}
