import {NextResponse} from "next/server";
import {invokeAuthenticatedSupabaseFunction} from "@/lib/supabase/app-functions";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

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
    const action = String(body.action ?? "generate");

    if (action === "accept") {
        const challengeId = String(body.challengeId ?? "").trim();

        if (!challengeId) {
            return NextResponse.json({error: "Challenge id is required."}, {status: 400});
        }

        const {data, error} = await supabase.rpc("accept_apex_growth_challenge", {
            p_challenge_id: challengeId
        });

        if (error) {
            return NextResponse.json({error: error.message}, {status: 400});
        }

        return NextResponse.json({challenge: Array.isArray(data) ? data[0] ?? null : data});
    }

    const captureId = String(body.captureId ?? "").trim();
    const wildProfileId = String(body.wildProfileId ?? "").trim();
    const targetQualityTag = String(body.targetQualityTag ?? "").trim();
    const matchedQualityTags = Array.isArray(body.matchedQualityTags)
        ? body.matchedQualityTags.map((value: unknown) => String(value)).filter(Boolean)
        : [];

    if (!captureId || !wildProfileId || !targetQualityTag) {
        return NextResponse.json({error: "Capture, wild profile, and target quality are required."}, {status: 400});
    }

    try {
        const result = await invokeAuthenticatedSupabaseFunction("generate-apex-growth-challenge", {
            capture_id: captureId,
            wild_profile_id: wildProfileId,
            target_quality_tag: targetQualityTag,
            matched_quality_tags: matchedQualityTags,
            source: "animal_card"
        });

        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            {error: error instanceof Error ? error.message : "Challenge generation failed."},
            {status: 400}
        );
    }
}
