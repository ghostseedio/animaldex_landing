import {NextResponse} from "next/server";
import {invokeAuthenticatedSupabaseFunction} from "@/lib/supabase/app-functions";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

function friendlyFusionError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? "");

    if (message.includes("same_capture")) return "Choose a different animal as the teacher.";
    if (message.includes("insufficient_credits")) return "You do not have enough credits for this fusion.";
    if (message.includes("learned_sub_principle_exists")) return "This animal already learned that sub-principle.";
    if (message.includes("principle_missing")) return "Both animals need an Animal Principle before fusion can run.";
    if (message.includes("health_depleted")) return "Both animals need comparison hearts before fusion can run.";
    if (message.includes("not_fusion_ready")) return "Both animals need valid live capture analysis before fusion can run.";

    return message || "Principle Fusion is unavailable right now.";
}

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
    const receiverCaptureId = String(body.receiverCaptureId ?? "").trim();
    const donorCaptureId = String(body.donorCaptureId ?? "").trim();

    if (!receiverCaptureId || !donorCaptureId) {
        return NextResponse.json({error: "Receiver and donor captures are required."}, {status: 400});
    }

    try {
        const result = await invokeAuthenticatedSupabaseFunction("fuse-capture-principle", {
            receiver_capture_id: receiverCaptureId,
            donor_capture_id: donorCaptureId
        });

        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            {error: friendlyFusionError(error)},
            {status: 400}
        );
    }
}
