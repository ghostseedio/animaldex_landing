import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getSpeciesSystemDynamics} from "@/data/species-system-dynamics";
import {sentenceComponents, type SpeciesSystemDynamics} from "@/lib/system-dynamics";

export const runtime = "nodejs";

/**
 * Species-level System Dynamics for the Learn tab.
 *
 * A viewer without Pro gets the same teaser iOS shows them
 * (`SystemDynamicsProTeaser`): the real signature, frequency profile, waveform
 * and one closing line — enough to render the card truthfully — while the
 * interpretation, cross-domain matrix and failure modes stay behind the gate.
 * Returning nothing at all left the section as a text box with a button, which
 * is not what the app does.
 */

/** Exactly the fields the locked teaser renders. Everything else is withheld. */
function toTeaser(dynamics: SpeciesSystemDynamics): SpeciesSystemDynamics {
    const explanation = dynamics.signatureExplanation?.trim();
    const closingLine = explanation ? sentenceComponents(explanation).slice(-1)[0] ?? null : null;

    return {
        ...dynamics,
        signatureExplanation: closingLine,
        crossDomainMatrix: [],
        failureModes: [],
        canonicalPrincipleExpression: null
    };
}
export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const speciesProfileId = new URL(request.url).searchParams.get("speciesProfileId")?.trim();

    if (!speciesProfileId) {
        return NextResponse.json({error: "A species profile id is required."}, {status: 400});
    }

    const {data: {user}} = await supabase.auth.getUser();
    const dynamics = await getSpeciesSystemDynamics(speciesProfileId);

    if (!dynamics) {
        return NextResponse.json({dynamics: null, locked: false, isSignedIn: Boolean(user)});
    }

    if (!user) {
        return NextResponse.json({dynamics: toTeaser(dynamics), locked: true, isSignedIn: false});
    }

    const {data: profile} = await supabase
        .from("profiles")
        .select("is_pro")
        .eq("id", user.id)
        .maybeSingle();

    if (!(profile as {is_pro?: boolean} | null)?.is_pro) {
        return NextResponse.json({dynamics: toTeaser(dynamics), locked: true, isSignedIn: true});
    }

    return NextResponse.json({dynamics, locked: false, isSignedIn: true});
}
