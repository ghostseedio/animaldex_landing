import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (typeof body.autoPublish !== "boolean") return NextResponse.json({error: "Choose whether to share your guides."}, {status: 400});
    const {data, error} = await supabase.rpc("set_my_wildlife_guide_settings", {
        p_auto_publish: body.autoPublish,
        p_acknowledge_notice: body.acknowledgeNotice === true
    });
    if (error) return NextResponse.json({error: error.message}, {status: 400});
    return NextResponse.json({ok: true, data});
}
