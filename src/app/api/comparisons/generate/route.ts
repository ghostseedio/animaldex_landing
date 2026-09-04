import {NextResponse} from "next/server";
import {revalidateTag} from "next/cache";
import {isChallengeComparisonType, type ChallengeComparisonType} from "@/data/challenges";
import {findComparableAnimal} from "@/data/comparison-animals";
import {
    SPECIES_COMPARISON_CACHE_TAG,
    buildComparisonSlug,
    canonicalUnpublishedComparisonSlug,
    getOrGenerateSpeciesComparison,
    parseComparisonSlug,
    resolveReadyChallengeEntry,
    speciesComparisonSlugCacheTag
} from "@/data/species-comparisons";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";

export const runtime = "nodejs";

const GENERATION_LIMIT = 5;
const GENERATION_WINDOW_MS = 60 * 60 * 1000;

type GenerateRequestBody = {
    animalA?: string;
    animalB?: string;
    slug?: string;
    comparisonType?: string;
    refreshImage?: boolean;
};

function normalizeSlug(value: unknown) {
    return String(value ?? "").trim().toLowerCase();
}

/**
 * Cheap status probe. Generation takes ~45s, which can outlive the platform's
 * function timeout, so the client polls this instead of trusting the POST to
 * return. Reads published rows only — never spends an AI call.
 */
export async function GET(request: Request) {
    const {searchParams} = new URL(request.url);
    const slug = normalizeSlug(searchParams.get("slug"));
    const parsed = slug ? parseComparisonSlug(slug) : null;

    if (!parsed) {
        return NextResponse.json({error: "invalid_pair"}, {status: 400});
    }

    const reversedSlug = buildComparisonSlug(parsed.animalBSlug, parsed.animalASlug, parsed.comparisonType);
    const existing = (await resolveReadyChallengeEntry(slug))
        ?? (await resolveReadyChallengeEntry(reversedSlug));

    if (!existing) {
        return NextResponse.json({status: "pending"}, {headers: {"Cache-Control": "no-store"}});
    }

    return NextResponse.json(
        {status: "ready", slug: existing.slug, title: existing.title},
        {headers: {"Cache-Control": "no-store"}}
    );
}

export async function POST(request: Request) {
    let body: GenerateRequestBody;
    try {
        body = (await request.json()) as GenerateRequestBody;
    } catch {
        return NextResponse.json({error: "invalid_request"}, {status: 400});
    }

    const fromSlug = body.slug ? parseComparisonSlug(normalizeSlug(body.slug)) : null;
    const animalASlug = normalizeSlug(body.animalA) || fromSlug?.animalASlug || "";
    const animalBSlug = normalizeSlug(body.animalB) || fromSlug?.animalBSlug || "";
    const requestedType = normalizeSlug(body.comparisonType);
    const comparisonType: ChallengeComparisonType = isChallengeComparisonType(requestedType)
        ? requestedType
        : fromSlug?.comparisonType ?? "battle";

    if (!animalASlug || !animalBSlug || animalASlug === animalBSlug) {
        return NextResponse.json({error: "invalid_pair"}, {status: 400});
    }

    // Only catalog species may be generated: keeps paid AI calls on real pairs
    // and stops arbitrary slugs from minting junk pages.
    const [animalA, animalB] = await Promise.all([
        findComparableAnimal(animalASlug),
        findComparableAnimal(animalBSlug)
    ]);

    if (!animalA || !animalB) {
        return NextResponse.json(
            {
                error: "unknown_animal",
                animalAFound: Boolean(animalA),
                animalBFound: Boolean(animalB)
            },
            {status: 404}
        );
    }

    const requestedSlug = buildComparisonSlug(animalA.slug, animalB.slug, comparisonType);
    const reversedSlug = buildComparisonSlug(animalB.slug, animalA.slug, comparisonType);

    // Cache hits are free and unthrottled — including the reversed pair, which
    // shares one canonical row upstream.
    const existing = (await resolveReadyChallengeEntry(requestedSlug))
        ?? (await resolveReadyChallengeEntry(reversedSlug));

    if (existing && !body.refreshImage) {
        return NextResponse.json({status: "ready", slug: existing.slug, title: existing.title});
    }

    const limit = checkRateLimit(
        `comparison-generate:${getRequestIdentifier(request)}`,
        GENERATION_LIMIT,
        GENERATION_WINDOW_MS
    );

    if (!limit.allowed) {
        return NextResponse.json(
            {error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds},
            {status: 429, headers: {"Retry-After": String(limit.retryAfterSeconds)}}
        );
    }

    try {
        const unpublishedCanonicalSlug = canonicalUnpublishedComparisonSlug(requestedSlug) || requestedSlug;
        const unpublishedCanonical = parseComparisonSlug(unpublishedCanonicalSlug);
        const comparison = await getOrGenerateSpeciesComparison({
            animalASlug: unpublishedCanonical?.animalASlug || animalA.slug,
            animalBSlug: unpublishedCanonical?.animalBSlug || animalB.slug,
            comparisonType,
            forceRegenerateImage: body.refreshImage === true
        });

        if (!comparison) {
            return NextResponse.json({error: "generation_failed"}, {status: 502});
        }

        // Publish immediately: drop the cached misses for this slug plus the
        // directory/sitemap feeds so the new page is live on the next request.
        revalidateTag(SPECIES_COMPARISON_CACHE_TAG);
        revalidateTag(speciesComparisonSlugCacheTag(comparison.slug));
        if (comparison.slug !== requestedSlug) {
            revalidateTag(speciesComparisonSlugCacheTag(requestedSlug));
        }

        return NextResponse.json({status: "ready", slug: comparison.slug, title: comparison.title});
    } catch (error) {
        const message = error instanceof Error ? error.message : "generation_failed";
        return NextResponse.json({error: message}, {status: 502});
    }
}
