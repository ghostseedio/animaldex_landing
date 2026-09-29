import {NextResponse} from "next/server";
import {getAppCaptureDetail} from "@/data/authenticated-app";
import {type CaptureReveal, sightingNovelty} from "@/lib/capture-reveal";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "animal", "unknown_animal", "bird_animal": a group, not a species somebody can have a first of. */
function isBroadIdentityToken(token: string) {
    const value = token.trim().toLowerCase();
    return !value || value === "animal" || value === "unknown" || value === "unknown_animal" || value.endsWith("_animal");
}

/**
 * Settles what a newly identified capture opens with, the moment its analysis
 * lands: whether it is the first of its species in the collection, and whether
 * it earned the free credit for a first wild species.
 *
 * Asked once by the capture flow and carried to the card, because by the time
 * the card opens the capture is already in the collection and the same
 * question would answer differently.
 *
 * The credit is decided by `grant_wild_unique_species_credit_for_capture`, the
 * RPC iOS calls at the same point: it reads the owner from the session, checks
 * the capture is wild, live and genuinely the first, and is idempotent per
 * person and species. Until this route existed a capture made on the web never
 * asked for it.
 */
export async function POST(_: Request, {params}: {params: {id: string}}) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({error: "Authentication required."}, {status: 401});
    }

    const captureId = params.id?.trim() ?? "";

    if (!UUID.test(captureId)) {
        return NextResponse.json({error: "A capture is required."}, {status: 400});
    }

    // Owner-scoped: returns nothing for a capture that is not theirs.
    const capture = await getAppCaptureDetail(captureId);

    if (!capture) {
        return NextResponse.json({error: "Capture not found."}, {status: 404});
    }

    const {data: identity} = await supabase
        .from("owned_capture_manifest_v1")
        .select("species_profile_id,normalized_identity_key")
        .eq("user_id", user.id)
        .eq("capture_id", captureId)
        .maybeSingle();

    const speciesProfileId = typeof identity?.species_profile_id === "string" ? identity.species_profile_id.trim() : "";
    const identityKey = typeof identity?.normalized_identity_key === "string" ? identity.normalized_identity_key.trim() : "";
    const hasSpecificIdentity = !isBroadIdentityToken(identityKey) && Boolean(speciesProfileId || identityKey);

    // Unknown is not zero. When the earlier sightings cannot be counted the
    // capture is treated as a repeat, because announcing a discovery that is
    // not one is the worse mistake.
    let priorSightingCount: number | null = null;

    if (hasSpecificIdentity) {
        const query = supabase
            .from("owned_capture_manifest_v1")
            .select("capture_id", {count: "exact", head: true})
            .eq("user_id", user.id)
            .neq("capture_id", captureId)
            .not("completed_at", "is", null);

        const {count, error} = speciesProfileId
            ? await query.eq("species_profile_id", speciesProfileId)
            : await query.eq("normalized_identity_key", identityKey);

        if (!error && typeof count === "number") priorSightingCount = count;
    }

    const novelty = priorSightingCount == null
        ? {isNewSpecies: false, totalSightings: 1}
        : sightingNovelty({
            priorSightingCount,
            isEligibleCapture: capture.isEligibleCapture,
            hasUncertaintyFallback: capture.hasUncertaintyFallback
        });

    let awardedWildUniqueCredit = false;
    const {data: granted, error: grantError} = await supabase.rpc("grant_wild_unique_species_credit_for_capture", {
        p_capture_id: captureId
    });

    if (grantError) {
        // The capture is saved and scored either way. A credit that could not
        // be checked is worth a log, never a failed reveal.
        console.error("[capture-reveal] wild unique credit check failed", grantError.message);
    } else {
        const row = Array.isArray(granted) ? granted[0] : granted;
        awardedWildUniqueCredit = row?.granted === true;
    }

    const reveal: CaptureReveal = {captureId, ...novelty, awardedWildUniqueCredit};

    return NextResponse.json({reveal});
}
