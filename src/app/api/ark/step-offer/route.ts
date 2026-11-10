import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {readArkVoyage} from "@/data/ark-voyage";
import {arkStepOfferFromSnapshot, decodeArkStepOffer} from "@/lib/ark-world";
import {isMissingArkFunction} from "@/lib/ark-story";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {"Cache-Control": "private, no-store"} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;

/**
 * GET ?species=<species_profile_id>&slug=<model slug>&name=<display name>:
 * what a step that works means for the Ark, for the signed-in reader and
 * this species (Part 2, docs/ark-next.md): `voyage_step_offer_state_v1`
 * (the caller's own living count only; never anyone else's ids).
 *
 * Before that function is applied, the same answer from the public
 * snapshot read with the reader's session (their own come back `mine`).
 * `{offer: null}` when signed out, or when neither reads.
 */
export async function GET(request: Request) {
    if (!requestHasSupabaseAuthCookie(cookies().getAll())) return NextResponse.json({offer: null}, {headers: HEADERS});
    const params = new URL(request.url).searchParams;
    const species = params.get("species")?.trim() ?? "";
    const slug = params.get("slug")?.trim().toLowerCase() ?? "";
    const name = params.get("name")?.replace(/\s+/g, " ").trim().slice(0, 80) || null;
    if (!UUID.test(species) && !SLUG.test(slug)) return NextResponse.json({offer: null}, {status: 400, headers: HEADERS});

    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({offer: null}, {headers: HEADERS});
    if (UUID.test(species)) {
        const {data, error} = await supabase.rpc("voyage_step_offer_state_v1", {p_species_profile_id: species.toLowerCase()});
        if (!error) {
            const offer = decodeArkStepOffer(data);
            return NextResponse.json({offer, source: "server"}, {headers: HEADERS});
        }
        if (!isMissingArkFunction(error) && !/not_authenticated/.test(error.message ?? "")) {
            console.warn("[ark] voyage_step_offer_state_v1 failed", error.message?.slice(0, 200));
        }
    }

    const read = await readArkVoyage();
    if (!read.available) return NextResponse.json({offer: null}, {headers: HEADERS});
    const offer = arkStepOfferFromSnapshot(read.snapshot.animals, {
        speciesProfileId: UUID.test(species) ? species : null,
        slug: SLUG.test(slug) ? slug : null,
        name
    });
    return NextResponse.json({offer, source: "snapshot"}, {headers: HEADERS});
}
