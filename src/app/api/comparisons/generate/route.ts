import {NextRequest, NextResponse} from "next/server";
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
import {
    comparisonsGenerateEnabled,
    generationRefusal,
    type GenerationRequester,
    issueComparisonIntent,
    isSameOriginBrowserRequest,
    userDailyGenerationLimit,
    verifyComparisonIntent
} from "@/lib/comparison-generation-guard";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

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
const USER_GENERATION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Who is asking: an admin session, else the signed-in account (verified with
 * Supabase Auth), else nobody. Only the first two may spend (Nov 2026).
 */
async function requesterOf(request: NextRequest): Promise<GenerationRequester> {
    if (await isSupportAdminRequestAuthorized(request).catch(() => false)) return {kind: "admin"};
    const supabase = createSupabaseServerClient();
    if (!supabase) return {kind: "anonymous"};
    const {data} = await supabase.auth.getUser().catch(() => ({data: {user: null}}));
    return data.user ? {kind: "user", userId: data.user.id} : {kind: "anonymous"};
}

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
 * A pending answer carries the signed intent token a generate click needs, for
 * a signed-in account or an admin; anyone else is told to sign in first.
 */
export async function GET(request: NextRequest) {
    const {searchParams} = new URL(request.url);
    const slug = normalizeSlug(searchParams.get("slug"));
    const parsed = slug ? parseComparisonSlug(slug) : null;

    if (!parsed) {
        return NextResponse.json({error: "invalid_pair"}, {status: 400});
    }

    const reversedSlug = buildComparisonSlug(parsed.animalBSlug, parsed.animalASlug, parsed.comparisonType);
    const existing = await findReadyComparison(slug, reversedSlug);

    if (!existing) {
        // Generation is off on the web (16 Nov 2026): no token for anyone, and the screen says the pair is not available.
        if (!comparisonsGenerateEnabled()) {
            return NextResponse.json({status: "pending", intent: null, generationOff: true}, {headers: {"Cache-Control": "no-store"}});
        }
        // The intent token the generating screen must send back with its click; none for a visitor who is not signed in.
        const requester = await requesterOf(request);
        return NextResponse.json(
            requester.kind === "anonymous" ? {status: "pending", intent: null, signInRequired: true} : {status: "pending", intent: issueComparisonIntent(slug)},
            {headers: {"Cache-Control": "no-store"}}
        );
    }

    return NextResponse.json(
        {status: "ready", slug: existing.slug, title: existing.title},
        {headers: {"Cache-Control": "no-store"}}
    );
}

export async function POST(request: NextRequest) {
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

    // Only a person on our own generating screen may spend: a signed-in account
    // or an admin, same-origin browser fetch, no bot user agent, and the signed
    // intent token that page rendered. The token is bound to the page's slug,
    // so the pair must come from that slug. Repainting artwork is admin-only.
    const intent = verifyComparisonIntent(normalizeSlug(body.slug), body.intent);
    const pairMatchesIntent = Boolean(fromSlug)
        && fromSlug?.animalASlug === animalASlug
        && fromSlug?.animalBSlug === animalBSlug;
    const requester = await requesterOf(request);
    const refusal = generationRefusal({
        requester,
        userAgent: request.headers.get("user-agent"),
        sameOrigin: isSameOriginBrowserRequest(request),
        intent,
        pairMatchesIntent,
        refreshImage: body.refreshImage === true,
        generationOn: comparisonsGenerateEnabled()
    });
    if (refusal) {
        console.warn("[comparisons/generate] refused", {
            slug: normalizeSlug(body.slug) || requestedSlug,
            reason: refusal.error,
            requester: requester.kind,
            intent,
            ip: getRequestIdentifier(request),
            userAgent: request.headers.get("user-agent")?.slice(0, 200) ?? null
        });
        return NextResponse.json({error: refusal.error}, {status: refusal.status});
    }

    // An account's own daily ceiling; admins have none.
    if (requester.kind === "user") {
        const userLimit = checkRateLimit(`comparison-generate:user:${requester.userId}`, userDailyGenerationLimit(), USER_GENERATION_WINDOW_MS);
        if (!userLimit.allowed) {
            return NextResponse.json(
                {error: "rate_limited", retryAfterSeconds: userLimit.retryAfterSeconds},
                {status: 429, headers: {"Retry-After": String(userLimit.retryAfterSeconds)}}
            );
        }
    }

    const limit = requester.kind === "admin" ? {allowed: true, retryAfterSeconds: 0} : checkRateLimit(
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
