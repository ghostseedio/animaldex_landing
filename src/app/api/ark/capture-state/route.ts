import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {decodeArkCaptureState} from "@/lib/ark-thrive";
import {isMissingArkFunction} from "@/lib/ark-story";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {"Cache-Control": "private, no-store"} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET ?capture=<capture id>: the capture page's Ark band, for the signed-in
 * reader's own capture (captures + thrive, the frozen read contract section
 * 6): `voyage_capture_state_v1` (aboard, coming aboard, waiting for its
 * model, the pair full, gone, or not on the Ark), as the reader. It answers
 * only about the caller's own capture, and never with a place or a nickname.
 *
 * `{state: null}` when signed out, for someone else's capture, before the
 * function is applied, or when it fails: the band then reads the public
 * snapshot as before (`ark-capture-band.tsx`).
 */
export async function GET(request: Request) {
    if (!requestHasSupabaseAuthCookie(cookies().getAll())) return NextResponse.json({state: null}, {headers: HEADERS});
    const capture = new URL(request.url).searchParams.get("capture")?.trim() ?? "";
    if (!UUID.test(capture)) return NextResponse.json({state: null}, {status: 400, headers: HEADERS});
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({state: null}, {headers: HEADERS});
    const {data, error} = await supabase.rpc("voyage_capture_state_v1", {p_capture_id: capture.toLowerCase()});
    if (error) {
        if (!isMissingArkFunction(error) && !/not_authenticated/.test(error.message ?? "")) {
            console.warn("[ark] voyage_capture_state_v1 failed", error.message?.slice(0, 200));
        }
        return NextResponse.json({state: null, source: "none"}, {headers: HEADERS});
    }
    return NextResponse.json({state: decodeArkCaptureState(data), source: "server"}, {headers: HEADERS});
}
