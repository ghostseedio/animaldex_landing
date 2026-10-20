import {NextResponse} from "next/server";
import {revalidateTag} from "next/cache";
import {isChallengeComparisonType, type ChallengeComparisonType} from "@/data/challenges";
import {findComparableAnimal} from "@/data/comparison-animals";
import {
    SPECIES_COMPARISON_CACHE_TAG,
    buildComparisonSlug,
    canonicalUnpublishedComparisonSlug,
    fetchSpeciesComparisonBySlug,
    getOrGenerateSpeciesComparison,
    parseComparisonSlug,
    resolveReadyChallengeEntry,
    speciesComparisonSlugCacheTag
} from "@/data/species-comparisons";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";
import {issueComparisonIntent, isSameOriginBrowserRequest, looksLikeBot, verifyComparisonIntent} from "@/lib/comparison-generation-guard";

/** A published (static/snapshot) entry for either order, else a generated DB row under the canonical slug. */
async function findReadyComparison(requestedSlug: string, reversedSlug: string) {
    return (await resolveReadyChallengeEntry(requestedSlug))
        ?? (await resolveReadyChallengeEntry(reversedSlug))
        ?? (await fetchSpeciesComparisonBySlug(canonicalUnpublishedComparisonSlug(requestedSlug) ?? requestedSlug, {fresh: true}));
}

export const runtime = "nodejs";

const GENERATION_LIMIT = 5;
const GENERATION_WINDOW_MS = 60 * 60 * 1000;
// Site-wide ceiling on new paid comparisons per day. The site runs as one
// process on the VM, so this in-memory window is effectively global.
const SITE_GENERATION_LIMIT = Number(process.env.COMPARISON_DAILY_GENERATION_LIMIT) || 40;
const SITE_GENERATION_WINDOW_MS = 24 * 60 * 60 * 1000;

type GenerateRequestBody = {
    animalA?: string;
    animalB?: string;
    slug?: string;
    comparisonType?: string;
    refreshImage?: boolean;
    intent?: string;
};

function normalizeSlug(value: unknown) {
    return String(value ?? "").trim().toLowerCase();
}

/**
 * Cheap status probe. Generation takes ~45s, which can outlive the platform's
 * function timeout, so the client polls this instead of trusting the POST to
 * return. Reads published entries and generated rows — never spends an AI call.
 * A pending answer carries the signed intent token a generate click needs.
 */
export async function GET(request: Request) {
    const {searchParams} = new URL(request.url);
    const slug = normalizeSlug(searchParams.get("slug"));
    const parsed = slug ? parseComparisonSlug(slug) : null;

    if (!parsed) {
        return NextResponse.json({error: "invalid_pair"}, {status: 400});
    }

    const reversedSlug = buildComparisonSlug(parsed.animalBSlug, parsed.animalASlug, parsed.comparisonType);
    const existing = await findReadyComparison(slug, reversedSlug);

    if (!existing) {
        // The intent token the generating screen must send back with its click.
        return NextResponse.json(
            {status: "pending", intent: issueComparisonIntent(slug)},
            {headers: {"Cache-Control": "no-store"}}
        );
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
    const existing = await findReadyComparison(requestedSlug, reversedSlug);

    if (existing && !body.refreshImage) {
        return NextResponse.json({status: "ready", slug: existing.slug, title: existing.title});
    }

    // Only a person on our own generating screen may spend: same-origin browser
    // fetch, no bot user agent, and the signed intent token that page rendered.
    // The token is bound to the page's slug, so the pair must come from that slug.
    const intent = verifyComparisonIntent(normalizeSlug(body.slug), body.intent);
    const pairMatchesIntent = Boolean(fromSlug)
        && fromSlug?.animalASlug === animalASlug
        && fromSlug?.animalBSlug === animalBSlug;
    if (looksLikeBot(request.headers.get("user-agent")) || !isSameOriginBrowserRequest(request) || intent !== "ok" || !pairMatchesIntent) {
        console.warn("[comparisons/generate] refused", {
            slug: normalizeSlug(body.slug) || requestedSlug,
            intent,
            ip: getRequestIdentifier(request),
            userAgent: request.headers.get("user-agent")?.slice(0, 200) ?? null
        });
        return NextResponse.json({error: intent === "expired" ? "intent_expired" : "forbidden"}, {status: 403});
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

    const siteLimit = checkRateLimit("comparison-generate:site", SITE_GENERATION_LIMIT, SITE_GENERATION_WINDOW_MS);
    if (!siteLimit.allowed) {
        console.warn("[comparisons/generate] site daily cap reached", {limit: SITE_GENERATION_LIMIT});
        return NextResponse.json(
            {error: "rate_limited", retryAfterSeconds: siteLimit.retryAfterSeconds},
            {status: 429, headers: {"Retry-After": String(siteLimit.retryAfterSeconds)}}
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
        // Best effort: Next 13.4 can throw "static generation store missing" here,
        // and a failed cache drop must not turn a saved comparison into an error.
        try {
            revalidateTag(SPECIES_COMPARISON_CACHE_TAG);
            revalidateTag(speciesComparisonSlugCacheTag(comparison.slug));
            if (comparison.slug !== requestedSlug) {
                revalidateTag(speciesComparisonSlugCacheTag(requestedSlug));
            }
        } catch (error) {
            console.warn("[comparisons/generate] revalidateTag failed", error instanceof Error ? error.message : error);
        }

        return NextResponse.json({status: "ready", slug: comparison.slug, title: comparison.title});
    } catch (error) {
        const message = error instanceof Error ? error.message : "generation_failed";
        return NextResponse.json({error: message}, {status: 502});
    }
}
