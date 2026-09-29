import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Marks one of the signed-in owner's captures as a pet, or removes the mark.
 * The same `profile_pets` rows iOS writes, so the profile's pets agree on both.
 */
export async function POST(request: Request, {params}: {params: {id: string}}) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({error: "Authentication required."}, {status: 401});
    }

    const body = await request.json().catch(() => ({}));
    const captureId = params.id?.trim() ?? "";

    if (!UUID.test(captureId) || typeof body.isPet !== "boolean") {
        return NextResponse.json({error: "A capture and a pet state are required."}, {status: 400});
    }

    // Only the owner's own animals can be their pets.
    const {data: capture} = await supabase
        .from("captures")
        .select("id")
        .eq("id", captureId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (!capture) {
        return NextResponse.json({error: "Capture not found."}, {status: 404});
    }

    const {error} = body.isPet
        ? await supabase
            .from("profile_pets")
            .upsert({user_id: user.id, capture_id: captureId}, {onConflict: "user_id,capture_id", ignoreDuplicates: true})
        : await supabase
            .from("profile_pets")
            .delete()
            .eq("user_id", user.id)
            .eq("capture_id", captureId);

    if (error) {
        return NextResponse.json({error: "That change did not go through. Try again in a moment."}, {status: 400});
    }

    return NextResponse.json({isPet: body.isPet});
}
