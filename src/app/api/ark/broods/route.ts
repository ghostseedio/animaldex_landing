import {NextResponse} from "next/server";
import {isMissingArkFunction} from "@/lib/ark-story";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OFF = {on: false, broods: [], ended: []};

/**
 * GET: the engine's broods as the scene draws them (`voyage_broods_v1`, AnimalDex docs/ark/broods.md 7.1): each live
 * clutch or litter as one record (its kind, parents, stage, count now and at the start, its nest's slot, who attends
 * it, and each loss with its hunter and count), and those that ended in the last real day. Public and the same for
 * everyone (animal ids, Ark days, scene metres; never a user, a bringer or a fate). `{on: false}` while the server's
 * `broods` switch is off and until the function exists: the scene then loads nothing of the broods and stays as it is
 * (`src/lib/ark-broods.ts`).
 */
export async function GET() {
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json(OFF, {headers: {"Cache-Control": "no-store"}});
    const {data, error} = await supabase.rpc("voyage_broods_v1", {p_voyage: "first"});
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] voyage_broods_v1 failed", error.message.slice(0, 200));
        return NextResponse.json(OFF, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=300" : "no-store"}});
    }
    const on = Boolean(data && typeof data === "object" && (data as {on?: unknown}).on === true);
    // (Off is cached for minutes: the switch is turned once. On: as fresh as the events' own cache.)
    return NextResponse.json(on ? data : OFF, {headers: {"Cache-Control": on ? "public, s-maxage=30, stale-while-revalidate=60" : "public, s-maxage=300, stale-while-revalidate=600"}});
}
