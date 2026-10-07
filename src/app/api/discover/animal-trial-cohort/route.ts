import {NextRequest, NextResponse} from "next/server";
import {getDiscoverAnimalTrialCohort} from "@/data/discover-timeline";
import {ANIMAL_TRIAL_COHORT_PAGE_SIZE} from "@/lib/discover-animal-trial";

/**
 * Other people's Trial posts for one index, for the pager on an Animal Trial
 * Discover card. Web twin of iOS `fetchAnimalTrialPosts(speciesProfileIDs:limit:offset:)`.
 * Public: the source view is anon-readable, and it carries only what the
 * card shows.
 */
export async function GET(request: NextRequest) {
    const species = request.nextUrl.searchParams.getAll("species").flatMap((value) => value.split(","));
    const offset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? ANIMAL_TRIAL_COHORT_PAGE_SIZE);

    const items = await getDiscoverAnimalTrialCohort(
        species,
        Number.isFinite(limit) ? limit : ANIMAL_TRIAL_COHORT_PAGE_SIZE,
        Number.isFinite(offset) ? offset : 0,
        request.nextUrl.searchParams.get("frequency")
    );

    const response = NextResponse.json({items});
    response.headers.set("Cache-Control", "private, max-age=30");
    return response;
}

export const dynamic = "force-dynamic";
