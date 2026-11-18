import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {ARK_RELEASE_KEY, ARK_RELEASE_UNAVAILABLE, arkReleaseProblem, decodeArkReleaseQuote, decodeArkReleaseResult, decodeArkReleased} from "@/lib/ark-release";
import {isMissingArkFunction} from "@/lib/ark-story";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {createSupabasePublicClient, createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = {"Cache-Control": "private, no-store"} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Release to the Wild (AnimalDex docs/ark/release-p1-8.md; owner decision 389), behind the server's `release_to_wild`.
 *
 * GET (no `animal`): the released animals living free and their wild skill now (`voyage_releases_public_v1`): public,
 * the same for everyone, animal ids, days and a number. `{released: null}` while the switch is off or the function is
 * not there yet (the card shows nothing new).
 *
 * GET `?animal=<id>`: the signed-in reader's own quote for one of their zoo animals (`release_quote_v1`): whether it can
 * go, why not, the price of its kind's tier and their balance. Signed out: `{quote: null}`. Read only.
 *
 * POST `{animalId, clientKey}`: release it (`release_to_wild_v1`), as the signed-in owner. The body carries NO price
 * and no user: the server prices the kind's tier and charges the caller, once per `clientKey` (a retry of the same key
 * returns the same release). → `{ok: true, release}` or `{ok: false, code}` (`insufficient_credits`, a reason of the
 * quote, `unavailable`, `failed`); a refusal charges nothing.
 */
export async function GET(request: Request) {
    const animal = new URL(request.url).searchParams.get("animal");
    if (animal === null) {
        const supabase = createSupabasePublicClient();
        if (!supabase) return NextResponse.json({released: null}, {headers: {"Cache-Control": "no-store"}});
        const {data, error} = await supabase.rpc("voyage_releases_public_v1", {p_voyage: "first"});
        if (error) {
            if (!isMissingArkFunction(error)) console.warn("[ark] voyage_releases_public_v1 failed", error.message.slice(0, 200));
            return NextResponse.json({released: null}, {headers: {"Cache-Control": isMissingArkFunction(error) ? "public, s-maxage=300" : "no-store"}});
        }
        const released = decodeArkReleased(data);
        return NextResponse.json({released}, {headers: {"Cache-Control": released ? "public, s-maxage=30, stale-while-revalidate=60" : "public, s-maxage=120"}});
    }
    if (!UUID.test(animal) || !requestHasSupabaseAuthCookie(cookies().getAll())) return NextResponse.json({quote: null}, {headers: PRIVATE});
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({quote: null}, {headers: PRIVATE});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({quote: null}, {headers: PRIVATE});
    const {data, error} = await supabase.rpc("release_quote_v1", {p_animal_id: animal});
    if (error) {
        // Before the migration: not available, calmly.
        if (isMissingArkFunction(error)) return NextResponse.json({quote: ARK_RELEASE_UNAVAILABLE}, {headers: PRIVATE});
        console.warn("[ark] release_quote_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({quote: null}, {status: 502, headers: PRIVATE});
    }
    return NextResponse.json({quote: decodeArkReleaseQuote(data)}, {headers: PRIVATE});
}

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ok: false, code: "unavailable"}, {status: 503, headers: PRIVATE});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ok: false, code: "not_authenticated"}, {status: 401, headers: PRIVATE});

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const animalId = typeof body.animalId === "string" && UUID.test(body.animalId) ? body.animalId.toLowerCase() : null;
    const clientKey = typeof body.clientKey === "string" && ARK_RELEASE_KEY.test(body.clientKey) ? body.clientKey : null;
    // (Anything else in the body is never read: a price or a user sent by a client changes nothing.)
    if (!animalId || !clientKey) return NextResponse.json({ok: false, code: "failed"}, {status: 400, headers: PRIVATE});

    const {data, error} = await supabase.rpc("release_to_wild_v1", {p_animal_id: animalId, p_client_key: clientKey});
    if (error) {
        if (isMissingArkFunction(error)) return NextResponse.json({ok: false, code: "unavailable"}, {status: 503, headers: PRIVATE});
        const code = arkReleaseProblem(error.message);
        if (code === "failed") console.warn("[ark] release_to_wild_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({ok: false, code}, {status: code === "failed" ? 502 : code === "not_authenticated" ? 401 : 400, headers: PRIVATE});
    }
    const release = decodeArkReleaseResult(data);
    if (!release) {
        console.warn("[ark] release_to_wild_v1 answered something else");
        return NextResponse.json({ok: false, code: "failed"}, {status: 502, headers: PRIVATE});
    }
    return NextResponse.json({ok: true, release}, {headers: PRIVATE});
}
