import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {isArkSource} from "@/lib/ark-measure";
import {arkMeasureRecording} from "@/lib/ark-measure-server";
import {isMissingArkFunction} from "@/lib/ark-story";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {"Cache-Control": "private, no-store"} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ANIMALS = 200;

/**
 * POST {animal_ids, surface}: an Ark surface showed the signed-in reader
 * these animals of theirs aboard. `record_ark_arrival_seen_v1` (AnimalDex
 * migration 20261111150000) keeps the first sighting of each, for the
 * owner's own animals only; anything else in the list is ignored there.
 *
 * `recorded: false` with no error when there is no session, before the
 * migration (the function is missing), or outside production (as
 * /api/ark-events: `WEB_ARK_EVENTS_RECORD_IN_DEV=1` records from a dev
 * server): the browser then asks again on a later visit instead of
 * remembering it as told.
 */
export async function POST(request: Request) {
    if (request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ok: false}, {status: 403, headers: HEADERS});
    if (!requestHasSupabaseAuthCookie(cookies().getAll())) return NextResponse.json({ok: true, recorded: false}, {headers: HEADERS});
    const body = await request.json().catch(() => null) as {animal_ids?: unknown; surface?: unknown} | null;
    const given: unknown[] = body && Array.isArray(body.animal_ids) ? body.animal_ids : [];
    const ids = given.length
        ? Array.from(new Set(given.filter((id): id is string => typeof id === "string" && UUID.test(id)).map((id) => id.toLowerCase()))).slice(0, MAX_ANIMALS)
        : [];
    const surface = body && isArkSource(body.surface) ? body.surface : null;
    if (!ids.length || !surface) return NextResponse.json({ok: false}, {status: 400, headers: HEADERS});

    if (arkMeasureRecording() !== "on") {
        console.info("[ark-measure] arrival seen not recorded outside production", {animals: ids.length, surface});
        return NextResponse.json({ok: true, recorded: false}, {headers: HEADERS});
    }
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ok: true, recorded: false}, {headers: HEADERS});
    const {data, error} = await supabase.rpc("record_ark_arrival_seen_v1", {p_animal_ids: ids, p_surface: surface});
    if (error) {
        if (!isMissingArkFunction(error) && !/not_authenticated/.test(error.message ?? "")) {
            console.warn("[ark] record_ark_arrival_seen_v1 failed", error.message?.slice(0, 200));
        }
        return NextResponse.json({ok: true, recorded: false}, {headers: HEADERS});
    }
    // The ids seen for the first time now: only these are reported as `ark_arrival_seen`.
    const firstSeen = Array.isArray(data) ? data.filter((id): id is string => typeof id === "string").map((id) => id.toLowerCase()) : [];
    return NextResponse.json({ok: true, recorded: true, firstSeen}, {headers: HEADERS});
}
