import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {normalizeCaptureNickname} from "@/lib/capture-nickname";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Names one of the signed-in owner's cards ("Luna the Gray Wolf"), or takes
 * the name away. The card's nickname is `captures.title`, the column iOS
 * writes from "Name your {animal}" in the chat and Customize Card → Add
 * Nickname (`updateCaptureMetadata`), so the apps, the chat and every row
 * that names the animal read the same one.
 *
 * As the owner, through RLS (`captures_all_own`), and on their own card
 * only: the update is scoped to the verified user's id.
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

    const body = await request.json().catch(() => ({})) as {nickname?: unknown};
    const captureId = params.id?.trim() ?? "";
    if (!UUID.test(captureId) || (typeof body.nickname !== "string" && body.nickname !== null)) {
        return NextResponse.json({error: "A card and a name are required."}, {status: 400});
    }
    const nickname = normalizeCaptureNickname(body.nickname);

    const {data, error} = await supabase
        .from("captures")
        .update({title: nickname})
        .eq("id", captureId)
        .eq("user_id", user.id)
        .select("id, title");

    if (error) {
        return NextResponse.json({error: "That change did not go through. Try again in a moment."}, {status: 400});
    }
    if (!data || data.length === 0) {
        return NextResponse.json({error: "Capture not found."}, {status: 404});
    }

    return NextResponse.json({nickname: normalizeCaptureNickname((data[0] as {title?: unknown}).title)});
}
