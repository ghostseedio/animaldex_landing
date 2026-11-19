import {NextResponse} from "next/server";
import {arkCrisisIdParam, shapeArkCrises} from "@/lib/ark-crises-server";
import {isMissingArkFunction} from "@/lib/ark-story";
import {isPublishedAnimalSlug} from "@/lib/published-seo-slugs";
import {createSupabasePublicClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: Endangered now (`voyage_crises_v1`, AnimalDex migration 20261203160000, E4): the kinds in an open wild crisis,
 * as the engine's database committed them, the last one before critical, the newest first. `?crisis=<id>` also
 * answers that crisis when it has ended (a shared link). `?lang=` is accepted and changes nothing yet: the field guide
 * holds its habitat text and names in English only. Contract: docs/ark/audits/ecosystem/crises-api-contract.md.
 *
 * Public and the same for everyone: kinds, counts, days and animal ids. No person, capture, coordinate or city; the
 * countries are the ones the field guide's own text names. The one thing about a person: a saved crisis an arrival ended
 * carries `saved_by` (contract 1.1), a display name or null for "a collector" (the database decides who may be named; the
 * route keeps only `[{name}]`). Nothing here predicts.
 *
 *   200 {available: true, ...}      the list (empty most days)
 *   200 {available: false}          the read is not there yet, or its flag is off: the calm empty state
 *   503                             the read failed now: the clients say "Can't check right now", never the empty state
 */
const CACHE = "public, s-maxage=30, stale-while-revalidate=60";
const ABSENT = {available: false, crises: []};

export async function GET(request: Request) {
    const supabase = createSupabasePublicClient();
    if (!supabase) return NextResponse.json(ABSENT, {headers: {"Cache-Control": "no-store"}});
    const crisis = arkCrisisIdParam(new URL(request.url).searchParams.get("crisis"));
    const {data, error} = await supabase.rpc("voyage_crises_v1", {p_voyage: "first", p_crisis: crisis});
    if (error) {
        if (isMissingArkFunction(error)) return NextResponse.json(ABSENT, {headers: {"Cache-Control": "public, s-maxage=300"}});
        console.warn("[ark] voyage_crises_v1 failed", error.message.slice(0, 200));
        return NextResponse.json(ABSENT, {status: 503, headers: {"Cache-Control": "no-store"}});
    }
    const body = shapeArkCrises(data, isPublishedAnimalSlug);
    if (!body) return NextResponse.json(ABSENT, {status: 503, headers: {"Cache-Control": "no-store"}});
    return NextResponse.json(body, {headers: {"Cache-Control": body.available ? CACHE : "public, s-maxage=60"}});
}
