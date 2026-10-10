import {NextRequest, NextResponse} from "next/server";
import {getDiscoverAnimalTrialCohort} from "@/data/discover-timeline";
import {ANIMAL_TRIAL_COHORT_PAGE_SIZE} from "@/lib/discover-animal-trial";
import {createSupabasePublicClient, createSupabaseServerClient} from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The index's whole alias family: each id's canonical row plus every row folded
 * into it, so "Albino Ball Python" attempts show on the Ball Python Trial. Web
 * twin of iOS `otherAttemptProfileIDs` (catalog entry + its cohort scope).
 */
async function withAliases(ids: string[]) {
    const supabase = createSupabasePublicClient();
    const valid = ids.filter((id) => UUID_PATTERN.test(id));
    if (!supabase || !valid.length) return ids;

    const {data: rows} = await supabase
        .from("species_profiles")
        .select("id, canonical_species_profile_id")
        .in("id", valid);
    const canonical = Array.from(new Set((rows ?? []).map((row) => String(row.canonical_species_profile_id ?? row.id))));
    if (!canonical.length) return ids;

    const {data: family} = await supabase
        .from("species_profiles")
        .select("id")
        .in("canonical_species_profile_id", canonical);
    return Array.from(new Set([...ids, ...canonical, ...(family ?? []).map((row) => String(row.id))]));
}

async function viewerId() {
    try {
        const {data} = await createSupabaseServerClient()?.auth.getUser() ?? {data: null};
        return data?.user?.id?.toLowerCase() ?? null;
    } catch {
        return null;
    }
}

/**
 * Other people's Trial posts for one index, for the pager on an Animal Trial
 * Discover card. Web twin of iOS `fetchAnimalTrialPosts(speciesProfileIDs:limit:offset:)`.
 * Public: the source view is anon-readable, and it carries only what the
 * card shows.
 *
 * `scope=attempts` is the Trial sheet's OTHER ATTEMPTS (iOS
 * `fetchAnimalTrialAttempts`): aliases folded in, the viewer's own post left out.
 */
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const requested = params.getAll("species").flatMap((value) => value.split(","));
    const offset = Number(params.get("offset") ?? 0);
    const limit = Number(params.get("limit") ?? ANIMAL_TRIAL_COHORT_PAGE_SIZE);
    const isAttempts = params.get("scope") === "attempts";

    const [species, viewer] = isAttempts
        ? await Promise.all([withAliases(requested), viewerId()])
        : [requested, null];

    const items = await getDiscoverAnimalTrialCohort(
        species,
        Number.isFinite(limit) ? limit : ANIMAL_TRIAL_COHORT_PAGE_SIZE,
        Number.isFinite(offset) ? offset : 0,
        params.get("frequency")
    );

    const response = NextResponse.json({
        items: viewer ? items.filter((item) => item.collector.userId.toLowerCase() !== viewer) : items
    });
    response.headers.set("Cache-Control", "private, max-age=30");
    return response;
}

export const dynamic = "force-dynamic";
