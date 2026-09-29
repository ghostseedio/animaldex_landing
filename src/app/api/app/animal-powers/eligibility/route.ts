import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {type CapturePlayEligibilityMap, decodeCapturePlayEligibility} from "@/lib/animal-powers";

export const runtime = "nodejs";

/**
 * Play eligibility for every capture the viewer owns, in one request.
 *
 * The picker renders dozens of captures at once; asking per capture would be an
 * N+1 against a SECURITY DEFINER function. `capture_play_eligibility_v1` is
 * scoped to auth.uid() server-side, so there is no user parameter to get wrong.
 */
export async function GET() {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({error: "Authentication required."}, {status: 401});
    }

    const {data, error} = await supabase.from("capture_play_eligibility_v1").select();

    if (error) {
        return NextResponse.json({error: error.message}, {status: 400});
    }

    const eligibility: CapturePlayEligibilityMap = {};

    for (const row of Array.isArray(data) ? data : []) {
        const decoded = decodeCapturePlayEligibility(row);
        if (decoded) eligibility[decoded.captureId] = decoded;
    }

    return NextResponse.json({eligibility});
}
