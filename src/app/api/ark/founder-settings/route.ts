import {NextResponse} from "next/server";
import {readArkFounderSettings} from "@/data/ark-founders";
import {decodeArkFounderSettings} from "@/lib/ark-founders";
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
 * - POST {show: boolean}: `set_voyage_founder_name_v1(p_show)`, which covers
 *   all their animals at once (the "Show my name on them too" chip sends
 *   `true`). Answers the settings as they are now.
 */
const HEADERS = {"Cache-Control": "private, no-store"} as const;

export async function GET() {
    return NextResponse.json({settings: await readArkFounderSettings()}, {headers: HEADERS});
}

export async function POST(request: Request) {
    let show: unknown;
    try {
        show = (await request.json() as {show?: unknown})?.show;
    } catch {
        show = undefined;
    }
    if (typeof show !== "boolean") return NextResponse.json({settings: null, error: "invalid_value"}, {status: 400, headers: HEADERS});
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({settings: null}, {status: 503, headers: HEADERS});
    const {data, error} = await supabase.rpc("set_voyage_founder_name_v1", {p_show: show});
    if (error) {
        const signedOut = /not_authenticated/.test(error.message ?? "");
        if (!signedOut && !isMissingArkFunction(error)) console.warn("[ark] set_voyage_founder_name_v1 failed", error.message?.slice(0, 200));
        return NextResponse.json({settings: null}, {status: signedOut ? 401 : 503, headers: HEADERS});
    }
    return NextResponse.json({settings: decodeArkFounderSettings(data)}, {headers: HEADERS});
}
