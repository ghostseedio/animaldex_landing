import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {decodeArkCardDeath} from "@/lib/ark-chat-death";
import {isMissingArkFunction} from "@/lib/ark-story";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {createSupabasePublicClient, createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {"Cache-Control": "private, no-store"} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET ?capture=<capture id>: whether the animal the reader's own card brought
 * aboard has died on the Ark for good, for the quiet line in that card's chat
 * thread (AnimalDex docs/ark/chat-is-ark.md section 3; `ark-chat-death.ts`).
 *
 * `voyage_capture_lives_v1`, as the reader (it answers only about the caller's
 * own card, and only with `ark_hearts` on); once it says `gone`, the animal's
 * public life story (`voyage_animal_life_v1`) gives when it came aboard, for
 * how long it lived there. Read only.
 *
 * `{death: null}` when signed out, for someone else's card, while it lives or
 * recovers, with hearts off, before the function is applied, or on a failure.
 */
export async function GET(request: Request) {
    if (!requestHasSupabaseAuthCookie(cookies().getAll())) return NextResponse.json({death: null}, {headers: HEADERS});
    const capture = new URL(request.url).searchParams.get("capture")?.trim() ?? "";
    if (!UUID.test(capture)) return NextResponse.json({death: null}, {status: 400, headers: HEADERS});
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({death: null}, {headers: HEADERS});
    const {data, error} = await supabase.rpc("voyage_capture_lives_v1", {p_capture_id: capture.toLowerCase()});
    if (error) {
        if (!isMissingArkFunction(error) && !/not_authenticated/.test(error.message ?? "")) {
            console.warn("[ark] voyage_capture_lives_v1 failed", error.message?.slice(0, 200));
        }
        return NextResponse.json({death: null}, {headers: HEADERS});
    }
    const gone = decodeArkCardDeath(data);
    if (!gone) return NextResponse.json({death: null}, {headers: HEADERS});
    let arrivedAt: string | null = null;
    const publicClient = createSupabasePublicClient();
    if (publicClient) {
        const life = await publicClient.rpc("voyage_animal_life_v1", {p_animal_id: gone.animalId});
        const origin = !life.error && life.data && typeof life.data === "object" ? (life.data as {origin?: {at?: unknown}}).origin : null;
        arrivedAt = typeof origin?.at === "string" ? origin.at : null;
    }
    return NextResponse.json({death: decodeArkCardDeath(data, arrivedAt)}, {headers: HEADERS});
}
