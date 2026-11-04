import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {hasAuthCookie} from "@/lib/viewer";
import {acquisitionTouch, FIRST_TOUCH_COOKIE, parseFirstTouch} from "@/lib/first-touch";

// Only a new account takes the browser's first touch: an old account opening
// the web app says nothing about how it was acquired.
const NEW_ACCOUNT_MS = 3 * 24 * 60 * 60 * 1000;

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

    // The page and site this browser first arrived from. The RPC keeps the
    // first report per account, so a repeat is a no-op.
    const touch = parseFirstTouch(cookies().get(FIRST_TOUCH_COOKIE)?.value);
    const createdAt = Date.parse(user.created_at ?? "");
    if (touch && Number.isFinite(createdAt) && Date.now() - createdAt < NEW_ACCOUNT_MS) {
        await supabase.rpc("record_user_acquisition", {
            p_platform: "web",
            p_self_reported_source: null,
            p_self_reported_detail: null,
            p_install_referrer: null,
            p_apple_ads: null,
            // The attribution only: the hero test's variant and visitor id stay in the browser.
            p_utm: acquisitionTouch(touch)
        });
    }

    // Before the migration is applied the RPC is missing; that is not the
    // browser's problem, so report it without failing the page.
    return NextResponse.json({ok: !error, recorded: !error});
}

export const dynamic = "force-dynamic";
