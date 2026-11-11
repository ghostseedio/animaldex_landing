import {NextResponse} from "next/server";
import {readArkFounderSettings} from "@/data/ark-founders";
import {arkFounderNameRefusal, decodeArkFounderSettings} from "@/lib/ark-founders";
import {isMissingArkFunction} from "@/lib/ark-story";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Show my name on my Ark animals" (founders contract, section 3), as the
 * signed-in reader:
 *
 * - GET: `voyage_founder_settings_v1()` — `{settings}` (null signed out or
 *   before the migration; the setting shows only when `enabled`).
 * - POST {show: boolean, confirm_adult?: boolean}:
 *   `set_voyage_founder_name_v1(p_show, p_confirm_adult)`, which covers all
 *   their animals at once (the "Show my name on them too" chip sends
 *   `true`). Turning it on without a stored adult year needs the one-tap
 *   "I'm 18 or over" (`confirm_adult: true`); `p_confirm_adult` is sent only
 *   then, so the call is the same as before otherwise. Answers the settings
 *   as they are now, or `{settings: null, error}` with
 *   `adult_confirmation_required` or `under_18` (403).
 */
const HEADERS = {"Cache-Control": "private, no-store"} as const;

export async function GET() {
    return NextResponse.json({settings: await readArkFounderSettings()}, {headers: HEADERS});
}

export async function POST(request: Request) {
    let show: unknown;
    let confirmAdult = false;
    try {
        const body = await request.json() as {show?: unknown; confirm_adult?: unknown};
        show = body?.show;
        confirmAdult = body?.confirm_adult === true;
    } catch {
        show = undefined;
    }
    if (typeof show !== "boolean") return NextResponse.json({settings: null, error: "invalid_value"}, {status: 400, headers: HEADERS});
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({settings: null}, {status: 503, headers: HEADERS});
    const {data, error} = await supabase.rpc("set_voyage_founder_name_v1", show && confirmAdult ? {p_show: show, p_confirm_adult: true} : {p_show: show});
    if (error) {
        const refusal = arkFounderNameRefusal(error.message);
        if (refusal) return NextResponse.json({settings: null, error: refusal}, {status: 403, headers: HEADERS});
        const signedOut = /not_authenticated/.test(error.message ?? "");
        if (!signedOut && !isMissingArkFunction(error)) console.warn("[ark] set_voyage_founder_name_v1 failed", error.message?.slice(0, 200));
        return NextResponse.json({settings: null}, {status: signedOut ? 401 : 503, headers: HEADERS});
    }
    return NextResponse.json({settings: decodeArkFounderSettings(data)}, {headers: HEADERS});
}
