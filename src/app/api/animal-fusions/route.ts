import {NextResponse} from "next/server";
import {getFusableSpecies, getPublishedAnimalFusion, parseAnimalFusionSlug, type AnimalFusionEntry, type FusableSpecies} from "@/data/animal-fusions";
import {ANIMAL_HYBRID_CANONICAL_BASE_PATH, getAnimalHybridForPair} from "@/data/animal-hybrids";
import {fuseSpecies} from "@/lib/animal-fusions-server";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";
import {createSupabaseServerClient, createSupabaseServiceClient} from "@/lib/supabase/server";
import {hasAuthCookie} from "@/lib/viewer";

export const runtime = "nodejs";

// Every new pair is one OpenAI call; cached pairs are free and unlimited.
const GENERATE_LIMIT = 10;
const GENERATE_WINDOW_MS = 60 * 60 * 1000;
const LOOKUP_LIMIT = 60;
const LOOKUP_WINDOW_MS = 10 * 60 * 1000;

/**
 * A fused pair as the Fuse tool shows it. `href` is set only once the pair is
 * in the build snapshot and so has its own static page.
 */
function fusionPayload(entry: AnimalFusionEntry, receiver: FusableSpecies, donor: FusableSpecies, source: string) {
    return {
        status: "ok",
        source,
        href: getPublishedAnimalFusion(entry.slug) ? `${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${entry.slug}` : null,
        entry,
        receiver: {slug: receiver.slug, name: receiver.name},
        donor: {slug: donor.slug, name: donor.name}
    };
}

function rateLimited(retryAfterSeconds: number) {
    return NextResponse.json(
        {error: "rate_limited", retryAfterSeconds},
        {status: 429, headers: {"Retry-After": String(retryAfterSeconds)}}
    );
}

/**
 * Fuse two animals: returns the stored recipe for the pair, or generates it
 * for a signed-in viewer. Body: {receiver, donor} as published animal slugs.
 */
export async function POST(request: Request) {
    let body: {receiver?: unknown; donor?: unknown};
    try {
        body = (await request.json()) as typeof body;
    } catch {
        return NextResponse.json({error: "invalid_request"}, {status: 400});
    }

    const receiver = getFusableSpecies(String(body.receiver ?? ""));
    const donor = getFusableSpecies(String(body.donor ?? ""));
    if (!receiver || !donor) return NextResponse.json({error: "unknown_animal"}, {status: 400});
    if (receiver.slug === donor.slug) return NextResponse.json({error: "same_animal"}, {status: 400});

    const lookup = checkRateLimit(`fusion-lookup:${getRequestIdentifier(request)}`, LOOKUP_LIMIT, LOOKUP_WINDOW_MS);
    if (!lookup.allowed) return rateLimited(lookup.retryAfterSeconds);

    const admin = createSupabaseServiceClient();
    if (!admin) return NextResponse.json({error: "unavailable"}, {status: 503});

    try {
        const existing = await fuseSpecies(admin, receiver, donor, {allowGenerate: false});
        if (existing?.status === "ok") {
            return NextResponse.json(fusionPayload(existing.entry, receiver, donor, existing.source));
        }

        const supabase = hasAuthCookie() ? createSupabaseServerClient() : null;
        const {data} = supabase ? await supabase.auth.getUser() : {data: {user: null}};
        if (!data.user) {
            const hybrid = getAnimalHybridForPair(receiver.slug, donor.slug);
            return NextResponse.json({
                error: "authentication_required",
                hybrid: hybrid ? {title: hybrid.title, href: `${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${hybrid.slug}`} : null
            }, {status: 401});
        }

        const limit = checkRateLimit(`fusion-generate:${data.user.id}`, GENERATE_LIMIT, GENERATE_WINDOW_MS);
        if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

        const result = await fuseSpecies(admin, receiver, donor, {allowGenerate: true});
        if (result?.status === "ok") {
            return NextResponse.json(fusionPayload(result.entry, receiver, donor, result.source));
        }
        if (result?.status === "principle_missing") {
            return NextResponse.json({error: "principle_missing", animal: result.species.name}, {status: 412});
        }
        return NextResponse.json({error: "generation_unavailable"}, {status: 503});
    } catch (error) {
        console.error("animal fusion failed", {receiver: receiver.slug, donor: donor.slug, error: (error as Error).message});
        return NextResponse.json({error: "fusion_failed"}, {status: 502});
    }
}

/** A fused pair by slug, for `?fusion=` links to pairs that have no page yet. */
export async function GET(request: Request) {
    const pair = parseAnimalFusionSlug(new URL(request.url).searchParams.get("slug") ?? "");
    const receiver = pair ? getFusableSpecies(pair.receiverSlug) : null;
    const donor = pair ? getFusableSpecies(pair.donorSlug) : null;
    if (!receiver || !donor) return NextResponse.json({error: "unknown_animal"}, {status: 400});

    const lookup = checkRateLimit(`fusion-lookup:${getRequestIdentifier(request)}`, LOOKUP_LIMIT, LOOKUP_WINDOW_MS);
    if (!lookup.allowed) return rateLimited(lookup.retryAfterSeconds);

    const admin = createSupabaseServiceClient();
    if (!admin) return NextResponse.json({error: "unavailable"}, {status: 503});

    const result = await fuseSpecies(admin, receiver, donor, {allowGenerate: false}).catch(() => null);
    if (result?.status !== "ok") return NextResponse.json({error: "not_fused"}, {status: 404});
    return NextResponse.json(fusionPayload(result.entry, receiver, donor, result.source), {
        headers: {"Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600"}
    });
}
