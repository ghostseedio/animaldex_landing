import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {hasAuthCookie} from "@/lib/viewer";

/**
 * Records that the signed-in account uses the web app. The iOS and Android apps
 * call the same `record_user_device` RPC directly; /admin/metrics reads it to
 * split users by platform.
 */
export async function POST() {
    if (!hasAuthCookie()) return NextResponse.json({ok: false}, {status: 401});

    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ok: false}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ok: false}, {status: 401});

    const {error} = await supabase.rpc("record_user_device", {
        p_platform: "web",
        p_app_version: null,
        p_build_number: null,
        p_os_version: null,
        p_device_model: null
    });

    // Before the migration is applied the RPC is missing; that is not the
    // browser's problem, so report it without failing the page.
    return NextResponse.json({ok: !error, recorded: !error});
}

export const dynamic = "force-dynamic";
