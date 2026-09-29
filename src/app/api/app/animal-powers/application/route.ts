import {NextResponse} from "next/server";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {
    OFFERED_APPLICATION_DOMAINS,
    POWER_APPLICATION_LIMITS,
    type PowerApplicationResult,
    type PowerApplicationVerdict,
    decodeAnimalPower,
    powerRefusalMessage
} from "@/lib/animal-powers";

export const runtime = "nodejs";

const VERDICTS: PowerApplicationVerdict[] = ["approved", "needs_more", "rejected"];

/**
 * "Apply It Your Way" — the written route to an Animal Power.
 *
 * The grading and the grant both live in `verify-power-application`; this route
 * only carries the account there and the verdict back. What the person wrote is
 * never logged here.
 */
export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({error: "Authentication required."}, {status: 401});
    }

    const body = await request.json().catch(() => ({}));
    const speciesProfileId = String(body.speciesProfileId ?? "").trim();
    const domain = String(body.domain ?? "").trim().toUpperCase();
    const account = String(body.account ?? "").trim().slice(0, POWER_APPLICATION_LIMITS.maxCharacters);

    if (!speciesProfileId) {
        return NextResponse.json({error: "A species profile id is required."}, {status: 400});
    }

    if (!(OFFERED_APPLICATION_DOMAINS as string[]).includes(domain)) {
        return NextResponse.json(
            {error: powerRefusalMessage("domain_not_allowed"), code: "domain_not_allowed"},
            {status: 400}
        );
    }

    // Caught before the request is made, so a short account never reaches the grader.
    if (account.length < POWER_APPLICATION_LIMITS.minCharacters) {
        return NextResponse.json(
            {error: powerRefusalMessage("account_too_short"), code: "account_too_short"},
            {status: 400}
        );
    }

    const invoked = await invokeAuthenticatedSupabaseFunctionResponse("verify-power-application", {
        species_profile_id: speciesProfileId,
        domain,
        account
    });

    if (!invoked.ok) {
        const code = invoked.payload?.error || `http_${invoked.status}`;
        return NextResponse.json(
            {error: powerRefusalMessage(code, invoked.payload?.message), code},
            {status: 400}
        );
    }

    const verdict = String(invoked.payload?.verdict ?? "");
    const result: PowerApplicationResult = {
        verdict: (VERDICTS as string[]).includes(verdict) ? verdict as PowerApplicationVerdict : "needs_more",
        reason: invoked.payload?.reason || "Tell us the one thing you actually did.",
        quotedAction: invoked.payload?.quoted_action || "",
        grantedPower: invoked.payload?.granted_power === true,
        rejectionsRemaining: Number.isFinite(Number(invoked.payload?.rejections_remaining))
            ? Number(invoked.payload.rejections_remaining)
            : POWER_APPLICATION_LIMITS.maxRejections
    };

    // The grant is server-side; re-read rather than inferring the new state
    // from the verdict.
    const {data} = await supabase
        .from("animal_powers_for_viewer_v1")
        .select()
        .eq("species_profile_id", speciesProfileId)
        .limit(1);

    const row = Array.isArray(data) ? data[0] : null;

    return NextResponse.json({result, power: row ? decodeAnimalPower(row) : null});
}
