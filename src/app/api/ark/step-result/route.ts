import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {decodeArkStepResult} from "@/lib/ark-thrive";
import {isMissingArkFunction} from "@/lib/ark-story";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {"Cache-Control": "private, no-store"} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET ?step=<step id>: what the reader's own step that worked did for their
 * animals of its kind (captures + thrive, the frozen read contract section
 * 5): `voyage_step_result_v1`: pending (queued, applied within about a
 * minute), or done, with the band before and after and the step's locked
 * Ark Score points. The chat draws it as one line under the reply that
 * finished the step.
 *
 * `{result: null}` when signed out, for anyone else's step, a step that is
 * not done + worked, before the function is applied, or when it fails.
 */
export async function GET(request: Request) {
    if (!requestHasSupabaseAuthCookie(cookies().getAll())) return NextResponse.json({result: null}, {headers: HEADERS});
    const step = new URL(request.url).searchParams.get("step")?.trim() ?? "";
    if (!UUID.test(step)) return NextResponse.json({result: null}, {status: 400, headers: HEADERS});
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({result: null}, {headers: HEADERS});
    const {data, error} = await supabase.rpc("voyage_step_result_v1", {p_step_id: step.toLowerCase()});
    if (error) {
        if (!isMissingArkFunction(error) && !/not_authenticated/.test(error.message ?? "")) {
            console.warn("[ark] voyage_step_result_v1 failed", error.message?.slice(0, 200));
        }
        return NextResponse.json({result: null, source: "none"}, {headers: HEADERS});
    }
    return NextResponse.json({result: decodeArkStepResult(data), source: "server"}, {headers: HEADERS});
}
