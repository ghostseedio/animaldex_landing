import {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import {renderComparisonArticle, resolveComparisonSpecies} from "@/app/[locale]/(composited)/comparisons/_components/comparison-article";
import {renderComparisonGenerating} from "@/app/[locale]/(composited)/comparisons/_components/comparison-generating-screen";
import {getComparisonPageData} from "@/data/species-comparisons";
import {publishedStaticComparisonRedirectSlug} from "@/lib/comparison-redirect";
import {getPublishedEnglishComparisonStaticParams} from "@/lib/published-seo-page-data";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getLocalePath} from "@/lib/site";

function redirectPublishedReverse(locale: string, slug: string) {
    const target = publishedStaticComparisonRedirectSlug(slug);
    if (target) {
        redirect(getLocalePath(locale, `/comparisons/${target}`));
    }
}

type Props = {params: {locale: string; slug: string}};

export const revalidate = false;
export const dynamicParams = false;

export function generateStaticParams() {
    return getPublishedEnglishComparisonStaticParams();
}

const META_DESCRIPTION_MAX = 155;

/**
 * Search snippets should lead with the answer ("who would win"), so the meta
 * description is the data-driven verdict, trimmed at a sentence boundary when
 * one fits (else a word boundary + ellipsis). Falls back to the row summary.
 */
function buildVerdictMetaDescription(quickVerdict: string | undefined, fallback: string) {
    const verdict = (quickVerdict ?? "").replace(/\s+/g, " ").trim();
    if (!verdict) {
        return fallback;
    }
    if (verdict.length <= META_DESCRIPTION_MAX) {
        return verdict;
    }

    const head = verdict.slice(0, META_DESCRIPTION_MAX + 1);
    const sentenceStop = /[.!?](?=\s|$)/g;
    let sentenceEnd = -1;
    let match: RegExpExecArray | null;
    while ((match = sentenceStop.exec(head)) !== null && match.index < META_DESCRIPTION_MAX) {
        sentenceEnd = match.index;
    }
    if (sentenceEnd >= 40) {
        return verdict.slice(0, sentenceEnd + 1);
    }

    const cut = verdict.slice(0, META_DESCRIPTION_MAX - 1);
    const lastSpace = cut.lastIndexOf(" ");
    const trimmed = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:\-–—]+$/, "");
    return `${trimmed}…`;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    redirectPublishedReverse(params.locale, params.slug);
    const data = await getComparisonPageData(params.slug);

    if (data.status === "pending") {
        return {
            title: `${data.animalA.name} vs ${data.animalB.name}`,
            robots: {index: false, follow: true}
        };
    }
    if (data.status === "redirect") {
        redirect(getLocalePath(params.locale, `/comparisons/${data.slug}`));
    }
    if (data.status !== "ready") {
        return {};
    }

    const challenge = data.challenge;
    const [animalA, animalB] = await Promise.all([
        resolveComparisonSpecies(challenge.animalASlug, challenge.animalADisplayName),
        resolveComparisonSpecies(challenge.animalBSlug, challenge.animalBDisplayName)
    ]);
    return buildContentMetadata({
        locale: params.locale,
        pathname: `/comparisons/${challenge.slug}`,
        title: challenge.title,
        description: buildVerdictMetaDescription(challenge.quickVerdict, challenge.description),
        keywords: [...challenge.searchIntents, challenge.comparisonType, animalA.name, animalB.name],
        featuredImage: challenge.featuredImage,
        publishedAt: challenge.publishedAt,
        updatedAt: challenge.updatedAt,
        tags: [challenge.comparisonType, animalA.name, animalB.name]
    });
}

export default async function ComparisonDetailPage({params}: Props) {
    const {locale, slug} = params;
    redirectPublishedReverse(locale, slug);
    const data = await getComparisonPageData(slug);

    if (data.status === "missing") {
        notFound();
    }

    if (data.status === "redirect") {
        redirect(getLocalePath(locale, `/comparisons/${data.slug}`));
    }

    if (data.status === "pending") {
        return renderComparisonGenerating({
            locale,
            basePath: getLocalePath(locale, "/comparisons"),
            slug,
            animalA: data.animalA,
            animalB: data.animalB
        });
    }

    return renderComparisonArticle({locale, challenge: data.challenge});
}
