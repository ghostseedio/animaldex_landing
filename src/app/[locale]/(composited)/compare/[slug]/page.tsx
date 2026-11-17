import {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import {renderComparisonArticle} from "@/app/[locale]/(composited)/comparisons/_components/comparison-article";
import {renderComparisonGenerating} from "@/app/[locale]/(composited)/comparisons/_components/comparison-generating-screen";
import {findComparableAnimal} from "@/data/comparison-animals";
import {
    canonicalUnpublishedComparisonSlug,
    fetchSpeciesComparisonBySlug,
    parseComparisonSlug,
    resolveReadyChallengeEntry,
    reversedComparisonSlug
} from "@/data/species-comparisons";
import {getLocalePath} from "@/lib/site";

// On-demand comparisons for pairs that have no static page yet (the static
// /comparisons/[slug] route is SSG-only by contract). A pair generated here is
// read fresh from species_comparisons;
// a pair not generated yet shows the generating screen, which asks the app's
// get-or-generate-species-comparison function (Claude → OpenAI → Gemini) and
// reloads. Kept out of the index: the next published-SEO refresh promotes
// these pairs to real static pages, and this route then redirects to them.

type Props = {params: {locale: string; slug: string}};

export const dynamic = "force-dynamic";

type Resolution =
    | {kind: "redirect"; path: string}
    | {kind: "missing"}
    | {kind: "ready"; challenge: NonNullable<Awaited<ReturnType<typeof fetchSpeciesComparisonBySlug>>>}
    | {kind: "pending"; slug: string; animalA: NonNullable<Awaited<ReturnType<typeof findComparableAnimal>>>; animalB: NonNullable<Awaited<ReturnType<typeof findComparableAnimal>>>};

async function resolveLiveComparison(rawSlug: string): Promise<Resolution> {
    const slug = rawSlug.trim().toLowerCase();
    const parsed = parseComparisonSlug(slug);
    if (!parsed || parsed.animalASlug === parsed.animalBSlug) return {kind: "missing"};

    // A published static page always wins, in either order.
    if (await resolveReadyChallengeEntry(slug)) return {kind: "redirect", path: `/comparisons/${slug}`};
    const reversed = reversedComparisonSlug(slug);
    if (reversed && await resolveReadyChallengeEntry(reversed)) return {kind: "redirect", path: `/comparisons/${reversed}`};

    // Unpublished pairs are generated once, under the alphabetical slug.
    const canonical = canonicalUnpublishedComparisonSlug(slug) ?? slug;
    if (canonical !== slug) return {kind: "redirect", path: `/compare/${canonical}`};

    const generated = await fetchSpeciesComparisonBySlug(canonical, {fresh: true});
    if (generated) return {kind: "ready", challenge: generated};

    const [animalA, animalB] = await Promise.all([findComparableAnimal(parsed.animalASlug), findComparableAnimal(parsed.animalBSlug)]);
    if (!animalA || !animalB) return {kind: "missing"};
    return {kind: "pending", slug: canonical, animalA, animalB};
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const resolution = await resolveLiveComparison(params.slug);
    if (resolution.kind === "ready") {
        return {title: resolution.challenge.title, description: resolution.challenge.quickVerdict, robots: {index: false, follow: true}};
    }
    if (resolution.kind === "pending") {
        return {title: `${resolution.animalA.name} vs ${resolution.animalB.name}`, robots: {index: false, follow: true}};
    }
    return {robots: {index: false, follow: true}};
}

export default async function LiveComparisonPage({params}: Props) {
    const {locale} = params;
    const resolution = await resolveLiveComparison(params.slug);
    if (resolution.kind === "missing") notFound();
    if (resolution.kind === "redirect") redirect(getLocalePath(locale, resolution.path));
    if (resolution.kind === "ready") return renderComparisonArticle({locale, challenge: resolution.challenge});
    return renderComparisonGenerating({
        locale,
        basePath: getLocalePath(locale, "/compare"),
        slug: resolution.slug,
        animalA: resolution.animalA,
        animalB: resolution.animalB
    });
}
