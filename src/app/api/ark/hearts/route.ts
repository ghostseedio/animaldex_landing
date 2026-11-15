import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {ARK_HEART_COST, arkDayToTime, clampArkHearts, type ArkAnimalHearts} from "@/lib/ark-hearts";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {createSupabaseServerClient, createSupabaseServiceClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {"Cache-Control": "private, no-store"} as const;
const MAX_ANIMALS = 400;

/**
 * GET: the signed-in reader's own Ark animals' hearts (AnimalDex docs/ark/HEARTS-LIVES-DESIGN.md, section 6), for the
 * /ark tap card's lives row, the bars' hearts and the "recovering" list.
 *
 * Only while the server's `ark_hearts` switch is on (`ark_hearts_enabled()`): off, signed out, or on a server without
 * the hearts columns (the migration not applied), the answer is `{hearts: null}` and the page shows nothing new.
 *
 * Whose: an arrived animal of the reader's (`voyage_animals.owner_user_id`) whose card (`voyage_arrival_sources`) the
 * reader still holds (`captures.user_id`), exactly the server's `voyage_animal_card`. Read with the service key after
 * the reader is known, and filtered to them: nobody else's card, hearts or animals ever come out. Read only.
 */
export async function GET() {
    if (!requestHasSupabaseAuthCookie(cookies().getAll())) return NextResponse.json({hearts: null}, {headers: HEADERS});
    const supabase = createSupabaseServerClient();
    const service = createSupabaseServiceClient();
    if (!supabase || !service) return NextResponse.json({hearts: null}, {headers: HEADERS});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({hearts: null}, {headers: HEADERS});
    try {
        const hearts = await readOwnerHearts(service, user.id);
        return NextResponse.json({hearts}, {headers: HEADERS});
    } catch (error) {
        console.warn("[ark] hearts read failed", error instanceof Error ? error.message.slice(0, 200) : error);
        return NextResponse.json({hearts: null}, {headers: HEADERS});
    }
}

type Service = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;
type AnimalRow = {id: string; voyage_id: string; species_profile_id: string; status: string; recover_until_ark_day: number | null; recover_cause: string | null; revives: number | null};

async function readOwnerHearts(service: Service, userId: string) {
    const enabled = await service.rpc("ark_hearts_enabled");
    if (enabled.error || enabled.data !== true) return null;
    const animalsRead = await service
        .from("voyage_animals")
        .select("id, voyage_id, species_profile_id, status, recover_until_ark_day, recover_cause, revives")
        .eq("owner_user_id", userId)
        .eq("origin", "arrived")
        .in("status", ["present", "recovering"])
        .limit(MAX_ANIMALS);
    // (No hearts columns yet: the migration is not applied, nothing to show.)
    if (animalsRead.error) return null;
    const animals = (animalsRead.data ?? []) as AnimalRow[];
    if (!animals.length) return {healCost: ARK_HEART_COST, animals: {}};
    const ids = animals.map((animal) => animal.id);
    const sources = await service.from("voyage_arrival_sources").select("animal_id, capture_id").in("animal_id", ids).not("capture_id", "is", null);
    if (sources.error) return null;
    const cardOf = new Map<string, string>();
    for (const row of (sources.data ?? []) as Array<{animal_id: string; capture_id: string | null}>) {
        if (row.capture_id && !cardOf.has(row.animal_id)) cardOf.set(row.animal_id, row.capture_id);
    }
    const cardIds = Array.from(new Set(cardOf.values()));
    if (!cardIds.length) return {healCost: ARK_HEART_COST, animals: {}};
    // The reader's own cards only: a card traded or deleted is no one's lives (the server's rule).
    const cards = await service.from("captures").select("id, challenge_health").in("id", cardIds).eq("user_id", userId);
    if (cards.error) return null;
    const heartsOf = new Map(((cards.data ?? []) as Array<{id: string; challenge_health: number | null}>).map((row) => [row.id, clampArkHearts(row.challenge_health ?? 3)]));

    // The recovering ones are not in the snapshot: their names, slugs and when they are back.
    const away = animals.filter((animal) => animal.status === "recovering" && heartsOf.has(cardOf.get(animal.id) ?? ""));
    const startOf = new Map<string, string>();
    const nameOf = new Map<string, string>();
    const slugOf = new Map<string, string>();
    if (away.length) {
        const voyageIds = Array.from(new Set(away.map((animal) => animal.voyage_id)));
        const speciesIds = Array.from(new Set(away.map((animal) => animal.species_profile_id)));
        const [voyages, species, models] = await Promise.all([
            service.from("voyages").select("id, started_at").in("id", voyageIds),
            service.from("species_profiles").select("id, display_name, animal_name").in("id", speciesIds),
            service.from("voyage_species").select("species_profile_id, model_slug").in("species_profile_id", speciesIds)
        ]);
        for (const row of (voyages.data ?? []) as Array<{id: string; started_at: string | null}>) if (row.started_at) startOf.set(row.id, row.started_at);
        for (const row of (species.data ?? []) as Array<{id: string; display_name: string | null; animal_name: string | null}>) {
            const name = row.display_name?.trim() || row.animal_name?.trim();
            if (name) nameOf.set(row.id, name);
        }
        for (const row of (models.data ?? []) as Array<{species_profile_id: string; model_slug: string | null}>) if (row.model_slug) slugOf.set(row.species_profile_id, row.model_slug);
    }

    const out: Record<string, ArkAnimalHearts> = {};
    for (const animal of animals) {
        const captureId = cardOf.get(animal.id);
        if (!captureId || !heartsOf.has(captureId)) continue;
        const recovering = animal.status === "recovering";
        const start = startOf.get(animal.voyage_id);
        const back = recovering && start && typeof animal.recover_until_ark_day === "number" ? arkDayToTime(start, Number(animal.recover_until_ark_day)) : null;
        out[animal.id] = {
            id: animal.id,
            captureId,
            hearts: heartsOf.get(captureId) ?? 3,
            status: recovering ? "recovering" : "present",
            returnsAt: back !== null ? new Date(back).toISOString() : null,
            cause: recovering && (animal.recover_cause === "eaten" || animal.recover_cause === "starved" || animal.recover_cause === "died_old") ? animal.recover_cause : null,
            revives: Math.max(Number(animal.revives ?? 0) || 0, 0),
            name: recovering ? nameOf.get(animal.species_profile_id) ?? null : null,
            modelSlug: recovering ? slugOf.get(animal.species_profile_id) ?? null : null
        };
    }
    return {healCost: ARK_HEART_COST, animals: out};
}
