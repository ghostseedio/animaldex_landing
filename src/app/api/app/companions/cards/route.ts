import {NextResponse} from "next/server";
import {createSupabaseServerClient, createSupabaseServiceClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every card you hold, for the Companions tab (which of an animal's cards its
 * chat opens on, and the animals held before the bond has them) and the group
 * picker (every card, one of each species picked). iOS reads these from the
 * phone's library.
 *
 * The cards a chat can be had through, as the server's own
 * `animal_owned_capture_for_species` picks them: ready, not merged into
 * another, not sealed in a pack, a card rather than a sighting. Each one's
 * species is folded into its canonical one, the bond's, with the slug its
 * icon art is filed under.
 *
 * Read with the service role, keyed only on the verified signed-in user.
 */

type Row = Record<string, unknown>;

const PAGE = 1000;
const MAX_CARDS = 3000;

function str(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const service = createSupabaseServiceClient();
    if (!service) return NextResponse.json({cards: [], available: false});

    const rows: Row[] = [];
    for (let offset = 0; offset < MAX_CARDS; offset += PAGE) {
        const {data, error} = await service
            .from("captures")
            .select("id, title, created_at, captured_at, analysis_results!inner(species_profile_id, animal_name, completed_at, error_message)")
            .eq("user_id", user.id)
            .eq("status", "ready")
            .is("merged_into_capture_id", null)
            .is("sealed_pack_id", null)
            .or("observation_domain_role.is.null,observation_domain_role.eq.card")
            .order("created_at", {ascending: false})
            .range(offset, offset + PAGE - 1);
        if (error) {
            console.warn("[companions] cards unavailable", error.message.slice(0, 200));
            return NextResponse.json({cards: [], available: false});
        }
        rows.push(...((data ?? []) as Row[]));
        if (!data || data.length < PAGE) break;
    }

    const cards = rows.flatMap((row) => {
        const analysis = (Array.isArray(row.analysis_results) ? row.analysis_results[0] : row.analysis_results) as Row | null | undefined;
        const species = str(analysis?.species_profile_id);
        if (!analysis || !species || !analysis.completed_at || str(analysis.error_message)) return [];
        return [{
            captureId: String(row.id),
            species,
            animal: str(analysis.animal_name) ?? "",
            nickname: str(row.title)?.slice(0, 40).trim() ?? null,
            capturedAt: str(row.captured_at) ?? str(row.created_at)
        }];
    });

    // One canonical hop, as the bond and the animal's messages key an animal,
    // and the slug that species' icon art is filed under.
    const rawIds = Array.from(new Set(cards.map((card) => card.species)));
    const canonicalOf = new Map<string, string>();
    for (let index = 0; index < rawIds.length; index += 300) {
        const {data} = await service
            .from("species_profiles")
            .select("id, canonical_species_profile_id")
            .in("id", rawIds.slice(index, index + 300));
        for (const row of (data ?? []) as Row[]) {
            canonicalOf.set(String(row.id), str(row.canonical_species_profile_id) ?? String(row.id));
        }
    }
    const canonicalIds = Array.from(new Set(rawIds.map((id) => canonicalOf.get(id) ?? id)));
    const slugOf = new Map<string, string>();
    for (let index = 0; index < canonicalIds.length; index += 300) {
        const {data} = await service
            .from("species_profiles")
            .select("id, normalized_identity_key")
            .in("id", canonicalIds.slice(index, index + 300));
        for (const row of (data ?? []) as Row[]) {
            const key = str(row.normalized_identity_key);
            if (key) slugOf.set(String(row.id), key.replace(/_/g, "-"));
        }
    }

    return NextResponse.json({
        cards: cards.map((card) => {
            const species = canonicalOf.get(card.species) ?? card.species;
            return {
                capture_id: card.captureId,
                species_profile_id: species,
                animal: card.animal,
                nickname: card.nickname,
                slug: slugOf.get(species) ?? null,
                captured_at: card.capturedAt
            };
        }),
        available: true
    });
}
